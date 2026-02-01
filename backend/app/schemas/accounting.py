"""
Accounting Schemas - Transactions, Expenses, and Cash Flow
"""
from uuid import UUID
from decimal import Decimal
from datetime import datetime, date
from pydantic import Field, field_validator, model_validator
from app.schemas.base import BaseSchema, IDModelSchema, TimestampSchema, SchoolIsolatedSchema
from app.models.accounting import TransactionType, AccPaymentMethod, ExpenseCategory, AccountType, AdjustmentReason


# ============================================
# Transaction Schemas
# ============================================

class TransactionBase(BaseSchema):
    """Base transaction schema"""
    type: TransactionType
    amount: Decimal = Field(..., gt=0)
    payment_method: AccPaymentMethod
    description: str = Field(..., min_length=1, max_length=500)
    category: str | None = Field(None, max_length=100)
    reference_code: str | None = Field(None, max_length=100)
    transaction_date: date


class TransactionCreate(TransactionBase, SchoolIsolatedSchema):
    """Schema for creating a transaction"""
    sale_id: UUID | None = None
    order_id: UUID | None = None
    expense_id: UUID | None = None


class TransactionUpdate(BaseSchema):
    """Schema for updating a transaction"""
    description: str | None = Field(None, min_length=1, max_length=500)
    category: str | None = Field(None, max_length=100)
    reference_code: str | None = Field(None, max_length=100)


class TransactionInDB(TransactionBase, SchoolIsolatedSchema, IDModelSchema):
    """Transaction as stored in database"""
    sale_id: UUID | None
    order_id: UUID | None
    expense_id: UUID | None
    created_by: UUID | None
    created_at: datetime
    updated_at: datetime


class TransactionResponse(TransactionInDB):
    """Transaction for API responses"""

    model_config = {"from_attributes": True}


class TransactionWithDetails(TransactionResponse):
    """Transaction with related entity details"""
    sale_code: str | None = None
    order_code: str | None = None
    expense_description: str | None = None
    created_by_username: str | None = None


class TransactionListResponse(BaseSchema):
    """Simplified transaction for listings"""
    id: UUID
    type: TransactionType
    amount: Decimal
    payment_method: AccPaymentMethod
    description: str
    category: str | None
    reference_code: str | None
    transaction_date: date
    created_at: datetime


# ============================================
# Expense Schemas
# ============================================

class ExpenseBase(BaseSchema):
    """Base expense schema

    Note: category is now a string to support dynamic categories from the database.
    The category code is validated against expense_categories table at runtime.
    """
    category: str = Field(..., min_length=1, max_length=50, description="Category code from expense_categories table")
    description: str = Field(..., min_length=1, max_length=500)
    amount: Decimal = Field(..., gt=0)
    expense_date: date
    due_date: date | None = None
    vendor: str | None = Field(None, max_length=255)
    receipt_number: str | None = Field(None, max_length=100)
    notes: str | None = None
    is_recurring: bool = False
    recurring_period: str | None = Field(None, pattern=r'^(weekly|monthly|yearly)$')


class ExpenseCreate(ExpenseBase, SchoolIsolatedSchema):
    """Schema for creating an expense"""

    @model_validator(mode='after')
    def validate_recurring(self):
        """Validate recurring_period is set when is_recurring is True"""
        if self.is_recurring and not self.recurring_period:
            raise ValueError("recurring_period is required when is_recurring is True")
        return self


class GlobalExpenseCreate(ExpenseBase):
    """Schema for creating a GLOBAL expense (school_id optional/null)"""
    school_id: UUID | None = None

    @model_validator(mode='after')
    def validate_recurring(self):
        """Validate recurring_period is set when is_recurring is True"""
        if self.is_recurring and not self.recurring_period:
            raise ValueError("recurring_period is required when is_recurring is True")
        return self


class GlobalExpenseInDB(ExpenseBase, IDModelSchema):
    """Global expense as stored in database (school_id is optional)"""
    school_id: UUID | None = None
    amount_paid: Decimal
    is_paid: bool
    created_by: UUID | None
    is_active: bool
    created_at: datetime
    updated_at: datetime


