"""
Electronic Invoicing Schemas - Facturacion Electronica DIAN (Alegra)
"""
from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import ConfigDict, Field

from app.schemas.base import BaseSchema, IDModelSchema, TimestampSchema
from app.models.electronic_invoice import (
    InvoiceDocumentType, ElectronicInvoiceStatus,
)


class EmitInvoiceRequest(BaseSchema):
    """Request to emit an electronic invoice for a document."""
    document_type: InvoiceDocumentType = Field(..., example="sale")
    document_id: UUID = Field(..., example="550e8400-e29b-41d4-a716-446655440000")


class VoidInvoiceRequest(BaseSchema):
    """Request to annul an emitted invoice via credit note."""
    reason: str = Field(..., min_length=3, max_length=500,
                        example="Devolución total de la venta")


class ElectronicInvoiceResponse(IDModelSchema, TimestampSchema):
    """Electronic invoice for API responses."""
    document_type: InvoiceDocumentType
    sale_id: UUID | None = None
    order_id: UUID | None = None
    alteration_id: UUID | None = None

    status: ElectronicInvoiceStatus

    alegra_invoice_id: str | None = None
    full_number: str | None = None
    cufe: str | None = None
    legal_status: str | None = None
    pdf_url: str | None = None
    xml_url: str | None = None

    total: Decimal | None = None
    client_name: str | None = None
    client_identification: str | None = None

    error_message: str | None = None

    credit_note_alegra_id: str | None = None
    credit_note_number: str | None = None
    credit_note_cufe: str | None = None
    void_reason: str | None = None
    voided_at: datetime | None = None

    emitted_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)
