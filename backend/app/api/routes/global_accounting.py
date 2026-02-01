"""
Global Accounting Endpoints - Business-wide accounting operations

These endpoints operate on global accounts (school_id = NULL) for:
- Cash (Caja) and Bank (Banco) balances
- Business expenses
- Accounts payable (suppliers)
- Balance general

For school-specific reports, use /schools/{school_id}/accounting/* endpoints.
"""
from uuid import UUID
from datetime import date, datetime
from decimal import Decimal
from fastapi import APIRouter, HTTPException, status, Query, Depends

from app.utils.timezone import get_colombia_date, get_colombia_now_naive
from app.api.dependencies import (
    DatabaseSession, CurrentUser, require_any_school_admin,
    require_global_permission, require_global_permission_with_constraints
)
from app.models.user import UserRole
from app.models.accounting import (
    TransactionType, ExpenseCategory, AccountType, AccPaymentMethod, AdjustmentReason,
    BalanceAccount, BalanceEntry, Expense, AccountsPayable, AccountsReceivable, Transaction,
    ExpenseAdjustment, ExpenseCategoryModel
)
from app.models.school import School
from app.schemas.accounting import (
    ExpenseCreate, ExpenseUpdate, ExpenseResponse, ExpenseListResponse, ExpensePayment,
    GlobalExpenseCreate, GlobalExpenseResponse,
    BalanceAccountResponse, BalanceAccountListResponse, BalanceAccountUpdate,
    GlobalBalanceAccountCreate, GlobalBalanceAccountResponse,
    GlobalAccountsPayableCreate, GlobalAccountsPayableResponse, AccountsPayableListResponse, AccountsPayablePayment,
    GlobalAccountsReceivableCreate, GlobalAccountsReceivableResponse, AccountsReceivableListResponse, AccountsReceivablePayment,
    BalanceGeneralSummary, BalanceGeneralDetailed,
    TransactionListItemResponse, ExpenseCategorySummary, CashFlowPeriodItem, CashFlowReportResponse,
    # Expense Adjustment schemas
    ExpenseAdjustmentRequest, ExpenseRevertRequest, PartialRefundRequest,
    ExpenseAdjustmentResponse, ExpenseAdjustmentListResponse,
    ExpenseAdjustmentHistoryResponse, AdjustmentListPaginatedResponse,
    # Expense Category schemas
    ExpenseCategoryCreate, ExpenseCategoryUpdate, ExpenseCategoryResponse, ExpenseCategoryListResponse,
    # Caja Menor Config & Transfer schemas
    CajaMenorConfigUpdate, CajaMenorConfigResponse, CajaMenorAutoCloseResult,
    AccountTransferCreate, AccountTransferResponse, TransferHistoryResponse
)
from app.schemas.planning import (
    DebtPaymentCreate, DebtPaymentUpdate, DebtPaymentMarkPaid
)
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

router = APIRouter(prefix="/global/accounting", tags=["Global Accounting"])


# ============================================
# Global Cash Balances (Caja y Banco)
# ============================================

@router.get(
    "/cash-balances",
    dependencies=[Depends(require_global_permission("accounting.view_global_balances"))]
)
async def get_global_cash_balances(
    db: DatabaseSession
):
    """
    Get global cash and bank balances (business-wide)

    Returns:
        - caja: Current cash balance
        - banco: Current bank account balance
        - total_liquid: Sum of both
    """
    from app.services.balance_integration import BalanceIntegrationService

    service = BalanceIntegrationService(db)
    balances = await service.get_global_cash_balances()

    return balances


@router.post(
    "/initialize-accounts",
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_any_school_admin)]
)
async def initialize_global_accounts(
    db: DatabaseSession,
    current_user: CurrentUser,
    caja_initial_balance: float = 0,
    banco_initial_balance: float = 0
):
    """
    Initialize global balance accounts (Caja, Banco) for the business

    This creates global accounts with school_id = NULL.
    If accounts already exist, they won't be duplicated.

    Args:
        caja_initial_balance: Initial cash balance (default 0)
        banco_initial_balance: Initial bank balance (default 0)

    Returns:
        Mapping of account types to UUIDs
    """
    from app.services.balance_integration import BalanceIntegrationService

    service = BalanceIntegrationService(db)

    try:
        accounts_map = await service.get_or_create_global_accounts(
            created_by=current_user.id
        )

        # Set initial balances if provided
        if caja_initial_balance > 0 or banco_initial_balance > 0:
            # Get and update caja
            result = await db.execute(
                select(BalanceAccount).where(
                    BalanceAccount.id == accounts_map["caja"]
                )
            )
            caja = result.scalar_one_or_none()
            if caja and caja_initial_balance > 0:
                caja.balance = Decimal(str(caja_initial_balance))

            # Get and update banco
            result = await db.execute(
                select(BalanceAccount).where(
                    BalanceAccount.id == accounts_map["banco"]
                )
            )
            banco = result.scalar_one_or_none()
            if banco and banco_initial_balance > 0:
                banco.balance = Decimal(str(banco_initial_balance))

        await db.commit()

        return {
            "message": "Global accounts initialized successfully",
            "accounts": {k: str(v) for k, v in accounts_map.items()}
        }
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.post(
    "/set-balance",
)
async def set_global_account_balance(
    account_code: str,  # "1101" for Caja, "1102" for Banco
    new_balance: float,
    db: DatabaseSession,
    current_user: CurrentUser,
    constraints: dict = Depends(require_global_permission_with_constraints("accounting.adjust_balance")),
    description: str = "Ajuste de balance inicial"
):
    """
    Set balance for a global account (Caja or Banco).

    Requires accounting.adjust_balance permission.
    Subject to max_amount constraint on the adjustment magnitude.
    Admin: max adjustment 1M COP + requires approval. Owner: unlimited.

    Args:
        account_code: "1101" for Caja, "1102" for Banco
        new_balance: The new balance amount
        description: Reason for the adjustment
    """
    # Get global account
    result = await db.execute(
        select(BalanceAccount).where(
            BalanceAccount.school_id.is_(None),
            BalanceAccount.code == account_code,
            BalanceAccount.is_active == True
        )
    )
    account = result.scalar_one_or_none()

    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Global account with code '{account_code}' not found. Initialize accounts first."
        )

    old_balance = account.balance
    adjustment = Decimal(str(new_balance)) - old_balance
    adjustment_abs = abs(adjustment)

    # Check max_amount constraint on adjustment magnitude
    max_amount = constraints.get("max_amount")
    requires_approval = constraints.get("requires_approval", False)

    if max_amount is not None and adjustment_abs > max_amount:
        if requires_approval:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "code": "REQUIRES_APPROVAL",
                    "message": f"Ajuste de ${adjustment_abs:,.0f} excede limite de ${max_amount:,.0f}. Requiere aprobacion.",
                    "max_amount": float(max_amount),
                    "requested_amount": float(adjustment_abs),
                }
            )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Monto maximo de ajuste permitido: ${max_amount:,.0f}"
        )

    # If requires_approval regardless of amount (e.g., Admin always needs approval)
    if requires_approval and max_amount is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "REQUIRES_APPROVAL",
                "message": "Esta operacion requiere aprobacion de un supervisor.",
                "requested_amount": float(adjustment_abs),
            }
        )

    # Create balance entry for audit
    entry = BalanceEntry(
        school_id=None,  # Global
        account_id=account.id,
        entry_date=get_colombia_date(),
        amount=adjustment,
        balance_after=Decimal(str(new_balance)),
        description=f"{description} (de ${old_balance} a ${new_balance})",
        reference="AJUSTE",
        created_by=current_user.id
    )
    db.add(entry)

    # Update balance
    account.balance = Decimal(str(new_balance))

    await db.commit()

    return {
        "message": f"Balance actualizado para {account.name}",
        "account_id": str(account.id),
        "account_name": account.name,
        "old_balance": float(old_balance),
        "new_balance": float(account.balance),
        "adjustment": float(adjustment)
    }


@router.get(
    "/daily-flow",
    dependencies=[Depends(require_global_permission("accounting.view_daily_flow"))]
)
async def get_daily_account_flow(
    db: DatabaseSession,
    target_date: date = Query(None, description="Fecha a consultar (default: hoy)")
):
    """
    Obtiene el flujo diario de cada cuenta de balance para cierre de caja.

    Muestra para cada cuenta (Caja Menor, Caja Mayor, Nequi, Banco):
    - Saldo inicial del dia
    - Total de entradas (ingresos)
    - Total de salidas (gastos)
    - Saldo final
    - Cantidad de movimientos

    Args:
        target_date: Fecha a consultar (default: hoy)

    Returns:
        DailyFlowResponse con cuentas y totales
    """
    from app.services.cash_register import CashRegisterService

    service = CashRegisterService(db)
    result = await service.get_daily_flow_by_account(target_date)

    return result


# ============================================
# Global Balance Accounts
# ============================================

@router.get(
    "/balance-accounts",
    response_model=list[GlobalBalanceAccountResponse],
    dependencies=[Depends(require_any_school_admin)]
)
async def list_global_balance_accounts(
    db: DatabaseSession,
    account_type: AccountType = Query(None, description="Filter by account type"),
    is_active: bool = Query(True, description="Filter by active status")
):
    """
    List global balance accounts (school_id = NULL)
    """
    query = select(BalanceAccount).where(
        BalanceAccount.school_id.is_(None)
    )

    if account_type:
        query = query.where(BalanceAccount.account_type == account_type)
    if is_active is not None:
        query = query.where(BalanceAccount.is_active == is_active)

    query = query.order_by(BalanceAccount.code)
    result = await db.execute(query)
    accounts = result.scalars().all()

    return [
        GlobalBalanceAccountResponse.model_validate(a)
        for a in accounts
    ]


@router.get(
    "/balance-accounts/{account_id}",
    response_model=GlobalBalanceAccountResponse,
    dependencies=[Depends(require_any_school_admin)]
)
async def get_global_balance_account(
    account_id: UUID,
    db: DatabaseSession
):
    """Get global balance account by ID"""
    result = await db.execute(
        select(BalanceAccount).where(
            BalanceAccount.id == account_id,
            BalanceAccount.school_id.is_(None)
        )
    )
    account = result.scalar_one_or_none()

    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Global balance account not found"
        )

    return GlobalBalanceAccountResponse.model_validate(account)


@router.post(
    "/balance-accounts",
    response_model=GlobalBalanceAccountResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_any_school_admin)]
)
async def create_global_balance_account(
    account_data: GlobalBalanceAccountCreate,
    db: DatabaseSession,
    current_user: CurrentUser
):
    """
    Create a global balance account (business-wide)

    Use this to create:
    - Fixed assets (ASSET_FIXED): machinery, vehicles, equipment
    - Current liabilities (LIABILITY_CURRENT): short-term debts
    - Long-term liabilities (LIABILITY_LONG): loans, mortgages
    - Other account types as needed
    """
    # Generate a code if not provided
    code = account_data.code
    if not code:
        # Generate code based on account type
        type_prefix = {
            AccountType.ASSET_CURRENT: "11",
            AccountType.ASSET_FIXED: "12",
            AccountType.ASSET_OTHER: "19",
            AccountType.LIABILITY_CURRENT: "21",
            AccountType.LIABILITY_LONG: "22",
            AccountType.LIABILITY_OTHER: "29",
            AccountType.EQUITY_CAPITAL: "31",
            AccountType.EQUITY_RETAINED: "32",
            AccountType.EQUITY_OTHER: "39",
        }
        prefix = type_prefix.get(account_data.account_type, "90")

        # Count existing accounts of this type
        result = await db.execute(
            select(func.count(BalanceAccount.id)).where(
                BalanceAccount.school_id.is_(None),
                BalanceAccount.code.like(f"{prefix}%")
            )
        )
        count = result.scalar() or 0
        code = f"{prefix}{str(count + 1).zfill(2)}"

    account = BalanceAccount(
        school_id=None,  # Global account
        account_type=account_data.account_type,
        name=account_data.name,
        description=account_data.description,
        code=code,
        balance=account_data.balance,
        original_value=account_data.original_value,
        accumulated_depreciation=account_data.accumulated_depreciation,
        useful_life_years=account_data.useful_life_years,
        interest_rate=account_data.interest_rate,
        due_date=account_data.due_date,
        creditor=account_data.creditor,
        created_by=current_user.id
    )
    db.add(account)
    await db.commit()
    await db.refresh(account)

    return GlobalBalanceAccountResponse.model_validate(account)


