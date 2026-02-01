"""
Alteration Schemas - Pydantic models for API validation

GLOBAL module (no school_id required)
"""
from uuid import UUID
from decimal import Decimal
from datetime import datetime, date
from pydantic import Field, model_validator

from app.schemas.base import BaseSchema, IDModelSchema
from app.models.alteration import AlterationType, AlterationStatus


# ============================================
# Alteration Schemas
# ============================================

class AlterationBase(BaseSchema):
    """Base alteration schema with common fields"""
    alteration_type: AlterationType
    garment_name: str = Field(..., min_length=1, max_length=255)
    description: str = Field(..., min_length=3)
    cost: Decimal = Field(..., gt=0)
    received_date: date
    estimated_delivery_date: date | None = None
    notes: str | None = None


class AlterationCreate(AlterationBase):
    """Schema for creating an alteration"""
    # Client options (one required)
    client_id: UUID | None = None
    external_client_name: str | None = Field(None, max_length=255)
    external_client_phone: str | None = Field(None, max_length=20)

    # Optional initial payment
    initial_payment: Decimal | None = Field(None, gt=0)
    initial_payment_method: str | None = Field(None, pattern=r'^(cash|nequi|transfer|card)$')

    @model_validator(mode='after')
    def validate_client(self):
        """Validate that either client_id or external_client_name is provided"""
        if not self.client_id and not self.external_client_name:
            raise ValueError(
                "Debe especificar un cliente registrado (client_id) o un cliente externo (external_client_name)"
            )
        if self.client_id and self.external_client_name:
            raise ValueError(
                "Especifique solo un tipo de cliente: registrado O externo"
            )
        if self.initial_payment and not self.initial_payment_method:
            raise ValueError(
                "Si especifica pago inicial, debe indicar el metodo de pago"
            )
        return self


class AlterationUpdate(BaseSchema):
    """Schema for updating an alteration"""
    alteration_type: AlterationType | None = None
    garment_name: str | None = Field(None, min_length=1, max_length=255)
    description: str | None = Field(None, min_length=3)
    cost: Decimal | None = Field(None, gt=0)
    status: AlterationStatus | None = None
    estimated_delivery_date: date | None = None
    delivered_date: date | None = None
    notes: str | None = None


class AlterationResponse(AlterationBase):
    """Full alteration response schema"""
    id: UUID
    code: str
    client_id: UUID | None
    external_client_name: str | None
    external_client_phone: str | None
    amount_paid: Decimal
    status: AlterationStatus
    delivered_date: date | None
    created_by: UUID | None
    created_at: datetime
    updated_at: datetime

    # Computed fields (from model properties)
    balance: Decimal
    is_paid: bool
    client_display_name: str


class AlterationListResponse(BaseSchema):
    """Simplified alteration for listings"""
    id: UUID
    code: str
    client_display_name: str
    alteration_type: AlterationType
    garment_name: str
    cost: Decimal
    amount_paid: Decimal
    balance: Decimal
    status: AlterationStatus
    received_date: date
    estimated_delivery_date: date | None
    is_paid: bool


class AlterationWithPayments(AlterationResponse):
    """Alteration with payment history"""
    payments: list["AlterationPaymentResponse"] = []


# ============================================
# Alteration Payment Schemas
# ============================================

class AlterationPaymentCreate(BaseSchema):
    """Schema for recording a payment"""
    amount: Decimal = Field(..., gt=0)
    payment_method: str = Field(..., pattern=r'^(cash|nequi|transfer|card)$')
    notes: str | None = None
    apply_accounting: bool = Field(
        default=True,
        description="Si es True, crea una transaccion contable"
    )
    amount_received: Decimal | None = Field(
        None, gt=0,
        description="Physical amount received from customer (only for cash)"
    )


class AlterationPaymentResponse(IDModelSchema):
    """Payment response schema"""
    alteration_id: UUID
    amount: Decimal
    payment_method: str
    notes: str | None
    transaction_id: UUID | None
    created_by: UUID | None
    created_at: datetime
    created_by_username: str | None = None
    # Cash change tracking
    amount_received: Decimal | None = None
    change_given: Decimal | None = None


# ============================================
# Statistics/Summary Schemas
# ============================================

class AlterationsSummary(BaseSchema):
    """Summary statistics for alterations dashboard"""
    total_count: int
    pending_count: int
    in_progress_count: int
    ready_count: int
    delivered_count: int
    cancelled_count: int
    total_revenue: Decimal
    total_pending_payment: Decimal
    today_received: int
    today_delivered: int


class AlterationStatusUpdate(BaseSchema):
    """Schema for updating alteration status"""
    status: AlterationStatus


# Rebuild models for forward references
AlterationWithPayments.model_rebuild()
