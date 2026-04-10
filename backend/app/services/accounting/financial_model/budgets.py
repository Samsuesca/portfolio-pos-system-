"""
Module 4: Budget vs Actual Service
"""
from decimal import Decimal
from datetime import date
from fastapi import HTTPException, status
from sqlalchemy import select, func, delete
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID

from app.models.accounting import Expense, Transaction, TransactionType, ExpenseCategoryModel
from app.models.financial_model import Budget
from app.models.user import User
from app.utils.timezone import get_colombia_now_naive

ZERO = Decimal("0")
HUNDRED = Decimal("100")


class BudgetService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_budgets(
        self,
        period_type: str | None = None,
        period_start: date | None = None,
    ) -> list[dict]:
        stmt = select(Budget).order_by(Budget.period_start.desc(), Budget.category)
        if period_type:
            stmt = stmt.where(Budget.period_type == period_type)
        if period_start:
            stmt = stmt.where(Budget.period_start == period_start)
        result = await self.db.execute(stmt)
        budgets = result.scalars().all()
        return [self._budget_to_dict(b) for b in budgets]

    async def create_budget(self, data: dict, created_by: UUID | None = None) -> dict:
        budget = Budget(
            period_type=data["period_type"],
            period_start=data["period_start"],
            period_end=data["period_end"],
            category=data["category"],
            school_id=data.get("school_id"),
            budgeted_amount=data["budgeted_amount"],
            notes=data.get("notes"),
            created_by=created_by,
        )
        self.db.add(budget)
        await self.db.flush()
        await self.db.refresh(budget)
        return self._budget_to_dict(budget)

    async def delete_budget(self, budget_id: UUID, requesting_user: User | None = None) -> bool:
        stmt = select(Budget).where(Budget.id == budget_id)
        result = await self.db.execute(stmt)
        budget = result.scalar_one_or_none()
        if not budget:
            return False
        # Ownership check: only creator or superuser can delete
        if requesting_user and not requesting_user.is_superuser:
            if budget.created_by != requesting_user.id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Only the budget creator or a superuser can delete this budget"
                )
        await self.db.delete(budget)
        await self.db.flush()
        return True

    async def get_budget_vs_actual(
        self,
        period_type: str,
        period_start: date,
    ) -> dict:
        # Get budgets for this period
        stmt = select(Budget).where(
            Budget.period_type == period_type,
            Budget.period_start == period_start,
        )
        result = await self.db.execute(stmt)
        budgets = result.scalars().all()

        if not budgets:
            period_end = period_start
            return {
                "period_type": period_type,
                "period_start": period_start,
                "period_end": period_end,
                "items": [],
                "total_budgeted": ZERO,
                "total_actual": ZERO,
                "total_variance": ZERO,
            }

        period_end = budgets[0].period_end

        # Get category labels
        cat_stmt = select(ExpenseCategoryModel.code, ExpenseCategoryModel.name).where(
            ExpenseCategoryModel.is_active == True
        )
        cat_result = await self.db.execute(cat_stmt)
        cat_labels = {row[0]: row[1] for row in cat_result}

        items = []
        total_budgeted = ZERO
        total_actual = ZERO

        for budget in budgets:
            category = budget.category

            # Get actual for this category
            if category == "revenue":
                actual = await self._actual_revenue(period_start, period_end, budget.school_id)
            else:
                actual = await self._actual_expense(category, period_start, period_end, budget.school_id)

            variance = budget.budgeted_amount - actual
            variance_pct = ZERO
            if budget.budgeted_amount > ZERO:
                usage_pct = actual / budget.budgeted_amount * HUNDRED
                variance_pct = (variance / budget.budgeted_amount * HUNDRED)
            else:
                usage_pct = ZERO

            # Status
            if category == "revenue":
                # For revenue, exceeding budget is good; falling short is "under_target"
                if actual >= budget.budgeted_amount:
                    status = "within"
                elif usage_pct >= 80:
                    status = "near_limit"
                else:
                    status = "under_target"
            else:
                # For expenses, under is good
                if usage_pct <= 80:
                    status = "within"
                elif usage_pct <= HUNDRED:
                    status = "near_limit"
                else:
                    status = "over"

            label = cat_labels.get(category, category.replace("_", " ").title())
            if category == "revenue":
                label = "Ingresos"

            items.append({
                "category": category,
                "category_label": label,
                "budgeted": budget.budgeted_amount,
                "actual": actual,
                "variance": variance,
                "variance_percentage": variance_pct,
                "status": status,
            })

            total_budgeted += budget.budgeted_amount
            total_actual += actual

        return {
            "period_type": period_type,
            "period_start": period_start,
            "period_end": period_end,
            "items": items,
            "total_budgeted": total_budgeted,
            "total_actual": total_actual,
            "total_variance": total_budgeted - total_actual,
        }

    async def _actual_revenue(
        self, start: date, end: date, school_id: UUID | None
    ) -> Decimal:
        stmt = select(func.coalesce(func.sum(Transaction.amount), 0)).where(
            Transaction.type == TransactionType.INCOME,
            Transaction.transaction_date >= start,
            Transaction.transaction_date <= end,
        )
        if school_id:
            stmt = stmt.where(Transaction.school_id == school_id)
        r = await self.db.execute(stmt)
        return Decimal(str(r.scalar()))

    async def _actual_expense(
        self, category: str, start: date, end: date, school_id: UUID | None
    ) -> Decimal:
        stmt = select(func.coalesce(func.sum(Expense.amount), 0)).where(
            Expense.is_active == True,
            Expense.category == category,
            Expense.expense_date >= start,
            Expense.expense_date <= end,
        )
        if school_id:
            stmt = stmt.where(Expense.school_id == school_id)
        r = await self.db.execute(stmt)
        return Decimal(str(r.scalar()))

    def _budget_to_dict(self, b: Budget) -> dict:
        return {
            "id": b.id,
            "period_type": b.period_type,
            "period_start": b.period_start,
            "period_end": b.period_end,
            "category": b.category,
            "school_id": b.school_id,
            "budgeted_amount": b.budgeted_amount,
            "notes": b.notes,
            "created_by": b.created_by,
            "created_at": b.created_at,
            "updated_at": b.updated_at,
        }
