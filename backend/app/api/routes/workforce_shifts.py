"""
Workforce Shifts Routes - Shift templates and schedule management
"""
from uuid import UUID
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, status, Query

from app.api.dependencies import DatabaseSession, CurrentUser, require_global_permission
from app.services.workforce.shifts import shift_service
from app.schemas.workforce import (
    ShiftTemplateCreate,
    ShiftTemplateUpdate,
    ShiftTemplateResponse,
    ScheduleCreate,
    BulkScheduleCreate,
    ScheduleUpdate,
    ScheduleResponse,
)

router = APIRouter(prefix="/global/workforce", tags=["Workforce - Shifts"])


# ============================================
# Shift Templates
# ============================================

@router.get(
    "/shift-templates",
    response_model=list[ShiftTemplateResponse],
    dependencies=[Depends(require_global_permission("workforce.view_shifts"))],
)
async def list_shift_templates(
    db: DatabaseSession,
    current_user: CurrentUser,
    is_active: bool | None = Query(None),
):
    """List all shift templates"""
    return await shift_service.get_shift_templates(db, is_active=is_active)


@router.post(
    "/shift-templates",
    response_model=ShiftTemplateResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_global_permission("workforce.manage_shifts"))],
)
async def create_shift_template(
    data: ShiftTemplateCreate,
    db: DatabaseSession,
    current_user: CurrentUser,
):
    """Create a new shift template"""
    return await shift_service.create_shift_template(
        db, data, created_by=current_user.id
    )


@router.patch(
    "/shift-templates/{template_id}",
    response_model=ShiftTemplateResponse,
    dependencies=[Depends(require_global_permission("workforce.manage_shifts"))],
)
async def update_shift_template(
    template_id: UUID,
    data: ShiftTemplateUpdate,
    db: DatabaseSession,
    current_user: CurrentUser,
):
    """Update a shift template"""
    try:
        return await shift_service.update_shift_template(db, template_id, data)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete(
    "/shift-templates/{template_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_global_permission("workforce.manage_shifts"))],
)
async def delete_shift_template(
    template_id: UUID,
    db: DatabaseSession,
    current_user: CurrentUser,
):
    """Soft delete a shift template"""
    if not await shift_service.delete_shift_template(db, template_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Plantilla de turno no encontrada",
        )


# ============================================
# Schedules
# ============================================

@router.get(
    "/schedules",
    response_model=list[ScheduleResponse],
    dependencies=[Depends(require_global_permission("workforce.view_shifts"))],
)
async def list_schedules(
    db: DatabaseSession,
    current_user: CurrentUser,
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    employee_id: UUID | None = Query(None),
):
    """List schedules with optional filters"""
    schedules = await shift_service.get_schedules(
        db, date_from=date_from, date_to=date_to, employee_id=employee_id
    )
    return [_schedule_to_response(s) for s in schedules]


@router.post(
    "/schedules",
    response_model=ScheduleResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_global_permission("workforce.manage_shifts"))],
)
async def create_schedule(
    data: ScheduleCreate,
    db: DatabaseSession,
    current_user: CurrentUser,
):
    """Create a single schedule entry"""
    try:
        schedule = await shift_service.create_schedule(
            db, data, created_by=current_user.id
        )
        return _schedule_to_response(schedule)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post(
    "/schedules/bulk",
    response_model=list[ScheduleResponse],
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_global_permission("workforce.manage_shifts"))],
)
async def create_bulk_schedules(
    data: BulkScheduleCreate,
    db: DatabaseSession,
    current_user: CurrentUser,
):
    """Create multiple schedule entries (skips conflicts)"""
    schedules = await shift_service.create_bulk_schedules(
        db, data.schedules, created_by=current_user.id
    )
    return [_schedule_to_response(s) for s in schedules]


@router.patch(
    "/schedules/{schedule_id}",
    response_model=ScheduleResponse,
    dependencies=[Depends(require_global_permission("workforce.manage_shifts"))],
)
async def update_schedule(
    schedule_id: UUID,
    data: ScheduleUpdate,
    db: DatabaseSession,
    current_user: CurrentUser,
):
    """Update a schedule entry"""
    try:
        schedule = await shift_service.update_schedule(db, schedule_id, data)
        return _schedule_to_response(schedule)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete(
    "/schedules/{schedule_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_global_permission("workforce.manage_shifts"))],
)
async def delete_schedule(
    schedule_id: UUID,
    db: DatabaseSession,
    current_user: CurrentUser,
):
    """Delete a schedule entry"""
    if not await shift_service.delete_schedule(db, schedule_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Horario no encontrado",
        )


@router.get(
    "/schedules/employee/{employee_id}",
    response_model=list[ScheduleResponse],
    dependencies=[Depends(require_global_permission("workforce.view_shifts"))],
)
async def get_employee_schedule(
    employee_id: UUID,
    db: DatabaseSession,
    current_user: CurrentUser,
    date_from: date = Query(...),
    date_to: date = Query(...),
):
    """Get schedule for a specific employee in a date range"""
    schedules = await shift_service.get_employee_schedule(
        db, employee_id, date_from=date_from, date_to=date_to
    )
    return [_schedule_to_response(s) for s in schedules]


# ============================================
# Helpers
# ============================================

def _schedule_to_response(schedule: object) -> dict:
    """Convert schedule ORM object to response dict with employee/template names"""
    return {
        "id": schedule.id,
        "employee_id": schedule.employee_id,
        "employee_name": schedule.employee.full_name if schedule.employee else None,
        "shift_template_id": schedule.shift_template_id,
        "shift_template_name": schedule.shift_template.name if schedule.shift_template else None,
        "schedule_date": schedule.schedule_date,
        "start_time": schedule.start_time,
        "end_time": schedule.end_time,
        "notes": schedule.notes,
        "created_at": schedule.created_at,
    }
