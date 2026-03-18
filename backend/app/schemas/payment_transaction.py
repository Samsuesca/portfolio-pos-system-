"""
Payment Transaction Schemas - Wompi Payment Gateway
"""
from uuid import UUID
from datetime import datetime
from pydantic import BaseModel, model_validator


class PaymentSessionCreate(BaseModel):
    """Request to create a Wompi payment session"""
    order_id: UUID | None = None
    receivable_id: UUID | None = None

    @model_validator(mode="after")
    def validate_exactly_one_target(self):
        if not self.order_id and not self.receivable_id:
            raise ValueError("Debe especificar order_id o receivable_id")
        if self.order_id and self.receivable_id:
            raise ValueError("Solo puede especificar order_id o receivable_id, no ambos")
        return self


class PaymentSessionResponse(BaseModel):
    """Data needed by frontend to redirect to Wompi checkout"""
    reference: str
    amount_in_cents: int
    currency: str
    public_key: str
    integrity_signature: str
    redirect_url: str
    description: str

    model_config = {"from_attributes": True}


class PaymentStatusResponse(BaseModel):
    """Payment status check response"""
    reference: str
    status: str
    amount_in_cents: int
    payment_method_type: str | None = None
    order_id: UUID | None = None
    receivable_id: UUID | None = None
    created_at: datetime
    completed_at: datetime | None = None

    model_config = {"from_attributes": True}


class PaymentTransactionResponse(BaseModel):
    """Full payment transaction details"""
    id: UUID
    reference: str
    wompi_transaction_id: str | None = None
    order_id: UUID | None = None
    receivable_id: UUID | None = None
    amount_in_cents: int
    currency: str
    status: str
    payment_method_type: str | None = None
    status_message: str | None = None
    wompi_fee_cents: int | None = None
    wompi_fee_tax_cents: int | None = None
    accounting_applied: bool
    created_at: datetime
    completed_at: datetime | None = None

    model_config = {"from_attributes": True}