class GlobalExpenseResponse(GlobalExpenseInDB):
    """Global expense for API responses"""
    balance: Decimal = Field(..., description="Remaining balance to pay")
    payment_method: str | None = None
    payment_account_name: str | None = None
    paid_at: datetime | None = None

    model_config = {"from_attributes": True}


class ExpenseUpdate(BaseSchema):
    """Schema for updating an expense"""
    category: str | None = Field(None, min_length=1, max_length=50, description="Category code from expense_categories table")
    description: str | None = Field(None, min_length=1, max_length=500)
    amount: Decimal | None = Field(None, gt=0)
    expense_date: date | None = None
    due_date: date | None = None
    vendor: str | None = Field(None, max_length=255)
    receipt_number: str | None = Field(None, max_length=100)
    notes: str | None = None
    is_recurring: bool | None = None
    recurring_period: str | None = Field(None, pattern=r'^(weekly|monthly|yearly)$')


class ExpensePayment(BaseSchema):
    """Schema for recording expense payment"""
    amount: Decimal = Field(..., gt=0)
    payment_method: AccPaymentMethod
    notes: str | None = None
    use_fallback: bool = Field(
        default=False,
        description="Si True y pago en efectivo, usa Caja Mayor cuando Caja Menor no alcanza"
    )


class ExpenseInDB(ExpenseBase, SchoolIsolatedSchema, IDModelSchema):
    """Expense as stored in database"""
    amount_paid: Decimal
    is_paid: bool
    created_by: UUID | None
    is_active: bool
    created_at: datetime
    updated_at: datetime


class ExpenseResponse(ExpenseInDB):
    """Expense for API responses"""
    balance: Decimal = Field(..., description="Remaining balance to pay")

    model_config = {"from_attributes": True}


class ExpenseWithTransaction(ExpenseResponse):
    """Expense with its payment transaction"""
    transaction: TransactionResponse | None = None
    created_by_username: str | None = None


class ExpenseListResponse(BaseSchema):
    """Simplified expense for listings"""
    id: UUID
    category: str  # Dynamic category code from expense_categories table
    description: str
    amount: Decimal
    amount_paid: Decimal
    is_paid: bool
    expense_date: date
    due_date: date | None
    vendor: str | None
    is_recurring: bool
    balance: Decimal
    payment_method: str | None = None
    payment_account_name: str | None = None
    paid_at: datetime | None = None


# ============================================
# Daily Cash Register Schemas
# ============================================

class DailyCashRegisterBase(BaseSchema):
    """Base daily cash register schema"""
    register_date: date
    opening_balance: Decimal = Field(default=Decimal("0"))


class DailyCashRegisterCreate(DailyCashRegisterBase, SchoolIsolatedSchema):
    """Schema for opening a cash register"""
    pass


class DailyCashRegisterClose(BaseSchema):
    """Schema for closing a cash register"""
    closing_balance: Decimal
    notes: str | None = None


class DailyCashRegisterInDB(DailyCashRegisterBase, SchoolIsolatedSchema, IDModelSchema):
    """Daily cash register as stored in database"""
    closing_balance: Decimal | None
    total_income: Decimal
    total_expenses: Decimal
    cash_income: Decimal
    transfer_income: Decimal
    card_income: Decimal
    credit_sales: Decimal
    is_closed: bool
    closed_at: datetime | None
    closed_by: UUID | None
    notes: str | None
    created_at: datetime
    updated_at: datetime


class DailyCashRegisterResponse(DailyCashRegisterInDB):
    """Daily cash register for API responses"""
    net_flow: Decimal = Field(..., description="Net cash flow for the day")

    model_config = {"from_attributes": True}


class DailyCashRegisterWithDetails(DailyCashRegisterResponse):
    """Daily cash register with additional details"""
    closed_by_username: str | None = None
    transactions_count: int = 0


# ============================================
# Summary/Analytics Schemas
# ============================================

class CashFlowSummary(BaseSchema):
    """Cash flow summary for a period"""
    period_start: date
    period_end: date
    total_income: Decimal
    total_expenses: Decimal
    net_flow: Decimal
    income_by_method: dict[str, Decimal]  # {"cash": 1000, "transfer": 500}
    expenses_by_category: dict[str, Decimal]  # {"rent": 500, "utilities": 200}


