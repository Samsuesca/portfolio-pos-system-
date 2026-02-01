"""
Notification Model

Sistema de notificaciones para la aplicacion desktop.
Las notificaciones pueden ser:
- Dirigidas a un usuario especifico (user_id)
- Broadcast a todos los usuarios con acceso a un colegio (user_id=None)
"""
from datetime import datetime
from sqlalchemy import String, DateTime, Text, ForeignKey, Boolean, Enum as SQLEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
import uuid
import enum

from app.db.base import Base
from app.utils.timezone import get_colombia_now_naive


class NotificationType(str, enum.Enum):
    """Types of notifications"""
    NEW_WEB_ORDER = "new_web_order"           # Pedido desde web portal
    NEW_WEB_SALE = "new_web_sale"             # Venta desde web portal
    ORDER_STATUS_CHANGED = "order_status_changed"  # Cambio de estado de pedido
    PQRS_RECEIVED = "pqrs_received"           # Nuevo PQRS
    LOW_STOCK_ALERT = "low_stock_alert"       # Alerta de stock bajo


class ReferenceType(str, enum.Enum):
    """Type of entity the notification refers to"""
    ORDER = "order"
    SALE = "sale"
    CONTACT = "contact"
    PRODUCT = "product"


class Notification(Base):
    """Notification for desktop app users"""
    __tablename__ = "notifications"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )

    # Target user (who should see this notification)
    # None = broadcast to all users with access to the school
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=True,
        index=True
    )

    # Notification content
    type: Mapped[NotificationType] = mapped_column(
        SQLEnum(NotificationType, name="notification_type_enum",
                values_callable=lambda x: [e.value for e in x]),
        nullable=False,
        index=True
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)

    # Reference to related entity
    reference_type: Mapped[ReferenceType | None] = mapped_column(
        SQLEnum(ReferenceType, name="reference_type_enum",
                values_callable=lambda x: [e.value for e in x]),
        nullable=True
    )
    reference_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        nullable=True,
        index=True
    )

    # School context (for filtering by tenant)
    school_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("schools.id", ondelete="CASCADE"),
        nullable=True,
        index=True
    )

    # Read status
    is_read: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
        index=True
    )
    read_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    # Metadata
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=get_colombia_now_naive,
        nullable=False,
        index=True
    )

    # Relationships
    user: Mapped["User | None"] = relationship("User", lazy="selectin")
    school: Mapped["School | None"] = relationship("School", lazy="selectin")

    def __repr__(self) -> str:
        return f"<Notification(type='{self.type.value}', title='{self.title[:30]}...')>"
