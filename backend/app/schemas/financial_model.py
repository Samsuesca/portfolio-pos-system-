"""
Financial Model Schemas - KPIs, Profitability, Trends, Budgets, Forecasts, Alerts, Executive Summary
"""
from uuid import UUID
from decimal import Decimal
from datetime import datetime, date
from pydantic import Field, model_validator
from app.schemas.base import BaseSchema, IDModelSchema


# ============================================
# Module 1: KPI Dashboard
# ============================================

class KPIValue(BaseSchema):
    """Single KPI with current value and trend.

    `value` puede ser `None` cuando el cálculo no aplica (denominador cero,
    datos faltantes). En ese caso `formatted_value` debe ser `"—"` y el frontend
    muestra `tooltip_unavailable` al hacer hover.
    """
    key: str
    label: str
    value: Decimal | None
    formatted_value: str
    unit: str = ""  # "%", "$", "days", "ratio"
    trend: list[Decimal] = Field(default_factory=list)
    trend_labels: list[str] = Field(default_factory=list)
    status: str = "neutral"  # "good", "caution", "critical", "neutral"
    tooltip: str = ""
    tooltip_unavailable: str | None = None


class KPIDashboardResponse(BaseSchema):
    """Full KPI dashboard response"""
    period: str
    period_label: str | None = None
    period_warning: str | None = None
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
    """Cash flow forecast response.

    `runway_months` es None cuando el negocio es rentable (no hay quema)
    o cuando faltan datos para calcular. El frontend debe usar
    `is_profitable` para decidir el copy.
    """
    current_balance: Decimal
    min_threshold: Decimal
    runway_months: Decimal | None
    is_profitable: bool = False
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
    # Aviso de mes parcial cuando el período cae en el mes en curso.
    # El frontend muestra un banner amarillo y suaviza las comparaciones MoM.
    period_warning: str | None = None
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


# ============================================
# Module 8: Multi-Month Projections (formalization-aware)
# ============================================

class ProjectionHire(BaseSchema):
    """A planned hire (or compensation phase) in the projection horizon.

    To model a phase change (e.g. Felipe at $1M months 0-5, then $1.75M+parafiscales months 6-11),
    add TWO hires with the same role and disjoint [month_offset, end_month_offset] windows.
    """
    month_offset: int = Field(..., ge=0, description="Months from start_year/start_month (0-indexed)")
    end_month_offset: int | None = Field(
        default=None,
        ge=0,
        description=(
            "Last month (inclusive, 0-indexed) where this hire/phase is active. "
            "None = active indefinitely from month_offset onwards."
        ),
    )
    role: str
    monthly_salary: Decimal
    parafiscales_pct: Decimal = Decimal("0.30")

    @model_validator(mode="after")
    def _validate_window(self) -> "ProjectionHire":
        if self.end_month_offset is not None and self.end_month_offset < self.month_offset:
            raise ValueError(
                f"end_month_offset ({self.end_month_offset}) must be >= "
                f"month_offset ({self.month_offset})"
            )
        return self


class ProjectionDebt(BaseSchema):
    """A debt instrument in the projection (existing or planned)."""
    name: str
    capital: Decimal
    monthly_payment: Decimal
    interest_portion_monthly: Decimal
    capital_portion_monthly: Decimal
    starts_month_offset: int = 0
    term_months: int | None = None  # None = bullet (capital al final)


class ProjectionNewBranch(BaseSchema):
    """A new branch opening in the projection horizon."""
    month_offset: int = Field(..., ge=0)
    name: str
    fixed_costs_monthly: Decimal
    payroll_monthly: Decimal
    revenue_ramp: list[Decimal] = Field(
        default_factory=list,
        description="Monthly revenue from opening (idx 0 = month of opening). Empty = full from day 1."
    )


class FormalizationOneTimeCost(BaseSchema):
    month_offset: int
    concept: str
    amount: Decimal


