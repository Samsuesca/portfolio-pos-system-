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
from app.models.product import Product
from app.models.accounting import Transaction, TransactionType, AccountsReceivable

logger = logging.getLogger(__name__)


class OrderCancellationMixin:
    """Mixin providing cancellation methods for OrderService"""

    db: AsyncSession

    async def cancel_order(
        self,
        order_id: UUID,
        school_id: UUID,
        user_id: UUID | None = None,
        reason: str | None = None
    ) -> Order:
        from app.services.inventory import InventoryService
        from app.services.accounting.transactions import TransactionService
        from app.models.inventory_log import InventoryMovementType

        order = await self.get_order_with_items(order_id, school_id)
        if not order:
            raise ValueError("Orden no encontrada")

        if order.status == OrderStatus.CANCELLED:
            raise ValueError("La orden ya esta cancelada")

        if order.status == OrderStatus.DELIVERED:
            raise ValueError("No se puede cancelar una orden entregada")

        inventory_service = InventoryService(self.db)
        txn_service = TransactionService(self.db)

        # === PASO 1: LIBERAR STOCK RESERVADO ===
        for item in order.items:
            if item.reserved_from_stock and item.quantity_reserved > 0:
                if item.item_status not in [OrderItemStatus.DELIVERED, OrderItemStatus.CANCELLED]:
                    reserved_qty = item.quantity_reserved
                    try:
                        product_result = await self.db.execute(
                            select(Product).where(Product.id == item.product_id)
                        )
                        product = product_result.scalar_one_or_none()
                        product_school_id = product.school_id if product else school_id

                        await inventory_service.release_stock(
                            product_id=item.product_id,
                            school_id=product_school_id,
                            quantity=reserved_qty,
                            movement_type=InventoryMovementType.ORDER_CANCEL,
                            reference=order.code,
                            order_id=order.id,
                            created_by=user_id,
                        )
                        logger.info(f"Released {reserved_qty} units of product {item.product_id} for cancelled order {order.code}")
                    except Exception as e:
                        logger.warning(f"Could not release stock for item {item.id}: {e}")
                    finally:
                        # WS4 (invariante I3): item cancelado nunca conserva reserva.
                        item.quantity_reserved = 0
                        item.reserved_from_stock = False

            item.item_status = OrderItemStatus.CANCELLED
            item.status_updated_at = get_colombia_now_naive()

        # === PASO 2: REVERTIR TRANSACCIONES DE ANTICIPO ===
        txn_result = await self.db.execute(
            select(Transaction).where(
                Transaction.order_id == order_id,
                Transaction.type == TransactionType.INCOME
            )
        )
        transactions = txn_result.scalars().all()

        for txn in transactions:
            desc = f"Devolucion anticipo: Cancelacion encargo {order.code}" + (f" - {reason}" if reason else "")
            await txn_service.record(
                type=TransactionType.EXPENSE,
                amount=txn.amount,
                payment_method=txn.payment_method,
                description=desc,
                school_id=order.school_id,
                category="order_cancellation",
                reference_code=f"CANC-{order.code}",
                transaction_date=get_colombia_date(),
                order_id=order.id,
                created_by=user_id,
                force_income_map=True,
            )
            logger.info(f"Created reverse transaction for order {order.code}: {txn.amount} via {txn.payment_method}")

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
            receivable.amount_paid = receivable.amount
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
