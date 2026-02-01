"""
Order Utility Mixin

Contains utility methods for order operations:
- _generate_order_code
- _send_order_ready_notification
- _complete_pending_sale_changes
"""
import logging
from uuid import UUID
from datetime import datetime, date
from decimal import Decimal
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.order import Order, OrderItem, OrderStatus, OrderItemStatus
from app.models.client import Client
from app.utils.timezone import get_colombia_date

logger = logging.getLogger(__name__)


class OrderUtilityMixin:
    """Mixin providing utility methods for OrderService"""

    db: AsyncSession  # Type hint for IDE support

    async def _generate_order_code(self, school_id: UUID) -> str:
        """
        Generate unique order code: ENC-YYYY-NNNN

        Uses MAX() + 1 strategy with retry logic to handle race conditions.
        If duplicate is detected, retries with incremented sequence.
        """
        year = get_colombia_date().year
        prefix = f"ENC-{year}-"

        # Get highest existing sequence number for this year
        max_code_result = await self.db.execute(
            select(func.max(Order.code)).where(
                Order.school_id == school_id,
                Order.code.like(f"{prefix}%")
            )
        )
        max_code = max_code_result.scalar_one_or_none()

        if max_code:
            # Extract sequence number from code (e.g., "ENC-2025-0003" -> 3)
            try:
                sequence = int(max_code.split('-')[-1]) + 1
            except (ValueError, IndexError):
                sequence = 1
        else:
            sequence = 1

        # Try up to 10 times to find an unused code
        for attempt in range(10):
            code = f"{prefix}{sequence:04d}"

            # Check if this code already exists
            existing = await self.db.execute(
                select(func.count(Order.id)).where(
                    Order.school_id == school_id,
                    Order.code == code
                )
            )

            if existing.scalar_one() == 0:
                return code

            # Code exists, try next sequence number
            sequence += 1

        # Fallback: use timestamp-based suffix if all retries fail
        from time import time
        timestamp_suffix = int(time() * 1000) % 10000
        return f"{prefix}{timestamp_suffix:04d}"

    async def _send_order_ready_notification(self, order: Order) -> bool:
        """
        Send notification to client when their order is ready for pickup.
        Uses multi-channel notification (email + WhatsApp) based on client preferences.

        Args:
            order: Order object with client loaded

        Returns:
            True if any notification was sent, False otherwise
        """
        from app.services import notification_channels
        from app.models.school import School

        # Get client
        result = await self.db.execute(
            select(Client).where(Client.id == order.client_id)
        )
        client = result.scalar_one_or_none()

        if not client:
            logger.debug(f"No client found for order {order.code}, skipping ready notification")
            return False

        if not client.email and not client.phone:
            logger.debug(f"Client {client.name} has no contact info, skipping ready notification")
            return False

        # Get school name
        school_result = await self.db.execute(
            select(School).where(School.id == order.school_id)
        )
        school = school_result.scalar_one_or_none()
        school_name = school.name if school else ""

        try:
            # Use multi-channel orchestrator
            notification_result = await notification_channels.notify_order_ready(
                client=client,
                order=order,
                school_name=school_name
            )

            if notification_result.any_sent:
                channels = []
                if notification_result.email_sent:
                    channels.append("email")
                if notification_result.whatsapp_sent:
                    channels.append("whatsapp")
                logger.info(f"Ready notification sent via {', '.join(channels)} for order {order.code}")
            else:
                logger.warning(f"Failed to send ready notification for order {order.code}")

            return notification_result.any_sent
        except Exception as e:
            logger.error(f"Error sending ready notification: {e}")
            return False

    async def _send_order_status_update_notification(
        self,
        order: Order,
        changed_item_name: str = "",
        old_status_label: str = "",
        new_status_label: str = "",
    ) -> bool:
        """
        Send notification to client about an order item/status change.
        Includes a summary of all items and their current statuses.

        Args:
            order: Order object (will reload with items if needed)
            changed_item_name: Name of the item that changed (for trigger message)
            old_status_label: Human-readable old status
            new_status_label: Human-readable new status

        Returns:
            True if any notification was sent, False otherwise
        """
        from app.services import notification_channels
        from app.models.school import School

        STATUS_LABELS = {
            'pending': 'Pendiente',
            'in_production': 'En Produccion',
            'ready': 'Listo',
            'delivered': 'Entregado',
            'cancelled': 'Cancelado',
        }

        # Get order with items and client loaded
        order_with_items = await self.get_order_with_items(order.id, order.school_id)
        if not order_with_items:
            return False

        client = order_with_items.client
        if not client:
            logger.debug(f"No client found for order {order.code}, skipping status update notification")
            return False

        if not client.email and not client.phone:
            logger.debug(f"Client {client.name} has no contact info, skipping status update notification")
            return False

        # Get school name
        school_result = await self.db.execute(
            select(School).where(School.id == order.school_id)
        )
        school = school_result.scalar_one_or_none()
        school_name = school.name if school else ""

        # Build items summary
        items_summary = []
        active_items = []
        for item in order_with_items.items:
            # Get status as string safely (may be enum or str depending on DB driver)
            item_status_str = item.item_status.value if hasattr(item.item_status, 'value') else str(item.item_status)

            if item_status_str != OrderItemStatus.CANCELLED.value:
                active_items.append(item)

            garment_name = "Producto"
            if item.garment_type:
                garment_name = item.garment_type.name
            elif item.global_garment_type_id:
                garment_name = "Producto global"

            items_summary.append({
                "garment_name": garment_name,
                "size": item.size or "",
                "quantity": item.quantity,
                "status_label": STATUS_LABELS.get(item_status_str, item_status_str),
                "status_key": item_status_str,
            })

        # Build trigger message
        if changed_item_name:
            trigger_message = f"{changed_item_name} paso de {old_status_label} a {new_status_label}"
        else:
            trigger_message = f"Tu pedido paso a {new_status_label}"

        # Order status label (safely handle enum or str)
        order_status_val = order_with_items.status.value if hasattr(order_with_items.status, 'value') else str(order_with_items.status)
        order_status_label = STATUS_LABELS.get(order_status_val, order_status_val)

        # Progress summary for WhatsApp
        ready_or_delivered = sum(
            1 for i in active_items
            if (i.item_status.value if hasattr(i.item_status, 'value') else str(i.item_status)) in ("ready", "delivered")
        )
        progress_summary = f"{ready_or_delivered}/{len(active_items)} items listos"

        try:
            notification_result = await notification_channels.notify_order_status_update(
                client=client,
                order=order_with_items,
                school_name=school_name,
                items_summary=items_summary,
                trigger_message=trigger_message,
                order_status_label=order_status_label,
                progress_summary=progress_summary,
            )

            if notification_result.any_sent:
                channels = []
                if notification_result.email_sent:
                    channels.append("email")
                if notification_result.whatsapp_sent:
                    channels.append("whatsapp")
                logger.info(f"Status update notification sent via {', '.join(channels)} for order {order.code}")
            else:
                logger.warning(f"Failed to send status update notification for order {order.code}")

            return notification_result.any_sent
        except Exception as e:
            logger.error(f"Error sending status update notification: {e}")
            return False

    async def _complete_pending_sale_changes(self, order: Order) -> None:
        """
        Auto-complete sale changes that were waiting for this order.

        When an order is marked as DELIVERED, find any SaleChange records
        that reference this order (via order_id) and have status PENDING_STOCK,
        then automatically complete them.

        This provides seamless integration between the order fulfillment
        and sale change completion flows.
        """
        from app.models.sale import SaleChange, ChangeStatus
        from app.services.sale import SaleService

        # Find changes linked to this order with pending_stock status
        result = await self.db.execute(
            select(SaleChange).where(
                SaleChange.order_id == order.id,
                SaleChange.status == ChangeStatus.PENDING_STOCK
            )
        )
        changes = result.scalars().all()

        if not changes:
            return

        sale_service = SaleService(self.db)
        for change in changes:
            try:
                await sale_service.complete_change_from_order(
                    change_id=change.id,
                    school_id=order.school_id
                )
            except Exception as e:
                # Log error but don't fail the order delivery
                logger.error(f"Error completing sale change {change.id} from order {order.id}: {e}")
