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
from app.utils.timezone import get_colombia_date, get_colombia_now_naive

ZERO = Decimal("0")
HUNDRED = Decimal("100")


def _fmt_money(v: Decimal) -> str:
    """Format as Colombian pesos"""
    rounded = int(v.quantize(Decimal("1"), rounding=ROUND_HALF_UP))
    if rounded < 0:
        return f"-${abs(rounded):,.0f}".replace(",", ".")
    return f"${rounded:,.0f}".replace(",", ".")


def _fmt_pct(v: Decimal) -> str:
    return f"{v.quantize(Decimal('0.1'))}%"


def _fmt_days(v: Decimal) -> str:
    return f"{v.quantize(Decimal('0.1'))} días"


def _fmt_ratio(v: Decimal) -> str:
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
        liquidity = (current_assets / current_liabilities) if current_liabilities > ZERO else Decimal("999")
        kpis.append(self._kpi(
            "current_ratio", "Liquidez Corriente", liquidity, _fmt_ratio, "ratio",
            [], "good" if liquidity >= Decimal("1.5") else "caution" if liquidity >= 1 else "critical",
            "Capacidad de pagar deudas a corto plazo. Ideal > 1.5"
        ))

        # Prueba Ácida
        acid_test = ((current_assets - inventory_value) / current_liabilities) if current_liabilities > ZERO else Decimal("999")
        kpis.append(self._kpi(
            "acid_test", "Prueba Ácida", acid_test, _fmt_ratio, "ratio",
            [], "good" if acid_test >= 1 else "caution" if acid_test >= Decimal("0.7") else "critical",
            "Liquidez sin contar inventario. Ideal > 1.0"
        ))

        # Capital de Trabajo
        working_capital = current_assets - current_liabilities
        kpis.append(self._kpi(
            "working_capital", "Capital de Trabajo", working_capital, _fmt_money, "$",
            [], "good" if working_capital > ZERO else "critical",
            "Dinero disponible para operaciones diarias"
        ))

        # Rotación de CxC
        ar_turnover = (revenue / avg_receivables) if avg_receivables > ZERO else ZERO
        kpis.append(self._kpi(
            "ar_turnover", "Rotación de CxC", ar_turnover, _fmt_ratio, "veces",
            [], "good" if ar_turnover >= 6 else "caution" if ar_turnover >= 3 else "critical",
            "Veces al año que se cobra la cartera completa"
        ))

        # DSO
        dso = (Decimal("365") / ar_turnover) if ar_turnover > ZERO else ZERO
        kpis.append(self._kpi(
            "dso", "Días de Cobro (DSO)", dso, _fmt_days, "días",
            [], "good" if dso <= 30 else "caution" if dso <= 60 else "critical",
            "Promedio de días para cobrar una venta a crédito"
        ))

        # Rotación de CxP
        purchases = cogs  # Approximation
        ap_turnover = (purchases / avg_payables) if avg_payables > ZERO else ZERO
        kpis.append(self._kpi(
            "ap_turnover", "Rotación de CxP", ap_turnover, _fmt_ratio, "veces",
            [], "neutral",
            "Veces al año que se paga a proveedores"
        ))

        # DPO
        dpo = (Decimal("365") / ap_turnover) if ap_turnover > ZERO else ZERO
        kpis.append(self._kpi(
            "dpo", "Días de Pago (DPO)", dpo, _fmt_days, "días",
            [], "neutral",
            "Promedio de días para pagar a proveedores"
        ))

        # Ciclo de Conversión de Efectivo
        dio = ZERO  # Simplified
        cce = dso + dio - dpo
        kpis.append(self._kpi(
            "cash_conversion_cycle", "Ciclo de Conversión", cce, _fmt_days, "días",
            [], "good" if cce <= 30 else "caution" if cce <= 60 else "critical",
            "Días entre pago a proveedor y cobro al cliente"
        ))

        # Ratio de Endeudamiento
        debt_ratio = (total_liabilities / total_assets) if total_assets > ZERO else ZERO
        kpis.append(self._kpi(
            "debt_ratio", "Ratio de Endeudamiento", debt_ratio, _fmt_ratio, "ratio",
            [], "good" if debt_ratio <= Decimal("0.5") else "caution" if debt_ratio <= Decimal("0.7") else "critical",
            "Proporción de activos financiados con deuda. Ideal < 0.5"
        ))

        # Cobertura de Deuda
        operating_cash = revenue - operating_expenses
        coverage = (operating_cash / debt_payments) if debt_payments > ZERO else Decimal("999")
        kpis.append(self._kpi(
            "debt_coverage", "Cobertura de Deuda", coverage, _fmt_ratio, "veces",
            [], "good" if coverage >= 2 else "caution" if coverage >= 1 else "critical",
            "Capacidad de cubrir pagos de deuda con flujo operativo"
        ))

        # EBITDA (simplified)
        depreciation = await self._get_total_depreciation()
        ebitda = operating_profit + depreciation
        kpis.append(self._kpi(
            "ebitda", "EBITDA", ebitda, _fmt_money, "$",
            [], "good" if ebitda > ZERO else "critical",
            "Utilidad antes de depreciación e impuestos"
        ))

        # ROA
        roa = (net_profit / total_assets * HUNDRED) if total_assets > ZERO else ZERO
        kpis.append(self._kpi(
            "roa", "ROA", roa, _fmt_pct, "%",
            [], "good" if roa > 5 else "caution" if roa > 0 else "critical",
            "Retorno sobre activos totales"
        ))

        # ROE
        roe = (net_profit / total_equity * HUNDRED) if total_equity > ZERO else ZERO
        kpis.append(self._kpi(
            "roe", "ROE", roe, _fmt_pct, "%",
            [], "good" if roe > 10 else "caution" if roe > 0 else "critical",
            "Retorno sobre patrimonio de los socios"
        ))

        # Punto de Equilibrio
        fixed_costs = await self._get_fixed_costs(period_start, period_end)
        variable_ratio = cogs / revenue if revenue > ZERO else ZERO
        breakeven = (fixed_costs / (1 - variable_ratio)) if variable_ratio < 1 else ZERO
        kpis.append(self._kpi(
            "breakeven", "Punto de Equilibrio", breakeven, _fmt_money, "$",
            [], "neutral",
            "Ventas necesarias para cubrir todos los costos"
        ))

        return {
            "period": f"{period_start.isoformat()} a {period_end.isoformat()}",
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
        """Get total outstanding receivables (for AR turnover = revenue / total_receivables)."""
        stmt = select(func.coalesce(func.sum(
            AccountsReceivable.amount - AccountsReceivable.amount_paid
        ), 0)).where(AccountsReceivable.is_paid == False)
        result = await self.db.execute(stmt)
        val = Decimal(str(result.scalar()))
        return val if val > ZERO else Decimal("1")

    async def _get_avg_payables(self) -> Decimal:
        stmt = select(func.coalesce(func.sum(
            AccountsPayable.amount - AccountsPayable.amount_paid
        ), 0)).where(AccountsPayable.is_paid == False)
        result = await self.db.execute(stmt)
        val = Decimal(str(result.scalar()))
        return val if val > ZERO else Decimal("1")

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
        self, key: str, label: str, value: Decimal, fmt_fn, unit: str,
        trend: list[Decimal], status: str, tooltip: str
    ) -> dict:
        return {
            "key": key,
            "label": label,
            "value": value,
            "formatted_value": fmt_fn(value),
            "unit": unit,
            "trend": trend,
            "trend_labels": [],
            "status": status,
            "tooltip": tooltip,
        }
