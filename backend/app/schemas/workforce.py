"""
Workforce Management Schemas - Shifts, Attendance, Checklists, Performance
"""
from uuid import UUID
from decimal import Decimal
from datetime import datetime, date, time
from pydantic import Field, field_validator, model_validator
from app.schemas.base import BaseSchema, IDModelSchema
from app.models.workforce import (
    ShiftType, AttendanceStatus, AbsenceType,
    ChecklistItemStatus, ReviewPeriod,
    ResponsibilityCategory, AssignmentType,
)


# ============================================
# Shift Template Schemas
# ============================================

class ShiftTemplateCreate(BaseSchema):
    """Create a shift template"""
    name: str = Field(..., min_length=1, max_length=100)
    shift_type: ShiftType
    start_time: time
    end_time: time
    break_minutes: int = Field(default=0, ge=0)
    description: str | None = None


class ShiftTemplateUpdate(BaseSchema):
    """Update a shift template"""
    name: str | None = Field(None, min_length=1, max_length=100)
    shift_type: ShiftType | None = None
    start_time: time | None = None
    end_time: time | None = None
    break_minutes: int | None = Field(None, ge=0)
    description: str | None = None
    is_active: bool | None = None


class ShiftTemplateResponse(IDModelSchema):
    """Shift template API response"""
    name: str
    shift_type: ShiftType
    start_time: time
    end_time: time
    break_minutes: int
    description: str | None
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# ============================================
# Schedule Schemas
# ============================================

class ScheduleCreate(BaseSchema):
    """Create a single schedule entry"""
    employee_id: UUID
    shift_template_id: UUID | None = None
    schedule_date: date
    start_time: time
    end_time: time
    notes: str | None = None


class BulkScheduleCreate(BaseSchema):
    """Create multiple schedule entries at once"""
    schedules: list[ScheduleCreate]


class ScheduleUpdate(BaseSchema):
    """Update a schedule entry"""
    shift_template_id: UUID | None = None
    start_time: time | None = None
    end_time: time | None = None
    notes: str | None = None


class ScheduleResponse(IDModelSchema):
    """Schedule API response"""
    employee_id: UUID
    employee_name: str | None = None
    shift_template_id: UUID | None
    shift_template_name: str | None = None
    schedule_date: date
    start_time: time
    end_time: time
    notes: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


# ============================================
# Attendance Schemas
# ============================================

class AttendanceCreate(BaseSchema):
    """Log attendance for an employee"""
    employee_id: UUID
    record_date: date
    status: AttendanceStatus
    check_in_time: time | None = None
    check_out_time: time | None = None
    notes: str | None = None

    @field_validator('check_in_time', 'check_out_time', mode='before')
    @classmethod
    def parse_time_string(cls, v):
        """Normalize time strings from HH:MM to HH:MM:SS format"""
        if v is None or v == '':
            return None
        if isinstance(v, str):
            # Handle HH:MM format from HTML time input -> HH:MM:SS
            if len(v) == 5:
                v = f"{v}:00"
            return time.fromisoformat(v)
        return v


class AttendanceUpdate(BaseSchema):
    """Update an attendance record"""
    status: AttendanceStatus | None = None
    check_in_time: time | None = None
    check_out_time: time | None = None
    notes: str | None = None

    @field_validator('check_in_time', 'check_out_time', mode='before')
    @classmethod
    def parse_time_string(cls, v):
        """Normalize time strings from HH:MM to HH:MM:SS format"""
        if v is None or v == '':
            return None
        if isinstance(v, str):
            # Handle HH:MM format from HTML time input -> HH:MM:SS
            if len(v) == 5:
                v = f"{v}:00"
            return time.fromisoformat(v)
        return v


class AttendanceResponse(IDModelSchema):
    """Attendance record API response"""
    employee_id: UUID
    employee_name: str | None = None
    record_date: date
    status: AttendanceStatus
    check_in_time: time | None
    check_out_time: time | None
    scheduled_start: time | None
    scheduled_end: time | None
    minutes_late: int
    minutes_early_departure: int
    notes: str | None
    recorded_by: UUID | None
    created_at: datetime

    model_config = {"from_attributes": True}


