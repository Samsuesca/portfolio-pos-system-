"""
Payroll Schemas - Employee and Payroll Management
"""
from uuid import UUID
from decimal import Decimal
from datetime import datetime, date
from pydantic import ConfigDict, Field, field_validator
from app.schemas.base import BaseSchema, IDModelSchema
from app.models.payroll import PaymentFrequency, BonusType, PayrollStatus


# ============================================
# Employee Schemas
# ============================================

class EmployeeBase(BaseSchema):
    """Base employee schema"""
    full_name: str = Field(..., min_length=1, max_length=255, example="Carlos Rodríguez")
    document_type: str = Field(default="CC", max_length=10, example="CC")
    document_id: str = Field(..., min_length=1, max_length=50, example="1020456789")
    email: str | None = Field(None, max_length=255, example="carlos.rodriguez@correo.com")
    phone: str | None = Field(None, max_length=50, example="3125551234")
    address: str | None = None

    position: str = Field(..., min_length=1, max_length=100, example="Vendedora")
    hire_date: date

    base_salary: Decimal = Field(..., gt=0, example=1800000.00)
    payment_frequency: PaymentFrequency = PaymentFrequency.MONTHLY
    payment_method: str = Field(default="cash", max_length=20, example="cash")
    bank_name: str | None = Field(None, max_length=100, example="Bancolombia")
    bank_account: str | None = Field(None, max_length=50, example="12345678901")

    health_deduction: Decimal = Field(default=0, ge=0, example=72000.00)
    pension_deduction: Decimal = Field(default=0, ge=0, example=72000.00)
    other_deductions: Decimal = Field(default=0, ge=0, example=0)


class EmployeeCreate(EmployeeBase):
    """Schema for creating an employee"""
    user_id: UUID | None = None


class EmployeeUpdate(BaseSchema):
    """Schema for updating an employee"""
    full_name: str | None = Field(None, min_length=1, max_length=255, example="Andrea Torres")
    document_type: str | None = Field(None, max_length=10, example="CC")
    document_id: str | None = Field(None, min_length=1, max_length=50, example="1020456789")
    email: str | None = Field(None, max_length=255, example="andrea.torres@correo.com")
    phone: str | None = Field(None, max_length=50, example="3189876543")
    address: str | None = None

    position: str | None = Field(None, min_length=1, max_length=100, example="Costurera")
    termination_date: date | None = None
    is_active: bool | None = None

    base_salary: Decimal | None = Field(None, gt=0, example=1900000.00)
    payment_frequency: PaymentFrequency | None = None
    payment_method: str | None = Field(None, max_length=20, example="transfer")
    bank_name: str | None = Field(None, max_length=100, example="Nequi")
    bank_account: str | None = Field(None, max_length=50, example="3189876543")

    health_deduction: Decimal | None = Field(None, ge=0, example=76000.00)
    pension_deduction: Decimal | None = Field(None, ge=0, example=76000.00)
    other_deductions: Decimal | None = Field(None, ge=0, example=0)

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

    model_config = ConfigDict(
        from_attributes=True,
        json_schema_extra={
            "example": {
                "id": "550e8400-e29b-41d4-a716-446655440000",
                "full_name": "Carlos Rodríguez",
                "document_type": "CC",
                "document_id": "1020456789",
                "email": "carlos.rodriguez@correo.com",
                "phone": "3125551234",
                "address": "Cra 45 #23-10, Medellín",
                "position": "Vendedora",
                "hire_date": "2025-03-01",
                "base_salary": 1800000.00,
                "payment_frequency": "monthly",
                "payment_method": "cash",
                "bank_name": None,
                "bank_account": None,
                "health_deduction": 72000.00,
                "pension_deduction": 72000.00,
                "other_deductions": 0,
                "user_id": None,
                "termination_date": None,
                "is_active": True,
                "created_by": "660e8400-e29b-41d4-a716-446655440000",
                "created_at": "2025-03-01T08:00:00",
                "updated_at": "2026-04-12T10:00:00",
                "total_deductions": 144000.00,
            }
        },
    )

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
    name: str = Field(..., min_length=1, max_length=100, example="Auxilio de transporte")
    bonus_type: BonusType
    amount: Decimal = Field(..., gt=0, example=162000.00)
    is_recurring: bool = True
    start_date: date
    end_date: date | None = None
    notes: str | None = None


