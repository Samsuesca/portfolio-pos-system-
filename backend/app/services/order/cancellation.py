"""
Order Cancellation Mixin

Contains cancellation methods:
- cancel_order
"""
import logging
from uuid import UUID
from datetime import datetime, date
from decimal import Decimal
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.utils.timezone import get_colombia_date, get_colombia_now_naive
from app.models.order import Order, OrderItem, OrderStatus, OrderItemStatus
from app.models.accounting import Transaction, TransactionType, AccountsReceivable

logger = logging.getLogger(__name__)


class OrderCancellationMixin:
    """Mixin providing cancellation methods for OrderService"""

    db: AsyncSession  # Type hint for IDE support

    async def cancel_order(
        self,
        order_id: UUID,
        school_id: UUID,
        user_id: UUID | None = None,
        reason: str | None = None
    ) -> Order:
        """
        Cancel an order with full rollback.

        This method:
        1. Validates the order can be cancelled (not delivered/already cancelled)
        2. Releases any stock that was reserved for this order
        3. Reverts advance payment transactions (creates EXPENSE transactions)
        4. Cancels any pending accounts receivable
        5. Marks all items and the order as CANCELLED

        Args:
            order_id: Order UUID
            school_id: School UUID
            user_id: User cancelling the order
            reason: Optional cancellation reason

        Returns:
            Updated order with CANCELLED status

        Raises:
            ValueError: If order cannot be cancelled
        """
        from app.services.inventory import InventoryService
        from app.services.global_product import GlobalInventoryService
        from app.services.balance_integration import BalanceIntegrationService
        from app.models.inventory_log import InventoryMovementType

        order = await self.get_order_with_items(order_id, school_id)
        if not order:
            raise ValueError("Orden no encontrada")

        if order.status == OrderStatus.CANCELLED:
            raise ValueError("La orden ya esta cancelada")

        if order.status == OrderStatus.DELIVERED:
            raise ValueError("No se puede cancelar una orden entregada")

        inventory_service = InventoryService(self.db)
        global_inv_service = GlobalInventoryService(self.db)
        balance_service = BalanceIntegrationService(self.db)

        # === PASO 1: LIBERAR STOCK RESERVADO ===
        for item in order.items:
            # Only release stock if it was reserved and item is not already delivered/cancelled
            if item.reserved_from_stock and item.quantity_reserved > 0:
                if item.item_status not in [OrderItemStatus.DELIVERED, OrderItemStatus.CANCELLED]:
                    try:
                        if item.global_product_id:
                            # Release global inventory
                            await global_inv_service.release_stock(
                                product_id=item.global_product_id,
                                quantity=item.quantity_reserved,
                                movement_type=InventoryMovementType.ORDER_CANCEL,
                                reference=order.code,
                                order_id=order.id,
                                school_id=school_id,
                                created_by=user_id,
                            )
                            logger.info(f"Released {item.quantity_reserved} units of global product {item.global_product_id} for cancelled order {order.code}")
                        elif item.product_id:
                            # Release school inventory
                            await inventory_service.release_stock(
                                product_id=item.product_id,
                                school_id=school_id,
                                quantity=item.quantity_reserved,
                                movement_type=InventoryMovementType.ORDER_CANCEL,
                                reference=order.code,
                                order_id=order.id,
                                created_by=user_id,
                            )
                            logger.info(f"Released {item.quantity_reserved} units of product {item.product_id} for cancelled order {order.code}")
                        # Update item to reflect stock was released
                        item.quantity_reserved = 0
                    except Exception as e:
                        # Log but continue - stock may have been manually adjusted
                        logger.warning(f"Could not release stock for item {item.id}: {e}")

            # Mark item as cancelled
            item.item_status = OrderItemStatus.CANCELLED
            item.status_updated_at = get_colombia_now_naive()

        # === PASO 2: REVERTIR TRANSACCIONES DE ANTICIPO ===
        # Obtener todas las transacciones de la orden
        txn_result = await self.db.execute(
            select(Transaction).where(
                Transaction.order_id == order_id,
                Transaction.type == TransactionType.INCOME
            )
        )
        transactions = txn_result.scalars().all()

        for txn in transactions:
            # Crear transaccion inversa (EXPENSE para devolver anticipo)
            reverse_transaction = Transaction(
                school_id=order.school_id,
                type=TransactionType.EXPENSE,
                amount=txn.amount,
                payment_method=txn.payment_method,
                description=f"Devolucion anticipo: Cancelacion encargo {order.code}" + (f" - {reason}" if reason else ""),
                category="order_cancellation",
                reference_code=f"CANC-{order.code}",
                transaction_date=get_colombia_date(),
                order_id=order.id,
                created_by=user_id
            )
            self.db.add(reverse_transaction)
            await self.db.flush()

            # Aplicar a balance (restar de la misma cuenta donde entró el dinero)
            try:
                await balance_service.apply_transaction_to_balance(reverse_transaction, user_id, force_income_map=True)
                logger.info(f"Created reverse transaction for order {order.code}: {txn.amount} via {txn.payment_method}")
            except Exception as e:
                logger.error(f"Error applying reverse transaction to balance: {e}")
                raise ValueError(f"Error al revertir transacción contable: {str(e)}")

        # === PASO 3: CANCELAR CUENTAS POR COBRAR ===
        rec_result = await self.db.execute(
            select(AccountsReceivable).where(
                AccountsReceivable.order_id == order_id,
                AccountsReceivable.is_paid == False
            )
        )
        receivables = rec_result.scalars().all()

        for receivable in receivables:
            receivable.is_paid = True
            receivable.amount_paid = receivable.amount  # Marcar como saldada
            cancellation_note = f"[Cancelada: Orden cancelada" + (f" - {reason}" if reason else "") + "]"
            receivable.notes = f"{receivable.notes or ''}\n{cancellation_note}".strip()
            logger.info(f"Cancelled receivable {receivable.id} for order {order.code}")

        # === PASO 4: ACTUALIZAR ESTADO DE LA ORDEN ===
        order.status = OrderStatus.CANCELLED
        if reason:
            existing_notes = order.notes or ""
            order.notes = f"{existing_notes}\n[Cancelado: {reason}]".strip()

        await self.db.flush()
        await self.db.refresh(order)

        logger.info(f"Order {order.code} cancelled successfully with full rollback")

        return order
