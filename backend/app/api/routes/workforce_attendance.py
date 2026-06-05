"""
Workforce Attendance Routes - Attendance logging and absence management
"""
from uuid import UUID
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, status, Query

from app.api.dependencies import DatabaseSession, CurrentUser, require_global_permission
from app.api.error_responses import responses, AUTHENTICATED
from app.services.workforce.attendance import attendance_service
from app.models.workforce import AttendanceStatus, AbsenceType
from app.schemas.workforce import (
    AttendanceCreate,
    AttendanceUpdate,
    AttendanceResponse,
    DailyAttendanceSummary,
    AbsenceCreate,
    AbsenceUpdate,
    AbsenceResponse,
)
from app.schemas.base import PaginatedResponse, paginate

router = APIRouter(prefix="/global/workforce", tags=["Workforce - Attendance"])


# ============================================
# Attendance
# ============================================

@router.get(
    "/attendance",
    response_model=PaginatedResponse[AttendanceResponse],
    dependencies=[Depends(require_global_permission("workforce.view_attendance"))],
    responses=AUTHENTICATED,
    operation_id="listAttendance",
)
async def list_attendance(
    db: DatabaseSession,
    current_user: CurrentUser,
    record_date: date | None = Query(None),
    employee_id: UUID | None = Query(None),
    attendance_status: AttendanceStatus | None = Query(None, alias="status"),
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
):
    """
    List attendance records with date, employee, and status filters.

    **Auth:** Bearer JWT (staff)
    **Permission:** `workforce.view_attendance` (global)
    """
    records = await attendance_service.get_attendance_records(
        db,
        record_date=record_date,
        employee_id=employee_id,
        status=attendance_status,
        date_from=date_from,
        date_to=date_to,
    )
    total = len(records)
    items = [_attendance_to_response(r) for r in records[skip:skip + limit]]
    return PaginatedResponse[AttendanceResponse](**paginate(items, total, skip, limit))


@router.post(
    "/attendance",
    response_model=AttendanceResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_global_permission("workforce.manage_attendance"))],
    responses=responses(400),
    operation_id="logAttendance",
)
async def log_attendance(
    data: AttendanceCreate,
    db: DatabaseSession,
    current_user: CurrentUser,
):
    """
    Log attendance for an employee (check-in/check-out).

    **Auth:** Bearer JWT (staff)
    **Permission:** `workforce.manage_attendance` (global)
    """
    try:
        record = await attendance_service.log_attendance(
            db, data, recorded_by=current_user.id
        )
        return _attendance_to_response(record)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.patch(
    "/attendance/{record_id}",
    response_model=AttendanceResponse,
    dependencies=[Depends(require_global_permission("workforce.manage_attendance"))],
    responses=responses(404),
    operation_id="updateAttendance",
)
async def update_attendance(
    record_id: UUID,
    data: AttendanceUpdate,
    db: DatabaseSession,
    current_user: CurrentUser,
):
    """
    Update an attendance record.

    **Auth:** Bearer JWT (staff)
    **Permission:** `workforce.manage_attendance` (global)
    """
    try:
        record = await attendance_service.update_attendance(db, record_id, data)
        return _attendance_to_response(record)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get(
    "/attendance/daily",
    response_model=DailyAttendanceSummary,
    dependencies=[Depends(require_global_permission("workforce.view_attendance"))],
    responses=AUTHENTICATED,
    operation_id="getDailyAttendanceSummary",
)
async def get_daily_summary(
    db: DatabaseSession,
    current_user: CurrentUser,
    target_date: date | None = Query(None),
):
    """
    Get attendance summary for a specific date (defaults to today).

    **Auth:** Bearer JWT (staff)
    **Permission:** `workforce.view_attendance` (global)
    """
    return await attendance_service.get_daily_summary(db, target_date)


# ============================================
# Absences
# ============================================

@router.get(
    "/absences",
    response_model=PaginatedResponse[AbsenceResponse],
    dependencies=[Depends(require_global_permission("workforce.view_absences"))],
    responses=AUTHENTICATED,
    operation_id="listAbsences",
)
async def list_absences(
    db: DatabaseSession,
    current_user: CurrentUser,
    employee_id: UUID | None = Query(None),
    absence_type: AbsenceType | None = Query(None),
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    is_deductible: bool | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
):
    """
    List absence records with employee, type, date, and deductibility filters.

    **Auth:** Bearer JWT (staff)
    **Permission:** `workforce.view_absences` (global)
    """
    absences = await attendance_service.get_absences(
        db,
        employee_id=employee_id,
        absence_type=absence_type,
        date_from=date_from,
        date_to=date_to,
        is_deductible=is_deductible,
    )
    total = len(absences)
    items = [_absence_to_response(a) for a in absences[skip:skip + limit]]
    return PaginatedResponse[AbsenceResponse](**paginate(items, total, skip, limit))


