"""
Module 1: KPI Dashboard Service

Computes financial health indicators from existing data.
"""
from decimal import Decimal, ROUND_HALF_UP
from datetime import date, datetime, timedelta
from dateutil.relativedelta import relativedelta
from sqlalchemy import select, func, literal_column, case
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID

from app.models.accounting import (
    Transaction, TransactionType, Expense, BalanceAccount, AccountType,
    AccountsReceivable, AccountsPayable, DebtPaymentSchedule, DebtPaymentStatus
)
from app.models.b2b import (
    Contract, ContractStatus, Quotation, QuotationStatus,
)
from app.models.product import Product
from app.models.sale import Sale, SaleItem, SaleStatus
from app.services._cogs_resolver import resolved_cost as cogs_resolved_cost
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
        # Activos y pasivos desde la fuente canónica del balance — la misma
        # que produce el Balance General de Contabilidad ($76.6M/$19.4M).
        # Antes salían solo de BalanceAccount, ignorando inventario, CxC y
        # CxP, lo que dejaba debt_ratio en 0.00 y acid_test inconsistente. Se
        # REEMPLAZA la fuente (no se re-suma a mano) para no duplicar: CxC/CxP
        # e inventario viven solo en sus tablas, nunca como BalanceAccount.
        from app.services.patrimony import PatrimonyService
        patrimony = await PatrimonyService(self.db).get_global_patrimony_summary()
        p_assets = patrimony["assets"]
        p_liab = patrimony["liabilities"]
        current_assets = Decimal(str(p_assets["current_assets"]))
        current_liabilities = (
            Decimal(str(p_liab["accounts_payable"]["total"]))
            + Decimal(str(p_liab["pending_expenses"]["total"]))
            + Decimal(str(p_liab["debts"]["short_term"]))
        )
        total_assets = Decimal(str(p_assets["total"]))
        total_liabilities = Decimal(str(p_liab["total"]))
        total_equity = await self._get_account_total(
            [AccountType.EQUITY_CAPITAL, AccountType.EQUITY_RETAINED, AccountType.EQUITY_OTHER]
        )
        inventory_value = Decimal(str(p_assets["inventory"]["total_value"]))
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
        cogs_trend = await self._get_monthly_cogs_series(months, school_id)

        kpis = []

        # Margen Bruto
        gross_margin = (gross_profit / revenue * HUNDRED) if revenue > ZERO else ZERO
        kpis.append(self._kpi(
            "gross_margin", "Margen Bruto", gross_margin, _fmt_pct, "%",
            self._compute_margin_trend(revenue_trend, cogs_trend),
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

        # Margen Neto. Hoy net_profit == operating_profit (no se modelan
        # impuestos ni intereses), por lo que este margen es idéntico al
        # operativo. Se usan los MISMOS umbrales para no pintar dos tarjetas
        # con el mismo número y distinto color (p.ej. 17% = "caution" en
        # operativo pero "good" en neto con los umbrales antiguos).
        net_margin = (net_profit / revenue * HUNDRED) if revenue > ZERO else ZERO
        kpis.append(self._kpi(
            "net_margin", "Margen Neto", net_margin, _fmt_pct, "%",
            [], "good" if net_margin > 20 else "caution" if net_margin > 5 else "critical",
            "Ganancia neta sobre ingresos. Hoy coincide con el margen operativo: "
            "el sistema aún no modela impuestos ni intereses."
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

        # EBITDA. La depreciación NO se registra como gasto operativo en este
        # sistema (no hay filas de Expense por depreciación), así que
        # operating_profit ya está antes de D&A → EBITDA = operating_profit.
        # Antes se sumaba `accumulated_depreciation` (saldo ACUMULADO de
        # balance, no del período), lo que inflaba el EBITDA en cuanto
        # existiera depreciación registrada.
        ebitda = operating_profit
        kpis.append(self._kpi(
            "ebitda", "EBITDA", ebitda, _fmt_money, "$",
            [], "good" if ebitda > ZERO else "critical",
            "Utilidad operativa antes de depreciación y amortización "
            "(D&A no se registra por separado en este sistema)"
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

        # KPIs B2B (pilar contractual). B2B es GLOBAL: no se atribuye a un
        # colegio puntual (ver B2BContractsStreamCalculator.breakdown). En una
        # vista filtrada por colegio el mix B2B sería siempre 0% → ruido, no
        # información. Por eso solo se añaden en la vista global.
        if school_id is None:
            await self._append_b2b_kpis(kpis, period_start, period_end, revenue)

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
        """Get cost of goods sold from sale items.

        Usa el resolver compartido (`unit_cost` snapshot → `product.cost` →
        `unit_price * 0.80`) y filtra `COMPLETED`/no-histórico, igual que
        ProfitabilityService y FinancialStatementsService. Antes calculaba
        `quantity * coalesce(product.cost, 0)` sin fallback ni filtro de
        estado, lo que hacía que el Margen Bruto del dashboard de KPIs no
        coincidiera con el de Rentabilidad ni con el Estado de Resultados.
        """
        sale_cost = cogs_resolved_cost(
            item_unit_cost_col=SaleItem.unit_cost,
            item_unit_price_col=SaleItem.unit_price,
            product_cost_col=Product.cost,
        )
        stmt = (
            select(func.coalesce(func.sum(SaleItem.quantity * sale_cost), 0))
            .join(Sale, SaleItem.sale_id == Sale.id)
            .join(Product, SaleItem.product_id == Product.id)
            .where(
                Sale.status == SaleStatus.COMPLETED,
                Sale.is_historical.is_(False),
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

    async def _get_fixed_costs(self, start: date, end: date) -> Decimal:
        stmt = select(func.coalesce(func.sum(Expense.amount), 0)).where(
            Expense.is_active == True,
            Expense.is_recurring == True,
            Expense.expense_date >= start,
            Expense.expense_date <= end,
        )
        result = await self.db.execute(stmt)
        return Decimal(str(result.scalar()))

    # ---------- B2B KPI helpers ----------

    async def _b2b_revenue_by_client(self, start: date, end: date) -> dict:
        """Ingreso B2B devengado por cliente (contratos entregados en la ventana).

        Agrupa por `b2b_client_id` (no por `legal_name`, que NO es único) para que
        dos clientes homónimos no se fusionen al medir concentración. La métrica
        solo usa los valores, así que la clave es el id. `delivered_at` es DateTime
        → se acota con datetime.combine (igual que revenue_streams/alerts).
        """
        stmt = (
            select(Contract.b2b_client_id, func.coalesce(func.sum(Contract.total), 0))
            .where(
                Contract.status == ContractStatus.DELIVERED,
                Contract.delivered_at >= datetime.combine(start, datetime.min.time()),
                Contract.delivered_at <= datetime.combine(end, datetime.max.time()),
            )
            .group_by(Contract.b2b_client_id)
        )
        rows = await self.db.execute(stmt)
        return {row[0]: Decimal(str(row[1])) for row in rows}

    async def _append_b2b_kpis(
        self, kpis: list, start: date, end: date, revenue: Decimal
    ) -> None:
        """Añade los 5 KPIs comerciales B2B a la lista (efecto in-place).

        `revenue` es el ingreso total del período en BASE CAJA (Transaction
        INCOME) ya calculado en compute_kpis — se reutiliza como denominador del
        mix para que numerador y denominador compartan base contable.
        """
        delivered_start = datetime.combine(start, datetime.min.time())
        delivered_end = datetime.combine(end, datetime.max.time())

        # --- KPI 1: Tasa de Conversión de Cotizaciones ---
        # Denominador = cotizaciones DECIDIDAS (cerradas con desenlace):
        # ACCEPTED + REJECTED + EXPIRED. Se EXCLUYE draft (nunca enviada) y
        # sent/negotiation (aún abiertas: contarlas como "no convertidas"
        # castiga el pipeline vivo). EXPIRED sí cuenta: expirar sin aceptar ES
        # una conversión fallida. Ventana sobre created_at (no hay campo de
        # fecha de decisión).
        conv_row = (await self.db.execute(
            select(
                func.coalesce(func.sum(
                    case((Quotation.status == QuotationStatus.ACCEPTED, 1), else_=0)
                ), 0).label("accepted"),
                func.count(Quotation.id).label("decided"),
            ).where(
                Quotation.status.in_([
                    QuotationStatus.ACCEPTED,
                    QuotationStatus.REJECTED,
                    QuotationStatus.EXPIRED,
                ]),
                Quotation.created_at >= delivered_start,
                Quotation.created_at <= delivered_end,
            )
        )).one()
        accepted = Decimal(str(conv_row.accepted))
        decided = Decimal(str(conv_row.decided))
        conv_ratio = safe_ratio(accepted, decided)
        conversion = conv_ratio * HUNDRED if conv_ratio is not None else None
        kpis.append(self._kpi(
            "b2b_conversion_rate", "Conversión de Cotizaciones B2B", conversion,
            _fmt_pct, "%", [],
            # umbral: >50 bien, >25 precaución, <=25 crítico
            "good" if conversion is not None and conversion > 50
            else "caution" if conversion is not None and conversion > 25
            else "critical" if conversion is not None
            else "neutral",
            "Cotizaciones aceptadas sobre el total de cotizaciones ya decididas "
            "(aceptadas, rechazadas o expiradas) en el período. Excluye borradores "
            "y cotizaciones aún abiertas.",
            tooltip_unavailable="Sin cotizaciones decididas en el período — la conversión no aplica.",
        ))

        # --- KPI 2: Pipeline Ponderado ---
        # Suma de Quotation.total en estados ABIERTOS (sent + negotiation). Es un
        # snapshot del embudo HOY, no un acumulado del período → no filtra por
        # fecha. No es un ratio: 0 es información válida ($0), no dato faltante.
        pipeline_row = (await self.db.execute(
            select(func.coalesce(func.sum(Quotation.total), 0)).where(
                Quotation.status.in_([QuotationStatus.SENT, QuotationStatus.NEGOTIATION]),
            )
        )).scalar()
        weighted_pipeline = Decimal(str(pipeline_row))
        kpis.append(self._kpi(
            "b2b_weighted_pipeline", "Pipeline B2B", weighted_pipeline,
            _fmt_money, "$", [], "neutral",
            "Valor total de cotizaciones abiertas (enviadas y en negociación). "
            "Es una foto del embudo actual, no un acumulado del período.",
        ))

        # --- KPI 3: Mix B2B vs Total (base caja) ---
        # Numerador y denominador comparten base CAJA: el numerador es el
        # subconjunto B2B (category='b2b') del mismo INCOME que produce `revenue`,
        # garantizando mix <= 100% por construcción. (El ticket promedio usa base
        # accrual — documentado en su tooltip para no comparar peras con manzanas.)
        b2b_cash = (await self.db.execute(
            select(func.coalesce(func.sum(Transaction.amount), 0)).where(
                Transaction.type == TransactionType.INCOME,
                Transaction.category == "b2b",
                Transaction.transaction_date >= start,
                Transaction.transaction_date <= end,
            )
        )).scalar()
        b2b_revenue_cash = Decimal(str(b2b_cash))
        mix_ratio = safe_ratio(b2b_revenue_cash, revenue)
        mix = mix_ratio * HUNDRED if mix_ratio is not None else None
        kpis.append(self._kpi(
            "b2b_revenue_mix", "Mix B2B vs Total", mix, _fmt_pct, "%", [], "neutral",
            "Participación de los ingresos B2B (contratos corporativos) sobre los "
            "ingresos totales del período, en base caja.",
            tooltip_unavailable="Sin ingresos en el período — el mix no aplica.",
        ))

        # --- KPI 4: Ticket Promedio B2B (base accrual) ---
        # func.avg sobre contratos DELIVERED en la ventana (Stats Pattern: una
        # sola query, nunca len() sobre array paginado). Postgres puede devolver
        # avg como float → castear vía Decimal(str(...)).
        ticket_row = (await self.db.execute(
            select(
                func.avg(Contract.total).label("avg"),
                func.count(Contract.id).label("count"),
            ).where(
                Contract.status == ContractStatus.DELIVERED,
                Contract.delivered_at >= delivered_start,
                Contract.delivered_at <= delivered_end,
            )
        )).one()
        avg_ticket = (
            Decimal(str(ticket_row.avg)) if ticket_row.count and ticket_row.avg is not None
            else None
        )
        kpis.append(self._kpi(
            "b2b_avg_ticket", "Ticket Promedio B2B", avg_ticket, _fmt_money, "$",
            [], "neutral",
            "Valor promedio de los contratos B2B entregados en el período.",
            tooltip_unavailable="Sin contratos B2B entregados en el período.",
        ))

        # --- KPI 5: Concentración de Cartera ---
        # % del ingreso B2B concentrado en el cliente más grande. Riesgo
        # INVERTIDO: más alto = peor (dependencia de un solo cliente).
        revenue_by_client = await self._b2b_revenue_by_client(start, end)
        total_b2b = sum(revenue_by_client.values(), ZERO)
        top_client = max(revenue_by_client.values()) if revenue_by_client else ZERO
        conc_ratio = safe_ratio(top_client, total_b2b)
        concentration = conc_ratio * HUNDRED if conc_ratio is not None else None
        kpis.append(self._kpi(
            "b2b_portfolio_concentration", "Concentración de Cartera B2B",
            concentration, _fmt_pct, "%", [],
            # umbral invertido: >60 crítico, >40 precaución, <=40 bien
            "critical" if concentration is not None and concentration > 60
            else "caution" if concentration is not None and concentration > 40
            else "good" if concentration is not None
            else "neutral",
            "Porcentaje de los ingresos B2B concentrado en el cliente más grande. "
            "Un valor alto indica dependencia de un solo cliente.",
            tooltip_unavailable="Sin ingresos B2B en el período.",
        ))

    def _month_buckets(self, months: int, today: date) -> list[tuple[str, date, date]]:
        """`(clave 'YYYY-MM', inicio, fin)` para los últimos `months` meses,
        del más antiguo al más reciente. El mes en curso termina hoy (parcial),
        igual que el resto del módulo."""
        buckets: list[tuple[str, date, date]] = []
        for i in range(months - 1, -1, -1):
            m_start = (today - relativedelta(months=i)).replace(day=1)
            m_end = today if i == 0 else (m_start + relativedelta(months=1)) - timedelta(days=1)
            buckets.append((m_start.strftime("%Y-%m"), m_start, m_end))
        return buckets

    @staticmethod
    def _bucket_key(value) -> str:
        return value.strftime("%Y-%m") if hasattr(value, "strftime") else str(value)[:7]

    async def _get_monthly_series(
        self, tx_type: TransactionType, months: int, school_id: UUID | None = None
    ) -> list[Decimal]:
        """Suma mensual de transacciones por tipo, en UNA sola query agrupada
        por mes (antes: una query por mes → hasta 24 round-trips)."""
        today = get_colombia_date()
        buckets = self._month_buckets(months, today)
        month_trunc = func.date_trunc(literal_column("'month'"), Transaction.transaction_date)
        stmt = (
            select(month_trunc.label("m"), func.coalesce(func.sum(Transaction.amount), 0))
            .where(
                Transaction.type == tx_type,
                Transaction.transaction_date >= buckets[0][1],
                Transaction.transaction_date <= buckets[-1][2],
            )
            .group_by(month_trunc)
        )
        if school_id:
            stmt = stmt.where(Transaction.school_id == school_id)
        rows = await self.db.execute(stmt)
        by_month = {self._bucket_key(row[0]): Decimal(str(row[1])) for row in rows}
        return [by_month.get(key, ZERO) for key, _, _ in buckets]

    async def _get_monthly_cogs_series(
        self, months: int, school_id: UUID | None = None
    ) -> list[Decimal]:
        """COGS mensual con el resolver compartido y filtro COMPLETED/no
        histórico (consistente con `_get_cogs`), en UNA sola query agrupada
        por mes. Habilita una tendencia de margen bruto REAL mes a mes."""
        today = get_colombia_date()
        buckets = self._month_buckets(months, today)
        sale_cost = cogs_resolved_cost(
            item_unit_cost_col=SaleItem.unit_cost,
            item_unit_price_col=SaleItem.unit_price,
            product_cost_col=Product.cost,
        )
        month_trunc = func.date_trunc(literal_column("'month'"), Sale.sale_date)
        stmt = (
            select(month_trunc.label("m"), func.coalesce(func.sum(SaleItem.quantity * sale_cost), 0))
            .join(Sale, SaleItem.sale_id == Sale.id)
            .join(Product, SaleItem.product_id == Product.id)
            .where(
                Sale.status == SaleStatus.COMPLETED,
                Sale.is_historical.is_(False),
                Sale.sale_date >= buckets[0][1],
                Sale.sale_date <= buckets[-1][2],
            )
            .group_by(month_trunc)
        )
        if school_id:
            stmt = stmt.where(Sale.school_id == school_id)
        rows = await self.db.execute(stmt)
        by_month = {self._bucket_key(row[0]): Decimal(str(row[1])) for row in rows}
        return [by_month.get(key, ZERO) for key, _, _ in buckets]

    def _compute_margin_trend(
        self, revenue_trend: list[Decimal], cogs_trend: list[Decimal]
    ) -> list[Decimal]:
        """Margen bruto real mes a mes = (ingresos − COGS) / ingresos. Antes
        aplicaba un único `cogs_ratio` del período completo a todos los meses,
        produciendo una línea SIEMPRE plana (sin información de tendencia)."""
        result = []
        for rev, cogs_m in zip(revenue_trend, cogs_trend):
            if rev > ZERO:
                result.append((rev - cogs_m) / rev * HUNDRED)
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
