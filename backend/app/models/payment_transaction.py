"""
Payment Transaction Models - Wompi Payment Gateway Integration
"""
from datetime import datetime
from decimal import Decimal
from sqlalchemy import String, DateTime, Integer, Text, ForeignKey, Enum as SQLEnum, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID, JSONB
import uuid
import enum

from app.db.base import Base
from app.utils.timezone import get_colombia_now_naive


class WompiTransactionStatus(str, enum.Enum):
    """Wompi transaction statuses"""
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    DECLINED = "DECLINED"
    VOIDED = "VOIDED"
    ERROR = "ERROR"


class PaymentTransaction(Base):
    """
    Tracks Wompi payment transactions.

    Links to either an order or an accounts_receivable record.
    Amounts are stored in COP cents (as Wompi requires).
    """
    __tablename__ = "payment_transactions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )

    # Our unique reference sent to Wompi (e.g., WP-ENC-2026-0042-1710345600)
    reference: Mapped[str] = mapped_column(
        String(100),
        unique=True,
        nullable=False,
        index=True
    )

    # Wompi's transaction ID (set after payment attempt)
    wompi_transaction_id: Mapped[str | None] = mapped_column(String(100), index=True)

    # Polymorphic link - one of these will be set
    order_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("orders.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )
    receivable_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("accounts_receivable.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )

    # Context
    school_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("schools.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )
    client_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("clients.id", ondelete="SET NULL"),
        nullable=True
    )

    # Financial
    amount_in_cents: Mapped[int] = mapped_column(Integer, nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="COP", nullable=False)

    # Wompi status
    status: Mapped[WompiTransactionStatus] = mapped_column(
        SQLEnum(
            WompiTransactionStatus,
            name="wompi_transaction_status_enum",
            values_callable=lambda x: [e.value for e in x],
        ),
        default=WompiTransactionStatus.PENDING,
        nullable=False,
        index=True
    )
    payment_method_type: Mapped[str | None] = mapped_column(String(50))  # CARD, PSE, NEQUI
    status_message: Mapped[str | None] = mapped_column(Text)

    # Full Wompi response stored for reference
    wompi_response_data: Mapped[dict | None] = mapped_column(JSONB)

    # Integrity signature we generated
    integrity_signature: Mapped[str] = mapped_column(String(128), nullable=False)

    # Wompi fee/commission tracking (in COP cents)
    wompi_fee_cents: Mapped[int | None] = mapped_column(Integer, nullable=True)
    wompi_fee_tax_cents: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Whether accounting was already applied (idempotency guard)
    accounting_applied: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime, default=get_colombia_now_naive, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=get_colombia_now_naive,
        onupdate=get_colombia_now_naive,
        nullable=False
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime)

    # Relationships
    order: Mapped["Order | None"] = relationship()
    receivable: Mapped["AccountsReceivable | None"] = relationship()
    school: Mapped["School | None"] = relationship()
    client: Mapped["Client | None"] = relationship()

    def __repr__(self) -> str:
        return f"<PaymentTransaction(ref={self.reference}, status={self.status}, amount={self.amount_in_cents})>"
