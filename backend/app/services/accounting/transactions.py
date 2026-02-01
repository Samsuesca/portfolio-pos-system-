"""
Transaction Service - Income/Expense transaction operations
"""
from uuid import UUID
from datetime import date
from decimal import Decimal
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.utils.timezone import get_colombia_date
from app.models.accounting import (
    Transaction, TransactionType, AccPaymentMethod
)
from app.models.sale import Sale
from app.models.order import Order
from app.schemas.accounting import TransactionCreate
from app.services.base import SchoolIsolatedService


class TransactionService(SchoolIsolatedService[Transaction]):
    """Service for Transaction operations"""

    def __init__(self, db: AsyncSession):
        super().__init__(Transaction, db)

    async def create_transaction(
        self,
        data: TransactionCreate,
        created_by: UUID | None = None,
        skip_balance_update: bool = False
    ) -> Transaction:
        """
        Create a new transaction and update balance account.

        Args:
            data: Transaction data
            created_by: User ID
            skip_balance_update: Skip balance integration (for migrations/special cases)

        Returns:
            Created transaction
        """
        transaction = Transaction(
            school_id=data.school_id,
            type=data.type,
            amount=data.amount,
            payment_method=data.payment_method,
            description=data.description,
            category=data.category,
            reference_code=data.reference_code,
            transaction_date=data.transaction_date,
            sale_id=data.sale_id,
            order_id=data.order_id,
            expense_id=data.expense_id,
            created_by=created_by
        )
        self.db.add(transaction)
        await self.db.flush()

        # Apply balance integration (Caja/Banco)
        if not skip_balance_update:
            from app.services.balance_integration import BalanceIntegrationService
            balance_service = BalanceIntegrationService(self.db)
            await balance_service.apply_transaction_to_balance(transaction, created_by)

        await self.db.refresh(transaction)
        return transaction

    async def create_sale_transaction(
        self,
        sale: Sale,
        payment_method: AccPaymentMethod,
        created_by: UUID | None = None
    ) -> Transaction:
        """Create income transaction from a sale with balance integration"""
        transaction = Transaction(
            school_id=sale.school_id,
            type=TransactionType.INCOME,
            amount=sale.paid_amount,
            payment_method=payment_method,
            description=f"Venta {sale.code}",
            category="sales",
            reference_code=sale.code,
            transaction_date=sale.sale_date.date(),
            sale_id=sale.id,
            created_by=created_by
        )
        self.db.add(transaction)
        await self.db.flush()

        # Apply balance integration (Caja/Banco)
        from app.services.balance_integration import BalanceIntegrationService
        balance_service = BalanceIntegrationService(self.db)
        await balance_service.apply_transaction_to_balance(transaction, created_by)

        await self.db.refresh(transaction)
        return transaction

    async def create_order_transaction(
        self,
        order: Order,
        amount: Decimal,
        payment_method: AccPaymentMethod,
        created_by: UUID | None = None
    ) -> Transaction:
        """Create income transaction from an order payment with balance integration"""
        transaction = Transaction(
            school_id=order.school_id,
            type=TransactionType.INCOME,
            amount=amount,
            payment_method=payment_method,
            description=f"Abono a encargo {order.code}",
            category="orders",
            reference_code=order.code,
            transaction_date=get_colombia_date(),
            order_id=order.id,
            created_by=created_by
        )
        self.db.add(transaction)
        await self.db.flush()

        # Apply balance integration (Caja/Banco)
        from app.services.balance_integration import BalanceIntegrationService
        balance_service = BalanceIntegrationService(self.db)
        await balance_service.apply_transaction_to_balance(transaction, created_by)

        await self.db.refresh(transaction)
        return transaction

    async def get_transactions_by_date_range(
        self,
        school_id: UUID,
        start_date: date,
        end_date: date,
        transaction_type: TransactionType | None = None
    ) -> list[Transaction]:
        """Get transactions within a date range"""
        query = select(Transaction).where(
            Transaction.school_id == school_id,
            Transaction.transaction_date >= start_date,
            Transaction.transaction_date <= end_date
        )

        if transaction_type:
            query = query.where(Transaction.type == transaction_type)

        query = query.order_by(Transaction.transaction_date.desc())
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def get_daily_totals(
        self,
        school_id: UUID,
        target_date: date
    ) -> dict:
        """Get transaction totals for a specific day"""
        result = await self.db.execute(
            select(
                Transaction.type,
                Transaction.payment_method,
                func.sum(Transaction.amount).label('total')
            ).where(
                Transaction.school_id == school_id,
                Transaction.transaction_date == target_date
            ).group_by(Transaction.type, Transaction.payment_method)
        )

        totals = {
            "income": Decimal("0"),
            "expenses": Decimal("0"),
            "cash_income": Decimal("0"),
            "transfer_income": Decimal("0"),
            "card_income": Decimal("0"),
            "credit_sales": Decimal("0")
        }

        for row in result:
            if row.type == TransactionType.INCOME:
                totals["income"] += row.total
                if row.payment_method == AccPaymentMethod.CASH:
                    totals["cash_income"] += row.total
                elif row.payment_method == AccPaymentMethod.TRANSFER:
                    totals["transfer_income"] += row.total
                elif row.payment_method == AccPaymentMethod.CARD:
                    totals["card_income"] += row.total
                elif row.payment_method == AccPaymentMethod.CREDIT:
                    totals["credit_sales"] += row.total
            elif row.type == TransactionType.EXPENSE:
                totals["expenses"] += row.total

        return totals
