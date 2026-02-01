"""
Balance Account Service - Balance accounts and entries operations
"""
from uuid import UUID
from decimal import Decimal
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.accounting import AccountType, BalanceAccount, BalanceEntry
from app.schemas.accounting import (
    BalanceAccountCreate, BalanceAccountUpdate, BalanceEntryCreate
)
from app.services.base import SchoolIsolatedService


class BalanceAccountService(SchoolIsolatedService[BalanceAccount]):
    """Service for Balance Account operations"""

    def __init__(self, db: AsyncSession):
        super().__init__(BalanceAccount, db)

    async def create_account(
        self,
        data: BalanceAccountCreate,
        created_by: UUID | None = None
    ) -> BalanceAccount:
        """Create a new balance account"""
        account = BalanceAccount(
            school_id=data.school_id,
            account_type=data.account_type,
            name=data.name,
            description=data.description,
            code=data.code,
            balance=data.balance,
            original_value=data.original_value,
            accumulated_depreciation=data.accumulated_depreciation,
            useful_life_years=data.useful_life_years,
            interest_rate=data.interest_rate,
            due_date=data.due_date,
            creditor=data.creditor,
            created_by=created_by
        )
        self.db.add(account)
        await self.db.flush()
        await self.db.refresh(account)
        return account

    async def update_account(
        self,
        account_id: UUID,
        school_id: UUID,
        data: BalanceAccountUpdate
    ) -> BalanceAccount | None:
        """Update a balance account"""
        return await self.update(
            account_id,
            school_id,
            data.model_dump(exclude_unset=True)
        )

    async def get_accounts_by_type(
        self,
        school_id: UUID,
        account_type: AccountType
    ) -> list[BalanceAccount]:
        """Get all accounts of a specific type"""
        result = await self.db.execute(
            select(BalanceAccount).where(
                BalanceAccount.school_id == school_id,
                BalanceAccount.account_type == account_type,
                BalanceAccount.is_active == True
            ).order_by(BalanceAccount.name)
        )
        return list(result.scalars().all())

    async def get_all_active_accounts(
        self,
        school_id: UUID
    ) -> list[BalanceAccount]:
        """Get all active accounts grouped by type"""
        result = await self.db.execute(
            select(BalanceAccount).where(
                BalanceAccount.school_id == school_id,
                BalanceAccount.is_active == True
            ).order_by(BalanceAccount.account_type, BalanceAccount.name)
        )
        return list(result.scalars().all())


class BalanceEntryService(SchoolIsolatedService[BalanceEntry]):
    """Service for Balance Entry operations"""

    def __init__(self, db: AsyncSession):
        super().__init__(BalanceEntry, db)
        self.account_service = BalanceAccountService(db)

    async def create_entry(
        self,
        data: BalanceEntryCreate,
        created_by: UUID | None = None
    ) -> BalanceEntry:
        """Create a new balance entry and update account balance"""
        # Get account
        account = await self.account_service.get(data.account_id, data.school_id)
        if not account:
            raise ValueError("Cuenta no encontrada")

        # Calculate new balance
        new_balance = account.balance + data.amount

        # Create entry
        entry = BalanceEntry(
            account_id=data.account_id,
            school_id=data.school_id,
            entry_date=data.entry_date,
            amount=data.amount,
            balance_after=new_balance,
            description=data.description,
            reference=data.reference,
            created_by=created_by
        )
        self.db.add(entry)

        # Update account balance
        account.balance = new_balance

        await self.db.flush()
        await self.db.refresh(entry)
        return entry

    async def get_entries_for_account(
        self,
        account_id: UUID,
        school_id: UUID,
        limit: int = 50
    ) -> list[BalanceEntry]:
        """Get recent entries for an account"""
        result = await self.db.execute(
            select(BalanceEntry).where(
                BalanceEntry.account_id == account_id,
                BalanceEntry.school_id == school_id
            ).order_by(BalanceEntry.entry_date.desc(), BalanceEntry.created_at.desc())
            .limit(limit)
        )
        return list(result.scalars().all())