@router.post(
    "/absences",
    response_model=AbsenceResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_global_permission("workforce.manage_absences"))],
    responses=AUTHENTICATED,
    operation_id="createAbsence",
)
async def create_absence(
    data: AbsenceCreate,
    db: DatabaseSession,
    current_user: CurrentUser,
):
    """
    Record an absence for an employee.

    **Auth:** Bearer JWT (staff)
    **Permission:** `workforce.manage_absences` (global)
    """
    absence = await attendance_service.create_absence(
        db, data, created_by=current_user.id
    )
    return _absence_to_response(absence)


@router.patch(
    "/absences/{absence_id}",
    response_model=AbsenceResponse,
    dependencies=[Depends(require_global_permission("workforce.manage_absences"))],
    responses=responses(404),
    operation_id="updateAbsence",
)
async def update_absence(
    absence_id: UUID,
    data: AbsenceUpdate,
    db: DatabaseSession,
    current_user: CurrentUser,
):
    """
    Update an absence record.

    **Auth:** Bearer JWT (staff)
    **Permission:** `workforce.manage_absences` (global)
    """
    try:
        absence = await attendance_service.update_absence(db, absence_id, data)
        return _absence_to_response(absence)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post(
    "/absences/{absence_id}/approve",
    response_model=AbsenceResponse,
    dependencies=[Depends(require_global_permission("workforce.manage_absences"))],
    responses=responses(404),
    operation_id="approveAbsence",
)
async def approve_absence(
    absence_id: UUID,
    db: DatabaseSession,
    current_user: CurrentUser,
):
    """
    Approve or justify an absence.

    **Auth:** Bearer JWT (staff)
    **Permission:** `workforce.manage_absences` (global)
    """
    try:
        absence = await attendance_service.approve_absence(
            db, absence_id, approved_by=current_user.id
        )
        return _absence_to_response(absence)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get(
    "/absences/deductions",
    response_model=PaginatedResponse[AbsenceResponse],
    dependencies=[Depends(require_global_permission("workforce.view_deductions"))],
    responses=AUTHENTICATED,
    operation_id="getDeductibleAbsences",
)
async def get_deductible_absences(
    db: DatabaseSession,
    current_user: CurrentUser,
    period_start: date = Query(...),
    period_end: date = Query(...),
    employee_id: UUID | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
):
    """
    Get deductible absences for a payroll period.

    **Auth:** Bearer JWT (staff)
    **Permission:** `workforce.view_deductions` (global)
    """
    absences = await attendance_service.get_deductible_absences(
        db,
        period_start=period_start,
        period_end=period_end,
        employee_id=employee_id,
    )
    total = len(absences)
    items = [_absence_to_response(a) for a in absences[skip:skip + limit]]
    return PaginatedResponse[AbsenceResponse](**paginate(items, total, skip, limit))


# ============================================
# Helpers
# ============================================

def _attendance_to_response(record: object) -> dict:
    """Convert attendance ORM to response with employee name"""
    return {
        "id": record.id,
        "employee_id": record.employee_id,
        "employee_name": record.employee.full_name if record.employee else None,
        "record_date": record.record_date,
        "status": record.status,
        "check_in_time": record.check_in_time,
        "check_out_time": record.check_out_time,
        "scheduled_start": record.scheduled_start,
        "scheduled_end": record.scheduled_end,
        "minutes_late": record.minutes_late,
        "minutes_early_departure": record.minutes_early_departure,
        "notes": record.notes,
        "recorded_by": record.recorded_by,
        "created_at": record.created_at,
    }


def _absence_to_response(absence: object) -> dict:
    """Convert absence ORM to response with employee name"""
    return {
        "id": absence.id,
        "employee_id": absence.employee_id,
        "employee_name": absence.employee.full_name if absence.employee else None,
        "attendance_record_id": absence.attendance_record_id,
        "absence_type": absence.absence_type,
        "absence_date": absence.absence_date,
        "justification": absence.justification,
        "evidence_url": absence.evidence_url,
        "is_deductible": absence.is_deductible,
        "deduction_amount": absence.deduction_amount,
        "approved_by": absence.approved_by,
        "approved_at": absence.approved_at,
        "created_by": absence.created_by,
        "created_at": absence.created_at,
    }
