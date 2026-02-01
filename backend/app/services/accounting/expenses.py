"""
Expense Service - Expense operations and payments
"""
from uuid import UUID
from datetime import date
from decimal import Decimal
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.utils.timezone import get_colombia_date
from app.models.accounting import (
    Transaction, TransactionType,
    Expense, ExpenseCategory
)
from app.schemas.accounting import (
    ExpenseCreate, ExpenseUpdate, ExpensePayment, ExpensesByCategory
)
from app.services.base import SchoolIsolatedService
from app.services.accounting.transactions import TransactionService


class ExpenseService(SchoolIsolatedService[Expense]):
    """Service for Expense operations"""

    def __init__(self, db: AsyncSession):
        super().__init__(Expense, db)
        self.transaction_service = TransactionService(db)

    async def create_expense(
        self,
        data: ExpenseCreate,
        created_by: UUID | None = None
    ) -> Expense:
        """Create a new expense"""
        expense = Expense(
            school_id=data.school_id,
            category=data.category,
            description=data.description,
            amount=data.amount,
            expense_date=data.expense_date,
            due_date=data.due_date,
            vendor=data.vendor,
            receipt_number=data.receipt_number,
            notes=data.notes,
            is_recurring=data.is_recurring,
            recurring_period=data.recurring_period,
            created_by=created_by
        )
        self.db.add(expense)
        await self.db.flush()
        await self.db.refresh(expense)
        return expense

    async def update_expense(
        self,
        expense_id: UUID,
        school_id: UUID,
        data: ExpenseUpdate
    ) -> Expense | None:
        """Update an expense"""
        return await self.update(
            expense_id,
            school_id,
            data.model_dump(exclude_unset=True)
        )

    async def pay_expense(
        self,
        expense_id: UUID,
        school_id: UUID,
        payment: ExpensePayment,
        created_by: UUID | None = None
    ) -> Expense | None:
        """Record a payment for an expense with balance integration"""
        expense = await self.get(expense_id, school_id)
        if not expense:
            return None

        # Calculate new paid amount
        new_paid = expense.amount_paid + payment.amount
        if new_paid > expense.amount:
            raise ValueError("El pago excede el monto pendiente")

        # Update expense
        expense.amount_paid = new_paid
        expense.is_paid = (new_paid >= expense.amount)

        await self.db.flush()

        # Create expense transaction
        # category can be string or enum, handle both cases
        cat_value = expense.category.value if hasattr(expense.category, 'value') else expense.category
        transaction = Transaction(
            school_id=school_id,
            type=TransactionType.EXPENSE,
            amount=payment.amount,
            payment_method=payment.payment_method,
            description=f"Pago: {expense.description}",
            category=cat_value,
            transaction_date=get_colombia_date(),
            expense_id=expense.id,
            created_by=created_by
        )
        self.db.add(transaction)
        await self.db.flush()

        # Apply balance integration (descuenta de Caja/Banco)
        from app.services.balance_integration import BalanceIntegrationService
        balance_service = BalanceIntegrationService(self.db)
        await balance_service.apply_transaction_to_balance(transaction, created_by)

        await self.db.refresh(expense)
        return expense

    async def get_pending_expenses(
        self,
        school_id: UUID
    ) -> list[Expense]:
        """Get all unpaid expenses"""
        result = await self.db.execute(
            select(Expense).where(
                Expense.school_id == school_id,
                Expense.is_paid == False,
                Expense.is_active == True
            ).order_by(Expense.due_date.asc().nullslast())
        )
        return list(result.scalars().all())

    async def get_expenses_by_category(
        self,
        school_id: UUID,
        start_date: date,
        end_date: date
    ) -> list[ExpensesByCategory]:
        """Get expenses grouped by category for a date range"""
        result = await self.db.execute(
            select(
                Expense.category,
                func.sum(Expense.amount).label('total'),
                func.count(Expense.id).label('count')
            ).where(
                Expense.school_id == school_id,
                Expense.expense_date >= start_date,
                Expense.expense_date <= end_date,
                Expense.is_active == True
            ).group_by(Expense.category)
        )

        total_sum = Decimal("0")
        categories = []
        for row in result:
            categories.append({
                "category": row.category,
                "total_amount": row.total,
                "count": row.count
            })
            total_sum += row.total

        # Calculate percentages
        return [
            ExpensesByCategory(
                category=c["category"],
                total_amount=c["total_amount"],
                count=c["count"],
                percentage=(c["total_amount"] / total_sum * 100) if total_sum > 0 else Decimal("0")
            )
            for c in categories
        ]
