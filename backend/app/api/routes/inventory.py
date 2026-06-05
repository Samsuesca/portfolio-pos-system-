"""
Inventory Endpoints
"""
from uuid import UUID
from fastapi import APIRouter, HTTPException, status, Depends, Query

from app.api.dependencies import DatabaseSession, require_permission
from app.api.error_responses import responses, AUTHENTICATED
from app.schemas.product import (
    InventoryCreate, InventoryUpdate, InventoryAdjust, InventoryResponse, InventoryReport
)
from app.schemas.base import PaginatedResponse
from app.services.inventory import InventoryService


router = APIRouter(prefix="/schools/{school_id}/inventory", tags=["Inventory"])


class InventoryListResponse(PaginatedResponse[InventoryResponse]):
    pass


@router.get(
    "",
    response_model=InventoryListResponse,
    dependencies=[Depends(require_permission("inventory.view"))],
    responses=AUTHENTICATED,
    operation_id="listInventory",
)
async def list_inventory(
    school_id: UUID,
    db: DatabaseSession,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    low_stock_only: bool = Query(False, description="Only items below minimum threshold"),
):
    """List all inventory items for a school"""
    inventory_service = InventoryService(db)

    if low_stock_only:
        items = await inventory_service.get_low_stock_products(school_id)
        return InventoryListResponse(items=items, total=len(items), skip=0, limit=len(items))

    items, total = await inventory_service.list_by_school(school_id, skip=skip, limit=limit)
    return InventoryListResponse(items=items, total=total, skip=skip, limit=limit)


@router.post(
    "",
    response_model=InventoryResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission("inventory.adjust"))],
    responses=responses(400),
    operation_id="createInventory",
)
async def create_inventory(
    school_id: UUID,
    inventory_data: InventoryCreate,
    db: DatabaseSession
):
    """Create inventory for a product (requires ADMIN role)"""
    inventory_data.school_id = school_id

    inventory_service = InventoryService(db)

    try:
        inventory = await inventory_service.create_inventory(inventory_data)
        await db.commit()
        return InventoryResponse.model_validate(inventory)

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get(
    "/product/{product_id}",
    response_model=InventoryResponse,
    dependencies=[Depends(require_permission("inventory.view"))],
    responses=responses(404),
    operation_id="getProductInventory",
)
async def get_product_inventory(
    school_id: UUID,
    product_id: UUID,
    db: DatabaseSession
):
    """Get inventory for a specific product"""
    inventory_service = InventoryService(db)
    inventory = await inventory_service.get_by_product(product_id, school_id)

    if not inventory:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Inventory not found for this product"
        )

    return InventoryResponse.model_validate(inventory)


@router.post(
    "/product/{product_id}/adjust",
    response_model=InventoryResponse,
    dependencies=[Depends(require_permission("inventory.adjust"))],
    responses=responses(400, 404),
    operation_id="adjustInventory",
)
async def adjust_inventory(
    school_id: UUID,
    product_id: UUID,
    adjust_data: InventoryAdjust,
    db: DatabaseSession
):
    """
    Adjust inventory quantity (requires ADMIN role)

    Use positive values to add stock, negative to remove
    """
    inventory_service = InventoryService(db)

    try:
        inventory = await inventory_service.adjust_quantity(
            product_id, school_id, adjust_data
        )

        if not inventory:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Inventory not found"
            )

        await db.commit()
        return InventoryResponse.model_validate(inventory)

    except ValueError as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get(
    "/low-stock",
    response_model=list,
    dependencies=[Depends(require_permission("inventory.view"))],
    responses=AUTHENTICATED,
    operation_id="getLowStockProducts",
)
async def get_low_stock_products(
    school_id: UUID,
    db: DatabaseSession
):
    """Get products with stock below minimum threshold"""
    inventory_service = InventoryService(db)
    low_stock = await inventory_service.get_low_stock_products(school_id)

    return low_stock


@router.get(
    "/report",
    response_model=InventoryReport,
    dependencies=[Depends(require_permission("inventory.view"))],
    responses=AUTHENTICATED,
    operation_id="getInventoryReport",
)
async def get_inventory_report(
    school_id: UUID,
    db: DatabaseSession
):
    """Get complete inventory report with statistics"""
    inventory_service = InventoryService(db)
    report = await inventory_service.get_inventory_report(school_id)

    return report
