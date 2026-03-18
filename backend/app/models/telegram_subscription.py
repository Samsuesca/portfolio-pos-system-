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
    web_order_created = "web_order_created"
    order_status_changed = "order_status_changed"
    low_stock = "low_stock"
    expense_created = "expense_created"
    expense_paid = "expense_paid"
    wompi_payment = "wompi_payment"
    pqrs_received = "pqrs_received"
    attendance_alert = "attendance_alert"
    cash_drawer_access = "cash_drawer_access"

    # Proactive reminders (triggered by scheduler)
    reminder_close_cash = "reminder_close_cash"
    reminder_pending_expenses = "reminder_pending_expenses"
    reminder_overdue_receivables = "reminder_overdue_receivables"
    reminder_orders_ready = "reminder_orders_ready"
    reminder_weekly_summary = "reminder_weekly_summary"

    # System
    system_health = "system_health"
    daily_digest = "daily_digest"


# Default subscriptions by role
DEFAULT_SUBSCRIPTIONS_BY_ROLE = {
    "owner": list(TelegramAlertType),  # All 17 types
    "superuser": list(TelegramAlertType),  # All 17 types
    "admin": [
        TelegramAlertType.sale_created,
        TelegramAlertType.web_order_created,
        TelegramAlertType.order_status_changed,
        TelegramAlertType.low_stock,
        TelegramAlertType.expense_created,
        TelegramAlertType.expense_paid,
        TelegramAlertType.wompi_payment,
        TelegramAlertType.pqrs_received,
        TelegramAlertType.attendance_alert,
        TelegramAlertType.cash_drawer_access,
        TelegramAlertType.reminder_close_cash,
        TelegramAlertType.reminder_pending_expenses,
        TelegramAlertType.reminder_overdue_receivables,
        TelegramAlertType.reminder_orders_ready,
        TelegramAlertType.daily_digest,
    ],
    "seller": [
        TelegramAlertType.sale_created,
        TelegramAlertType.web_order_created,
        TelegramAlertType.order_status_changed,
        TelegramAlertType.low_stock,
        TelegramAlertType.reminder_orders_ready,
        TelegramAlertType.daily_digest,
    ],
    "viewer": [
        TelegramAlertType.daily_digest,
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
