"""
Fixed Expense Schemas - Recurring/Periodic Expense Templates
"""
from uuid import UUID
from decimal import Decimal
from datetime import datetime, date
from pydantic import Field, field_validator, model_validator
from app.schemas.base import BaseSchema, IDModelSchema
from app.models.accounting import ExpenseCategory
from app.models.fixed_expense import (
    FixedExpenseType,
    ExpenseFrequency,
    RecurrenceFrequency,
    WeekDay,
    MonthDayType,
)


# ============================================
# Fixed Expense Schemas
# ============================================

class FixedExpenseBase(BaseSchema):
    """Base fixed expense schema"""
    name: str = Field(..., min_length=1, max_length=255)
    description: str | None = None
    category: ExpenseCategory
    expense_type: FixedExpenseType = FixedExpenseType.EXACT

    # Amount configuration
    amount: Decimal = Field(..., gt=0)
    min_amount: Decimal | None = Field(None, ge=0)
    max_amount: Decimal | None = Field(None, ge=0)

    # === LEGACY: Simple frequency (for backward compatibility) ===
    frequency: ExpenseFrequency | None = ExpenseFrequency.MONTHLY
    day_of_month: int | None = Field(None, ge=1, le=31)

    # === NEW: Advanced Recurrence System ===
    recurrence_frequency: RecurrenceFrequency | None = None
    recurrence_interval: int | None = Field(None, ge=1, le=365)
    recurrence_weekdays: list[WeekDay] | None = None
    recurrence_month_days: list[int] | None = None
    recurrence_month_day_type: MonthDayType | None = None
    recurrence_months: list[int] | None = None
    recurrence_start_date: date | None = None
    recurrence_end_date: date | None = None
    recurrence_max_occurrences: int | None = Field(None, ge=1)

    # Auto-generation
    auto_generate: bool = True
    next_generation_date: date | None = None

    # Vendor info
    vendor: str | None = Field(None, max_length=255)


class FixedExpenseCreate(FixedExpenseBase):
    """Schema for creating a fixed expense template"""

    @model_validator(mode='after')
    def validate_variable_expense(self):
        """Validate that variable expenses have min/max range"""
        if self.expense_type == FixedExpenseType.VARIABLE:
            if self.min_amount is None or self.max_amount is None:
                raise ValueError(
                    "Variable expenses must have min_amount and max_amount defined"
                )
            if self.min_amount > self.max_amount:
                raise ValueError(
                    "min_amount must be less than or equal to max_amount"
                )
        return self

    @model_validator(mode='after')
    def validate_amount_in_range(self):
        """Validate that amount is within range for variable expenses"""
        if self.expense_type == FixedExpenseType.VARIABLE:
            if self.min_amount and self.max_amount:
                if not (self.min_amount <= self.amount <= self.max_amount):
                    raise ValueError(
                        "amount must be between min_amount and max_amount for variable expenses"
                    )
        return self


class FixedExpenseUpdate(BaseSchema):
    """Schema for updating a fixed expense template"""
    name: str | None = Field(None, min_length=1, max_length=255)
    description: str | None = None
    category: ExpenseCategory | None = None
    expense_type: FixedExpenseType | None = None

    amount: Decimal | None = Field(None, gt=0)
    min_amount: Decimal | None = Field(None, ge=0)
    max_amount: Decimal | None = Field(None, ge=0)

    # Legacy frequency
    frequency: ExpenseFrequency | None = None
    day_of_month: int | None = Field(None, ge=1, le=31)

    # New recurrence system
    recurrence_frequency: RecurrenceFrequency | None = None
    recurrence_interval: int | None = Field(None, ge=1, le=365)
    recurrence_weekdays: list[WeekDay] | None = None
    recurrence_month_days: list[int] | None = None
    recurrence_month_day_type: MonthDayType | None = None
    recurrence_months: list[int] | None = None
    recurrence_start_date: date | None = None
    recurrence_end_date: date | None = None
    recurrence_max_occurrences: int | None = Field(None, ge=1)

    auto_generate: bool | None = None
    next_generation_date: date | None = None

    vendor: str | None = Field(None, max_length=255)
    is_active: bool | None = None


class FixedExpenseInDB(FixedExpenseBase, IDModelSchema):
    """Fixed expense as stored in database"""
    last_generated_date: date | None
    is_active: bool
    created_by: UUID | None
    created_at: datetime
    updated_at: datetime
    recurrence_occurrences_generated: int = 0


class FixedExpenseResponse(FixedExpenseInDB):
    """Fixed expense for API responses"""
    # Computed fields for UI convenience
    uses_new_recurrence: bool = False
    is_expired: bool = False

    model_config = {"from_attributes": True}


class FixedExpenseListResponse(BaseSchema):
    """Simplified fixed expense for listings"""
    id: UUID
    name: str
    category: ExpenseCategory
    expense_type: FixedExpenseType
    amount: Decimal
    min_amount: Decimal | None
    max_amount: Decimal | None
    # Legacy
    frequency: ExpenseFrequency | None
    day_of_month: int | None
    # New recurrence
    recurrence_frequency: RecurrenceFrequency | None = None
    recurrence_interval: int | None = None
    recurrence_weekdays: list[WeekDay] | None = None
    recurrence_month_days: list[int] | None = None
    recurrence_month_day_type: MonthDayType | None = None
    # Common
    vendor: str | None
    auto_generate: bool
    next_generation_date: date | None
    last_generated_date: date | None
    is_active: bool
    # Computed
    uses_new_recurrence: bool = False


class FixedExpenseWithStats(FixedExpenseResponse):
    """Fixed expense with generation statistics"""
    total_generated: int = 0
    total_amount_generated: Decimal = Decimal("0")
    last_expense_id: UUID | None = None


# ============================================
# Generation Request/Response Schemas
# ============================================

class GenerateExpensesRequest(BaseSchema):
    """Request schema for generating expenses from templates"""
    fixed_expense_ids: list[UUID] | None = None  # None = generate all active
    target_date: date | None = None  # None = current month
    override_amounts: dict[str, Decimal] | None = None  # {fixed_expense_id: amount}


class GeneratedExpenseInfo(BaseSchema):
    """Info about a generated expense"""
    fixed_expense_id: UUID
    fixed_expense_name: str
    expense_id: UUID
    amount: Decimal
    expense_date: date
    due_date: date | None


class GenerateExpensesResponse(BaseSchema):
    """Response schema for expense generation"""
    generated_count: int
    skipped_count: int
    generated_expenses: list[GeneratedExpenseInfo]
    skipped_reasons: dict[str, str]  # {fixed_expense_id: reason}


class PendingGenerationItem(BaseSchema):
    """Item showing a fixed expense pending generation"""
    id: UUID
    name: str
    category: ExpenseCategory
    expense_type: FixedExpenseType
    amount: Decimal
    min_amount: Decimal | None
    max_amount: Decimal | None
    frequency: ExpenseFrequency
    next_generation_date: date | None
    last_generated_date: date | None
    days_overdue: int  # 0 if not overdue, positive if overdue


class PendingGenerationResponse(BaseSchema):
    """Response showing all fixed expenses pending generation"""
    pending_count: int
    overdue_count: int
    items: list[PendingGenerationItem]