class DailyFinancialSummary(BaseSchema):
    """Daily financial summary"""
    date: date
    sales_count: int
    sales_total: Decimal
    orders_count: int
    orders_total: Decimal
    expenses_count: int
    expenses_total: Decimal
    net_income: Decimal


class MonthlyFinancialReport(BaseSchema):
    """Monthly financial report"""
    year: int
    month: int
    total_income: Decimal
    total_expenses: Decimal
    net_profit: Decimal
    income_breakdown: dict[str, Decimal]
    expense_breakdown: dict[str, Decimal]
    daily_summaries: list[DailyFinancialSummary]


class ExpensesByCategory(BaseSchema):
    """Expenses grouped by category"""
    category: str  # Dynamic category code from expense_categories table
    total_amount: Decimal
    count: int
    percentage: Decimal


class IncomeBySource(BaseSchema):
    """Income grouped by source"""
    source: str  # "sales", "orders", "other"
    total_amount: Decimal
    count: int
    percentage: Decimal


class AccountingDashboard(BaseSchema):
    """Accounting dashboard overview"""
    # Today's numbers
    today_income: Decimal
    today_expenses: Decimal
    today_net: Decimal

    # This month's numbers
    month_income: Decimal
    month_expenses: Decimal
    month_net: Decimal

    # Pending items
    pending_expenses: int
    pending_expenses_amount: Decimal

    # Recent transactions
    recent_transactions: list[TransactionListResponse]


# ============================================
# Balance General Schemas
# ============================================

class BalanceAccountBase(BaseSchema):
    """Base balance account schema"""
    account_type: AccountType
    name: str = Field(..., min_length=1, max_length=255)
    description: str | None = None
    code: str | None = Field(None, max_length=50)
    balance: Decimal = Field(default=Decimal("0"))
    # For depreciable assets
    original_value: Decimal | None = None
    accumulated_depreciation: Decimal | None = None
    useful_life_years: int | None = Field(None, ge=1)
    # For debts/loans
    interest_rate: Decimal | None = Field(None, ge=0, le=100)
    due_date: date | None = None
    creditor: str | None = Field(None, max_length=255)


class BalanceAccountCreate(BalanceAccountBase, SchoolIsolatedSchema):
    """Schema for creating a balance account"""
    pass


class GlobalBalanceAccountCreate(BalanceAccountBase):
    """Schema for creating a global balance account (no school_id required)

    Used for creating:
    - Fixed assets (Activos Fijos): machinery, vehicles, equipment
    - Current liabilities (Pasivos Corrientes): short-term debts
    - Long-term liabilities (Pasivos Largo Plazo): loans, mortgages
    - Equity accounts (Patrimonio): capital, retained earnings
    """
    pass


class GlobalBalanceAccountResponse(BaseSchema):
    """Global balance account for API responses (nullable school_id)"""
    id: UUID
    school_id: UUID | None
    account_type: AccountType
    name: str
    description: str | None
    code: str | None
    balance: Decimal
    original_value: Decimal | None
    accumulated_depreciation: Decimal | None
    useful_life_years: int | None
    interest_rate: Decimal | None
    due_date: date | None
    creditor: str | None
    net_value: Decimal
    is_active: bool
    created_by: UUID | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class BalanceAccountUpdate(BaseSchema):
    """Schema for updating a balance account"""
    name: str | None = Field(None, min_length=1, max_length=255)
    description: str | None = None
    code: str | None = Field(None, max_length=50)
    balance: Decimal | None = None
    original_value: Decimal | None = None
    accumulated_depreciation: Decimal | None = None
    useful_life_years: int | None = Field(None, ge=1)
    interest_rate: Decimal | None = Field(None, ge=0, le=100)
    due_date: date | None = None
    creditor: str | None = Field(None, max_length=255)
    is_active: bool | None = None


class BalanceAccountInDB(BalanceAccountBase, SchoolIsolatedSchema, IDModelSchema):
    """Balance account as stored in database"""
    is_active: bool
    created_by: UUID | None
    created_at: datetime
    updated_at: datetime


class BalanceAccountResponse(BalanceAccountInDB):
    """Balance account for API responses"""
    net_value: Decimal = Field(..., description="Net value after depreciation")

    model_config = {"from_attributes": True}


