"""
B2B Pydantic schemas — Clientes empresariales, Cotizaciones y Contratos.
"""
from datetime import datetime, date
from decimal import Decimal
from uuid import UUID

from pydantic import field_validator

from app.schemas.base import BaseSchema
from app.models.accounting import AccPaymentMethod
from app.models.b2b import (
    B2BSegment,
    QuotationStatus,
    ContractStatus,
    MilestoneStatus,
)


# ---------------------------------------------------------------------------
# B2B Client
# ---------------------------------------------------------------------------


class B2BClientBase(BaseSchema):
    legal_name: str
    trade_name: str | None = None
    tax_id: str
    segment: B2BSegment
    contact_name: str | None = None
    contact_phone: str | None = None
    contact_email: str | None = None
    billing_address: str | None = None
    credit_limit: Decimal = Decimal("0")
    payment_terms_days: int = 0
    notes: str | None = None
    branch_id: UUID | None = None

    @field_validator("credit_limit")
    @classmethod
    def validate_credit_limit(cls, v: Decimal) -> Decimal:
        if v < 0:
            raise ValueError("El límite de crédito no puede ser negativo")
        return v

    @field_validator("payment_terms_days")
    @classmethod
    def validate_terms(cls, v: int) -> int:
        if v < 0:
            raise ValueError("Los días de plazo no pueden ser negativos")
        return v


class B2BClientCreate(B2BClientBase):
    pass


class B2BClientUpdate(BaseSchema):
    legal_name: str | None = None
    trade_name: str | None = None
    tax_id: str | None = None
    segment: B2BSegment | None = None
    contact_name: str | None = None
    contact_phone: str | None = None
    contact_email: str | None = None
    billing_address: str | None = None
    credit_limit: Decimal | None = None
    payment_terms_days: int | None = None
    notes: str | None = None
    is_active: bool | None = None
    branch_id: UUID | None = None


class B2BClientResponse(B2BClientBase):
    id: UUID
    is_active: bool
    created_at: datetime
    updated_at: datetime


# ---------------------------------------------------------------------------
# Quotation items
# ---------------------------------------------------------------------------


class QuotationItemCreate(BaseSchema):
    product_id: UUID | None = None
    description: str
    quantity: int
    unit_price: Decimal
    unit_cost_estimate: Decimal | None = None
    customization: str | None = None

    @field_validator("quantity")
    @classmethod
    def validate_quantity(cls, v: int) -> int:
        if v <= 0:
            raise ValueError("La cantidad debe ser mayor a 0")
        return v


class QuotationItemResponse(BaseSchema):
    id: UUID
    product_id: UUID | None = None
    description: str
    quantity: int
    unit_price: Decimal
    unit_cost_estimate: Decimal | None = None
    customization: str | None = None
    line_total: Decimal


# ---------------------------------------------------------------------------
# Quotations
# ---------------------------------------------------------------------------


class QuotationCreate(BaseSchema):
    b2b_client_id: UUID
    branch_id: UUID | None = None
    issue_date: date
    valid_until: date
    deposit_pct: Decimal = Decimal("50")
    estimated_delivery_days: int | None = None
    terms: str | None = None
    notes: str | None = None
    # IVA aplicado a la cotización completa (dotación corporativa grava).
    tax_amount: Decimal = Decimal("0")
    items: list[QuotationItemCreate]

    @field_validator("items")
    @classmethod
    def validate_items(cls, v: list[QuotationItemCreate]) -> list[QuotationItemCreate]:
        if not v:
            raise ValueError("La cotización debe tener al menos un ítem")
        return v

    @field_validator("deposit_pct")
    @classmethod
    def validate_deposit_pct(cls, v: Decimal) -> Decimal:
        if v < 0 or v > 100:
            raise ValueError("El porcentaje de anticipo debe estar entre 0 y 100")
        return v


class QuotationUpdate(BaseSchema):
    """Edición de cabecera. Los ítems se reemplazan vía endpoint dedicado."""
    valid_until: date | None = None
    deposit_pct: Decimal | None = None
    estimated_delivery_days: int | None = None
    terms: str | None = None
    notes: str | None = None
    tax_amount: Decimal | None = None

    @field_validator("deposit_pct")
    @classmethod
    def validate_deposit_pct(cls, v: Decimal | None) -> Decimal | None:
        if v is not None and (v < 0 or v > 100):
            raise ValueError("El porcentaje de anticipo debe estar entre 0 y 100")
        return v


class QuotationStatusUpdate(BaseSchema):
    status: QuotationStatus


class QuotationResponse(BaseSchema):
    id: UUID
    branch_id: UUID | None = None
    b2b_client_id: UUID
    client_name: str | None = None
    quotation_number: str
    status: QuotationStatus
    issue_date: date
    valid_until: date
    subtotal: Decimal
    tax_amount: Decimal
    total: Decimal
    deposit_pct: Decimal
    estimated_delivery_days: int | None = None
    terms: str | None = None
    notes: str | None = None
    created_by: UUID | None = None
    created_at: datetime
    updated_at: datetime
    items: list[QuotationItemResponse] = []


class QuotationListResponse(BaseSchema):
    """Vista ligera para listados (sin ítems)."""
    id: UUID
    quotation_number: str
    status: QuotationStatus
    b2b_client_id: UUID
    client_name: str | None = None
    issue_date: date
    valid_until: date
    total: Decimal
    created_at: datetime


