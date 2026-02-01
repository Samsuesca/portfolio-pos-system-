"""
Business Settings API Endpoints

Public endpoint to get business info, admin endpoint to update it.
"""
from fastapi import APIRouter, HTTPException, status

from app.api.dependencies import DatabaseSession, CurrentUser
from app.models.user import UserRole
from app.services.business_settings import BusinessSettingsService
from app.services.permission import SYSTEM_ROLE_PERMISSIONS
from app.schemas.business_settings import BusinessInfoResponse, BusinessInfoUpdate

# Permission code for editing business info
PERMISSION_EDIT_BUSINESS_INFO = "settings.edit_business_info"


router = APIRouter(prefix="/business-info", tags=["Business Info"])


@router.get(
    "",
    response_model=BusinessInfoResponse,
    summary="Get business information",
    description="Public endpoint to get business contact info, address, hours, etc."
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
    description="Admin/Owner endpoint to update business configuration."
)
async def update_business_info(
    updates: BusinessInfoUpdate,
    db: DatabaseSession,
    current_user: CurrentUser
):
    """
    Update business settings.

    Requires `settings.edit_business_info` permission (or superuser).
    By default, only owner role and superusers have this permission.
    Only provided fields will be updated.
    """
    # Check permissions - must be superuser or have settings.edit_business_info permission
    if not current_user.is_superuser:
        has_permission = False

        for role in current_user.school_roles:
            if role.role:
                # Check system role permissions
                role_perms = SYSTEM_ROLE_PERMISSIONS.get(role.role)
                if role_perms is None:
                    # Owner gets all permissions
                    has_permission = True
                    break
                elif PERMISSION_EDIT_BUSINESS_INFO in role_perms:
                    has_permission = True
                    break
            # TODO: Check custom_role permissions if needed

        if not has_permission:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tienes permiso para modificar la información del negocio"
            )

    service = BusinessSettingsService(db)
    result = await service.update_bulk(updates, updated_by=current_user.id)
    await db.commit()
    return result


@router.post(
    "/seed",
    response_model=dict,
    summary="Seed default settings",
    description="Initialize default business settings if they don't exist."
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
