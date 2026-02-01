"""
Planning Schemas - Financial Planning and Projections

Schemas for:
- Sales seasonality analysis
- Cash flow projections
- Debt payment scheduling
"""
from datetime import date, datetime
from decimal import Decimal
from uuid import UUID
from pydantic import Field, field_validator

from app.schemas.base import BaseSchema


# ============================================
# Debt Payment Schedule Schemas
# ============================================

class DebtPaymentBase(BaseSchema):
    """Base schema for debt payments"""
    description: str = Field(..., min_length=1, max_length=500)
    creditor: str | None = Field(None, max_length=255)
    amount: Decimal = Field(..., gt=0, description="Payment amount")
    due_date: date
    is_recurring: bool = False
    recurrence_day: int | None = Field(None, ge=1, le=28, description="Day of month for recurring payments")
    category: str | None = Field(None, max_length=100)
    notes: str | None = None
    balance_account_id: UUID | None = None
    accounts_payable_id: UUID | None = None

    @field_validator('recurrence_day')
    @classmethod
    def validate_recurrence_day(cls, v, info):
        if info.data.get('is_recurring') and v is None:
            raise ValueError('recurrence_day is required for recurring payments')
        return v


class DebtPaymentCreate(DebtPaymentBase):
    """Schema for creating a debt payment"""
    pass


class DebtPaymentUpdate(BaseSchema):
    """Schema for updating a debt payment"""
    description: str | None = Field(None, min_length=1, max_length=500)
    creditor: str | None = Field(None, max_length=255)
    amount: Decimal | None = Field(None, gt=0)
    due_date: date | None = None
    is_recurring: bool | None = None
    recurrence_day: int | None = Field(None, ge=1, le=28)
    category: str | None = Field(None, max_length=100)
    notes: str | None = None
    status: str | None = Field(None, pattern='^(pending|paid|overdue|cancelled)$')


class DebtPaymentMarkPaid(BaseSchema):
    """Schema for marking a debt payment as paid"""
    paid_date: date
    paid_amount: Decimal = Field(..., gt=0)
    payment_method: str = Field(..., pattern='^(cash|nequi|transfer|card)$')
    payment_account_id: UUID


class DebtPaymentResponse(DebtPaymentBase):
    """Response schema for debt payment"""
    id: UUID
    status: str
    paid_date: date | None = None
    paid_amount: Decimal | None = None
    payment_method: str | None = None
    payment_account_id: UUID | None = None
    created_by: UUID | None = None
    created_at: datetime
    updated_at: datetime
    days_until_due: int | None = None  # Computed field


class DebtPaymentListResponse(BaseSchema):
    """Response schema for list of debt payments"""
    items: list[DebtPaymentResponse]
    total: int
    pending_total: Decimal = Field(..., description="Total amount of pending payments")
    overdue_total: Decimal = Field(..., description="Total amount of overdue payments")
    next_due: DebtPaymentResponse | None = None


# ============================================
# Sales Seasonality Schemas
# ============================================

class MonthlySalesData(BaseSchema):
    """Sales data for a single month"""
    year: int
    month: int
    month_name: str
    total_sales: Decimal
    sales_count: int
    average_sale: Decimal


class SeasonalityPattern(BaseSchema):
    """Seasonality pattern information"""
    period: str  # "Enero-Febrero", "Julio-Agosto", etc.
    percentage: Decimal  # % of annual sales
    behavior: str  # "ALTA", "MEDIA", "BAJA"


class SalesSeasonalityResponse(BaseSchema):
    """Response for sales seasonality analysis"""
    monthly_data: list[MonthlySalesData]
    yearly_totals: dict[int, Decimal]  # year -> total
    patterns: list[SeasonalityPattern]
    growth_rates: dict[str, Decimal]  # "2023-2024" -> percentage
    disclaimer: str = "Datos históricos aproximados - migración en proceso"


# ============================================
# Cash Flow Projection Schemas
# ============================================

class MonthlyProjection(BaseSchema):
    """Projected cash flow for a single month"""
    year: int
    month: int
    month_name: str

    # Income projections
    projected_sales: Decimal
    projected_income: Decimal  # May include other income

    # Expense projections
    fixed_expenses: Decimal
    debt_payments: Decimal
    projected_expenses: Decimal

    # Net flow
    net_flow: Decimal

    # Cumulative balance
    opening_balance: Decimal
    closing_balance: Decimal

    # Alerts
    is_below_threshold: bool = False
    has_debt_due: bool = False
    alert_message: str | None = None


class CashProjectionRequest(BaseSchema):
    """Request parameters for cash flow projection"""
    months: int = Field(6, ge=1, le=12, description="Number of months to project")
    growth_factor: Decimal = Field(
        Decimal("1.20"),
        ge=Decimal("0.5"),
        le=Decimal("3.0"),
        description="Growth factor vs previous year (1.20 = +20%)"
    )
    liquidity_threshold: Decimal = Field(
        Decimal("5000000"),
        ge=0,
        description="Minimum desired liquidity"
    )
    include_pending_receivables: bool = Field(
        True,
        description="Include expected income from accounts receivable"
    )


class CashProjectionResponse(BaseSchema):
    """Response for cash flow projection"""
    projections: list[MonthlyProjection]

    # Summary
    current_liquidity: Decimal
    projected_end_balance: Decimal
    total_projected_income: Decimal
    total_projected_expenses: Decimal
    total_debt_payments: Decimal

    # Parameters used
    growth_factor: Decimal
    liquidity_threshold: Decimal

    # Alerts
    months_below_threshold: list[str]  # Month names
    upcoming_debt_payments: list[DebtPaymentResponse]

    disclaimer: str = "Proyección basada en datos históricos aproximados"


# ============================================
# Fixed Expenses Summary
# ============================================

class FixedExpenseSummary(BaseSchema):
    """Summary of fixed expenses by category"""
    category: str
    category_display: str  # Human-readable name
    monthly_total: Decimal
    expense_count: int
    items: list[dict]  # Individual fixed expenses


class FixedExpensesSummaryResponse(BaseSchema):
    """Response for fixed expenses summary"""
    categories: list[FixedExpenseSummary]
    total_monthly: Decimal
    total_annual: Decimal


# ============================================
# Planning Dashboard
# ============================================

class PlanningDashboardResponse(BaseSchema):
    """Combined planning dashboard data"""
    # Current state
    current_liquidity: Decimal
    current_date: date

    # Fixed expenses
    fixed_expenses_monthly: Decimal

    # Debt
    pending_debt_total: Decimal
    next_debt_payment: DebtPaymentResponse | None

    # Quick projection (next 3 months)
    quick_projection: list[MonthlyProjection]

    # Seasonality hint
    current_season: str  # "ALTA", "MEDIA", "BAJA"
    season_message: str
