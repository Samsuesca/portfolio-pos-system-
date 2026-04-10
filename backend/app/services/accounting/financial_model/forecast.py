"""
Module 5: Advanced Cash Flow Forecast Service
"""
from decimal import Decimal
from datetime import date, timedelta
from dateutil.relativedelta import relativedelta
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.accounting import (
    Transaction, TransactionType, Expense, BalanceAccount, AccountType,
    AccountsReceivable, AccountsPayable, DebtPaymentSchedule, DebtPaymentStatus
)
from app.utils.timezone import get_colombia_date

ZERO = Decimal("0")
MONTH_NAMES_ES = [
    "", "Ene", "Feb", "Mar", "Abr", "May", "Jun",
    "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"
]


class CashForecastService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_forecast(
        self,
        weeks: int = 4,
        months: int = 6,
        min_threshold: Decimal = Decimal("500000"),
    ) -> dict:
        today = get_colombia_date()

        # Current cash position
        current_balance = await self._get_current_cash()

        # Historical averages for projection
        avg_weekly_income = await self._avg_weekly_income(12)
        avg_weekly_expenses = await self._avg_weekly_expenses(12)
        avg_monthly_income = avg_weekly_income * Decimal("4.33")
        avg_monthly_expenses = avg_weekly_expenses * Decimal("4.33")

        # Known future items
        pending_receivables = await self._pending_receivables()
        pending_payables = await self._pending_payables()
        scheduled_debt = await self._scheduled_debt_payments(months)

        # Build 3 scenarios
        scenarios = []
        for scenario_name, label, factor in [
            ("optimistic", "Optimista (+15%)", Decimal("1.15")),
            ("expected", "Esperado", Decimal("1.0")),
            ("pessimistic", "Pesimista (-15%)", Decimal("0.85")),
        ]:
            periods = []
            running_balance = current_balance

            # Weekly periods (first N weeks)
            for w in range(weeks):
                w_start = today + timedelta(weeks=w)
                w_end = w_start + timedelta(days=6)
                projected_income = avg_weekly_income * factor
                projected_expenses = avg_weekly_expenses

                # Add receivables due this week
                ar_due = self._receivables_due_in_range(pending_receivables, w_start, w_end)
                projected_income += ar_due * factor

                # Add payables due this week
                ap_due = self._payables_due_in_range(pending_payables, w_start, w_end)
                projected_expenses += ap_due

                # Add scheduled debt
                debt_due = self._debt_due_in_range(scheduled_debt, w_start, w_end)
                projected_expenses += debt_due

                net = projected_income - projected_expenses
                running_balance += net

                periods.append({
                    "period": f"S{w + 1}",
                    "period_label": f"Semana {w + 1} ({w_start.strftime('%d/%m')})",
                    "projected_income": projected_income,
                    "projected_expenses": projected_expenses,
                    "projected_net": net,
                    "projected_balance": running_balance,
                })

            # Monthly periods (after weekly)
            monthly_start = today + timedelta(weeks=weeks)
            for m in range(months):
                m_start = monthly_start + relativedelta(months=m)
                m_end = m_start + relativedelta(months=1) - timedelta(days=1)
                projected_income = avg_monthly_income * factor
                projected_expenses = avg_monthly_expenses

                # Receivables and payables
                ar_due = self._receivables_due_in_range(pending_receivables, m_start, m_end)
                projected_income += ar_due * factor
                ap_due = self._payables_due_in_range(pending_payables, m_start, m_end)
                projected_expenses += ap_due
                debt_due = self._debt_due_in_range(scheduled_debt, m_start, m_end)
                projected_expenses += debt_due

                net = projected_income - projected_expenses
                running_balance += net

                periods.append({
                    "period": m_start.strftime("%Y-%m"),
                    "period_label": f"{MONTH_NAMES_ES[m_start.month]} {m_start.year}",
                    "projected_income": projected_income,
                    "projected_expenses": projected_expenses,
                    "projected_net": net,
                    "projected_balance": running_balance,
                })

            scenarios.append({
                "name": scenario_name,
                "label": label,
                "periods": periods,
            })

        # Runway calculation (expected scenario)
        expected_monthly_burn = avg_monthly_expenses - avg_monthly_income
        if expected_monthly_burn > ZERO:
            runway = current_balance / expected_monthly_burn
        else:
            runway = Decimal("999")  # Profitable - infinite runway

        return {
            "current_balance": current_balance,
            "min_threshold": min_threshold,
            "runway_months": runway,
            "scenarios": scenarios,
        }

    async def _get_current_cash(self) -> Decimal:
        stmt = select(func.coalesce(func.sum(BalanceAccount.balance), 0)).where(
            BalanceAccount.account_type == AccountType.ASSET_CURRENT,
            BalanceAccount.is_active == True,
        )
        r = await self.db.execute(stmt)
        return Decimal(str(r.scalar()))

    async def _avg_weekly_income(self, weeks: int) -> Decimal:
        today = get_colombia_date()
        start = today - timedelta(weeks=weeks)
        stmt = select(func.coalesce(func.sum(Transaction.amount), 0)).where(
            Transaction.type == TransactionType.INCOME,
            Transaction.transaction_date >= start,
            Transaction.transaction_date <= today,
        )
        r = await self.db.execute(stmt)
        total = Decimal(str(r.scalar()))
        return total / weeks if weeks > 0 else ZERO

    async def _avg_weekly_expenses(self, weeks: int) -> Decimal:
        today = get_colombia_date()
        start = today - timedelta(weeks=weeks)
        stmt = select(func.coalesce(func.sum(Expense.amount), 0)).where(
            Expense.is_active == True,
            Expense.expense_date >= start,
            Expense.expense_date <= today,
        )
        r = await self.db.execute(stmt)
        total = Decimal(str(r.scalar()))
        return total / weeks if weeks > 0 else ZERO

    async def _pending_receivables(self) -> list[dict]:
        stmt = select(
            AccountsReceivable.due_date,
            (AccountsReceivable.amount - AccountsReceivable.amount_paid).label("balance")
        ).where(
            AccountsReceivable.is_paid == False,
            AccountsReceivable.due_date != None,
        )
        r = await self.db.execute(stmt)
        return [{"due_date": row.due_date, "balance": Decimal(str(row.balance))} for row in r]

    async def _pending_payables(self) -> list[dict]:
        stmt = select(
            AccountsPayable.due_date,
            (AccountsPayable.amount - AccountsPayable.amount_paid).label("balance")
        ).where(
            AccountsPayable.is_paid == False,
            AccountsPayable.due_date != None,
        )
        r = await self.db.execute(stmt)
        return [{"due_date": row.due_date, "balance": Decimal(str(row.balance))} for row in r]

    async def _scheduled_debt_payments(self, months: int) -> list[dict]:
        today = get_colombia_date()
        end = today + relativedelta(months=months)
        stmt = select(
            DebtPaymentSchedule.due_date,
            DebtPaymentSchedule.amount,
        ).where(
            DebtPaymentSchedule.status == DebtPaymentStatus.PENDING,
            DebtPaymentSchedule.due_date >= today,
            DebtPaymentSchedule.due_date <= end,
        )
        r = await self.db.execute(stmt)
        return [{"due_date": row.due_date, "amount": row.amount} for row in r]

    def _receivables_due_in_range(self, items: list[dict], start: date, end: date) -> Decimal:
        return sum(
            (i["balance"] for i in items if i["due_date"] and start <= i["due_date"] <= end),
            ZERO
        )

    def _payables_due_in_range(self, items: list[dict], start: date, end: date) -> Decimal:
        return sum(
            (i["balance"] for i in items if i["due_date"] and start <= i["due_date"] <= end),
            ZERO
        )

    def _debt_due_in_range(self, items: list[dict], start: date, end: date) -> Decimal:
        return sum(
            (i["amount"] for i in items if start <= i["due_date"] <= end),
            ZERO
        )
