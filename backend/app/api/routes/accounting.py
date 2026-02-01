"""
Accounting Endpoints - Transactions, Expenses, and Cash Flow
"""
from uuid import UUID
from datetime import date
from fastapi import APIRouter, HTTPException, status, Query, Depends

from app.api.dependencies import (
    DatabaseSession, CurrentUser, require_school_access,
    require_permission, require_permission_with_constraints
)
from app.models.user import UserRole
from app.models.accounting import TransactionType, ExpenseCategory
from app.models.accounting import AccountType
from app.schemas.accounting import (
    TransactionCreate, TransactionResponse, TransactionListResponse,
    ExpenseCreate, ExpenseUpdate, ExpenseResponse, ExpenseListResponse, ExpensePayment,
    DailyCashRegisterCreate, DailyCashRegisterClose, DailyCashRegisterResponse,
    CashFlowSummary, MonthlyFinancialReport, AccountingDashboard, ExpensesByCategory,
    # Balance General schemas
    BalanceAccountCreate, BalanceAccountUpdate, BalanceAccountResponse, BalanceAccountListResponse,
    BalanceEntryCreate, BalanceEntryResponse,
    AccountsReceivableCreate, AccountsReceivableUpdate, AccountsReceivableResponse,
    AccountsReceivableListResponse, AccountsReceivablePayment,
    AccountsPayableCreate, AccountsPayableUpdate, AccountsPayableResponse,
    AccountsPayableListResponse, AccountsPayablePayment,
    BalanceGeneralSummary, BalanceGeneralDetailed, ReceivablesPayablesSummary
)
from app.services.accounting import (
    TransactionService, ExpenseService, DailyCashRegisterService, AccountingService,
    # Balance General services
    BalanceAccountService, BalanceEntryService,
    AccountsReceivableService, AccountsPayableService, BalanceGeneralService
)


router = APIRouter(prefix="/schools/{school_id}/accounting", tags=["Accounting"])


# ============================================
# Dashboard & Reports
# ============================================

@router.get(
    "/dashboard",
    response_model=AccountingDashboard,
    dependencies=[Depends(require_school_access(UserRole.ADMIN))]
)
async def get_accounting_dashboard(
    school_id: UUID,
    db: DatabaseSession
):
    """
    Get accounting dashboard overview (requires ADMIN role)

    Shows:
    - Today's income/expenses/net
    - Month's income/expenses/net
    - Pending expenses count and amount
    - Recent transactions
    """
    service = AccountingService(db)
    return await service.get_dashboard(school_id)


@router.get(
    "/cash-flow",
    response_model=CashFlowSummary,
    dependencies=[Depends(require_school_access(UserRole.ADMIN))]
)
async def get_cash_flow_summary(
    school_id: UUID,
    db: DatabaseSession,
    start_date: date = Query(..., description="Start date"),
    end_date: date = Query(..., description="End date")
):
    """
    Get cash flow summary for a date range (requires ADMIN role)
    """
    if start_date > end_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="start_date must be before end_date"
        )

    service = AccountingService(db)
    return await service.get_cash_flow_summary(school_id, start_date, end_date)


@router.get(
    "/monthly-report/{year}/{month}",
    response_model=MonthlyFinancialReport,
    dependencies=[Depends(require_school_access(UserRole.ADMIN))]
)
async def get_monthly_report(
    school_id: UUID,
    year: int,
    month: int,
    db: DatabaseSession
):
    """
    Get monthly financial report (requires ADMIN role)
    """
    if month < 1 or month > 12:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Month must be between 1 and 12"
        )

    service = AccountingService(db)
    return await service.get_monthly_report(school_id, year, month)


# ============================================
# Transactions
# ============================================

@router.post(
    "/transactions",
    response_model=TransactionResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_school_access(UserRole.ADMIN))]
)
async def create_transaction(
    school_id: UUID,
    transaction_data: TransactionCreate,
    db: DatabaseSession,
    current_user: CurrentUser
):
    """
    Create a manual transaction (requires ADMIN role)

    Note: Sales and order payments automatically create transactions.
    Use this for manual income/expense entries.
    """
    transaction_data.school_id = school_id

    service = TransactionService(db)

    try:
        transaction = await service.create_transaction(
            transaction_data,
            created_by=current_user.id
        )
        await db.commit()
        return TransactionResponse.model_validate(transaction)
    except ValueError as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get(
    "/transactions",
    response_model=list[TransactionListResponse],
    dependencies=[Depends(require_school_access(UserRole.ADMIN))]
)
async def list_transactions(
    school_id: UUID,
    db: DatabaseSession,
    start_date: date = Query(None, description="Filter by start date"),
    end_date: date = Query(None, description="Filter by end date"),
    transaction_type: TransactionType = Query(None, description="Filter by type"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500)
):
    """
    List transactions with optional filters (requires ADMIN role)
    """
    service = TransactionService(db)

    if start_date and end_date:
        transactions = await service.get_transactions_by_date_range(
            school_id, start_date, end_date, transaction_type
        )
        # Apply pagination manually
        transactions = transactions[skip:skip + limit]
    else:
        filters = {}
        if transaction_type:
            filters["type"] = transaction_type
        transactions = await service.get_multi(
            school_id=school_id,
            skip=skip,
            limit=limit,
            filters=filters if filters else None
        )

    return [TransactionListResponse.model_validate(t) for t in transactions]


