"""
B2B Clients Endpoints (GLOBAL/corporativo — sin school_id)

Gestión de clientes empresariales (NIT, segmento, términos de pago, cupo de
crédito) que son la contraparte de cotizaciones y contratos B2B. Recurso
global: leer requiere "b2b.view" (para que el vendedor pueda elegir cliente al
cotizar); crear/editar requiere "b2b.manage_clients" (ADMIN+).
"""
import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func, or_

from app.api.dependencies import (
    DatabaseSession,
    CurrentUser,
    require_global_permission,
)
from app.api.error_responses import responses, AUTHENTICATED
from app.schemas.base import PaginatedResponse, paginate
from app.schemas.b2b import B2BClientCreate, B2BClientUpdate, B2BClientResponse
from app.models.b2b import B2BClient

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/b2b/clients", tags=["B2B Clients"])


async def _tax_id_clash(db, tax_id: str, exclude_id: UUID | None = None) -> bool:
    stmt = select(B2BClient.id).where(B2BClient.tax_id == tax_id.strip())
    if exclude_id is not None:
        stmt = stmt.where(B2BClient.id != exclude_id)
    return (await db.execute(stmt)).first() is not None


@router.get(
    "",
    response_model=PaginatedResponse[B2BClientResponse],
    summary="Listar clientes B2B",
    responses=AUTHENTICATED,
    dependencies=[Depends(require_global_permission("b2b.view"))],
)
async def list_clients(
    db: DatabaseSession,
    current_user: CurrentUser,
    active_only: bool = Query(True, description="Solo clientes activos"),
    search: str | None = Query(None, description="Buscar por nombre o NIT"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
):
    """Lista los clientes empresariales (GLOBAL)."""
    stmt = select(B2BClient)
    count_stmt = select(func.count()).select_from(B2BClient)
    filters = []
    if active_only:
        filters.append(B2BClient.is_active.is_(True))
    if search:
        like = f"%{search.strip()}%"
        filters.append(
            or_(
                B2BClient.legal_name.ilike(like),
                B2BClient.trade_name.ilike(like),
                B2BClient.tax_id.ilike(like),
            )
        )
    for f in filters:
        stmt = stmt.where(f)
        count_stmt = count_stmt.where(f)

    total = (await db.execute(count_stmt)).scalar_one()
    result = await db.execute(
        stmt.order_by(B2BClient.legal_name.asc()).offset(skip).limit(limit)
    )
    return paginate(list(result.scalars().all()), total, skip, limit)


@router.get(
    "/{client_id}",
    response_model=B2BClientResponse,
    summary="Obtener cliente B2B",
    responses=responses(404),
    dependencies=[Depends(require_global_permission("b2b.view"))],
)
async def get_client(
    client_id: UUID,
    db: DatabaseSession,
    current_user: CurrentUser,
):
    client = (
        await db.execute(select(B2BClient).where(B2BClient.id == client_id))
    ).scalar_one_or_none()
    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Cliente B2B no encontrado"
        )
    return client


@router.post(
    "",
    response_model=B2BClientResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Crear cliente B2B",
    responses=responses(400, 409),
    dependencies=[Depends(require_global_permission("b2b.manage_clients"))],
)
async def create_client(
    data: B2BClientCreate,
    db: DatabaseSession,
    current_user: CurrentUser,
):
    if await _tax_id_clash(db, data.tax_id):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Ya existe un cliente B2B con el NIT '{data.tax_id.strip()}'",
        )
    client = B2BClient(**data.model_dump())
    db.add(client)
    await db.commit()
    await db.refresh(client)
    return client


@router.patch(
    "/{client_id}",
    response_model=B2BClientResponse,
    summary="Actualizar cliente B2B",
    responses=responses(404, 409),
    dependencies=[Depends(require_global_permission("b2b.manage_clients"))],
)
async def update_client(
    client_id: UUID,
    data: B2BClientUpdate,
    db: DatabaseSession,
    current_user: CurrentUser,
):
    client = (
        await db.execute(select(B2BClient).where(B2BClient.id == client_id))
    ).scalar_one_or_none()
    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Cliente B2B no encontrado"
        )
    payload = data.model_dump(exclude_unset=True)
    if payload.get("tax_id") and await _tax_id_clash(db, payload["tax_id"], exclude_id=client_id):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Ya existe un cliente B2B con el NIT '{payload['tax_id'].strip()}'",
        )
    for field, value in payload.items():
        setattr(client, field, value)
    await db.commit()
    await db.refresh(client)
    return client
