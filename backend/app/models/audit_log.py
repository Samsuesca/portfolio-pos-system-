"""
Audit Log Model - Tracks sensitive operations for security and compliance.

Records actor, action, timestamp, and before/after data for critical operations
like role changes, balance modifications, sale cancellations, and record deletions.
This is a GLOBAL table (not per-school).
"""
from datetime import datetime
from sqlalchemy import String, DateTime, Text, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID, JSONB
import uuid
import enum

from app.db.base import Base
from app.utils.timezone import get_colombia_now_naive


class AuditAction(str, enum.Enum):
    """Categories of auditable actions"""
    # User & Role management
    ROLE_CHANGE = "role_change"
    USER_DEACTIVATE = "user_deactivate"
    USER_ACTIVATE = "user_activate"
    PERMISSION_CHANGE = "permission_change"

    # Financial operations
    BALANCE_ADJUSTMENT = "balance_adjustment"
    EXPENSE_DELETE = "expense_delete"
    EXPENSE_MODIFY = "expense_modify"
    TRANSFER_CREATE = "transfer_create"

    # Sales
    SALE_CANCEL = "sale_cancel"
    SALE_MODIFY = "sale_modify"
    SALE_REFUND = "sale_refund"

    # Orders
    ORDER_CANCEL = "order_cancel"
    ORDER_STATUS_CHANGE = "order_status_change"

    # Records
    RECORD_DELETE = "record_delete"
    CLIENT_DELETE = "client_delete"
    PRODUCT_DELETE = "product_delete"

    # Configuration
    CONFIG_CHANGE = "config_change"
    SCHOOL_MODIFY = "school_modify"

    # Payroll
    PAYROLL_APPROVE = "payroll_approve"
    PAYROLL_MODIFY = "payroll_modify"


class AuditLog(Base):
    """
    Audit log entry for sensitive operations.

    Stores who did what, when, and the before/after state of the data.
    """
    __tablename__ = "audit_logs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )

    # Who performed the action
    actor_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )

    # What action was performed
    action: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        index=True
    )

    # What resource was affected
    resource_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        index=True
    )
    resource_id: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True
    )

    # Context
    description: Mapped[str | None] = mapped_column(
        Text,
        nullable=True
    )
    school_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        nullable=True,
        index=True
    )

    # Before/after snapshots
    data_before: Mapped[dict | None] = mapped_column(
        JSONB,
        nullable=True
    )
    data_after: Mapped[dict | None] = mapped_column(
        JSONB,
        nullable=True
    )

    # Request context
    ip_address: Mapped[str | None] = mapped_column(
        String(45),
        nullable=True
    )
    user_agent: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True
    )

    # Timestamp
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=get_colombia_now_naive,
        nullable=False,
        index=True
    )

    # Relationships
    actor: Mapped["User | None"] = relationship(
        "User",
        foreign_keys=[actor_id]
    )

    __table_args__ = (
        Index('ix_audit_logs_action_created', 'action', 'created_at'),
        Index('ix_audit_logs_resource', 'resource_type', 'resource_id'),
    )

    def __repr__(self) -> str:
        return f"<AuditLog(action='{self.action}', resource='{self.resource_type}', actor='{self.actor_id}')>"
