"""
Cost Component Routes

Manages cost breakdown templates (per GarmentType) and
cost component values (per Product).
"""
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.exc import IntegrityError

from app.api.dependencies import (
    DatabaseSession, CurrentUser,
    require_permission, require_global_permission,
)
from app.api.error_responses import responses, AUTHENTICATED
from app.services.cost_component import CostComponentService
from app.schemas.cost_component import (
    CostComponentTemplateCreate, CostComponentTemplateUpdate,
    CostComponentTemplateResponse,
    CostBreakdownUpsert,
    BulkApplyComponentRequest, BulkApplyComponentResponse,
)


router = APIRouter(tags=["Cost Components"])


# ============================================
# Templates — School Garment Types
# ============================================

@router.get(
    "/schools/{school_id}/garment-types/{garment_type_id}/cost-templates",
    response_model=list[CostComponentTemplateResponse],
    dependencies=[Depends(require_permission("inventory.view_cost"))],
    responses=AUTHENTICATED,
    operation_id="getCostTemplates",
)
async def get_cost_templates(
    school_id: UUID,
    garment_type_id: UUID,
    db: DatabaseSession,
    include_inactive: bool = Query(False, description="Incluir templates desactivados"),
):
    service = CostComponentService(db)
    templates = await service.get_templates(garment_type_id, include_inactive=include_inactive)
    return templates


@router.post(
    "/schools/{school_id}/garment-types/{garment_type_id}/cost-templates",
    response_model=CostComponentTemplateResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission("costs.manage_templates"))],
    responses=responses(400, 409),
    operation_id="createCostTemplate",
)
async def create_cost_template(
    school_id: UUID,
    garment_type_id: UUID,
    data: CostComponentTemplateCreate,
    db: DatabaseSession,
):
    service = CostComponentService(db)
    try:
        template = await service.create_template(
            garment_type_id=garment_type_id,
            name=data.name, code=data.code,
            is_variable=data.is_variable,
            display_order=data.display_order,
        )
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Ya existe un componente con codigo '{data.code}' para este tipo de prenda"
        )
    return template


@router.put(
    "/schools/{school_id}/garment-types/{garment_type_id}/cost-templates/{template_id}",
    response_model=CostComponentTemplateResponse,
    dependencies=[Depends(require_permission("costs.manage_templates"))],
    responses=responses(404),
    operation_id="updateCostTemplate",
)
async def update_cost_template(
    school_id: UUID,
    garment_type_id: UUID,
    template_id: UUID,
    data: CostComponentTemplateUpdate,
    db: DatabaseSession,
    current_user: CurrentUser,
):
    service = CostComponentService(db)
    template = await service.update_template(
        template_id,
        changed_by=current_user.id,
        name=data.name, is_variable=data.is_variable,
        display_order=data.display_order, is_active=data.is_active,
    )
    if not template:
        raise HTTPException(status_code=404, detail="Plantilla de costo no encontrada")
    await db.commit()
    return template


@router.delete(
    "/schools/{school_id}/garment-types/{garment_type_id}/cost-templates/{template_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_permission("costs.manage_templates"))],
    responses=responses(404),
    operation_id="deleteCostTemplate",
)
async def delete_cost_template(
    school_id: UUID,
    garment_type_id: UUID,
    template_id: UUID,
    db: DatabaseSession,
    current_user: CurrentUser,
):
    service = CostComponentService(db)
    if not await service.deactivate_template(template_id, changed_by=current_user.id):
        raise HTTPException(status_code=404, detail="Plantilla de costo no encontrada")
    await db.commit()


# ============================================
# Templates — Global Garment Types
# ============================================

@router.get(
    "/global-garment-types/{garment_type_id}/cost-templates",
    response_model=list[CostComponentTemplateResponse],
    dependencies=[Depends(require_global_permission("inventory.view_cost"))],
    responses=AUTHENTICATED,
    operation_id="getGlobalCostTemplates",
)
async def get_global_cost_templates(
    garment_type_id: UUID,
    db: DatabaseSession,
    include_inactive: bool = Query(False, description="Incluir templates desactivados"),
):
    service = CostComponentService(db)
    return await service.get_templates(garment_type_id, include_inactive=include_inactive)


@router.post(
    "/global-garment-types/{garment_type_id}/cost-templates",
    response_model=CostComponentTemplateResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_global_permission("costs.manage_templates"))],
    responses=responses(400, 409),
    operation_id="createGlobalCostTemplate",
)
async def create_global_cost_template(
    garment_type_id: UUID,
    data: CostComponentTemplateCreate,
    db: DatabaseSession,
):
    service = CostComponentService(db)
    try:
        template = await service.create_template(
            garment_type_id=garment_type_id,
            name=data.name, code=data.code,
            is_variable=data.is_variable,
            display_order=data.display_order,
        )
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Ya existe un componente con codigo '{data.code}' para este tipo de prenda"
        )
    return template