@router.get(
    "/transactions/{transaction_id}",
    response_model=TransactionResponse,
    dependencies=[Depends(require_school_access(UserRole.ADMIN))]
)
async def get_transaction(
    school_id: UUID,
    transaction_id: UUID,
    db: DatabaseSession
):
    """Get transaction by ID (requires ADMIN role)"""
    service = TransactionService(db)
    transaction = await service.get(transaction_id, school_id)

    if not transaction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transaction not found"
        )

    return TransactionResponse.model_validate(transaction)


# ============================================
# Expenses
# ============================================

@router.post(
    "/expenses",
    response_model=ExpenseResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_school_access(UserRole.ADMIN))]
)
async def create_expense(
    school_id: UUID,
    expense_data: ExpenseCreate,
    db: DatabaseSession,
    current_user: CurrentUser
):
    """
    Create a new expense record (requires ADMIN role)
    """
    expense_data.school_id = school_id

    service = ExpenseService(db)

    try:
        expense = await service.create_expense(
            expense_data,
            created_by=current_user.id
        )
        await db.commit()
        return ExpenseResponse.model_validate(expense)
    except ValueError as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get(
    "/expenses",
    response_model=list[ExpenseListResponse],
    dependencies=[Depends(require_school_access(UserRole.ADMIN))]
)
async def list_expenses(
    school_id: UUID,
    db: DatabaseSession,
    category: ExpenseCategory = Query(None, description="Filter by category"),
    is_paid: bool = Query(None, description="Filter by payment status"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500)
):
    """
    List expenses with optional filters (requires ADMIN role)
    """
    service = ExpenseService(db)

    filters = {"is_active": True}
    if category:
        filters["category"] = category
    if is_paid is not None:
        filters["is_paid"] = is_paid

    expenses = await service.get_multi(
        school_id=school_id,
        skip=skip,
        limit=limit,
        filters=filters
    )

    return [
        ExpenseListResponse(
            id=e.id,
            category=e.category,
            description=e.description,
            amount=e.amount,
            amount_paid=e.amount_paid,
            is_paid=e.is_paid,
            expense_date=e.expense_date,
            due_date=e.due_date,
            vendor=e.vendor,
            is_recurring=e.is_recurring,
            balance=e.balance
        )
        for e in expenses
    ]


@router.get(
    "/expenses/pending",
    response_model=list[ExpenseListResponse],
    dependencies=[Depends(require_school_access(UserRole.ADMIN))]
)
async def get_pending_expenses(
    school_id: UUID,
    db: DatabaseSession
):
    """
    Get all pending (unpaid) expenses (requires ADMIN role)
    """
    service = ExpenseService(db)
    expenses = await service.get_pending_expenses(school_id)

    return [
        ExpenseListResponse(
            id=e.id,
            category=e.category,
            description=e.description,
            amount=e.amount,
            amount_paid=e.amount_paid,
            is_paid=e.is_paid,
            expense_date=e.expense_date,
            due_date=e.due_date,
            vendor=e.vendor,
            is_recurring=e.is_recurring,
            balance=e.balance
        )
        for e in expenses
    ]


@router.get(
    "/expenses/by-category",
    response_model=list[ExpensesByCategory],
    dependencies=[Depends(require_school_access(UserRole.ADMIN))]
)
async def get_expenses_by_category(
    school_id: UUID,
    db: DatabaseSession,
    start_date: date = Query(..., description="Start date"),
    end_date: date = Query(..., description="End date")
):
    """
    Get expenses grouped by category for a date range (requires ADMIN role)
    """
    if start_date > end_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="start_date must be before end_date"
        )

    service = ExpenseService(db)
    return await service.get_expenses_by_category(school_id, start_date, end_date)


@router.get(
    "/expenses/{expense_id}",
    response_model=ExpenseResponse,
    dependencies=[Depends(require_school_access(UserRole.ADMIN))]
)
async def get_expense(
    school_id: UUID,
    expense_id: UUID,
    db: DatabaseSession
):
    """Get expense by ID (requires ADMIN role)"""
    service = ExpenseService(db)
    expense = await service.get(expense_id, school_id)

    if not expense:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Expense not found"
        )

    return ExpenseResponse.model_validate(expense)


