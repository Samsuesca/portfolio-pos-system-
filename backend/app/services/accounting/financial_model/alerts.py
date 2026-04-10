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

        # 3. Cash runway corto
        avg_monthly_income = await self._avg_monthly_income(3)
        avg_monthly_expenses = await self._avg_monthly_expenses(3)
        monthly_burn = avg_monthly_expenses - avg_monthly_income
        if monthly_burn > ZERO:
            runway = current_assets / monthly_burn
            if runway < 2:
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