class BalanceAccountListResponse(BaseSchema):
    """Simplified balance account for listings"""
    id: UUID
    account_type: AccountType
    name: str
    code: str | None
    balance: Decimal
    net_value: Decimal
    is_active: bool


# ============================================
# Balance Entry Schemas
# ============================================

class BalanceEntryBase(BaseSchema):
    """Base balance entry schema"""
    entry_date: date
    amount: Decimal  # Can be positive or negative
    description: str = Field(..., min_length=1, max_length=500)
    reference: str | None = Field(None, max_length=100)


class BalanceEntryCreate(BalanceEntryBase, SchoolIsolatedSchema):
    """Schema for creating a balance entry"""
    account_id: UUID


class BalanceEntryInDB(BalanceEntryBase, SchoolIsolatedSchema, IDModelSchema):
    """Balance entry as stored in database"""
    account_id: UUID
    balance_after: Decimal
    created_by: UUID | None
    created_at: datetime


class BalanceEntryResponse(BalanceEntryInDB):
    """Balance entry for API responses"""

    model_config = {"from_attributes": True}


class BalanceEntryWithAccount(BalanceEntryResponse):
    """Balance entry with account details"""
    account_name: str
    account_type: AccountType


# ============================================
# Accounts Receivable Schemas
# ============================================

class AccountsReceivableBase(BaseSchema):
    """Base accounts receivable schema"""
    amount: Decimal = Field(..., gt=0)
    description: str = Field(..., min_length=1, max_length=500)
    invoice_date: date
    due_date: date | None = None
    notes: str | None = None


class AccountsReceivableCreate(AccountsReceivableBase, SchoolIsolatedSchema):
    """Schema for creating accounts receivable"""
    client_id: UUID | None = None
    sale_id: UUID | None = None
    order_id: UUID | None = None


class GlobalAccountsReceivableCreate(AccountsReceivableBase):
    """Schema for creating global accounts receivable (no school_id required)"""
    client_id: UUID | None = None
    sale_id: UUID | None = None
    order_id: UUID | None = None


class AccountsReceivableUpdate(BaseSchema):
    """Schema for updating accounts receivable"""
    description: str | None = Field(None, min_length=1, max_length=500)
    due_date: date | None = None
    notes: str | None = None


class AccountsReceivablePayment(BaseSchema):
    """Schema for recording payment on receivable"""
    amount: Decimal = Field(..., gt=0)
    payment_method: AccPaymentMethod
    notes: str | None = None


class AccountsReceivableInDB(AccountsReceivableBase, SchoolIsolatedSchema, IDModelSchema):
    """Accounts receivable as stored in database"""
    client_id: UUID | None
    sale_id: UUID | None
    order_id: UUID | None
    amount_paid: Decimal
    is_paid: bool
    is_overdue: bool
    created_by: UUID | None
    created_at: datetime
    updated_at: datetime


class AccountsReceivableResponse(AccountsReceivableInDB):
    """Accounts receivable for API responses"""
    balance: Decimal = Field(..., description="Remaining balance to collect")

    model_config = {"from_attributes": True}


class GlobalAccountsReceivableResponse(AccountsReceivableBase, IDModelSchema):
    """Global accounts receivable response (school_id is nullable)"""
    school_id: UUID | None = None
    client_id: UUID | None
    sale_id: UUID | None
    order_id: UUID | None
    amount_paid: Decimal
    is_paid: bool
    is_overdue: bool
    created_by: UUID | None
    created_at: datetime
    updated_at: datetime
    balance: Decimal = Field(..., description="Remaining balance to collect")

    model_config = {"from_attributes": True}


class AccountsReceivableWithDetails(AccountsReceivableResponse):
    """Accounts receivable with related entity details"""
    client_name: str | None = None
    sale_code: str | None = None


class AccountsReceivableListResponse(BaseSchema):
    """Accounts receivable for listings with origin details"""
    id: UUID
    client_id: UUID | None
    client_name: str | None
    amount: Decimal
    amount_paid: Decimal
    balance: Decimal
    description: str
    invoice_date: date
    due_date: date | None
    is_paid: bool
    is_overdue: bool
    # Origin information
    origin_type: str | None = None  # 'sale', 'order', 'manual'
    sale_id: UUID | None = None
    sale_code: str | None = None
    order_id: UUID | None = None
    order_code: str | None = None
    order_status: str | None = None  # Estado del encargo
    # School information
    school_id: UUID | None = None
    school_name: str | None = None
    # Notes
    notes: str | None = None


