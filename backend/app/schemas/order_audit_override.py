"""Schemas para la capa de auditoría de encargos (order_audit_overrides)."""
from uuid import UUID
from decimal import Decimal
from datetime import datetime
from pydantic import ConfigDict, Field

from app.schemas.base import BaseSchema
from app.models.order import OrderStatus
from app.models.order_audit_override import OrderAuditDisposition


class OrderAuditOverrideResponse(BaseSchema):
    """Verdad contable auditada de un encargo."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    order_id: UUID
    order_code: str
    disposition: OrderAuditDisposition
    real_status: OrderStatus | None = None
    real_paid_amount: Decimal | None = None
    real_balance: Decimal | None = None
    audit_explanation: str
    notify_client: bool
    external_evidence: str | None = None
    transaction_id: UUID | None = None
    auditor_user_id: UUID | None = None
    audited_at: datetime


class OrderAuditDecisionRequest(BaseSchema):
    """Aplicar una decisión de auditoría sobre un encargo (endpoint admin)."""

    disposition: OrderAuditDisposition
    audit_explanation: str = Field(..., min_length=3, max_length=2000)
    real_status: OrderStatus | None = Field(
        None, description="Estado real auditado; NULL conserva orders.status."
    )
    recognize_payment: Decimal | None = Field(
        None,
        gt=0,
        description=(
            "Solo PAYMENT_RETRO: monto de caja real no registrada a materializar "
            "(crea Transaction INCOME + sube paid_amount + marca CxC)."
        ),
    )
    external_evidence: str | None = Field(None, max_length=2000)
