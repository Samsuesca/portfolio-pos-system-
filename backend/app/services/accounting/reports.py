"""
Accounting Service - Dashboard and reports
"""
from uuid import UUID
from datetime import date
from decimal import Decimal
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.utils.timezone import get_colombia_date
from app.models.accounting import Transaction, TransactionType
from app.schemas.accounting import (
    CashFlowSummary, DailyFinancialSummary, MonthlyFinancialReport,
    AccountingDashboard, TransactionListResponse
)
from app.services.accounting.transactions import TransactionService
from app.services.accounting.expenses import ExpenseService
from app.services.accounting.cash_register import DailyCashRegisterService


class AccountingService:
    """High-level accounting service for reports and dashboards"""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.transaction_service = TransactionService(db)
        self.expense_service = ExpenseService(db)
        self.register_service = DailyCashRegisterService(db)

    async def get_dashboard(self, school_id: UUID) -> AccountingDashboard:
        """Get accounting dashboard overview"""
        today = get_colombia_date()
        month_start = today.replace(day=1)

        # Today's numbers
        today_totals = await self.transaction_service.get_daily_totals(school_id, today)

        # Month's numbers
        month_income = await self.db.execute(
            select(func.coalesce(func.sum(Transaction.amount), 0)).where(
                Transaction.school_id == school_id,
                Transaction.type == TransactionType.INCOME,
                Transaction.transaction_date >= month_start,
                Transaction.transaction_date <= today
            )
        )
        month_income = Decimal(str(month_income.scalar_one()))

        month_expenses = await self.db.execute(
            select(func.coalesce(func.sum(Transaction.amount), 0)).where(
                Transaction.school_id == school_id,
                Transaction.type == TransactionType.EXPENSE,
                Transaction.transaction_date >= month_start,
                Transaction.transaction_date <= today
            )
        )
        month_expenses = Decimal(str(month_expenses.scalar_one()))

        # Pending expenses
        pending = await self.expense_service.get_pending_expenses(school_id)
        pending_amount = sum(e.balance for e in pending)

        # Recent transactions
        recent = await self.transaction_service.get_transactions_by_date_range(
            school_id,
            today.replace(day=1),
            today
        )

        return AccountingDashboard(
            today_income=today_totals["income"],
            today_expenses=today_totals["expenses"],
            today_net=today_totals["income"] - today_totals["expenses"],
            month_income=month_income,
            month_expenses=month_expenses,
            month_net=month_income - month_expenses,
            pending_expenses=len(pending),
            pending_expenses_amount=pending_amount,
            recent_transactions=[
                TransactionListResponse(
                    id=t.id,
                    type=t.type,
                    amount=t.amount,
                    payment_method=t.payment_method,
                    description=t.description,
                    category=t.category,
                    reference_code=t.reference_code,
                    transaction_date=t.transaction_date,
                    created_at=t.created_at
                )
                for t in recent[:10]
            ]
        )

    async def get_cash_flow_summary(
        self,
        school_id: UUID,
        start_date: date,
        end_date: date
    ) -> CashFlowSummary:
        """Get cash flow summary for a period"""
        # Get income by payment method
        income_result = await self.db.execute(
            select(
                Transaction.payment_method,
                func.sum(Transaction.amount).label('total')
            ).where(
                Transaction.school_id == school_id,
                Transaction.type == TransactionType.INCOME,
                Transaction.transaction_date >= start_date,
                Transaction.transaction_date <= end_date
            ).group_by(Transaction.payment_method)
        )

        income_by_method = {}
        total_income = Decimal("0")
        for row in income_result:
            income_by_method[row.payment_method.value] = row.total
            total_income += row.total

        # Get expenses by category
        expenses_result = await self.db.execute(
            select(
                Transaction.category,
                func.sum(Transaction.amount).label('total')
            ).where(
                Transaction.school_id == school_id,
                Transaction.type == TransactionType.EXPENSE,
                Transaction.transaction_date >= start_date,
                Transaction.transaction_date <= end_date
            ).group_by(Transaction.category)
        )

        expenses_by_category = {}
        total_expenses = Decimal("0")
        for row in expenses_result:
            if row.category:
                expenses_by_category[row.category] = row.total
                total_expenses += row.total

        return CashFlowSummary(
            period_start=start_date,
            period_end=end_date,
            total_income=total_income,
            total_expenses=total_expenses,
            net_flow=total_income - total_expenses,
            income_by_method=income_by_method,
            expenses_by_category=expenses_by_category
        )

    async def get_monthly_report(
        self,
        school_id: UUID,
        year: int,
        month: int
    ) -> MonthlyFinancialReport:
        """Get monthly financial report"""
        from calendar import monthrange

        _, last_day = monthrange(year, month)
        start_date = date(year, month, 1)
        end_date = date(year, month, last_day)

        cash_flow = await self.get_cash_flow_summary(school_id, start_date, end_date)

        # Get daily summaries
        daily_result = await self.db.execute(
            select(
                Transaction.transaction_date,
                Transaction.type,
                func.sum(Transaction.amount).label('total'),
                func.count(Transaction.id).label('count')
            ).where(
                Transaction.school_id == school_id,
                Transaction.transaction_date >= start_date,
                Transaction.transaction_date <= end_date
            ).group_by(Transaction.transaction_date, Transaction.type)
            .order_by(Transaction.transaction_date)
        )

        daily_data = {}
        for row in daily_result:
            dt = row.transaction_date
            if dt not in daily_data:
                daily_data[dt] = {
                    "date": dt,
                    "sales_count": 0,
                    "sales_total": Decimal("0"),
                    "orders_count": 0,
                    "orders_total": Decimal("0"),
                    "expenses_count": 0,
                    "expenses_total": Decimal("0")
                }

            if row.type == TransactionType.INCOME:
                daily_data[dt]["sales_count"] += row.count
                daily_data[dt]["sales_total"] += row.total
            elif row.type == TransactionType.EXPENSE:
                daily_data[dt]["expenses_count"] += row.count
                daily_data[dt]["expenses_total"] += row.total

        daily_summaries = [
            DailyFinancialSummary(
                **d,
                net_income=d["sales_total"] + d["orders_total"] - d["expenses_total"]
            )
            for d in daily_data.values()
        ]

        return MonthlyFinancialReport(
            year=year,
            month=month,
            total_income=cash_flow.total_income,
            total_expenses=cash_flow.total_expenses,
            net_profit=cash_flow.net_flow,
            income_breakdown=cash_flow.income_by_method,
            expense_breakdown=cash_flow.expenses_by_category,
            daily_summaries=daily_summaries
        )
