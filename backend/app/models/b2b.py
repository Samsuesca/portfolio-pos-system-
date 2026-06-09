"""
B2B Models — Cotizaciones y Contratos (tercer pilar de UCR v3).

Canal de venta empresarial (uniformes corporativos, dotación legal Art. 230 CST,
equipos deportivos, eventos, institucional). Ciclo distinto al retail escolar:
made-to-order, anticipo + saldo, cotización formal numerada → contrato.

Diseño de negocio: `docs/v3/v3-branch-architecture/b2b-contracts-model.md`.

Decisiones de modelado frente al doc:
- `b2b_clients` es una tabla **separada** de `clients` (B2C): tiene NIT, crédito
  y términos de pago — un ciclo comercial distinto.
- `branch_id` es nullable (NULL = central/corporativo). Apunta a `branches`
  (Fase 0a). El uniforme escolar es excluido de IVA, pero la dotación
  corporativa grava → el IVA se modela explícito en `quotations.tax_amount`.
- El enlace cotización↔contrato es **unidireccional** vía `contracts.quotation_id`
  (one-to-one), evitando el FK circular del doc (`converted_contract_id`).
"""
from datetime import datetime, date
from decimal import Decimal
from sqlalchemy import (
    String, DateTime, Date, Numeric, Integer, Text, ForeignKey,
    UniqueConstraint, CheckConstraint, Enum as SQLEnum, Boolean,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
import uuid
import enum

from app.db.base import Base
from app.utils.timezone import get_colombia_now_naive


# ---------------------------------------------------------------------------
# Enums (stored lowercase via values_callable — consistent con el doc)
# ---------------------------------------------------------------------------


class B2BSegment(str, enum.Enum):
    RESTAURANT = "restaurant"
    CORPORATE = "corporate"
    SPORTS = "sports"
    EVENT = "event"
    INSTITUTIONAL = "institutional"


class QuotationStatus(str, enum.Enum):
    DRAFT = "draft"
    SENT = "sent"
    NEGOTIATION = "negotiation"
    ACCEPTED = "accepted"
    REJECTED = "rejected"
    EXPIRED = "expired"


class ContractStatus(str, enum.Enum):
    PENDING_DEPOSIT = "pending_deposit"
    IN_PRODUCTION = "in_production"
    PARTIAL_DELIVERY = "partial_delivery"
    DELIVERED = "delivered"
    CLOSED = "closed"
    CANCELLED = "cancelled"


class MilestoneStatus(str, enum.Enum):
    PENDING = "pending"
    DELIVERED = "delivered"
    INVOICED = "invoiced"
    PAID = "paid"


# ---------------------------------------------------------------------------
# B2B Client (empresa)
# ---------------------------------------------------------------------------


class B2BClient(Base):
    """Cliente empresarial (no consumidor final). Tiene NIT, crédito y términos."""
    __tablename__ = "b2b_clients"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    branch_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("branches.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    legal_name: Mapped[str] = mapped_column(String(250), nullable=False)
    trade_name: Mapped[str | None] = mapped_column(String(250))
    tax_id: Mapped[str] = mapped_column(String(50), nullable=False, index=True)  # NIT
    segment: Mapped[B2BSegment] = mapped_column(
        SQLEnum(B2BSegment, name="b2b_segment_enum", values_callable=lambda x: [e.value for e in x]),
        nullable=False,
    )

    contact_name: Mapped[str | None] = mapped_column(String(200))
    contact_phone: Mapped[str | None] = mapped_column(String(50))
    contact_email: Mapped[str | None] = mapped_column(String(200))
    billing_address: Mapped[str | None] = mapped_column(Text)

    credit_limit: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0, nullable=False)
    payment_terms_days: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    notes: Mapped[str | None] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=get_colombia_now_naive, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=get_colombia_now_naive, onupdate=get_colombia_now_naive, nullable=False
    )

    # Relationships
    quotations: Mapped[list["Quotation"]] = relationship(
        back_populates="b2b_client", cascade="all, delete-orphan"
    )
    contracts: Mapped[list["Contract"]] = relationship(
        back_populates="b2b_client", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<B2BClient(legal_name='{self.legal_name}', tax_id='{self.tax_id}')>"


# ---------------------------------------------------------------------------
# Quotation (cotización formal numerada)
# ---------------------------------------------------------------------------


class Quotation(Base):
    """Cotización formal con consecutivo COT-YYYY-NNNN y vigencia."""
    __tablename__ = "quotations"
    __table_args__ = (
        UniqueConstraint("quotation_number", name="uq_quotation_number"),
        CheckConstraint("total >= 0", name="chk_quotation_total_nonneg"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    branch_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("branches.id", ondelete="SET NULL"), nullable=True, index=True
    )
    b2b_client_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("b2b_clients.id", ondelete="RESTRICT"), nullable=False, index=True
    )

    quotation_number: Mapped[str] = mapped_column(String(50), nullable=False)  # COT-2026-0001
    status: Mapped[QuotationStatus] = mapped_column(
        SQLEnum(QuotationStatus, name="quotation_status_enum", values_callable=lambda x: [e.value for e in x]),
        default=QuotationStatus.DRAFT,
        nullable=False,
        index=True,
    )

    issue_date: Mapped[date] = mapped_column(Date, nullable=False)
    valid_until: Mapped[date] = mapped_column(Date, nullable=False)

    subtotal: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0, nullable=False)
    tax_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0, nullable=False)
    total: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0, nullable=False)

    deposit_pct: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=50, nullable=False)
    estimated_delivery_days: Mapped[int | None] = mapped_column(Integer)
    terms: Mapped[str | None] = mapped_column(Text)
    notes: Mapped[str | None] = mapped_column(Text)

    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(DateTime, default=get_colombia_now_naive, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=get_colombia_now_naive, onupdate=get_colombia_now_naive, nullable=False
    )

    # Relationships
    b2b_client: Mapped["B2BClient"] = relationship(back_populates="quotations")
    items: Mapped[list["QuotationItem"]] = relationship(
        back_populates="quotation", cascade="all, delete-orphan"
    )
    # one-to-one: el contrato resultante de aceptar esta cotización
    contract: Mapped["Contract | None"] = relationship(back_populates="quotation", uselist=False)

    def __repr__(self) -> str:
        return f"<Quotation(number='{self.quotation_number}', status='{self.status}', total={self.total})>"