@router.patch(
    "/expenses/{expense_id}",
    response_model=ExpenseResponse,
    dependencies=[Depends(require_school_access(UserRole.ADMIN))]
)
async def update_expense(
    school_id: UUID,
    expense_id: UUID,
    expense_data: ExpenseUpdate,
    db: DatabaseSession
):
    """Update an expense (requires ADMIN role)"""
    service = ExpenseService(db)

    try:
        expense = await service.update_expense(expense_id, school_id, expense_data)

        if not expense:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Expense not found"
            )

        await db.commit()
        return ExpenseResponse.model_validate(expense)
    except ValueError as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post(
    "/expenses/{expense_id}/pay",
    response_model=ExpenseResponse,
    dependencies=[Depends(require_school_access(UserRole.ADMIN))]
)
async def pay_expense(
    school_id: UUID,
    expense_id: UUID,
    payment: ExpensePayment,
    db: DatabaseSession,
    current_user: CurrentUser
):
    """
    Record a payment for an expense (requires ADMIN role)

    Creates an expense transaction automatically.
    """
    service = ExpenseService(db)

    try:
        expense = await service.pay_expense(
            expense_id,
            school_id,
            payment,
            created_by=current_user.id
        )

        if not expense:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Expense not found"
            )

        await db.commit()
        return ExpenseResponse.model_validate(expense)
    except ValueError as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.delete(
    "/expenses/{expense_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_school_access(UserRole.OWNER))]
)
async def delete_expense(
    school_id: UUID,
    expense_id: UUID,
    db: DatabaseSession
):
    """Soft delete an expense (requires OWNER role)"""
    service = ExpenseService(db)

    expense = await service.soft_delete(expense_id, school_id)

    if not expense:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Expense not found"
        )

    await db.commit()


# ============================================
# Daily Cash Register
# ============================================

@router.post(
    "/cash-register",
    response_model=DailyCashRegisterResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission("accounting.open_register"))]
)
async def open_cash_register(
    school_id: UUID,
    register_data: DailyCashRegisterCreate,
    db: DatabaseSession
):
    """
    Open a new daily cash register (requires accounting.open_register permission)
    """
    register_data.school_id = school_id

    service = DailyCashRegisterService(db)

    try:
        register = await service.open_register(register_data)
        await db.commit()
        return DailyCashRegisterResponse.model_validate(register)
    except ValueError as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get(
    "/cash-register/today",
    response_model=DailyCashRegisterResponse,
    dependencies=[Depends(require_permission("accounting.view_caja_menor"))]
)
async def get_today_register(
    school_id: UUID,
    db: DatabaseSession
):
    """
    Get or create today's cash register (requires accounting.view_caja_menor permission)
    """
    service = DailyCashRegisterService(db)
    register = await service.get_or_create_today(school_id)
    await db.commit()
    return DailyCashRegisterResponse.model_validate(register)


@router.get(
    "/cash-register/{register_date}",
    response_model=DailyCashRegisterResponse,
    dependencies=[Depends(require_school_access(UserRole.ADMIN))]
)
async def get_register_by_date(
    school_id: UUID,
    register_date: date,
    db: DatabaseSession
):
    """
    Get cash register for a specific date (requires ADMIN role)
    """
    service = DailyCashRegisterService(db)
    register = await service.get_register_by_date(school_id, register_date)

    if not register:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No register found for {register_date}"
        )

    return DailyCashRegisterResponse.model_validate(register)


@router.post(
    "/cash-register/{register_id}/close",
    response_model=DailyCashRegisterResponse,
    dependencies=[Depends(require_permission("accounting.close_register"))]
)
async def close_cash_register(
    school_id: UUID,
    register_id: UUID,
    close_data: DailyCashRegisterClose,
    db: DatabaseSession,
    current_user: CurrentUser
):
    """
    Close a cash register (requires accounting.close_register permission)

    Automatically calculates:
    - Total income by payment method
    - Total expenses
    - Net cash flow
    """
    service = DailyCashRegisterService(db)

    try:
        register = await service.close_register(
            register_id,
            school_id,
            close_data,
            closed_by=current_user.id
        )

        if not register:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Cash register not found"
            )

        await db.commit()
        return DailyCashRegisterResponse.model_validate(register)
    except ValueError as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


# ============================================
# Balance General - Summary & Reports
# ============================================

@router.get(
    "/balance-general/summary",
    response_model=BalanceGeneralSummary,
    dependencies=[Depends(require_school_access(UserRole.ADMIN))]
)
async def get_balance_general_summary(
    school_id: UUID,
    db: DatabaseSession
):
    """
    Get balance general (balance sheet) summary (requires ADMIN role)

    Shows totals for:
    - Assets (current, fixed, other)
    - Liabilities (current, long-term, other)
    - Equity
    """
    service = BalanceGeneralService(db)
    return await service.get_balance_general_summary(school_id)


@router.get(
    "/balance-general/detailed",
    response_model=BalanceGeneralDetailed,
    dependencies=[Depends(require_school_access(UserRole.ADMIN))]
)
async def get_balance_general_detailed(
    school_id: UUID,
    db: DatabaseSession
):
    """
    Get detailed balance general with account breakdown (requires ADMIN role)
    """
    service = BalanceGeneralService(db)
    return await service.get_balance_general_detailed(school_id)


@router.get(
    "/receivables-payables/summary",
    response_model=ReceivablesPayablesSummary,
    dependencies=[Depends(require_school_access(UserRole.ADMIN))]
)
async def get_receivables_payables_summary(
    school_id: UUID,
    db: DatabaseSession
):
    """
    Get summary of accounts receivable and payable (requires ADMIN role)

    Shows:
    - Receivables: total, collected, pending, overdue
    - Payables: total, paid, pending, overdue
    - Net position
    """
    service = BalanceGeneralService(db)
    return await service.get_receivables_payables_summary(school_id)


