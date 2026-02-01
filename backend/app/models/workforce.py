"""
Workforce Management Models - Shifts, Attendance, Checklists, Performance
"""
from uuid import uuid4
from datetime import datetime, date, time
from decimal import Decimal
from enum import Enum
from sqlalchemy import (
    String, Text, Integer, Numeric, Boolean, Date, DateTime, Time,
    ForeignKey, UniqueConstraint, Index
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base
from app.utils.timezone import get_colombia_now_naive


# ============================================
# Enums
# ============================================

class ShiftType(str, Enum):
    """Types of work shifts"""
    MORNING = "morning"
    AFTERNOON = "afternoon"
    FULL_DAY = "full_day"
    CUSTOM = "custom"


class AbsenceType(str, Enum):
    """Types of absences"""
    ABSENCE_JUSTIFIED = "absence_justified"
    ABSENCE_UNJUSTIFIED = "absence_unjustified"
    TARDINESS = "tardiness"
    EARLY_DEPARTURE = "early_departure"
    VACATION = "vacation"
    SICK_LEAVE = "sick_leave"


class AttendanceStatus(str, Enum):
    """Attendance status for a day"""
    PRESENT = "present"
    ABSENT = "absent"
    LATE = "late"
    EXCUSED = "excused"


class ChecklistItemStatus(str, Enum):
    """Status of a checklist item"""
    PENDING = "pending"
    COMPLETED = "completed"
    SKIPPED = "skipped"


class ReviewPeriod(str, Enum):
    """Performance review period"""
    WEEKLY = "weekly"
    MONTHLY = "monthly"
    QUARTERLY = "quarterly"


class AssignmentType(str, Enum):
    """Assignment type for checklists and responsibilities"""
    POSITION = "position"   # Applies to all employees with this position
    EMPLOYEE = "employee"   # Applies to a specific employee


# ============================================
# Shift Models
# ============================================

class ShiftTemplate(Base):
    """Reusable shift template (e.g., Morning 7am-1pm)"""
    __tablename__ = "shift_templates"

    id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid4
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    shift_type: Mapped[str] = mapped_column(
        String(20), nullable=False
    )
    start_time: Mapped[time] = mapped_column(Time, nullable=False)
    end_time: Mapped[time] = mapped_column(Time, nullable=False)
    break_minutes: Mapped[int] = mapped_column(Integer, default=0)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    created_by: Mapped[UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=get_colombia_now_naive
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=get_colombia_now_naive, onupdate=get_colombia_now_naive
    )

    # Relationships
    schedules = relationship("EmployeeSchedule", back_populates="shift_template")


class EmployeeSchedule(Base):
    """Assigns a shift to an employee on a specific date"""
    __tablename__ = "employee_schedules"

    id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid4
    )
    employee_id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("employees.id", ondelete="CASCADE"),
        nullable=False
    )
    shift_template_id: Mapped[UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("shift_templates.id", ondelete="SET NULL"),
        nullable=True
    )
    schedule_date: Mapped[date] = mapped_column(Date, nullable=False)
    start_time: Mapped[time] = mapped_column(Time, nullable=False)
    end_time: Mapped[time] = mapped_column(Time, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_by: Mapped[UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=get_colombia_now_naive
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=get_colombia_now_naive, onupdate=get_colombia_now_naive
    )

    # Relationships
    employee = relationship("Employee", back_populates="schedules")
    shift_template = relationship("ShiftTemplate", back_populates="schedules")

    __table_args__ = (
        UniqueConstraint('employee_id', 'schedule_date', name='uq_employee_schedule_date'),
        Index('ix_employee_schedule_date', 'employee_id', 'schedule_date'),
    )


# ============================================
# Attendance Models
# ============================================

class AttendanceRecord(Base):
    """Daily attendance record for an employee"""
    __tablename__ = "attendance_records"

    id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid4
    )
    employee_id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("employees.id", ondelete="CASCADE"),
        nullable=False
    )
    record_date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(
        String(20), nullable=False
    )
    check_in_time: Mapped[time | None] = mapped_column(Time, nullable=True)
    check_out_time: Mapped[time | None] = mapped_column(Time, nullable=True)
    scheduled_start: Mapped[time | None] = mapped_column(Time, nullable=True)
    scheduled_end: Mapped[time | None] = mapped_column(Time, nullable=True)
    minutes_late: Mapped[int] = mapped_column(Integer, default=0)
    minutes_early_departure: Mapped[int] = mapped_column(Integer, default=0)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    recorded_by: Mapped[UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=get_colombia_now_naive
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=get_colombia_now_naive, onupdate=get_colombia_now_naive
    )

    # Relationships
    employee = relationship("Employee", back_populates="attendance_records")
    absence = relationship("AbsenceRecord", back_populates="attendance_record", uselist=False)

    __table_args__ = (
        UniqueConstraint('employee_id', 'record_date', name='uq_attendance_employee_date'),
        Index('ix_attendance_employee_date', 'employee_id', 'record_date'),
    )