class EmployeeBonusCreate(EmployeeBonusBase):
    """Schema for creating a bonus"""
    pass


class EmployeeBonusUpdate(BaseSchema):
    """Schema for updating a bonus"""
    name: str | None = Field(None, min_length=1, max_length=100, example="Bono por ventas")
    bonus_type: BonusType | None = None
    amount: Decimal | None = Field(None, gt=0, example=50000.00)
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
    model_config = ConfigDict(
        from_attributes=True,
        json_schema_extra={
            "example": {
                "id": "770e8400-e29b-41d4-a716-446655440000",
                "employee_id": "550e8400-e29b-41d4-a716-446655440000",
                "name": "Auxilio de transporte",
                "bonus_type": "fixed",
                "amount": 162000.00,
                "is_recurring": True,
                "start_date": "2025-03-01",
                "end_date": None,
                "notes": None,
                "is_active": True,
                "created_at": "2025-03-01T08:00:00",
                "updated_at": "2025-03-01T08:00:00",
            }
        },
    )


# ============================================
# Payroll Run Schemas
# ============================================

class PayrollRunCreate(BaseSchema):
    """Schema for creating a payroll run"""
    period_start: date = Field(..., example="2026-04-01")
    period_end: date = Field(..., example="2026-04-30")
    payment_date: date | None = Field(None, example="2026-04-30")
    notes: str | None = Field(None, example="Nómina abril 2026")
    employee_ids: list[UUID] | None = None


class PayrollRunUpdate(BaseSchema):
    """Schema for updating a payroll run (only draft status)"""
    payment_date: date | None = Field(None, example="2026-04-30")
    notes: str | None = Field(None, example="Ajuste de nómina abril")


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
    model_config = ConfigDict(
        from_attributes=True,
        json_schema_extra={
            "example": {
                "id": "880e8400-e29b-41d4-a716-446655440000",
                "period_start": "2026-04-01",
                "period_end": "2026-04-30",
                "payment_date": "2026-04-30",
                "status": "draft",
                "total_base_salary": 3600000.00,
                "total_bonuses": 324000.00,
                "total_deductions": 288000.00,
                "total_net": 3636000.00,
                "employee_count": 2,
                "expense_id": None,
                "notes": "Nómina abril 2026",
                "approved_by": None,
                "approved_at": None,
                "paid_at": None,
                "created_by": "660e8400-e29b-41d4-a716-446655440000",
                "created_at": "2026-04-12T08:00:00",
            }
        },
    )


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
    base_salary: Decimal | None = Field(None, gt=0, example=1800000.00)
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

    model_config = ConfigDict(
        from_attributes=True,
        json_schema_extra={
            "example": {
                "id": "990e8400-e29b-41d4-a716-446655440000",
                "payroll_run_id": "880e8400-e29b-41d4-a716-446655440000",
                "employee_id": "550e8400-e29b-41d4-a716-446655440000",
                "base_salary": 1800000.00,
                "total_bonuses": 162000.00,
                "total_deductions": 144000.00,
                "net_amount": 1818000.00,
                "bonus_breakdown": [{"name": "Auxilio de transporte", "amount": 162000.00}],
                "deduction_breakdown": [
                    {"name": "Salud", "amount": 72000.00},
                    {"name": "Pensión", "amount": 72000.00},
                ],
                "worked_days": 30,
                "daily_rate": 60000.00,
                "is_paid": False,
                "paid_at": None,
                "payment_method": None,
                "payment_reference": None,
                "employee_name": "Carlos Rodríguez",
                "employee_payment_frequency": "monthly",
            }
        },
    )


class PayrollItemPayRequest(BaseSchema):
    """Request to pay a single payroll item"""
    payment_method: str = Field(..., max_length=20, example="transfer")
    payment_reference: str | None = Field(None, max_length=100, example="REF-20260430-001")


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