# ============================================
# Accounts Payable Schemas
# ============================================

class AccountsPayableBase(BaseSchema):
    """Base accounts payable schema"""
    vendor: str = Field(..., min_length=1, max_length=255)
    amount: Decimal = Field(..., gt=0)
    description: str = Field(..., min_length=1, max_length=500)
    category: str | None = Field(None, max_length=100)
    invoice_number: str | None = Field(None, max_length=100)
    invoice_date: date
    due_date: date | None = None
    notes: str | None = None


class AccountsPayableCreate(AccountsPayableBase, SchoolIsolatedSchema):
    """Schema for creating accounts payable"""
    pass


class GlobalAccountsPayableCreate(AccountsPayableBase):
    """Schema for creating global accounts payable (no school_id required)"""
    pass


class AccountsPayableUpdate(BaseSchema):
    """Schema for updating accounts payable"""
    vendor: str | None = Field(None, min_length=1, max_length=255)
    description: str | None = Field(None, min_length=1, max_length=500)
    category: str | None = Field(None, max_length=100)
    invoice_number: str | None = Field(None, max_length=100)
    due_date: date | None = None
    notes: str | None = None


class AccountsPayablePayment(BaseSchema):
    """Schema for recording payment on payable"""
    amount: Decimal = Field(..., gt=0)
    payment_method: AccPaymentMethod
    notes: str | None = None


class AccountsPayableInDB(AccountsPayableBase, SchoolIsolatedSchema, IDModelSchema):
    """Accounts payable as stored in database"""
    amount_paid: Decimal
    is_paid: bool
    is_overdue: bool
    created_by: UUID | None
    created_at: datetime
    updated_at: datetime


class AccountsPayableResponse(AccountsPayableInDB):
    """Accounts payable for API responses"""
    balance: Decimal = Field(..., description="Remaining balance to pay")

    model_config = {"from_attributes": True}


class GlobalAccountsPayableResponse(AccountsPayableBase, IDModelSchema):
    """Global accounts payable response (school_id is nullable)"""
    school_id: UUID | None = None
    amount_paid: Decimal
    is_paid: bool
    is_overdue: bool
    created_by: UUID | None
    created_at: datetime
    updated_at: datetime
    balance: Decimal = Field(..., description="Remaining balance to pay")

    model_config = {"from_attributes": True}


class AccountsPayableListResponse(BaseSchema):
    """Simplified accounts payable for listings"""
    id: UUID
    vendor: str
    amount: Decimal
    amount_paid: Decimal
    balance: Decimal
    description: str
    category: str | None
    invoice_number: str | None
    invoice_date: date
    due_date: date | None
    is_paid: bool
    is_overdue: bool


# ============================================
# Balance General Summary Schemas
# ============================================

class BalanceGeneralSummary(BaseSchema):
    """Balance general (balance sheet) summary"""
    as_of_date: date

    # Activos
    total_current_assets: Decimal  # Efectivo, inventario, cuentas por cobrar
    total_fixed_assets: Decimal    # Equipos, maquinaria
    total_other_assets: Decimal
    total_assets: Decimal

    # Pasivos
    total_current_liabilities: Decimal  # Cuentas por pagar
    total_long_liabilities: Decimal     # Préstamos largo plazo
    total_other_liabilities: Decimal
    total_liabilities: Decimal

    # Patrimonio
    total_equity: Decimal

    # Check: Assets = Liabilities + Equity
    is_balanced: bool


class BalanceAccountsByType(BaseSchema):
    """Accounts grouped by type for balance sheet display"""
    account_type: AccountType
    account_type_label: str  # Human-readable label
    accounts: list[BalanceAccountListResponse]
    total: Decimal


class BalanceGeneralDetailed(BaseSchema):
    """Detailed balance general with account breakdown"""
    as_of_date: date

    # Assets breakdown
    current_assets: BalanceAccountsByType
    fixed_assets: BalanceAccountsByType
    other_assets: BalanceAccountsByType

    # Liabilities breakdown
    current_liabilities: BalanceAccountsByType
    long_liabilities: BalanceAccountsByType
    other_liabilities: BalanceAccountsByType

    # Equity breakdown
    equity: list[BalanceAccountsByType]

    # Totals
    total_assets: Decimal
    total_liabilities: Decimal
    total_equity: Decimal
    is_balanced: bool