# ---------------------------------------------------------------------------
# Contract milestones
# ---------------------------------------------------------------------------


class ContractMilestoneCreate(BaseSchema):
    sequence: int
    description: str
    amount: Decimal
    due_date: date | None = None


class ContractMilestoneResponse(BaseSchema):
    id: UUID
    sequence: int
    description: str
    amount: Decimal
    due_date: date | None = None
    delivered_at: datetime | None = None
    invoiced_at: datetime | None = None
    status: MilestoneStatus


# ---------------------------------------------------------------------------
# Contracts
# ---------------------------------------------------------------------------


class ContractCreate(BaseSchema):
    """Creación directa de contrato. Normalmente se crea convirtiendo una
    cotización aceptada (endpoint de conversión), pero se permite alta directa."""
    b2b_client_id: UUID
    branch_id: UUID | None = None
    quotation_id: UUID | None = None
    total: Decimal
    deposit_amount: Decimal = Decimal("0")
    delivery_date: date | None = None
    has_milestones: bool = False
    signed_document_url: str | None = None
    notes: str | None = None
    milestones: list[ContractMilestoneCreate] = []

    @field_validator("total")
    @classmethod
    def validate_total(cls, v: Decimal) -> Decimal:
        if v <= 0:
            raise ValueError("El total del contrato debe ser mayor a 0")
        return v


class ContractUpdate(BaseSchema):
    delivery_date: date | None = None
    signed_document_url: str | None = None
    notes: str | None = None


class ContractResponse(BaseSchema):
    id: UUID
    branch_id: UUID | None = None
    b2b_client_id: UUID
    client_name: str | None = None
    quotation_id: UUID | None = None
    contract_number: str
    status: ContractStatus
    total: Decimal
    deposit_amount: Decimal
    deposit_received_at: datetime | None = None
    deposit_payment_method: str | None = None
    balance_amount: Decimal
    outstanding_balance: Decimal = Decimal("0")
    delivery_date: date | None = None
    delivered_at: datetime | None = None
    has_milestones: bool
    signed_document_url: str | None = None
    notes: str | None = None
    created_by: UUID | None = None
    created_at: datetime
    updated_at: datetime
    milestones: list[ContractMilestoneResponse] = []


class ContractListResponse(BaseSchema):
    id: UUID
    contract_number: str
    status: ContractStatus
    b2b_client_id: UUID
    client_name: str | None = None
    total: Decimal
    balance_amount: Decimal
    outstanding_balance: Decimal = Decimal("0")
    delivery_date: date | None = None
    created_at: datetime


# ---------------------------------------------------------------------------
# Contract lifecycle operations (Fase B3 — contabilidad del ciclo de vida)
# ---------------------------------------------------------------------------


class DepositRegister(BaseSchema):
    """Registrar el anticipo de un contrato (pending_deposit → in_production).

    El anticipo NO es ingreso: entra a caja y se registra como pasivo
    (cuenta 2110 Anticipos de Clientes). Ver ContractAccountingMixin.
    """
    payment_method: AccPaymentMethod
    amount: Decimal | None = None  # default = contract.deposit_amount
    payment_date: date | None = None

    @field_validator("amount")
    @classmethod
    def validate_amount(cls, v: Decimal | None) -> Decimal | None:
        if v is not None and v <= 0:
            raise ValueError("El monto del anticipo debe ser mayor a 0")
        return v


class DeliveryRegister(BaseSchema):
    """Registrar la entrega total de un contrato.

    Reconoce el ingreso del total, reversa el anticipo del pasivo y, si el
    cliente es a crédito, genera la CxC del saldo. `settlement_method` es el
    método de pago del saldo si el cliente es de contado.
    """
    delivery_date: date | None = None
    cogs_amount: Decimal | None = None
    settlement_method: AccPaymentMethod = AccPaymentMethod.CASH

    @field_validator("cogs_amount")
    @classmethod
    def validate_cogs(cls, v: Decimal | None) -> Decimal | None:
        if v is not None and v < 0:
            raise ValueError("El costo (COGS) no puede ser negativo")
        return v


class MilestoneDeliveryRegister(BaseSchema):
    """Registrar la entrega de un hito (prorrateo del anticipo)."""
    delivery_date: date | None = None
    cogs_amount: Decimal | None = None
    settlement_method: AccPaymentMethod = AccPaymentMethod.CASH

    @field_validator("cogs_amount")
    @classmethod
    def validate_cogs(cls, v: Decimal | None) -> Decimal | None:
        if v is not None and v < 0:
            raise ValueError("El costo (COGS) no puede ser negativo")
        return v


class BalancePaymentRegister(BaseSchema):
    """Registrar el cobro del saldo (CxC) de un contrato entregado a crédito."""
    receivable_id: UUID | None = None  # si None, se resuelve la CxC abierta del contrato
    amount: Decimal
    payment_method: AccPaymentMethod
    payment_date: date | None = None

    @field_validator("amount")
    @classmethod
    def validate_amount(cls, v: Decimal) -> Decimal:
        if v <= 0:
            raise ValueError("El monto del cobro debe ser mayor a 0")
        return v


class ContractCancel(BaseSchema):
    """Cancelar un contrato. `retain_deposit` define la política del anticipo."""
    retain_deposit: bool = False
    reason: str | None = None
