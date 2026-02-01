"""
Notification Service

Handles creation, retrieval, and management of notifications.
Provides methods to create notifications triggered by business events.
"""
from uuid import UUID
from datetime import datetime
from decimal import Decimal
from sqlalchemy import select, func, update, or_, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.utils.timezone import get_colombia_now_naive
from app.models.notification import Notification, NotificationType, ReferenceType
from app.models.order import Order
from app.models.sale import Sale
from app.schemas.notification import NotificationCreate


class NotificationService:
    """Service for Notification operations"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, notification_data: NotificationCreate) -> Notification:
        """Create a new notification"""
        notification = Notification(
            user_id=notification_data.user_id,
            type=notification_data.type,
            title=notification_data.title,
            message=notification_data.message,
            reference_type=notification_data.reference_type,
            reference_id=notification_data.reference_id,
            school_id=notification_data.school_id
        )
        self.db.add(notification)
        await self.db.flush()
        await self.db.refresh(notification)
        return notification

    async def get_for_user(
        self,
        user_id: UUID,
        school_ids: list[UUID],
        is_superuser: bool = False,
        unread_only: bool = False,
        limit: int = 50,
        offset: int = 0
    ) -> tuple[list[Notification], int, int]:
        """
        Get notifications for a user.

        Notifications are visible if:
        - They are specifically for this user (user_id matches), OR
        - They are broadcast (user_id is None)
        AND:
        - They belong to a school the user has access to, OR
        - They are global (school_id is None)

        Returns:
            Tuple of (notifications, total_count, unread_count)
        """
        # Build base conditions for user access
        user_condition = or_(
            Notification.user_id == user_id,
            Notification.user_id.is_(None)
        )

        # Build school access conditions
        if is_superuser:
            # Superusers see all notifications
            school_condition = True
        elif school_ids:
            school_condition = or_(
                Notification.school_id.in_(school_ids),
                Notification.school_id.is_(None)
            )
        else:
            # No school access, only see global notifications
            school_condition = Notification.school_id.is_(None)

        # Combine conditions
        base_conditions = and_(user_condition, school_condition)

        # Count total matching notifications
        count_query = select(func.count(Notification.id)).where(base_conditions)
        total_result = await self.db.execute(count_query)
        total = total_result.scalar() or 0

        # Count unread notifications
        unread_query = select(func.count(Notification.id)).where(
            base_conditions,
            Notification.is_read == False
        )
        unread_result = await self.db.execute(unread_query)
        unread_count = unread_result.scalar() or 0

        # Build main query
        query = select(Notification).where(base_conditions)

        if unread_only:
            query = query.where(Notification.is_read == False)

        # Order by newest first, paginate
        query = query.order_by(Notification.created_at.desc())
        query = query.offset(offset).limit(limit)

        result = await self.db.execute(query)
        notifications = list(result.scalars().all())

        return notifications, total, unread_count

    async def get_unread_count(
        self,
        user_id: UUID,
        school_ids: list[UUID],
        is_superuser: bool = False
    ) -> tuple[int, datetime | None]:
        """
        Get unread count and last notification timestamp.

        Optimized for frequent polling - only counts, no full data fetch.
        """
        # Build access conditions
        user_condition = or_(
            Notification.user_id == user_id,
            Notification.user_id.is_(None)
        )

        if is_superuser:
            school_condition = True
        elif school_ids:
            school_condition = or_(
                Notification.school_id.in_(school_ids),
                Notification.school_id.is_(None)
            )
        else:
            school_condition = Notification.school_id.is_(None)

        base_conditions = and_(user_condition, school_condition)

        # Count unread
        count_query = select(func.count(Notification.id)).where(
            base_conditions,
            Notification.is_read == False
        )
        count_result = await self.db.execute(count_query)
        count = count_result.scalar() or 0

        # Get latest notification timestamp (for detecting new notifications)
        latest_query = select(func.max(Notification.created_at)).where(base_conditions)
        latest_result = await self.db.execute(latest_query)
        last_at = latest_result.scalar()

        return count, last_at

    async def mark_as_read(
        self,
        notification_ids: list[UUID] | None,
        user_id: UUID,
        school_ids: list[UUID],
        is_superuser: bool = False
    ) -> int:
        """
        Mark notifications as read.

        Only marks notifications the user has access to.

        Args:
            notification_ids: List of IDs to mark, or None to mark all unread
            user_id: User ID
            school_ids: School IDs user has access to
            is_superuser: Whether user is superuser

        Returns:
            Number of notifications marked as read
        """
        # Build access conditions
        user_condition = or_(
            Notification.user_id == user_id,
            Notification.user_id.is_(None)
        )

        if is_superuser:
            school_condition = True
        elif school_ids:
            school_condition = or_(
                Notification.school_id.in_(school_ids),
                Notification.school_id.is_(None)
            )
        else:
            school_condition = Notification.school_id.is_(None)

        # Build update conditions
        conditions = [
            user_condition,
            school_condition,
            Notification.is_read == False
        ]

        if notification_ids:
            conditions.append(Notification.id.in_(notification_ids))

        # Update
        stmt = (
            update(Notification)
            .where(*conditions)
            .values(is_read=True, read_at=get_colombia_now_naive())
        )

        result = await self.db.execute(stmt)
        await self.db.flush()

        return result.rowcount

    # ==========================================
    # Notification Triggers (Business Events)
    # ==========================================

    async def notify_new_web_order(self, order: Order) -> Notification:
        """Create notification for new web portal order"""
        # Format total with thousands separator
        total_formatted = f"${order.total:,.0f}" if order.total else "$0"

        notification_data = NotificationCreate(
            type=NotificationType.NEW_WEB_ORDER,
            title="Nuevo pedido web",
            message=f"Pedido {order.code} recibido desde el portal web. Total: {total_formatted}",
            reference_type=ReferenceType.ORDER,
            reference_id=order.id,
            school_id=order.school_id,
            user_id=None  # Broadcast to all users with school access
        )
        return await self.create(notification_data)

    async def notify_order_status_changed(
        self,
        order: Order,
        old_status: str,
        new_status: str
    ) -> Notification:
        """Create notification for order status change"""
        status_labels = {
            'pending': 'Pendiente',
            'in_production': 'En Produccion',
            'ready': 'Listo',
            'delivered': 'Entregado',
            'cancelled': 'Cancelado'
        }

        old_label = status_labels.get(old_status, old_status)
        new_label = status_labels.get(new_status, new_status)

        notification_data = NotificationCreate(
            type=NotificationType.ORDER_STATUS_CHANGED,
            title=f"Pedido {order.code} actualizado",
            message=f"Estado cambiado de {old_label} a {new_label}",
            reference_type=ReferenceType.ORDER,
            reference_id=order.id,
            school_id=order.school_id,
            user_id=None  # Broadcast
        )
        return await self.create(notification_data)

    async def notify_new_web_sale(self, sale: Sale) -> Notification:
        """Create notification for new web portal sale"""
        total_formatted = f"${sale.total:,.0f}" if sale.total else "$0"

        notification_data = NotificationCreate(
            type=NotificationType.NEW_WEB_SALE,
            title="Nueva venta web",
            message=f"Venta {sale.code} registrada desde el portal web. Total: {total_formatted}",
            reference_type=ReferenceType.SALE,
            reference_id=sale.id,
            school_id=sale.school_id,
            user_id=None  # Broadcast
        )
        return await self.create(notification_data)

    async def notify_pqrs_received(
        self,
        contact_id: UUID,
        subject: str,
        school_id: UUID | None
    ) -> Notification:
        """Create notification for new PQRS/contact message"""
        # Truncate subject if too long
        truncated_subject = subject[:100] if len(subject) > 100 else subject

        notification_data = NotificationCreate(
            type=NotificationType.PQRS_RECEIVED,
            title="Nuevo mensaje PQRS",
            message=f"Asunto: {truncated_subject}",
            reference_type=ReferenceType.CONTACT,
            reference_id=contact_id,
            school_id=school_id,
            user_id=None  # Broadcast
        )
        return await self.create(notification_data)

    async def notify_low_stock(
        self,
        product_id: UUID,
        product_code: str,
        product_name: str,
        current_quantity: int,
        min_stock_alert: int,
        school_id: UUID
    ) -> Notification:
        """Create notification for low stock alert"""
        notification_data = NotificationCreate(
            type=NotificationType.LOW_STOCK_ALERT,
            title=f"Stock bajo: {product_code}",
            message=f"{product_name} tiene {current_quantity} unidades (minimo: {min_stock_alert})",
            reference_type=ReferenceType.PRODUCT,
            reference_id=product_id,
            school_id=school_id,
            user_id=None  # Broadcast
        )
        return await self.create(notification_data)
