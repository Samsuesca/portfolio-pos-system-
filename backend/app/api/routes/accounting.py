"""
Accounting Endpoints - Transactions, Expenses, and Cash Flow
"""
from uuid import UUID
from datetime import date
from fastapi import APIRouter, HTTPException, status, Query, Depends

from sqlalchemy import select, func

from app.api.dependencies import (
    DatabaseSession, CurrentUser,
    require_permission, require_permission_with_constraints
)
from app.api.error_responses import responses, AUTHENTICATED
from app.schemas.base import PaginatedResponse, paginate
from app.models.accounting import (
    TransactionType, ExpenseCategory, AccountType,
    Transaction, Expense, BalanceEntry, AccountsReceivable, AccountsPayable,
)
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
    dependencies=[Depends(require_permission("accounting.view_cash"))],
    responses=AUTHENTICATED,
    operation_id="getAccountingDashboard",
)
async def get_accounting_dashboard(
    school_id: UUID,
    db: DatabaseSession
):
    """Devuelve el resumen contable del colegio para el dia y el mes en curso.

    Agrega ingresos y gastos del dia, totales acumulados del mes (desde el dia 1
    hasta hoy en zona horaria Colombia), gastos pendientes de pago, y las ultimas
    10 transacciones del mes. Solo lectura — no escribe en BD.

    Args:
        school_id: Filtra todas las metricas por colegio. Aunque la contabilidad
            es global a nivel de cuentas, las transacciones llevan `school_id`
            como dimension de reporte.

    Returns:
        AccountingDashboard con today_income, today_expenses, today_net,
        month_income, month_expenses, month_net, pending_expenses (count),
        pending_expenses_amount y recent_transactions[].

    Raises:
        HTTPException 401: Si el usuario no esta autenticado.
        HTTPException 403: Si carece del permiso `accounting.view_cash`.
    """
    service = AccountingService(db)
    return await service.get_dashboard(school_id)


@router.get(
    "/cash-flow",
    response_model=CashFlowSummary,
    dependencies=[Depends(require_permission("accounting.view_cash"))],
    responses=responses(400),
    operation_id="getCashFlowSummary",
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
    """Calcula el flujo de caja del colegio en un rango de fechas.

    Suma ingresos agrupados por metodo de pago (cash, nequi, transfer, card,
    credit) y gastos agrupados por categoria, retornando totales y el flujo
    neto (ingresos - gastos). Solo lectura.

    Args:
        start_date: Inicio del rango (inclusivo).
        end_date: Fin del rango (inclusivo).

    Returns:
        CashFlowSummary con period_start, period_end, total_income,
        total_expenses, net_flow, income_by_method y expenses_by_category.

    Raises:
        HTTPException 400: Si `start_date > end_date`.
        HTTPException 403: Si carece del permiso `accounting.view_cash`.
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
    dependencies=[Depends(require_permission("accounting.view_cash"))],
    responses=responses(400),
    operation_id="getMonthlyReport",
)
async def get_monthly_report(
    school_id: UUID,
    year: int,
    month: int,
    db: DatabaseSession
):
    """Genera el reporte financiero mensual con desglose diario.

    Combina el cash flow del mes (ingresos por metodo, gastos por categoria)
    con un breakdown dia a dia de ventas, encargos y gastos. Calcula
    `net_income` por dia. Solo lectura.

    Args:
        year: Año del reporte (sin validacion explicita — Python date lo valida).
        month: Mes del reporte (1-12).

    Returns:
        MonthlyFinancialReport con totales del mes y `daily_summaries[]`.

    Raises:
        HTTPException 400: Si `month` no esta en el rango 1-12.
        HTTPException 403: Si carece del permiso `accounting.view_cash`.
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
    dependencies=[Depends(require_permission("accounting.view_transactions"))],
    responses=responses(400),
    operation_id="createTransaction",
)
async def create_transaction(
    school_id: UUID,
    transaction_data: TransactionCreate,
    db: DatabaseSession,
    current_user: CurrentUser
):
    """Registra una transaccion manual (income o expense) con integracion de balances.

    Pensado para entradas/salidas que NO provienen de ventas, encargos o pagos
    de gastos (esos flujos crean su transaccion automaticamente). El servicio
    delega en `TransactionService.record`, que ademas afecta la cuenta de balance
    correspondiente al `payment_method`: `cash` -> Caja Menor, `nequi` -> Nequi,
    `transfer`/`card` -> Banco, `credit` -> Cuentas por Cobrar.

    Side effects:
        - Inserta fila en `transactions`.
        - Inserta fila en `balance_entries` y actualiza `current_balance` de la
          cuenta destino, salvo que el caller haya solicitado `skip_balance_update`
          (no expuesto en este endpoint).
        - El commit es atomico: si la integracion de balance falla por saldo
          insuficiente (`chk_balance_account_sign`), todo se revierte.

    Args:
        transaction_data: Payload con type, amount, payment_method, description,
            category, reference_code, transaction_date y FKs opcionales
            (sale_id, order_id, expense_id). El `school_id` del path sobrescribe
            el del payload.

    Returns:
        TransactionResponse con la transaccion creada.

    Raises:
        HTTPException 400: Si la operacion dejaria saldo negativo en la cuenta
            destino, o cualquier `ValueError` levantado por el servicio.
        HTTPException 403: Si carece del permiso `accounting.view_transactions`.
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
    response_model=PaginatedResponse[TransactionListResponse],
    dependencies=[Depends(require_permission("accounting.view_cash"))],
    responses=AUTHENTICATED,
    operation_id="listTransactions",
)
async def list_transactions(
    school_id: UUID,
    db: DatabaseSession,
    start_date: date = Query(None, description="Filter by start date"),
    end_date: date = Query(None, description="Filter by end date"),
    transaction_type: TransactionType = Query(None, description="Filter by type"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100)
):
    """Lista transacciones del colegio paginadas, con filtros opcionales.

    Si se proveen ambas fechas se ordenan por `transaction_date` descendente;
    en otro caso se usa el orden por defecto del servicio. El conteo total se
    calcula con los mismos filtros antes de paginar. Solo lectura.

    Args:
        start_date: Inicio del rango (inclusivo). Debe combinarse con `end_date`.
        end_date: Fin del rango (inclusivo).
        transaction_type: Filtra por `INCOME` o `EXPENSE`.
        skip: Offset de paginacion.
        limit: Pagina maxima 100.

    Returns:
        PaginatedResponse[TransactionListResponse] con items, total, page,
        total_pages y has_more.

    Raises:
        HTTPException 403: Si carece del permiso `accounting.view_cash`.
    """
    service = TransactionService(db)

    count_filters = [Transaction.school_id == school_id]
    if start_date and end_date:
        count_filters.extend([Transaction.transaction_date >= start_date, Transaction.transaction_date <= end_date])
    if transaction_type:
        count_filters.append(Transaction.type == transaction_type)

    total = (await db.execute(select(func.count(Transaction.id)).where(*count_filters))).scalar_one()

    if start_date and end_date:
        transactions = await service.get_transactions_by_date_range(
            school_id, start_date, end_date, transaction_type
        )
        transactions = transactions[skip:skip + limit]
    else:
        filters = {}
        if transaction_type:
            filters["type"] = transaction_type
        transactions = await service.get_multi(
            school_id=school_id, skip=skip, limit=limit,
            filters=filters if filters else None
        )

    items = [TransactionListResponse.model_validate(t) for t in transactions]
    return PaginatedResponse[TransactionListResponse](**paginate(items, total, skip, limit))


@router.get(
    "/transactions/{transaction_id}",
    response_model=TransactionResponse,
    dependencies=[Depends(require_permission("accounting.view_cash"))],
    responses=responses(404),
    operation_id="getTransaction",
)
async def get_transaction(
    school_id: UUID,
    transaction_id: UUID,
    db: DatabaseSession
):
    """Recupera el detalle de una transaccion del colegio.

    Returns:
        TransactionResponse con todos los campos del modelo.

    Raises:
        HTTPException 403: Si carece del permiso `accounting.view_cash`.
        HTTPException 404: Si la transaccion no existe o no pertenece al colegio.
    """
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
    dependencies=[Depends(require_permission("accounting.create_expense"))],
    responses=responses(400),
    operation_id="createExpense",
)
async def create_expense(
    school_id: UUID,
    expense_data: ExpenseCreate,
    db: DatabaseSession,
    current_user: CurrentUser
):
    """Crea el registro de un gasto. NO afecta cuentas de balance hasta que se pague.

    El gasto queda en estado `is_paid=False, amount_paid=0`. La afectacion contable
    (debito en Caja/Banco/etc.) ocurre cuando se invoca `POST /expenses/{id}/pay`.
    Esto permite registrar facturas a credito y pagarlas posteriormente.

    Side effects:
        - Inserta fila en `expenses`.
        - Dispara alerta Telegram `expense_created` (fire-and-forget; cualquier
          fallo se silencia y no afecta la transaccion).

    Args:
        expense_data: Payload con category, description, amount, expense_date,
            due_date opcional, vendor_id opcional, receipt_number, notes,
            is_recurring y recurring_period. El `school_id` del path sobrescribe
            el del payload.

    Returns:
        ExpenseResponse con el gasto creado.

    Raises:
        HTTPException 400: Si el servicio levanta `ValueError` (validaciones de
            negocio sobre el payload).
        HTTPException 403: Si carece del permiso `accounting.create_expense`.
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
    response_model=PaginatedResponse[ExpenseListResponse],
    dependencies=[Depends(require_permission("accounting.view_cash"))],
    responses=AUTHENTICATED,
    operation_id="listExpenses",
)
async def list_expenses(
    school_id: UUID,
    db: DatabaseSession,
    category: ExpenseCategory = Query(None, description="Filter by category"),
    is_paid: bool = Query(None, description="Filter by payment status"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100)
):
    """Lista gastos activos del colegio paginados, con filtros opcionales.

    Solo retorna gastos con `is_active=True` (excluye soft-deleted). Cada item
    incluye nombre del proveedor (si aplica) y el `balance` calculado
    (`amount - amount_paid`).

    Args:
        category: Filtra por categoria (`ExpenseCategory` enum).
        is_paid: Filtra por estado de pago.
        skip: Offset de paginacion.
        limit: Pagina maxima 100.

    Returns:
        PaginatedResponse[ExpenseListResponse].

    Raises:
        HTTPException 403: Si carece del permiso `accounting.view_cash`.
    """
    service = ExpenseService(db)

    filters = {"is_active": True}
    if category:
        filters["category"] = category
    if is_paid is not None:
        filters["is_paid"] = is_paid

    total = await service.count(school_id=school_id, filters=filters)
    expenses = await service.get_multi(
        school_id=school_id, skip=skip, limit=limit, filters=filters
    )

    items = [
        ExpenseListResponse(
            id=e.id, category=e.category, description=e.description,
            amount=e.amount, amount_paid=e.amount_paid, is_paid=e.is_paid,
            expense_date=e.expense_date, due_date=e.due_date,
            vendor_id=e.vendor_id, vendor_name=e.vendor.name if e.vendor else None,
            is_recurring=e.is_recurring, balance=e.balance
        )
        for e in expenses
    ]
    return PaginatedResponse[ExpenseListResponse](**paginate(items, total, skip, limit))