# ============================================
# Balance Accounts (Activos, Pasivos, Patrimonio)
# ============================================

@router.post(
    "/balance-accounts",
    response_model=BalanceAccountResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_school_access(UserRole.ADMIN))]
)
async def create_balance_account(
    school_id: UUID,
    account_data: BalanceAccountCreate,
    db: DatabaseSession,
    current_user: CurrentUser
):
    """
    Create a new balance account (requires ADMIN role)

    Use this to add manual entries like:
    - Assets: equipment, furniture, inventory value
    - Liabilities: loans, debts
    - Equity: capital, retained earnings
    """
    account_data.school_id = school_id

    service = BalanceAccountService(db)

    try:
        account = await service.create_account(
            account_data,
            created_by=current_user.id
        )
        await db.commit()
        return BalanceAccountResponse.model_validate(account)
    except ValueError as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get(
    "/balance-accounts",
    response_model=list[BalanceAccountListResponse],
    dependencies=[Depends(require_school_access(UserRole.ADMIN))]
)
async def list_balance_accounts(
    school_id: UUID,
    db: DatabaseSession,
    account_type: AccountType = Query(None, description="Filter by account type"),
    is_active: bool = Query(True, description="Filter by active status")
):
    """
    List balance accounts (requires ADMIN role)
    """
    service = BalanceAccountService(db)

    if account_type:
        accounts = await service.get_accounts_by_type(school_id, account_type)
    else:
        accounts = await service.get_all_active_accounts(school_id)

    if not is_active:
        # Get all including inactive
        accounts = await service.get_multi(
            school_id=school_id,
            filters={"is_active": is_active} if is_active is not None else None
        )

    return [
        BalanceAccountListResponse(
            id=a.id,
            account_type=a.account_type,
            name=a.name,
            code=a.code,
            balance=a.balance,
            net_value=a.net_value,
            is_active=a.is_active
        )
        for a in accounts
    ]


@router.get(
    "/balance-accounts/{account_id}",
    response_model=BalanceAccountResponse,
    dependencies=[Depends(require_school_access(UserRole.ADMIN))]
)
async def get_balance_account(
    school_id: UUID,
    account_id: UUID,
    db: DatabaseSession
):
    """Get balance account by ID (requires ADMIN role)"""
    service = BalanceAccountService(db)
    account = await service.get(account_id, school_id)

    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Balance account not found"
        )

    return BalanceAccountResponse.model_validate(account)


@router.patch(
    "/balance-accounts/{account_id}",
    response_model=BalanceAccountResponse,
    dependencies=[Depends(require_school_access(UserRole.ADMIN))]
)
async def update_balance_account(
    school_id: UUID,
    account_id: UUID,
    account_data: BalanceAccountUpdate,
    db: DatabaseSession
):
    """Update a balance account (requires ADMIN role)"""
    service = BalanceAccountService(db)

    try:
        account = await service.update_account(account_id, school_id, account_data)

        if not account:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Balance account not found"
            )

        await db.commit()
        return BalanceAccountResponse.model_validate(account)
    except ValueError as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post(
    "/balance-accounts/{account_id}/entries",
    response_model=BalanceEntryResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_school_access(UserRole.ADMIN))]
)
async def create_balance_entry(
    school_id: UUID,
    account_id: UUID,
    entry_data: BalanceEntryCreate,
    db: DatabaseSession,
    current_user: CurrentUser
):
    """
    Create a balance entry (journal entry) for an account (requires ADMIN role)

    Automatically updates the account balance.
    Use positive amounts for increases, negative for decreases.
    """
    entry_data.school_id = school_id
    entry_data.account_id = account_id

    service = BalanceEntryService(db)

    try:
        entry = await service.create_entry(
            entry_data,
            created_by=current_user.id
        )
        await db.commit()
        return BalanceEntryResponse.model_validate(entry)
    except ValueError as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get(
    "/balance-accounts/{account_id}/entries",
    response_model=list[BalanceEntryResponse],
    dependencies=[Depends(require_school_access(UserRole.ADMIN))]
)
async def list_balance_entries(
    school_id: UUID,
    account_id: UUID,
    db: DatabaseSession,
    limit: int = Query(50, ge=1, le=200)
):
    """
    List recent entries for a balance account (requires ADMIN role)
    """
    service = BalanceEntryService(db)
    entries = await service.get_entries_for_account(account_id, school_id, limit)

    return [BalanceEntryResponse.model_validate(e) for e in entries]


# ============================================
# Accounts Receivable (Cuentas por Cobrar)
# ============================================


