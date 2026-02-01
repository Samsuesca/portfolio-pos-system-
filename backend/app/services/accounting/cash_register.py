"""
Daily Cash Register Service - Daily cash reconciliation operations
"""
from uuid import UUID
from datetime import datetime, date
from decimal import Decimal
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.accounting import DailyCashRegister
from app.schemas.accounting import DailyCashRegisterCreate, DailyCashRegisterClose
from app.services.base import SchoolIsolatedService
from app.services.accounting.transactions import TransactionService
from app.utils.timezone import get_colombia_now_naive, get_colombia_date


class DailyCashRegisterService(SchoolIsolatedService[DailyCashRegister]):
    """Service for Daily Cash Register operations"""

    def __init__(self, db: AsyncSession):
        super().__init__(DailyCashRegister, db)
        self.transaction_service = TransactionService(db)

    async def open_register(
        self,
        data: DailyCashRegisterCreate
    ) -> DailyCashRegister:
        """Open a new daily cash register"""
        # Check if register already exists for this date
        existing = await self.db.execute(
            select(DailyCashRegister).where(
                DailyCashRegister.school_id == data.school_id,
                DailyCashRegister.register_date == data.register_date
            )
        )
        if existing.scalar_one_or_none():
            raise ValueError(f"Ya existe una caja para el {data.register_date}")

        register = DailyCashRegister(
            school_id=data.school_id,
            register_date=data.register_date,
            opening_balance=data.opening_balance
        )
        self.db.add(register)
        await self.db.flush()
        await self.db.refresh(register)
        return register

    async def close_register(
        self,
        register_id: UUID,
        school_id: UUID,
        data: DailyCashRegisterClose,
        closed_by: UUID
    ) -> DailyCashRegister | None:
        """Close a daily cash register"""
        register = await self.get(register_id, school_id)
        if not register:
            return None

        if register.is_closed:
            raise ValueError("La caja ya está cerrada")

        # Get daily totals from transactions
        daily_totals = await self.transaction_service.get_daily_totals(
            school_id,
            register.register_date
        )

        # Update register with calculated totals
        register.closing_balance = data.closing_balance
        register.total_income = daily_totals["income"]
        register.total_expenses = daily_totals["expenses"]
        register.cash_income = daily_totals["cash_income"]
        register.transfer_income = daily_totals["transfer_income"]
        register.card_income = daily_totals["card_income"]
        register.credit_sales = daily_totals["credit_sales"]
        register.is_closed = True
        register.closed_at = get_colombia_now_naive()
        register.closed_by = closed_by
        register.notes = data.notes

        await self.db.flush()
        await self.db.refresh(register)
        return register

    async def get_or_create_today(
        self,
        school_id: UUID,
        opening_balance: Decimal = Decimal("0")
    ) -> DailyCashRegister:
        """Get today's register or create one if it doesn't exist"""
        today = get_colombia_date()

        result = await self.db.execute(
            select(DailyCashRegister).where(
                DailyCashRegister.school_id == school_id,
                DailyCashRegister.register_date == today
            )
        )
        register = result.scalar_one_or_none()

        if not register:
            register = DailyCashRegister(
                school_id=school_id,
                register_date=today,
                opening_balance=opening_balance
            )
            self.db.add(register)
            await self.db.flush()
            await self.db.refresh(register)

        return register

    async def get_register_by_date(
        self,
        school_id: UUID,
        register_date: date
    ) -> DailyCashRegister | None:
        """Get register for a specific date"""
        result = await self.db.execute(
            select(DailyCashRegister).where(
                DailyCashRegister.school_id == school_id,
                DailyCashRegister.register_date == register_date
            )
        )
        return result.scalar_one_or_none()
