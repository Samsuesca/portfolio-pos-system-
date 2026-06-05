"""
Vendor Endpoints - CRUD for the normalized vendor catalog
"""
from uuid import UUID
from fastapi import APIRouter, HTTPException, status, Query, Depends

from app.api.dependencies import DatabaseSession, CurrentUser, require_global_permission
from app.api.error_responses import responses, AUTHENTICATED
from app.schemas.base import PaginatedResponse, paginate
from app.services.accounting.vendors import VendorService
from app.schemas.vendor import (
    VendorCreate,
    VendorUpdate,
    VendorResponse,
    VendorListItem,
    VendorSearchResult,
    VendorMergeRequest,
)

router = APIRouter(prefix="/vendors", tags=["Vendors"])


@router.get(
    "",
    response_model=PaginatedResponse[VendorListItem],
    dependencies=[Depends(require_global_permission("accounting.view_expenses"))],
    responses=AUTHENTICATED,
    operation_id="listVendors",
)
async def list_vendors(
    db: DatabaseSession,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    search: str | None = Query(None, description="Buscar por nombre"),
    include_inactive: bool = Query(False, description="Incluir proveedores inactivos"),
):
    service = VendorService(db)
    vendors = await service.list_vendors(
        include_inactive=include_inactive,
        search=search,
        limit=limit,
        offset=skip,
    )
    items = [
        VendorListItem(
            id=v.id,
            name=v.name,
            type=v.type,
            is_active=v.is_active,
            is_system=v.is_system,
        )
        for v in vendors
    ]
    return paginate(items, len(items), skip, limit)


@router.get(
    "/search",
    response_model=list[VendorSearchResult],
    dependencies=[Depends(require_global_permission("accounting.view_expenses"))],
    responses=AUTHENTICATED,
    operation_id="searchVendors",
)
async def search_vendors(
    db: DatabaseSession,
    q: str = Query(..., min_length=1, description="Texto de búsqueda"),
    limit: int = Query(10, ge=1, le=50),
):
    service = VendorService(db)
    vendors = await service.search_vendors(q, limit=limit)
    return [
        VendorSearchResult(id=v.id, name=v.name, type=v.type)
        for v in vendors
    ]


@router.get(
    "/{vendor_id}",
    response_model=VendorResponse,
    dependencies=[Depends(require_global_permission("accounting.view_expenses"))],
    responses=responses(404),
    operation_id="getVendor",
)
async def get_vendor(vendor_id: UUID, db: DatabaseSession):
    service = VendorService(db)
    vendor = await service.get_by_id(vendor_id)
    if not vendor:
        raise HTTPException(status_code=404, detail="Proveedor no encontrado")
    return vendor


@router.post(
    "",
    response_model=VendorResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_global_permission("accounting.manage_vendors"))],
    responses=responses(400),
    operation_id="createVendor",
)
async def create_vendor(
    data: VendorCreate,
    db: DatabaseSession,
    current_user: CurrentUser,
):
    service = VendorService(db)
    try:
        vendor = await service.create(data, created_by=current_user.id)
        await db.commit()
        return vendor
    except ValueError as e:
        await db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


@router.patch(
    "/{vendor_id}",
    response_model=VendorResponse,
    dependencies=[Depends(require_global_permission("accounting.manage_vendors"))],
    responses=responses(400, 404),
    operation_id="updateVendor",
)
async def update_vendor(
    vendor_id: UUID,
    data: VendorUpdate,
    db: DatabaseSession,
):
    service = VendorService(db)
    try:
        vendor = await service.update_vendor(vendor_id, data)
        if not vendor:
            raise HTTPException(status_code=404, detail="Proveedor no encontrado")
        await db.commit()
        return vendor
    except ValueError as e:
        await db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


@router.delete(
    "/{vendor_id}",
    response_model=VendorResponse,
    dependencies=[Depends(require_global_permission("accounting.manage_vendors"))],
    responses=responses(400, 404),
    operation_id="deactivateVendor",
)
async def deactivate_vendor(vendor_id: UUID, db: DatabaseSession):
    service = VendorService(db)
    try:
        vendor = await service.deactivate(vendor_id)
        if not vendor:
            raise HTTPException(status_code=404, detail="Proveedor no encontrado")
        await db.commit()
        return vendor
    except ValueError as e:
        await db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


@router.post(
    "/merge",
    dependencies=[Depends(require_global_permission("accounting.manage_vendors"))],
    responses=responses(400),
    operation_id="mergeVendors",
)
async def merge_vendors(data: VendorMergeRequest, db: DatabaseSession):
    service = VendorService(db)
    try:
        updated = await service.merge_vendors(data.source_ids, data.target_id)
        await db.commit()
        return {"merged": updated, "detail": f"{updated} registros actualizados"}
    except ValueError as e:
        await db.rollback()
        raise HTTPException(status_code=400, detail=str(e))