def _build_receivable_list_response(r) -> AccountsReceivableListResponse:
    """Build a detailed AccountsReceivableListResponse from a receivable with loaded relationships"""
    # Determine origin type
    origin_type = None
    if r.sale_id:
        origin_type = "sale"
    elif r.order_id:
        origin_type = "order"
    else:
        origin_type = "manual"

    return AccountsReceivableListResponse(
        id=r.id,
        client_id=r.client_id,
        client_name=r.client.name if r.client else None,
        amount=r.amount,
        amount_paid=r.amount_paid,
        balance=r.balance,
        description=r.description,
        invoice_date=r.invoice_date,
        due_date=r.due_date,
        is_paid=r.is_paid,
        is_overdue=r.is_overdue,
        # Origin information
        origin_type=origin_type,
        sale_id=r.sale_id,
        sale_code=r.sale.code if r.sale else None,
        order_id=r.order_id,
        order_code=r.order.code if r.order else None,
        order_status=r.order.status.value if r.order else None,
        # School information
        school_id=r.school_id,
        school_name=r.school.name if r.school else None,
        # Notes
        notes=r.notes
    )


@router.post(
    "/receivables",
    response_model=AccountsReceivableResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_school_access(UserRole.ADMIN))]
)
async def create_receivable(
    school_id: UUID,
    receivable_data: AccountsReceivableCreate,
    db: DatabaseSession,
    current_user: CurrentUser
):
    """
    Create a new accounts receivable (requires ADMIN role)

    For tracking money owed TO the business by clients.
    """
    receivable_data.school_id = school_id

    service = AccountsReceivableService(db)

    try:
        receivable = await service.create_receivable(
            receivable_data,
            created_by=current_user.id
        )
        await db.commit()
        return AccountsReceivableResponse.model_validate(receivable)
    except ValueError as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get(
    "/receivables",
    response_model=list[AccountsReceivableListResponse],
    dependencies=[Depends(require_school_access(UserRole.ADMIN))]
)
async def list_receivables(
    school_id: UUID,
    db: DatabaseSession,
    is_paid: bool = Query(None, description="Filter by payment status"),
    is_overdue: bool = Query(None, description="Filter by overdue status"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500)
):
    """
    List accounts receivable (requires ADMIN role)
    """
    service = AccountsReceivableService(db)

    filters = {}
    if is_paid is not None:
        filters["is_paid"] = is_paid
    if is_overdue is not None:
        filters["is_overdue"] = is_overdue

    # Use get_multi_with_client to avoid lazy loading issues
    receivables = await service.get_multi_with_client(
        school_id=school_id,
        skip=skip,
        limit=limit,
        filters=filters if filters else None
    )

    return [_build_receivable_list_response(r) for r in receivables]


@router.get(
    "/receivables/pending",
    response_model=list[AccountsReceivableListResponse],
    dependencies=[Depends(require_school_access(UserRole.ADMIN))]
)
async def get_pending_receivables(
    school_id: UUID,
    db: DatabaseSession
):
    """
    Get all pending (unpaid) receivables (requires ADMIN role)
    """
    service = AccountsReceivableService(db)
    receivables = await service.get_pending_receivables(school_id)

    return [_build_receivable_list_response(r) for r in receivables]


@router.get(
    "/receivables/{receivable_id}",
    response_model=AccountsReceivableResponse,
    dependencies=[Depends(require_school_access(UserRole.ADMIN))]
)
async def get_receivable(
    school_id: UUID,
    receivable_id: UUID,
    db: DatabaseSession
):
    """Get receivable by ID (requires ADMIN role)"""
    service = AccountsReceivableService(db)
    receivable = await service.get(receivable_id, school_id)

    if not receivable:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Receivable not found"
        )

    return AccountsReceivableResponse.model_validate(receivable)


@router.post(
    "/receivables/{receivable_id}/pay",
    response_model=AccountsReceivableResponse,
    dependencies=[Depends(require_school_access(UserRole.ADMIN))]
)
async def pay_receivable(
    school_id: UUID,
    receivable_id: UUID,
    payment: AccountsReceivablePayment,
    db: DatabaseSession,
    current_user: CurrentUser
):
    """
    Record a payment on accounts receivable (requires ADMIN role)

    Creates an income transaction automatically.
    """
    service = AccountsReceivableService(db)

    try:
        receivable = await service.record_payment(
            receivable_id,
            school_id,
            payment,
            created_by=current_user.id
        )

        if not receivable:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Receivable not found"
            )

        await db.commit()
        return AccountsReceivableResponse.model_validate(receivable)
    except ValueError as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


# ============================================
# Accounts Payable (Cuentas por Pagar)
# ============================================