class ReceivablesPayablesSummary(BaseSchema):
    """Summary of accounts receivable and payable"""
    # Receivables (Cuentas por Cobrar)
    total_receivables: Decimal
    receivables_collected: Decimal
    receivables_pending: Decimal
    receivables_overdue: Decimal
    receivables_count: int

    # Payables (Cuentas por Pagar)
    total_payables: Decimal
    payables_paid: Decimal
    payables_pending: Decimal
    payables_overdue: Decimal
    payables_count: int

    # Net position
    net_position: Decimal  # receivables_pending - payables_pending


# ============================================
# Global Reports Schemas (for Reports page)
# ============================================

class TransactionListItemResponse(BaseSchema):
    """Transaction item for list display with school name"""
    id: UUID
    type: TransactionType
    amount: Decimal
    payment_method: AccPaymentMethod
    description: str
    category: str | None
    reference_code: str | None
    transaction_date: date
    created_at: datetime
    school_id: UUID | None = None
    school_name: str | None = None


class ExpenseCategorySummary(BaseSchema):
    """Summary of expenses by category"""
    category: str | None  # Dynamic category code, can be None for uncategorized expenses
    category_label: str  # Human-readable label
    total_amount: Decimal
    paid_amount: Decimal
    pending_amount: Decimal
    count: int
    percentage: Decimal = Decimal("0")


class CashFlowPeriodItem(BaseSchema):
    """Cash flow for a single period (day/week/month)"""
    period: str  # "2024-01-15" or "2024-W03" or "2024-01"
    period_label: str  # "15 Ene" or "Semana 3" or "Enero"
    income: Decimal
    expenses: Decimal
    net: Decimal


class CashFlowReportResponse(BaseSchema):
    """Complete cash flow report response"""
    period_start: date
    period_end: date
    group_by: str  # "day", "week", "month"
    total_income: Decimal
    total_expenses: Decimal
    net_flow: Decimal
    periods: list[CashFlowPeriodItem]


class FinancialSummaryResponse(BaseSchema):
    """Financial summary for reports dashboard"""
    # Period
    period_start: date
    period_end: date

    # Totals
    total_income: Decimal
    total_expenses: Decimal
    net_flow: Decimal

    # Income breakdown by payment method
    income_by_method: dict[str, Decimal]

    # Expenses breakdown by category
    expenses_by_category: list[ExpenseCategorySummary]

    # Recent transactions
    recent_transactions: list[TransactionListItemResponse]


# ============================================
# Expense Adjustment Schemas
# ============================================

class ExpenseAdjustmentRequest(BaseSchema):
    """Request schema for adjusting an expense"""
    new_amount: Decimal | None = Field(
        None,
        gt=0,
        description="New expense amount (optional, only if changing)"
    )
    new_payment_account_id: UUID | None = Field(
        None,
        description="New payment account ID (optional, for account corrections)"
    )
    new_payment_method: str | None = Field(
        None,
        max_length=20,
        description="New payment method string (optional)"
    )
    reason: AdjustmentReason = Field(
        default=AdjustmentReason.AMOUNT_CORRECTION,
        description="Reason for the adjustment"
    )
    description: str | None = Field(
        None,
        max_length=500,
        description="Description of why the adjustment is being made"
    )

    @model_validator(mode='after')
    def validate_at_least_one_change(self):
        """Validate that at least one change is specified"""
        if self.new_amount is None and self.new_payment_account_id is None:
            raise ValueError(
                "Debe especificar al menos un cambio: new_amount o new_payment_account_id"
            )
        return self


class ExpenseRevertRequest(BaseSchema):
    """Request schema for reverting an expense payment"""
    description: str | None = Field(
        None,
        max_length=500,
        description="Description of why the payment is being reverted"
    )


class PartialRefundRequest(BaseSchema):
    """Request schema for issuing a partial refund"""
    refund_amount: Decimal = Field(
        ...,
        gt=0,
        description="Amount to refund (must be <= amount_paid)"
    )
    description: str | None = Field(
        None,
        max_length=500,
        description="Description of the refund reason"
    )


