"""
Electronic Invoice Models - Facturacion Electronica DIAN (Alegra)

One row per emission attempt against Alegra/DIAN. A document (sale, order or
alteration) can be linked to at most one EMITTED invoice (idempotency), but a
prior FAILED attempt may coexist so the user can see the error and retry.

Exactly one of (sale_id, order_id, alteration_id) is set, enforced both by the
document_type discriminator and a CHECK constraint.
"""
import enum
import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    String, Text, DateTime, ForeignKey, Numeric, CheckConstraint,
    Enum as SQLEnum,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.utils.timezone import get_colombia_now_naive


class InvoiceDocumentType(str, enum.Enum):
    """Origin document that the electronic invoice bills."""
    SALE = "sale"
    ORDER = "order"
    ALTERATION = "alteration"


class ElectronicInvoiceStatus(str, enum.Enum):
    """Lifecycle of an electronic invoice emission."""
    PENDING = "pending"    # row created, emission in flight
    EMITTED = "emitted"    # stamped & accepted by DIAN
    FAILED = "failed"      # Alegra/DIAN rejected the emission
    VOIDED = "voided"      # annulled via credit note


class ElectronicInvoice(Base):
    """An electronic invoice (factura electronica DIAN) emitted via Alegra."""
    __tablename__ = "electronic_invoices"
    __table_args__ = (
        CheckConstraint(
            "(CASE WHEN sale_id IS NOT NULL THEN 1 ELSE 0 END + "
            "CASE WHEN order_id IS NOT NULL THEN 1 ELSE 0 END + "
            "CASE WHEN alteration_id IS NOT NULL THEN 1 ELSE 0 END) = 1",
            name="chk_electronic_invoice_single_document",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    document_type: Mapped[InvoiceDocumentType] = mapped_column(
        SQLEnum(
            InvoiceDocumentType,
            name="invoice_document_type_enum",
            values_callable=lambda obj: [e.value for e in obj],
        ),
        nullable=False,
        index=True,
    )

    sale_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("sales.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    order_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("orders.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    alteration_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("alterations.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )

    status: Mapped[ElectronicInvoiceStatus] = mapped_column(
        SQLEnum(
            ElectronicInvoiceStatus,
            name="electronic_invoice_status_enum",
            values_callable=lambda obj: [e.value for e in obj],
        ),
        default=ElectronicInvoiceStatus.PENDING,
        nullable=False,
        index=True,
    )

    # Alegra / DIAN identifiers (populated on successful emission)
    alegra_invoice_id: Mapped[str | None] = mapped_column(String(50), index=True)
    full_number: Mapped[str | None] = mapped_column(String(50))   # e.g. "FE2-123"
    cufe: Mapped[str | None] = mapped_column(String(120))
    legal_status: Mapped[str | None] = mapped_column(String(60))
    pdf_url: Mapped[str | None] = mapped_column(Text)
    xml_url: Mapped[str | None] = mapped_column(Text)

    # Snapshots (resilient to later edits / deletes of the source document)
    total: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    client_name: Mapped[str | None] = mapped_column(String(255))
    client_identification: Mapped[str | None] = mapped_column(String(30))

    error_message: Mapped[str | None] = mapped_column(Text)

    # Credit note (annulment) fields
    credit_note_alegra_id: Mapped[str | None] = mapped_column(String(50))
    credit_note_number: Mapped[str | None] = mapped_column(String(50))
    credit_note_cufe: Mapped[str | None] = mapped_column(String(120))
    void_reason: Mapped[str | None] = mapped_column(Text)
    voided_at: Mapped[datetime | None] = mapped_column(DateTime)

    emitted_at: Mapped[datetime | None] = mapped_column(DateTime)
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=get_colombia_now_naive, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=get_colombia_now_naive,
        onupdate=get_colombia_now_naive,
        nullable=False,
    )

    # Relationships
    sale: Mapped["Sale | None"] = relationship()
    order: Mapped["Order | None"] = relationship()
    alteration: Mapped["Alteration | None"] = relationship()

    def __repr__(self) -> str:
        return (
            f"<ElectronicInvoice(id={self.id}, type={self.document_type}, "
            f"status={self.status}, number={self.full_number})>"
        )
