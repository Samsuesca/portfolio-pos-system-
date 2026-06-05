"""
Business Settings API Endpoints

Public endpoint to get business info, admin endpoint to update it.
"""
from fastapi import APIRouter, Depends, HTTPException, status

from app.api.dependencies import DatabaseSession, CurrentUser, require_global_permission
from app.api.error_responses import responses, AUTHENTICATED
from app.services.business_settings import BusinessSettingsService
from app.schemas.business_settings import BusinessInfoResponse, BusinessInfoUpdate


router = APIRouter(prefix="/business-info", tags=["Business Info"])


@router.get(
    "",
    response_model=BusinessInfoResponse,
    summary="Get business information",
    description="Public endpoint to get business contact info, address, hours, etc.",
    operation_id="getBusinessInfo",
)
async def get_business_info(db: DatabaseSession):
    """
    Get all business settings.

    This is a public endpoint - no authentication required.
    Returns business name, contact info, address, hours, and social links.
    """
    service = BusinessSettingsService(db)
    return await service.get_business_info()


@router.put(
    "",
    response_model=BusinessInfoResponse,
    summary="Update business information",
    description="Admin/Owner endpoint to update business configuration.",
    responses=AUTHENTICATED,
    operation_id="updateBusinessInfo",
)
async def update_business_info(
    updates: BusinessInfoUpdate,
    db: DatabaseSession,
    current_user: CurrentUser,
    _: None = Depends(require_global_permission("settings.edit_business_info")),
):
    """
    Update business settings.

    Requires `settings.edit_business_info` permission (or superuser).
    By default, only owner role and superusers have this permission.
    Custom roles with this permission are also allowed.
    Only provided fields will be updated.
    """
    service = BusinessSettingsService(db)
    result = await service.update_bulk(updates, updated_by=current_user.id)
    await db.commit()
    return result


@router.post(
    "/seed",
    response_model=dict,
    summary="Seed default settings",
    description="Initialize default business settings if they don't exist.",
    responses=AUTHENTICATED,
    operation_id="seedBusinessSettings",
)
async def seed_business_settings(
    db: DatabaseSession,
    current_user: CurrentUser
):
    """
    Seed default business settings.

    Only creates settings that don't already exist.
    Requires superuser.
    """
    if not current_user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo superusuarios pueden ejecutar el seed"
        )

    service = BusinessSettingsService(db)
    created = await service.seed_defaults()
    await db.commit()

    return {
        "message": f"Seed completado. {created} configuraciones creadas.",
        "created": created
    }
