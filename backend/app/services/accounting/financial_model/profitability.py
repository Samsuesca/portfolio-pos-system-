"""
Module 2: Profitability by School Service
"""
from decimal import Decimal
from datetime import date, timedelta
from dateutil.relativedelta import relativedelta
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID

from app.models.accounting import Transaction, TransactionType, Expense
from app.models.school import School
from app.models.sale import Sale, SaleItem
from app.models.product import Product
from app.utils.timezone import get_colombia_date

ZERO = Decimal("0")
HUNDRED = Decimal("100")


class ProfitabilityService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_profitability_by_school(
        self,
        start_date: date | None = None,
        end_date: date | None = None,
        school_ids: list[UUID] | None = None,
    ) -> dict:
        today = get_colombia_date()
        if not end_date:
            end_date = today
        if not start_date:
            start_date = today.replace(day=1) - relativedelta(months=5)

        # Get all schools
        stmt = select(School).where(School.is_active == True)
        if school_ids:
            stmt = stmt.where(School.id.in_(school_ids))
        result = await self.db.execute(stmt)
        schools = result.scalars().all()

        school_ids_list = [s.id for s in schools]
        school_map = {s.id: s for s in schools}

        # Batch query: revenue by school
        rev_stmt = (
            select(Transaction.school_id, func.coalesce(func.sum(Transaction.amount), 0))
            .where(
                Transaction.type == TransactionType.INCOME,
                Transaction.school_id.in_(school_ids_list),
                Transaction.transaction_date >= start_date,
                Transaction.transaction_date <= end_date,
            )
            .group_by(Transaction.school_id)
        )
        rev_result = await self.db.execute(rev_stmt)
        revenue_by_school: dict[UUID, Decimal] = {
            row[0]: Decimal(str(row[1])) for row in rev_result
        }

        # Batch query: COGS by school
        cogs_stmt = (
            select(
                Sale.school_id,
                func.coalesce(func.sum(SaleItem.quantity * func.coalesce(Product.cost, 0)), 0),
            )
            .join(Sale, SaleItem.sale_id == Sale.id)
            .join(Product, SaleItem.product_id == Product.id)
            .where(
                Sale.school_id.in_(school_ids_list),
                Sale.sale_date >= start_date,
                Sale.sale_date <= end_date,
            )
            .group_by(Sale.school_id)
        )
        cogs_result = await self.db.execute(cogs_stmt)
        cogs_by_school: dict[UUID, Decimal] = {
            row[0]: Decimal(str(row[1])) for row in cogs_result
        }

        # Batch query: direct expenses by school
        exp_stmt = (
            select(Expense.school_id, func.coalesce(func.sum(Expense.amount), 0))
            .where(
                Expense.is_active == True,
                Expense.school_id.in_(school_ids_list),
                Expense.expense_date >= start_date,
                Expense.expense_date <= end_date,
            )
            .group_by(Expense.school_id)
        )
        exp_result = await self.db.execute(exp_stmt)
        expenses_by_school: dict[UUID, Decimal] = {
            row[0]: Decimal(str(row[1])) for row in exp_result
        }

        # Batch query: monthly revenue trend by school (6 months)
        month_ranges: list[tuple[date, date, str, str]] = []
        for i in range(5, -1, -1):
            m_start = (today - relativedelta(months=i)).replace(day=1)
            if i == 0:
                m_end = today
            else:
                m_end = (m_start + relativedelta(months=1)) - timedelta(days=1)
            month_ranges.append((m_start, m_end, m_start.strftime("%Y-%m"), m_start.strftime("%b %Y")))

        overall_trend_start = month_ranges[0][0]
        overall_trend_end = month_ranges[-1][1]

        trend_stmt = (
            select(
                Transaction.school_id,
                func.date_trunc('month', Transaction.transaction_date).label('month'),
                func.coalesce(func.sum(Transaction.amount), 0),
            )
            .where(
                Transaction.type == TransactionType.INCOME,
                Transaction.school_id.in_(school_ids_list),
                Transaction.transaction_date >= overall_trend_start,
                Transaction.transaction_date <= overall_trend_end,
            )
            .group_by(Transaction.school_id, func.date_trunc('month', Transaction.transaction_date))
        )
        trend_result = await self.db.execute(trend_stmt)
        # Map: (school_id, "YYYY-MM") -> Decimal
        trend_map: dict[tuple[UUID, str], Decimal] = {}
        for row in trend_result:
            month_key = row[1].strftime("%Y-%m") if hasattr(row[1], 'strftime') else str(row[1])[:7]
            trend_map[(row[0], month_key)] = Decimal(str(row[2]))

        # Build school data
        total_revenue = ZERO
        school_data = []

        for school in schools:
            sid = school.id
            revenue = revenue_by_school.get(sid, ZERO)
            cogs = cogs_by_school.get(sid, ZERO)
            direct_expenses = expenses_by_school.get(sid, ZERO)

            contribution_margin = revenue - cogs - direct_expenses
            margin_pct = (contribution_margin / revenue * HUNDRED) if revenue > ZERO else ZERO

            total_revenue += revenue

            monthly_trend = []
            for m_start, m_end, month_str, label_str in month_ranges:
                monthly_trend.append({
                    "month": month_str,
                    "label": label_str,
                    "revenue": trend_map.get((sid, month_str), ZERO),
                })

            school_data.append({
                "school_id": sid,
                "school_name": school.name,
                "revenue": revenue,
                "cost_of_goods": cogs,
                "direct_expenses": direct_expenses,
                "contribution_margin": contribution_margin,
                "margin_percentage": margin_pct,
                "revenue_share": ZERO,  # Computed after total
                "monthly_trend": monthly_trend,
            })

        # Compute revenue share
        for s in school_data:
            if total_revenue > ZERO:
                s["revenue_share"] = s["revenue"] / total_revenue * HUNDRED

        # Sort by contribution margin desc
        school_data.sort(key=lambda x: x["contribution_margin"], reverse=True)

        return {
            "start_date": start_date,
            "end_date": end_date,
            "total_revenue": total_revenue,
            "schools": school_data,
        }