@router.post(
    "/payables",
    response_model=AccountsPayableResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_school_access(UserRole.ADMIN))]
)
async def create_payable(
    school_id: UUID,
    payable_data: AccountsPayableCreate,
    db: DatabaseSession,
    current_user: CurrentUser
):
    """
    Create a new accounts payable (requires ADMIN role)

    For tracking money owed BY the business to suppliers.
    """
    payable_data.school_id = school_id

    service = AccountsPayableService(db)

    try:
        payable = await service.create_payable(
            payable_data,
            created_by=current_user.id
        )
        await db.commit()
        return AccountsPayableResponse.model_validate(payable)
    except ValueError as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get(
    "/payables",
    response_model=list[AccountsPayableListResponse],
    dependencies=[Depends(require_school_access(UserRole.ADMIN))]
)
async def list_payables(
    school_id: UUID,
    db: DatabaseSession,
    is_paid: bool = Query(None, description="Filter by payment status"),
    is_overdue: bool = Query(None, description="Filter by overdue status"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500)
):
    """
    List accounts payable (requires ADMIN role)
    """
    service = AccountsPayableService(db)

    filters = {}
    if is_paid is not None:
        filters["is_paid"] = is_paid
    if is_overdue is not None:
        filters["is_overdue"] = is_overdue

    payables = await service.get_multi(
        school_id=school_id,
        skip=skip,
        limit=limit,
        filters=filters if filters else None
    )

    return [
        AccountsPayableListResponse(
            id=p.id,
            vendor=p.vendor,
            amount=p.amount,
            amount_paid=p.amount_paid,
            balance=p.balance,
            description=p.description,
            category=p.category,
            invoice_number=p.invoice_number,
            invoice_date=p.invoice_date,
            due_date=p.due_date,
            is_paid=p.is_paid,
            is_overdue=p.is_overdue
        )
        for p in payables
    ]


@router.get(
    "/payables/pending",
    response_model=list[AccountsPayableListResponse],
    dependencies=[Depends(require_school_access(UserRole.ADMIN))]
)
async def get_pending_payables(
    school_id: UUID,
    db: DatabaseSession
):
    """
    Get all pending (unpaid) payables (requires ADMIN role)
    """
    service = AccountsPayableService(db)
    payables = await service.get_pending_payables(school_id)

    return [
        AccountsPayableListResponse(
            id=p.id,
            vendor=p.vendor,
            amount=p.amount,
            amount_paid=p.amount_paid,
            balance=p.balance,
            description=p.description,
            category=p.category,
            invoice_number=p.invoice_number,
            invoice_date=p.invoice_date,
            due_date=p.due_date,
            is_paid=p.is_paid,
            is_overdue=p.is_overdue
        )
        for p in payables
    ]


@router.get(
    "/payables/{payable_id}",
    response_model=AccountsPayableResponse,
    dependencies=[Depends(require_school_access(UserRole.ADMIN))]
)
async def get_payable(
    school_id: UUID,
    payable_id: UUID,
    db: DatabaseSession
):
    """Get payable by ID (requires ADMIN role)"""
    service = AccountsPayableService(db)
    payable = await service.get(payable_id, school_id)

    if not payable:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payable not found"
        )

    return AccountsPayableResponse.model_validate(payable)


@router.post(
    "/payables/{payable_id}/pay",
    response_model=AccountsPayableResponse,
    dependencies=[Depends(require_school_access(UserRole.ADMIN))]
)
async def pay_payable(
    school_id: UUID,
    payable_id: UUID,
    payment: AccountsPayablePayment,
    db: DatabaseSession,
    current_user: CurrentUser
):
    """
    Record a payment on accounts payable (requires ADMIN role)

    Creates an expense transaction automatically.
    """
    service = AccountsPayableService(db)

    try:
        payable = await service.record_payment(
            payable_id,
            school_id,
            payment,
            created_by=current_user.id
        )

        if not payable:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Payable not found"
            )

        await db.commit()
        return AccountsPayableResponse.model_validate(payable)
    except ValueError as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


# ============================================
# Cash Balances (Saldos de Caja y Banco)
# ============================================

@router.get(
    "/cash-balances",
    dependencies=[Depends(require_permission("accounting.view_global_balances"))]
)
async def get_cash_balances(
    school_id: UUID,
    db: DatabaseSession
):
    """
    Get current cash and bank balances (requires accounting.view_global_balances permission)

    Returns:
        - caja_menor: Current cash balance (operational)
        - caja_mayor: Consolidated cash balance
        - nequi: Nequi balance
        - banco: Current bank account balance
        - total_liquid: Sum of all
        - total_cash: Sum of caja_menor + caja_mayor
    """
    from app.services.balance_integration import BalanceIntegrationService

    service = BalanceIntegrationService(db)
    balances = await service.get_cash_balances(school_id)

    return balances


# ============================================
# Caja Menor - Liquidation to Caja Mayor
# ============================================

@router.get(
    "/caja-menor/balance",
    dependencies=[Depends(require_permission("accounting.view_caja_menor"))]
)
async def get_caja_menor_balance(
    school_id: UUID,
    db: DatabaseSession
):
    """
    Get current Caja Menor balance (requires accounting.view_caja_menor permission)

    Returns:
        - id: Account ID
        - name: Account name
        - code: Account code (1101)
        - balance: Current balance
        - last_updated: Last update timestamp
    """
    from app.services.cash_register import CashRegisterService

    service = CashRegisterService(db)
    return await service.get_caja_menor_balance()


@router.get(
    "/caja-menor/summary",
    dependencies=[Depends(require_permission("accounting.view_caja_menor"))]
)
async def get_caja_menor_summary(
    school_id: UUID,
    db: DatabaseSession
):
    """
    Get today's Caja Menor summary (requires accounting.view_caja_menor permission)

    Returns:
        - caja_menor_balance: Current Caja Menor balance
        - caja_mayor_balance: Current Caja Mayor balance
        - today_liquidations: Total liquidated today
        - today_entries_count: Number of entries today
        - date: Today's date
    """
    from app.services.cash_register import CashRegisterService

    service = CashRegisterService(db)
    return await service.get_today_summary()