@router.get(
    "/expenses/pending",
    response_model=PaginatedResponse[ExpenseListResponse],
    dependencies=[Depends(require_permission("accounting.view_cash"))],
    responses=AUTHENTICATED,
    operation_id="getPendingExpenses",
)
async def get_pending_expenses(
    school_id: UUID,
    db: DatabaseSession,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100)
):
    """Lista gastos pendientes de pago (`is_paid=False`) ordenados por vencimiento.

    Equivale a `GET /expenses?is_paid=false` pero ordena por `due_date` asc
    (gastos sin fecha al final). Util para vista de cuentas por pagar internas.

    Args:
        skip: Offset de paginacion (aplicado en memoria sobre el resultado).
        limit: Pagina maxima 100.

    Returns:
        PaginatedResponse[ExpenseListResponse] con gastos vencidos primero.

    Raises:
        HTTPException 403: Si carece del permiso `accounting.view_cash`.
    """
    pending_filters = [Expense.school_id == school_id, Expense.is_paid == False, Expense.is_active == True]
    total = (await db.execute(select(func.count(Expense.id)).where(*pending_filters))).scalar_one()

    service = ExpenseService(db)
    all_pending = await service.get_pending_expenses(school_id)
    expenses = all_pending[skip:skip + limit]

    items = [
        ExpenseListResponse(
            id=e.id, category=e.category, description=e.description,
            amount=e.amount, amount_paid=e.amount_paid, is_paid=e.is_paid,
            expense_date=e.expense_date, due_date=e.due_date,
            vendor_id=e.vendor_id, vendor_name=e.vendor.name if e.vendor else None,
            is_recurring=e.is_recurring, balance=e.balance
        )
        for e in expenses
    ]
    return PaginatedResponse[ExpenseListResponse](**paginate(items, total, skip, limit))


