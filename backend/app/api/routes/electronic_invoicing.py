"""
Electronic Invoicing Endpoints - Facturacion Electronica DIAN (Alegra)

Global module (cross-school, like accounting). Emits electronic invoices
on-demand for sales, orders and alterations, supports annulment via credit
note, and exposes status / PDF-XML lookup.

All endpoints are guarded by invoicing.* global permissions.
"""
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query

from app.api.dependencies import (
    DatabaseSession, CurrentUser, require_global_permission,
)
from app.api.error_responses import responses, AUTHENTICATED
from app.models.electronic_invoice import (
    InvoiceDocumentType, ElectronicInvoiceStatus,
)
from app.schemas.base import PaginatedResponse
from app.schemas.electronic_invoicing import (
    EmitInvoiceRequest, VoidInvoiceRequest, ElectronicInvoiceResponse,
)
from app.services.electronic_invoicing import (
    ElectronicInvoicingService, ElectronicInvoicingError,
)

router = APIRouter(prefix="/global/electronic-invoicing", tags=["Electronic Invoicing"])


def _raise(err: ElectronicInvoicingError) -> None:
    raise HTTPException(status_code=err.status_code, detail=err.message)


@router.post(
    "/emit",
    response_model=ElectronicInvoiceResponse,
    status_code=201,
    dependencies=[Depends(require_global_permission("invoicing.emit"))],
    responses=responses(400, 404, 409),
    operation_id="emitElectronicInvoice",
)
async def emit_electronic_invoice(
    data: EmitInvoiceRequest,
    db: DatabaseSession,
    current_user: CurrentUser,
):
    """
    Emite una factura electrónica DIAN (vía Alegra) para un documento.

    **Auth:** Bearer JWT · **Permission:** `invoicing.emit` (global)

    El `document_type` es uno de `sale | order | alteration`. Es idempotente:
    si el documento ya tiene factura emitida, retorna 409.
    """
    service = ElectronicInvoicingService(db)
    try:
        invoice = await service.emit(data.document_type, data.document_id, current_user.id)
    except ElectronicInvoicingError as err:
        _raise(err)
    return invoice


@router.post(
    "/{invoice_id}/void",
    response_model=ElectronicInvoiceResponse,
    dependencies=[Depends(require_global_permission("invoicing.void"))],
    responses=responses(400, 404, 409),
    operation_id="voidElectronicInvoice",
)
async def void_electronic_invoice(
    invoice_id: UUID,
    data: VoidInvoiceRequest,
    db: DatabaseSession,
    current_user: CurrentUser,
):
    """
    Anula una factura electrónica emitida generando una nota crédito DIAN.

    **Auth:** Bearer JWT · **Permission:** `invoicing.void` (global)
    """
    service = ElectronicInvoicingService(db)
    try:
        invoice = await service.void(invoice_id, data.reason, current_user.id)
    except ElectronicInvoicingError as err:
        _raise(err)
    return invoice


@router.post(
    "/{invoice_id}/refresh-files",
    response_model=ElectronicInvoiceResponse,
    dependencies=[Depends(require_global_permission("invoicing.view"))],
    responses=responses(404, 409),
    operation_id="refreshElectronicInvoiceFiles",
)
async def refresh_electronic_invoice_files(
    invoice_id: UUID,
    db: DatabaseSession,
):
    """
    Re-consulta a Alegra las URLs de PDF/XML (que a veces se generan con retraso).

    **Auth:** Bearer JWT · **Permission:** `invoicing.view` (global)
    """
    service = ElectronicInvoicingService(db)
    try:
        invoice = await service.refresh_files(invoice_id)
    except ElectronicInvoicingError as err:
        _raise(err)
    return invoice


@router.get(
    "/by-document/{document_type}/{document_id}",
    response_model=ElectronicInvoiceResponse | None,
    dependencies=[Depends(require_global_permission("invoicing.view"))],
    responses=AUTHENTICATED,
    operation_id="getElectronicInvoiceByDocument",
)
async def get_invoice_by_document(
    document_type: InvoiceDocumentType,
    document_id: UUID,
    db: DatabaseSession,
):
    """
    Retorna la factura electrónica de un documento (o `null` si no tiene).

    Útil para que la UI sepa si mostrar "Facturar" o el estado actual.

    **Auth:** Bearer JWT · **Permission:** `invoicing.view` (global)
    """
    service = ElectronicInvoicingService(db)
    return await service.get_for_document(document_type, document_id)


@router.get(
    "/{invoice_id}",
    response_model=ElectronicInvoiceResponse,
    dependencies=[Depends(require_global_permission("invoicing.view"))],
    responses=responses(404),
    operation_id="getElectronicInvoice",
)
async def get_electronic_invoice(
    invoice_id: UUID,
    db: DatabaseSession,
):
    """
    Detalle de una factura electrónica.

    **Auth:** Bearer JWT · **Permission:** `invoicing.view` (global)
    """
    service = ElectronicInvoicingService(db)
    invoice = await service.get(invoice_id)
    if invoice is None:
        raise HTTPException(status_code=404, detail="Factura no encontrada")
    return invoice


@router.get(
    "",
    response_model=PaginatedResponse[ElectronicInvoiceResponse],
    dependencies=[Depends(require_global_permission("invoicing.view"))],
    responses=AUTHENTICATED,
    operation_id="listElectronicInvoices",
)
async def list_electronic_invoices(
    db: DatabaseSession,
    status: ElectronicInvoiceStatus | None = Query(None),
    document_type: InvoiceDocumentType | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
):
    """
    Lista facturas electrónicas con filtros opcionales por estado y tipo.

    **Auth:** Bearer JWT · **Permission:** `invoicing.view` (global)
    """
    service = ElectronicInvoicingService(db)
    items, total = await service.list_invoices(
        status=status, document_type=document_type, skip=skip, limit=limit
    )
    return PaginatedResponse(items=items, total=total, skip=skip, limit=limit)
