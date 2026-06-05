"""
Alteration Schemas - Pydantic models for API validation

GLOBAL module (no school_id required)
"""
from uuid import UUID
from decimal import Decimal
from datetime import datetime, date
from pydantic import ConfigDict, Field, model_validator

from app.schemas.base import BaseSchema, IDModelSchema
from app.models.alteration import AlterationType, AlterationStatus


# ============================================
# Alteration Schemas
# ============================================

class AlterationBase(BaseSchema):
    """Base alteration schema with common fields"""
    alteration_type: AlterationType
    garment_name: str = Field(..., min_length=1, max_length=255, example="Pantalón escolar azul")
    description: str = Field(..., min_length=3, example="Subir dobladillo 3cm en ambas piernas")
    cost: Decimal = Field(..., gt=0, example=25000.00)
    received_date: date
    estimated_delivery_date: date | None = None
    notes: str | None = None


class AlterationCreate(AlterationBase):
    """Schema for creating an alteration"""
    client_id: UUID

    # Optional initial payment
    initial_payment: Decimal | None = Field(None, gt=0, example=15000.00)
    initial_payment_method: str | None = Field(None, pattern=r'^(cash|nequi|transfer|card)$', example="cash")

    @model_validator(mode='after')
    def validate_initial_payment(self):
        if self.initial_payment and not self.initial_payment_method:
            raise ValueError(
                "Si especifica pago inicial, debe indicar el metodo de pago"
            )
        return self


class AlterationUpdate(BaseSchema):
    """Schema for updating an alteration"""
    alteration_type: AlterationType | None = None
    garment_name: str | None = Field(None, min_length=1, max_length=255, example="Falda escolar gris")
    description: str | None = Field(None, min_length=3, example="Ajustar cintura 2cm")
    cost: Decimal | None = Field(None, gt=0, example=30000.00)
    status: AlterationStatus | None = None
    estimated_delivery_date: date | None = None
    delivered_date: date | None = None
    notes: str | None = None


class AlterationResponse(AlterationBase):
    """Full alteration response schema"""
    model_config = ConfigDict(
        from_attributes=True,
        json_schema_extra={
            "example": {
                "id": "550e8400-e29b-41d4-a716-446655440000",
                "code": "ALT-20260412-001",
                "alteration_type": "hem",
                "garment_name": "Pantalón escolar azul",
                "description": "Subir dobladillo 3cm en ambas piernas",
                "cost": 25000.00,
                "received_date": "2026-04-10",
                "estimated_delivery_date": "2026-04-15",
                "notes": None,
                "client_id": "990e8400-e29b-41d4-a716-446655440000",
                "amount_paid": 15000.00,
                "status": "pending",
                "delivered_date": None,
                "created_by": "660e8400-e29b-41d4-a716-446655440000",
                "created_at": "2026-04-10T09:30:00",
                "updated_at": "2026-04-10T09:30:00",
                "balance": 10000.00,
                "is_paid": False,
                "client_display_name": "Laura Sánchez",
            }
        },
    )

    id: UUID
    code: str
    client_id: UUID
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
    amount: Decimal = Field(..., gt=0, example=10000.00)
    payment_method: str = Field(..., pattern=r'^(cash|nequi|transfer|card)$', example="cash")
    notes: str | None = None
    apply_accounting: bool = Field(
        default=True,
        description="Si es True, crea una transaccion contable"
    )
    amount_received: Decimal | None = Field(
        None, gt=0, example=20000.00,
        description="Physical amount received from customer (only for cash)"
    )


class AlterationPaymentResponse(IDModelSchema):
    """Payment response schema"""
    model_config = ConfigDict(
        from_attributes=True,
        json_schema_extra={
            "example": {
                "id": "770e8400-e29b-41d4-a716-446655440000",
                "alteration_id": "550e8400-e29b-41d4-a716-446655440000",
                "amount": 10000.00,
                "payment_method": "cash",
                "notes": "Abono parcial",
                "transaction_id": "880e8400-e29b-41d4-a716-446655440000",
                "created_by": "660e8400-e29b-41d4-a716-446655440000",
                "created_at": "2026-04-12T14:00:00",
                "created_by_username": "andrea.torres",
                "amount_received": 20000.00,
                "change_given": 10000.00,
            }
        },
    )

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
    """Summary statistics for alterations dashboard.

    `total_revenue` and `total_pending_payment` are gated by the
    `alterations.view_revenue` permission and arrive as `None` when the
    caller is not authorized to see aggregated financial figures.

    Fase 2 (Reports Coverage): adds optional `period_start` / `period_end`
    plus `*_in_period` fields. When the caller passes date filters, the
    counts apply to alterations *received* in the window, and
    `revenue_in_period` sums `AlterationPayment.amount` whose
    `created_at` lies in the window (cash basis, aligned with the caja
    drawer). When no dates are passed, the legacy fields keep their
    all-time semantics — the dashboard widget that calls `getSummary()`
    with no arguments continues to work unchanged.
    """
    total_count: int
    pending_count: int
    in_progress_count: int
    ready_count: int
    delivered_count: int
    cancelled_count: int
    total_revenue: Decimal | None = None
    total_pending_payment: Decimal | None = None
    today_received: int
    today_delivered: int
    # Fase 2 — date-filter aware fields. Null when no period is filtered.
    period_start: date | None = None
    period_end: date | None = None
    revenue_in_period: Decimal | None = None
    received_in_period: int | None = None
    delivered_in_period: int | None = None


class AlterationStatusUpdate(BaseSchema):
    """Schema for updating alteration status"""
    status: AlterationStatus


# Rebuild models for forward references
AlterationWithPayments.model_rebuild()
