"""
Alterations (Arreglos) API Routes

GLOBAL module - operates business-wide like accounting.

Authorization model:
- Router-level: ``alterations.view`` (lectura).
- Endpoints mutadores declaran permisos granulares por verbo:
  ``alterations.create``, ``alterations.edit``,
  ``alterations.change_status``, ``alterations.add_payment``.
- La asignación de permisos a roles/usuarios vive en la
  configuración (``SYSTEM_ROLE_PERMISSIONS``, custom roles,
  permission overrides) — no se hardcodea aquí.

Endpoints:
- GET /global/alterations - List alterations with filters
- GET /global/alterations/summary - Dashboard statistics
- GET /global/alterations/{id} - Get alteration with payments
- GET /global/alterations/code/{code} - Find by code
- GET /global/alterations/{id}/payments - List payments
- POST /global/alterations - Create new alteration                 (alterations.create)
- PATCH /global/alterations/{id} - Update alteration               (alterations.edit)
- PATCH /global/alterations/{id}/status - Update status only       (alterations.change_status)
- POST /global/alterations/{id}/pay - Record payment               (alterations.add_payment)
- DELETE /global/alterations/{id} - Cancel alteration              (alterations.change_status)
"""
from uuid import UUID
from datetime import date
from fastapi import APIRouter, HTTPException, status, Query, Depends

from sqlalchemy import select, func, or_

from app.api.dependencies import (
    DatabaseSession,
    CurrentUser,
    require_global_permission,
)
from app.api.error_responses import responses, AUTHENTICATED
from app.models.alteration import Alteration, AlterationType, AlterationStatus
from app.schemas.alteration import (
    AlterationCreate,
    AlterationUpdate,
    AlterationResponse,
    AlterationListResponse,
    AlterationWithPayments,
    AlterationPaymentCreate,
    AlterationPaymentResponse,
    AlterationsSummary,
    AlterationStatusUpdate
)
from app.schemas.base import PaginatedResponse
from app.services.alteration import AlterationService
from app.services.permission import PermissionService


router = APIRouter(
    prefix="/global/alterations",
    tags=["Global Alterations"],
    dependencies=[Depends(require_global_permission("alterations.view"))]
)


# ============================================
# List and Search
# ============================================

@router.get(
    "",
    response_model=PaginatedResponse[AlterationListResponse],
    summary="List alterations",
    description="List all alterations with optional filters",
    responses=AUTHENTICATED,
    operation_id="listAlterations",
)
async def list_alterations(
    db: DatabaseSession,
    current_user: CurrentUser,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    status: AlterationStatus | None = Query(None, description="Filter by status"),
    alteration_type: AlterationType | None = Query(None, alias="type", description="Filter by type"),
    search: str | None = Query(None, description="Search in code, garment, client"),
    start_date: date | None = Query(None, description="Filter by received_date >= start_date"),
    end_date: date | None = Query(None, description="Filter by received_date <= end_date"),
    is_paid: bool | None = Query(None, description="Filter by payment status"),
    client_id: UUID | None = Query(None, description="Filter by registered client ID")
):
    """Lista arreglos paginados aplicando filtros opcionales combinables.

    Devuelve un `PaginatedResponse` ordenado por `created_at` descendente
    (orden definido en el servicio). El filtro `is_paid` compara `amount_paid`
    contra `cost`: `True` exige saldo cero, `False` exige saldo pendiente.
    El filtro `search` aplica `ILIKE` sobre `code`, `garment_name`,
    `description` y el nombre del cliente registrado asociado.

    Args:
        db: Sesion asincrona inyectada.
        current_user: Usuario autenticado (staff).
        skip: Offset de paginacion (>= 0).
        limit: Tamano de pagina (1-100).
        status: Filtra por estado del arreglo.
        alteration_type: Filtra por tipo de arreglo (alias de query `type`).
        search: Termino de busqueda parcial sobre codigo/prenda/cliente/descripcion.
        start_date: Cota inferior inclusiva sobre `received_date`.
        end_date: Cota superior inclusiva sobre `received_date`.
        is_paid: Si `True` solo arreglos totalmente pagados; si `False` con saldo.

    Returns:
        PaginatedResponse[AlterationListResponse]: Items con saldo y estado de pago calculados.

    Auth:
        Bearer JWT (staff). Permiso global `alterations.view` aplicado a nivel de router.
    """
    service = AlterationService(db)
    filter_kwargs = dict(
        status=status, alteration_type=alteration_type,
        search=search, start_date=start_date, end_date=end_date,
        is_paid=is_paid, client_id=client_id,
    )
    total = await service.count(**filter_kwargs)
    alterations = await service.list(skip=skip, limit=limit, **filter_kwargs)

    items = [
        AlterationListResponse(
            id=a.id,
            code=a.code,
            client_display_name=a.client_display_name,
            alteration_type=a.alteration_type,
            garment_name=a.garment_name,
            cost=a.cost,
            amount_paid=a.amount_paid,
            balance=a.balance,
            status=a.status,
            received_date=a.received_date,
            estimated_delivery_date=a.estimated_delivery_date,
            is_paid=a.is_paid
        )
        for a in alterations
    ]
    return PaginatedResponse[AlterationListResponse](
        items=items, total=total, skip=skip, limit=limit
    )