class ExpenseAdjustmentResponse(BaseSchema):
    """Response schema for expense adjustment"""
    id: UUID
    expense_id: UUID
    reason: AdjustmentReason
    description: str

    # Previous values
    previous_amount: Decimal
    previous_amount_paid: Decimal
    previous_payment_method: str | None
    previous_payment_account_id: UUID | None
    previous_payment_account_name: str | None = None

    # New values
    new_amount: Decimal
    new_amount_paid: Decimal
    new_payment_method: str | None
    new_payment_account_id: UUID | None
    new_payment_account_name: str | None = None

    # Delta
    adjustment_delta: Decimal = Field(
        ...,
        description="Net change (positive = refund to account)"
    )

    # Balance entry references
    refund_entry_id: UUID | None
    new_payment_entry_id: UUID | None

    # Audit
    adjusted_by: UUID | None
    adjusted_by_username: str | None = None
    adjusted_at: datetime

    model_config = {"from_attributes": True}


class ExpenseAdjustmentListResponse(BaseSchema):
    """Simplified adjustment for list views"""
    id: UUID
    expense_id: UUID
    expense_description: str | None = None
    reason: AdjustmentReason
    description: str
    previous_amount_paid: Decimal
    new_amount_paid: Decimal
    adjustment_delta: Decimal
    adjusted_by_username: str | None = None
    adjusted_at: datetime


class ExpenseAdjustmentHistoryResponse(BaseSchema):
    """Response for adjustment history with expense details"""
    expense_id: UUID
    expense_description: str
    expense_category: str  # Dynamic category code from expense_categories table
    expense_vendor: str | None
    current_amount: Decimal
    current_amount_paid: Decimal
    current_is_paid: bool
    adjustments: list[ExpenseAdjustmentResponse]
    total_adjustments: int


class AdjustmentListPaginatedResponse(BaseSchema):
    """Paginated list of adjustments"""
    items: list[ExpenseAdjustmentListResponse]
    total: int
    limit: int
    offset: int


# ============================================
# Daily Flow by Account Schemas (Cierre de Caja)
# ============================================

class CategoryBreakdownItem(BaseSchema):
    """Breakdown item for a single category"""
    income: Decimal = Field(default=Decimal("0"), description="Total ingresos de esta categoria")
    expense: Decimal = Field(default=Decimal("0"), description="Total gastos de esta categoria")
    count: int = Field(default=0, description="Cantidad de movimientos")


class CategoryBreakdown(BaseSchema):
    """Desglose por categoria de origen (ventas, encargos, arreglos, etc.)"""
    sales: CategoryBreakdownItem = Field(default_factory=CategoryBreakdownItem)
    orders: CategoryBreakdownItem = Field(default_factory=CategoryBreakdownItem)
    alterations: CategoryBreakdownItem = Field(default_factory=CategoryBreakdownItem)
    sale_changes: CategoryBreakdownItem = Field(default_factory=CategoryBreakdownItem)
    transfers: CategoryBreakdownItem = Field(default_factory=CategoryBreakdownItem)
    expenses: CategoryBreakdownItem = Field(default_factory=CategoryBreakdownItem)
    other: CategoryBreakdownItem = Field(default_factory=CategoryBreakdownItem)


class AccountDailyFlow(BaseSchema):
    """Flujo diario de una cuenta individual"""
    account_id: str
    account_name: str
    account_code: str
    opening_balance: Decimal = Field(..., description="Saldo al inicio del dia")
    total_income: Decimal = Field(..., description="Total de entradas del dia")
    total_expenses: Decimal = Field(..., description="Total de salidas del dia")
    closing_balance: Decimal = Field(..., description="Saldo al final del dia")
    income_count: int = Field(..., description="Cantidad de movimientos de entrada")
    expense_count: int = Field(..., description="Cantidad de movimientos de salida")
    net_flow: Decimal = Field(..., description="Flujo neto (income - expenses)")
    breakdown_by_category: CategoryBreakdown | None = Field(
        default=None,
        description="Desglose por categoria de origen"
    )


class DailyFlowTotals(BaseSchema):
    """Totales consolidados de todas las cuentas"""
    opening_balance: Decimal
    total_income: Decimal
    total_expenses: Decimal
    closing_balance: Decimal
    net_flow: Decimal