class AbsenceRecord(Base):
    """Detailed absence/tardiness record linked to attendance"""
    __tablename__ = "absence_records"

    id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid4
    )
    employee_id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("employees.id", ondelete="CASCADE"),
        nullable=False
    )
    attendance_record_id: Mapped[UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("attendance_records.id", ondelete="SET NULL"),
        nullable=True
    )
    absence_type: Mapped[str] = mapped_column(
        String(30), nullable=False
    )
    absence_date: Mapped[date] = mapped_column(Date, nullable=False)
    justification: Mapped[str | None] = mapped_column(Text, nullable=True)
    evidence_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    is_deductible: Mapped[bool] = mapped_column(Boolean, default=True)
    deduction_amount: Mapped[Decimal] = mapped_column(
        Numeric(15, 2), default=0
    )

    approved_by: Mapped[UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True
    )
    approved_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_by: Mapped[UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=get_colombia_now_naive
    )

    # Relationships
    employee = relationship("Employee", back_populates="absence_records")
    attendance_record = relationship("AttendanceRecord", back_populates="absence")

    __table_args__ = (
        Index('ix_absence_employee_date', 'employee_id', 'absence_date'),
    )


# ============================================
# Checklist Models
# ============================================

class ChecklistTemplate(Base):
    """Position-specific or employee-specific checklist template"""
    __tablename__ = "checklist_templates"

    id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid4
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    position: Mapped[str | None] = mapped_column(String(100), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    # Assignment type: "position" (all employees with position) or "employee" (specific individual)
    assignment_type: Mapped[str] = mapped_column(String(20), default="position")
    employee_id: Mapped[UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("employees.id", ondelete="CASCADE"),
        nullable=True
    )

    created_by: Mapped[UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=get_colombia_now_naive
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=get_colombia_now_naive, onupdate=get_colombia_now_naive
    )

    # Relationships
    items = relationship(
        "ChecklistTemplateItem",
        back_populates="template",
        lazy="selectin",
        order_by="ChecklistTemplateItem.sort_order"
    )
    daily_checklists = relationship("DailyChecklist", back_populates="template")
    assigned_employee = relationship("Employee", foreign_keys=[employee_id])


class ChecklistTemplateItem(Base):
    """Individual item within a checklist template"""
    __tablename__ = "checklist_template_items"

    id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid4
    )
    template_id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("checklist_templates.id", ondelete="CASCADE"),
        nullable=False
    )
    description: Mapped[str] = mapped_column(String(500), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    is_required: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=get_colombia_now_naive
    )

    # Relationships
    template = relationship("ChecklistTemplate", back_populates="items")


