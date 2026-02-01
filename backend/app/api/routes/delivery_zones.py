"""
Delivery Zones API Endpoints

Endpoints for managing delivery zones and their fees.
- Public endpoint for web portal to list active zones
- Admin endpoints for CRUD operations
"""
from uuid import UUID
from fastapi import APIRouter, HTTPException, status, Query, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import (
    DatabaseSession,
    CurrentUser,
    require_superuser,
)
from app.models.delivery_zone import DeliveryZone
from app.schemas.delivery_zone import (
    DeliveryZoneCreate,
    DeliveryZoneUpdate,
    DeliveryZoneResponse,
    DeliveryZonePublic,
)


router = APIRouter(prefix="/delivery-zones", tags=["Delivery Zones"])


# ============================================
# Public Endpoints (for web portal - no auth)
# ============================================

@router.get(
    "/public",
    response_model=list[DeliveryZonePublic],
    summary="List active delivery zones (public)",
)
async def list_public_zones(db: DatabaseSession):
    """
    List active delivery zones for web portal.

    Public endpoint - no authentication required.
    Only returns zones where is_active=True.
    """
    result = await db.execute(
        select(DeliveryZone)
        .where(DeliveryZone.is_active == True)
        .order_by(DeliveryZone.name)
    )
    zones = result.scalars().all()
    return [DeliveryZonePublic.model_validate(z) for z in zones]


# ============================================
# Admin Endpoints (require authentication)
# ============================================

@router.get(
    "",
    response_model=list[DeliveryZoneResponse],
    summary="List all delivery zones",
)
async def list_zones(
    db: DatabaseSession,
    current_user: CurrentUser,
    include_inactive: bool = Query(False, description="Include inactive zones"),
):
    """
    List all delivery zones.

    Requires authentication.
    By default only returns active zones, use include_inactive=true to see all.
    """
    query = select(DeliveryZone).order_by(DeliveryZone.name)
    if not include_inactive:
        query = query.where(DeliveryZone.is_active == True)

    result = await db.execute(query)
    zones = result.scalars().all()
    return [DeliveryZoneResponse.model_validate(z) for z in zones]


@router.post(
    "",
    response_model=DeliveryZoneResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_superuser)],
    summary="Create delivery zone",
)
async def create_zone(
    zone_data: DeliveryZoneCreate,
    db: DatabaseSession,
):
    """
    Create a new delivery zone.

    Requires superuser access.
    """
    zone = DeliveryZone(**zone_data.model_dump())
    db.add(zone)
    await db.commit()
    await db.refresh(zone)
    return DeliveryZoneResponse.model_validate(zone)


@router.get(
    "/{zone_id}",
    response_model=DeliveryZoneResponse,
    summary="Get delivery zone",
)
async def get_zone(
    zone_id: UUID,
    db: DatabaseSession,
    current_user: CurrentUser,
):
    """
    Get delivery zone by ID.

    Requires authentication.
    """
    result = await db.execute(
        select(DeliveryZone).where(DeliveryZone.id == zone_id)
    )
    zone = result.scalar_one_or_none()

    if not zone:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Zona de envío no encontrada",
        )

    return DeliveryZoneResponse.model_validate(zone)


@router.patch(
    "/{zone_id}",
    response_model=DeliveryZoneResponse,
    dependencies=[Depends(require_superuser)],
    summary="Update delivery zone",
)
async def update_zone(
    zone_id: UUID,
    zone_data: DeliveryZoneUpdate,
    db: DatabaseSession,
):
    """
    Update delivery zone.

    Requires superuser access.
    """
    result = await db.execute(
        select(DeliveryZone).where(DeliveryZone.id == zone_id)
    )
    zone = result.scalar_one_or_none()

    if not zone:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Zona de envío no encontrada",
        )

    update_data = zone_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(zone, field, value)

    await db.commit()
    await db.refresh(zone)
    return DeliveryZoneResponse.model_validate(zone)


@router.delete(
    "/{zone_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_superuser)],
    summary="Deactivate delivery zone",
)
async def delete_zone(
    zone_id: UUID,
    db: DatabaseSession,
):
    """
    Deactivate delivery zone (soft delete).

    Requires superuser access.
    Sets is_active=False instead of deleting to preserve
    historical order references.
    """
    result = await db.execute(
        select(DeliveryZone).where(DeliveryZone.id == zone_id)
    )
    zone = result.scalar_one_or_none()

    if not zone:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Zona de envío no encontrada",
        )

    zone.is_active = False
    await db.commit()