@router.put(
    "/global-garment-types/{garment_type_id}/cost-templates/{template_id}",
    response_model=CostComponentTemplateResponse,
    dependencies=[Depends(require_global_permission("costs.manage_templates"))],
    responses=responses(404),
    operation_id="updateGlobalCostTemplate",
)
async def update_global_cost_template(
    garment_type_id: UUID,
    template_id: UUID,
    data: CostComponentTemplateUpdate,
    db: DatabaseSession,
    current_user: CurrentUser,
):
    service = CostComponentService(db)
    template = await service.update_template(
        template_id,
        changed_by=current_user.id,
        name=data.name, is_variable=data.is_variable,
        display_order=data.display_order, is_active=data.is_active,
    )
    if not template:
        raise HTTPException(status_code=404, detail="Plantilla de costo no encontrada")
    await db.commit()
    return template


@router.delete(
    "/global-garment-types/{garment_type_id}/cost-templates/{template_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_global_permission("costs.manage_templates"))],
    responses=responses(404),
    operation_id="deleteGlobalCostTemplate",
)
async def delete_global_cost_template(
    garment_type_id: UUID,
    template_id: UUID,
    db: DatabaseSession,
    current_user: CurrentUser,
):
    service = CostComponentService(db)
    if not await service.deactivate_template(template_id, changed_by=current_user.id):
        raise HTTPException(status_code=404, detail="Plantilla de costo no encontrada")
    await db.commit()


# ============================================
# Cost Breakdown — School Products
# ============================================

@router.get(
    "/schools/{school_id}/products/{product_id}/cost-breakdown",
    dependencies=[Depends(require_permission("inventory.view_cost"))],
    responses=responses(404),
    operation_id="getProductCostBreakdown",
)
async def get_product_cost_breakdown(
    school_id: UUID,
    product_id: UUID,
    db: DatabaseSession,
):
    service = CostComponentService(db)
    try:
        return await service.get_breakdown(product_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.put(
    "/schools/{school_id}/products/{product_id}/cost-breakdown",
    dependencies=[Depends(require_permission("products.set_cost"))],
    responses=responses(404),
    operation_id="upsertProductCostBreakdown",
)
async def upsert_product_cost_breakdown(
    school_id: UUID,
    product_id: UUID,
    data: CostBreakdownUpsert,
    db: DatabaseSession,
    current_user: CurrentUser,
):
    service = CostComponentService(db)
    try:
        result = await service.upsert_breakdown(
            product_id,
            [c.model_dump() for c in data.components],
            changed_by=current_user.id,
        )
        await db.commit()
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


# ============================================
# Cost Breakdown — Global Products
# ============================================

@router.get(
    "/global-products/{product_id}/cost-breakdown",
    dependencies=[Depends(require_global_permission("inventory.view_cost"))],
    responses=responses(404),
    operation_id="getGlobalProductCostBreakdown",
)
async def get_global_product_cost_breakdown(
    product_id: UUID,
    db: DatabaseSession,
):
    service = CostComponentService(db)
    try:
        return await service.get_breakdown(product_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.put(
    "/global-products/{product_id}/cost-breakdown",
    dependencies=[Depends(require_global_permission("products.set_cost"))],
    responses=responses(404),
    operation_id="upsertGlobalProductCostBreakdown",
)
async def upsert_global_product_cost_breakdown(
    product_id: UUID,
    data: CostBreakdownUpsert,
    db: DatabaseSession,
    current_user: CurrentUser,
):
    service = CostComponentService(db)
    try:
        result = await service.upsert_breakdown(
            product_id,
            [c.model_dump() for c in data.components],
            changed_by=current_user.id,
        )
        await db.commit()
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


# ============================================
# Bulk Operations
# ============================================

@router.put(
    "/schools/{school_id}/garment-types/{garment_type_id}/bulk-cost-component",
    response_model=BulkApplyComponentResponse,
    dependencies=[Depends(require_permission("products.set_cost"))],
    responses=responses(404),
    operation_id="bulkApplyCostComponent",
)
async def bulk_apply_cost_component(
    school_id: UUID,
    garment_type_id: UUID,
    data: BulkApplyComponentRequest,
    db: DatabaseSession,
    current_user: CurrentUser,
):
    service = CostComponentService(db)
    try:
        result = await service.bulk_apply_component(
            garment_type_id=garment_type_id,
            code=data.code,
            amount=data.amount,
            notes=data.notes,
            size_deltas=[sd.model_dump() for sd in data.size_deltas],
            changed_by=current_user.id,
        )
        await db.commit()
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.put(
    "/global-garment-types/{garment_type_id}/bulk-cost-component",
    response_model=BulkApplyComponentResponse,
    dependencies=[Depends(require_global_permission("products.set_cost"))],
    responses=responses(404),
    operation_id="bulkApplyGlobalCostComponent",
)
async def bulk_apply_global_cost_component(
    garment_type_id: UUID,
    data: BulkApplyComponentRequest,
    db: DatabaseSession,
    current_user: CurrentUser,
):
    service = CostComponentService(db)
    try:
        result = await service.bulk_apply_component(
            garment_type_id=garment_type_id,
            code=data.code,
            amount=data.amount,
            notes=data.notes,
            size_deltas=[sd.model_dump() for sd in data.size_deltas],
            changed_by=current_user.id,
        )
        await db.commit()
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