@router.get(
    "/expenses/by-category",
    response_model=list[ExpensesByCategory],
    dependencies=[Depends(require_permission("accounting.view_cash"))],
    responses=AUTHENTICATED,
    operation_id="getExpensesByCategory",
)
async def get_expenses_by_category(
    school_id: UUID,
    db: DatabaseSession,
    start_date: date = Query(..., description="Start date"),
    end_date: date = Query(..., description="End date")
):
    """Agrupa los gastos del rango por categoria, con totales y porcentajes.

    Excluye gastos inactivos (soft-deleted). El porcentaje se calcula sobre la
    suma total del rango; si la suma es 0, todos los porcentajes son 0.

    Args:
        start_date: Inicio del rango (inclusivo).
        end_date: Fin del rango (inclusivo).

    Returns:
        list[ExpensesByCategory] con category, total_amount, count, percentage.

    Raises:
        HTTPException 400: Si `start_date > end_date`.
        HTTPException 403: Si carece del permiso `accounting.view_cash`.
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
    dependencies=[Depends(require_permission("accounting.view_cash"))],
    responses=responses(404),
    operation_id="getExpense",
)
async def get_expense(
    school_id: UUID,
    expense_id: UUID,
    db: DatabaseSession
):
    """Recupera el detalle de un gasto del colegio.

    Returns:
        ExpenseResponse con todos los campos del gasto.

    Raises:
        HTTPException 403: Si carece del permiso `accounting.view_cash`.
        HTTPException 404: Si el gasto no existe o no pertenece al colegio.
    """
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
    dependencies=[Depends(require_permission("accounting.create_expense"))],
    responses=responses(400, 404),
    operation_id="updateExpense",
)
async def update_expense(
    school_id: UUID,
    expense_id: UUID,
    expense_data: ExpenseUpdate,
    db: DatabaseSession
):
    """Actualiza campos editables de un gasto (parcialmente, exclude_unset).

    No reabre balances ni revierte pagos asociados; solo actualiza metadata
    del gasto (descripcion, monto, categoria, fechas, etc.). Si necesita revertir
    un pago, hagalo a nivel de transacciones.

    Args:
        expense_data: Campos a modificar; los no provistos se preservan.

    Returns:
        ExpenseResponse con el gasto actualizado.

    Raises:
        HTTPException 400: Si el servicio rechaza el cambio (`ValueError`).
        HTTPException 403: Si carece del permiso `accounting.create_expense`.
        HTTPException 404: Si el gasto no existe o no pertenece al colegio.
    """
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
    dependencies=[Depends(require_permission("accounting.pay_expense"))],
    responses=responses(400, 404),
    operation_id="payExpense",
)
async def pay_expense(
    school_id: UUID,
    expense_id: UUID,
    payment: ExpensePayment,
    db: DatabaseSession,
    current_user: CurrentUser
):
    """Registra un pago (parcial o total) sobre un gasto y aplica el debito contable.

    Acumula `amount_paid` y marca `is_paid=True` cuando alcanza `amount`. La
    transaccion contable se crea via `TransactionService.record` con
    `type=EXPENSE` y `category=<expense.category>`, lo que afecta la cuenta de
    balance correspondiente al `payment_method` elegido (cash -> Caja Menor,
    nequi -> Nequi, transfer/card -> Banco). Operacion atomica: si el debito
    excede el saldo de la cuenta, todo se revierte.

    Side effects:
        - Actualiza `amount_paid`, `is_paid` en `expenses`.
        - Inserta fila en `transactions` (type=EXPENSE).
        - Inserta fila en `balance_entries` y actualiza el balance de la cuenta.
        - Dispara alerta Telegram `expense_paid` (fire-and-forget).

    Args:
        payment: Payload con amount y payment_method.

    Returns:
        ExpenseResponse con `amount_paid` actualizado.

    Raises:
        HTTPException 400: Si el pago excede el monto pendiente, o si la cuenta
            destino quedaria con saldo negativo (`Fondos insuficientes`).
        HTTPException 403: Si carece del permiso `accounting.pay_expense`.
        HTTPException 404: Si el gasto no existe o no pertenece al colegio.
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
    dependencies=[Depends(require_permission("accounting.pay_expense"))],
    responses=responses(404),
    operation_id="deleteExpense",
)
async def delete_expense(
    school_id: UUID,
    expense_id: UUID,
    db: DatabaseSession
):
    """Elimina logicamente un gasto (`is_active=False`).

    No revierte pagos ni transacciones contables ya aplicadas — el gasto deja
    de aparecer en listados pero su rastro contable persiste en `transactions`
    y `balance_entries` para preservar la auditoria.

    Side effects:
        - Marca `expenses.is_active=False`.

    Returns:
        204 No Content (sin cuerpo).

    Raises:
        HTTPException 403: Si carece del permiso `accounting.pay_expense`.
        HTTPException 404: Si el gasto no existe o no pertenece al colegio.
    """
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
    dependencies=[Depends(require_permission("accounting.open_register"))],
    responses=responses(400),
    operation_id="openCashRegister",
)
async def open_cash_register(
    school_id: UUID,
    register_data: DailyCashRegisterCreate,
    db: DatabaseSession
):
    """Abre la caja diaria de un colegio para una fecha especifica.

    Una sola caja por (school_id, register_date). El servicio rechaza si ya
    existe una para esa fecha. La caja queda en estado abierto hasta invocar
    `POST /cash-register/{id}/close`.

    Side effects:
        - Inserta fila en `daily_cash_registers` con `is_closed=False`.

    Args:
        register_data: Payload con register_date y opening_balance. El
            `school_id` del path sobrescribe el del payload.

    Returns:
        DailyCashRegisterResponse con la caja recien abierta.

    Raises:
        HTTPException 400: Si ya existe una caja para esa fecha.
        HTTPException 403: Si carece del permiso `accounting.open_register`.
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
    dependencies=[Depends(require_permission("accounting.view_caja_menor"))],
    responses=AUTHENTICATED,
    operation_id="getTodayCashRegister",
)
async def get_today_register(
    school_id: UUID,
    db: DatabaseSession
):
    """Obtiene o crea la caja diaria del colegio para hoy (Colombia timezone).

    Si no existe caja para hoy, la crea con `opening_balance=0`. La operacion
    hace commit (no requiere accion adicional del cliente para persistir la caja).

    Side effects:
        - Posible insercion en `daily_cash_registers` si no existe la del dia.

    Returns:
        DailyCashRegisterResponse de la caja del dia.

    Raises:
        HTTPException 403: Si carece del permiso `accounting.view_caja_menor`.
    """
    service = DailyCashRegisterService(db)
    register = await service.get_or_create_today(school_id)
    await db.commit()
    return DailyCashRegisterResponse.model_validate(register)


@router.get(
    "/cash-register/{register_date}",
    response_model=DailyCashRegisterResponse,
    dependencies=[Depends(require_permission("accounting.view_cash"))],
    responses=responses(404),
    operation_id="getCashRegisterByDate",
)
async def get_register_by_date(
    school_id: UUID,
    register_date: date,
    db: DatabaseSession
):
    """Recupera la caja diaria del colegio para una fecha exacta.

    A diferencia de `/cash-register/today`, NO crea la caja si no existe.

    Returns:
        DailyCashRegisterResponse de la caja en esa fecha.

    Raises:
        HTTPException 403: Si carece del permiso `accounting.view_cash`.
        HTTPException 404: Si no hay caja para esa fecha.
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
    dependencies=[Depends(require_permission("accounting.close_register"))],
    responses=responses(400, 404),
    operation_id="closeCashRegister",
)
async def close_cash_register(
    school_id: UUID,
    register_id: UUID,
    close_data: DailyCashRegisterClose,
    db: DatabaseSession,
    current_user: CurrentUser
):
    """Cierra una caja diaria abierta y consolida totales del dia.

    Calcula totales agregando `transactions` cuya `transaction_date` coincide
    con `register_date`: income total, expense total, y desglose por metodo
    de pago (cash_income, transfer_income, card_income, credit_sales). Marca
    la caja como cerrada con timestamp y `closed_by`.

    Side effects:
        - Actualiza la fila en `daily_cash_registers`: closing_balance,
          totales calculados, `is_closed=True`, `closed_at`, `closed_by`, `notes`.

    Args:
        close_data: Payload con `closing_balance` (conteo fisico al cerrar) y
            `notes` opcionales.

    Returns:
        DailyCashRegisterResponse con la caja cerrada.

    Raises:
        HTTPException 400: Si la caja ya esta cerrada (`La caja ya esta cerrada`).
        HTTPException 403: Si carece del permiso `accounting.close_register`.
        HTTPException 404: Si la caja no existe o no pertenece al colegio.
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
    dependencies=[Depends(require_permission("accounting.view_cash"))],
    responses=AUTHENTICATED,
    operation_id="getBalanceGeneralSummary",
)
async def get_balance_general_summary(
    school_id: UUID,
    db: DatabaseSession
):
    """Devuelve el balance general resumido del colegio (totales por categoria).

    Suma `net_value` de todas las cuentas activas agrupadas por `account_type`:
    activos (current, fixed, intangible, other), pasivos (current, long, other)
    y patrimonio. Calcula `is_balanced` con tolerancia de 0.01 para redondeos
    (assets ~= liabilities + equity).

    Returns:
        BalanceGeneralSummary con totales y bandera `is_balanced`.

    Raises:
        HTTPException 403: Si carece del permiso `accounting.view_cash`.
    """
    service = BalanceGeneralService(db)
    return await service.get_balance_general_summary(school_id)


@router.get(
    "/balance-general/detailed",
    response_model=BalanceGeneralDetailed,
    dependencies=[Depends(require_permission("accounting.view_cash"))],
    responses=AUTHENTICATED,
    operation_id="getBalanceGeneralDetailed",
)
async def get_balance_general_detailed(
    school_id: UUID,
    db: DatabaseSession
):
    """Devuelve el balance general con desglose cuenta por cuenta.

    A diferencia del summary, retorna la lista completa de cuentas dentro de
    cada grupo (current_assets, fixed_assets, ..., equity[]) con id, name, code
    y `net_value`. Util para reportes contables o vistas de auditoria.

    Returns:
        BalanceGeneralDetailed con grupos de cuentas, totales y `is_balanced`.

    Raises:
        HTTPException 403: Si carece del permiso `accounting.view_cash`.
    """
    service = BalanceGeneralService(db)
    return await service.get_balance_general_detailed(school_id)


@router.get(
    "/receivables-payables/summary",
    response_model=ReceivablesPayablesSummary,
    dependencies=[Depends(require_permission("accounting.view_cash"))],
    responses=AUTHENTICATED,
    operation_id="getReceivablesPayablesSummary",
)
async def get_receivables_payables_summary(
    school_id: UUID,
    db: DatabaseSession
):
    """Resumen de cuentas por cobrar y por pagar del colegio.

    Antes de agregar, recalcula y persiste `is_overdue=True` en CxC y CxP cuyo
    `due_date` ya venció (consulta `current_date` en zona Colombia). Por eso este
    endpoint TIENE side effects de escritura aunque sea un GET.

    Side effects:
        - Actualiza `is_overdue` en filas de `accounts_receivable` y
          `accounts_payable` cuya fecha de vencimiento ya paso.

    Returns:
        ReceivablesPayablesSummary con total/collected/pending/overdue para
        ambos lados y `net_position` (CxC pendientes - CxP pendientes).

    Raises:
        HTTPException 403: Si carece del permiso `accounting.view_cash`.
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
    dependencies=[Depends(require_permission("accounting.view_cash"))],
    responses=responses(400),
    operation_id="createBalanceAccount",
)
async def create_balance_account(
    school_id: UUID,
    account_data: BalanceAccountCreate,
    db: DatabaseSession,
    current_user: CurrentUser
):
    """Crea una cuenta del plan contable (activo, pasivo o patrimonio).

    Para entradas manuales del balance: equipos, prestamos, capital, etc.
    El `balance` inicial NO genera un `BalanceEntry` automatico — si necesita
    rastro auditable use el endpoint `POST /balance-accounts/{id}/entries`
    o el flujo de `set-initial-balance` para Caja/Banco.

    Side effects:
        - Inserta fila en `balance_accounts`.

    Args:
        account_data: Payload con account_type (en minusculas), name, code,
            balance inicial, y campos opcionales de activos fijos
            (original_value, accumulated_depreciation, useful_life_years) o
            pasivos (creditor, interest_rate, due_date). El `school_id` del
            path sobrescribe el del payload.

    Returns:
        BalanceAccountResponse con la cuenta creada.

    Raises:
        HTTPException 400: Si el servicio rechaza el payload (`ValueError`).
        HTTPException 403: Si carece del permiso `accounting.view_cash`.
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
    dependencies=[Depends(require_permission("accounting.view_cash"))],
    responses=AUTHENTICATED,
    operation_id="listBalanceAccounts",
)
async def list_balance_accounts(
    school_id: UUID,
    db: DatabaseSession,
    account_type: AccountType = Query(None, description="Filter by account type"),
    is_active: bool = Query(True, description="Filter by active status")
):
    """Lista las cuentas contables del colegio (no paginado).

    Por defecto retorna solo cuentas activas. Si se pasa `account_type` se
    filtran por tipo (`asset_current`, `asset_fixed`, `liability_current`,
    `liability_long`, `equity`, `income`, `expense`, etc., todos en minusculas).

    Args:
        account_type: Filtra por tipo de cuenta (enum `AccountType`).
        is_active: True por defecto. Si es False, retorna inactivas.

    Returns:
        list[BalanceAccountListResponse] con id, account_type, name, code,
        balance, net_value e is_active.

    Raises:
        HTTPException 403: Si carece del permiso `accounting.view_cash`.
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
    dependencies=[Depends(require_permission("accounting.view_cash"))],
    responses=responses(404),
    operation_id="getBalanceAccount",
)
async def get_balance_account(
    school_id: UUID,
    account_id: UUID,
    db: DatabaseSession
):
    """Recupera una cuenta contable por ID.

    Returns:
        BalanceAccountResponse con todos los campos de la cuenta.

    Raises:
        HTTPException 403: Si carece del permiso `accounting.view_cash`.
        HTTPException 404: Si la cuenta no existe o no pertenece al colegio.
    """
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
    dependencies=[Depends(require_permission("accounting.view_cash"))],
    responses=responses(404),
    operation_id="updateBalanceAccount",
)
async def update_balance_account(
    school_id: UUID,
    account_id: UUID,
    account_data: BalanceAccountUpdate,
    db: DatabaseSession
):
    """Actualiza metadata de una cuenta contable (parcial, exclude_unset).

    Modificar `balance` por aqui NO genera `BalanceEntry` ni rastro auditable —
    usese con cuidado. Para movimientos rastreables, prefiera el endpoint de
    creacion de entries.

    Args:
        account_data: Campos a modificar; los no provistos se preservan.

    Returns:
        BalanceAccountResponse con la cuenta actualizada.

    Raises:
        HTTPException 400: Si el servicio rechaza el cambio (`ValueError`).
        HTTPException 403: Si carece del permiso `accounting.view_cash`.
        HTTPException 404: Si la cuenta no existe o no pertenece al colegio.
    """
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
    dependencies=[Depends(require_permission("accounting.view_cash"))],
    responses=responses(400, 404),
    operation_id="createBalanceEntry",
)
async def create_balance_entry(
    school_id: UUID,
    account_id: UUID,
    entry_data: BalanceEntryCreate,
    db: DatabaseSession,
    current_user: CurrentUser
):
    """Crea un asiento contable manual sobre una cuenta y actualiza su balance.

    El nuevo `balance` de la cuenta queda como `balance_actual + entry.amount`,
    y se guarda `balance_after` en el entry para rastro de auditoria. Usar
    montos positivos para incrementos, negativos para decrementos. NO valida
    saldo negativo a nivel de servicio (a diferencia del flujo via
    `TransactionService` que aplica `chk_balance_account_sign`).

    Side effects:
        - Inserta fila en `balance_entries`.
        - Actualiza `balance` en `balance_accounts`.

    Args:
        entry_data: Payload con entry_date, amount (positivo o negativo),
            description, reference opcional. El `school_id` y `account_id` del
            path sobrescriben los del payload.

    Returns:
        BalanceEntryResponse con el asiento creado y `balance_after`.

    Raises:
        HTTPException 400: Si el servicio rechaza el asiento (`ValueError`,
            p.ej. cuenta inexistente).
        HTTPException 403: Si carece del permiso `accounting.view_cash`.
        HTTPException 404: Aplicable si la cuenta no existe (vendra como 400
            por el `ValueError` del servicio — ver inconsistencia).
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
    response_model=PaginatedResponse[BalanceEntryResponse],
    dependencies=[Depends(require_permission("accounting.view_cash"))],
    responses=responses(404),
    operation_id="listBalanceEntries",
)
async def list_balance_entries(
    school_id: UUID,
    account_id: UUID,
    db: DatabaseSession,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200)
):
    """Lista los asientos contables de una cuenta especifica, paginados.

    Ordenados por `entry_date` desc + `created_at` desc. Util para construir
    extractos contables de la cuenta. NOTA: el limit por defecto es 50, maximo 200.

    Args:
        skip: Offset de paginacion (aplicado en memoria).
        limit: Pagina maxima 200.

    Returns:
        PaginatedResponse[BalanceEntryResponse].

    Raises:
        HTTPException 403: Si carece del permiso `accounting.view_cash`.
    """
    entry_filters = [BalanceEntry.account_id == account_id, BalanceEntry.school_id == school_id]
    total = (await db.execute(select(func.count(BalanceEntry.id)).where(*entry_filters))).scalar_one()

    service = BalanceEntryService(db)
    entries = await service.get_entries_for_account(account_id, school_id, limit + skip)
    entries = entries[skip:skip + limit]

    items = [BalanceEntryResponse.model_validate(e) for e in entries]
    return PaginatedResponse[BalanceEntryResponse](**paginate(items, total, skip, limit))


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
    dependencies=[Depends(require_permission("accounting.manage_receivables"))],
    responses=responses(400),
    operation_id="createReceivable",
)
async def create_receivable(
    school_id: UUID,
    receivable_data: AccountsReceivableCreate,
    db: DatabaseSession,
    current_user: CurrentUser
):
    """Crea una cuenta por cobrar manual (origen distinto a venta o encargo).

    Para registrar deudas de clientes que no provienen del flujo automatico
    de ventas a credito. Las CxC originadas en ventas/encargos se crean por
    sus respectivos servicios (no por aqui).

    Side effects:
        - Inserta fila en `accounts_receivable` con `amount_paid=0,
          is_paid=False`.

    Args:
        receivable_data: Payload con client_id, amount, description,
            invoice_date, due_date, notes y opcionalmente sale_id u order_id si
            se vincula a un movimiento existente.

    Returns:
        AccountsReceivableResponse con la CxC creada.

    Raises:
        HTTPException 400: Si el servicio rechaza el payload (`ValueError`).
        HTTPException 403: Si carece del permiso `accounting.manage_receivables`.
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
    response_model=PaginatedResponse[AccountsReceivableListResponse],
    dependencies=[Depends(require_permission("accounting.view_cash"))],
    responses=AUTHENTICATED,
    operation_id="listReceivables",
)
async def list_receivables(
    school_id: UUID,
    db: DatabaseSession,
    is_paid: bool = Query(None, description="Filter by payment status"),
    is_overdue: bool = Query(None, description="Filter by overdue status"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100)
):
    """Lista CxC del colegio paginadas con detalles de cliente, venta y encargo.

    Carga eagerly las relaciones (`client`, `sale`, `order`, `school`). Cada item
    incluye `origin_type` derivado: `sale` si tiene sale_id, `order` si tiene
    order_id, sino `manual`.

    Args:
        is_paid: Filtra por estado de pago.
        is_overdue: Filtra por estado de vencimiento (no recalcula; usa el flag
            actual — invocar `/receivables-payables/summary` para refrescar).
        skip: Offset de paginacion.
        limit: Pagina maxima 100.

    Returns:
        PaginatedResponse[AccountsReceivableListResponse].

    Raises:
        HTTPException 403: Si carece del permiso `accounting.view_cash`.
    """
    service = AccountsReceivableService(db)

    filters = {}
    if is_paid is not None:
        filters["is_paid"] = is_paid
    if is_overdue is not None:
        filters["is_overdue"] = is_overdue

    total = await service.count(school_id=school_id, filters=filters if filters else None)
    receivables = await service.get_multi_with_client(
        school_id=school_id, skip=skip, limit=limit,
        filters=filters if filters else None
    )

    items = [_build_receivable_list_response(r) for r in receivables]
    return PaginatedResponse[AccountsReceivableListResponse](**paginate(items, total, skip, limit))


