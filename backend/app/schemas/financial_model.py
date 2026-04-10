"""
Financial Model Schemas - KPIs, Profitability, Trends, Budgets, Forecasts, Alerts, Executive Summary
"""
from uuid import UUID
from decimal import Decimal
from datetime import datetime, date
from pydantic import Field
from app.schemas.base import BaseSchema, IDModelSchema


# ============================================
# Module 1: KPI Dashboard
# ============================================

class KPIValue(BaseSchema):
    """Single KPI with current value and trend"""
    key: str
    label: str
    value: Decimal
    formatted_value: str
    unit: str = ""  # "%", "$", "days", "ratio"
    trend: list[Decimal] = Field(default_factory=list)
    trend_labels: list[str] = Field(default_factory=list)
    status: str = "neutral"  # "good", "caution", "critical", "neutral"
    tooltip: str = ""


class KPIDashboardResponse(BaseSchema):
    """Full KPI dashboard response"""
    period: str
    generated_at: datetime
    kpis: list[KPIValue]


# ============================================
# Module 2: Profitability by School
# ============================================

class SchoolProfitability(BaseSchema):
    """Profitability metrics for a single school"""
    school_id: UUID
    school_name: str
    revenue: Decimal = Decimal("0")
    cost_of_goods: Decimal = Decimal("0")
    direct_expenses: Decimal = Decimal("0")
    contribution_margin: Decimal = Decimal("0")
    margin_percentage: Decimal = Decimal("0")
    revenue_share: Decimal = Decimal("0")
    monthly_trend: list[dict] = Field(default_factory=list)


class ProfitabilityResponse(BaseSchema):
    """Profitability analysis response"""
    start_date: date
    end_date: date
    total_revenue: Decimal
    schools: list[SchoolProfitability]


# ============================================
# Module 3: Trend Analysis
# ============================================

class TrendDataPoint(BaseSchema):
    """Single data point in a trend series"""
    period: str
    period_label: str
    value: Decimal


class TrendSeries(BaseSchema):
    """A series of trend data"""
    metric: str
    label: str
    data: list[TrendDataPoint]
    growth_rate: Decimal | None = None
    moving_avg_3m: list[Decimal] = Field(default_factory=list)
    moving_avg_6m: list[Decimal] = Field(default_factory=list)


class TrendAnalysisResponse(BaseSchema):
    """Trend analysis response"""
    start_date: date
    end_date: date
    period: str  # "monthly", "quarterly"
    series: list[TrendSeries]
    anomalies: list[dict] = Field(default_factory=list)


# ============================================
# Module 4: Budget vs Actual
# ============================================

class BudgetCreate(BaseSchema):
    """Schema for creating a budget"""
    period_type: str = Field(..., pattern=r'^(monthly|quarterly|annual)$')
    period_start: date
    period_end: date
    category: str = Field(..., min_length=1, max_length=100)
    school_id: UUID | None = None
    budgeted_amount: Decimal = Field(..., gt=0)
    notes: str | None = None


class BudgetUpdate(BaseSchema):
    """Schema for updating a budget"""
    budgeted_amount: Decimal | None = Field(None, gt=0)
    notes: str | None = None


class BudgetResponse(IDModelSchema):
    """Budget for API responses"""
    period_type: str
    period_start: date
    period_end: date
    category: str
    school_id: UUID | None
    budgeted_amount: Decimal
    notes: str | None
    created_by: UUID | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class BudgetVsActualItem(BaseSchema):
    """Single budget vs actual comparison"""
    category: str
    category_label: str
    budgeted: Decimal
    actual: Decimal
    variance: Decimal
    variance_percentage: Decimal
    status: str  # "within", "near_limit", "over", "under_target"


class BudgetVsActualResponse(BaseSchema):
    """Full budget vs actual comparison"""
    period_type: str
    period_start: date
    period_end: date
    items: list[BudgetVsActualItem]
    total_budgeted: Decimal
    total_actual: Decimal
    total_variance: Decimal


# ============================================
# Module 5: Cash Flow Forecast
# ============================================

class ForecastPeriod(BaseSchema):
    """Single period in the forecast"""
    period: str
    period_label: str
    projected_income: Decimal
    projected_expenses: Decimal
    projected_net: Decimal
    projected_balance: Decimal


class CashForecastScenario(BaseSchema):
    """A forecast scenario"""
    name: str  # "optimistic", "expected", "pessimistic"
    label: str
    periods: list[ForecastPeriod]


class CashForecastResponse(BaseSchema):
    """Cash flow forecast response"""
    current_balance: Decimal
    min_threshold: Decimal
    runway_months: Decimal
    scenarios: list[CashForecastScenario]


# ============================================
# Module 6: Financial Health Alerts
# ============================================

class FinancialAlert(BaseSchema):
    """A single financial health alert"""
    alert_type: str
    title: str
    message: str
    severity: str  # "critical", "warning", "info"
    metric_value: str
    threshold: str
    recommendation: str = ""


class HealthAlertsResponse(BaseSchema):
    """Financial health alerts response"""
    generated_at: datetime
    alerts: list[FinancialAlert]
    critical_count: int = 0
    warning_count: int = 0
    info_count: int = 0


# ============================================
# Module 7: Executive Summary
# ============================================

class TopItem(BaseSchema):
    """Top item (school or category)"""
    name: str
    amount: Decimal
    percentage: Decimal


class ExecutiveSummaryResponse(BaseSchema):
    """Executive summary response"""
    period: str
    period_label: str
    generated_at: datetime

    # Key figures
    revenue: Decimal
    expenses: Decimal
    net_profit: Decimal
    cash_position: Decimal

    # Comparisons
    revenue_vs_previous: Decimal | None = None
    expenses_vs_previous: Decimal | None = None
    profit_vs_previous: Decimal | None = None

    # Top items
    top_schools: list[TopItem]
    top_expense_categories: list[TopItem]

    # KPI snapshot
    kpi_snapshot: list[KPIValue]

    # Alerts
    active_alerts: list[FinancialAlert]

    # Forecast
    forecast_summary: str = ""
