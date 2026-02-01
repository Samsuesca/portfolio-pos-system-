"""
Workforce Responsibilities Routes - Position responsibilities CRUD
"""
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, Query

from app.api.dependencies import DatabaseSession, CurrentUser, require_global_permission
from app.services.workforce.responsibilities import responsibility_service
from app.schemas.workforce import (
    PositionResponsibilityCreate,
    PositionResponsibilityUpdate,
    PositionResponsibilityResponse,
)

router = APIRouter(prefix="/global/workforce", tags=["Workforce - Responsibilities"])


@router.get(
    "/responsibilities",
    response_model=list[PositionResponsibilityResponse],
    dependencies=[Depends(require_global_permission("workforce.view_shifts"))],
)
async def list_responsibilities(
    db: DatabaseSession,
    current_user: CurrentUser,
    position: str | None = Query(None),
    assignment_type: str | None = Query(None, description="Filter by assignment_type: 'position' or 'employee'"),
    employee_id: UUID | None = Query(None, description="Filter by specific employee"),
    is_active: bool | None = Query(None),
):
    """List position and employee responsibilities"""
    responsibilities = await responsibility_service.get_all(
        db, position=position, assignment_type=assignment_type,
        employee_id=employee_id, is_active=is_active
    )
    return [_responsibility_to_response(r) for r in responsibilities]


@router.get(
    "/responsibilities/employee/{employee_id}",
    response_model=list[PositionResponsibilityResponse],
    dependencies=[Depends(require_global_permission("workforce.view_shifts"))],
)
async def get_employee_responsibilities(
    employee_id: UUID,
    db: DatabaseSession,
    current_user: CurrentUser,
):
    """
    Get all responsibilities for a specific employee.

    Returns both individual assignments and position-based assignments.
    """
    responsibilities = await responsibility_service.get_employee_responsibilities(
        db, employee_id
    )
    return [_responsibility_to_response(r) for r in responsibilities]


@router.get(
    "/responsibilities/{responsibility_id}",
    response_model=PositionResponsibilityResponse,
    dependencies=[Depends(require_global_permission("workforce.view_shifts"))],
)
async def get_responsibility(
    responsibility_id: UUID,
    db: DatabaseSession,
    current_user: CurrentUser,
):
    """Get a single position responsibility"""
    responsibility = await responsibility_service.get_by_id(db, responsibility_id)
    if not responsibility:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Responsabilidad no encontrada"
        )
    return _responsibility_to_response(responsibility)


@router.post(
    "/responsibilities",
    response_model=PositionResponsibilityResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_global_permission("workforce.manage_shifts"))],
)
async def create_responsibility(
    data: PositionResponsibilityCreate,
    db: DatabaseSession,
    current_user: CurrentUser,
):
    """Create a position responsibility"""
    return await responsibility_service.create(db, data, created_by=current_user.id)


@router.patch(
    "/responsibilities/{responsibility_id}",
    response_model=PositionResponsibilityResponse,
    dependencies=[Depends(require_global_permission("workforce.manage_shifts"))],
)
async def update_responsibility(
    responsibility_id: UUID,
    data: PositionResponsibilityUpdate,
    db: DatabaseSession,
    current_user: CurrentUser,
):
    """Update a position responsibility"""
    responsibility = await responsibility_service.update(db, responsibility_id, data)
    if not responsibility:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Responsabilidad no encontrada"
        )
    return responsibility


@router.delete(
    "/responsibilities/{responsibility_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_global_permission("workforce.manage_shifts"))],
)
async def delete_responsibility(
    responsibility_id: UUID,
    db: DatabaseSession,
    current_user: CurrentUser,
):
    """Delete a position responsibility"""
    deleted = await responsibility_service.delete(db, responsibility_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Responsabilidad no encontrada"
        )


# ============================================
# Helpers
# ============================================

def _responsibility_to_response(responsibility: object) -> dict:
    """Convert responsibility ORM to response with employee name"""
    return {
        "id": responsibility.id,
        "assignment_type": responsibility.assignment_type,
        "position": responsibility.position,
        "employee_id": responsibility.employee_id,
        "employee_name": responsibility.assigned_employee.full_name if responsibility.assigned_employee else None,
        "title": responsibility.title,
        "description": responsibility.description,
        "category": responsibility.category,
        "sort_order": responsibility.sort_order,
        "is_active": responsibility.is_active,
        "created_by": responsibility.created_by,
        "created_at": responsibility.created_at,
    }
