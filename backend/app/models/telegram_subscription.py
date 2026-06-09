"""
Telegram Alert Subscription Models

Defines alert types and per-user subscription preferences
for routing Telegram notifications.
"""
import enum
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Enum as SQLEnum, UniqueConstraint, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.utils.timezone import get_colombia_now_naive


class TelegramAlertType(str, enum.Enum):
    """Types of Telegram alerts that users can subscribe to."""

    # Reactive events (triggered by business actions)
    sale_created = "sale_created"
    order_created = "order_created"  # Encargo creado en mostrador (no portal web)
    web_order_created = "web_order_created"
    order_status_changed = "order_status_changed"
    low_stock = "low_stock"
    expense_created = "expense_created"
    expense_paid = "expense_paid"
    wompi_payment = "wompi_payment"
    pqrs_received = "pqrs_received"
    attendance_alert = "attendance_alert"
    cash_drawer_access = "cash_drawer_access"

    # Arreglos / alterations (modulo global, sin colegio)
    alteration_received = "alteration_received"
    alteration_delivered = "alteration_delivered"
    alteration_payment = "alteration_payment"

    # Proactive reminders (triggered by scheduler)
    reminder_close_cash = "reminder_close_cash"
    reminder_pending_expenses = "reminder_pending_expenses"
    reminder_overdue_receivables = "reminder_overdue_receivables"
    reminder_orders_ready = "reminder_orders_ready"
    reminder_weekly_summary = "reminder_weekly_summary"

    # System
    system_health = "system_health"
    daily_digest = "daily_digest"
    daily_digest_seller = "daily_digest_seller"


# Alerts that contain global financial/management info.
# At routing time, these are restricted to superusers + users with OWNER/ADMIN
# role in any school, regardless of subscription state. Defense in depth.
RESTRICTED_TO_ADMIN_ALERTS: frozenset[TelegramAlertType] = frozenset({
    TelegramAlertType.expense_created,
    TelegramAlertType.expense_paid,
    TelegramAlertType.cash_drawer_access,
    TelegramAlertType.reminder_pending_expenses,
    TelegramAlertType.reminder_overdue_receivables,
    TelegramAlertType.reminder_weekly_summary,
    TelegramAlertType.daily_digest,
    TelegramAlertType.system_health,
    TelegramAlertType.attendance_alert,
})


# Default subscriptions by role
DEFAULT_SUBSCRIPTIONS_BY_ROLE = {
    "owner": list(TelegramAlertType),  # All types
    "superuser": list(TelegramAlertType),  # All types
    "admin": [
        TelegramAlertType.sale_created,
        TelegramAlertType.order_created,
        TelegramAlertType.web_order_created,
        TelegramAlertType.order_status_changed,
        TelegramAlertType.low_stock,
        TelegramAlertType.expense_created,
        TelegramAlertType.expense_paid,
        TelegramAlertType.wompi_payment,
        TelegramAlertType.pqrs_received,
        TelegramAlertType.attendance_alert,
        TelegramAlertType.cash_drawer_access,
        TelegramAlertType.alteration_received,
        TelegramAlertType.alteration_delivered,
        TelegramAlertType.alteration_payment,
        TelegramAlertType.reminder_close_cash,
        TelegramAlertType.reminder_pending_expenses,
        TelegramAlertType.reminder_overdue_receivables,
        TelegramAlertType.reminder_orders_ready,
        TelegramAlertType.daily_digest,
    ],
    "seller": [
        TelegramAlertType.sale_created,
        TelegramAlertType.order_created,
        TelegramAlertType.web_order_created,
        TelegramAlertType.order_status_changed,
        TelegramAlertType.low_stock,
        TelegramAlertType.reminder_orders_ready,
        TelegramAlertType.daily_digest_seller,
    ],
    "viewer": [
        TelegramAlertType.daily_digest_seller,
    ],
}


class TelegramAlertSubscription(Base):
    """Per-user subscription to a specific Telegram alert type."""
    __tablename__ = "telegram_alert_subscriptions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    alert_type: Mapped[TelegramAlertType] = mapped_column(
        SQLEnum(TelegramAlertType, name="telegram_alert_type_enum"),
        nullable=False,
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=get_colombia_now_naive,
        nullable=False,
    )

    # Relationships
    user: Mapped["User"] = relationship(back_populates="telegram_subscriptions")

    __table_args__ = (
        UniqueConstraint("user_id", "alert_type", name="uq_user_alert_type"),
        Index("ix_telegram_sub_user_id", "user_id"),
        Index("ix_telegram_sub_alert_type", "alert_type"),
    )

    def __repr__(self) -> str:
        return f"<TelegramAlertSubscription(user_id='{self.user_id}', alert_type='{self.alert_type}')>"


# Resolve forward reference
from app.models.user import User  # noqa: E402
