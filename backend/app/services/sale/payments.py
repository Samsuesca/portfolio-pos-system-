"""Retroactive payment addition for existing sales.

Handles the case where a sale was created without full payment records
(e.g., legacy data or manual corrections). Creates SalePayment entries
and optionally applies accounting (Transaction + balance update).

Accounting policy:
    Balance integration errors propagate — if the accounting system
    can't record the payment, the entire operation rolls back. This
    prevents financial inconsistencies between sale_payments and
    balance_accounts.
"""
import logging
from uuid import UUID
from decimal import Decimal
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.sale import Sale, SalePayment, PaymentMethod
from app.models.accounting import TransactionType, AccountsReceivable
from app.utils.payment_methods import to_acc_payment_method

logger = logging.getLogger(__name__)


class SalePaymentMixin:
    """Provides ``add_payment_to_sale`` to :class:`SaleService`."""

    db: AsyncSession

    async def add_payment_to_sale(
        self,
        sale_id: UUID,
        school_id: UUID,
        payment_data,
        user_id: UUID
    ) -> SalePayment:
        """Add a payment to an existing sale.

        Validates that the payment amount doesn't exceed the remaining
        balance. For cash payments, tracks amount_received and change_given.

        When ``payment_data.apply_accounting`` is True, also creates:
        - **CREDIT** payments → AccountsReceivable
        - **All other methods** → Transaction (INCOME) + balance update

        Args:
            sale_id: Target sale UUID.
            school_id: School UUID for tenant isolation.
            payment_data: Payment details including amount, method,
                optional ``apply_accounting`` flag, and cash-specific
                ``amount_received``.
            user_id: User adding the payment (recorded in accounting).

        Returns:
            The created SalePayment with updated sale.paid_amount.

        Raises:
            ValueError: Sale not found, amount exceeds remaining balance,
                cash received less than amount due, or balance integration
                fails (when apply_accounting=True).
        """
        result = await self.db.execute(
            select(Sale)
            .options(selectinload(Sale.payments))
            .where(
                Sale.id == sale_id,
                Sale.school_id == school_id
            )
        )
        sale = result.scalar_one_or_none()

        if not sale:
            raise ValueError("Venta no encontrada")

        existing_payments_total = sum(p.amount for p in sale.payments)
        remaining_balance = sale.total - existing_payments_total

        if payment_data.amount > remaining_balance:
            raise ValueError(
                f"El monto ({payment_data.amount}) excede el saldo pendiente ({remaining_balance})"
            )

        amount_received = None
        change_given = None

        if payment_data.payment_method == PaymentMethod.CASH:
            if payment_data.amount_received is not None:
                if payment_data.amount_received < payment_data.amount:
                    raise ValueError(
                        f"El monto recibido ({payment_data.amount_received}) "
                        f"debe ser mayor o igual al monto a pagar ({payment_data.amount})"
                    )
                amount_received = payment_data.amount_received
                change_given = payment_data.amount_received - payment_data.amount

        payment = SalePayment(
            sale_id=sale.id,
            amount=payment_data.amount,
            payment_method=payment_data.payment_method,
            notes=payment_data.notes,
            amount_received=amount_received,
            change_given=change_given
        )
        self.db.add(payment)
        await self.db.flush()

        if payment_data.apply_accounting and payment_data.amount > Decimal("0"):
            if payment_data.payment_method == PaymentMethod.CREDIT:
                receivable = AccountsReceivable(
                    school_id=sale.school_id,
                    client_id=sale.client_id,
                    sale_id=sale.id,
                    amount=payment_data.amount,
                    description=f"Pago agregado a venta {sale.code} (credito)",
                    invoice_date=sale.sale_date.date() if hasattr(sale.sale_date, 'date') else sale.sale_date,
                    due_date=None,
                    created_by=user_id
                )
                self.db.add(receivable)
                logger.info(f"Created AccountsReceivable for sale {sale.code}: {payment_data.amount}")
            else:
                from app.services.accounting.transactions import TransactionService
                txn_service = TransactionService(self.db)
                acc_method = to_acc_payment_method(payment_data.payment_method)
                transaction = await txn_service.record(
                    type=TransactionType.INCOME,
                    amount=payment_data.amount,
                    payment_method=acc_method,
                    description=f"Pago agregado a venta {sale.code}",
                    school_id=sale.school_id,
                    category="sales",
                    reference_code=sale.code,
                    transaction_date=sale.sale_date.date() if hasattr(sale.sale_date, 'date') else sale.sale_date,
                    sale_id=sale.id,
                    created_by=user_id,
                )
                payment.transaction_id = transaction.id
                logger.info(f"Applied balance for sale {sale.code}: {payment_data.amount} via {acc_method.value}")

        await self.db.flush()
        await self.db.refresh(payment)

        sale.paid_amount = existing_payments_total + payment_data.amount
        await self.db.flush()

        return payment
