"""
Cost Change Log Routes — historial paginado de cambios de costo por producto.

Gated por `inventory.view_cost`: quien puede ver costos puede ver cómo
cambiaron. Mismo nivel de sensibilidad (no se crea permiso aparte).
"""
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.dependencies import (
    DatabaseSession, require_permission, require_global_permission,
)
from app.api.error_responses import responses, AUTHENTICATED
from app.schemas.base import PaginatedResponse, paginate
from app.schemas.cost_change_log import CostChangeLogResponse
from app.services.cost_change_log import CostChangeLogService


router = APIRouter(tags=["Cost Change Log"])


def _to_response(log) -> CostChangeLogResponse:
    """Construye el response denormalizando template y changed_by_user."""
    return CostChangeLogResponse(
        id=log.id,
        product_id=log.product_id,
        template_id=log.template_id,
        template_name=log.template.name if log.template else None,
        template_code=log.template.code if log.template else None,
        product_cost_component_id=log.product_cost_component_id,
        school_id=log.school_id,
        change_type=log.change_type,
        amount_before=log.amount_before,
        amount_after=log.amount_after,
        notes_before=log.notes_before,
        notes_after=log.notes_after,
        reason=log.reason,
        changed_by=log.changed_by,
        changed_by_name=(
            (log.changed_by_user.full_name or log.changed_by_user.username)
            if log.changed_by_user else None
        ),
        created_at=log.created_at,
    )


@router.get(
    "/schools/{school_id}/products/{product_id}/cost-history",
    response_model=PaginatedResponse[CostChangeLogResponse],
    dependencies=[Depends(require_permission("inventory.view_cost"))],
    responses=AUTHENTICATED,
    operation_id="getProductCostHistory",
)
async def get_product_cost_history(
    school_id: UUID,
    product_id: UUID,
    db: DatabaseSession,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
):
    """Historial de cambios de costo de un producto (más recientes primero)."""
    service = CostChangeLogService(db)
    logs, total = await service.get_product_history(product_id, skip=skip, limit=limit)
    items = [_to_response(log) for log in logs]
    return PaginatedResponse[CostChangeLogResponse](**paginate(items, total, skip, limit))


@router.get(
    "/global-products/{product_id}/cost-history",
    response_model=PaginatedResponse[CostChangeLogResponse],
    dependencies=[Depends(require_global_permission("inventory.view_cost"))],
    responses=AUTHENTICATED,
    operation_id="getGlobalProductCostHistory",
)
async def get_global_product_cost_history(
    product_id: UUID,
    db: DatabaseSession,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
):
    """Historial de cambios de costo de un producto global."""
    service = CostChangeLogService(db)
    logs, total = await service.get_product_history(product_id, skip=skip, limit=limit)
    items = [_to_response(log) for log in logs]
    return PaginatedResponse[CostChangeLogResponse](**paginate(items, total, skip, limit))