@router.patch(
    "/balance-accounts/{account_id}",
    response_model=GlobalBalanceAccountResponse,
    dependencies=[Depends(require_any_school_admin)]
)
async def update_global_balance_account(
    account_id: UUID,
    account_data: BalanceAccountUpdate,
    db: DatabaseSession
):
    """Update a global balance account"""
    result = await db.execute(
        select(BalanceAccount).where(
            BalanceAccount.id == account_id,
            BalanceAccount.school_id.is_(None)
        )
    )
    account = result.scalar_one_or_none()

    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Global balance account not found"
        )

    # Update fields
    update_data = account_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(account, field, value)

    await db.commit()
    await db.refresh(account)

    return GlobalBalanceAccountResponse.model_validate(account)


@router.delete(
    "/balance-accounts/{account_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_any_school_admin)]
)
async def delete_global_balance_account(
    account_id: UUID,
    db: DatabaseSession
):
    """
    Soft delete a global balance account (mark as inactive)

    Note: Cannot delete Caja (1101) or Banco (1102) accounts.
    """
    result = await db.execute(
        select(BalanceAccount).where(
            BalanceAccount.id == account_id,
            BalanceAccount.school_id.is_(None)
        )
    )
    account = result.scalar_one_or_none()

    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Global balance account not found"
        )

    # Prevent deletion of Caja and Banco
    if account.code in ("1101", "1102"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No se puede eliminar la cuenta de Caja o Banco"
        )

    account.is_active = False
    await db.commit()

    return None


@router.get(
    "/balance-accounts/{account_id}/entries",
    dependencies=[Depends(require_any_school_admin)]
)
async def list_global_balance_entries(
    account_id: UUID,
    db: DatabaseSession,
    limit: int = Query(50, ge=1, le=200)
):
    """
    List recent entries for a global balance account
    """
    # Verify account exists and is global
    result = await db.execute(
        select(BalanceAccount).where(
            BalanceAccount.id == account_id,
            BalanceAccount.school_id.is_(None)
        )
    )
    account = result.scalar_one_or_none()

    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Global balance account not found"
        )

    # Get entries
    result = await db.execute(
        select(BalanceEntry)
        .where(BalanceEntry.account_id == account_id)
        .order_by(BalanceEntry.created_at.desc())
        .limit(limit)
    )
    entries = result.scalars().all()

    return [
        {
            "id": str(e.id),
            "entry_date": e.entry_date.isoformat(),
            "amount": float(e.amount),
            "balance_after": float(e.balance_after),
            "description": e.description,
            "reference": e.reference,
            "created_at": e.created_at.isoformat()
        }
        for e in entries
    ]


# ============================================
# Unified Balance Entries (All Global Accounts)
# ============================================

@router.get(
    "/balance-entries",
    dependencies=[Depends(require_any_school_admin)]
)
async def list_all_global_balance_entries(
    db: DatabaseSession,
    start_date: date | None = Query(None, description="Filter entries from this date"),
    end_date: date | None = Query(None, description="Filter entries until this date"),
    account_id: UUID | None = Query(None, description="Filter by specific account"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0)
):
    """
    List all balance entries from global accounts (unified log)

    Returns entries with account info for audit/log purposes.
    Ordered by created_at descending (most recent first).
    """
    # Build base query with join to get account info
    query = (
        select(
            BalanceEntry,
            BalanceAccount.code.label('account_code'),
            BalanceAccount.name.label('account_name')
        )
        .join(BalanceAccount, BalanceEntry.account_id == BalanceAccount.id)
        .where(BalanceAccount.school_id.is_(None))  # Only global accounts
    )

    # Apply filters
    if start_date:
        query = query.where(BalanceEntry.entry_date >= start_date)
    if end_date:
        query = query.where(BalanceEntry.entry_date <= end_date)
    if account_id:
        query = query.where(BalanceEntry.account_id == account_id)

    # Get total count for pagination
    count_query = (
        select(func.count(BalanceEntry.id))
        .join(BalanceAccount, BalanceEntry.account_id == BalanceAccount.id)
        .where(BalanceAccount.school_id.is_(None))
    )
    if start_date:
        count_query = count_query.where(BalanceEntry.entry_date >= start_date)
    if end_date:
        count_query = count_query.where(BalanceEntry.entry_date <= end_date)
    if account_id:
        count_query = count_query.where(BalanceEntry.account_id == account_id)

    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Get paginated entries
    query = query.order_by(BalanceEntry.created_at.desc()).limit(limit).offset(offset)
    result = await db.execute(query)
    rows = result.all()

    return {
        "items": [
            {
                "id": str(row.BalanceEntry.id),
                "entry_date": row.BalanceEntry.entry_date.isoformat(),
                "created_at": row.BalanceEntry.created_at.isoformat(),
                "account_id": str(row.BalanceEntry.account_id),
                "account_code": row.account_code,
                "account_name": row.account_name,
                "amount": float(row.BalanceEntry.amount),
                "balance_after": float(row.BalanceEntry.balance_after),
                "description": row.BalanceEntry.description,
                "reference": row.BalanceEntry.reference
            }
            for row in rows
        ],
        "total": total,
        "limit": limit,
        "offset": offset
    }


# ============================================
# Global Balance General Summary
# ============================================

@router.get(
    "/balance-general/summary",
    dependencies=[Depends(require_any_school_admin)]
)
async def get_global_balance_general_summary(
    db: DatabaseSession
):
    """
    Get global balance general (balance sheet) summary

    Shows totals for:
    - Assets (current, fixed, other) - Global accounts only
    - Liabilities (current, long-term, other) - Global accounts only
    - Equity
    """
    # Get all global accounts grouped by type
    result = await db.execute(
        select(
            BalanceAccount.account_type,
            func.sum(BalanceAccount.balance).label('total')
        ).where(
            BalanceAccount.school_id.is_(None),
            BalanceAccount.is_active == True
        ).group_by(BalanceAccount.account_type)
    )

    totals = {row.account_type: float(row.total or 0) for row in result}

    # Calculate totals
    total_assets = sum(
        totals.get(at, 0) for at in [
            AccountType.ASSET_CURRENT,
            AccountType.ASSET_FIXED,
            AccountType.ASSET_OTHER
        ]
    )
    total_liabilities = sum(
        totals.get(at, 0) for at in [
            AccountType.LIABILITY_CURRENT,
            AccountType.LIABILITY_LONG,
            AccountType.LIABILITY_OTHER
        ]
    )
    total_equity = sum(
        totals.get(at, 0) for at in [
            AccountType.EQUITY_CAPITAL,
            AccountType.EQUITY_RETAINED,
            AccountType.EQUITY_OTHER
        ]
    )

    return {
        "assets": {
            "current": totals.get(AccountType.ASSET_CURRENT, 0),
            "fixed": totals.get(AccountType.ASSET_FIXED, 0),
            "other": totals.get(AccountType.ASSET_OTHER, 0),
            "total": total_assets
        },
        "liabilities": {
            "current": totals.get(AccountType.LIABILITY_CURRENT, 0),
            "long_term": totals.get(AccountType.LIABILITY_LONG, 0),
            "other": totals.get(AccountType.LIABILITY_OTHER, 0),
            "total": total_liabilities
        },
        "equity": {
            "capital": totals.get(AccountType.EQUITY_CAPITAL, 0),
            "retained": totals.get(AccountType.EQUITY_RETAINED, 0),
            "other": totals.get(AccountType.EQUITY_OTHER, 0),
            "total": total_equity
        },
        "net_worth": total_assets - total_liabilities,
        "balanced": abs((total_assets) - (total_liabilities + total_equity)) < 0.01
    }


@router.get(
    "/balance-general/detailed",
    dependencies=[Depends(require_any_school_admin)]
)
async def get_global_balance_general_detailed(
    db: DatabaseSession
):
    """
    Get detailed global balance general with account breakdown
    """
    # Get all global accounts
    result = await db.execute(
        select(BalanceAccount)
        .where(
            BalanceAccount.school_id.is_(None),
            BalanceAccount.is_active == True
        )
        .order_by(BalanceAccount.code)
    )
    accounts = result.scalars().all()

    # Group by type
    by_type = {}
    for account in accounts:
        type_key = account.account_type.value
        if type_key not in by_type:
            by_type[type_key] = []
        by_type[type_key].append({
            "id": str(account.id),
            "code": account.code,
            "name": account.name,
            "balance": float(account.balance),
            "net_value": float(account.net_value) if account.net_value else float(account.balance)
        })

    # Calculate totals
    total_assets = sum(
        a["balance"] for accounts in by_type.values()
        for a in accounts
        if any(a["code"].startswith(p) for p in ["1"])  # Asset codes start with 1
    )
    total_liabilities = sum(
        a["balance"] for accounts in by_type.values()
        for a in accounts
        if any(a["code"].startswith(p) for p in ["2"])  # Liability codes start with 2
    )
    total_equity = sum(
        a["balance"] for accounts in by_type.values()
        for a in accounts
        if any(a["code"].startswith(p) for p in ["3"])  # Equity codes start with 3
    )

    return {
        "accounts_by_type": by_type,
        "summary": {
            "total_assets": total_assets,
            "total_liabilities": total_liabilities,
            "total_equity": total_equity,
            "net_worth": total_assets - total_liabilities
        }
    }


# ============================================
# Global Expenses (Gastos del Negocio)
# ============================================

@router.post(
    "/expenses",
    response_model=GlobalExpenseResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_any_school_admin)]
)
async def create_global_expense(
    expense_data: GlobalExpenseCreate,
    db: DatabaseSession,
    current_user: CurrentUser
):
    """
    Create a global expense (business-wide)

    For expenses like utilities, salaries, rent that aren't school-specific.
    """
    expense = Expense(
        school_id=None,  # Global expense
        category=expense_data.category,
        description=expense_data.description,
        amount=expense_data.amount,
        expense_date=expense_data.expense_date,
        due_date=expense_data.due_date,
        vendor=expense_data.vendor,
        receipt_number=expense_data.receipt_number,
        is_recurring=expense_data.is_recurring,
        recurring_period=expense_data.recurring_period,
        notes=expense_data.notes,
        created_by=current_user.id
    )

    db.add(expense)
    await db.commit()
    await db.refresh(expense)

    return GlobalExpenseResponse.model_validate(expense)