class QuotationItem(Base):
    """Línea de cotización. `product_id` NULL = item ad-hoc (diseño custom)."""
    __tablename__ = "quotation_items"
    __table_args__ = (
        CheckConstraint("quantity > 0", name="chk_quotation_item_quantity_positive"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    quotation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("quotations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    product_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("products.id", ondelete="SET NULL"), nullable=True, index=True
    )

    description: Mapped[str] = mapped_column(String(300), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    unit_cost_estimate: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    customization: Mapped[str | None] = mapped_column(Text)  # bordado, estampado, tela, color
    line_total: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)

    # Relationships
    quotation: Mapped["Quotation"] = relationship(back_populates="items")
    product: Mapped["Product | None"] = relationship()

    def __repr__(self) -> str:
        return f"<QuotationItem(desc='{self.description[:30]}', qty={self.quantity})>"


# ---------------------------------------------------------------------------
# Contract (cotización aceptada)
# ---------------------------------------------------------------------------


class Contract(Base):
    """Contrato / orden de compra. Ciclo: pending_deposit → in_production →
    (partial_delivery) → delivered → closed. El anticipo se contabiliza como
    pasivo (ingreso diferido); el ingreso se reconoce contra entrega (Fase B3)."""
    __tablename__ = "contracts"
    __table_args__ = (
        UniqueConstraint("contract_number", name="uq_contract_number"),
        CheckConstraint("total >= 0", name="chk_contract_total_nonneg"),
        CheckConstraint("deposit_amount >= 0", name="chk_contract_deposit_nonneg"),
        CheckConstraint("balance_amount >= 0", name="chk_contract_balance_nonneg"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    branch_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("branches.id", ondelete="SET NULL"), nullable=True, index=True
    )
    b2b_client_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("b2b_clients.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    quotation_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("quotations.id", ondelete="SET NULL"), nullable=True, index=True
    )

    contract_number: Mapped[str] = mapped_column(String(50), nullable=False)  # CTR-2026-0001
    status: Mapped[ContractStatus] = mapped_column(
        SQLEnum(ContractStatus, name="contract_status_enum", values_callable=lambda x: [e.value for e in x]),
        default=ContractStatus.PENDING_DEPOSIT,
        nullable=False,
        index=True,
    )

    total: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    deposit_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0, nullable=False)
    deposit_received_at: Mapped[datetime | None] = mapped_column(DateTime)
    # Método de pago con el que entró el anticipo (cash/nequi/transfer/card) —
    # para devolver desde la MISMA cuenta al cancelar. NULL = aún sin anticipo.
    deposit_payment_method: Mapped[str | None] = mapped_column(String(20))
    balance_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0, nullable=False)

    delivery_date: Mapped[date | None] = mapped_column(Date)
    # Set al transicionar a DELIVERED — base de reconocimiento de ingreso (accrual).
    delivered_at: Mapped[datetime | None] = mapped_column(DateTime, index=True)

    has_milestones: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    signed_document_url: Mapped[str | None] = mapped_column(String(500))
    notes: Mapped[str | None] = mapped_column(Text)

    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(DateTime, default=get_colombia_now_naive, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=get_colombia_now_naive, onupdate=get_colombia_now_naive, nullable=False
    )

    # Relationships
    b2b_client: Mapped["B2BClient"] = relationship(back_populates="contracts")
    quotation: Mapped["Quotation | None"] = relationship(back_populates="contract")
    milestones: Mapped[list["ContractMilestone"]] = relationship(
        back_populates="contract", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Contract(number='{self.contract_number}', status='{self.status}', total={self.total})>"


class ContractMilestone(Base):
    """Hito de entrega (contratos grandes con entregas parciales)."""
    __tablename__ = "contract_milestones"
    __table_args__ = (
        CheckConstraint("amount >= 0", name="chk_milestone_amount_nonneg"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    contract_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("contracts.id", ondelete="CASCADE"), nullable=False, index=True
    )

    sequence: Mapped[int] = mapped_column(Integer, nullable=False)
    description: Mapped[str] = mapped_column(String(300), nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    due_date: Mapped[date | None] = mapped_column(Date)
    delivered_at: Mapped[datetime | None] = mapped_column(DateTime)
    invoiced_at: Mapped[datetime | None] = mapped_column(DateTime)
    status: Mapped[MilestoneStatus] = mapped_column(
        SQLEnum(MilestoneStatus, name="contract_milestone_status_enum", values_callable=lambda x: [e.value for e in x]),
        default=MilestoneStatus.PENDING,
        nullable=False,
    )

    # Relationships
    contract: Mapped["Contract"] = relationship(back_populates="milestones")

    def __repr__(self) -> str:
        return f"<ContractMilestone(seq={self.sequence}, amount={self.amount}, status='{self.status}')>"
