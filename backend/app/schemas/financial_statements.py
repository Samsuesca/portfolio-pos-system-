"""
Financial Statements Schemas - Income Statement and Balance Sheet

Schemas for:
- Income Statement (Estado de Resultados)
- Balance Sheet (Balance General)
"""
from datetime import date
from decimal import Decimal
from uuid import UUID
from pydantic import Field

from app.schemas.base import BaseSchema
from app.models.accounting import ExpenseCategory


# ============================================
# Common Schemas
# ============================================

class ExpenseCategoryTotal(BaseSchema):
    """Total for a single expense category"""
    category: ExpenseCategory
    category_label: str
    total: Decimal
    percentage_of_revenue: Decimal = Decimal("0")


class AccountDetail(BaseSchema):
    """Detail of a single balance account"""
    id: UUID
    name: str
    code: str | None
    balance: Decimal
    net_value: Decimal


class CashAccountDetail(BaseSchema):
    """Detail of a cash/bank account"""
    id: UUID
    name: str
    code: str
    balance: Decimal


# ============================================
# Income Statement Schemas
# ============================================

class COGSDetails(BaseSchema):
    """Cost of Goods Sold breakdown"""
    total: Decimal = Field(..., description="Total COGS")
    from_actual_cost: Decimal = Field(..., description="COGS from products with registered cost")
    from_estimated_cost: Decimal = Field(..., description="COGS from products with estimated cost (80% margin)")
    items_with_actual_cost: int = Field(..., description="Number of items with actual cost")
    items_with_estimated_cost: int = Field(..., description="Number of items with estimated cost")
    estimation_margin_used: Decimal = Field(default=Decimal("0.80"), description="Margin used for estimation")


class OperatingExpensesBreakdown(BaseSchema):
    """Operating expenses by category"""
    rent: Decimal = Decimal("0")
    utilities: Decimal = Decimal("0")
    payroll: Decimal = Decimal("0")
    supplies: Decimal = Decimal("0")
    transport: Decimal = Decimal("0")
    maintenance: Decimal = Decimal("0")
    marketing: Decimal = Decimal("0")
    total: Decimal = Decimal("0")


class OtherExpensesBreakdown(BaseSchema):
    """Other (non-operating) expenses"""
    taxes: Decimal = Decimal("0")
    bank_fees: Decimal = Decimal("0")
    other: Decimal = Decimal("0")
    total: Decimal = Decimal("0")


class IncomeStatementResponse(BaseSchema):
    """Complete Income Statement (Estado de Resultados)"""
    # Period
    period_start: date
    period_end: date

    # Revenue Section
    gross_revenue: Decimal = Field(..., description="Total sales revenue")
    returns_discounts: Decimal = Field(default=Decimal("0"), description="Returns and discounts")
    net_revenue: Decimal = Field(..., description="Net revenue after returns")
    sales_count: int = Field(..., description="Number of completed sales")

    # COGS Section
    cost_of_goods_sold: Decimal = Field(..., description="Total cost of goods sold")
    cogs_details: COGSDetails = Field(..., description="COGS breakdown")

    # Gross Profit
    gross_profit: Decimal = Field(..., description="Net revenue - COGS")
    gross_margin_percent: Decimal = Field(..., description="Gross profit margin %")

    # Operating Expenses
    operating_expenses: OperatingExpensesBreakdown
    operating_expenses_by_category: list[ExpenseCategoryTotal] = Field(
        default_factory=list,
        description="Detailed operating expenses by category"
    )
    total_operating_expenses: Decimal

    # Operating Income
    operating_income: Decimal = Field(..., description="Gross profit - Operating expenses")
    operating_margin_percent: Decimal = Field(..., description="Operating profit margin %")

    # Other Expenses
    other_expenses: OtherExpensesBreakdown

    # Net Income
    net_income: Decimal = Field(..., description="Final net income (Utilidad Neta)")
    net_margin_percent: Decimal = Field(..., description="Net profit margin %")

    # Data Quality Indicators
    cogs_coverage_percent: Decimal = Field(
        ...,
        description="% of sales with actual product cost (vs estimated)"
    )
    disclaimer: str | None = Field(
        default=None,
        description="Warning about data quality if coverage < 100%"
    )

    # Optional comparison with previous period
    previous_period: "IncomeStatementResponse | None" = None
    period_comparison: dict | None = Field(
        default=None,
        description="Comparison metrics with previous period"
    )


# ============================================
# Balance Sheet Schemas
# ============================================