@router.get(
    "/expenses",
    response_model=list[ExpenseListResponse],
    dependencies=[Depends(require_any_school_admin)]
)
async def list_global_expenses(
    db: DatabaseSession,
    category: ExpenseCategory = Query(None, description="Filter by category"),
    is_paid: bool = Query(None, description="Filter by payment status"),
    start_date: date = Query(None, description="Filter from date (expense_date)"),
    end_date: date = Query(None, description="Filter to date (expense_date)"),
    min_amount: Decimal = Query(None, ge=0, description="Minimum amount"),
    max_amount: Decimal = Query(None, ge=0, description="Maximum amount"),
    payment_account_id: UUID = Query(None, description="Filter by payment account"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500)
):
    """
    List global expenses (school_id = NULL)

    Includes payment info (account name, method, date) for paid expenses.
    Supports filtering by date range, amount range, category, payment status, and payment account.
    """
    # Query with LEFT JOIN to get payment account name
    query = (
        select(Expense, BalanceAccount.name.label("payment_account_name"))
        .outerjoin(BalanceAccount, BalanceAccount.id == Expense.payment_account_id)
        .where(
            Expense.school_id.is_(None),
            Expense.is_active == True
        )
    )

    if category:
        query = query.where(Expense.category == category)
    if is_paid is not None:
        query = query.where(Expense.is_paid == is_paid)
    if start_date:
        query = query.where(Expense.expense_date >= start_date)
    if end_date:
        query = query.where(Expense.expense_date <= end_date)
    if min_amount is not None:
        query = query.where(Expense.amount >= min_amount)
    if max_amount is not None:
        query = query.where(Expense.amount <= max_amount)
    if payment_account_id:
        query = query.where(Expense.payment_account_id == payment_account_id)

    query = query.order_by(Expense.expense_date.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    rows = result.all()

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
            balance=e.balance,
            payment_method=e.payment_method,
            payment_account_name=payment_account_name,
            paid_at=e.paid_at
        )
        for e, payment_account_name in rows
    ]


@router.get(
    "/expenses/pending",
    response_model=list[ExpenseListResponse],
    dependencies=[Depends(require_any_school_admin)]
)
async def get_pending_global_expenses(
    db: DatabaseSession
):
    """
    Get all pending (unpaid) global expenses
    """
    result = await db.execute(
        select(Expense).where(
            Expense.school_id.is_(None),
            Expense.is_paid == False,
            Expense.is_active == True
        ).order_by(Expense.due_date)
    )
    expenses = result.scalars().all()

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
            balance=e.balance,
            payment_method=e.payment_method,
            payment_account_name=None,  # Pending expenses don't have payment info
            paid_at=e.paid_at
        )
        for e in expenses
    ]


@router.get(
    "/expenses/summary-by-category",
    response_model=list[ExpenseCategorySummary],
    dependencies=[Depends(require_any_school_admin)]
)
async def get_expenses_summary_by_category(
    db: DatabaseSession,
    start_date: date | None = Query(None, description="Filter from date"),
    end_date: date | None = Query(None, description="Filter to date")
):
    """
    Get expenses grouped by category

    Returns summary of expenses by category for pie/bar charts.
    """
    query = select(
        Expense.category,
        func.count(Expense.id).label('count'),
        func.sum(Expense.amount).label('total_amount'),
        func.sum(Expense.amount_paid).label('paid_amount')
    ).where(
        Expense.is_active == True
    ).group_by(Expense.category)

    # Apply date filters
    if start_date:
        query = query.where(Expense.expense_date >= start_date)
    if end_date:
        query = query.where(Expense.expense_date <= end_date)

    result = await db.execute(query)
    rows = result.all()

    # Calculate total for percentages
    total_expenses = sum(float(row.total_amount or 0) for row in rows)

    summaries = []
    for row in rows:
        total_amount = Decimal(str(row.total_amount or 0))
        paid_amount = Decimal(str(row.paid_amount or 0))
        pending_amount = total_amount - paid_amount
        percentage = Decimal(str(round((float(total_amount) / total_expenses * 100) if total_expenses > 0 else 0, 2)))

        # Handle None category gracefully
        if row.category is None:
            category_label = "Sin Categoría"
        else:
            # category is now a string (not enum), so use it directly as fallback
            cat_code = row.category.value if hasattr(row.category, 'value') else row.category
            category_label = EXPENSE_CATEGORY_LABELS.get(cat_code, cat_code)

        summaries.append(ExpenseCategorySummary(
            category=row.category,
            category_label=category_label,
            total_amount=total_amount,
            paid_amount=paid_amount,
            pending_amount=pending_amount,
            count=row.count,
            percentage=percentage
        ))

    # Sort by total amount descending
    summaries.sort(key=lambda x: x.total_amount, reverse=True)

    return summaries


@router.post(
    "/expenses/check-balance",
    dependencies=[Depends(require_any_school_admin)]
)
async def check_expense_balance(
    amount: Decimal = Query(..., gt=0, description="Monto a verificar"),
    payment_method: AccPaymentMethod = Query(..., description="Método de pago"),
    db: DatabaseSession = None
):
    """
    Verifica si hay fondos suficientes para pagar un gasto.

    Si el pago es en efectivo y Caja Menor no alcanza, informa sobre
    la disponibilidad de Caja Mayor como fallback.

    Returns:
        can_pay: bool - Si se puede realizar el pago
        source: str - Cuenta que se usaría (caja_menor, nequi, banco)
        source_balance: Decimal - Balance disponible en la cuenta
        fallback_available: bool - Si hay fallback disponible
        fallback_source: str | None - Cuenta de fallback (caja_mayor)
        fallback_balance: Decimal | None - Balance del fallback
    """
    from app.services.balance_integration import BalanceIntegrationService, PAYMENT_METHOD_TO_ACCOUNT

    balance_service = BalanceIntegrationService(db)

    # Determinar cuenta principal
    account_key = PAYMENT_METHOD_TO_ACCOUNT.get(payment_method)
    if not account_key:
        return {
            "can_pay": False,
            "source": None,
            "source_balance": Decimal("0"),
            "fallback_available": False,
            "fallback_source": None,
            "fallback_balance": None,
            "message": "Método de pago no requiere verificación de fondos"
        }

    # Obtener balance de la cuenta principal
    source_balance = await balance_service.get_account_balance(account_key) or Decimal("0")

    # Verificar si alcanza
    can_pay = source_balance >= amount

    # Si es CASH y no alcanza, verificar Caja Mayor como fallback
    fallback_available = False
    fallback_source = None
    fallback_balance = None

    if payment_method == AccPaymentMethod.CASH and not can_pay:
        fallback_source = "caja_mayor"
        fallback_balance = await balance_service.get_account_balance("caja_mayor") or Decimal("0")
        fallback_available = fallback_balance >= amount

    return {
        "can_pay": can_pay,
        "source": account_key,
        "source_balance": source_balance,
        "fallback_available": fallback_available,
        "fallback_source": fallback_source,
        "fallback_balance": fallback_balance
    }


@router.get(
    "/expenses/{expense_id}",
    response_model=GlobalExpenseResponse,
    dependencies=[Depends(require_any_school_admin)]
)
async def get_global_expense(
    expense_id: UUID,
    db: DatabaseSession
):
    """Get global expense by ID with payment account info"""
    result = await db.execute(
        select(Expense, BalanceAccount.name.label("payment_account_name"))
        .outerjoin(BalanceAccount, BalanceAccount.id == Expense.payment_account_id)
        .where(
            Expense.id == expense_id,
            Expense.school_id.is_(None)
        )
    )
    row = result.one_or_none()

    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Global expense not found"
        )

    expense, payment_account_name = row
    response = GlobalExpenseResponse.model_validate(expense)
    response.payment_account_name = payment_account_name
    return response


@router.patch(
    "/expenses/{expense_id}",
    response_model=GlobalExpenseResponse,
    dependencies=[Depends(require_any_school_admin)]
)
async def update_global_expense(
    expense_id: UUID,
    expense_data: ExpenseUpdate,
    db: DatabaseSession
):
    """Update a global expense"""
    result = await db.execute(
        select(Expense).where(
            Expense.id == expense_id,
            Expense.school_id.is_(None)
        )
    )
    expense = result.scalar_one_or_none()

    if not expense:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Global expense not found"
        )

    # Update fields
    update_data = expense_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(expense, field, value)

    await db.commit()
    await db.refresh(expense)

    return GlobalExpenseResponse.model_validate(expense)


@router.delete(
    "/expenses/{expense_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_any_school_admin)]
)
async def delete_global_expense(
    expense_id: UUID,
    db: DatabaseSession
):
    """
    Delete a pending global expense (soft delete).

    Only unpaid expenses can be deleted. Paid expenses must be reverted first.
    """
    result = await db.execute(
        select(Expense).where(
            Expense.id == expense_id,
            Expense.school_id.is_(None)
        )
    )
    expense = result.scalar_one_or_none()

    if not expense:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Global expense not found"
        )

    if expense.is_paid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No se puede eliminar un gasto pagado. Use la opcion de revertir pago primero."
        )

    # Soft delete
    expense.is_active = False
    await db.commit()


@router.post(
    "/expenses/{expense_id}/pay",
    response_model=GlobalExpenseResponse,
    dependencies=[Depends(require_any_school_admin)]
)
async def pay_global_expense(
    expense_id: UUID,
    payment: ExpensePayment,
    db: DatabaseSession,
    current_user: CurrentUser
):
    """
    Record a payment for a global expense

    Updates balance accounts (Caja/Banco) automatically.
    """
    result = await db.execute(
        select(Expense).where(
            Expense.id == expense_id,
            Expense.school_id.is_(None)
        )
    )
    expense = result.scalar_one_or_none()

    if not expense:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Global expense not found"
        )

    if expense.is_paid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Expense is already fully paid"
        )

    remaining = expense.balance
    if payment.amount > remaining:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Payment amount ({payment.amount}) exceeds balance ({remaining})"
        )

    # Update global balance account (deduct from Caja or Banco)
    from app.services.balance_integration import BalanceIntegrationService
    balance_service = BalanceIntegrationService(db)

    payment_account_id = None
    try:
        # Si use_fallback es True y el pago es en efectivo, usar Caja Mayor directamente
        if payment.use_fallback and payment.payment_method == AccPaymentMethod.CASH:
            await balance_service.record_expense_payment_from_account(
                amount=payment.amount,
                account_key="caja_mayor",
                description=f"Pago gasto (desde Caja Mayor): {expense.description}",
                created_by=current_user.id
            )
            # Get Caja Mayor account ID
            caja_mayor = await db.execute(
                select(BalanceAccount).where(
                    BalanceAccount.code == "1102",
                    BalanceAccount.school_id.is_(None)
                )
            )
            caja_mayor_account = caja_mayor.scalar_one_or_none()
            if caja_mayor_account:
                payment_account_id = caja_mayor_account.id
        else:
            await balance_service.record_expense_payment(
                amount=payment.amount,
                payment_method=payment.payment_method,
                description=f"Pago gasto: {expense.description}",
                created_by=current_user.id
            )
            # Get the account ID used for the payment
            payment_account_id = await balance_service.get_account_for_payment_method(
                payment.payment_method
            )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

    # Update expense with payment info
    expense.amount_paid = (expense.amount_paid or Decimal("0")) + payment.amount
    # Handle both enum and string payment_method
    expense.payment_method = payment.payment_method.value if hasattr(payment.payment_method, 'value') else payment.payment_method
    expense.payment_account_id = payment_account_id
    expense.paid_at = get_colombia_now_naive()

    if expense.amount_paid >= expense.amount:
        expense.is_paid = True

    await db.commit()
    await db.refresh(expense)

    # Get payment account name for response
    payment_account_name = None
    if expense.payment_account_id:
        result = await db.execute(
            select(BalanceAccount.name).where(BalanceAccount.id == expense.payment_account_id)
        )
        payment_account_name = result.scalar_one_or_none()

    response = GlobalExpenseResponse.model_validate(expense)
    response.payment_account_name = payment_account_name
    return response


