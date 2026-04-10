"""
Transaction Service - Single entry point for all financial transaction recording.

Every money movement (sale, payment, expense, refund) goes through this service.
It creates the Transaction record and applies balance integration atomically.
"""
from uuid import UUID
from datetime import date
from decimal import Decimal
from sqlalchemy import select, func
from sqlalchemy.exc import IntegrityError
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

    async def record(
        self,
        *,
        type: TransactionType,
        amount: Decimal,
        payment_method: AccPaymentMethod,
        description: str,
        school_id: UUID | None = None,
        category: str | None = None,
        reference_code: str | None = None,
        transaction_date: date | None = None,
        sale_id: UUID | None = None,
        order_id: UUID | None = None,
        expense_id: UUID | None = None,
        alteration_id: UUID | None = None,
        created_by: UUID | None = None,
        skip_balance_update: bool = False,
        force_income_map: bool = False,
    ) -> Transaction:
        """Single entry point for recording any financial transaction with balance integration.

        Args:
            type: INCOME or EXPENSE.
            amount: Positive amount.
            payment_method: Determines which balance account is affected.
            description: Human-readable description.
            school_id: Optional school for per-school reports.
            category: Transaction category string (e.g. "sales", "orders", "payables").
            reference_code: Optional reference (sale code, order code, etc.).
            transaction_date: Defaults to today (Colombia timezone).
            sale_id: FK to sale, if applicable.
            order_id: FK to order, if applicable.
            expense_id: FK to expense, if applicable.
            alteration_id: FK to alteration, if applicable.
            created_by: User who initiated the operation.
            skip_balance_update: Skip balance integration (migrations/special cases).
            force_income_map: For sale reversals — subtract from the income account
                instead of the expense account.
        """
        transaction = Transaction(
            school_id=school_id,
            type=type,
            amount=amount,
            payment_method=payment_method,
            description=description,
            category=category,
            reference_code=reference_code,
            transaction_date=transaction_date or get_colombia_date(),
            sale_id=sale_id,
            order_id=order_id,
            expense_id=expense_id,
            created_by=created_by,
        )
        if alteration_id and hasattr(transaction, "alteration_id"):
            transaction.alteration_id = alteration_id

        self.db.add(transaction)
        await self.db.flush()

        if not skip_balance_update:
            from app.services.balance_integration import BalanceIntegrationService
            balance_service = BalanceIntegrationService(self.db)
            try:
                await balance_service.apply_transaction_to_balance(
                    transaction, created_by, force_income_map=force_income_map
                )
            except IntegrityError as e:
                await self.db.rollback()
                if "chk_balance_account_sign" in str(e.orig):
                    raise ValueError(
                        "Fondos insuficientes. La operacion dejaria un saldo negativo en la cuenta."
                    ) from None
                raise

        await self.db.refresh(transaction)
        return transaction

    # --- Legacy wrappers (existing callers use these) ---

    async def create_transaction(
        self,
        data: TransactionCreate,
        created_by: UUID | None = None,
        skip_balance_update: bool = False
    ) -> Transaction:
        return await self.record(
            type=data.type,
            amount=data.amount,
            payment_method=data.payment_method,
            description=data.description,
            school_id=data.school_id,
            category=data.category,
            reference_code=data.reference_code,
            transaction_date=data.transaction_date,
            sale_id=data.sale_id,
            order_id=data.order_id,
            expense_id=data.expense_id,
            created_by=created_by,
            skip_balance_update=skip_balance_update,
        )

    async def create_sale_transaction(
        self,
        sale: Sale,
        payment_method: AccPaymentMethod,
        created_by: UUID | None = None
    ) -> Transaction:
        return await self.record(
            type=TransactionType.INCOME,
            amount=sale.paid_amount,
            payment_method=payment_method,
            description=f"Venta {sale.code}",
            school_id=sale.school_id,
            category="sales",
            reference_code=sale.code,
            transaction_date=sale.sale_date.date(),
            sale_id=sale.id,
            created_by=created_by,
        )

    async def create_order_transaction(
        self,
        order: Order,
        amount: Decimal,
        payment_method: AccPaymentMethod,
        created_by: UUID | None = None
    ) -> Transaction:
        return await self.record(
            type=TransactionType.INCOME,
            amount=amount,
            payment_method=payment_method,
            description=f"Abono a encargo {order.code}",
            school_id=order.school_id,
            category="orders",
            reference_code=order.code,
            transaction_date=get_colombia_date(),
            order_id=order.id,
            created_by=created_by,
        )

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