@router.get(
    "/receivables/pending",
    response_model=PaginatedResponse[AccountsReceivableListResponse],
    dependencies=[Depends(require_permission("accounting.view_cash"))],
    responses=AUTHENTICATED,
    operation_id="getPendingReceivables",
)
async def get_pending_receivables(
    school_id: UUID,
    db: DatabaseSession,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100)
):
    """Lista CxC pendientes de cobro (`is_paid=False`) ordenadas por vencimiento.

    Equivale a `GET /receivables?is_paid=false` pero ordena por `due_date` asc
    (CxC sin fecha al final). Eager load de cliente, venta, encargo y colegio.

    Args:
        skip: Offset de paginacion (aplicado en memoria).
        limit: Pagina maxima 100.

    Returns:
        PaginatedResponse[AccountsReceivableListResponse] con vencidas primero.

    Raises:
        HTTPException 403: Si carece del permiso `accounting.view_cash`.
    """
    total = (await db.execute(
        select(func.count(AccountsReceivable.id)).where(
            AccountsReceivable.school_id == school_id, AccountsReceivable.is_paid == False
        )
    )).scalar_one()

    service = AccountsReceivableService(db)
    all_pending = await service.get_pending_receivables(school_id)
    receivables = all_pending[skip:skip + limit]

    items = [_build_receivable_list_response(r) for r in receivables]
    return PaginatedResponse[AccountsReceivableListResponse](**paginate(items, total, skip, limit))