# ============================================
# Global Accounts Payable (Cuentas por Pagar)
# ============================================

@router.post(
    "/payables",
    response_model=GlobalAccountsPayableResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_any_school_admin)]
)
async def create_global_payable(
    payable_data: GlobalAccountsPayableCreate,
    db: DatabaseSession,
    current_user: CurrentUser
):
    """
    Create a global accounts payable (supplier debt)

    For tracking money owed BY the business to suppliers.
    """
    payable = AccountsPayable(
        school_id=None,  # Global payable
        vendor=payable_data.vendor,
        amount=payable_data.amount,
        description=payable_data.description,
        category=payable_data.category,
        invoice_number=payable_data.invoice_number,
        invoice_date=payable_data.invoice_date,
        due_date=payable_data.due_date,
        notes=payable_data.notes,
        created_by=current_user.id
    )
    db.add(payable)
    await db.commit()
    await db.refresh(payable)

    return GlobalAccountsPayableResponse.model_validate(payable)


@router.get(
    "/payables",
    response_model=list[AccountsPayableListResponse],
    dependencies=[Depends(require_any_school_admin)]
)
async def list_global_payables(
    db: DatabaseSession,
    is_paid: bool = Query(None, description="Filter by payment status"),
    is_overdue: bool = Query(None, description="Filter by overdue status"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500)
):
    """
    List global accounts payable (school_id = NULL)
    """
    query = select(AccountsPayable).where(
        AccountsPayable.school_id.is_(None)
    )

    if is_paid is not None:
        query = query.where(AccountsPayable.is_paid == is_paid)

    query = query.order_by(AccountsPayable.due_date).offset(skip).limit(limit)
    result = await db.execute(query)
    payables = result.scalars().all()

    # Filter by overdue if requested
    if is_overdue is not None:
        payables = [p for p in payables if p.is_overdue == is_overdue]

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
    dependencies=[Depends(require_any_school_admin)]
)
async def get_pending_global_payables(
    db: DatabaseSession
):
    """
    Get all pending (unpaid) global payables
    """
    result = await db.execute(
        select(AccountsPayable).where(
            AccountsPayable.school_id.is_(None),
            AccountsPayable.is_paid == False
        ).order_by(AccountsPayable.due_date)
    )
    payables = result.scalars().all()

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
    response_model=GlobalAccountsPayableResponse,
    dependencies=[Depends(require_any_school_admin)]
)
async def get_global_payable(
    payable_id: UUID,
    db: DatabaseSession
):
    """Get global payable by ID"""
    result = await db.execute(
        select(AccountsPayable).where(
            AccountsPayable.id == payable_id,
            AccountsPayable.school_id.is_(None)
        )
    )
    payable = result.scalar_one_or_none()

    if not payable:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Global payable not found"
        )

    return GlobalAccountsPayableResponse.model_validate(payable)


@router.post(
    "/payables/{payable_id}/pay",
    response_model=GlobalAccountsPayableResponse,
    dependencies=[Depends(require_any_school_admin)]
)
async def pay_global_payable(
    payable_id: UUID,
    payment: AccountsPayablePayment,
    db: DatabaseSession,
    current_user: CurrentUser
):
    """
    Record a payment on global accounts payable

    Updates balance accounts (Caja/Banco) automatically.
    """
    result = await db.execute(
        select(AccountsPayable).where(
            AccountsPayable.id == payable_id,
            AccountsPayable.school_id.is_(None)
        )
    )
    payable = result.scalar_one_or_none()

    if not payable:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Global payable not found"
        )

    if payable.is_paid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Payable is already fully paid"
        )

    remaining = payable.balance
    if payment.amount > remaining:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Payment amount ({payment.amount}) exceeds balance ({remaining})"
        )

    # Update payable
    payable.amount_paid = (payable.amount_paid or Decimal("0")) + payment.amount
    if payable.amount_paid >= payable.amount:
        payable.is_paid = True

    # Update global balance account (deduct from Caja or Banco)
    from app.services.balance_integration import BalanceIntegrationService
    balance_service = BalanceIntegrationService(db)

    await balance_service.record_expense_payment(
        amount=payment.amount,
        payment_method=payment.payment_method,
        description=f"Pago a proveedor: {payable.vendor}",
        created_by=current_user.id
    )

    await db.commit()
    await db.refresh(payable)

    return GlobalAccountsPayableResponse.model_validate(payable)


# ============================================
# Global Patrimony Summary
# ============================================

@router.get(
    "/patrimony/summary",
    dependencies=[Depends(require_any_school_admin)]
)
async def get_global_patrimony_summary(
    db: DatabaseSession
):
    """
    Get global patrimony summary (business-wide)

    PATRIMONY = ASSETS - LIABILITIES

    Assets:
    - Cash (Caja) + Bank (Banco)
    - Inventory (valued at cost)
    - Fixed Assets

    Liabilities:
    - Accounts Payable (suppliers)
    - Debts
    """
    from app.services.balance_integration import BalanceIntegrationService
    from app.models.product import Product, Inventory

    balance_service = BalanceIntegrationService(db)
    cash_balances = await balance_service.get_global_cash_balances()

    # Get all global assets and liabilities from balance_accounts
    result = await db.execute(
        select(
            BalanceAccount.account_type,
            func.sum(BalanceAccount.balance).label('total')
        ).where(
            BalanceAccount.school_id.is_(None),
            BalanceAccount.is_active == True
        ).group_by(BalanceAccount.account_type)
    )

    totals_by_type = {row.account_type: float(row.total or 0) for row in result}

    # Calculate INVENTORY VALUE (sum of stock * cost for all products across all schools)
    result = await db.execute(
        select(func.sum(Inventory.quantity * Product.cost))
        .join(Product, Inventory.product_id == Product.id)
        .where(
            Product.is_active == True,
            Inventory.quantity > 0
        )
    )
    inventory_value = float(result.scalar() or 0)

    # Calculate ACCOUNTS RECEIVABLE (pending amounts from all schools)
    result = await db.execute(
        select(func.sum(AccountsReceivable.amount - AccountsReceivable.amount_paid))
        .where(
            AccountsReceivable.is_paid == False
        )
    )
    pending_receivables = float(result.scalar() or 0)

    # Calculate pending payables (from all schools, global business)
    result = await db.execute(
        select(func.sum(AccountsPayable.amount - AccountsPayable.amount_paid))
        .where(
            AccountsPayable.is_paid == False
        )
    )
    pending_payables = float(result.scalar() or 0)

    # Calculate pending expenses (from all schools, global business)
    result = await db.execute(
        select(func.sum(Expense.amount - Expense.amount_paid))
        .where(
            Expense.is_paid == False,
            Expense.is_active == True
        )
    )
    pending_expenses = float(result.scalar() or 0)

    # Extract balance values from cash_balances dict objects
    # Note: get_global_cash_balances returns caja_menor, caja_mayor, nequi, banco
    caja_menor = cash_balances.get("caja_menor")
    caja_mayor = cash_balances.get("caja_mayor")
    nequi = cash_balances.get("nequi")
    banco = cash_balances.get("banco")

    caja_menor_balance = float(caja_menor["balance"]) if caja_menor else 0
    caja_mayor_balance = float(caja_mayor["balance"]) if caja_mayor else 0
    nequi_balance = float(nequi["balance"]) if nequi else 0
    banco_balance = float(banco["balance"]) if banco else 0

    total_cash = caja_menor_balance + caja_mayor_balance
    total_liquid = float(cash_balances.get("total_liquid", 0))

    # Calculate total current assets (liquid + inventory + receivables)
    current_assets = total_liquid + inventory_value + pending_receivables

    total_assets = (
        current_assets +
        totals_by_type.get(AccountType.ASSET_FIXED, 0) +
        totals_by_type.get(AccountType.ASSET_OTHER, 0)
    )

    total_liabilities = (
        pending_payables +
        pending_expenses +
        totals_by_type.get(AccountType.LIABILITY_CURRENT, 0) +
        totals_by_type.get(AccountType.LIABILITY_LONG, 0)
    )

    # Calculate total banco (nequi + banco_cuenta)
    total_banco = nequi_balance + banco_balance

    return {
        "assets": {
            "caja": total_cash,  # caja_menor + caja_mayor
            "banco": total_banco,  # nequi + banco_cuenta
            "caja_menor": caja_menor_balance,
            "caja_mayor": caja_mayor_balance,
            "nequi": nequi_balance,
            "banco_cuenta": banco_balance,
            "total_liquid": total_liquid,
            "inventory": inventory_value,
            "receivables": pending_receivables,
            "current_assets": current_assets,
            "fixed_assets": totals_by_type.get(AccountType.ASSET_FIXED, 0),
            "other_assets": totals_by_type.get(AccountType.ASSET_OTHER, 0),
            "total": total_assets
        },
        "liabilities": {
            "pending_payables": pending_payables,
            "pending_expenses": pending_expenses,
            "current": totals_by_type.get(AccountType.LIABILITY_CURRENT, 0),
            "long_term": totals_by_type.get(AccountType.LIABILITY_LONG, 0),
            "total": total_liabilities
        },
        "net_patrimony": total_assets - total_liabilities
    }


# ============================================
# Global Accounts Receivable (Cuentas por Cobrar)
# ============================================

@router.post(
    "/receivables",
    response_model=GlobalAccountsReceivableResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_any_school_admin)]
)
async def create_global_receivable(
    receivable_data: GlobalAccountsReceivableCreate,
    db: DatabaseSession,
    current_user: CurrentUser
):
    """
    Create a global accounts receivable (customer debt)

    For tracking money owed TO the business by customers.
    """
    receivable = AccountsReceivable(
        school_id=None,  # Global receivable
        client_id=receivable_data.client_id,
        sale_id=receivable_data.sale_id,
        order_id=receivable_data.order_id,
        amount=receivable_data.amount,
        description=receivable_data.description,
        invoice_date=receivable_data.invoice_date,
        due_date=receivable_data.due_date,
        notes=receivable_data.notes,
        created_by=current_user.id
    )
    db.add(receivable)
    await db.commit()
    await db.refresh(receivable)

    return GlobalAccountsReceivableResponse.model_validate(receivable)


def _build_global_receivable_response(r) -> AccountsReceivableListResponse:
    """Build AccountsReceivableListResponse with all details from a receivable with loaded relationships"""
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
        order_status=r.order.status.value if r.order and r.order.status else None,
        # School information
        school_id=r.school_id,
        school_name=r.school.name if r.school else None,
        # Notes
        notes=r.notes
    )