@router.get(
    "/summary",
    response_model=AlterationsSummary,
    summary="Get alterations summary",
    description="Get summary statistics for the alterations dashboard",
    responses=AUTHENTICATED,
    operation_id="getAlterationsSummary",
)
async def get_summary(
    db: DatabaseSession,
    current_user: CurrentUser
):
    """Obtiene el resumen agregado del modulo de arreglos para el dashboard.

    Calcula totales globales: conteo por cada estado de `AlterationStatus`,
    `total_revenue` (suma de `amount_paid` de todos los arreglos),
    `total_pending_payment` (suma del saldo pendiente excluyendo cancelados)
    y conteos del dia (`received_date == hoy`, `delivered_date == hoy`)
    usando la fecha de Colombia.

    Los campos financieros (`total_revenue`, `total_pending_payment`) se
    devuelven como `null` cuando el usuario no tiene `alterations.view_revenue`
    en ningun colegio. Los conteos siguen visibles porque son informacion
    operativa, no monetaria.

    Args:
        db: Sesion asincrona inyectada.
        current_user: Usuario autenticado (staff).

    Returns:
        AlterationsSummary: Conteos por estado, metricas del dia, e ingresos
        agregados solo si el caller tiene permiso para verlos.

    Auth:
        Bearer JWT (staff). Permiso global `alterations.view` aplicado a nivel
        de router. Permiso adicional `alterations.view_revenue` requerido para
        ver montos agregados.
    """
    permission_service = PermissionService(db)
    include_financials = await permission_service.has_global_permission(
        current_user, "alterations.view_revenue"
    )

    service = AlterationService(db)
    return await service.get_summary(include_financials=include_financials)


# ============================================
# Get Single Alteration
# ============================================

@router.get(
    "/code/{code}",
    response_model=AlterationWithPayments,
    summary="Get alteration by code",
    description="Find an alteration by its code (e.g., ARR-2026-0001)",
    responses=responses(404),
    operation_id="getAlterationByCode",
)
async def get_by_code(
    code: str,
    db: DatabaseSession,
    current_user: CurrentUser
):
    """Recupera un arreglo por su codigo legible junto con el historial de pagos.

    El codigo sigue el formato `ARR-YYYY-NNNN`. Internamente realiza dos
    consultas: la primera resuelve el codigo a un id y la segunda recarga el
    arreglo con `payments` y `client` precargados via `selectinload`.

    Args:
        code: Codigo unico del arreglo (formato `ARR-YYYY-NNNN`).
        db: Sesion asincrona inyectada.
        current_user: Usuario autenticado (staff).

    Returns:
        AlterationWithPayments: Arreglo con su historial completo de pagos.

    Raises:
        HTTPException: 404 si no existe ningun arreglo con ese codigo.

    Auth:
        Bearer JWT (staff). Permiso global `alterations.view` aplicado a nivel de router.
    """
    service = AlterationService(db)
    alteration = await service.get_by_code(code)

    if not alteration:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Alteration with code '{code}' not found"
        )

    # Load payments
    alteration = await service.get_with_payments(alteration.id)
    return alteration