@router.get(
    "/receivables/{receivable_id}",
    response_model=AccountsReceivableResponse,
    dependencies=[Depends(require_permission("accounting.view_cash"))],
    responses=responses(404),
    operation_id="getReceivable",
)
async def get_receivable(
    school_id: UUID,
    receivable_id: UUID,
    db: DatabaseSession
):
    """Recupera el detalle de una cuenta por cobrar.

    Returns:
        AccountsReceivableResponse con todos los campos de la CxC.

    Raises:
        HTTPException 403: Si carece del permiso `accounting.view_cash`.
        HTTPException 404: Si la CxC no existe o no pertenece al colegio.
    """
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
    dependencies=[Depends(require_permission("accounting.manage_receivables"))],
    responses=responses(400, 404),
    operation_id="payReceivable",
)
async def pay_receivable(
    school_id: UUID,
    receivable_id: UUID,
    payment: AccountsReceivablePayment,
    db: DatabaseSession,
    current_user: CurrentUser
):
    """Registra el cobro (parcial o total) de una CxC y aplica el credito contable.

    Acumula `amount_paid` y marca `is_paid=True` cuando alcanza `amount`. Crea
    una transaccion `INCOME` con `category='receivables'` que afecta la cuenta
    correspondiente al `payment_method` del pago: cash -> Caja Menor,
    nequi -> Nequi, transfer/card -> Banco.

    Side effects:
        - Actualiza `amount_paid`, `is_paid` en `accounts_receivable`.
        - Inserta fila en `transactions` (type=INCOME, category='receivables').
        - Inserta fila en `balance_entries` y aumenta el balance de la cuenta.

    Args:
        payment: Payload con amount y payment_method.

    Returns:
        AccountsReceivableResponse con `amount_paid` actualizado.

    Raises:
        HTTPException 400: Si el pago excede el saldo pendiente
            (`El pago excede el monto pendiente`).
        HTTPException 403: Si carece del permiso `accounting.manage_receivables`.
        HTTPException 404: Si la CxC no existe o no pertenece al colegio.
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
    dependencies=[Depends(require_permission("accounting.manage_payables"))],
    responses=responses(400),
    operation_id="createPayable",
)
async def create_payable(
    school_id: UUID,
    payable_data: AccountsPayableCreate,
    db: DatabaseSession,
    current_user: CurrentUser
):
    """Crea una cuenta por pagar (deuda con proveedor).

    Side effects:
        - Inserta fila en `accounts_payable` con `amount_paid=0, is_paid=False`.

    Args:
        payable_data: Payload con vendor_id, amount, description, category,
            invoice_number, invoice_date, due_date, notes.

    Returns:
        AccountsPayableResponse con la CxP creada.

    Raises:
        HTTPException 400: Si el servicio rechaza el payload (`ValueError`).
        HTTPException 403: Si carece del permiso `accounting.manage_payables`.
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
    response_model=PaginatedResponse[AccountsPayableListResponse],
    dependencies=[Depends(require_permission("accounting.view_cash"))],
    responses=AUTHENTICATED,
    operation_id="listPayables",
)
async def list_payables(
    school_id: UUID,
    db: DatabaseSession,
    is_paid: bool = Query(None, description="Filter by payment status"),
    is_overdue: bool = Query(None, description="Filter by overdue status"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100)
):
    """Lista cuentas por pagar del colegio paginadas.

    Cada item incluye el `vendor_name` cuando hay proveedor asociado, y el
    `balance` calculado (`amount - amount_paid`).

    Args:
        is_paid: Filtra por estado de pago.
        is_overdue: Filtra por flag de vencimiento (no recalcula).
        skip: Offset de paginacion.
        limit: Pagina maxima 100.

    Returns:
        PaginatedResponse[AccountsPayableListResponse].

    Raises:
        HTTPException 403: Si carece del permiso `accounting.view_cash`.
    """
    service = AccountsPayableService(db)

    filters = {}
    if is_paid is not None:
        filters["is_paid"] = is_paid
    if is_overdue is not None:
        filters["is_overdue"] = is_overdue

    total = await service.count(school_id=school_id, filters=filters if filters else None)
    payables = await service.get_multi(
        school_id=school_id, skip=skip, limit=limit,
        filters=filters if filters else None
    )

    items = [
        AccountsPayableListResponse(
            id=p.id, vendor_id=p.vendor_id, vendor_name=p.vendor.name if p.vendor else "",
            amount=p.amount, amount_paid=p.amount_paid,
            balance=p.balance, description=p.description, category=p.category,
            invoice_number=p.invoice_number, invoice_date=p.invoice_date,
            due_date=p.due_date, is_paid=p.is_paid, is_overdue=p.is_overdue
        )
        for p in payables
    ]
    return PaginatedResponse[AccountsPayableListResponse](**paginate(items, total, skip, limit))