@router.get(
    "/receivables",
    response_model=list[AccountsReceivableListResponse],
    dependencies=[Depends(require_any_school_admin)]
)
async def list_global_receivables(
    db: DatabaseSession,
    is_paid: bool = Query(None, description="Filter by payment status"),
    is_overdue: bool = Query(None, description="Filter by overdue status"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500)
):
    """
    List ALL accounts receivable (from all schools and global)
    with full details including origin, school, and order status.
    """
    query = select(AccountsReceivable).options(
        selectinload(AccountsReceivable.client),
        selectinload(AccountsReceivable.sale),
        selectinload(AccountsReceivable.order),
        selectinload(AccountsReceivable.school)
    )

    if is_paid is not None:
        query = query.where(AccountsReceivable.is_paid == is_paid)

    if is_overdue is not None:
        query = query.where(AccountsReceivable.is_overdue == is_overdue)

    query = query.order_by(AccountsReceivable.due_date.asc().nullslast()).offset(skip).limit(limit)
    result = await db.execute(query)
    receivables = result.scalars().all()

    return [_build_global_receivable_response(r) for r in receivables]


@router.get(
    "/receivables/pending",
    response_model=list[AccountsReceivableListResponse],
    dependencies=[Depends(require_any_school_admin)]
)
async def get_pending_global_receivables(
    db: DatabaseSession
):
    """
    Get all pending (unpaid) receivables from all schools and global
    with full details including origin, school, and order status.
    """
    result = await db.execute(
        select(AccountsReceivable).options(
            selectinload(AccountsReceivable.client),
            selectinload(AccountsReceivable.sale),
            selectinload(AccountsReceivable.order),
            selectinload(AccountsReceivable.school)
        ).where(
            AccountsReceivable.is_paid == False
        ).order_by(AccountsReceivable.due_date.asc().nullslast())
    )
    receivables = result.scalars().all()

    return [_build_global_receivable_response(r) for r in receivables]


@router.get(
    "/receivables/{receivable_id}",
    response_model=GlobalAccountsReceivableResponse,
    dependencies=[Depends(require_any_school_admin)]
)
async def get_global_receivable(
    receivable_id: UUID,
    db: DatabaseSession
):
    """Get global receivable by ID"""
    result = await db.execute(
        select(AccountsReceivable).where(
            AccountsReceivable.id == receivable_id,
            AccountsReceivable.school_id.is_(None)
        )
    )
    receivable = result.scalar_one_or_none()

    if not receivable:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Global receivable not found"
        )

    return GlobalAccountsReceivableResponse.model_validate(receivable)


@router.post(
    "/receivables/{receivable_id}/pay",
    response_model=GlobalAccountsReceivableResponse,
    dependencies=[Depends(require_any_school_admin)]
)
async def pay_global_receivable(
    receivable_id: UUID,
    payment: AccountsReceivablePayment,
    db: DatabaseSession,
    current_user: CurrentUser
):
    """
    Record a payment on global accounts receivable

    Updates balance accounts (Caja/Banco) automatically.
    """
    result = await db.execute(
        select(AccountsReceivable).where(
            AccountsReceivable.id == receivable_id,
            AccountsReceivable.school_id.is_(None)
        )
    )
    receivable = result.scalar_one_or_none()

    if not receivable:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Global receivable not found"
        )

    if receivable.is_paid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Receivable is already fully paid"
        )

    remaining = receivable.balance
    if payment.amount > remaining:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Payment amount ({payment.amount}) exceeds balance ({remaining})"
        )

    # Update receivable
    receivable.amount_paid = (receivable.amount_paid or Decimal("0")) + payment.amount
    if receivable.amount_paid >= receivable.amount:
        receivable.is_paid = True

    # Update global balance account (add to Caja or Banco)
    from app.services.balance_integration import BalanceIntegrationService
    balance_service = BalanceIntegrationService(db)

    await balance_service.record_income(
        amount=payment.amount,
        payment_method=payment.payment_method,
        description=f"Cobro CxC: {receivable.description}",
        created_by=current_user.id
    )

    await db.commit()
    await db.refresh(receivable)

    return GlobalAccountsReceivableResponse.model_validate(receivable)


# ============================================
# Global Transactions (for Reports)
# ============================================

# Category labels in Spanish
EXPENSE_CATEGORY_LABELS = {
    ExpenseCategory.RENT: "Arriendo",
    ExpenseCategory.UTILITIES: "Servicios",
    ExpenseCategory.PAYROLL: "Nomina",
    ExpenseCategory.SUPPLIES: "Suministros",
    ExpenseCategory.INVENTORY: "Inventario",
    ExpenseCategory.TRANSPORT: "Transporte",
    ExpenseCategory.MAINTENANCE: "Mantenimiento",
    ExpenseCategory.MARKETING: "Marketing",
    ExpenseCategory.TAXES: "Impuestos",
    ExpenseCategory.BANK_FEES: "Comisiones Bancarias",
    ExpenseCategory.OTHER: "Otros",
}


@router.get(
    "/transactions",
    response_model=list[TransactionListItemResponse],
    dependencies=[Depends(require_any_school_admin)]
)
async def list_global_transactions(
    db: DatabaseSession,
    start_date: date | None = Query(None, description="Filter from date"),
    end_date: date | None = Query(None, description="Filter to date"),
    transaction_type: TransactionType | None = Query(None, description="Filter by type (income/expense)"),
    school_id: UUID | None = Query(None, description="Filter by school"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200)
):
    """
    List transactions (global and school-specific)

    Returns all transactions for reporting purposes.
    """
    from sqlalchemy.orm import joinedload

    query = select(Transaction).options(
        joinedload(Transaction.school)
    )

    # Apply filters
    if start_date:
        query = query.where(Transaction.transaction_date >= start_date)
    if end_date:
        query = query.where(Transaction.transaction_date <= end_date)
    if transaction_type:
        query = query.where(Transaction.type == transaction_type)
    if school_id:
        query = query.where(Transaction.school_id == school_id)

    query = query.order_by(Transaction.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    transactions = result.scalars().unique().all()

    return [
        TransactionListItemResponse(
            id=t.id,
            type=t.type,
            amount=t.amount,
            payment_method=t.payment_method,
            description=t.description,
            category=t.category,
            reference_code=t.reference_code,
            transaction_date=t.transaction_date,
            created_at=t.created_at,
            school_id=t.school_id,
            school_name=t.school.name if t.school else None
        )
        for t in transactions
    ]


@router.get(
    "/cash-flow",
    response_model=CashFlowReportResponse,
    dependencies=[Depends(require_any_school_admin)]
)
async def get_cash_flow_report(
    db: DatabaseSession,
    start_date: date = Query(..., description="Start date"),
    end_date: date = Query(..., description="End date"),
    group_by: str = Query("day", description="Group by: day, week, month")
):
    """
    Get cash flow report for a period

    Shows income vs expenses over time for line charts.
    """
    from datetime import timedelta
    from collections import defaultdict

    # Validate group_by
    if group_by not in ("day", "week", "month"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="group_by must be: day, week, or month"
        )

    # Get all transactions in range
    query = select(Transaction).where(
        Transaction.transaction_date >= start_date,
        Transaction.transaction_date <= end_date
    ).order_by(Transaction.transaction_date)

    result = await db.execute(query)
    transactions = result.scalars().all()

    # Group transactions by period
    periods_data = defaultdict(lambda: {"income": Decimal("0"), "expenses": Decimal("0")})

    for t in transactions:
        # Determine period key
        if group_by == "day":
            period_key = t.transaction_date.isoformat()
            period_label = t.transaction_date.strftime("%d %b")
        elif group_by == "week":
            # Get ISO week
            iso_cal = t.transaction_date.isocalendar()
            period_key = f"{iso_cal.year}-W{iso_cal.week:02d}"
            period_label = f"Sem {iso_cal.week}"
        else:  # month
            period_key = t.transaction_date.strftime("%Y-%m")
            period_label = t.transaction_date.strftime("%B %Y")

        # Add amount to appropriate bucket
        if t.type == TransactionType.INCOME:
            periods_data[period_key]["income"] += t.amount
        else:  # EXPENSE or TRANSFER (count transfers as expense for cash flow)
            periods_data[period_key]["expenses"] += t.amount

        periods_data[period_key]["label"] = period_label

    # Also include expenses not in transactions
    expense_query = select(Expense).where(
        Expense.expense_date >= start_date,
        Expense.expense_date <= end_date,
        Expense.is_active == True,
        Expense.is_paid == True
    )
    result = await db.execute(expense_query)
    expenses = result.scalars().all()

    for e in expenses:
        if group_by == "day":
            period_key = e.expense_date.isoformat()
            period_label = e.expense_date.strftime("%d %b")
        elif group_by == "week":
            iso_cal = e.expense_date.isocalendar()
            period_key = f"{iso_cal.year}-W{iso_cal.week:02d}"
            period_label = f"Sem {iso_cal.week}"
        else:
            period_key = e.expense_date.strftime("%Y-%m")
            period_label = e.expense_date.strftime("%B %Y")

        periods_data[period_key]["expenses"] += e.amount_paid
        periods_data[period_key]["label"] = period_label

    # Convert to list and calculate net
    periods = []
    total_income = Decimal("0")
    total_expenses = Decimal("0")

    for period_key in sorted(periods_data.keys()):
        data = periods_data[period_key]
        income = data["income"]
        expenses = data["expenses"]
        net = income - expenses

        total_income += income
        total_expenses += expenses

        periods.append(CashFlowPeriodItem(
            period=period_key,
            period_label=data.get("label", period_key),
            income=income,
            expenses=expenses,
            net=net
        ))

    return CashFlowReportResponse(
        period_start=start_date,
        period_end=end_date,
        group_by=group_by,
        total_income=total_income,
        total_expenses=total_expenses,
        net_flow=total_income - total_expenses,
        periods=periods
    )


# ============================================
# Expense Adjustments (Rollbacks)
# ============================================

@router.post(
    "/expenses/{expense_id}/adjust",
    response_model=ExpenseAdjustmentResponse,
    dependencies=[Depends(require_any_school_admin)]
)
async def adjust_expense(
    expense_id: UUID,
    adjustment_data: ExpenseAdjustmentRequest,
    db: DatabaseSession,
    current_user: CurrentUser
):
    """
    Adjust a paid expense's amount and/or payment account.

    Use cases:
    - Correct a wrong payment amount
    - Move payment from one account to another (e.g., Caja to Banco)
    - Both amount and account correction

    Creates compensatory balance entries to maintain accounting integrity.

    Args:
        expense_id: The expense UUID to adjust
        adjustment_data: The adjustment details

    Returns:
        ExpenseAdjustmentResponse with adjustment details
    """
    from app.services.expense_adjustment import ExpenseAdjustmentService
    from app.models.user import User

    service = ExpenseAdjustmentService(db)

    try:
        adjustment = await service.adjust_expense(
            expense_id=expense_id,
            new_amount=adjustment_data.new_amount,
            new_payment_account_id=adjustment_data.new_payment_account_id,
            new_payment_method=adjustment_data.new_payment_method,
            reason=adjustment_data.reason,
            description=adjustment_data.description,
            adjusted_by=current_user.id
        )

        await db.commit()

        # Build response with account names
        response = ExpenseAdjustmentResponse.model_validate(adjustment)

        # Get account names
        if adjustment.previous_payment_account_id:
            result = await db.execute(
                select(BalanceAccount.name).where(
                    BalanceAccount.id == adjustment.previous_payment_account_id
                )
            )
            response.previous_payment_account_name = result.scalar_one_or_none()

        if adjustment.new_payment_account_id:
            result = await db.execute(
                select(BalanceAccount.name).where(
                    BalanceAccount.id == adjustment.new_payment_account_id
                )
            )
            response.new_payment_account_name = result.scalar_one_or_none()

        # Get username
        result = await db.execute(
            select(User.username).where(User.id == current_user.id)
        )
        response.adjusted_by_username = result.scalar_one_or_none()

        return response

    except ValueError as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al ajustar gasto: {str(e)}"
        )