class DailyFlowResponse(BaseSchema):
    """Respuesta del flujo diario por cuentas para cierre de caja"""
    date: date
    accounts: list[AccountDailyFlow]
    totals: DailyFlowTotals


# ============================================
# Expense Category Management Schemas
# ============================================

class ExpenseCategoryBase(BaseSchema):
    """Base expense category schema"""
    code: str = Field(..., min_length=1, max_length=50, pattern=r'^[a-z][a-z0-9_]*$')
    name: str = Field(..., min_length=1, max_length=100)
    description: str | None = Field(None, max_length=255)
    color: str = Field(default="#9CA3AF", pattern=r'^#[0-9A-Fa-f]{6}$')
    icon: str | None = Field(None, max_length=50)
    display_order: int = Field(default=0, ge=0)


class ExpenseCategoryCreate(ExpenseCategoryBase):
    """Schema for creating an expense category"""

    @field_validator('code')
    @classmethod
    def validate_code(cls, v: str) -> str:
        """Normalize code to lowercase"""
        return v.lower().strip()


class ExpenseCategoryUpdate(BaseSchema):
    """Schema for updating an expense category"""
    name: str | None = Field(None, min_length=1, max_length=100)
    description: str | None = Field(None, max_length=255)
    color: str | None = Field(None, pattern=r'^#[0-9A-Fa-f]{6}$')
    icon: str | None = Field(None, max_length=50)
    display_order: int | None = Field(None, ge=0)
    is_active: bool | None = None


class ExpenseCategoryResponse(ExpenseCategoryBase, IDModelSchema):
    """Expense category for API responses"""
    is_system: bool
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ExpenseCategoryListResponse(BaseSchema):
    """Simplified expense category for listings"""
    id: UUID
    code: str
    name: str
    description: str | None = None
    color: str
    icon: str | None
    is_system: bool
    is_active: bool
    display_order: int


# ============================================
# Caja Menor Configuration Schemas
# ============================================

class CajaMenorConfigUpdate(BaseSchema):
    """Schema for updating Caja Menor auto-close configuration"""
    base_amount: Decimal | None = Field(None, gt=0)
    auto_close_enabled: bool | None = None
    auto_close_time: str | None = Field(None, pattern=r'^\d{2}:\d{2}$')


class CajaMenorConfigResponse(BaseSchema):
    """Caja Menor configuration for API responses"""
    id: UUID
    base_amount: Decimal
    auto_close_enabled: bool
    auto_close_time: str | None
    last_auto_close_at: datetime | None
    updated_by: UUID | None
    updated_at: datetime

    model_config = {"from_attributes": True}


class CajaMenorAutoCloseResult(BaseSchema):
    """Result of a Caja Menor auto-close operation"""
    success: bool
    message: str
    excess_amount: Decimal
    amount_transferred: Decimal
    caja_menor_new_balance: Decimal
    caja_mayor_new_balance: Decimal
    base_amount: Decimal


# ============================================
# Inter-Account Transfer Schemas
# ============================================

class AccountTransferCreate(BaseSchema):
    """Schema for creating an inter-account transfer"""
    from_account_id: UUID
    to_account_id: UUID
    amount: Decimal = Field(..., gt=0)
    reason: str = Field(..., min_length=1, max_length=500)
    reference: str | None = Field(None, max_length=100)

    @model_validator(mode='after')
    def validate_different_accounts(self):
        if self.from_account_id == self.to_account_id:
            raise ValueError("Las cuentas de origen y destino deben ser diferentes")
        return self


class AccountTransferResponse(BaseSchema):
    """Response for a completed transfer"""
    success: bool
    message: str
    transfer_id: UUID
    amount: Decimal
    from_account: dict
    to_account: dict
    reference: str
    created_at: datetime


class TransferHistoryItem(BaseSchema):
    """A single transfer in history"""
    id: UUID
    amount: Decimal
    from_account_name: str
    from_account_code: str | None
    to_account_name: str
    to_account_code: str | None
    description: str
    reference: str | None
    created_by_name: str | None
    created_at: datetime


class TransferHistoryResponse(BaseSchema):
    """Paginated transfer history"""
    items: list[TransferHistoryItem]
    total: int
    limit: int
    offset: int