class FormalizationRecurringCost(BaseSchema):
    concept: str
    amount_monthly: Decimal
    starts_month_offset: int = 0
    ends_month_offset: int | None = None


class ProjectionFormalizationLayer(BaseSchema):
    """Costs of formalization (matches scenarios A/B/C from financial-impact.md)."""
    scenario_label: str = "B"  # "A" minimo viable, "B" completa, "C" B2B premium, "custom"
    one_time_costs: list[FormalizationOneTimeCost] = Field(default_factory=list)
    recurring_costs: list[FormalizationRecurringCost] = Field(default_factory=list)


class ProjectionAssumptions(BaseSchema):
    """Inputs for a financial projection."""
    name: str = Field(..., max_length=200)
    start_year: int
    start_month: int = Field(..., ge=1, le=12)
    months: int = Field(default=12, ge=1, le=36)

    # Revenue
    base_revenue_monthly: Decimal = Field(..., gt=0)
    seasonality: dict[int, float] = Field(
        default_factory=lambda: {m: 1.0 for m in range(1, 13)},
        description="Multiplier per month {1..12}; 1.0 = neutral",
    )
    growth_rate_monthly: float = 0.0  # ej. 0.02 = 2% MoM

    # COGS / margin
    cogs_pct: float = Field(default=0.62, ge=0, le=1)

    # Fixed costs
    fixed_costs_monthly: Decimal = Field(default=Decimal("0"))

    # Personnel
    payroll_monthly_base: Decimal = Field(default=Decimal("0"))
    hiring_plan: list[ProjectionHire] = Field(default_factory=list)

    # Expansion
    new_branches: list[ProjectionNewBranch] = Field(default_factory=list)

    # Debt
    debts: list[ProjectionDebt] = Field(default_factory=list)

    # Formalization layer
    formalization_layer: ProjectionFormalizationLayer | None = None

    # Macro
    inflation_annual: float = 0.06
    initial_cash: Decimal = Field(default=Decimal("0"))


class ProjectionMonth(BaseSchema):
    """Single month projection result."""
    year: int
    month: int
    period_label: str

    # Revenue & COGS
    revenue: Decimal
    cogs: Decimal
    gross_profit: Decimal
    gross_margin_pct: float

    # OpEx
    fixed_costs: Decimal
    payroll: Decimal
    formalization_cost_one_time: Decimal
    formalization_cost_recurring: Decimal
    total_opex: Decimal

    # Operating result
    operating_profit: Decimal
    operating_margin_pct: float

    # Financial
    interest_expense: Decimal
    debt_capital_payment: Decimal

    # Net
    net_profit: Decimal
    net_margin_pct: float

    # Cash
    cash_inflow: Decimal
    cash_outflow: Decimal
    net_cash_flow: Decimal
    cumulative_cash: Decimal

    # Headcount
    headcount: int

    # Flags
    below_breakeven: bool
    cash_negative: bool


class ProjectionSummary(BaseSchema):
    """Aggregate summary across all months."""
    total_revenue: Decimal
    total_cogs: Decimal
    total_gross_profit: Decimal
    avg_gross_margin_pct: float

    total_opex: Decimal
    total_formalization_one_time: Decimal
    total_formalization_recurring: Decimal

    total_operating_profit: Decimal
    avg_operating_margin_pct: float

    total_interest_expense: Decimal
    total_debt_capital_paid: Decimal

    total_net_profit: Decimal
    avg_net_margin_pct: float

    ending_cash: Decimal
    min_cash: Decimal
    months_cash_negative: int
    months_below_breakeven: int

    breakeven_revenue_monthly_avg: Decimal


class ProjectionRunResponse(BaseSchema):
    """Response from running a projection."""
    id: UUID | None = None
    name: str
    assumptions: ProjectionAssumptions
    months: list[ProjectionMonth]
    summary: ProjectionSummary
    generated_at: datetime