@router.post(
    "/expenses/{expense_id}/revert",
    response_model=ExpenseAdjustmentResponse,
    dependencies=[Depends(require_any_school_admin)]
)
async def revert_expense_payment(
    expense_id: UUID,
    revert_data: ExpenseRevertRequest,
    db: DatabaseSession,
    current_user: CurrentUser
):
    """
    Completely revert an expense payment (full rollback).

    This returns the full paid amount to the original account
    and marks the expense as unpaid.

    Use this when a payment was made in error and needs to be undone entirely.

    Args:
        expense_id: The expense UUID to revert
        revert_data: Optional description of the reversion

    Returns:
        ExpenseAdjustmentResponse with reversion details
    """
    from app.services.expense_adjustment import ExpenseAdjustmentService
    from app.models.user import User

    service = ExpenseAdjustmentService(db)

    try:
        adjustment = await service.revert_expense_payment(
            expense_id=expense_id,
            description=revert_data.description,
            adjusted_by=current_user.id
        )

        await db.commit()

        # Build response
        response = ExpenseAdjustmentResponse.model_validate(adjustment)

        # Get account name
        if adjustment.previous_payment_account_id:
            result = await db.execute(
                select(BalanceAccount.name).where(
                    BalanceAccount.id == adjustment.previous_payment_account_id
                )
            )
            response.previous_payment_account_name = result.scalar_one_or_none()

        # Get username
        result = await db.execute(
            select(User.username).where(User.id == current_user.id)
        )
        response.adjusted_by_username = result.scalar_one_or_none()

        return response

    except ValueError as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al revertir pago: {str(e)}"
        )


@router.post(
    "/expenses/{expense_id}/refund",
    response_model=ExpenseAdjustmentResponse,
    dependencies=[Depends(require_any_school_admin)]
)
async def partial_refund_expense(
    expense_id: UUID,
    refund_data: PartialRefundRequest,
    db: DatabaseSession,
    current_user: CurrentUser
):
    """
    Issue a partial refund on an expense payment.

    Use this when part of the expense payment needs to be returned,
    but not the full amount.

    Args:
        expense_id: The expense UUID
        refund_data: The refund amount and description

    Returns:
        ExpenseAdjustmentResponse with refund details
    """
    from app.services.expense_adjustment import ExpenseAdjustmentService
    from app.models.user import User

    service = ExpenseAdjustmentService(db)

    try:
        adjustment = await service.partial_refund(
            expense_id=expense_id,
            refund_amount=refund_data.refund_amount,
            description=refund_data.description,
            adjusted_by=current_user.id
        )

        await db.commit()

        # Build response
        response = ExpenseAdjustmentResponse.model_validate(adjustment)

        # Get account name
        if adjustment.previous_payment_account_id:
            result = await db.execute(
                select(BalanceAccount.name).where(
                    BalanceAccount.id == adjustment.previous_payment_account_id
                )
            )
            response.previous_payment_account_name = result.scalar_one_or_none()

        if adjustment.new_payment_account_id:
            result = await db.execute(
                select(BalanceAccount.name).where(
                    BalanceAccount.id == adjustment.new_payment_account_id
                )
            )
            response.new_payment_account_name = result.scalar_one_or_none()

        # Get username
        result = await db.execute(
            select(User.username).where(User.id == current_user.id)
        )
        response.adjusted_by_username = result.scalar_one_or_none()

        return response

    except ValueError as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al procesar reembolso: {str(e)}"
        )


@router.get(
    "/expenses/{expense_id}/adjustments",
    response_model=ExpenseAdjustmentHistoryResponse,
    dependencies=[Depends(require_any_school_admin)]
)
async def get_expense_adjustment_history(
    expense_id: UUID,
    db: DatabaseSession
):
    """
    Get the adjustment history for a specific expense.

    Returns the expense details along with all adjustments made,
    ordered by most recent first.

    Args:
        expense_id: The expense UUID

    Returns:
        ExpenseAdjustmentHistoryResponse with expense and adjustment details
    """
    from app.services.expense_adjustment import ExpenseAdjustmentService
    from app.models.user import User

    service = ExpenseAdjustmentService(db)

    # Get expense
    expense = await service.get_expense_by_id(expense_id, include_adjustments=True)
    if not expense:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Gasto no encontrado"
        )

    # Get adjustments
    adjustments = await service.get_adjustment_history(expense_id)

    # Build adjustment responses with account names
    adjustment_responses = []
    for adj in adjustments:
        adj_response = ExpenseAdjustmentResponse.model_validate(adj)

        # Get account names
        if adj.previous_payment_account_id:
            result = await db.execute(
                select(BalanceAccount.name).where(
                    BalanceAccount.id == adj.previous_payment_account_id
                )
            )
            adj_response.previous_payment_account_name = result.scalar_one_or_none()

        if adj.new_payment_account_id:
            result = await db.execute(
                select(BalanceAccount.name).where(
                    BalanceAccount.id == adj.new_payment_account_id
                )
            )
            adj_response.new_payment_account_name = result.scalar_one_or_none()

        # Get username
        if adj.adjusted_by:
            result = await db.execute(
                select(User.username).where(User.id == adj.adjusted_by)
            )
            adj_response.adjusted_by_username = result.scalar_one_or_none()

        adjustment_responses.append(adj_response)

    return ExpenseAdjustmentHistoryResponse(
        expense_id=expense.id,
        expense_description=expense.description,
        expense_category=expense.category,
        expense_vendor=expense.vendor,
        current_amount=expense.amount,
        current_amount_paid=expense.amount_paid,
        current_is_paid=expense.is_paid,
        adjustments=adjustment_responses,
        total_adjustments=len(adjustment_responses)
    )


@router.get(
    "/adjustments",
    response_model=AdjustmentListPaginatedResponse,
    dependencies=[Depends(require_any_school_admin)]
)
async def list_expense_adjustments(
    db: DatabaseSession,
    start_date: date = Query(..., description="Start date (inclusive)"),
    end_date: date = Query(..., description="End date (inclusive)"),
    reason: AdjustmentReason | None = Query(None, description="Filter by reason"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0)
):
    """
    List expense adjustments within a date range.

    Use this for audit reports and tracking adjustments over time.

    Args:
        start_date: Start date for filtering
        end_date: End date for filtering
        reason: Optional filter by adjustment reason
        limit: Maximum records per page
        offset: Records to skip

    Returns:
        Paginated list of adjustments
    """
    from app.services.expense_adjustment import ExpenseAdjustmentService
    from app.models.user import User

    service = ExpenseAdjustmentService(db)

    adjustments, total = await service.get_adjustments_by_date_range(
        start_date=start_date,
        end_date=end_date,
        reason=reason,
        limit=limit,
        offset=offset
    )

    # Build list responses
    items = []
    for adj in adjustments:
        # Get expense description
        expense_result = await db.execute(
            select(Expense.description).where(Expense.id == adj.expense_id)
        )
        expense_description = expense_result.scalar_one_or_none()

        # Get username
        adjusted_by_username = None
        if adj.adjusted_by:
            user_result = await db.execute(
                select(User.username).where(User.id == adj.adjusted_by)
            )
            adjusted_by_username = user_result.scalar_one_or_none()

        items.append(ExpenseAdjustmentListResponse(
            id=adj.id,
            expense_id=adj.expense_id,
            expense_description=expense_description,
            reason=adj.reason,
            description=adj.description,
            previous_amount_paid=adj.previous_amount_paid,
            new_amount_paid=adj.new_amount_paid,
            adjustment_delta=adj.adjustment_delta,
            adjusted_by_username=adjusted_by_username,
            adjusted_at=adj.adjusted_at
        ))

    return AdjustmentListPaginatedResponse(
        items=items,
        total=total,
        limit=limit,
        offset=offset
    )


# ============================================
# Financial Planning Endpoints
# ============================================

@router.get(
    "/planning/dashboard",
    dependencies=[Depends(require_any_school_admin)]
)
async def get_planning_dashboard(
    db: DatabaseSession
):
    """
    Get the financial planning dashboard data.

    Returns:
    - Current liquidity
    - Fixed expenses monthly total
    - Pending debt total
    - Next debt payment
    - Quick 3-month projection
    - Current season info
    """
    from app.services.planning import PlanningService

    service = PlanningService(db)
    return await service.get_planning_dashboard()


@router.get(
    "/planning/sales-seasonality",
    dependencies=[Depends(require_any_school_admin)]
)
async def get_sales_seasonality(
    db: DatabaseSession,
    start_year: int = Query(None, description="Start year for analysis"),
    end_year: int = Query(None, description="End year for analysis")
):
    """
    Get sales seasonality analysis.

    Analyzes historical sales by month to identify patterns
    for financial planning purposes.

    Returns:
    - Monthly sales data
    - Yearly totals
    - Seasonality patterns
    - Growth rates between years
    """
    from app.services.planning import PlanningService

    service = PlanningService(db)
    return await service.get_sales_seasonality(start_year, end_year)


@router.get(
    "/planning/cash-projection",
    dependencies=[Depends(require_any_school_admin)]
)
async def get_cash_projection(
    db: DatabaseSession,
    months: int = Query(6, ge=1, le=12, description="Number of months to project"),
    growth_factor: float = Query(1.20, ge=0.5, le=3.0, description="Growth factor vs previous year"),
    liquidity_threshold: float = Query(5000000, ge=0, description="Minimum desired liquidity")
):
    """
    Get cash flow projection for the next N months.

    Uses:
    - Historical sales patterns with growth factor
    - Fixed expenses
    - Scheduled debt payments
    - Current liquidity

    Returns projected cash flow with alerts for low-liquidity months.
    """
    from app.services.planning import PlanningService
    from decimal import Decimal

    service = PlanningService(db)
    return await service.get_cash_projection(
        months=months,
        growth_factor=Decimal(str(growth_factor)),
        liquidity_threshold=Decimal(str(liquidity_threshold))
    )


# ============================================
# Debt Payment Schedule Endpoints
# ============================================

@router.get(
    "/planning/debt-schedule",
    dependencies=[Depends(require_any_school_admin)]
)
async def list_debt_payments(
    db: DatabaseSession,
    status: str = Query(None, description="Filter by status: pending, paid, overdue, cancelled"),
    start_date: date = Query(None, description="Filter from date"),
    end_date: date = Query(None, description="Filter until date"),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0)
):
    """
    List scheduled debt payments.

    Returns paginated list with totals and next due payment.
    """
    from app.services.planning import PlanningService

    service = PlanningService(db)
    return await service.get_debt_payments(
        status=status,
        start_date=start_date,
        end_date=end_date,
        limit=limit,
        offset=offset
    )


@router.post(
    "/planning/debt-schedule",
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_any_school_admin)]
)
async def create_debt_payment(
    db: DatabaseSession,
    current_user: CurrentUser,
    data: DebtPaymentCreate
):
    """
    Create a new scheduled debt payment.

    For tracking upcoming payments like loan installments,
    supplier payments, or tax obligations.
    """
    from app.services.planning import PlanningService

    service = PlanningService(db)
    payment = await service.create_debt_payment(
        data=data.model_dump(),
        created_by=current_user.id
    )

    await db.commit()

    return {
        "message": "Pago programado creado exitosamente",
        "payment_id": str(payment.id),
        "description": payment.description,
        "amount": float(payment.amount),
        "due_date": payment.due_date.isoformat()
    }


