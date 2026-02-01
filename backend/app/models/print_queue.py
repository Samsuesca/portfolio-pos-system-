"""
Print Queue Model

Manages the queue of sales pending print on the primary thermal printer.
Only cash sales are added to this queue for synchronization across devices.
"""
from datetime import datetime
from decimal import Decimal
from sqlalchemy import String, DateTime, Text, ForeignKey, Enum as SQLEnum, Boolean, Numeric
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
import uuid
import enum

from app.db.base import Base
from app.utils.timezone import get_colombia_now_naive


class PrintQueueStatus(str, enum.Enum):
    """Status of items in the print queue"""
    PENDING = "pending"       # Awaiting print
    PRINTED = "printed"       # Successfully printed
    SKIPPED = "skipped"       # Manually skipped/discarded
    FAILED = "failed"         # Print attempted but failed


class PrintQueueItem(Base):
    """
    Queue item for sales pending print on the primary printer.

    Only cash sales (payment_method = 'cash') are added to this queue.
    The primary PC with the thermal printer subscribes via SSE and
    processes items from this queue.
    """
    __tablename__ = "print_queue"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )

    # Reference to the sale
    sale_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("sales.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    # School reference for filtering and context
    school_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("schools.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    # Status tracking
    status: Mapped[PrintQueueStatus] = mapped_column(
        SQLEnum(PrintQueueStatus, name="print_queue_status_enum",
                values_callable=lambda x: [e.value for e in x]),
        default=PrintQueueStatus.PENDING,
        nullable=False,
        index=True
    )

    # Actions to perform
    print_receipt: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    open_drawer: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Metadata for display (denormalized for performance)
    sale_code: Mapped[str] = mapped_column(String(30), nullable=False)
    sale_total: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    client_name: Mapped[str | None] = mapped_column(String(255))
    school_name: Mapped[str | None] = mapped_column(String(255))
    source_device: Mapped[str | None] = mapped_column(String(100))  # desktop_app, admin_portal, etc.

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=get_colombia_now_naive, nullable=False
    )
    processed_at: Mapped[datetime | None] = mapped_column(DateTime)

    # Error tracking (for failed prints)
    error_message: Mapped[str | None] = mapped_column(Text)
    retry_count: Mapped[int] = mapped_column(default=0, nullable=False)

    # Relationships
    sale: Mapped["Sale"] = relationship()
    school: Mapped["School"] = relationship()

    def __repr__(self) -> str:
        return f"<PrintQueueItem(sale_code='{self.sale_code}', status='{self.status}')>"
