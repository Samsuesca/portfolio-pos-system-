"""
Payroll Schemas - Employee and Payroll Management
"""
from uuid import UUID
from decimal import Decimal
from datetime import datetime, date
from pydantic import Field, field_validator
from app.schemas.base import BaseSchema, IDModelSchema
from app.models.payroll import PaymentFrequency, BonusType, PayrollStatus


# ============================================
# Employee Schemas
# ============================================

class EmployeeBase(BaseSchema):
    """Base employee schema"""
    full_name: str = Field(..., min_length=1, max_length=255)
    document_type: str = Field(default="CC", max_length=10)
    document_id: str = Field(..., min_length=1, max_length=50)
    email: str | None = Field(None, max_length=255)
    phone: str | None = Field(None, max_length=50)
    address: str | None = None

    position: str = Field(..., min_length=1, max_length=100)
    hire_date: date

    base_salary: Decimal = Field(..., gt=0)
    payment_frequency: PaymentFrequency = PaymentFrequency.MONTHLY
    payment_method: str = Field(default="cash", max_length=20)
    bank_name: str | None = Field(None, max_length=100)
    bank_account: str | None = Field(None, max_length=50)

    health_deduction: Decimal = Field(default=0, ge=0)
    pension_deduction: Decimal = Field(default=0, ge=0)
    other_deductions: Decimal = Field(default=0, ge=0)


class EmployeeCreate(EmployeeBase):
    """Schema for creating an employee"""
    user_id: UUID | None = None


class EmployeeUpdate(BaseSchema):
    """Schema for updating an employee"""
    full_name: str | None = Field(None, min_length=1, max_length=255)
    document_type: str | None = Field(None, max_length=10)
    document_id: str | None = Field(None, min_length=1, max_length=50)
    email: str | None = Field(None, max_length=255)
    phone: str | None = Field(None, max_length=50)
    address: str | None = None

    position: str | None = Field(None, min_length=1, max_length=100)
    termination_date: date | None = None
    is_active: bool | None = None

    base_salary: Decimal | None = Field(None, gt=0)
    payment_frequency: PaymentFrequency | None = None
    payment_method: str | None = Field(None, max_length=20)
    bank_name: str | None = Field(None, max_length=100)
    bank_account: str | None = Field(None, max_length=50)

    health_deduction: Decimal | None = Field(None, ge=0)
    pension_deduction: Decimal | None = Field(None, ge=0)
    other_deductions: Decimal | None = Field(None, ge=0)

    # User linking - allows updating the linked user
    user_id: UUID | None = None


class EmployeeInDB(EmployeeBase, IDModelSchema):
    """Employee as stored in database"""
    user_id: UUID | None
    termination_date: date | None
    is_active: bool
    created_by: UUID | None
    created_at: datetime
    updated_at: datetime


class EmployeeResponse(EmployeeInDB):
    """Employee for API responses"""
    total_deductions: Decimal = Field(default=0)

    model_config = {"from_attributes": True}

    @field_validator("total_deductions", mode="before")
    @classmethod
    def compute_total_deductions(cls, v, info):
        if v:
            return v
        data = info.data
        return (
            Decimal(str(data.get("health_deduction", 0) or 0)) +
            Decimal(str(data.get("pension_deduction", 0) or 0)) +
            Decimal(str(data.get("other_deductions", 0) or 0))
        )


class EmployeeListResponse(BaseSchema):
    """Simplified employee for listings"""
    id: UUID
    full_name: str
    document_id: str
    position: str
    hire_date: date
    base_salary: Decimal
    payment_frequency: PaymentFrequency
    is_active: bool


# ============================================
# Employee Bonus Schemas
# ============================================

class EmployeeBonusBase(BaseSchema):
    """Base bonus schema"""
    name: str = Field(..., min_length=1, max_length=100)
    bonus_type: BonusType
    amount: Decimal = Field(..., gt=0)
    is_recurring: bool = True
    start_date: date
    end_date: date | None = None
    notes: str | None = None


class EmployeeBonusCreate(EmployeeBonusBase):
    """Schema for creating a bonus"""
    pass


class EmployeeBonusUpdate(BaseSchema):
    """Schema for updating a bonus"""
    name: str | None = Field(None, min_length=1, max_length=100)
    bonus_type: BonusType | None = None
    amount: Decimal | None = Field(None, gt=0)
    is_recurring: bool | None = None
    end_date: date | None = None
    is_active: bool | None = None
    notes: str | None = None