@router.patch(
    "/planning/debt-schedule/{payment_id}",
    dependencies=[Depends(require_any_school_admin)]
)
async def update_debt_payment(
    payment_id: UUID,
    db: DatabaseSession,
    data: DebtPaymentUpdate
):
    """
    Update a scheduled debt payment.

    Only updates fields that are provided.
    """
    from app.services.planning import PlanningService

    service = PlanningService(db)

    # Filter out None values
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}

    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No hay campos para actualizar"
        )

    payment = await service.update_debt_payment(payment_id, update_data)

    if not payment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pago programado no encontrado"
        )

    await db.commit()

    return {
        "message": "Pago programado actualizado",
        "payment_id": str(payment.id)
    }


@router.post(
    "/planning/debt-schedule/{payment_id}/mark-paid",
    dependencies=[Depends(require_any_school_admin)]
)
async def mark_debt_payment_as_paid(
    payment_id: UUID,
    db: DatabaseSession,
    data: DebtPaymentMarkPaid
):
    """
    Mark a debt payment as paid.

    Records the payment details and updates status.
    """
    from app.services.planning import PlanningService

    service = PlanningService(db)
    payment = await service.mark_debt_as_paid(
        payment_id=payment_id,
        paid_date=data.paid_date,
        paid_amount=data.paid_amount,
        payment_method=data.payment_method,
        payment_account_id=data.payment_account_id
    )

    if not payment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pago programado no encontrado"
        )

    await db.commit()

    return {
        "message": "Pago marcado como realizado",
        "payment_id": str(payment.id),
        "paid_date": payment.paid_date.isoformat(),
        "paid_amount": float(payment.paid_amount)
    }


@router.delete(
    "/planning/debt-schedule/{payment_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_any_school_admin)]
)
async def delete_debt_payment(
    payment_id: UUID,
    db: DatabaseSession
):
    """
    Delete a scheduled debt payment.

    Only pending payments can be deleted.
    """
    from app.services.planning import PlanningService

    service = PlanningService(db)
    deleted = await service.delete_debt_payment(payment_id)

    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No se puede eliminar: pago no encontrado o ya fue procesado"
        )

    await db.commit()
    return None


@router.post(
    "/planning/update-overdue",
    dependencies=[Depends(require_any_school_admin)]
)
async def update_overdue_payments(
    db: DatabaseSession
):
    """
    Update status of overdue debt payments.

    Marks all pending payments past their due date as overdue.
    Run this periodically (e.g., daily) to keep statuses current.
    """
    from app.services.planning import PlanningService

    service = PlanningService(db)
    count = await service.update_overdue_payments()
    await db.commit()

    return {
        "message": f"{count} pagos marcados como vencidos",
        "updated_count": count
    }


@router.post(
    "/planning/import-liabilities",
    dependencies=[Depends(require_any_school_admin)]
)
async def import_liabilities_to_debt_schedule(
    db: DatabaseSession,
    current_user: CurrentUser
):
    """
    Import active LIABILITY_LONG accounts into the debt payment schedule.
    For liabilities with interest_rate > 0: generates monthly interest payments + capital payment.
    For liabilities without interest: generates a single capital payment at due_date.
    Skips liabilities already linked to a debt payment.
    """
    from app.models.accounting import BalanceAccount, DebtPaymentSchedule
    from app.services.planning import PlanningService
    from app.utils.timezone import get_colombia_date

    service = PlanningService(db)
    today = get_colombia_date()

    # Get all LIABILITY_LONG accounts with due_date
    result = await db.execute(
        select(BalanceAccount).where(
            BalanceAccount.account_type == AccountType.LIABILITY_LONG,
            BalanceAccount.is_active == True,
            BalanceAccount.due_date.isnot(None),
            BalanceAccount.balance > 0
        )
    )
    liabilities = result.scalars().all()

    # Check which ones already have a debt payment linked
    existing_result = await db.execute(
        select(DebtPaymentSchedule.balance_account_id).where(
            DebtPaymentSchedule.balance_account_id.isnot(None),
            DebtPaymentSchedule.status != 'cancelled'
        )
    )
    existing_ids = {row for row in existing_result.scalars().all()}

    imported = []
    skipped = []

    for liability in liabilities:
        if liability.id in existing_ids:
            skipped.append({
                "name": liability.name,
                "reason": "Ya existe en cronograma"
            })
            continue

        payments_created = []

        # Generate interest payments if interest_rate > 0
        if liability.interest_rate and liability.interest_rate > 0:
            interest_payments = await service.generate_interest_payments(
                liability=liability,
                from_date=today,
                to_date=liability.due_date,
                created_by=current_user.id
            )
            for p in interest_payments:
                payments_created.append({
                    "type": "interest",
                    "amount": float(p.amount),
                    "due_date": p.due_date.isoformat()
                })

        # Create capital payment at due_date
        capital_data = {
            "description": f"Capital {liability.name}",
            "creditor": liability.creditor,
            "amount": float(liability.balance),
            "due_date": liability.due_date,
            "is_recurring": False,
            "category": "loan_principal",
            "notes": f"Pago de capital. Tasa: {liability.interest_rate}%" if liability.interest_rate else "Pago de capital",
            "balance_account_id": liability.id
        }
        capital_payment = await service.create_debt_payment(
            data=capital_data,
            created_by=current_user.id
        )
        payments_created.append({
            "type": "capital",
            "amount": float(capital_payment.amount),
            "due_date": capital_payment.due_date.isoformat()
        })

        imported.append({
            "name": liability.name,
            "capital": float(liability.balance),
            "interest_rate": float(liability.interest_rate) if liability.interest_rate else None,
            "due_date": liability.due_date.isoformat(),
            "payments_generated": len(payments_created),
            "payments": payments_created
        })

    await db.commit()

    total_payments = sum(item["payments_generated"] for item in imported)
    return {
        "message": f"{len(imported)} pasivos importados ({total_payments} pagos generados), {len(skipped)} ya existían",
        "imported": imported,
        "skipped": skipped,
        "total_imported": len(imported),
        "total_skipped": len(skipped),
        "total_payments_generated": total_payments
    }


@router.post(
    "/planning/generate-pending-interest",
    dependencies=[Depends(require_any_school_admin)]
)
async def generate_pending_interest_payments(
    db: DatabaseSession,
    current_user: CurrentUser
):
    """
    Generate missing interest payments for all active liabilities.
    Use this when due dates have been extended or debts remain unpaid past due_date.
    """
    from app.services.planning import PlanningService

    service = PlanningService(db)
    generated = await service.generate_all_pending_interest(created_by=current_user.id)
    await db.commit()

    return {
        "message": f"{len(generated)} pagos de interés generados",
        "generated": generated,
        "total_generated": len(generated)
    }


# ============================================
# Financial Statements (Estados Financieros)
# ============================================

@router.get(
    "/financial-statements/income-statement",
    dependencies=[Depends(require_any_school_admin)]
)
async def get_income_statement(
    db: DatabaseSession,
    start_date: date = Query(..., description="Start date of the period"),
    end_date: date = Query(..., description="End date of the period"),
    compare_previous: bool = Query(False, description="Compare with previous period")
):
    """
    Generate Income Statement (Estado de Resultados) for a period.

    Returns:
        - Revenue (Ingresos)
        - Cost of Goods Sold (Costo de Ventas)
        - Gross Profit (Utilidad Bruta)
        - Operating Expenses by category
        - Operating Income (Utilidad Operacional)
        - Other Expenses
        - Net Income (Utilidad Neta)

    COGS Calculation:
        - Uses Product.cost if available
        - Otherwise estimates as unit_price * 0.80
        - Includes coverage percentage indicator
    """
    from app.services.financial_statements import FinancialStatementsService

    if end_date < start_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="end_date debe ser mayor o igual a start_date"
        )

    service = FinancialStatementsService(db)
    result = await service.get_income_statement(
        start_date=start_date,
        end_date=end_date,
        compare_previous=compare_previous
    )

    return result


@router.get(
    "/financial-statements/balance-sheet",
    dependencies=[Depends(require_any_school_admin)]
)
async def get_balance_sheet(
    db: DatabaseSession,
    as_of_date: date | None = Query(None, description="Date for balance sheet (defaults to today)")
):
    """
    Generate Balance Sheet (Balance General) as of a specific date.

    Returns:
        - Assets (Activos)
            - Current Assets: Cash, Receivables, Inventory
            - Fixed Assets: Equipment, Machinery
            - Other Assets
        - Liabilities (Pasivos)
            - Current Liabilities: Payables, Short-term debt
            - Long-term Liabilities: Loans
        - Equity (Patrimonio)
            - Capital
            - Retained Earnings

    Includes validation that Assets = Liabilities + Equity.
    """
    from app.services.financial_statements import FinancialStatementsService

    service = FinancialStatementsService(db)
    result = await service.get_balance_sheet(as_of_date=as_of_date)

    return result


@router.get(
    "/financial-statements/periods",
    dependencies=[Depends(require_any_school_admin)]
)
async def get_available_periods(
    db: DatabaseSession
):
    """
    Get predefined period options for financial statements.

    Returns preset periods:
        - This month / Last month
        - This quarter / Last quarter
        - This year / Last year

    Also returns the earliest date with sales data.
    """
    from app.services.financial_statements import FinancialStatementsService

    service = FinancialStatementsService(db)
    result = await service.get_available_periods()

    return result


# ============================================
# Global Patrimony Summary
# ============================================

@router.get(
    "/patrimony-summary",
    dependencies=[Depends(require_any_school_admin)]
)
async def get_global_patrimony_summary(
    db: DatabaseSession
):
    """
    Get GLOBAL patrimony summary (all schools consolidated).

    PATRIMONIO = ACTIVOS - PASIVOS

    Assets:
    - Cash (Caja Menor + Caja Mayor + Nequi + Banco)
    - Inventory (ALL schools, valued at cost or 80% of price)
    - Accounts Receivable (ALL)
    - Fixed Assets

    Liabilities:
    - Accounts Payable
    - Pending Expenses
    - Debts (short and long term)

    Returns comprehensive breakdown with net patrimony.
    Includes inventory breakdown by school for internal reporting.
    """
    from app.services.patrimony import PatrimonyService

    service = PatrimonyService(db)
    return await service.get_global_patrimony_summary()


# ============================================
# Expense Categories Management
# ============================================

@router.get(
    "/expense-categories",
    response_model=list[ExpenseCategoryListResponse],
    dependencies=[Depends(require_any_school_admin)]
)
async def list_expense_categories(
    db: DatabaseSession,
    include_inactive: bool = Query(False, description="Include inactive categories"),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0)
):
    """
    List all expense categories.

    Returns categories ordered by display_order.
    By default only returns active categories.
    """
    from app.services.expense_category import ExpenseCategoryService

    service = ExpenseCategoryService(db)
    return await service.list_categories(
        include_inactive=include_inactive,
        limit=limit,
        offset=offset
    )


@router.get(
    "/expense-categories/{category_id}",
    response_model=ExpenseCategoryResponse,
    dependencies=[Depends(require_any_school_admin)]
)
async def get_expense_category(
    category_id: UUID,
    db: DatabaseSession
):
    """Get a single expense category by ID."""
    from app.services.expense_category import ExpenseCategoryService

    service = ExpenseCategoryService(db)
    category = await service.get_by_id(category_id)

    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Categoría no encontrada"
        )

    return category