@router.post(
    "/caja-menor/liquidate",
)
async def liquidate_caja_menor(
    school_id: UUID,
    amount: float,
    db: DatabaseSession,
    current_user: CurrentUser,
    constraints: dict = Depends(require_permission_with_constraints("accounting.liquidate_caja_menor")),
    notes: str | None = None
):
    """
    Liquidate (transfer) from Caja Menor to Caja Mayor.

    Requires accounting.liquidate_caja_menor permission.
    Subject to max_amount constraint (Admin: 5M COP, Owner: unlimited).

    Args:
        amount: Amount to liquidate
        notes: Optional notes for the liquidation

    Returns:
        - success: Whether the operation was successful
        - message: Status message
        - caja_menor_balance: New Caja Menor balance
        - caja_mayor_balance: New Caja Mayor balance
        - amount_liquidated: Amount transferred
    """
    from decimal import Decimal
    from app.services.cash_register import CashRegisterService

    liquidation_amount = Decimal(str(amount))

    # Check max_amount constraint
    max_amount = constraints.get("max_amount")
    if max_amount is not None and liquidation_amount > max_amount:
        requires_approval = constraints.get("requires_approval", False)
        if requires_approval:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "code": "REQUIRES_APPROVAL",
                    "message": f"Monto ${liquidation_amount:,.0f} excede limite de ${max_amount:,.0f}. Requiere aprobacion.",
                    "max_amount": float(max_amount),
                    "requested_amount": float(liquidation_amount),
                }
            )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Monto maximo permitido para liquidacion: ${max_amount:,.0f}"
        )

    service = CashRegisterService(db)

    try:
        result = await service.liquidate_to_caja_mayor(
            amount=liquidation_amount,
            notes=notes,
            created_by=current_user.id
        )
        await db.commit()
        return result
    except ValueError as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get(
    "/caja-menor/liquidation-history",
    dependencies=[Depends(require_permission("accounting.view_liquidation_history"))]
)
async def get_liquidation_history(
    school_id: UUID,
    db: DatabaseSession,
    start_date: date = Query(None, description="Start date filter"),
    end_date: date = Query(None, description="End date filter"),
    limit: int = Query(50, ge=1, le=200)
):
    """
    Get history of Caja Menor liquidations (requires ADMIN role)

    Args:
        start_date: Optional start date filter
        end_date: Optional end date filter
        limit: Maximum number of records to return

    Returns list of liquidation records with:
        - id: Entry ID
        - date: Liquidation date
        - amount: Amount liquidated
        - balance_after: Balance after liquidation
        - description: Notes
        - reference: Liquidation reference code
        - created_at: Timestamp
    """
    from app.services.cash_register import CashRegisterService

    service = CashRegisterService(db)
    return await service.get_liquidation_history(
        start_date=start_date,
        end_date=end_date,
        limit=limit
    )


@router.post(
    "/initialize-default-accounts",
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_school_access(UserRole.ADMIN))]
)
async def initialize_default_accounts(
    school_id: UUID,
    db: DatabaseSession,
    current_user: CurrentUser,
    caja_initial_balance: float = 0,
    banco_initial_balance: float = 0
):
    """
    Initialize default balance accounts (Caja, Banco) for the school (requires ADMIN role)

    This is useful for initial setup or if accounts were deleted.
    If accounts already exist, they won't be duplicated.

    Args:
        caja_initial_balance: Initial cash balance (default 0)
        banco_initial_balance: Initial bank balance (default 0)

    Returns:
        Mapping of account types to UUIDs
    """
    from decimal import Decimal
    from app.services.balance_integration import BalanceIntegrationService

    service = BalanceIntegrationService(db)

    try:
        accounts_map = await service.initialize_default_accounts_for_school(
            school_id,
            caja_initial_balance=Decimal(str(caja_initial_balance)),
            banco_initial_balance=Decimal(str(banco_initial_balance)),
            created_by=current_user.id
        )

        await db.commit()

        return {
            "message": "Default accounts initialized successfully",
            "accounts": accounts_map
        }
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


# ============================================
# Patrimony - Inventory Valuation & Net Worth
# ============================================

@router.get(
    "/patrimony/summary",
    dependencies=[Depends(require_school_access(UserRole.ADMIN))]
)
async def get_patrimony_summary(
    school_id: UUID,
    db: DatabaseSession
):
    """
    Get complete patrimony summary (requires ADMIN role)

    PATRIMONY = ASSETS - LIABILITIES

    Assets:
    - Cash (Caja) + Bank (Banco)
    - Inventory (valued at cost or 80% of price)
    - Accounts Receivable
    - Fixed Assets (equipment, machinery)

    Liabilities:
    - Accounts Payable (suppliers)
    - Debts (loans, credits)

    Returns comprehensive breakdown and net patrimony.
    """
    from app.services.patrimony import PatrimonyService

    service = PatrimonyService(db)
    return await service.get_patrimony_summary(school_id)