class InventoryDetail(BaseSchema):
    """Inventory valuation detail"""
    total_value: Decimal = Field(..., description="Total inventory value")
    total_units: int = Field(..., description="Total units in stock")
    from_actual_cost: Decimal = Field(..., description="Value from products with actual cost")
    from_estimated_cost: Decimal = Field(..., description="Value from products with estimated cost")
    coverage_percent: Decimal = Field(..., description="% of inventory with actual cost")


class CurrentAssetsDetail(BaseSchema):
    """Current assets breakdown"""
    # Cash and equivalents
    cash_accounts: list[CashAccountDetail] = Field(default_factory=list)
    total_cash: Decimal = Field(default=Decimal("0"))

    # Accounts receivable
    accounts_receivable: Decimal = Field(default=Decimal("0"))
    accounts_receivable_count: int = Field(default=0)

    # Inventory
    inventory: InventoryDetail | None = None
    total_inventory: Decimal = Field(default=Decimal("0"))

    # Other current assets
    other_current: list[AccountDetail] = Field(default_factory=list)
    total_other_current: Decimal = Field(default=Decimal("0"))


class CurrentLiabilitiesDetail(BaseSchema):
    """Current liabilities breakdown"""
    # Accounts payable
    accounts_payable: Decimal = Field(default=Decimal("0"))
    accounts_payable_count: int = Field(default=0)

    # Pending expenses
    pending_expenses: Decimal = Field(default=Decimal("0"))
    pending_expenses_count: int = Field(default=0)

    # Short-term debt
    short_term_debt: list[AccountDetail] = Field(default_factory=list)
    total_short_term_debt: Decimal = Field(default=Decimal("0"))

    # Other current liabilities
    other_current: list[AccountDetail] = Field(default_factory=list)
    total_other_current: Decimal = Field(default=Decimal("0"))


class EquityDetail(BaseSchema):
    """Equity breakdown"""
    capital: Decimal = Field(default=Decimal("0"), description="Initial capital")
    retained_earnings: Decimal = Field(default=Decimal("0"), description="Accumulated earnings")
    other_equity: Decimal = Field(default=Decimal("0"), description="Other equity accounts")
    accounts: list[AccountDetail] = Field(default_factory=list)


class BalanceSheetResponse(BaseSchema):
    """Complete Balance Sheet (Balance General)"""
    as_of_date: date

    # ASSETS
    current_assets: CurrentAssetsDetail
    total_current_assets: Decimal

    fixed_assets: list[AccountDetail] = Field(default_factory=list)
    total_fixed_assets: Decimal = Field(default=Decimal("0"))

    other_assets: list[AccountDetail] = Field(default_factory=list)
    total_other_assets: Decimal = Field(default=Decimal("0"))

    total_assets: Decimal

    # LIABILITIES
    current_liabilities: CurrentLiabilitiesDetail
    total_current_liabilities: Decimal

    long_term_liabilities: list[AccountDetail] = Field(default_factory=list)
    total_long_term_liabilities: Decimal = Field(default=Decimal("0"))

    other_liabilities: list[AccountDetail] = Field(default_factory=list)
    total_other_liabilities: Decimal = Field(default=Decimal("0"))

    total_liabilities: Decimal

    # EQUITY
    equity: EquityDetail
    total_equity: Decimal

    # VALIDATION
    is_balanced: bool = Field(
        ...,
        description="True if Assets = Liabilities + Equity"
    )
    balance_difference: Decimal = Field(
        default=Decimal("0"),
        description="Difference (should be 0 if balanced)"
    )

    # NET WORTH
    net_worth: Decimal = Field(
        ...,
        description="Total Assets - Total Liabilities"
    )

    # Data quality
    inventory_coverage_percent: Decimal = Field(
        default=Decimal("100"),
        description="% of inventory with actual cost data"
    )
    disclaimer: str | None = None


# ============================================
# Request Schemas
# ============================================

class IncomeStatementRequest(BaseSchema):
    """Request parameters for income statement"""
    start_date: date
    end_date: date
    compare_previous: bool = Field(
        default=False,
        description="Compare with previous period of same length"
    )


class BalanceSheetRequest(BaseSchema):
    """Request parameters for balance sheet"""
    as_of_date: date | None = Field(
        default=None,
        description="Date for balance sheet (defaults to today)"
    )


# ============================================
# Period Presets
# ============================================

class PeriodPreset(BaseSchema):
    """Predefined period for reports"""
    key: str  # "this_month", "last_month", etc.
    label: str  # "Este mes", "Mes anterior", etc.
    start_date: date
    end_date: date


class AvailablePeriodsResponse(BaseSchema):
    """Available period presets for financial statements"""
    presets: list[PeriodPreset]
    earliest_data_date: date | None = Field(
        None,
        description="Earliest date with sales data"
    )