@router.get(
    "/payables/pending",
    response_model=PaginatedResponse[AccountsPayableListResponse],
    dependencies=[Depends(require_permission("accounting.view_cash"))],
    responses=AUTHENTICATED,
    operation_id="getPendingPayables",
)
async def get_pending_payables(
    school_id: UUID,
    db: DatabaseSession,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100)
):
    """Lista CxP pendientes de pago ordenadas por vencimiento.

    Equivale a `GET /payables?is_paid=false` pero ordena por `due_date` asc.

    Args:
        skip: Offset de paginacion (aplicado en memoria).
        limit: Pagina maxima 100.

    Returns:
        PaginatedResponse[AccountsPayableListResponse] con vencidas primero.

    Raises:
        HTTPException 403: Si carece del permiso `accounting.view_cash`.
    """
    total = (await db.execute(
        select(func.count(AccountsPayable.id)).where(
            AccountsPayable.school_id == school_id, AccountsPayable.is_paid == False
        )
    )).scalar_one()

    service = AccountsPayableService(db)
    all_pending = await service.get_pending_payables(school_id)
    payables = all_pending[skip:skip + limit]

    items = [
        AccountsPayableListResponse(
            id=p.id, vendor_id=p.vendor_id, vendor_name=p.vendor.name if p.vendor else "",
            amount=p.amount, amount_paid=p.amount_paid,
            balance=p.balance, description=p.description, category=p.category,
            invoice_number=p.invoice_number, invoice_date=p.invoice_date,
            due_date=p.due_date, is_paid=p.is_paid, is_overdue=p.is_overdue
        )
        for p in payables
    ]
    return PaginatedResponse[AccountsPayableListResponse](**paginate(items, total, skip, limit))