@router.get(
    "/patrimony/inventory-valuation",
    dependencies=[Depends(require_school_access(UserRole.ADMIN))]
)
async def get_inventory_valuation(
    school_id: UUID,
    db: DatabaseSession
):
    """
    Get detailed inventory valuation (requires ADMIN role)

    Calculates total inventory value:
    - Uses product.cost if available
    - Falls back to price * 0.80 (80% margin) if cost not set

    Returns breakdown by product with quantities and values.
    """
    from app.services.patrimony import PatrimonyService

    service = PatrimonyService(db)
    return await service.get_inventory_valuation(school_id)


@router.post(
    "/patrimony/set-initial-balance",
    dependencies=[Depends(require_school_access(UserRole.ADMIN))]
)
async def set_initial_balance(
    school_id: UUID,
    account_code: str,  # "1101" for Caja, "1102" for Banco
    initial_balance: float,
    db: DatabaseSession,
    current_user: CurrentUser
):
    """
    Set initial balance for Caja or Banco account (requires ADMIN role)

    Use this to set starting balances when migrating to the system.
    Creates an adjustment entry in the balance history.

    Args:
        account_code: "1101" for Caja, "1102" for Banco
        initial_balance: The starting balance amount
    """
    from decimal import Decimal
    from app.services.patrimony import PatrimonyService

    service = PatrimonyService(db)

    try:
        account = await service.set_initial_balance(
            school_id,
            account_code,
            Decimal(str(initial_balance)),
            created_by=current_user.id
        )
        await db.commit()

        return {
            "message": f"Balance inicial establecido para {account.name}",
            "account_id": str(account.id),
            "account_name": account.name,
            "new_balance": float(account.balance)
        }
    except ValueError as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post(
    "/patrimony/debts",
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_school_access(UserRole.ADMIN))]
)
async def create_debt(
    school_id: UUID,
    name: str,
    amount: float,
    creditor: str,
    db: DatabaseSession,
    current_user: CurrentUser,
    is_long_term: bool = False,
    interest_rate: float | None = None,
    due_date: date | None = None,
    description: str | None = None
):
    """
    Create a new debt record (requires ADMIN role)

    Use this to register existing debts when migrating to the system.

    Args:
        name: Name/description of the debt (e.g., "Préstamo Bancolombia")
        amount: Total debt amount
        creditor: Who the debt is owed to
        is_long_term: True if > 1 year, False for short-term
        interest_rate: Annual interest rate (optional)
        due_date: When the debt is due (optional)
        description: Additional notes (optional)
    """
    from decimal import Decimal
    from app.services.patrimony import PatrimonyService

    service = PatrimonyService(db)

    try:
        debt = await service.create_debt(
            school_id,
            name=name,
            amount=Decimal(str(amount)),
            creditor=creditor,
            is_long_term=is_long_term,
            interest_rate=Decimal(str(interest_rate)) if interest_rate else None,
            due_date=due_date,
            description=description,
            created_by=current_user.id
        )
        await db.commit()

        return {
            "message": f"Deuda '{name}' registrada exitosamente",
            "debt_id": str(debt.id),
            "name": debt.name,
            "amount": float(debt.balance),
            "creditor": debt.creditor,
            "is_long_term": is_long_term
        }
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get(
    "/patrimony/debts",
    dependencies=[Depends(require_school_access(UserRole.ADMIN))]
)
async def list_debts(
    school_id: UUID,
    db: DatabaseSession
):
    """
    List all debts (requires ADMIN role)
    """
    from app.services.patrimony import PatrimonyService

    service = PatrimonyService(db)
    return await service.get_debts(school_id)


@router.post(
    "/patrimony/fixed-assets",
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_school_access(UserRole.ADMIN))]
)
async def create_fixed_asset(
    school_id: UUID,
    name: str,
    value: float,
    db: DatabaseSession,
    current_user: CurrentUser,
    description: str | None = None,
    useful_life_years: int | None = None
):
    """
    Create a fixed asset record (requires ADMIN role)

    Use this to register equipment, machinery, furniture, etc.

    Args:
        name: Name of the asset (e.g., "Máquina de coser industrial")
        value: Current value of the asset
        description: Additional notes (optional)
        useful_life_years: For depreciation calculation (optional)
    """
    from decimal import Decimal
    from app.services.patrimony import PatrimonyService

    service = PatrimonyService(db)

    try:
        asset = await service.create_fixed_asset(
            school_id,
            name=name,
            value=Decimal(str(value)),
            description=description,
            useful_life_years=useful_life_years,
            created_by=current_user.id
        )
        await db.commit()

        return {
            "message": f"Activo fijo '{name}' registrado exitosamente",
            "asset_id": str(asset.id),
            "name": asset.name,
            "value": float(asset.balance)
        }
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get(
    "/patrimony/fixed-assets",
    dependencies=[Depends(require_school_access(UserRole.ADMIN))]
)
async def list_fixed_assets(
    school_id: UUID,
    db: DatabaseSession
):
    """
    List all fixed assets (requires ADMIN role)
    """
    from app.services.patrimony import PatrimonyService

    service = PatrimonyService(db)
    return await service.get_fixed_assets(school_id)
