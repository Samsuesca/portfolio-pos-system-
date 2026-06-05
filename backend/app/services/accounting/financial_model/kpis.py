"""
Module 1: KPI Dashboard Service

Computes financial health indicators from existing data.
"""
from decimal import Decimal, ROUND_HALF_UP
from datetime import date, timedelta
from dateutil.relativedelta import relativedelta
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID

from app.models.accounting import (
    Transaction, TransactionType, Expense, BalanceAccount, AccountType,
    AccountsReceivable, AccountsPayable, DebtPaymentSchedule, DebtPaymentStatus
)
from app.models.product import Product, Inventory
from app.models.sale import Sale, SaleItem
from app.services.accounting.financial_model._math import (
    is_partial_month,
    days_elapsed_in_month,
    safe_ratio,
)
from app.utils.timezone import get_colombia_date, get_colombia_now_naive

ZERO = Decimal("0")
HUNDRED = Decimal("100")
UNAVAILABLE_LABEL = "—"


def _fmt_money(v: Decimal | None) -> str:
    """Format as Colombian pesos. Devuelve `—` si v is None."""
    if v is None:
        return UNAVAILABLE_LABEL
    rounded = int(v.quantize(Decimal("1"), rounding=ROUND_HALF_UP))
    if rounded < 0:
        return f"-${abs(rounded):,.0f}".replace(",", ".")
    return f"${rounded:,.0f}".replace(",", ".")


def _fmt_pct(v: Decimal | None) -> str:
    if v is None:
        return UNAVAILABLE_LABEL
    return f"{v.quantize(Decimal('0.1'))}%"


def _fmt_days(v: Decimal | None) -> str:
    if v is None:
        return UNAVAILABLE_LABEL
    return f"{v.quantize(Decimal('0.1'))} días"


def _fmt_ratio(v: Decimal | None) -> str:
    if v is None:
        return UNAVAILABLE_LABEL
    return f"{v.quantize(Decimal('0.01'))}"