@router.get(
    "/payables/{payable_id}",
    response_model=AccountsPayableResponse,
    dependencies=[Depends(require_permission("accounting.view_cash"))],
    responses=responses(404),
    operation_id="getPayable",
)
async def get_payable(
    school_id: UUID,
    payable_id: UUID,
    db: DatabaseSession
):
    """Recupera el detalle de una cuenta por pagar.

    Returns:
        AccountsPayableResponse con todos los campos de la CxP.

    Raises:
        HTTPException 403: Si carece del permiso `accounting.view_cash`.
        HTTPException 404: Si la CxP no existe o no pertenece al colegio.
    """
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
    dependencies=[Depends(require_permission("accounting.manage_payables"))],
    responses=responses(400, 404),
    operation_id="payPayable",
)
async def pay_payable(
    school_id: UUID,
    payable_id: UUID,
    payment: AccountsPayablePayment,
    db: DatabaseSession,
    current_user: CurrentUser
):
    """Registra el pago (parcial o total) de una CxP y aplica el debito contable.

    Acumula `amount_paid` y marca `is_paid=True` cuando alcanza `amount`. Crea
    una transaccion `EXPENSE` con `category='payables'` que descuenta de la
    cuenta correspondiente al `payment_method`: cash -> Caja Menor,
    nequi -> Nequi, transfer/card -> Banco.

    Side effects:
        - Actualiza `amount_paid`, `is_paid` en `accounts_payable`.
        - Inserta fila en `transactions` (type=EXPENSE, category='payables').
        - Inserta fila en `balance_entries` y descuenta de la cuenta destino.

    Args:
        payment: Payload con amount y payment_method.

    Returns:
        AccountsPayableResponse con `amount_paid` actualizado.

    Raises:
        HTTPException 400: Si el pago excede el saldo pendiente, o si la cuenta
            origen quedaria con saldo negativo (`Fondos insuficientes`).
        HTTPException 403: Si carece del permiso `accounting.manage_payables`.
        HTTPException 404: Si la CxP no existe o no pertenece al colegio.
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
    dependencies=[Depends(require_permission("accounting.view_global_balances"))],
    responses=AUTHENTICATED,
    operation_id="getCashBalances",
)
async def get_cash_balances(
    school_id: UUID,
    db: DatabaseSession
):
    """Devuelve los saldos actuales de las cuentas de efectivo y banco GLOBALES.

    A pesar de estar montado bajo `/schools/{school_id}/accounting/`, este
    endpoint retorna saldos GLOBALES — `BalanceIntegrationService.get_cash_balances`
    ignora el `school_id` y delega en `get_global_cash_balances`. Las cuentas
    Caja Menor (1101), Caja Mayor (1102), Nequi y Banco son unicas para todo
    el negocio.

    Args:
        school_id: Ignorado por el servicio. Se mantiene en la URL por
            compatibilidad con el patron multi-tenant del resto de endpoints.

    Returns:
        Dict con `caja_menor`, `caja_mayor`, `nequi`, `banco`, `total_liquid`
        y `total_cash` (caja_menor + caja_mayor).

    Raises:
        HTTPException 403: Si carece del permiso
            `accounting.view_global_balances`.
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
    dependencies=[Depends(require_permission("accounting.view_caja_menor"))],
    responses=AUTHENTICATED,
    operation_id="getCajaMenorBalance",
)
async def get_caja_menor_balance(
    school_id: UUID,
    db: DatabaseSession
):
    """Devuelve el saldo actual de la Caja Menor (cuenta global, codigo 1101).

    Si la cuenta no existe la crea via `get_or_create_global_accounts` y la
    retorna con saldo 0. La Caja Menor es UNICA y global; `school_id` se
    ignora.

    Side effects:
        - Posible creacion de la cuenta `1101` si no existia.

    Args:
        school_id: Ignorado por el servicio (cuenta es global).

    Returns:
        Dict con id, name, code (1101), balance y last_updated.

    Raises:
        HTTPException 403: Si carece del permiso `accounting.view_caja_menor`.
    """
    from app.services.cash_register import CashRegisterService

    service = CashRegisterService(db)
    return await service.get_caja_menor_balance()


@router.get(
    "/caja-menor/summary",
    dependencies=[Depends(require_permission("accounting.view_caja_menor"))],
    responses=AUTHENTICATED,
    operation_id="getCajaMenorSummary",
)
async def get_caja_menor_summary(
    school_id: UUID,
    db: DatabaseSession
):
    """Resumen del dia para Caja Menor: saldos, liquidaciones y movimientos.

    Suma todas las liquidaciones (`reference LIKE 'LIQ-%'`) del dia y cuenta
    el numero total de entries en Caja Menor para hoy. Util para el dashboard
    operativo del vendedor.

    Args:
        school_id: Ignorado por el servicio (cuentas son globales).

    Returns:
        Dict con caja_menor_balance, caja_mayor_balance, today_liquidations,
        today_entries_count y `date` (hoy en zona Colombia).

    Raises:
        HTTPException 403: Si carece del permiso `accounting.view_caja_menor`.
    """
    from app.services.cash_register import CashRegisterService

    service = CashRegisterService(db)
    return await service.get_today_summary()


