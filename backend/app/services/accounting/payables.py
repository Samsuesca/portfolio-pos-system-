"""
Accounts Payable Service - Accounts payable operations
"""
from uuid import UUID
from datetime import date
from decimal import Decimal
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.utils.timezone import get_colombia_date
from app.models.accounting import (
    TransactionType, AccountsPayable
)
from app.schemas.accounting import (
    AccountsPayableCreate, AccountsPayableUpdate, AccountsPayablePayment
)
from app.services.base import SchoolIsolatedService
from app.services.accounting.transactions import TransactionService


class AccountsPayableService(SchoolIsolatedService[AccountsPayable]):
    """Service for Accounts Payable operations"""

    def __init__(self, db: AsyncSession):
        super().__init__(AccountsPayable, db)
        self.transaction_service = TransactionService(db)

    async def create_payable(
        self,
        data: AccountsPayableCreate,
        created_by: UUID | None = None
    ) -> AccountsPayable:
        """Create a new accounts payable"""
        payable = AccountsPayable(
            school_id=data.school_id,
            vendor=data.vendor,
            amount=data.amount,
            description=data.description,
            category=data.category,
            invoice_number=data.invoice_number,
            invoice_date=data.invoice_date,
            due_date=data.due_date,
            notes=data.notes,
            created_by=created_by
        )
        self.db.add(payable)
        await self.db.flush()
        await self.db.refresh(payable)
        return payable

    async def record_payment(
        self,
        payable_id: UUID,
        school_id: UUID,
        payment: AccountsPayablePayment,
        created_by: UUID | None = None
    ) -> AccountsPayable | None:
        """Record a payment on accounts payable with balance integration"""
        payable = await self.get(payable_id, school_id)
        if not payable:
            return None

        # Calculate new paid amount
        new_paid = payable.amount_paid + payment.amount
        if new_paid > payable.amount:
            raise ValueError("El pago excede el monto pendiente")

        # Update payable
        payable.amount_paid = new_paid
        payable.is_paid = (new_paid >= payable.amount)

        await self.transaction_service.record(
            type=TransactionType.EXPENSE,
            amount=payment.amount,
            payment_method=payment.payment_method,
            description=f"Pago a {payable.vendor}: {payable.description[:50]}",
            school_id=school_id,
            category="payables",
            transaction_date=get_colombia_date(),
            created_by=created_by,
        )

        await self.db.refresh(payable)
        return payable

    async def get_pending_payables(
        self,
        school_id: UUID
    ) -> list[AccountsPayable]:
        """Get all unpaid payables"""
        result = await self.db.execute(
            select(AccountsPayable).where(
                AccountsPayable.school_id == school_id,
                AccountsPayable.is_paid == False
            ).order_by(AccountsPayable.due_date.asc().nullslast())
        )
        return list(result.scalars().all())

    async def update_overdue_status(self, school_id: UUID) -> int:
        """Update is_overdue flag for all payables"""
        today = get_colombia_date()
        result = await self.db.execute(
            select(AccountsPayable).where(
                AccountsPayable.school_id == school_id,
                AccountsPayable.is_paid == False,
                AccountsPayable.due_date != None,
                AccountsPayable.due_date < today
            )
        )
        count = 0
        for payable in result.scalars().all():
            if not payable.is_overdue:
                payable.is_overdue = True
                count += 1
        await self.db.flush()
        return count
