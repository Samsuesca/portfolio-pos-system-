"""
Payroll Models - Employee and Payroll Management
"""
from uuid import uuid4
from datetime import datetime, date
from decimal import Decimal
from enum import Enum
from sqlalchemy import String, Text, Integer, Numeric, Boolean, Date, DateTime, ForeignKey, JSON, Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base
from app.utils.timezone import get_colombia_now_naive


class PaymentFrequency(str, Enum):
    """Payment frequency for employee salaries"""
    DAILY = "daily"
    WEEKLY = "weekly"
    BIWEEKLY = "biweekly"
    MONTHLY = "monthly"


class BonusType(str, Enum):
    """Types of employee bonuses"""
    FIXED = "fixed"           # Fixed recurring bonus (transport, food)
    VARIABLE = "variable"     # Variable bonus (performance-based)
    ONE_TIME = "one_time"     # One-time bonus


class PayrollStatus(str, Enum):
    """Status of a payroll run"""
    DRAFT = "draft"           # Draft, editable
    APPROVED = "approved"     # Approved, ready to pay
    PAID = "paid"             # Paid
    CANCELLED = "cancelled"   # Cancelled


class Employee(Base):
    """Employee model for payroll management"""
    __tablename__ = "employees"

    id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid4
    )

    # Optional link to User (for vendors/staff with system access)
    user_id: Mapped[UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True
    )

    # Personal information
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    document_type: Mapped[str] = mapped_column(String(10), default="CC")  # CC, CE, NIT
    document_id: Mapped[str] = mapped_column(String(50), nullable=False, unique=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    address: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Employment information
    position: Mapped[str] = mapped_column(String(100), nullable=False)
    hire_date: Mapped[date] = mapped_column(Date, nullable=False)
    termination_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    # Compensation
    base_salary: Mapped[Decimal] = mapped_column(
        Numeric(15, 2),
        nullable=False
    )
    payment_frequency: Mapped[PaymentFrequency] = mapped_column(
        SAEnum(
            PaymentFrequency,
            name='payment_frequency_enum',
            values_callable=lambda x: [e.value for e in x],
            create_constraint=False
        ),
        default=PaymentFrequency.MONTHLY
    )
    payment_method: Mapped[str] = mapped_column(
        String(20),
        default="cash"
    )  # cash, transfer, nequi
    bank_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    bank_account: Mapped[str | None] = mapped_column(String(50), nullable=True)

    # Deductions (manual values)
    health_deduction: Mapped[Decimal] = mapped_column(
        Numeric(15, 2),
        default=0
    )
    pension_deduction: Mapped[Decimal] = mapped_column(
        Numeric(15, 2),
        default=0
    )
    other_deductions: Mapped[Decimal] = mapped_column(
        Numeric(15, 2),
        default=0
    )

    # Audit fields
    created_by: Mapped[UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=get_colombia_now_naive
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=get_colombia_now_naive,
        onupdate=get_colombia_now_naive
    )

    # Relationships
    user = relationship("User", foreign_keys=[user_id], lazy="joined")
    bonuses = relationship("EmployeeBonus", back_populates="employee", lazy="selectin")
    payroll_items = relationship("PayrollItem", back_populates="employee", lazy="selectin")

    # Workforce Management relationships
    schedules = relationship("EmployeeSchedule", back_populates="employee")
    attendance_records = relationship("AttendanceRecord", back_populates="employee")
    absence_records = relationship("AbsenceRecord", back_populates="employee")
    daily_checklists = relationship("DailyChecklist", back_populates="employee")
    performance_reviews = relationship("PerformanceReview", back_populates="employee")


class EmployeeBonus(Base):
    """Employee bonus configuration"""
    __tablename__ = "employee_bonuses"

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

    name: Mapped[str] = mapped_column(String(100), nullable=False)
    bonus_type: Mapped[BonusType] = mapped_column(
        SAEnum(
            BonusType,
            name='bonus_type_enum',
            values_callable=lambda x: [e.value for e in x],
            create_constraint=False
        ),
        nullable=False
    )
    amount: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False)
    is_recurring: Mapped[bool] = mapped_column(Boolean, default=True)

    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date | None] = mapped_column(Date, nullable=True)  # None = indefinite
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=get_colombia_now_naive
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=get_colombia_now_naive,
        onupdate=get_colombia_now_naive
    )

    # Relationships
    employee = relationship("Employee", back_populates="bonuses")


class PayrollRun(Base):
    """Payroll run (liquidation) for a period"""
    __tablename__ = "payroll_runs"

    id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid4
    )

    # Period
    period_start: Mapped[date] = mapped_column(Date, nullable=False)
    period_end: Mapped[date] = mapped_column(Date, nullable=False)
    payment_date: Mapped[date | None] = mapped_column(Date, nullable=True)

    status: Mapped[PayrollStatus] = mapped_column(
        SAEnum(
            PayrollStatus,
            name='payroll_status_enum',
            values_callable=lambda x: [e.value for e in x],
            create_constraint=False
        ),
        default=PayrollStatus.DRAFT
    )

    # Calculated totals
    total_base_salary: Mapped[Decimal] = mapped_column(
        Numeric(15, 2),
        default=0
    )
    total_bonuses: Mapped[Decimal] = mapped_column(
        Numeric(15, 2),
        default=0
    )
    total_deductions: Mapped[Decimal] = mapped_column(
        Numeric(15, 2),
        default=0
    )
    total_net: Mapped[Decimal] = mapped_column(
        Numeric(15, 2),
        default=0
    )
    employee_count: Mapped[int] = mapped_column(Integer, default=0)

    # Link to generated expense (created when approved)
    expense_id: Mapped[UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("expenses.id", ondelete="SET NULL"),
        nullable=True
    )

    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Approval info
    approved_by: Mapped[UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True
    )
    approved_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    paid_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    # Audit
    created_by: Mapped[UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=get_colombia_now_naive
    )

    # Relationships
    items = relationship("PayrollItem", back_populates="payroll_run", lazy="selectin")
    expense = relationship("Expense", lazy="joined")


class PayrollItem(Base):
    """Individual employee payroll item within a payroll run"""
    __tablename__ = "payroll_items"

    id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid4
    )
    payroll_run_id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("payroll_runs.id", ondelete="CASCADE"),
        nullable=False
    )
    employee_id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("employees.id", ondelete="CASCADE"),
        nullable=False
    )

    # Values for the period
    base_salary: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False)
    total_bonuses: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0)
    total_deductions: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0)
    net_amount: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False)

    # Breakdown details (JSON for flexibility)
    bonus_breakdown: Mapped[dict | None] = mapped_column(
        JSON,
        nullable=True
    )  # [{"name": "Transporte", "amount": 100000}, ...]
    deduction_breakdown: Mapped[dict | None] = mapped_column(
        JSON,
        nullable=True
    )  # [{"name": "Salud", "amount": 50000}, ...]

    # Days-based calculation (for daily-paid employees)
    worked_days: Mapped[int | None] = mapped_column(Integer, nullable=True)
    daily_rate: Mapped[Decimal | None] = mapped_column(Numeric(15, 2), nullable=True)

    # Individual payment status
    is_paid: Mapped[bool] = mapped_column(Boolean, default=False)
    paid_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    payment_method: Mapped[str | None] = mapped_column(String(20), nullable=True)
    payment_reference: Mapped[str | None] = mapped_column(String(100), nullable=True)

    # Relationships
    payroll_run = relationship("PayrollRun", back_populates="items")
    employee = relationship("Employee", back_populates="payroll_items", lazy="joined")
