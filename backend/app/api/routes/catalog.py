"""
Catalog Routes - Positions (and future: sizes, colors)
"""
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.api.dependencies import require_global_permission, CurrentUser
from app.services.position import PositionService
from app.schemas.position import (
    PositionCreate,
    PositionUpdate,
    PositionResponse,
)

router = APIRouter(prefix="/global/catalog", tags=["Catalog"])


# ── Positions ──

@router.get(
    "/positions",
    response_model=list[PositionResponse],
    dependencies=[Depends(require_global_permission("catalog.view"))],
)
async def list_positions(
    include_inactive: bool = Query(False),
    db: AsyncSession = Depends(get_db),
):
    service = PositionService(db)
    return await service.list_positions(include_inactive=include_inactive)


@router.get(
    "/positions/{position_id}",
    response_model=PositionResponse,
    dependencies=[Depends(require_global_permission("catalog.view"))],
)
async def get_position(
    position_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    service = PositionService(db)
    position = await service.get_position(position_id)
    if not position:
        raise HTTPException(status_code=404, detail="Posición no encontrada")
    return position


@router.post(
    "/positions",
    response_model=PositionResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_global_permission("catalog.manage"))],
)
async def create_position(
    data: PositionCreate,
    db: AsyncSession = Depends(get_db),
):
    service = PositionService(db)
    try:
        return await service.create_position(data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.patch(
    "/positions/{position_id}",
    response_model=PositionResponse,
    dependencies=[Depends(require_global_permission("catalog.manage"))],
)
async def update_position(
    position_id: UUID,
    data: PositionUpdate,
    db: AsyncSession = Depends(get_db),
):
    service = PositionService(db)
    try:
        result = await service.update_position(position_id, data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    if not result:
        raise HTTPException(status_code=404, detail="Posición no encontrada")
    return result


@router.delete(
    "/positions/{position_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_global_permission("catalog.manage"))],
)
async def delete_position(
    position_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    service = PositionService(db)
    if not await service.delete_position(position_id):
        raise HTTPException(status_code=404, detail="Posición no encontrada")