@router.get(
    "/{alteration_id}",
    response_model=AlterationWithPayments,
    summary="Get alteration by ID",
    description="Get alteration details with payment history",
    responses=responses(404),
    operation_id="getAlteration",
)
async def get_alteration(
    alteration_id: UUID,
    db: DatabaseSession,
    current_user: CurrentUser
):
    """Recupera un arreglo por su UUID con su historial de pagos cargado.

    Args:
        alteration_id: Identificador UUID del arreglo.
        db: Sesion asincrona inyectada.
        current_user: Usuario autenticado (staff).

    Returns:
        AlterationWithPayments: Arreglo con relacion `payments` y `client` precargadas.

    Raises:
        HTTPException: 404 si el arreglo no existe.

    Auth:
        Bearer JWT (staff). Permiso global `alterations.view` aplicado a nivel de router.
    """
    service = AlterationService(db)
    alteration = await service.get_with_payments(alteration_id)

    if not alteration:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Alteration not found"
        )

    return alteration


# ============================================
# Create and Update
# ============================================

@router.post(
    "",
    response_model=AlterationResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create alteration",
    description="Create a new alteration with optional initial payment",
    dependencies=[Depends(require_global_permission("alterations.create"))],
    responses=responses(400),
    operation_id="createAlteration",
)
async def create_alteration(
    data: AlterationCreate,
    db: DatabaseSession,
    current_user: CurrentUser
):
    """Crea un nuevo arreglo con codigo autogenerado y pago inicial opcional.

    El servicio genera el codigo `ARR-YYYY-NNNN` segun el ano en zona Colombia
    y la cantidad de arreglos previos del ano. El arreglo se crea siempre en
    estado `PENDING` con `amount_paid = 0`. Si el payload incluye
    `initial_payment` y `initial_payment_method`, se registra el pago inicial
    con `apply_accounting=True`, lo que ademas crea una `Transaction` de tipo
    `INCOME` (categoria `alterations`) afectando la cuenta global del metodo
    de pago utilizado. Confirma la transaccion antes de retornar.

    Args:
        data: Payload con datos del arreglo y pago inicial opcional.
        db: Sesion asincrona inyectada.
        current_user: Usuario autenticado; se persiste como `created_by`.

    Returns:
        AlterationResponse: Arreglo recien creado.

    Raises:
        HTTPException: 400 si el servicio rechaza los datos (p. ej. pago
            inicial mayor al costo).

    Side Effects:
        - Inserta una fila en `alterations` con codigo unico autogenerado.
        - Si hay pago inicial: inserta en `alteration_payments`, crea
          `Transaction(INCOME, category='alterations')` y actualiza la cuenta
          global del metodo de pago seleccionado.
        - `await db.commit()` confirma la transaccion completa.

    Auth:
        Bearer JWT (staff). Permiso global `alterations.view` aplicado a nivel de router.
    """
    service = AlterationService(db)

    try:
        alteration = await service.create(
            data=data,
            created_by=current_user.id
        )
        await db.commit()
        return alteration
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.patch(
    "/{alteration_id}",
    response_model=AlterationResponse,
    summary="Update alteration",
    description="Update alteration details",
    dependencies=[Depends(require_global_permission("alterations.edit"))],
    responses=responses(404),
    operation_id="updateAlteration",
)
async def update_alteration(
    alteration_id: UUID,
    data: AlterationUpdate,
    db: DatabaseSession,
    current_user: CurrentUser
):
    """Actualiza campos parciales de un arreglo existente.

    Solo se aplican los campos enviados (`exclude_unset=True`). Si el payload
    incluye `status == DELIVERED` y el arreglo aun no tiene `delivered_date`,
    el servicio lo establece automaticamente en la fecha actual de Colombia.
    `updated_at` se refresca por `onupdate`. No mueve dinero ni toca contabilidad.

    Args:
        alteration_id: Identificador UUID del arreglo a modificar.
        data: Campos a actualizar (todos opcionales).
        db: Sesion asincrona inyectada.
        current_user: Usuario autenticado (staff).

    Returns:
        AlterationResponse: Arreglo con los cambios persistidos.

    Raises:
        HTTPException: 404 si el arreglo no existe.

    Side Effects:
        - Sobrescribe los campos enviados en `alterations`.
        - Puede setear `delivered_date` automaticamente al pasar a DELIVERED.
        - `await db.commit()` confirma la transaccion.

    Auth:
        Bearer JWT (staff). Permiso global `alterations.view` aplicado a nivel de router.
    """
    service = AlterationService(db)
    alteration = await service.update(alteration_id, data)

    if not alteration:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Alteration not found"
        )

    await db.commit()
    return alteration


