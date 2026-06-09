"""
B2B Quotations Endpoints (GLOBAL/corporativo — sin school_id)

Cotizaciones empresariales con numeración formal COT-YYYY-NNNN, workflow de
estados (FSM) y conversión a contrato (CTR-YYYY-NNNN). B2B es un tercer eje
global: NO hay scoping por colegio; el control de acceso usa
require_global_permission.
"""
import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import HTMLResponse

from app.api.dependencies import (
    DatabaseSession,
    CurrentUser,
    require_global_permission,
)
from app.api.error_responses import responses, AUTHENTICATED
from app.schemas.base import PaginatedResponse, paginate
from app.schemas.b2b import (
    QuotationCreate,
    QuotationUpdate,
    QuotationStatusUpdate,
    QuotationItemCreate,
    QuotationResponse,
    QuotationListResponse,
    ContractResponse,
)
from app.models.b2b import QuotationStatus
from app.services.quotation import QuotationService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/b2b/quotations", tags=["B2B Quotations"])


@router.get(
    "",
    response_model=PaginatedResponse[QuotationListResponse],
    summary="Listar cotizaciones B2B",
    responses=AUTHENTICATED,
    dependencies=[Depends(require_global_permission("b2b.view"))],
)
async def list_quotations(
    db: DatabaseSession,
    current_user: CurrentUser,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    status_filter: QuotationStatus | None = Query(
        None, alias="status", description="Filtrar por estado"
    ),
    b2b_client_id: UUID | None = Query(None, description="Filtrar por cliente B2B"),
    branch_id: UUID | None = Query(None, description="Filtrar por sucursal"),
    search: str | None = Query(None, description="Buscar por número de cotización"),
):
    """Lista cotizaciones B2B (GLOBAL) con filtros y paginación."""
    service = QuotationService(db)
    items, total = await service.list_quotations(
        skip=skip,
        limit=limit,
        status=status_filter,
        b2b_client_id=b2b_client_id,
        branch_id=branch_id,
        search=search,
    )
    return paginate(items, total, skip, limit)


@router.get(
    "/{quotation_id}",
    response_model=QuotationResponse,
    summary="Obtener cotización B2B",
    responses=responses(404),
    dependencies=[Depends(require_global_permission("b2b.view"))],
)
async def get_quotation(
    quotation_id: UUID,
    db: DatabaseSession,
    current_user: CurrentUser,
):
    """Obtiene una cotización con sus ítems y cliente."""
    service = QuotationService(db)
    quotation = await service.get_quotation_with_items(quotation_id)
    if not quotation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cotización no encontrada",
        )
    return quotation


@router.post(
    "",
    response_model=QuotationResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Crear cotización B2B",
    responses=responses(400),
    dependencies=[Depends(require_global_permission("b2b.manage_quotations"))],
)
async def create_quotation(
    data: QuotationCreate,
    db: DatabaseSession,
    current_user: CurrentUser,
):
    """Crea una cotización en borrador. Totales computados server-side."""
    service = QuotationService(db)
    try:
        quotation = await service.create_quotation(data, user_id=current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    await db.commit()
    return await service.get_quotation_with_items(quotation.id)


@router.put(
    "/{quotation_id}",
    response_model=QuotationResponse,
    summary="Editar cabecera de cotización B2B",
    responses=responses(400, 404),
    dependencies=[Depends(require_global_permission("b2b.manage_quotations"))],
)
async def update_quotation(
    quotation_id: UUID,
    data: QuotationUpdate,
    db: DatabaseSession,
    current_user: CurrentUser,
):
    """Edita la cabecera. Solo permitido en estado borrador."""
    service = QuotationService(db)
    try:
        quotation = await service.update_quotation(quotation_id, data)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    if not quotation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cotización no encontrada",
        )
    await db.commit()
    return await service.get_quotation_with_items(quotation.id)


@router.put(
    "/{quotation_id}/items",
    response_model=QuotationResponse,
    summary="Reemplazar ítems de cotización B2B",
    responses=responses(400, 404),
    dependencies=[Depends(require_global_permission("b2b.manage_quotations"))],
)
async def replace_quotation_items(
    quotation_id: UUID,
    items: list[QuotationItemCreate],
    db: DatabaseSession,
    current_user: CurrentUser,
):
    """Reemplaza todos los ítems y recomputa totales. Solo en borrador."""
    if not items:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La cotización debe tener al menos un ítem",
        )
    service = QuotationService(db)
    try:
        quotation = await service.replace_items(quotation_id, items)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    if not quotation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cotización no encontrada",
        )
    await db.commit()
    return await service.get_quotation_with_items(quotation.id)


@router.patch(
    "/{quotation_id}/status",
    response_model=QuotationResponse,
    summary="Cambiar estado de cotización B2B",
    responses=responses(400, 404),
    dependencies=[Depends(require_global_permission("b2b.manage_quotations"))],
)
async def update_quotation_status(
    quotation_id: UUID,
    data: QuotationStatusUpdate,
    db: DatabaseSession,
    current_user: CurrentUser,
):
    """Aplica una transición de estado validada por la FSM."""
    service = QuotationService(db)
    try:
        quotation = await service.update_status(quotation_id, data.status)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    if not quotation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cotización no encontrada",
        )
    await db.commit()
    return await service.get_quotation_with_items(quotation.id)


@router.post(
    "/{quotation_id}/convert",
    response_model=ContractResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Convertir cotización aceptada a contrato",
    responses=responses(400, 404, 409),
    dependencies=[Depends(require_global_permission("b2b.manage_contracts"))],
)
async def convert_to_contract(
    quotation_id: UUID,
    db: DatabaseSession,
    current_user: CurrentUser,
):
    """Crea un contrato pending_deposit desde una cotización aceptada."""
    service = QuotationService(db)
    try:
        contract = await service.convert_to_contract(
            quotation_id, user_id=current_user.id
        )
    except ValueError as e:
        message = str(e)
        if message == "Cotización no encontrada":
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail=message
            )
        # "ya tiene un contrato asociado" / "Solo se pueden convertir aceptadas"
        # son conflictos de estado del recurso → 409.
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=message)
    await db.commit()
    # Re-fetch vía ContractService para devolver el contrato enriquecido
    # (client_name + outstanding_balance), consistente con los demás endpoints.
    from app.services.contract import ContractService

    return await ContractService(db).get_contract_with_milestones(contract.id)


@router.get(
    "/{quotation_id}/document",
    response_class=HTMLResponse,
    summary="Documento comercial HTML de la cotización",
    responses=responses(404),
    dependencies=[Depends(require_global_permission("b2b.view"))],
)
async def get_quotation_document(
    quotation_id: UUID,
    db: DatabaseSession,
    current_user: CurrentUser,
):
    """Documento A4 self-contained para imprimir/guardar como PDF (Ctrl+P)."""
    service = QuotationService(db)
    html = await service.generate_quotation_html(quotation_id)
    if not html:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cotización no encontrada",
        )
    return HTMLResponse(content=html)
