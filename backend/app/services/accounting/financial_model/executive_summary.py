"""
Module 7: Executive Summary Service
"""
from decimal import Decimal
from datetime import date
from dateutil.relativedelta import relativedelta
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.accounting import (
    Transaction, TransactionType, Expense, BalanceAccount, AccountType,
    ExpenseCategoryModel
)
from app.models.school import School
from app.utils.timezone import get_colombia_date, get_colombia_now_naive
from app.services.accounting.financial_model.kpis import KPIService
from app.services.accounting.financial_model.alerts import HealthAlertService
from app.services.accounting.financial_model.forecast import CashForecastService

ZERO = Decimal("0")
HUNDRED = Decimal("100")
MONTH_NAMES_ES = [
    "", "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"
]


class ExecutiveSummaryService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_summary(self, period: str | None = None) -> dict:
        today = get_colombia_date()

        # Parse period (YYYY-MM) or default to current month
        if period:
            try:
                parts = period.split("-")
                if len(parts) != 2:
                    raise ValueError("Expected format YYYY-MM")
                year, month = int(parts[0]), int(parts[1])
                period_start = date(year, month, 1)
            except (ValueError, IndexError, TypeError) as e:
                raise ValueError(
                    f"Invalid period format '{period}'. Expected YYYY-MM (e.g., 2026-03)."
                ) from e
        else:
            period_start = today.replace(day=1)

        period_end = (period_start + relativedelta(months=1)) - relativedelta(days=1)
        if period_end > today:
            period_end = today

        # Previous month
        prev_start = period_start - relativedelta(months=1)
        prev_end = (prev_start + relativedelta(months=1)) - relativedelta(days=1)

        period_label = f"{MONTH_NAMES_ES[period_start.month].capitalize()} {period_start.year}"

        # Key figures
        revenue = await self._sum_income(period_start, period_end)
        expenses = await self._sum_expenses(period_start, period_end)
        net_profit = revenue - expenses

        # Cash position
        cash_stmt = select(func.coalesce(func.sum(BalanceAccount.balance), 0)).where(
            BalanceAccount.account_type == AccountType.ASSET_CURRENT,
            BalanceAccount.is_active == True,
        )
        r = await self.db.execute(cash_stmt)
        cash_position = Decimal(str(r.scalar()))

        # Previous month comparison
        prev_revenue = await self._sum_income(prev_start, prev_end)
        prev_expenses = await self._sum_expenses(prev_start, prev_end)
        prev_profit = prev_revenue - prev_expenses

        revenue_vs = ((revenue - prev_revenue) / prev_revenue * HUNDRED) if prev_revenue > ZERO else None
        expenses_vs = ((expenses - prev_expenses) / prev_expenses * HUNDRED) if prev_expenses > ZERO else None
        profit_vs = ((net_profit - prev_profit) / abs(prev_profit) * HUNDRED) if prev_profit != ZERO else None

        # Top 3 schools
        school_stmt = (
            select(School.name, func.coalesce(func.sum(Transaction.amount), 0).label("total"))
            .join(School, Transaction.school_id == School.id)
            .where(
                Transaction.type == TransactionType.INCOME,
                Transaction.transaction_date >= period_start,
                Transaction.transaction_date <= period_end,
                Transaction.school_id != None,
            )
            .group_by(School.name)
            .order_by(func.sum(Transaction.amount).desc())
            .limit(3)
        )
        school_r = await self.db.execute(school_stmt)
        top_schools = []
        for name, total in school_r:
            total_dec = Decimal(str(total))
            pct = (total_dec / revenue * HUNDRED) if revenue > ZERO else ZERO
            top_schools.append({"name": name, "amount": total_dec, "percentage": pct})

        # Top 3 expense categories
        cat_labels_stmt = select(ExpenseCategoryModel.code, ExpenseCategoryModel.name).where(
            ExpenseCategoryModel.is_active == True
        )
        cat_labels_r = await self.db.execute(cat_labels_stmt)
        cat_labels = {row[0]: row[1] for row in cat_labels_r}

        exp_cat_stmt = (
            select(Expense.category, func.coalesce(func.sum(Expense.amount), 0).label("total"))
            .where(
                Expense.is_active == True,
                Expense.expense_date >= period_start,
                Expense.expense_date <= period_end,
            )
            .group_by(Expense.category)
            .order_by(func.sum(Expense.amount).desc())
            .limit(3)
        )
        exp_cat_r = await self.db.execute(exp_cat_stmt)
        top_categories = []
        for cat_code, total in exp_cat_r:
            total_dec = Decimal(str(total))
            pct = (total_dec / expenses * HUNDRED) if expenses > ZERO else ZERO
            label = cat_labels.get(cat_code, cat_code.replace("_", " ").title()) if cat_code else "Otros"
            top_categories.append({"name": label, "amount": total_dec, "percentage": pct})

        # KPI snapshot (top 5)
        kpi_service = KPIService(self.db)
        kpi_data = await kpi_service.compute_kpis(months=1)
        kpi_snapshot = kpi_data["kpis"][:5]

        # Active alerts
        alert_service = HealthAlertService(self.db)
        alerts_data = await alert_service.get_alerts()
        active_alerts = alerts_data["alerts"]

        # Forecast summary
        forecast_service = CashForecastService(self.db)
        try:
            forecast = await forecast_service.get_forecast(weeks=0, months=3)
            runway = forecast["runway_months"]
            if runway >= 999:
                forecast_summary = "El negocio es rentable. Flujo de caja positivo."
            elif runway >= 6:
                forecast_summary = f"Runway estimado: {runway:.0f} meses. Posición estable."
            elif runway >= 2:
                forecast_summary = f"Runway estimado: {runway:.1f} meses. Monitorear de cerca."
            else:
                forecast_summary = f"¡Alerta! Runway estimado: {runway:.1f} meses. Acción urgente requerida."
        except Exception:
            forecast_summary = "No se pudo calcular la proyección."

        return {
            "period": period_start.strftime("%Y-%m"),
            "period_label": period_label,
            "generated_at": get_colombia_now_naive(),
            "revenue": revenue,
            "expenses": expenses,
            "net_profit": net_profit,
            "cash_position": cash_position,
            "revenue_vs_previous": revenue_vs,
            "expenses_vs_previous": expenses_vs,
            "profit_vs_previous": profit_vs,
            "top_schools": top_schools,
            "top_expense_categories": top_categories,
            "kpi_snapshot": kpi_snapshot,
            "active_alerts": active_alerts,
            "forecast_summary": forecast_summary,
        }

    async def _sum_income(self, start: date, end: date) -> Decimal:
        stmt = select(func.coalesce(func.sum(Transaction.amount), 0)).where(
            Transaction.type == TransactionType.INCOME,
            Transaction.transaction_date >= start,
            Transaction.transaction_date <= end,
        )
        r = await self.db.execute(stmt)
        return Decimal(str(r.scalar()))

    async def _sum_expenses(self, start: date, end: date) -> Decimal:
        stmt = select(func.coalesce(func.sum(Expense.amount), 0)).where(
            Expense.is_active == True,
            Expense.expense_date >= start,
            Expense.expense_date <= end,
        )
        r = await self.db.execute(stmt)
        return Decimal(str(r.scalar()))