@router.post(
    "/expense-categories",
    response_model=ExpenseCategoryResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_any_school_admin)]
)
async def create_expense_category(
    data: ExpenseCategoryCreate,
    db: DatabaseSession
):
    """
    Create a new expense category.

    Code must be unique and lowercase (will be auto-normalized).
    System categories cannot be created via API.
    """
    from app.services.expense_category import ExpenseCategoryService

    service = ExpenseCategoryService(db)

    try:
        category = await service.create(data)
        await db.commit()
        return category
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.patch(
    "/expense-categories/{category_id}",
    response_model=ExpenseCategoryResponse,
    dependencies=[Depends(require_any_school_admin)]
)
async def update_expense_category(
    category_id: UUID,
    data: ExpenseCategoryUpdate,
    db: DatabaseSession
):
    """
    Update an expense category.

    System categories can be updated (name, color, etc.) but cannot be deleted.
    """
    from app.services.expense_category import ExpenseCategoryService

    service = ExpenseCategoryService(db)
    category = await service.update(category_id, data)

    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Categoría no encontrada"
        )

    await db.commit()
    return category


@router.delete(
    "/expense-categories/{category_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_any_school_admin)]
)
async def delete_expense_category(
    category_id: UUID,
    db: DatabaseSession
):
    """
    Delete (soft-delete) an expense category.

    System categories cannot be deleted.
    """
    from app.services.expense_category import ExpenseCategoryService

    service = ExpenseCategoryService(db)

    try:
        success = await service.delete(category_id)
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Categoría no encontrada"
            )
        await db.commit()
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


# ============================================
# Caja Menor Configuration & Auto-Close
# ============================================

@router.get(
    "/caja-menor/config",
    response_model=CajaMenorConfigResponse,
    dependencies=[Depends(require_global_permission("accounting.view_caja_menor"))]
)
async def get_caja_menor_config(db: DatabaseSession):
    """Get Caja Menor auto-close configuration."""
    from app.services.cash_register import CashRegisterService

    service = CashRegisterService(db)
    config = await service.get_caja_menor_config()
    await db.commit()
    return config


@router.patch(
    "/caja-menor/config",
    response_model=CajaMenorConfigResponse,
    dependencies=[Depends(require_global_permission("accounting.edit_caja_menor_config"))]
)
async def update_caja_menor_config(
    data: CajaMenorConfigUpdate,
    db: DatabaseSession,
    current_user: CurrentUser,
):
    """Update Caja Menor auto-close configuration."""
    from app.services.cash_register import CashRegisterService

    service = CashRegisterService(db)
    config = await service.update_caja_menor_config(
        base_amount=data.base_amount,
        auto_close_enabled=data.auto_close_enabled,
        auto_close_time=data.auto_close_time,
        updated_by=current_user.id,
    )
    await db.commit()
    return config


@router.post(
    "/caja-menor/auto-close",
    response_model=CajaMenorAutoCloseResult,
)
async def auto_close_caja_menor(
    db: DatabaseSession,
    current_user: CurrentUser,
    constraints: dict = Depends(
        require_global_permission_with_constraints("accounting.liquidate_caja_menor")
    ),
):
    """
    Manually trigger Caja Menor auto-close.

    Transfers excess above the configured base_amount to Caja Mayor.
    Subject to liquidation constraints (max_amount for the excess).
    """
    from app.services.cash_register import CashRegisterService

    service = CashRegisterService(db)

    try:
        result = await service.auto_close_caja_menor(created_by=current_user.id)

        # Verify amount against constraints
        max_amount = constraints.get("max_amount")
        if max_amount is not None and result["amount_transferred"] > max_amount:
            await db.rollback()
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Excedente ${result['amount_transferred']:,.0f} excede limite de ${max_amount:,.0f}",
            )

        await db.commit()
        return result
    except ValueError as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


# ============================================
# Inter-Account Transfers
# ============================================

@router.post(
    "/transfers",
    response_model=AccountTransferResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_account_transfer(
    data: AccountTransferCreate,
    db: DatabaseSession,
    current_user: CurrentUser,
    constraints: dict = Depends(
        require_global_permission_with_constraints("accounting.transfer_between_accounts")
    ),
):
    """
    Transfer money between any two balance accounts.

    Creates dual BalanceEntry records + a Transaction record for audit trail.
    Subject to max_amount constraint.
    """
    from app.services.cash_register import CashRegisterService

    # Check max_amount constraint
    max_amount = constraints.get("max_amount")
    if max_amount is not None and data.amount > max_amount:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Monto ${data.amount:,.0f} excede el limite permitido de ${max_amount:,.0f}",
        )

    service = CashRegisterService(db)
    try:
        result = await service.create_transfer(
            from_account_id=data.from_account_id,
            to_account_id=data.to_account_id,
            amount=data.amount,
            reason=data.reason,
            reference=data.reference,
            created_by=current_user.id,
        )
        await db.commit()
        return result
    except ValueError as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.get(
    "/transfers",
    response_model=TransferHistoryResponse,
    dependencies=[Depends(require_global_permission("accounting.view_transfers"))]
)
async def get_transfer_history(
    db: DatabaseSession,
    start_date: date | None = Query(None),
    end_date: date | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    """Get history of inter-account transfers."""
    from app.services.cash_register import CashRegisterService

    service = CashRegisterService(db)
    return await service.get_transfer_history(
        limit=limit,
        offset=offset,
        start_date=start_date,
        end_date=end_date,
    )


# ============================================
# Permanent Category Delete & Financial Snapshots
# ============================================

@router.delete(
    "/expense-categories/{category_id}/permanent",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_any_school_admin)]
)
async def permanent_delete_expense_category(
    category_id: UUID,
    db: DatabaseSession
):
    """
    Permanently delete an inactive, non-system expense category.

    Requirements:
    - Category must be inactive (is_active=False)
    - Category must not be a system category (is_system=False)
    - Category must have zero associated expenses
    """
    from sqlalchemy import delete as sa_delete

    result = await db.execute(
        select(ExpenseCategoryModel).where(ExpenseCategoryModel.id == category_id)
    )
    category = result.scalar_one_or_none()

    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Categoría no encontrada"
        )

    if category.is_system:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No se puede eliminar una categoría del sistema"
        )

    if category.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La categoría debe estar inactiva antes de eliminarla permanentemente"
        )

    # Check for associated expenses
    expense_count_result = await db.execute(
        select(func.count(Expense.id)).where(Expense.category == category.code)
    )
    expense_count = expense_count_result.scalar() or 0

    if expense_count > 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"La categoría tiene {expense_count} gasto(s) asociado(s). Re-categorícelos primero."
        )

    # Hard delete
    await db.execute(
        sa_delete(ExpenseCategoryModel).where(ExpenseCategoryModel.id == category_id)
    )
    await db.commit()


@router.post(
    "/financial-snapshots",
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_any_school_admin)]
)
async def create_financial_snapshot(
    snapshot_type: str = Query(..., pattern="^(balance_sheet|income_statement)$"),
    snapshot_date: date = Query(...),
    period_start: date | None = Query(None),
    period_end: date | None = Query(None),
    notes: str | None = Query(None, max_length=500),
    db: DatabaseSession = ...,
    current_user: CurrentUser = ...
):
    """Save a financial statement snapshot for historical tracking."""
    from app.models.accounting import FinancialSnapshot
    from app.services.financial_statements import FinancialStatementsService

    service = FinancialStatementsService(db)

    if snapshot_type == "balance_sheet":
        data = await service.get_balance_sheet(snapshot_date)
    else:
        if not period_start or not period_end:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="period_start y period_end son requeridos para Estado de Resultados"
            )
        data = await service.get_income_statement(period_start, period_end)

    snapshot = FinancialSnapshot(
        snapshot_type=snapshot_type,
        snapshot_date=snapshot_date,
        period_start=period_start,
        period_end=period_end,
        data=data,
        notes=notes,
        created_by=current_user.id
    )
    db.add(snapshot)
    await db.commit()
    await db.refresh(snapshot)

    return {
        "id": str(snapshot.id),
        "snapshot_type": snapshot.snapshot_type,
        "snapshot_date": snapshot.snapshot_date.isoformat(),
        "period_start": snapshot.period_start.isoformat() if snapshot.period_start else None,
        "period_end": snapshot.period_end.isoformat() if snapshot.period_end else None,
        "notes": snapshot.notes,
        "created_at": snapshot.created_at.isoformat(),
    }


@router.get(
    "/financial-snapshots",
    dependencies=[Depends(require_any_school_admin)]
)
async def list_financial_snapshots(
    db: DatabaseSession,
    snapshot_type: str | None = Query(None, pattern="^(balance_sheet|income_statement)$"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0)
):
    """List saved financial snapshots."""
    from app.models.accounting import FinancialSnapshot

    query = select(
        FinancialSnapshot.id,
        FinancialSnapshot.snapshot_type,
        FinancialSnapshot.snapshot_date,
        FinancialSnapshot.period_start,
        FinancialSnapshot.period_end,
        FinancialSnapshot.notes,
        FinancialSnapshot.created_at,
    ).order_by(FinancialSnapshot.created_at.desc())

    if snapshot_type:
        query = query.where(FinancialSnapshot.snapshot_type == snapshot_type)

    query = query.limit(limit).offset(offset)
    result = await db.execute(query)
    rows = result.all()

    return [
        {
            "id": str(row.id),
            "snapshot_type": row.snapshot_type,
            "snapshot_date": row.snapshot_date.isoformat(),
            "period_start": row.period_start.isoformat() if row.period_start else None,
            "period_end": row.period_end.isoformat() if row.period_end else None,
            "notes": row.notes,
            "created_at": row.created_at.isoformat(),
        }
        for row in rows
    ]


@router.get(
    "/financial-snapshots/{snapshot_id}",
    dependencies=[Depends(require_any_school_admin)]
)
async def get_financial_snapshot(
    snapshot_id: UUID,
    db: DatabaseSession
):
    """Get a saved financial snapshot with full data."""
    from app.models.accounting import FinancialSnapshot

    result = await db.execute(
        select(FinancialSnapshot).where(FinancialSnapshot.id == snapshot_id)
    )
    snapshot = result.scalar_one_or_none()

    if not snapshot:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Snapshot no encontrado"
        )

    return {
        "id": str(snapshot.id),
        "snapshot_type": snapshot.snapshot_type,
        "snapshot_date": snapshot.snapshot_date.isoformat(),
        "period_start": snapshot.period_start.isoformat() if snapshot.period_start else None,
        "period_end": snapshot.period_end.isoformat() if snapshot.period_end else None,
        "data": snapshot.data,
        "notes": snapshot.notes,
        "created_at": snapshot.created_at.isoformat(),
    }


@router.delete(
    "/financial-snapshots/{snapshot_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_any_school_admin)]
)
async def delete_financial_snapshot(
    snapshot_id: UUID,
    db: DatabaseSession
):
    """Delete a saved financial snapshot."""
    from app.models.accounting import FinancialSnapshot
    from sqlalchemy import delete as sa_delete

    result = await db.execute(
        select(FinancialSnapshot).where(FinancialSnapshot.id == snapshot_id)
    )
    snapshot = result.scalar_one_or_none()

    if not snapshot:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Snapshot no encontrado"
        )

    await db.execute(
        sa_delete(FinancialSnapshot).where(FinancialSnapshot.id == snapshot_id)
    )
    await db.commit()