class DailyAttendanceSummary(BaseSchema):
    """Summary of attendance for a day"""
    date: date
    total_employees: int
    present: int
    absent: int
    late: int
    excused: int
    not_logged: int = 0


# ============================================
# Absence Schemas
# ============================================

class AbsenceCreate(BaseSchema):
    """Record an absence"""
    employee_id: UUID
    absence_type: AbsenceType
    absence_date: date
    attendance_record_id: UUID | None = None
    justification: str | None = None
    evidence_url: str | None = None
    is_deductible: bool = True
    deduction_amount: Decimal = Field(default=0, ge=0)


class AbsenceUpdate(BaseSchema):
    """Update an absence record"""
    absence_type: AbsenceType | None = None
    justification: str | None = None
    evidence_url: str | None = None
    is_deductible: bool | None = None
    deduction_amount: Decimal | None = Field(None, ge=0)


class AbsenceResponse(IDModelSchema):
    """Absence record API response"""
    employee_id: UUID
    employee_name: str | None = None
    attendance_record_id: UUID | None
    absence_type: AbsenceType
    absence_date: date
    justification: str | None
    evidence_url: str | None
    is_deductible: bool
    deduction_amount: Decimal
    approved_by: UUID | None
    approved_at: datetime | None
    created_by: UUID | None
    created_at: datetime

    model_config = {"from_attributes": True}


# ============================================
# Checklist Template Schemas
# ============================================

class ChecklistTemplateItemCreate(BaseSchema):
    """Create an item within a checklist template"""
    description: str = Field(..., min_length=1, max_length=500)
    sort_order: int = 0
    is_required: bool = True


class ChecklistTemplateItemUpdate(BaseSchema):
    """Update a checklist template item"""
    description: str | None = Field(None, min_length=1, max_length=500)
    sort_order: int | None = None
    is_required: bool | None = None


class ChecklistTemplateItemResponse(IDModelSchema):
    """Checklist template item API response"""
    template_id: UUID
    description: str
    sort_order: int
    is_required: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class ChecklistTemplateCreate(BaseSchema):
    """Create a checklist template"""
    name: str = Field(..., min_length=1, max_length=100)
    assignment_type: str = Field(default="position", pattern=r"^(position|employee)$")
    position: str | None = Field(None, min_length=1, max_length=100)
    employee_id: UUID | None = None
    description: str | None = None
    items: list[ChecklistTemplateItemCreate] = []

    @model_validator(mode='after')
    def validate_assignment(self):
        """Validate that position or employee_id is provided based on assignment_type"""
        if self.assignment_type == "position" and not self.position:
            raise ValueError("position es requerido para asignación por cargo")
        if self.assignment_type == "employee" and not self.employee_id:
            raise ValueError("employee_id es requerido para asignación individual")
        return self


class ChecklistTemplateUpdate(BaseSchema):
    """Update a checklist template"""
    name: str | None = Field(None, min_length=1, max_length=100)
    assignment_type: str | None = Field(None, pattern=r"^(position|employee)$")
    position: str | None = Field(None, min_length=1, max_length=100)
    employee_id: UUID | None = None
    description: str | None = None
    is_active: bool | None = None


class ChecklistTemplateResponse(IDModelSchema):
    """Checklist template API response"""
    name: str
    assignment_type: str
    position: str | None
    employee_id: UUID | None
    employee_name: str | None = None
    description: str | None
    is_active: bool
    items: list[ChecklistTemplateItemResponse] = []
    created_at: datetime

    model_config = {"from_attributes": True}


# ============================================
# Daily Checklist Schemas
# ============================================

class DailyChecklistItemResponse(IDModelSchema):
    """Daily checklist item API response"""
    checklist_id: UUID
    description: str
    sort_order: int
    is_required: bool
    status: ChecklistItemStatus
    completed_at: datetime | None
    completed_by: UUID | None
    notes: str | None

    model_config = {"from_attributes": True}