class EmployeeBonusInDB(EmployeeBonusBase, IDModelSchema):
    """Bonus as stored in database"""
    employee_id: UUID
    is_active: bool
    created_at: datetime
    updated_at: datetime


class EmployeeBonusResponse(EmployeeBonusInDB):
    """Bonus for API responses"""
    model_config = {"from_attributes": True}


# ============================================
# Payroll Run Schemas
# ============================================

class PayrollRunCreate(BaseSchema):
    """Schema for creating a payroll run"""
    period_start: date
    period_end: date
    payment_date: date | None = None
    notes: str | None = None
    employee_ids: list[UUID] | None = None  # None = all active employees


class PayrollRunUpdate(BaseSchema):
    """Schema for updating a payroll run (only draft status)"""
    payment_date: date | None = None
    notes: str | None = None


class PayrollRunInDB(IDModelSchema):
    """Payroll run as stored in database"""
    period_start: date
    period_end: date
    payment_date: date | None
    status: PayrollStatus
    total_base_salary: Decimal
    total_bonuses: Decimal
    total_deductions: Decimal
    total_net: Decimal
    employee_count: int
    expense_id: UUID | None
    notes: str | None
    approved_by: UUID | None
    approved_at: datetime | None
    paid_at: datetime | None
    created_by: UUID | None
    created_at: datetime


class PayrollRunResponse(PayrollRunInDB):
    """Payroll run for API responses"""
    model_config = {"from_attributes": True}


class PayrollRunListResponse(BaseSchema):
    """Simplified payroll run for listings"""
    id: UUID
    period_start: date
    period_end: date
    payment_date: date | None
    status: PayrollStatus
    total_net: Decimal
    employee_count: int
    created_at: datetime


# ============================================
# Payroll Item Schemas
# ============================================

class BonusBreakdownItem(BaseSchema):
    """Item in bonus breakdown"""
    name: str
    amount: Decimal


class DeductionBreakdownItem(BaseSchema):
    """Item in deduction breakdown"""
    name: str
    amount: Decimal


class PayrollItemBase(BaseSchema):
    """Base payroll item schema"""
    base_salary: Decimal
    total_bonuses: Decimal = Field(default=0)
    total_deductions: Decimal = Field(default=0)
    net_amount: Decimal


class PayrollItemUpdate(BaseSchema):
    """Schema for updating a payroll item"""
    base_salary: Decimal | None = Field(None, gt=0)
    bonus_breakdown: list[BonusBreakdownItem] | None = None
    deduction_breakdown: list[DeductionBreakdownItem] | None = None


class PayrollItemInDB(PayrollItemBase, IDModelSchema):
    """Payroll item as stored in database"""
    payroll_run_id: UUID
    employee_id: UUID
    bonus_breakdown: list[dict] | None
    deduction_breakdown: list[dict] | None
    # Days-based calculation info
    worked_days: int | None = None
    daily_rate: Decimal | None = None
    # Payment status
    is_paid: bool
    paid_at: datetime | None
    payment_method: str | None
    payment_reference: str | None


class PayrollItemResponse(PayrollItemInDB):
    """Payroll item for API responses"""
    employee_name: str | None = None
    employee_payment_frequency: str | None = None

    model_config = {"from_attributes": True}


class PayrollItemPayRequest(BaseSchema):
    """Request to pay a single payroll item"""
    payment_method: str = Field(..., max_length=20)
    payment_reference: str | None = Field(None, max_length=100)


# ============================================
# Payroll Run Detail Response
# ============================================

class PayrollRunDetailResponse(PayrollRunResponse):
    """Detailed payroll run with items"""
    items: list[PayrollItemResponse] = []


# ============================================
# Summary Schemas
# ============================================

class EmployeeSummary(BaseSchema):
    """Employee summary for payroll"""
    id: UUID
    full_name: str
    position: str
    base_salary: Decimal
    total_bonuses: Decimal
    total_deductions: Decimal
    net_amount: Decimal


class PayrollSummary(BaseSchema):
    """Summary of payroll data"""
    active_employees: int
    total_monthly_payroll: Decimal
    pending_payroll_runs: int
    last_payroll_date: date | None