@router.patch(
    "/{alteration_id}/status",
    response_model=AlterationResponse,
    summary="Update status",
    description="Update alteration status only",
    dependencies=[Depends(require_global_permission("alterations.change_status"))],
    responses=responses(404),
    operation_id="updateAlterationStatus",
)
async def update_status(
    alteration_id: UUID,
    data: AlterationStatusUpdate,
    db: DatabaseSession,
    current_user: CurrentUser
):
    """Cambia unicamente el estado de un arreglo (`PENDING`, `IN_PROGRESS`, `READY`, `DELIVERED`, `CANCELLED`).

    Endpoint pensado para transiciones rapidas desde el dashboard. El servicio
    no impone una maquina de estados: cualquier transicion es aceptada. Si el
    nuevo estado es `DELIVERED`, el servicio asigna `delivered_date` con la
    fecha actual de Colombia (sobrescribiendo si ya existia, a diferencia del
    update parcial general).

    Args:
        alteration_id: Identificador UUID del arreglo.
        data: Payload con el nuevo estado.
        db: Sesion asincrona inyectada.
        current_user: Usuario autenticado (staff).

    Returns:
        AlterationResponse: Arreglo con el estado actualizado.

    Raises:
        HTTPException: 404 si el arreglo no existe.

    Side Effects:
        - Actualiza `status` (y `delivered_date` cuando aplica) en `alterations`.
        - `await db.commit()` confirma la transaccion.

    Auth:
        Bearer JWT (staff). Permiso global `alterations.view` aplicado a nivel de router.
    """
    service = AlterationService(db)
    alteration = await service.update_status(alteration_id, data.status)

    if not alteration:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Alteration not found"
        )

    await db.commit()
    return alteration


# ============================================
# Payments
# ============================================