class ChecklistItemStatusUpdate(BaseSchema):
    """Update the status of a checklist item"""
    status: ChecklistItemStatus
    notes: str | None = None


class DailyChecklistResponse(IDModelSchema):
    """Daily checklist API response"""
    employee_id: UUID
    employee_name: str | None = None
    template_id: UUID | None
    checklist_date: date
    total_items: int
    completed_items: int
    completion_rate: Decimal
    verified_by: UUID | None
    verified_at: datetime | None
    notes: str | None
    items: list[DailyChecklistItemResponse] = []
    created_at: datetime

    model_config = {"from_attributes": True}


class ChecklistVerifyRequest(BaseSchema):
    """Request to verify a checklist"""
    notes: str | None = None


# ============================================
# Performance Schemas
# ============================================

class EmployeePerformanceMetrics(BaseSchema):
    """Real-time performance metrics for an employee"""
    employee_id: UUID
    employee_name: str
    period_start: date
    period_end: date
    attendance_rate: Decimal
    punctuality_rate: Decimal
    checklist_completion_rate: Decimal
    total_sales_amount: Decimal
    total_sales_count: int
    overall_score: Decimal


class PerformanceSummaryItem(BaseSchema):
    """Summary item for all-employees performance view"""
    employee_id: UUID
    employee_name: str
    position: str
    attendance_rate: Decimal
    punctuality_rate: Decimal
    checklist_completion_rate: Decimal
    overall_score: Decimal


class ReviewGenerateRequest(BaseSchema):
    """Request to generate a performance review"""
    employee_id: UUID
    review_period: ReviewPeriod
    period_start: date
    period_end: date


class ReviewUpdateRequest(BaseSchema):
    """Update a performance review (add notes)"""
    reviewer_notes: str | None = None


class PerformanceReviewResponse(IDModelSchema):
    """Performance review API response"""
    employee_id: UUID
    employee_name: str | None = None
    review_period: ReviewPeriod
    period_start: date
    period_end: date
    attendance_rate: Decimal
    punctuality_rate: Decimal
    checklist_completion_rate: Decimal
    total_sales_amount: Decimal
    total_sales_count: int
    overall_score: Decimal
    reviewer_notes: str | None
    reviewed_by: UUID | None
    reviewed_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


# ============================================
# Position Responsibility Schemas
# ============================================

class PositionResponsibilityCreate(BaseSchema):
    """Create a position responsibility"""
    assignment_type: str = Field(default="position", pattern=r"^(position|employee)$")
    position: str | None = Field(None, min_length=1, max_length=100)
    employee_id: UUID | None = None
    title: str = Field(..., min_length=1, max_length=200)
    description: str | None = None
    category: str = Field(..., pattern=r"^(core|administrative|customer_service|operational)$")
    sort_order: int = 0

    @model_validator(mode='after')
    def validate_assignment(self):
        """Validate that position or employee_id is provided based on assignment_type"""
        if self.assignment_type == "position" and not self.position:
            raise ValueError("position es requerido para asignación por cargo")
        if self.assignment_type == "employee" and not self.employee_id:
            raise ValueError("employee_id es requerido para asignación individual")
        return self


class PositionResponsibilityUpdate(BaseSchema):
    """Update a position responsibility"""
    assignment_type: str | None = Field(None, pattern=r"^(position|employee)$")
    position: str | None = Field(None, min_length=1, max_length=100)
    employee_id: UUID | None = None
    title: str | None = Field(None, min_length=1, max_length=200)
    description: str | None = None
    category: str | None = Field(None, pattern=r"^(core|administrative|customer_service|operational)$")
    sort_order: int | None = None
    is_active: bool | None = None


class PositionResponsibilityResponse(IDModelSchema):
    """Position responsibility API response"""
    assignment_type: str
    position: str | None
    employee_id: UUID | None
    employee_name: str | None = None
    title: str
    description: str | None
    category: str
    sort_order: int
    is_active: bool
    created_by: UUID | None
    created_at: datetime

    model_config = {"from_attributes": True}