@router.post(
    "/caja-menor/liquidate",
    responses=responses(400),
    operation_id="liquidateCajaMenor",
)
async def liquidate_caja_menor(
    school_id: UUID,
    amount: float,
    db: DatabaseSession,
    current_user: CurrentUser,
    constraints: dict = Depends(require_permission_with_constraints("accounting.liquidate_caja_menor")),
    notes: str | None = None
):
    """Transfiere efectivo desde Caja Menor a Caja Mayor (liquidacion de cierre).

    Crea dos `BalanceEntry` espejo (negativo en Caja Menor, positivo en Caja
    Mayor) con el mismo `reference` (`LIQ-<timestamp>`). Las entries se
    registran como globales (`school_id=None`) — no se atan al colegio del path.
    El permiso aplica una restriccion `max_amount` por rol: Admin tipicamente
    5M COP, Owner sin limite. Si excede el limite y el rol requiere aprobacion,
    retorna `403 REQUIRES_APPROVAL` con detalle estructurado.

    Side effects:
        - Resta `amount` del balance de Caja Menor (1101) e inserta un
          `BalanceEntry` con monto negativo.
        - Suma `amount` al balance de Caja Mayor (1102) e inserta el entry
          espejo positivo.

    Args:
        amount: Monto a liquidar en COP. Debe ser > 0 y <= saldo de Caja Menor.
        notes: Notas opcionales que se prefijan en la descripcion de los entries.

    Returns:
        Dict con success, message, nuevos balances de ambas cuentas,
        amount_liquidated, y los entries `entry_from`/`entry_to`.

    Raises:
        HTTPException 400: Si `amount <= 0`, si excede el saldo disponible,
            o si las cuentas globales no se pueden crear/encontrar.
        HTTPException 403: Si carece del permiso
            `accounting.liquidate_caja_menor`, o si el monto supera la
            restriccion `max_amount` del rol.
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
    dependencies=[Depends(require_permission("accounting.view_liquidation_history"))],
    responses=AUTHENTICATED,
    operation_id="getLiquidationHistory",
)
async def get_liquidation_history(
    school_id: UUID,
    db: DatabaseSession,
    start_date: date = Query(None, description="Start date filter"),
    end_date: date = Query(None, description="End date filter"),
    limit: int = Query(50, ge=1, le=200)
):
    """Lista las liquidaciones historicas (entries en Caja Mayor con `LIQ-*`).

    Filtra los `BalanceEntry` de Caja Mayor cuyo `reference` empieza con `LIQ-`
    y `amount > 0` (solo el lado de ingreso). Ordenados por `created_at` desc.
    Las liquidaciones son globales — `school_id` se ignora.

    Args:
        start_date: Filtro inferior por `entry_date` (opcional, inclusivo).
        end_date: Filtro superior por `entry_date` (opcional, inclusivo).
        limit: Maximo de registros (default 50, max 200).

    Returns:
        list[dict] con id, date, amount, balance_after, description, reference,
        created_at por cada liquidacion.

    Raises:
        HTTPException 403: Si carece del permiso
            `accounting.view_liquidation_history`.
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
    dependencies=[Depends(require_permission("accounting.view_cash"))],
    responses=AUTHENTICATED,
    operation_id="initializeDefaultAccounts",
)
async def initialize_default_accounts(
    school_id: UUID,
    db: DatabaseSession,
    current_user: CurrentUser,
    caja_initial_balance: float = 0,
    banco_initial_balance: float = 0
):
    """Inicializa el plan de cuentas por defecto (Caja Menor/Mayor, Nequi, Banco).

    Operacion idempotente: si las cuentas globales ya existen, no las duplica
    (este endpoint redirige al flujo global a pesar del path por colegio).
    Util para setup inicial o recuperacion. Crea `BalanceEntry` "Saldo inicial"
    cuando los balances iniciales son distintos de 0.

    Side effects:
        - Posibles inserciones en `balance_accounts` (Caja Menor 1101,
          Caja Mayor 1102, Nequi, Banco) con `school_id=None`.
        - Posibles inserciones de entries iniciales en `balance_entries`.

    Args:
        school_id: Ignorado por el servicio (cuentas son globales).
        caja_initial_balance: Saldo inicial de Caja (aplica a Caja Mayor en el
            flujo global, default 0).
        banco_initial_balance: Saldo inicial de Banco (default 0).

    Returns:
        Dict con `message` y `accounts` (mapping de account_key -> UUID).

    Raises:
        HTTPException 403: Si carece del permiso `accounting.view_cash`.
        HTTPException 500: Si la inicializacion falla por cualquier motivo
            (loggea el error original como detail).
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
    dependencies=[Depends(require_permission("accounting.view_cash"))],
    responses=AUTHENTICATED,
    operation_id="getPatrimonySummary",
)
async def get_patrimony_summary(
    school_id: UUID,
    db: DatabaseSession
):
    """Calcula el patrimonio neto del colegio: ASSETS - LIABILITIES.

    Agrega:
    - Activos: Caja + Banco, valor de inventario (cost o price*0.80 fallback),
      cuentas por cobrar, activos fijos.
    - Pasivos: cuentas por pagar a proveedores, deudas (prestamos, creditos).

    Solo lectura — calcula totales en runtime sin escribir en BD.

    Returns:
        Dict con desglose completo y `net_patrimony` (assets - liabilities).

    Raises:
        HTTPException 403: Si carece del permiso `accounting.view_cash`.
    """
    from app.services.patrimony import PatrimonyService

    service = PatrimonyService(db)
    return await service.get_patrimony_summary(school_id)


@router.get(
    "/patrimony/inventory-valuation",
    dependencies=[Depends(require_permission("accounting.view_cash"))],
    responses=AUTHENTICATED,
    operation_id="getInventoryValuation",
)
async def get_inventory_valuation(
    school_id: UUID,
    db: DatabaseSession
):
    """Valoriza el inventario actual del colegio producto por producto.

    Aplica fallback: usa `product.cost` si esta definido, sino `price * 0.80`
    (asume margen del 20%). El total se basa en `inventory.quantity` por talla.
    Solo lectura.

    Returns:
        Dict con breakdown por producto (cantidades, valor unitario, valor total)
        y `total_value` agregado.

    Raises:
        HTTPException 403: Si carece del permiso `accounting.view_cash`.
    """
    from app.services.patrimony import PatrimonyService

    service = PatrimonyService(db)
    return await service.get_inventory_valuation(school_id)


@router.post(
    "/patrimony/set-initial-balance",
    dependencies=[Depends(require_permission("accounting.view_cash"))],
    responses=responses(400, 404),
    operation_id="setInitialBalance",
)
async def set_initial_balance(
    school_id: UUID,
    account_code: str,  # "1101" for Caja, "1102" for Banco
    initial_balance: float,
    db: DatabaseSession,
    current_user: CurrentUser
):
    """Establece el saldo inicial de una cuenta del colegio (Caja/Banco).

    Calcula la diferencia entre el balance actual y `initial_balance` y crea
    un `BalanceEntry` de ajuste con `reference='INICIAL'` y descripcion "Ajuste
    de saldo inicial". Si la diferencia es 0, no hace nada. Esta operacion
    busca la cuenta por `school_id + code`, por lo que afecta la cuenta del
    colegio (no la global) — usar para setup inicial cuando se migra desde
    sistemas previos.

    Side effects:
        - Actualiza `balance` en `balance_accounts`.
        - Inserta `BalanceEntry` con monto = diferencia.

    Args:
        account_code: `"1101"` para Caja, `"1102"` para Banco. Otros codigos
            si la cuenta existe en el plan del colegio.
        initial_balance: Nuevo saldo objetivo.

    Returns:
        Dict con message, account_id, account_name y new_balance.

    Raises:
        HTTPException 400: Si la cuenta no se encuentra (ValueError del servicio).
        HTTPException 403: Si carece del permiso `accounting.view_cash`.
        HTTPException 404: Documentado pero el servicio levanta `ValueError`,
            por lo que en la practica retorna 400.
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
    dependencies=[Depends(require_permission("accounting.view_cash"))],
    responses=responses(400),
    operation_id="createDebt",
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
    """Registra una deuda como cuenta del balance (pasivo).

    Crea una `BalanceAccount` de tipo `liability_long` o `liability_current`
    segun `is_long_term`, con el monto inicial como `balance`. Util para
    cargar deudas existentes al migrar al sistema.

    Side effects:
        - Inserta fila en `balance_accounts` con account_type pasivo.

    Args:
        name: Identificador legible (ej. "Prestamo Bancolombia").
        amount: Monto total de la deuda.
        creditor: Acreedor.
        is_long_term: True para pasivo a largo plazo (> 1 año),
            False para pasivo corriente.
        interest_rate: Tasa anual opcional.
        due_date: Vencimiento opcional.
        description: Notas opcionales.

    Returns:
        Dict con message, debt_id, name, amount, creditor, is_long_term.

    Raises:
        HTTPException 400: Si el servicio falla por cualquier motivo (atrapa
            cualquier `Exception`, lo que enmascara errores 500 reales —
            ver inconsistencia).
        HTTPException 403: Si carece del permiso `accounting.view_cash`.
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
    dependencies=[Depends(require_permission("accounting.view_cash"))],
    responses=AUTHENTICATED,
    operation_id="listDebts",
)
async def list_debts(
    school_id: UUID,
    db: DatabaseSession
):
    """Lista todas las deudas registradas del colegio.

    Returns:
        Dict con la lista de deudas y totales agregados (total_amount,
        breakdown por tipo: long_term vs current).

    Raises:
        HTTPException 403: Si carece del permiso `accounting.view_cash`.
    """
    from app.services.patrimony import PatrimonyService

    service = PatrimonyService(db)
    return await service.get_debts(school_id)


@router.post(
    "/patrimony/fixed-assets",
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission("accounting.view_cash"))],
    responses=responses(400),
    operation_id="createFixedAsset",
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
    """Registra un activo fijo (equipo, maquinaria, mobiliario) en el balance.

    Crea una `BalanceAccount` de tipo `asset_fixed` con `original_value=value`,
    `accumulated_depreciation=0`, y `balance=value`. La depreciacion se calcula
    posteriormente en otros flujos a partir de `useful_life_years`.

    Side effects:
        - Inserta fila en `balance_accounts` con account_type=`asset_fixed`.

    Args:
        name: Identificador del activo (ej. "Maquina de coser industrial").
        value: Valor actual.
        description: Notas opcionales.
        useful_life_years: Vida util en años para calculo de depreciacion.

    Returns:
        Dict con message, asset_id, name y value.

    Raises:
        HTTPException 400: Si el servicio falla por cualquier motivo (atrapa
            cualquier `Exception`).
        HTTPException 403: Si carece del permiso `accounting.view_cash`.
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
    dependencies=[Depends(require_permission("accounting.view_cash"))],
    responses=AUTHENTICATED,
    operation_id="listFixedAssets",
)
async def list_fixed_assets(
    school_id: UUID,
    db: DatabaseSession
):
    """Lista todos los activos fijos del colegio.

    Returns:
        Dict con la lista de activos y totales (valor original, depreciacion
        acumulada, valor neto).

    Raises:
        HTTPException 403: Si carece del permiso `accounting.view_cash`.
    """
    from app.services.patrimony import PatrimonyService

    service = PatrimonyService(db)
    return await service.get_fixed_assets(school_id)
