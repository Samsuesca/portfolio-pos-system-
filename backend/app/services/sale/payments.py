"""
Sale Payment Mixin

Contains payment methods for sale operations:
- add_payment_to_sale
"""
import logging
from uuid import UUID
from decimal import Decimal
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.sale import Sale, SalePayment, PaymentMethod
from app.models.accounting import Transaction, TransactionType, AccPaymentMethod, AccountsReceivable

logger = logging.getLogger(__name__)


class SalePaymentMixin:
    """Mixin providing payment methods for SaleService"""

    db: AsyncSession  # Type hint for IDE support

    async def add_payment_to_sale(
        self,
        sale_id: UUID,
        school_id: UUID,
        payment_data,
        user_id: UUID
    ) -> SalePayment:
        """
        Add a payment to an existing sale (for fixing sales without payment records)

        Args:
            sale_id: Sale UUID
            school_id: School UUID
            payment_data: Payment data including amount, method, and accounting flag
            user_id: User adding the payment

        Returns:
            Created SalePayment

        Raises:
            ValueError: If sale not found or payment exceeds remaining balance
        """
        # Get sale with payments
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

        # Calculate existing payments total
        existing_payments_total = sum(p.amount for p in sale.payments)
        remaining_balance = sale.total - existing_payments_total

        # Validate payment amount doesn't exceed remaining
        if payment_data.amount > remaining_balance:
            raise ValueError(
                f"El monto ({payment_data.amount}) excede el saldo pendiente ({remaining_balance})"
            )

        # Calculate change for cash payments
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

        # Create SalePayment record
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

        # Apply accounting if requested
        if payment_data.apply_accounting and payment_data.amount > Decimal("0"):
            payment_method_map = {
                PaymentMethod.CASH: AccPaymentMethod.CASH,
                PaymentMethod.NEQUI: AccPaymentMethod.NEQUI,
                PaymentMethod.TRANSFER: AccPaymentMethod.TRANSFER,
                PaymentMethod.CARD: AccPaymentMethod.CARD,
                PaymentMethod.CREDIT: AccPaymentMethod.CREDIT,
            }

            acc_payment_method = payment_method_map.get(
                payment_data.payment_method,
                AccPaymentMethod.CASH
            )

            if payment_data.payment_method == PaymentMethod.CREDIT:
                # Credit payment -> Create AccountsReceivable
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
                # Effective payment -> Create Transaction + Update Balance
                transaction = Transaction(
                    school_id=sale.school_id,
                    type=TransactionType.INCOME,
                    amount=payment_data.amount,
                    payment_method=acc_payment_method,
                    description=f"Pago agregado a venta {sale.code}",
                    category="sales",
                    reference_code=sale.code,
                    transaction_date=sale.sale_date.date() if hasattr(sale.sale_date, 'date') else sale.sale_date,
                    sale_id=sale.id,
                    created_by=user_id
                )
                self.db.add(transaction)
                await self.db.flush()

                # Link transaction to payment
                payment.transaction_id = transaction.id

                # Apply balance integration
                try:
                    from app.services.balance_integration import BalanceIntegrationService
                    balance_service = BalanceIntegrationService(self.db)
                    await balance_service.apply_transaction_to_balance(transaction, user_id)
                    logger.info(f"Applied balance for sale {sale.code}: {payment_data.amount} via {acc_payment_method.value}")
                except Exception as e:
                    logger.error(f"Balance integration failed for payment on sale {sale.code}: {e}")
                    raise ValueError(f"Error al aplicar contabilidad: {str(e)}")

        await self.db.flush()
        await self.db.refresh(payment)

        # Update sale's paid_amount
        sale.paid_amount = existing_payments_total + payment_data.amount
        await self.db.flush()

        return payment