class DailyChecklist(Base):
    """Daily checklist instance assigned to an employee"""
    __tablename__ = "daily_checklists"

    id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid4
    )
    employee_id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("employees.id", ondelete="CASCADE"),
        nullable=False
    )
    template_id: Mapped[UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("checklist_templates.id", ondelete="SET NULL"),
        nullable=True
    )
    checklist_date: Mapped[date] = mapped_column(Date, nullable=False)
    total_items: Mapped[int] = mapped_column(Integer, default=0)
    completed_items: Mapped[int] = mapped_column(Integer, default=0)
    completion_rate: Mapped[Decimal] = mapped_column(
        Numeric(5, 2), default=0
    )

    verified_by: Mapped[UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True
    )
    verified_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=get_colombia_now_naive
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=get_colombia_now_naive, onupdate=get_colombia_now_naive
    )

    # Relationships
    employee = relationship("Employee", back_populates="daily_checklists")
    template = relationship("ChecklistTemplate", back_populates="daily_checklists")
    items = relationship(
        "DailyChecklistItem",
        back_populates="checklist",
        lazy="selectin",
        order_by="DailyChecklistItem.sort_order"
    )

    __table_args__ = (
        UniqueConstraint('employee_id', 'checklist_date', name='uq_daily_checklist_employee_date'),
        Index('ix_checklist_employee_date', 'employee_id', 'checklist_date'),
    )


class DailyChecklistItem(Base):
    """Individual item within a daily checklist"""
    __tablename__ = "daily_checklist_items"

    id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid4
    )
    checklist_id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("daily_checklists.id", ondelete="CASCADE"),
        nullable=False
    )
    description: Mapped[str] = mapped_column(String(500), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    is_required: Mapped[bool] = mapped_column(Boolean, default=True)
    status: Mapped[str] = mapped_column(
        String(20), default="pending"
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    completed_by: Mapped[UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    checklist = relationship("DailyChecklist", back_populates="items")


# ============================================
# Performance Models
# ============================================

class PerformanceReview(Base):
    """Periodic performance evaluation snapshot"""
    __tablename__ = "performance_reviews"

    id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid4
    )
    employee_id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("employees.id", ondelete="CASCADE"),
        nullable=False
    )
    review_period: Mapped[str] = mapped_column(
        String(20), nullable=False
    )
    period_start: Mapped[date] = mapped_column(Date, nullable=False)
    period_end: Mapped[date] = mapped_column(Date, nullable=False)

    # Metric snapshots
    attendance_rate: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=0)
    punctuality_rate: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=0)
    checklist_completion_rate: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=0)
    total_sales_amount: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0)
    total_sales_count: Mapped[int] = mapped_column(Integer, default=0)
    overall_score: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=0)

    # Reviewer
    reviewer_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    reviewed_by: Mapped[UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True
    )
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=get_colombia_now_naive
    )

    # Relationships
    employee = relationship("Employee", back_populates="performance_reviews")

    __table_args__ = (
        Index('ix_performance_employee_period', 'employee_id', 'period_start'),
    )


# ============================================
# Position Responsibility Models
# ============================================

class ResponsibilityCategory(str, Enum):
    """Categories for position responsibilities"""
    CORE = "core"
    ADMINISTRATIVE = "administrative"
    CUSTOMER_SERVICE = "customer_service"
    OPERATIONAL = "operational"


class PositionResponsibility(Base):
    """Fixed responsibilities that define a position's or specific employee's permanent duties"""
    __tablename__ = "position_responsibilities"

    id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid4
    )
    position: Mapped[str | None] = mapped_column(String(100), nullable=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    category: Mapped[str] = mapped_column(String(30), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    # Assignment type: "position" (all employees with position) or "employee" (specific individual)
    assignment_type: Mapped[str] = mapped_column(String(20), default="position")
    employee_id: Mapped[UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("employees.id", ondelete="CASCADE"),
        nullable=True
    )

    created_by: Mapped[UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=get_colombia_now_naive
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=get_colombia_now_naive, onupdate=get_colombia_now_naive
    )

    # Relationships
    assigned_employee = relationship("Employee", foreign_keys=[employee_id])

    __table_args__ = (
        Index('ix_position_responsibility_position', 'position'),
    )