class KPIService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def compute_kpis(
        self,
        months: int = 6,
        school_id: UUID | None = None
    ) -> dict:
        today = get_colombia_date()
        period_end = today
        period_start = today - relativedelta(months=months)

        # Gather raw data
        revenue = await self._get_revenue(period_start, period_end, school_id)
        cogs = await self._get_cogs(period_start, period_end, school_id)
        operating_expenses = await self._get_operating_expenses(period_start, period_end, school_id)
        current_assets = await self._get_account_total(
            [AccountType.ASSET_CURRENT]
        )
        current_liabilities = await self._get_account_total(
            [AccountType.LIABILITY_CURRENT]
        )
        total_assets = await self._get_account_total(
            [AccountType.ASSET_CURRENT, AccountType.ASSET_FIXED, AccountType.ASSET_INTANGIBLE, AccountType.ASSET_OTHER]
        )
        total_liabilities = await self._get_account_total(
            [AccountType.LIABILITY_CURRENT, AccountType.LIABILITY_LONG, AccountType.LIABILITY_OTHER]
        )
        total_equity = await self._get_account_total(
            [AccountType.EQUITY_CAPITAL, AccountType.EQUITY_RETAINED, AccountType.EQUITY_OTHER]
        )
        inventory_value = await self._get_inventory_value()
        avg_receivables = await self._get_avg_receivables()
        avg_payables = await self._get_avg_payables()
        debt_payments = await self._get_debt_payments(period_start, period_end)

        # Compute KPIs
        gross_profit = revenue - cogs
        operating_profit = revenue - operating_expenses - cogs
        net_profit = operating_profit  # Simplified (no taxes/interest in this system)

        # Monthly trends
        revenue_trend = await self._get_monthly_series(
            TransactionType.INCOME, months, school_id
        )
        expense_trend = await self._get_monthly_expense_series(months, school_id)

        kpis = []

        # Margen Bruto
        gross_margin = (gross_profit / revenue * HUNDRED) if revenue > ZERO else ZERO
        kpis.append(self._kpi(
            "gross_margin", "Margen Bruto", gross_margin, _fmt_pct, "%",
            self._compute_margin_trend(revenue_trend, expense_trend, cogs_ratio=cogs / revenue if revenue > ZERO else ZERO),
            "good" if gross_margin > 40 else "caution" if gross_margin > 20 else "critical",
            "Porcentaje de ingresos que queda después de descontar el costo de la mercancía"
        ))

        # Margen Operativo
        op_margin = (operating_profit / revenue * HUNDRED) if revenue > ZERO else ZERO
        kpis.append(self._kpi(
            "operating_margin", "Margen Operativo", op_margin, _fmt_pct, "%",
            [], "good" if op_margin > 20 else "caution" if op_margin > 5 else "critical",
            "Porcentaje de ingresos que queda después de cubrir todos los gastos operativos"
        ))

        # Margen Neto
        net_margin = (net_profit / revenue * HUNDRED) if revenue > ZERO else ZERO
        kpis.append(self._kpi(
            "net_margin", "Margen Neto", net_margin, _fmt_pct, "%",
            [], "good" if net_margin > 15 else "caution" if net_margin > 5 else "critical",
            "Porcentaje de ganancia neta sobre los ingresos totales"
        ))

        # Liquidez Corriente
        liquidity = safe_ratio(current_assets, current_liabilities)
        kpis.append(self._kpi(
            "current_ratio", "Liquidez Corriente", liquidity, _fmt_ratio, "ratio",
            [],
            "good" if liquidity is not None and liquidity >= Decimal("1.5")
            else "caution" if liquidity is not None and liquidity >= 1
            else "critical" if liquidity is not None
            else "neutral",
            "Capacidad de pagar deudas a corto plazo. Ideal > 1.5",
            tooltip_unavailable="Sin pasivos corrientes registrados — el ratio no aplica.",
        ))

        # Prueba Ácida
        acid_test = safe_ratio(current_assets - inventory_value, current_liabilities)
        kpis.append(self._kpi(
            "acid_test", "Prueba Ácida", acid_test, _fmt_ratio, "ratio",
            [],
            "good" if acid_test is not None and acid_test >= 1
            else "caution" if acid_test is not None and acid_test >= Decimal("0.7")
            else "critical" if acid_test is not None
            else "neutral",
            "Liquidez sin contar inventario. Ideal > 1.0",
            tooltip_unavailable="Sin pasivos corrientes registrados — el ratio no aplica.",
        ))

        # Capital de Trabajo
        working_capital = current_assets - current_liabilities
        kpis.append(self._kpi(
            "working_capital", "Capital de Trabajo", working_capital, _fmt_money, "$",
            [], "good" if working_capital > ZERO else "critical",
            "Dinero disponible para operaciones diarias"
        ))

        # Rotación de CxC
        ar_turnover = safe_ratio(revenue, avg_receivables)
        kpis.append(self._kpi(
            "ar_turnover", "Rotación de CxC", ar_turnover, _fmt_ratio, "veces",
            [],
            "good" if ar_turnover is not None and ar_turnover >= 6
            else "caution" if ar_turnover is not None and ar_turnover >= 3
            else "critical" if ar_turnover is not None
            else "neutral",
            "Veces al año que se cobra la cartera completa",
            tooltip_unavailable="Sin cuentas por cobrar abiertas — la rotación no aplica.",
        ))

        # DSO (Días de Cobro) — depende de ar_turnover
        dso = safe_ratio(Decimal("365"), ar_turnover)
        kpis.append(self._kpi(
            "dso", "Días de Cobro (DSO)", dso, _fmt_days, "días",
            [],
            "good" if dso is not None and dso <= 30
            else "caution" if dso is not None and dso <= 60
            else "critical" if dso is not None
            else "neutral",
            "Promedio de días para cobrar una venta a crédito",
            tooltip_unavailable="Sin rotación de CxC — no se puede estimar DSO.",
        ))

        # Rotación de CxP
        purchases = cogs  # Approximation
        ap_turnover = safe_ratio(purchases, avg_payables)
        kpis.append(self._kpi(
            "ap_turnover", "Rotación de CxP", ap_turnover, _fmt_ratio, "veces",
            [], "neutral",
            "Veces al año que se paga a proveedores",
            tooltip_unavailable="Sin cuentas por pagar abiertas — la rotación no aplica.",
        ))

        # DPO — depende de ap_turnover
        dpo = safe_ratio(Decimal("365"), ap_turnover)
        kpis.append(self._kpi(
            "dpo", "Días de Pago (DPO)", dpo, _fmt_days, "días",
            [], "neutral",
            "Promedio de días para pagar a proveedores",
            tooltip_unavailable="Sin rotación de CxP — no se puede estimar DPO.",
        ))

        # Ciclo de Conversión de Efectivo (DIO + DSO - DPO).
        # Si DSO o DPO es None, el ciclo no es calculable.
        dio = ZERO  # Simplified
        cce: Decimal | None
        if dso is None or dpo is None:
            cce = None
        else:
            cce = dso + dio - dpo
        kpis.append(self._kpi(
            "cash_conversion_cycle", "Ciclo de Conversión", cce, _fmt_days, "días",
            [],
            "good" if cce is not None and cce <= 30
            else "caution" if cce is not None and cce <= 60
            else "critical" if cce is not None
            else "neutral",
            "Días entre pago a proveedor y cobro al cliente",
            tooltip_unavailable="Requiere DSO y DPO calculables.",
        ))

        # Ratio de Endeudamiento
        debt_ratio = safe_ratio(total_liabilities, total_assets)
        kpis.append(self._kpi(
            "debt_ratio", "Ratio de Endeudamiento", debt_ratio, _fmt_ratio, "ratio",
            [],
            "good" if debt_ratio is not None and debt_ratio <= Decimal("0.5")
            else "caution" if debt_ratio is not None and debt_ratio <= Decimal("0.7")
            else "critical" if debt_ratio is not None
            else "neutral",
            "Proporción de activos financiados con deuda. Ideal < 0.5",
            tooltip_unavailable="Sin activos registrados — el ratio no aplica.",
        ))

        # Cobertura de Deuda — solo aplica si hay deuda.
        operating_cash = revenue - operating_expenses
        coverage = safe_ratio(operating_cash, debt_payments)
        kpis.append(self._kpi(
            "debt_coverage", "Cobertura de Deuda", coverage, _fmt_ratio, "veces",
            [],
            "good" if coverage is not None and coverage >= 2
            else "caution" if coverage is not None and coverage >= 1
            else "critical" if coverage is not None
            else "neutral",
            "Capacidad de cubrir pagos de deuda con flujo operativo",
            tooltip_unavailable="Sin pagos de deuda en el período — la cobertura no aplica.",
        ))

        # EBITDA (simplified)
        depreciation = await self._get_total_depreciation()
        ebitda = operating_profit + depreciation
        kpis.append(self._kpi(
            "ebitda", "EBITDA", ebitda, _fmt_money, "$",
            [], "good" if ebitda > ZERO else "critical",
            "Utilidad antes de depreciación e impuestos"
        ))

        # ROA del período (NO anualizado). Anualizar requiere validar primero
        # que `total_assets` incluya inventario y CxC — hoy solo cuenta lo
        # registrado en BalanceAccount, sub-estimando el denominador.
        roa_ratio = safe_ratio(net_profit, total_assets)
        roa = roa_ratio * HUNDRED if roa_ratio is not None else None
        kpis.append(self._kpi(
            "roa", "ROA", roa, _fmt_pct, "%",
            [],
            "good" if roa is not None and roa > 5
            else "caution" if roa is not None and roa > 0
            else "critical" if roa is not None
            else "neutral",
            f"Retorno sobre activos totales (período de {months} meses)",
            tooltip_unavailable="Sin activos registrados — el ROA no aplica.",
        ))

        # ROE del período. None si equity <= 0 (gap conocido: capital aportado
        # no se registra hasta cerrar Gap B en formalization).
        if total_equity <= ZERO:
            roe = None
        else:
            roe_ratio = safe_ratio(net_profit, total_equity)
            roe = roe_ratio * HUNDRED if roe_ratio is not None else None
        kpis.append(self._kpi(
            "roe", "ROE", roe, _fmt_pct, "%",
            [],
            "good" if roe is not None and roe > 10
            else "caution" if roe is not None and roe > 0
            else "critical" if roe is not None
            else "neutral",
            f"Retorno sobre patrimonio (período de {months} meses)",
            tooltip_unavailable=(
                "Sin patrimonio (capital aportado) registrado — el ROE no aplica. "
                "Registra el capital aportado en cuentas de equity para activarlo."
            ),
        ))

        # Punto de Equilibrio: revenue × (1 - margen contribución) ≥ fixed_costs.
        # Resultado = fixed_costs / (1 - cogs_ratio). No aplica si:
        #   - revenue = 0 (no hay datos para estimar el margen)
        #   - fixed_costs = 0 (sin costos fijos definidos)
        #   - cogs_ratio >= 1 (vendes a pérdida estructural)
        fixed_costs = await self._get_fixed_costs(period_start, period_end)
        breakeven: Decimal | None
        breakeven_unavailable: str | None = None
        if revenue <= ZERO:
            breakeven = None
            breakeven_unavailable = "Sin ventas en el período — no se puede estimar el breakeven."
        elif fixed_costs <= ZERO:
            breakeven = None
            breakeven_unavailable = (
                "Sin costos fijos definidos en el período. "
                "Marca tus gastos recurrentes como 'fijos' para calcular el breakeven."
            )
        else:
            variable_ratio = cogs / revenue
            if variable_ratio >= 1:
                breakeven = None
                breakeven_unavailable = (
                    "Costo de ventas iguala o supera los ingresos. Revisa precios y costos."
                )
            else:
                breakeven = fixed_costs / (Decimal("1") - variable_ratio)
        kpis.append(self._kpi(
            "breakeven", "Punto de Equilibrio", breakeven, _fmt_money, "$",
            [], "neutral",
            "Ventas necesarias para cubrir todos los costos",
            tooltip_unavailable=breakeven_unavailable,
        ))

        period_label = (
            f"Últimos {months} meses ({period_start.isoformat()} → "
            f"{period_end.isoformat()})"
        )
        period_warning: str | None = None
        if is_partial_month(period_end, today):
            elapsed, total = days_elapsed_in_month(today)
            period_warning = (
                f"Mes parcial: solo {elapsed} de {total} días transcurridos. "
                "Las cifras del mes en curso no son comparables al mes completo."
            )

        return {
            "period": f"{period_start.isoformat()} a {period_end.isoformat()}",
            "period_label": period_label,
            "period_warning": period_warning,
            "generated_at": get_colombia_now_naive(),
            "kpis": kpis,
        }

    # ---------- Data fetching helpers ----------

    async def _get_revenue(self, start: date, end: date, school_id: UUID | None = None) -> Decimal:
        stmt = select(func.coalesce(func.sum(Transaction.amount), 0)).where(
            Transaction.type == TransactionType.INCOME,
            Transaction.transaction_date >= start,
            Transaction.transaction_date <= end,
        )
        if school_id:
            stmt = stmt.where(Transaction.school_id == school_id)
        result = await self.db.execute(stmt)
        return Decimal(str(result.scalar()))

    async def _get_cogs(self, start: date, end: date, school_id: UUID | None = None) -> Decimal:
        """Get cost of goods sold from sale items with product costs"""
        stmt = (
            select(func.coalesce(func.sum(SaleItem.quantity * func.coalesce(Product.cost, 0)), 0))
            .join(Sale, SaleItem.sale_id == Sale.id)
            .join(Product, SaleItem.product_id == Product.id)
            .where(
                Sale.sale_date >= start,
                Sale.sale_date <= end,
            )
        )
        if school_id:
            stmt = stmt.where(Sale.school_id == school_id)
        result = await self.db.execute(stmt)
        return Decimal(str(result.scalar()))

    async def _get_operating_expenses(self, start: date, end: date, school_id: UUID | None = None) -> Decimal:
        stmt = select(func.coalesce(func.sum(Expense.amount), 0)).where(
            Expense.is_active == True,
            Expense.expense_date >= start,
            Expense.expense_date <= end,
        )
        if school_id:
            stmt = stmt.where(Expense.school_id == school_id)
        result = await self.db.execute(stmt)
        return Decimal(str(result.scalar()))

    async def _get_account_total(self, account_types: list[AccountType]) -> Decimal:
        stmt = select(func.coalesce(func.sum(BalanceAccount.balance), 0)).where(
            BalanceAccount.account_type.in_(account_types),
            BalanceAccount.is_active == True,
        )
        result = await self.db.execute(stmt)
        return Decimal(str(result.scalar()))

    async def _get_inventory_value(self) -> Decimal:
        stmt = select(
            func.coalesce(func.sum(Inventory.quantity * func.coalesce(Product.cost, 0)), 0)
        ).join(Product, Inventory.product_id == Product.id).where(
            Inventory.quantity > 0
        )
        result = await self.db.execute(stmt)
        return Decimal(str(result.scalar()))

    async def _get_avg_receivables(self) -> Decimal:
        """Total outstanding receivables (para AR turnover = revenue / total).
        Devuelve el valor real (puede ser 0) — `safe_ratio` se encarga del
        edge case en el KPI. Antes se padde-aba con 1, lo que producía
        rotaciones astronómicas (p. ej. 43.971.599 veces/año)."""
        stmt = select(func.coalesce(func.sum(
            AccountsReceivable.amount - AccountsReceivable.amount_paid
        ), 0)).where(AccountsReceivable.is_paid == False)
        result = await self.db.execute(stmt)
        return Decimal(str(result.scalar()))

    async def _get_avg_payables(self) -> Decimal:
        """Total outstanding payables. Igual que receivables, retorna el
        valor real sin padding."""
        stmt = select(func.coalesce(func.sum(
            AccountsPayable.amount - AccountsPayable.amount_paid
        ), 0)).where(AccountsPayable.is_paid == False)
        result = await self.db.execute(stmt)
        return Decimal(str(result.scalar()))

    async def _get_debt_payments(self, start: date, end: date) -> Decimal:
        stmt = select(func.coalesce(func.sum(DebtPaymentSchedule.amount), 0)).where(
            DebtPaymentSchedule.due_date >= start,
            DebtPaymentSchedule.due_date <= end,
            DebtPaymentSchedule.status.in_([DebtPaymentStatus.PENDING, DebtPaymentStatus.PAID]),
        )
        result = await self.db.execute(stmt)
        return Decimal(str(result.scalar()))

    async def _get_total_depreciation(self) -> Decimal:
        stmt = select(func.coalesce(func.sum(BalanceAccount.accumulated_depreciation), 0)).where(
            BalanceAccount.account_type == AccountType.ASSET_FIXED,
            BalanceAccount.is_active == True,
        )
        result = await self.db.execute(stmt)
        return Decimal(str(result.scalar()))

    async def _get_fixed_costs(self, start: date, end: date) -> Decimal:
        stmt = select(func.coalesce(func.sum(Expense.amount), 0)).where(
            Expense.is_active == True,
            Expense.is_recurring == True,
            Expense.expense_date >= start,
            Expense.expense_date <= end,
        )
        result = await self.db.execute(stmt)
        return Decimal(str(result.scalar()))

    async def _get_monthly_series(
        self, tx_type: TransactionType, months: int, school_id: UUID | None = None
    ) -> list[Decimal]:
        today = get_colombia_date()
        result = []
        for i in range(months - 1, -1, -1):
            m_start = (today - relativedelta(months=i)).replace(day=1)
            if i == 0:
                m_end = today
            else:
                m_end = (m_start + relativedelta(months=1)) - timedelta(days=1)
            stmt = select(func.coalesce(func.sum(Transaction.amount), 0)).where(
                Transaction.type == tx_type,
                Transaction.transaction_date >= m_start,
                Transaction.transaction_date <= m_end,
            )
            if school_id:
                stmt = stmt.where(Transaction.school_id == school_id)
            r = await self.db.execute(stmt)
            result.append(Decimal(str(r.scalar())))
        return result

    async def _get_monthly_expense_series(self, months: int, school_id: UUID | None = None) -> list[Decimal]:
        today = get_colombia_date()
        result = []
        for i in range(months - 1, -1, -1):
            m_start = (today - relativedelta(months=i)).replace(day=1)
            if i == 0:
                m_end = today
            else:
                m_end = (m_start + relativedelta(months=1)) - timedelta(days=1)
            stmt = select(func.coalesce(func.sum(Expense.amount), 0)).where(
                Expense.is_active == True,
                Expense.expense_date >= m_start,
                Expense.expense_date <= m_end,
            )
            if school_id:
                stmt = stmt.where(Expense.school_id == school_id)
            r = await self.db.execute(stmt)
            result.append(Decimal(str(r.scalar())))
        return result

    def _compute_margin_trend(
        self, revenue_trend: list[Decimal], expense_trend: list[Decimal], cogs_ratio: Decimal
    ) -> list[Decimal]:
        result = []
        for rev, exp in zip(revenue_trend, expense_trend):
            if rev > ZERO:
                cogs_est = rev * cogs_ratio
                margin = (rev - cogs_est) / rev * HUNDRED
                result.append(margin)
            else:
                result.append(ZERO)
        return result

    def _kpi(
        self,
        key: str,
        label: str,
        value: Decimal | None,
        fmt_fn,
        unit: str,
        trend: list[Decimal],
        status: str,
        tooltip: str,
        *,
        tooltip_unavailable: str | None = None,
    ) -> dict:
        # Si value es None forzamos status neutral para que el frontend no
        # pinte el card en rojo/verde con un valor faltante.
        effective_status = status if value is not None else "neutral"
        return {
            "key": key,
            "label": label,
            "value": value,
            "formatted_value": fmt_fn(value),
            "unit": unit,
            "trend": trend,
            "trend_labels": [],
            "status": effective_status,
            "tooltip": tooltip,
            "tooltip_unavailable": tooltip_unavailable if value is None else None,
        }
