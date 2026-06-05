"""
Order Status Mixin

Contains status management methods:
- update_status
- update_item_status
- _sync_order_status_from_items
- _sync_item_statuses_from_order
"""
import logging
from uuid import UUID
from datetime import datetime
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.utils.timezone import get_colombia_now_naive
from app.models.order import Order, OrderItem, OrderStatus, OrderItemStatus

logger = logging.getLogger(__name__)

STATUS_LABELS = {
    'pending': 'Pendiente',
    'in_production': 'En Produccion',
    'ready': 'Listo',
    'delivered': 'Entregado',
    'cancelled': 'Cancelado',
}


class OrderStatusMixin:
    """Mixin providing status management methods for OrderService"""

    db: AsyncSession  # Type hint for IDE support

    async def update_status(
        self,
        order_id: UUID,
        school_id: UUID,
        new_status: OrderStatus
    ) -> Order | None:
        """Update order status and sync item statuses"""
        # Get current status BEFORE update for notification
        current_order = await self.get(order_id, school_id)
        old_status = current_order.status.value if current_order else None

        update_payload: dict = {"status": new_status}
        # Stamp the actual delivery moment on first transition into DELIVERED
        # so reports compute lead time and on-time delivery against a stable
        # timestamp (not `updated_at`, which any later edit overwrites).
        if (
            new_status == OrderStatus.DELIVERED
            and current_order is not None
            and current_order.delivered_at is None
        ):
            from app.utils.timezone import get_colombia_now_naive
            update_payload["delivered_at"] = get_colombia_now_naive()

        order = await self.update(order_id, school_id, update_payload)

        # Sync item statuses when order is marked as DELIVERED
        if order and new_status == OrderStatus.DELIVERED:
            await self._sync_item_statuses_from_order(order_id, school_id, new_status)
            # Auto-complete any sale changes waiting for this order
            await self._complete_pending_sale_changes(order)

        # === IN-APP NOTIFICATION ===
        # Notify about status change (only if status actually changed)
        if order and old_status and old_status != new_status.value:
            from app.services.notification import NotificationService
            notification_service = NotificationService(self.db)
            await notification_service.notify_order_status_changed(order, old_status, new_status.value)

        # === CLIENT NOTIFICATION (Email + WhatsApp) ===
        new_status_str = new_status.value if hasattr(new_status, 'value') else str(new_status)
        if order and old_status and old_status != new_status_str:
            if new_status == OrderStatus.READY:
                # Use dedicated "order ready" email with pickup instructions
                await self._send_order_ready_notification(order)
            else:
                # Use generic status update notification for other transitions
                await self._send_order_status_update_notification(
                    order=order,
                    old_status_label=STATUS_LABELS.get(old_status, old_status),
                    new_status_label=STATUS_LABELS.get(new_status_str, new_status_str),
                )

        # === TELEGRAM ALERT ===
        if order and old_status and old_status != new_status.value:
            try:
                from app.services.telegram import fire_and_forget_routed_alert
                from app.services.telegram_messages import TelegramMessageBuilder
                from app.models.school import School

                school_result = await self.db.execute(
                    select(School).where(School.id == order.school_id)
                )
                school = school_result.scalar_one_or_none()
                school_name = school.name if school else "N/A"

                msg = TelegramMessageBuilder.order_status_changed(
                    code=order.code,
                    old_status=old_status,
                    new_status=new_status.value,
                    school_name=school_name,
                )
                fire_and_forget_routed_alert(
                    "order_status_changed", msg, school_id=order.school_id
                )
            except Exception as e:
                import logging
                logging.getLogger(__name__).error(f"Telegram alert failed for order status change: {e}")

        return order

    async def update_item_status(
        self,
        order_id: UUID,
        item_id: UUID,
        school_id: UUID,
        new_status: OrderItemStatus,
        user_id: UUID | None = None
    ) -> OrderItem | None:
        """
        Update status of an individual order item

        Args:
            order_id: Order UUID
            item_id: OrderItem UUID
            school_id: School UUID
            new_status: New status for the item
            user_id: User making the change

        Returns:
            Updated OrderItem or None if not found
        """
        # Get the item with garment type for notification
        result = await self.db.execute(
            select(OrderItem)
            .options(selectinload(OrderItem.garment_type))
            .where(
                OrderItem.id == item_id,
                OrderItem.order_id == order_id,
                OrderItem.school_id == school_id
            )
        )
        item = result.scalar_one_or_none()

        if not item:
            return None

        # Don't allow changes to finalized items
        if item.item_status in [OrderItemStatus.DELIVERED, OrderItemStatus.CANCELLED]:
            raise ValueError(f"No se puede cambiar estado de item {item.item_status.value}")

        # Capture old status before change
        old_item_status = item.item_status.value

        # Update item status
        item.item_status = new_status
        item.status_updated_at = get_colombia_now_naive()

        await self.db.flush()

        # Si el item paso a DELIVERED y tenia stock reservado, consumir
        # la reserva (decrementar quantity y reserved_quantity juntos).
        if new_status == OrderItemStatus.DELIVERED:
            await self._consume_item_reserved_stock(item, user_id)

        # Auto-sync order status based on items
        # Returns True if order status changed to READY (so we avoid duplicate notifications)
        order_synced_to_ready = await self._sync_order_status_from_items(order_id, school_id)

        # === CLIENT NOTIFICATION (Email + WhatsApp) ===
        # Send status update notification for item change
        # Skip if order synced to READY (the ready notification already covers it)
        if not order_synced_to_ready:
            garment_name = item.garment_type.name if item.garment_type else "Producto"
            size_text = f" talla {item.size}" if item.size else ""
            changed_item_name = f"{garment_name}{size_text}"

            # Get string value safely (new_status may be enum or str)
            new_status_str = new_status.value if hasattr(new_status, 'value') else str(new_status)

            # Get the order for notification
            order = await self.get(order_id, school_id)
            if order:
                await self._send_order_status_update_notification(
                    order=order,
                    changed_item_name=changed_item_name,
                    old_status_label=STATUS_LABELS.get(old_item_status, old_item_status),
                    new_status_label=STATUS_LABELS.get(new_status_str, new_status_str),
                )

        await self.db.refresh(item)
        return item

    async def _sync_order_status_from_items(
        self,
        order_id: UUID,
        school_id: UUID
    ) -> bool:
        """
        Synchronize Order status based on item statuses.

        Rules:
        - If ANY item is in_production -> Order = in_production
        - If ALL active items are ready or delivered -> Order = ready
        - If ALL active items are delivered -> Order = delivered
        - If ALL items are pending -> Order = pending

        Returns:
            True if order status changed to READY (triggers ready notification)
        """
        order = await self.get_order_with_items(order_id, school_id)
        if not order or order.status == OrderStatus.CANCELLED:
            return False

        old_status = order.status

        items = order.items
        active_items = [i for i in items if i.item_status != OrderItemStatus.CANCELLED]

        if not active_items:
            # All items cancelled - cancel the order
            order.status = OrderStatus.CANCELLED
            await self.db.flush()
            return False

        all_delivered = all(i.item_status == OrderItemStatus.DELIVERED for i in active_items)
        all_ready_or_delivered = all(
            i.item_status in [OrderItemStatus.READY, OrderItemStatus.DELIVERED]
            for i in active_items
        )
        any_in_production = any(i.item_status == OrderItemStatus.IN_PRODUCTION for i in active_items)

        if all_delivered:
            order.status = OrderStatus.DELIVERED
        elif all_ready_or_delivered:
            order.status = OrderStatus.READY
        elif any_in_production:
            order.status = OrderStatus.IN_PRODUCTION
        else:
            order.status = OrderStatus.PENDING

        await self.db.flush()

        # If order status changed via sync, trigger notifications
        synced_to_ready = False
        if old_status != order.status:
            # In-app notification for order status change
            from app.services.notification import NotificationService
            notification_service = NotificationService(self.db)
            await notification_service.notify_order_status_changed(
                order, old_status.value, order.status.value
            )

            # Client notification: if order synced to READY, send dedicated ready email
            if order.status == OrderStatus.READY:
                await self._send_order_ready_notification(order)
                synced_to_ready = True

        return synced_to_ready

    async def _sync_item_statuses_from_order(
        self,
        order_id: UUID,
        school_id: UUID,
        new_order_status: OrderStatus
    ) -> None:
        """
        Synchronize all item statuses when order status changes to DELIVERED.

        This provides reverse synchronization (order -> items), complementing
        the existing _sync_order_status_from_items() (items -> order).

        Rule: If order is marked as DELIVERED, all active items become DELIVERED.
        """
        if new_order_status != OrderStatus.DELIVERED:
            return  # Only sync when order becomes DELIVERED

        order = await self.get_order_with_items(order_id, school_id)
        if not order:
            return

        items_to_consume = []
        for item in order.items:
            # Only update items that are not already finalized
            if item.item_status not in [OrderItemStatus.DELIVERED, OrderItemStatus.CANCELLED]:
                item.item_status = OrderItemStatus.DELIVERED
                item.status_updated_at = get_colombia_now_naive()
                items_to_consume.append(item)

        await self.db.flush()

        for item in items_to_consume:
            await self._consume_item_reserved_stock(item, user_id=None)

    async def _consume_item_reserved_stock(
        self,
        item: OrderItem,
        user_id: UUID | None
    ) -> None:
        """Consume la reserva de un OrderItem que paso a DELIVERED.

        Idempotencia: opera solo si `item.reserved_from_stock=True` y
        `item.quantity_reserved > 0`. Despues del consumo marca
        `item.quantity_reserved=0` para evitar doble-consumo si por
        algun motivo este metodo se invocara de nuevo sobre el mismo item.

        Errores se loggean pero NO abortan el cambio de estado del item:
        el cliente fisicamente ya recibio la prenda. Si el inventario digital
        no refleja el consumo, queda como gap auditable en logs (a remediar
        manualmente con el endpoint de adjust).
        """
        if not item.reserved_from_stock or item.quantity_reserved <= 0:
            return

        from app.services.inventory import InventoryService
        from app.models.product import Product
        from app.models.inventory_log import InventoryMovementType
        from sqlalchemy import select

        product_result = await self.db.execute(
            select(Product).where(Product.id == item.product_id)
        )
        product = product_result.scalar_one_or_none()
        product_school_id = product.school_id if product else item.school_id

        inv_service = InventoryService(self.db)
        try:
            await inv_service.consume_reserved_stock(
                product_id=item.product_id,
                school_id=product_school_id,
                quantity=item.quantity_reserved,
                movement_type=InventoryMovementType.ORDER_DELIVER,
                reference=f"DEL-{item.order_id}",
                order_id=item.order_id,
                created_by=user_id,
            )
            item.quantity_reserved = 0
            await self.db.flush()
        except Exception as e:
            logger.error(
                f"Failed to consume reserved stock for item {item.id} "
                f"(product {item.product_id}, qty {item.quantity_reserved}): {e}"
            )