@router.post(
    "/{alteration_id}/pay",
    response_model=AlterationPaymentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Record payment",
    description="Record a payment for an alteration",
    dependencies=[Depends(require_global_permission("alterations.add_payment"))],
    responses=responses(400, 404),
    operation_id="createAlterationPayment",
)
async def record_payment(
    alteration_id: UUID,
    data: AlterationPaymentCreate,
    db: DatabaseSession,
    current_user: CurrentUser
):
    """Registra un pago (parcial o total) sobre un arreglo y opcionalmente lo refleja en contabilidad.

    Valida que el monto no exceda el saldo pendiente (`cost - amount_paid`).
    Para pagos en efectivo (`cash`), si se envia `amount_received` debe ser
    >= `amount` y se calcula `change_given` (vueltas) automaticamente.
    Si `apply_accounting=True` (y `amount > 0`), crea una `Transaction` de
    tipo `INCOME` con categoria `alterations`, mapea el `payment_method`
    string al enum contable via `PAYMENT_METHOD_MAP` (default `CASH`),
    afecta la cuenta contable global correspondiente y guarda el
    `transaction_id` en el pago. Finalmente incrementa `amount_paid` del arreglo.

    Args:
        alteration_id: UUID del arreglo a pagar.
        data: Monto, metodo de pago, notas, flag `apply_accounting` y opcional `amount_received`.
        db: Sesion asincrona inyectada.
        current_user: Usuario autenticado; se persiste como `created_by` y se devuelve como `created_by_username`.

    Returns:
        AlterationPaymentResponse: Pago creado, incluyendo `transaction_id` cuando hubo integracion contable.

    Raises:
        HTTPException: 400 si el arreglo no existe (mensaje "Arreglo no encontrado"),
            si el pago excede el saldo pendiente, o si `amount_received` es menor al `amount`.
        HTTPException: 404 declarada en el contrato pero el servicio devuelve 400 al no hallar el arreglo.

    Side Effects:
        - Inserta fila en `alteration_payments`.
        - Incrementa `alterations.amount_paid` (puede llevar el arreglo a estado pagado).
        - Si `apply_accounting=True`: crea `Transaction(INCOME, category='alterations',
          reference_code=<codigo>, alteration_id=<id>)` y mueve el saldo de la
          cuenta contable global asociada al metodo de pago.
        - `await db.commit()` confirma la transaccion completa.

    Auth:
        Bearer JWT (staff). Permiso global `alterations.view` aplicado a nivel de router.
    """
    service = AlterationService(db)

    try:
        payment = await service.record_payment(
            alteration_id=alteration_id,
            data=data,
            created_by=current_user.id
        )
        await db.commit()

        return AlterationPaymentResponse(
            id=payment.id,
            alteration_id=payment.alteration_id,
            amount=payment.amount,
            payment_method=payment.payment_method,
            notes=payment.notes,
            transaction_id=payment.transaction_id,
            created_by=payment.created_by,
            created_at=payment.created_at,
            created_by_username=current_user.username
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get(
    "/{alteration_id}/payments",
    response_model=PaginatedResponse[AlterationPaymentResponse],
    summary="Get payments",
    description="Get payment history for an alteration",
    responses=responses(404),
    operation_id="listAlterationPayments",
)
async def get_payments(
    alteration_id: UUID,
    db: DatabaseSession,
    current_user: CurrentUser,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
):
    """Lista paginada de pagos de un arreglo, ordenados por fecha de creacion descendente.

    Verifica primero la existencia del arreglo. La paginacion se aplica en
    memoria sobre la lista completa de pagos del arreglo (no es un slice SQL),
    por lo que el costo es lineal en cantidad de pagos.

    Args:
        alteration_id: UUID del arreglo.
        db: Sesion asincrona inyectada.
        current_user: Usuario autenticado (staff).
        skip: Offset de paginacion (>= 0).
        limit: Tamano de pagina (1-100).

    Returns:
        PaginatedResponse[AlterationPaymentResponse]: Pagos del arreglo paginados.

    Raises:
        HTTPException: 404 si el arreglo no existe.

    Auth:
        Bearer JWT (staff). Permiso global `alterations.view` aplicado a nivel de router.
    """
    service = AlterationService(db)

    alteration = await service.get(alteration_id)
    if not alteration:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Alteration not found"
        )

    payments = await service.get_payments(alteration_id)
    total = len(payments)
    items = payments[skip:skip + limit]
    return PaginatedResponse[AlterationPaymentResponse](
        items=items, total=total, skip=skip, limit=limit
    )


# ============================================
# Cancel
# ============================================

@router.delete(
    "/{alteration_id}",
    response_model=AlterationResponse,
    summary="Cancel alteration",
    description="Cancel an alteration (only if no payments recorded)",
    dependencies=[Depends(require_global_permission("alterations.change_status"))],
    responses=responses(400, 404),
    operation_id="cancelAlteration",
)
async def cancel_alteration(
    alteration_id: UUID,
    db: DatabaseSession,
    current_user: CurrentUser
):
    """Cancela un arreglo marcandolo como `CANCELLED` (solo si no tiene pagos registrados).

    No es un borrado fisico: el registro permanece en la BD con estado
    `CANCELLED`. Si el arreglo ya tiene `amount_paid > 0`, el servicio rechaza
    la operacion y exige reversar los pagos primero (no existe endpoint
    automatico para esa reversion contable, debe hacerse manualmente).

    Args:
        alteration_id: UUID del arreglo a cancelar.
        db: Sesion asincrona inyectada.
        current_user: Usuario autenticado (staff).

    Returns:
        AlterationResponse: Arreglo con estado `CANCELLED`.

    Raises:
        HTTPException: 400 si el arreglo tiene pagos registrados.
        HTTPException: 404 si el arreglo no existe.

    Side Effects:
        - Actualiza `status` a `CANCELLED` en `alterations`.
        - No revierte pagos ni asientos contables (no aplicaria porque exige `amount_paid == 0`).
        - `await db.commit()` confirma la transaccion.

    Auth:
        Bearer JWT (staff). Permiso global `alterations.view` aplicado a nivel de router.
    """
    service = AlterationService(db)

    try:
        alteration = await service.cancel(alteration_id)

        if not alteration:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Alteration not found"
            )

        await db.commit()
        return alteration
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
