"""
Email Log Model - Audit trail for all email sends

Tracks every email sent by the system for monitoring, debugging,
and analytics purposes. This is a GLOBAL table (not per-school).
"""
from datetime import datetime
from sqlalchemy import String, DateTime, Text, Enum as SQLEnum, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
import uuid
import enum

from app.db.base import Base
from app.utils.timezone import get_colombia_now_naive


class EmailType(str, enum.Enum):
    """Types of emails sent by the system"""
    VERIFICATION = "verification"
    WELCOME = "welcome"
    PASSWORD_RESET = "password_reset"
    ORDER_CONFIRMATION = "order_confirmation"
    SALE_CONFIRMATION = "sale_confirmation"
    ACTIVATION = "activation"
    ORDER_READY = "order_ready"
    WELCOME_ACTIVATION = "welcome_activation"
    EMAIL_CHANGE = "email_change"
    DRAWER_ACCESS = "drawer_access"
    ORDER_STATUS_UPDATE = "order_status_update"


class EmailStatus(str, enum.Enum):
    """Status of email delivery"""
    SUCCESS = "success"
    FAILED = "failed"
    DEV_SKIPPED = "dev_skipped"


class EmailLog(Base):
    """
    Email log - records all email sends for audit and analytics.

    This is a GLOBAL table (not per-school) similar to how
    accounting operations work in this system.
    """
    __tablename__ = "email_logs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )

    # Email details
    email_type: Mapped[EmailType] = mapped_column(
        SQLEnum(
            EmailType,
            name="email_type_enum",
            values_callable=lambda x: [e.value for e in x]
        ),
        nullable=False,
        index=True
    )
    recipient_email: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        index=True
    )
    recipient_name: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True
    )
    subject: Mapped[str] = mapped_column(
        String(500),
        nullable=False
    )

    # Status and result
    status: Mapped[EmailStatus] = mapped_column(
        SQLEnum(
            EmailStatus,
            name="email_status_enum",
            values_callable=lambda x: [e.value for e in x]
        ),
        nullable=False,
        index=True
    )
    error_message: Mapped[str | None] = mapped_column(
        Text,
        nullable=True
    )

    # Context/reference (optional)
    reference_code: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
        index=True
    )

    # Related entities (all optional - for filtering/reporting)
    client_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("clients.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )
    order_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("orders.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )
    sale_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("sales.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )
    triggered_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True
    )

    # Audit
    sent_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=get_colombia_now_naive,
        nullable=False,
        index=True
    )

    # Relationships
    client: Mapped["Client | None"] = relationship(
        "Client",
        foreign_keys=[client_id]
    )
    order: Mapped["Order | None"] = relationship(
        "Order",
        foreign_keys=[order_id]
    )
    sale: Mapped["Sale | None"] = relationship(
        "Sale",
        foreign_keys=[sale_id]
    )
    user: Mapped["User | None"] = relationship(
        "User",
        foreign_keys=[user_id]
    )
    triggered_by_user: Mapped["User | None"] = relationship(
        "User",
        foreign_keys=[triggered_by]
    )

    def __repr__(self) -> str:
        return f"<EmailLog(type='{self.email_type.value}', to='{self.recipient_email}', status='{self.status.value}')>"
