"""
Alteration Models - Repairs/Alterations Portal for outsourced tailoring services.

This is a GLOBAL module (school_id = NULL) - operates business-wide like accounting.
"""
from datetime import datetime, date
from decimal import Decimal
from sqlalchemy import String, Boolean, DateTime, Date, Numeric, Text, ForeignKey, Enum as SQLEnum, CheckConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
import uuid
import enum

from app.db.base import Base
from app.utils.timezone import get_colombia_now_naive


class AlterationType(str, enum.Enum):
    """Types of alterations/repairs"""
    HEM = "hem"                 # Dobladillo
    LENGTH = "length"           # Largo
    WIDTH = "width"             # Ancho
    SEAM = "seam"               # Costura
    BUTTONS = "buttons"         # Botones
    ZIPPER = "zipper"           # Cremallera
    PATCH = "patch"             # Parche
    DARTS = "darts"             # Pinzas
    OTHER = "other"             # Otro


class AlterationStatus(str, enum.Enum):
    """Status of an alteration"""
    PENDING = "pending"             # Pendiente
    IN_PROGRESS = "in_progress"     # En proceso
    READY = "ready"                 # Listo para entregar
    DELIVERED = "delivered"         # Entregado
    CANCELLED = "cancelled"         # Cancelado


class Alteration(Base):
    """
    Alteration/Repair record for outsourced tailoring services.

    GLOBAL module (school_id = NULL) - operates business-wide like accounting.
    Allows either registered clients OR external clients (name+phone).
    """
    __tablename__ = "alterations"
    __table_args__ = (
        CheckConstraint('cost > 0', name='chk_alteration_cost_positive'),
        CheckConstraint('amount_paid >= 0', name='chk_alteration_paid_positive'),
        CheckConstraint(
            'client_id IS NOT NULL OR external_client_name IS NOT NULL',
            name='chk_alteration_has_client'
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )

    # Auto-generated code: ARR-YYYY-NNNN
    code: Mapped[str] = mapped_column(
        String(20),
        unique=True,
        nullable=False,
        index=True
    )

    # Client options (registered OR external - one is required)
    client_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("clients.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )
    external_client_name: Mapped[str | None] = mapped_column(String(255))
    external_client_phone: Mapped[str | None] = mapped_column(String(20))

    # Alteration details
    alteration_type: Mapped[AlterationType] = mapped_column(
        SQLEnum(
            AlterationType,
            name="alteration_type_enum",
            values_callable=lambda x: [e.value for e in x],
            create_constraint=False
        ),
        nullable=False
    )
    garment_name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)

    # Pricing
    cost: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    amount_paid: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        default=Decimal("0"),
        nullable=False
    )

    # Status
    status: Mapped[AlterationStatus] = mapped_column(
        SQLEnum(
            AlterationStatus,
            name="alteration_status_enum",
            values_callable=lambda x: [e.value for e in x],
            create_constraint=False
        ),
        default=AlterationStatus.PENDING,
        nullable=False,
        index=True
    )

    # Dates
    received_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    estimated_delivery_date: Mapped[date | None] = mapped_column(Date)
    delivered_date: Mapped[date | None] = mapped_column(Date)

    # Notes
    notes: Mapped[str | None] = mapped_column(Text)

    # Audit
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=get_colombia_now_naive,
        nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=get_colombia_now_naive,
        onupdate=get_colombia_now_naive,
        nullable=False
    )

    # Relationships
    client: Mapped["Client | None"] = relationship()
    created_by_user: Mapped["User | None"] = relationship(foreign_keys=[created_by])
    payments: Mapped[list["AlterationPayment"]] = relationship(
        back_populates="alteration",
        cascade="all, delete-orphan",
        order_by="AlterationPayment.created_at.desc()"
    )

    @property
    def balance(self) -> Decimal:
        """Remaining balance to pay"""
        return self.cost - self.amount_paid

    @property
    def is_paid(self) -> bool:
        """Check if fully paid"""
        return self.amount_paid >= self.cost

    @property
    def client_display_name(self) -> str:
        """Get client name (registered or external)"""
        if self.client:
            return self.client.name
        return self.external_client_name or "Cliente Externo"

    def __repr__(self) -> str:
        return f"<Alteration({self.code}: {self.alteration_type.value} - ${self.cost})>"


class AlterationPayment(Base):
    """
    Payment record for an alteration.

    Each payment can optionally create a Transaction(INCOME, category='alterations')
    for accounting integration.
    """
    __tablename__ = "alteration_payments"
    __table_args__ = (
        CheckConstraint('amount > 0', name='chk_alteration_payment_positive'),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    alteration_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("alterations.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    # Payment details
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    payment_method: Mapped[str] = mapped_column(
        String(20),
        nullable=False
    )  # cash, nequi, transfer, card
    notes: Mapped[str | None] = mapped_column(Text)

    # Cash change tracking (only for cash payments)
    amount_received: Mapped[Decimal | None] = mapped_column(
        Numeric(10, 2), nullable=True,
        comment="Physical amount received from customer (cash only)"
    )
    change_given: Mapped[Decimal | None] = mapped_column(
        Numeric(10, 2), nullable=True,
        comment="Change returned to customer (cash only)"
    )

    # Reference to accounting transaction (if accounting integration enabled)
    transaction_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("transactions.id", ondelete="SET NULL"),
        nullable=True
    )

    # Audit
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=get_colombia_now_naive,
        nullable=False
    )

    # Relationships
    alteration: Mapped["Alteration"] = relationship(back_populates="payments")
    transaction: Mapped["Transaction | None"] = relationship()
    created_by_user: Mapped["User | None"] = relationship(foreign_keys=[created_by])

    def __repr__(self) -> str:
        return f"<AlterationPayment({self.amount} via {self.payment_method})>"
