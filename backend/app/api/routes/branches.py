"""
Branches Endpoints (GLOBAL — sucursales físicas, v3.1)

Las sucursales son un eje ortogonal al multi-tenant escolar (una sede vende
varios colegios). Recurso global: el control de acceso usa
require_global_permission ("branches.view" para leer, "branches.manage" para
escribir). Completa el retrofit de Fase 0b: el frontend (branchStore/selector)
ya consume GET /branches.
"""
import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func

from app.api.dependencies import (
    DatabaseSession,
    CurrentUser,
    require_global_permission,
)
from app.api.error_responses import responses, AUTHENTICATED
from app.schemas.base import PaginatedResponse, paginate
from app.schemas.branch import BranchCreate, BranchUpdate, BranchResponse
from app.models.branch import Branch

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/branches", tags=["Branches"])


@router.get(
    "",
    response_model=PaginatedResponse[BranchResponse],
    summary="Listar sucursales",
    responses=AUTHENTICATED,
    dependencies=[Depends(require_global_permission("branches.view"))],
)
async def list_branches(
    db: DatabaseSession,
    current_user: CurrentUser,
    active_only: bool = Query(True, description="Solo sucursales activas"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
):
    """Lista las sucursales físicas (GLOBAL)."""
    stmt = select(Branch)
    count_stmt = select(func.count()).select_from(Branch)
    if active_only:
        stmt = stmt.where(Branch.is_active.is_(True))
        count_stmt = count_stmt.where(Branch.is_active.is_(True))

    total = (await db.execute(count_stmt)).scalar_one()
    result = await db.execute(
        stmt.order_by(Branch.is_headquarters.desc(), Branch.name.asc())
        .offset(skip)
        .limit(limit)
    )
    return paginate(list(result.scalars().all()), total, skip, limit)


@router.get(
    "/{branch_id}",
    response_model=BranchResponse,
    summary="Obtener sucursal",
    responses=responses(404),
    dependencies=[Depends(require_global_permission("branches.view"))],
)
async def get_branch(
    branch_id: UUID,
    db: DatabaseSession,
    current_user: CurrentUser,
):
    branch = (
        await db.execute(select(Branch).where(Branch.id == branch_id))
    ).scalar_one_or_none()
    if not branch:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Sucursal no encontrada"
        )
    return branch


@router.post(
    "",
    response_model=BranchResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Crear sucursal",
    responses=responses(400, 409),
    dependencies=[Depends(require_global_permission("branches.manage"))],
)
async def create_branch(
    data: BranchCreate,
    db: DatabaseSession,
    current_user: CurrentUser,
):
    code = data.code.strip().upper()
    exists = (
        await db.execute(select(Branch.id).where(func.upper(Branch.code) == code))
    ).first()
    if exists:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Ya existe una sucursal con el código '{code}'",
        )
    branch = Branch(**{**data.model_dump(), "code": code})
    db.add(branch)
    await db.commit()
    await db.refresh(branch)
    return branch


@router.patch(
    "/{branch_id}",
    response_model=BranchResponse,
    summary="Actualizar sucursal",
    responses=responses(404, 409),
    dependencies=[Depends(require_global_permission("branches.manage"))],
)
async def update_branch(
    branch_id: UUID,
    data: BranchUpdate,
    db: DatabaseSession,
    current_user: CurrentUser,
):
    branch = (
        await db.execute(select(Branch).where(Branch.id == branch_id))
    ).scalar_one_or_none()
    if not branch:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Sucursal no encontrada"
        )
    payload = data.model_dump(exclude_unset=True)
    if "code" in payload and payload["code"]:
        new_code = payload["code"].strip().upper()
        clash = (
            await db.execute(
                select(Branch.id).where(
                    func.upper(Branch.code) == new_code, Branch.id != branch_id
                )
            )
        ).first()
        if clash:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Ya existe una sucursal con el código '{new_code}'",
            )
        payload["code"] = new_code
    for field, value in payload.items():
        setattr(branch, field, value)
    await db.commit()
    await db.refresh(branch)
    return branch
