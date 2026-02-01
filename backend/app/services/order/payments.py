"""
Order Payment Mixin

Contains payment methods:
- add_payment
"""
from uuid import UUID
from datetime import date
from decimal import Decimal
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.utils.timezone import get_colombia_date
from app.models.order import Order
from app.models.accounting import Transaction, TransactionType, AccPaymentMethod, AccountsReceivable
from app.schemas.order import OrderPayment


class OrderPaymentMixin:
    """Mixin providing payment methods for OrderService"""

    db: AsyncSession  # Type hint for IDE support

    async def add_payment(
        self,
        order_id: UUID,
        school_id: UUID,
        payment_data: OrderPayment,
        user_id: UUID | None = None
    ) -> Order | None:
        """
        Add payment (abono) to order

        Args:
            order_id: Order UUID
            school_id: School UUID
            payment_data: Payment information
            user_id: User making the payment

        Returns:
            Updated order
        """
        order = await self.get(order_id, school_id)
        if not order:
            return None

        new_paid_amount = order.paid_amount + payment_data.amount

        if new_paid_amount > order.total:
            raise ValueError("El abono excede el total del encargo")

        # Update order paid amount
        order.paid_amount = new_paid_amount

        # Get payment method (default to CASH if not provided)
        # Convert string to enum if needed
        raw_method = getattr(payment_data, 'payment_method', None) or 'cash'
        try:
            payment_method = AccPaymentMethod(raw_method) if isinstance(raw_method, str) else raw_method
        except ValueError:
            payment_method = AccPaymentMethod.CASH

        # Calculate cash change (vueltas) for cash payments
        if payment_method == AccPaymentMethod.CASH:
            amt_received = getattr(payment_data, 'amount_received', None)
            if amt_received is not None:
                if amt_received < payment_data.amount:
                    raise ValueError(
                        f"El monto recibido ({amt_received}) "
                        f"debe ser mayor o igual al abono ({payment_data.amount})"
                    )
                order.amount_received = amt_received
                order.change_given = amt_received - payment_data.amount

        await self.db.flush()

        # === CONTABILIDAD ===
        # Crear transaccion de ingreso por el abono
        transaction = Transaction(
            school_id=school_id,
            type=TransactionType.INCOME,
            amount=payment_data.amount,
            payment_method=payment_method,
            description=f"Abono encargo {order.code}",
            category="orders",
            reference_code=order.code,
            transaction_date=get_colombia_date(),
            order_id=order.id,
            created_by=user_id
        )
        self.db.add(transaction)
        await self.db.flush()

        # Apply balance integration (agrega a Caja/Banco)
        from app.services.balance_integration import BalanceIntegrationService
        balance_service = BalanceIntegrationService(self.db)
        await balance_service.apply_transaction_to_balance(transaction, user_id)

        # Actualizar cuenta por cobrar si existe
        result = await self.db.execute(
            select(AccountsReceivable).where(
                AccountsReceivable.order_id == order_id,
                AccountsReceivable.school_id == school_id,
                AccountsReceivable.is_paid == False
            )
        )
        receivable = result.scalar_one_or_none()

        if receivable:
            receivable.amount_paid = receivable.amount_paid + payment_data.amount
            # Marcar como pagada si el monto pagado >= monto total
            if receivable.amount_paid >= receivable.amount:
                receivable.is_paid = True

        await self.db.flush()
        await self.db.refresh(order)

        return order
