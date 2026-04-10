"""
Accounts Receivable Service - Accounts receivable operations
"""
from uuid import UUID
from datetime import date
from decimal import Decimal
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.utils.timezone import get_colombia_date
from app.models.accounting import (
    TransactionType, AccountsReceivable
)
from app.schemas.accounting import (
    AccountsReceivableCreate, AccountsReceivableUpdate, AccountsReceivablePayment
)
from app.services.base import SchoolIsolatedService
from app.services.accounting.transactions import TransactionService


class AccountsReceivableService(SchoolIsolatedService[AccountsReceivable]):
    """Service for Accounts Receivable operations"""

    def __init__(self, db: AsyncSession):
        super().__init__(AccountsReceivable, db)
        self.transaction_service = TransactionService(db)

    async def create_receivable(
        self,
        data: AccountsReceivableCreate,
        created_by: UUID | None = None
    ) -> AccountsReceivable:
        """Create a new accounts receivable"""
        receivable = AccountsReceivable(
            school_id=data.school_id,
            client_id=data.client_id,
            sale_id=data.sale_id,
            order_id=data.order_id,
            amount=data.amount,
            description=data.description,
            invoice_date=data.invoice_date,
            due_date=data.due_date,
            notes=data.notes,
            created_by=created_by
        )
        self.db.add(receivable)
        await self.db.flush()
        await self.db.refresh(receivable)
        return receivable

    async def get_by_order(
        self,
        order_id: UUID,
        school_id: UUID
    ) -> AccountsReceivable | None:
        """Get accounts receivable by order_id"""
        result = await self.db.execute(
            select(AccountsReceivable).where(
                AccountsReceivable.order_id == order_id,
                AccountsReceivable.school_id == school_id
            )
        )
        return result.scalar_one_or_none()

    async def record_payment(
        self,
        receivable_id: UUID,
        school_id: UUID,
        payment: AccountsReceivablePayment,
        created_by: UUID | None = None
    ) -> AccountsReceivable | None:
        """Record a payment on accounts receivable with balance integration"""
        receivable = await self.get(receivable_id, school_id)
        if not receivable:
            return None

        # Calculate new paid amount
        new_paid = receivable.amount_paid + payment.amount
        if new_paid > receivable.amount:
            raise ValueError("El pago excede el monto pendiente")

        # Update receivable
        receivable.amount_paid = new_paid
        receivable.is_paid = (new_paid >= receivable.amount)

        await self.transaction_service.record(
            type=TransactionType.INCOME,
            amount=payment.amount,
            payment_method=payment.payment_method,
            description=f"Cobro cuenta por cobrar: {receivable.description[:50]}",
            school_id=school_id,
            category="receivables",
            transaction_date=get_colombia_date(),
            created_by=created_by,
        )

        await self.db.refresh(receivable)
        return receivable

    async def get_multi_with_details(
        self,
        school_id: UUID | None = None,
        skip: int = 0,
        limit: int = 100,
        filters: dict | None = None
    ) -> list[AccountsReceivable]:
        """Get multiple receivables with eager loading of client, sale, order, and school relationships"""
        query = select(AccountsReceivable).options(
            selectinload(AccountsReceivable.client),
            selectinload(AccountsReceivable.sale),
            selectinload(AccountsReceivable.order),
            selectinload(AccountsReceivable.school)
        )

        if school_id is not None:
            query = query.where(AccountsReceivable.school_id == school_id)

        if filters:
            for field, value in filters.items():
                if hasattr(AccountsReceivable, field):
                    query = query.where(getattr(AccountsReceivable, field) == value)

        query = query.offset(skip).limit(limit).order_by(AccountsReceivable.invoice_date.desc())
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def get_multi_with_client(
        self,
        school_id: UUID,
        skip: int = 0,
        limit: int = 100,
        filters: dict | None = None
    ) -> list[AccountsReceivable]:
        """Get multiple receivables with eager loading of client relationship (legacy)"""
        return await self.get_multi_with_details(school_id, skip, limit, filters)

    async def get_pending_receivables(
        self,
        school_id: UUID | None = None
    ) -> list[AccountsReceivable]:
        """Get all unpaid receivables with full details eager loading"""
        query = select(AccountsReceivable).options(
            selectinload(AccountsReceivable.client),
            selectinload(AccountsReceivable.sale),
            selectinload(AccountsReceivable.order),
            selectinload(AccountsReceivable.school)
        ).where(AccountsReceivable.is_paid == False)

        if school_id is not None:
            query = query.where(AccountsReceivable.school_id == school_id)

        query = query.order_by(AccountsReceivable.due_date.asc().nullslast())
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def update_overdue_status(self, school_id: UUID) -> int:
        """Update is_overdue flag for all receivables"""
        today = get_colombia_date()
        result = await self.db.execute(
            select(AccountsReceivable).where(
                AccountsReceivable.school_id == school_id,
                AccountsReceivable.is_paid == False,
                AccountsReceivable.due_date != None,
                AccountsReceivable.due_date < today
            )
        )
        count = 0
        for receivable in result.scalars().all():
            if not receivable.is_overdue:
                receivable.is_overdue = True
                count += 1
        await self.db.flush()
        return count
