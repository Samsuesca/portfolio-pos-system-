"""
Module 6: Financial Health Alerts Service
"""
from decimal import Decimal
from datetime import date
from dateutil.relativedelta import relativedelta
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.accounting import (
    Transaction, TransactionType, Expense, BalanceAccount, AccountType,
    AccountsReceivable, AccountsPayable
)
from app.models.b2b import (
    Quotation, QuotationStatus, Contract, ContractStatus, B2BClient
)
from app.utils.timezone import get_colombia_date, get_colombia_now_naive

ZERO = Decimal("0")
HUNDRED = Decimal("100")


class HealthAlertService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_alerts(self) -> dict:
        alerts = []
        today = get_colombia_date()

        # 1. Liquidez baja
        current_assets = await self._account_sum([AccountType.ASSET_CURRENT])
        current_liabilities = await self._account_sum([AccountType.LIABILITY_CURRENT])
        if current_liabilities > ZERO:
            liquidity = current_assets / current_liabilities
            if liquidity < 1:
                alerts.append(self._alert(
                    "low_liquidity", "Liquidez baja",
                    f"La liquidez corriente es {liquidity:.2f}, por debajo de 1.0. "
                    "No hay suficientes activos corrientes para cubrir deudas a corto plazo.",
                    "critical", f"{liquidity:.2f}", "< 1.0",
                    "Considere reducir gastos o aumentar ingresos para mejorar la posición de caja."
                ))

        # 2. CxC vencidas altas
        total_ar = await self._total_receivables()
        overdue_ar = await self._overdue_receivables()
        if total_ar > ZERO:
            overdue_pct = overdue_ar / total_ar * HUNDRED
            if overdue_pct > 20:
                alerts.append(self._alert(
                    "high_overdue_receivables", "CxC vencidas altas",
                    f"Las cuentas por cobrar vencidas representan {overdue_pct:.1f}% del total.",
                    "warning", f"{overdue_pct:.1f}%", "> 20%",
                    "Implemente un proceso de cobranza más agresivo para las cuentas vencidas."
                ))

        # 3. Cash runway corto. Usa el helper compartido para garantizar
        # consistencia con Proyección caja y Resumen Ejecutivo.
        from app.services.accounting.financial_model._runway import compute_runway
        runway_data = await compute_runway(self.db)
        runway = runway_data["runway_months"]
        if runway is not None and runway < 2:
            alerts.append(self._alert(
                "short_runway", "Cash runway corto",
                f"Al ritmo actual, el efectivo durará aproximadamente {runway:.1f} meses.",
                "critical", f"{runway:.1f} meses", "< 2 meses",
                "Urgente: busque formas de reducir gastos o aumentar ingresos."
            ))

        # 4. Margen deteriorándose
        this_month_start = today.replace(day=1)
        last_month_start = this_month_start - relativedelta(months=1)
        last_month_end = this_month_start - relativedelta(days=1)

        this_revenue = await self._period_revenue(this_month_start, today)
        this_expenses = await self._period_expenses(this_month_start, today)
        last_revenue = await self._period_revenue(last_month_start, last_month_end)
        last_expenses = await self._period_expenses(last_month_start, last_month_end)

        this_margin = ((this_revenue - this_expenses) / this_revenue * HUNDRED) if this_revenue > ZERO else ZERO
        last_margin = ((last_revenue - last_expenses) / last_revenue * HUNDRED) if last_revenue > ZERO else ZERO

        if last_margin > ZERO and (last_margin - this_margin) > 5:
            alerts.append(self._alert(
                "deteriorating_margin", "Margen deteriorándose",
                f"El margen bruto cayó de {last_margin:.1f}% a {this_margin:.1f}% "
                f"(−{last_margin - this_margin:.1f} pp vs mes anterior).",
                "warning", f"{this_margin:.1f}%", "Caída > 5pp",
                "Revise precios de venta y costos de mercancía."
            ))

        # 5. Concentración de ingresos
        school_revenues = await self._revenue_by_school(
            today - relativedelta(months=3), today
        )
        total_rev = sum(school_revenues.values())
        if total_rev > ZERO:
            for school_name, rev in school_revenues.items():
                pct = rev / total_rev * HUNDRED
                if pct > 60:
                    alerts.append(self._alert(
                        "revenue_concentration", "Concentración de ingresos",
                        f"El colegio '{school_name}' representa {pct:.1f}% de los ingresos totales.",
                        "info", f"{pct:.1f}%", "> 60%",
                        "Diversifique su base de clientes para reducir el riesgo."
                    ))

        # 6. Ratio de endeudamiento alto
        total_assets = await self._account_sum([
            AccountType.ASSET_CURRENT, AccountType.ASSET_FIXED,
            AccountType.ASSET_INTANGIBLE, AccountType.ASSET_OTHER
        ])
        total_liabilities = await self._account_sum([
            AccountType.LIABILITY_CURRENT, AccountType.LIABILITY_LONG,
            AccountType.LIABILITY_OTHER
        ])
        if total_assets > ZERO:
            debt_ratio = total_liabilities / total_assets
            if debt_ratio > Decimal("0.7"):
                alerts.append(self._alert(
                    "high_debt", "Deuda creciente",
                    f"El ratio de endeudamiento es {debt_ratio:.2f} (> 0.7).",
                    "warning", f"{debt_ratio:.2f}", "> 0.7",
                    "Priorice el pago de deudas antes de asumir nuevas obligaciones."
                ))

        # 7. CxP vencidas
        overdue_payables = await self._overdue_payables_count()
        if overdue_payables > 0:
            alerts.append(self._alert(
                "overdue_payables", "CxP vencidas",
                f"Hay {overdue_payables} cuenta(s) por pagar vencida(s).",
                "warning", str(overdue_payables), "> 0",
                "Pague las cuentas vencidas para evitar recargos e intereses."
            ))

        # 8. Cotizaciones B2B por vencer (oportunidad de seguimiento comercial)
        expiring = await self._b2b_expiring_quotations_count(today)
        if expiring > 0:
            alerts.append(self._alert(
                "b2b_quotation_expiring", "Cotizaciones B2B por vencer",
                f"Hay {expiring} cotización(es) enviada(s) que vencen en los próximos 7 días "
                "sin respuesta del cliente.",
                "info", str(expiring), "≤ 7 días",
                "Haga seguimiento comercial para cerrarlas antes de que expiren."
            ))

        # 9. Concentración de cartera B2B (riesgo de dependencia de un cliente)
        b2b_rev = await self._b2b_revenue_by_client(
            today - relativedelta(months=6), today
        )
        total_b2b = sum(rev for _, rev in b2b_rev)
        if total_b2b > ZERO:
            top_name, top_rev = max(b2b_rev, key=lambda t: t[1])
            top_pct = top_rev / total_b2b * HUNDRED
            if top_pct > 60:
                alerts.append(self._alert(
                    "b2b_client_concentration", "Concentración de cartera B2B",
                    f"El cliente B2B '{top_name}' representa {top_pct:.1f}% del ingreso B2B "
                    "de los últimos 6 meses.",
                    "warning", f"{top_pct:.1f}%", "> 60%",
                    "Diversifique la cartera B2B para reducir el riesgo de concentración."
                ))

        # 10. Saldos B2B vencidos (cartera de contratos a crédito)
        overdue_count, overdue_amount = await self._b2b_overdue_balance(today)
        if overdue_count > 0:
            alerts.append(self._alert(
                "b2b_overdue_balance", "Saldos B2B vencidos",
                f"Hay {overdue_count} saldo(s) de contrato B2B vencido(s) "
                f"por ${overdue_amount:,.0f}.",
                "warning", f"{overdue_count} (${overdue_amount:,.0f})", "> 0",
                "Gestione el cobro de los saldos vencidos para proteger el flujo de caja."
            ))

        critical = sum(1 for a in alerts if a["severity"] == "critical")
        warning = sum(1 for a in alerts if a["severity"] == "warning")
        info = sum(1 for a in alerts if a["severity"] == "info")

        return {
            "generated_at": get_colombia_now_naive(),
            "alerts": alerts,
            "critical_count": critical,
            "warning_count": warning,
            "info_count": info,
        }

    # ---------- Helpers ----------

    async def _account_sum(self, types: list[AccountType]) -> Decimal:
        stmt = select(func.coalesce(func.sum(BalanceAccount.balance), 0)).where(
            BalanceAccount.account_type.in_(types),
            BalanceAccount.is_active == True,
        )
        r = await self.db.execute(stmt)
        return Decimal(str(r.scalar()))

    async def _total_receivables(self) -> Decimal:
        stmt = select(func.coalesce(func.sum(
            AccountsReceivable.amount - AccountsReceivable.amount_paid
        ), 0)).where(AccountsReceivable.is_paid == False)
        r = await self.db.execute(stmt)
        return Decimal(str(r.scalar()))

    async def _overdue_receivables(self) -> Decimal:
        stmt = select(func.coalesce(func.sum(
            AccountsReceivable.amount - AccountsReceivable.amount_paid
        ), 0)).where(
            AccountsReceivable.is_paid == False,
            AccountsReceivable.is_overdue == True,
        )
        r = await self.db.execute(stmt)
        return Decimal(str(r.scalar()))

    async def _overdue_payables_count(self) -> int:
        stmt = select(func.count(AccountsPayable.id)).where(
            AccountsPayable.is_paid == False,
            AccountsPayable.is_overdue == True,
        )
        r = await self.db.execute(stmt)
        return r.scalar() or 0

    async def _period_revenue(self, start: date, end: date) -> Decimal:
        stmt = select(func.coalesce(func.sum(Transaction.amount), 0)).where(
            Transaction.type == TransactionType.INCOME,
            Transaction.transaction_date >= start,
            Transaction.transaction_date <= end,
        )
        r = await self.db.execute(stmt)
        return Decimal(str(r.scalar()))

    async def _period_expenses(self, start: date, end: date) -> Decimal:
        stmt = select(func.coalesce(func.sum(Expense.amount), 0)).where(
            Expense.is_active == True,
            Expense.expense_date >= start,
            Expense.expense_date <= end,
        )
        r = await self.db.execute(stmt)
        return Decimal(str(r.scalar()))

    async def _avg_monthly_income(self, months: int) -> Decimal:
        today = get_colombia_date()
        start = today - relativedelta(months=months)
        stmt = select(func.coalesce(func.sum(Transaction.amount), 0)).where(
            Transaction.type == TransactionType.INCOME,
            Transaction.transaction_date >= start,
            Transaction.transaction_date <= today,
        )
        r = await self.db.execute(stmt)
        total = Decimal(str(r.scalar()))
        return total / months

    async def _avg_monthly_expenses(self, months: int) -> Decimal:
        today = get_colombia_date()
        start = today - relativedelta(months=months)
        stmt = select(func.coalesce(func.sum(Expense.amount), 0)).where(
            Expense.is_active == True,
            Expense.expense_date >= start,
            Expense.expense_date <= today,
        )
        r = await self.db.execute(stmt)
        total = Decimal(str(r.scalar()))
        return total / months

    async def _revenue_by_school(self, start: date, end: date) -> dict[str, Decimal]:
        from app.models.school import School
        stmt = (
            select(School.name, func.coalesce(func.sum(Transaction.amount), 0))
            .join(School, Transaction.school_id == School.id)
            .where(
                Transaction.type == TransactionType.INCOME,
                Transaction.transaction_date >= start,
                Transaction.transaction_date <= end,
                Transaction.school_id != None,
            )
            .group_by(School.name)
        )
        r = await self.db.execute(stmt)
        return {row[0]: Decimal(str(row[1])) for row in r}

    async def _b2b_expiring_quotations_count(self, today: date) -> int:
        """Cotizaciones B2B aún abiertas que vencen en los próximos 7 días."""
        stmt = select(func.count(Quotation.id)).where(
            Quotation.status.in_([QuotationStatus.SENT, QuotationStatus.NEGOTIATION]),
            Quotation.valid_until >= today,
            Quotation.valid_until <= today + relativedelta(days=7),
        )
        r = await self.db.execute(stmt)
        return r.scalar() or 0

    async def _b2b_revenue_by_client(self, start: date, end: date) -> list[tuple[str, Decimal]]:
        """Ingreso B2B por cliente (contratos entregados en la ventana).

        Agrupa por b2b_client_id (no por legal_name, que NO es único) para que dos
        clientes homónimos no se fusionen y sobreestimen la concentración. Devuelve
        (nombre, ingreso) por cliente; el nombre es para el mensaje de la alerta.
        """
        from datetime import datetime
        stmt = (
            select(B2BClient.legal_name, func.coalesce(func.sum(Contract.total), 0))
            .join(B2BClient, Contract.b2b_client_id == B2BClient.id)
            .where(
                Contract.status == ContractStatus.DELIVERED,
                Contract.delivered_at >= datetime.combine(start, datetime.min.time()),
                Contract.delivered_at <= datetime.combine(end, datetime.max.time()),
            )
            .group_by(B2BClient.id, B2BClient.legal_name)
        )
        r = await self.db.execute(stmt)
        return [(row[0], Decimal(str(row[1]))) for row in r]

    async def _b2b_overdue_balance(self, today: date) -> tuple[int, Decimal]:
        """(conteo, monto) de CxC B2B vencidas (saldo a crédito de contratos)."""
        stmt = select(
            func.count(AccountsReceivable.id),
            func.coalesce(func.sum(
                AccountsReceivable.amount - AccountsReceivable.amount_paid
            ), 0),
        ).where(
            AccountsReceivable.b2b_client_id.isnot(None),
            AccountsReceivable.is_paid == False,  # noqa: E712
            AccountsReceivable.due_date < today,
        )
        r = (await self.db.execute(stmt)).one()
        return int(r[0] or 0), Decimal(str(r[1]))

    def _alert(
        self, alert_type: str, title: str, message: str,
        severity: str, metric_value: str, threshold: str,
        recommendation: str = ""
    ) -> dict:
        return {
            "alert_type": alert_type,
            "title": title,
            "message": message,
            "severity": severity,
            "metric_value": metric_value,
            "threshold": threshold,
            "recommendation": recommendation,
        }
