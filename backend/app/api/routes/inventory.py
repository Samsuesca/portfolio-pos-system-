"""
Inventory Endpoints
"""
from uuid import UUID
from fastapi import APIRouter, HTTPException, status, Depends

from app.api.dependencies import DatabaseSession, require_school_access
from app.models.user import UserRole
from app.schemas.product import (
    InventoryCreate, InventoryUpdate, InventoryAdjust, InventoryResponse, InventoryReport
)
from app.services.inventory import InventoryService


router = APIRouter(prefix="/schools/{school_id}/inventory", tags=["Inventory"])


@router.post(
    "",
    response_model=InventoryResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_school_access(UserRole.ADMIN))]
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
    dependencies=[Depends(require_school_access(UserRole.VIEWER))]
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
    dependencies=[Depends(require_school_access(UserRole.ADMIN))]
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
    dependencies=[Depends(require_school_access(UserRole.VIEWER))]
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
    dependencies=[Depends(require_school_access(UserRole.VIEWER))]
)
async def get_inventory_report(
    school_id: UUID,
    db: DatabaseSession
):
    """Get complete inventory report with statistics"""
    inventory_service = InventoryService(db)
    report = await inventory_service.get_inventory_report(school_id)

    return report
