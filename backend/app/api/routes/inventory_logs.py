"""
Inventory Logs Endpoints

Provides audit trail for all inventory movements.
"""
from uuid import UUID
from datetime import date
from fastapi import APIRouter, Depends, Query

from sqlalchemy import select, func

from app.api.dependencies import DatabaseSession, CurrentUser, require_permission, require_global_permission
from app.api.error_responses import responses, AUTHENTICATED
from app.schemas.base import PaginatedResponse, paginate
from app.models.inventory_log import InventoryLog as InventoryLogModel, InventoryMovementType
from app.models.product import Inventory
from app.schemas.inventory_log import (
    InventoryLogFilter,
    InventoryLogWithProduct,
    InventoryLogListResponse,
)
from app.services.inventory_log import InventoryLogService


router = APIRouter(prefix="/schools/{school_id}", tags=["Inventory Logs"])


@router.get(
    "/inventory/{product_id}/logs",
    response_model=PaginatedResponse[InventoryLogWithProduct],
    dependencies=[Depends(require_permission("inventory.view"))],
    responses=responses(404),
    operation_id="getProductInventoryLogs",
)
async def get_product_inventory_logs(
    school_id: UUID,
    product_id: UUID,
    db: DatabaseSession,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=100),
):
    """
    Get inventory movement logs for a specific school product.

    Returns paginated inventory changes for the product,
    ordered by most recent first.
    """
    inv_result = await db.execute(
        select(Inventory.id).where(
            Inventory.product_id == product_id,
            Inventory.school_id == school_id,
        )
    )
    inv_id = inv_result.scalar_one_or_none()

    if inv_id is None:
        return paginate([], 0, skip, limit)

    count_result = await db.execute(
        select(func.count(InventoryLogModel.id))
        .where(InventoryLogModel.inventory_id == inv_id)
    )
    total = count_result.scalar_one()

    log_service = InventoryLogService(db)
    logs = await log_service.get_logs_by_product(
        product_id=product_id,
        school_id=school_id,
        skip=skip,
        limit=limit,
    )
    return paginate(logs, total, skip, limit)


@router.get(
    "/inventory-logs",
    response_model=InventoryLogListResponse,
    dependencies=[Depends(require_permission("inventory.view"))],
    responses=AUTHENTICATED,
    operation_id="getSchoolInventoryLogs",
)
async def get_school_inventory_logs(
    school_id: UUID,
    db: DatabaseSession,
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    movement_type: InventoryMovementType | None = Query(default=None),
    sale_id: UUID | None = Query(default=None),
    order_id: UUID | None = Query(default=None),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=100),
):
    """
    Get all inventory movement logs for a school.

    Supports filtering by:
    - Date range (start_date, end_date)
    - Movement type (sale, order_reserve, adjustment_in, etc.)
    - Sale ID (for logs related to a specific sale)
    - Order ID (for logs related to a specific order)

    Returns paginated results with product details.
    """
    log_service = InventoryLogService(db)

    filters = InventoryLogFilter(
        start_date=start_date,
        end_date=end_date,
        movement_type=movement_type,
        sale_id=sale_id,
        order_id=order_id,
        skip=skip,
        limit=limit,
    )

    return await log_service.get_logs_by_school(
        school_id=school_id,
        filters=filters,
    )


global_router = APIRouter(prefix="/global/inventory", tags=["Global Inventory Logs"])


@global_router.get(
    "/{product_id}/logs",
    response_model=PaginatedResponse[InventoryLogWithProduct],
    dependencies=[Depends(require_global_permission("inventory.view"))],
    responses=responses(404),
    operation_id="getGlobalProductInventoryLogs",
)
async def get_global_product_inventory_logs(
    product_id: UUID,
    db: DatabaseSession,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=100),
):
    """
    Get inventory movement logs for a global product.

    Returns paginated inventory changes for the global product,
    ordered by most recent first.
    """
    inv_result = await db.execute(
        select(Inventory.id).where(
            Inventory.product_id == product_id,
            Inventory.school_id.is_(None)
        )
    )
    inv_id = inv_result.scalar_one_or_none()

    if inv_id is None:
        return paginate([], 0, skip, limit)

    count_result = await db.execute(
        select(func.count(InventoryLogModel.id))
        .where(InventoryLogModel.inventory_id == inv_id)
    )
    total = count_result.scalar_one()

    log_service = InventoryLogService(db)
    logs = await log_service.get_logs_by_product(
        product_id=product_id,
        school_id=None,
        skip=skip,
        limit=limit,
    )
    return paginate(logs, total, skip, limit)
