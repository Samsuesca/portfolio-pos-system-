"""
Payment Gateway Routes - Wompi Integration

Endpoints:
- POST /payments/sessions       - Create payment session (authenticated client)
- POST /payments/webhooks/wompi - Receive Wompi webhook (public, signature-validated)
- GET  /payments/status/{ref}   - Check payment status (authenticated)
- GET  /payments/config         - Get public Wompi config (public)
"""
import logging
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.core.config import settings
from app.core.limiter import limiter
from app.api.dependencies import CurrentPortalClient, CurrentSuperuser
from app.services.wompi import WompiService
from app.schemas.payment_transaction import (
    PaymentSessionCreate,
    PaymentSessionResponse,
    PaymentStatusResponse,
    PaymentTransactionResponse,
)
from app.schemas.base import PaginatedResponse, paginate

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/payments", tags=["Payments"])


async def _resolve_payment_owner_id(
    db: AsyncSession, payment
) -> UUID | None:
    """Resuelve el ``client_id`` dueño de un ``PaymentTransaction``.

    Sigue la cadena ``payment.client_id`` -> ``order.client_id`` ->
    ``receivable.client_id``. El primer eslabón presente gana.

    Returns:
        UUID del cliente dueño, o ``None`` si no se puede determinar
        (pago huérfano sin client_id, order_id ni receivable_id).
    """
    if payment.client_id is not None:
        return payment.client_id

    if payment.order_id is not None:
        from app.models.order import Order
        result = await db.execute(
            select(Order.client_id).where(Order.id == payment.order_id)
        )
        owner = result.scalar_one_or_none()
        if owner is not None:
            return owner

    if payment.receivable_id is not None:
        from app.models.accounting import AccountsReceivable
        result = await db.execute(
            select(AccountsReceivable.client_id).where(
                AccountsReceivable.id == payment.receivable_id
            )
        )
        return result.scalar_one_or_none()

    return None


@router.get("/config", operation_id="getPaymentConfig")
async def get_payment_config():
    """Expone la configuración pública de Wompi al frontend.

    Endpoint público sin autenticación. Solo retorna información que
    puede vivir en el bundle del cliente (llave pública y entorno);
    nunca expone llaves privadas, de integridad, ni de eventos.

    El frontend usa esta respuesta para decidir si renderiza el botón
    de pago en línea y para inicializar el widget de Wompi con la
    llave pública correcta del entorno (sandbox/producción).

    Returns:
        dict: Diccionario con claves:
            - ``enabled`` (bool): ``True`` si ``WOMPI_ENABLED`` está activo.
            - ``public_key`` (str | None): Llave pública de Wompi cuando
              está habilitado, ``None`` en caso contrario.
            - ``environment`` (str | None): ``"sandbox"`` o ``"production"``
              cuando está habilitado, ``None`` en caso contrario.
    """
    return {
        "enabled": settings.WOMPI_ENABLED,
        "public_key": settings.WOMPI_PUBLIC_KEY if settings.WOMPI_ENABLED else None,
        "environment": settings.WOMPI_ENVIRONMENT if settings.WOMPI_ENABLED else None,
    }


@router.post("/sessions", response_model=PaymentSessionResponse, operation_id="createPaymentSession")
@limiter.limit("10/minute")
async def create_payment_session(
    request: Request,
    data: PaymentSessionCreate,
    current_client: CurrentPortalClient,
    db: AsyncSession = Depends(get_db),
):
    """Crea una sesión de pago Wompi para un pedido o CxC del cliente.

    Genera la referencia única (``WP-{code}-{timestamp}``) y la firma
    de integridad SHA-256 que el widget de Wompi exige para construir
    la URL de checkout. Persiste un ``PaymentTransaction`` en estado
    ``PENDING`` que servirá como ancla para reconciliar el webhook
    posterior y para prevenir pagos duplicados.

    Side effects:
        - Crea un registro ``PaymentTransaction(status=PENDING)`` con la
          firma de integridad y la referencia única.
        - Hace ``commit`` de la sesión de DB tras delegar al servicio.

    Reglas de negocio:
        - El ``order_id`` debe pertenecer al cliente autenticado; en
          caso contrario se rechaza con 403 (no se filtra existencia).
        - Si ya existe una transacción ``PENDING`` para el mismo
          pedido, el servicio rechaza con 400 para evitar dobles cobros.
        - Si el pedido o la CxC ya están totalmente pagados, se
          rechaza con 400.
        - Si Wompi está deshabilitado por configuración, retorna 503.

    Auth:
        Bearer JWT de ``CurrentPortalClient`` (cliente del portal web).

    Rate limit:
        10 solicitudes por minuto por IP (``slowapi``).

    Args:
        request: ``Request`` de FastAPI requerido por ``slowapi``.
        data: ``PaymentSessionCreate`` con ``order_id`` o
            ``receivable_id`` (mutuamente excluyentes).
        current_client: Cliente autenticado vía JWT del portal.
        db: Sesión async de SQLAlchemy inyectada.

    Returns:
        PaymentSessionResponse: Datos para el redirect a Wompi
        (referencia, monto en centavos, llave pública, firma de
        integridad y URL de retorno).

    Raises:
        HTTPException: 403 si el pedido no pertenece al cliente.
        HTTPException: 503 si Wompi está deshabilitado.
        HTTPException: 400 si el pedido/CxC no es pagable, ya tiene
            un pago en proceso, o falta ``order_id``/``receivable_id``.
    """
    if data.order_id:
        from sqlalchemy import select as sel
        from app.models.order import Order
        order_result = await db.execute(sel(Order).where(Order.id == data.order_id))
        order = order_result.scalar_one_or_none()
        if not order or order.client_id != current_client.id:
            raise HTTPException(status_code=403, detail="No tienes acceso a este pedido")
    if not settings.WOMPI_ENABLED:
        raise HTTPException(status_code=503, detail="Pagos en linea no disponibles")

    service = WompiService(db)
    try:
        session = await service.create_payment_session(data)
        await db.commit()
        return session
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/webhooks/wompi", operation_id="receiveWompiWebhook")
async def wompi_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    """Recibe y procesa eventos webhook de Wompi (público).

    Endpoint expuesto sin autenticación tradicional; la integridad se
    garantiza validando la firma HMAC-SHA256 que Wompi envía en el
    payload (campo ``signature.checksum``). El servicio reconstruye
    el digest concatenando los valores referenciados por
    ``signature.properties`` + ``timestamp`` + ``WOMPI_EVENTS_KEY`` y
    compara con ``hmac.compare_digest`` para evitar timing attacks.

    Contrato de seguridad:
        - Si la firma es inválida: ``process_webhook`` retorna ``False``,
          se hace ``rollback`` y se loguea ``warning``. Aun así se
          retorna 200 al cliente para no exponer información sobre la
          validación a un atacante (y para no disparar la política de
          reintentos de Wompi de manera innecesaria).
        - Si el evento no es ``transaction.updated``, se ignora
          silenciosamente y se retorna éxito.

    Idempotencia:
        - La transacción se busca por ``reference``. Si el
          ``PaymentTransaction`` ya está en un estado distinto a
          ``PENDING`` (Wompi puede reenviar el mismo evento a 30 min,
          3 h y 24 h ante cualquier error de red), el servicio retorna
          ``True`` sin tocar la DB. Esto previene duplicación contable.
        - El flag ``accounting_applied`` en ``PaymentTransaction`` actúa
          como un segundo seguro: ``_apply_approved_payment`` corta de
          inmediato si ya fue aplicado.

    Side effects al recibir ``APPROVED``:
        - Transiciona ``PaymentTransaction.status`` a ``APPROVED`` y
          guarda ``wompi_transaction_id``, ``payment_method_type`` y
          ``wompi_response_data`` completo.
        - Incrementa ``order.paid_amount`` (capeado en ``order.total``)
          o ``receivable.amount_paid``; marca CxC como pagada si el
          saldo se cubre.
        - Crea ``Transaction(type=INCOME)`` vía ``TransactionService`` y
          acredita la cuenta de Banco mediante
          ``BalanceIntegrationService`` (todos los métodos Wompi se
          mapean a ``AccPaymentMethod.TRANSFER`` porque Wompi consigna
          a Bancolombia sin importar cómo pagó el cliente).
        - Registra automáticamente un ``Expense`` global por la
          comisión Wompi + IVA (categoría ``bank_fees``) y su
          ``Transaction(type=EXPENSE)`` correspondiente.
        - Dispara alerta Telegram ``wompi_payment`` (fire-and-forget) y,
          si el pedido proviene de ``WEB_PORTAL``, envía notificación
          interna y alerta ``web_order_created``.
        - Marca ``accounting_applied=True`` para idempotencia.

    Política de respuesta:
        Siempre retorna 200 ``{"status": "ok"}``, incluso ante errores
        de procesamiento. Esto evita que Wompi entre en su ciclo de
        reintentos abusivo (30 min / 3 h / 24 h) cuando el problema es
        nuestro y no de Wompi. Los errores se persisten en logs para
        reconciliación manual o vía ``/payments/sync-pending``.

    Auth:
        Ninguna. Seguridad delegada a la firma HMAC del payload.

    Args:
        request: ``Request`` de FastAPI; se lee ``await request.json()``.
        db: Sesión async de SQLAlchemy inyectada.

    Returns:
        dict: ``{"status": "ok"}`` siempre, con HTTP 200.
    """
    try:
        payload = await request.json()
        logger.info(f"Wompi webhook received: event={payload.get('event')}")

        service = WompiService(db)
        success = await service.process_webhook(payload)

        if success:
            await db.commit()
        else:
            await db.rollback()
            logger.warning("Wompi webhook processing failed (signature or data issue)")

    except Exception as e:
        logger.error(f"Wompi webhook error: {e}")
        await db.rollback()

    # Always return 200 to Wompi
    return {"status": "ok"}


@router.get("/status/{reference}", response_model=PaymentStatusResponse, operation_id="getPaymentStatus")
@limiter.limit("20/minute")
async def check_payment_status(
    request: Request,
    reference: str,
    current_client: CurrentPortalClient,
    db: AsyncSession = Depends(get_db),
):
    """Consulta el estado de una transacción de pago por referencia.

    Lee ``PaymentTransaction`` por su ``reference`` único. Si la
    transacción aún está en ``PENDING``, dispara una sincronización
    activa contra la API REST de Wompi (vía
    ``WompiService.sync_status_from_reference``) para capturar
    estados que pudieran haberse perdido por fallos de webhook.

    Si la sincronización detecta una transición a ``APPROVED``, los
    side effects contables descritos en ``wompi_webhook`` se ejecutan
    igualmente (incremento de ``paid_amount``, asiento contable,
    registro de comisión, alertas Telegram). Esto convierte al
    endpoint en una red de seguridad ante webhooks perdidos.

    Side effects:
        - Si está ``PENDING``: query HTTP a ``GET /transactions`` de
          Wompi, posible actualización de estado y aplicación contable
          completa con ``commit``.

    Auth:
        Bearer JWT de ``CurrentPortalClient``.

    Rate limit:
        20 solicitudes por minuto por IP.

    Args:
        request: ``Request`` de FastAPI requerido por ``slowapi``.
        reference: Referencia única de Wompi generada al crear la
            sesión (formato ``WP-{code}-{timestamp}``).
        current_client: Cliente autenticado vía JWT del portal.
        db: Sesión async de SQLAlchemy inyectada.

    Returns:
        PaymentStatusResponse: Estado actual con ``status``, monto,
        método de pago, ``order_id`` o ``receivable_id`` asociado y
        timestamps ``created_at`` / ``completed_at``.

    Raises:
        HTTPException: 404 si la referencia no existe **o no pertenece
            al cliente autenticado**. El mismo código se devuelve para
            ambos casos para no revelar la existencia de transacciones
            de otros clientes (defensa contra enumeración).
    """
    service = WompiService(db)
    payment = await service.get_payment_status(reference)

    if not payment:
        raise HTTPException(status_code=404, detail="Transaccion no encontrada")

    # Ownership check — devolver 404 (no 403) para no revelar existencia.
    # Esto cubre el side-effect crítico: sin este check un cliente podría
    # disparar la sincronización contable de un pago ajeno por enumeración.
    owner_id = await _resolve_payment_owner_id(db, payment)
    if owner_id != current_client.id:
        raise HTTPException(status_code=404, detail="Transaccion no encontrada")

    # If still PENDING, poll Wompi API for real-time status and sync if changed
    from app.models.payment_transaction import WompiTransactionStatus
    if payment.status == WompiTransactionStatus.PENDING:
        synced = await service.sync_status_from_reference(payment)
        if synced:
            await db.commit()
            await db.refresh(payment)

    return PaymentStatusResponse(
        reference=payment.reference,
        status=payment.status.value,
        amount_in_cents=payment.amount_in_cents,
        payment_method_type=payment.payment_method_type,
        order_id=payment.order_id,
        receivable_id=payment.receivable_id,
        created_at=payment.created_at,
        completed_at=payment.completed_at,
    )


@router.post("/sync-pending", operation_id="syncPendingPayments")
@limiter.limit("5/minute")
async def sync_pending_payments(
    request: Request,
    current_user: CurrentSuperuser,
    db: AsyncSession = Depends(get_db),
):
    """Reconcilia todas las transacciones ``PENDING`` contra la API de Wompi.

    Mecanismo de recuperación operativa **cross-tenant**: itera todas
    las ``PaymentTransaction`` en estado ``PENDING`` del sistema y
    consulta ``GET /transactions?reference=...`` de Wompi para detectar
    webhooks perdidos por caídas de red, downtime del backend o
    problemas en Wompi.

    Side effects (por cada pago sincronizado a un estado final):
        - Actualiza ``status``, ``wompi_transaction_id``,
          ``payment_method_type`` y ``wompi_response_data``.
        - Si el nuevo estado es ``APPROVED``, ejecuta toda la cadena
          contable: incremento de ``paid_amount``, ``Transaction``,
          asiento de balance, registro de ``Expense`` por comisión y
          alertas Telegram.
        - Hace ``commit`` final si al menos una transacción cambió.

    Resiliencia:
        Cada sincronización individual está envuelta en ``try/except``;
        un fallo en un pago no detiene el procesamiento de los demás.

    Auth:
        Bearer JWT de ``CurrentSuperuser``. La operación es batch
        cross-tenant que dispara asientos contables en cualquier
        colegio — solo accesible para usuarios con ``is_superuser=True``.
        Roles ``OWNER``/``ADMIN`` son per-school y no aplican aquí.

    Rate limit:
        5 solicitudes por minuto por IP.

    Args:
        request: ``Request`` de FastAPI requerido por ``slowapi``.
        current_user: Superuser autenticado.
        db: Sesión async de SQLAlchemy inyectada.

    Returns:
        dict: ``{"synced": int, "total_pending": int}`` con la cuenta
        de transacciones que cambiaron de estado y el total de pagos
        en ``PENDING`` antes de la sincronización.

    Raises:
        HTTPException: 403 si el usuario autenticado no es superuser.
    """
    from app.models.payment_transaction import PaymentTransaction, WompiTransactionStatus

    result = await db.execute(
        select(PaymentTransaction).where(
            PaymentTransaction.status == WompiTransactionStatus.PENDING
        )
    )
    pending = result.scalars().all()

    if not pending:
        return {"synced": 0, "total_pending": 0}

    service = WompiService(db)
    synced_count = 0
    for payment in pending:
        try:
            synced = await service.sync_status_from_reference(payment)
            if synced:
                synced_count += 1
        except Exception as e:
            logger.warning(f"Failed to sync {payment.reference}: {e}")

    if synced_count > 0:
        await db.commit()

    return {"synced": synced_count, "total_pending": len(pending)}


@router.get("/order/{order_id}", response_model=PaginatedResponse[PaymentTransactionResponse], operation_id="listOrderPayments")
async def get_order_payments(
    order_id: str,
    current_client: CurrentPortalClient,
    db: AsyncSession = Depends(get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
):
    """Lista paginada de transacciones Wompi asociadas a un pedido.

    Retorna todos los intentos de pago (PENDING, APPROVED, DECLINED,
    VOIDED, ERROR) asociados al pedido, ordenados de más reciente a
    más antiguo. Útil para que el cliente vea el historial completo
    de intentos en el portal.

    Auth:
        Bearer JWT de ``CurrentPortalClient``. Valida que el pedido
        pertenezca al cliente autenticado antes de revelar datos.

    Args:
        order_id: UUID del pedido en formato string.
        current_client: Cliente autenticado vía JWT del portal.
        db: Sesión async de SQLAlchemy inyectada.
        skip: Offset de paginación (>=0).
        limit: Tamaño de página (1-100, default 100).

    Returns:
        PaginatedResponse[PaymentTransactionResponse]: Página de
        transacciones con metadatos de paginación (``total``,
        ``page``, ``total_pages``, ``has_more``).

    Raises:
        HTTPException: 400 si ``order_id`` no es un UUID válido.
        HTTPException: 403 si el pedido no existe o no pertenece al
            cliente autenticado.
    """
    from uuid import UUID
    from sqlalchemy import select as sel
    from app.models.order import Order
    try:
        uid = UUID(order_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="ID de pedido invalido")

    order_result = await db.execute(sel(Order).where(Order.id == uid))
    order = order_result.scalar_one_or_none()
    if not order or order.client_id != current_client.id:
        raise HTTPException(status_code=403, detail="No tienes acceso a este pedido")

    service = WompiService(db)
    payments = await service.get_payments_for_order(uid)
    total = len(payments)
    items = [PaymentTransactionResponse.model_validate(p) for p in payments[skip:skip + limit]]
    return PaginatedResponse[PaymentTransactionResponse](**paginate(items, total, skip, limit))


@router.get("/resolve/{wompi_id}", response_model=PaymentStatusResponse, operation_id="resolvePaymentByWompiId")
@limiter.limit("20/minute")
async def resolve_by_wompi_id(
    request: Request,
    wompi_id: str,
    current_client: CurrentPortalClient,
    db: AsyncSession = Depends(get_db),
):
    """Resuelve un ``PaymentTransaction`` desde un ID de Wompi.

    Existe porque la URL de retorno de Wompi a veces redirige con
    ``?id=<wompi_transaction_id>`` en lugar de ``?ref=<reference>``,
    dependiendo del método de pago elegido por el cliente. El
    endpoint primero busca localmente por ``wompi_transaction_id``;
    si no encuentra (caso típico cuando el webhook aún no llega),
    consulta ``GET /transactions/{id}`` de la API pública de Wompi
    para obtener nuestra ``reference`` y resolver el registro local.

    Side effects:
        Ninguno sobre el estado del pago. Solo lectura/resolución.

    Auth:
        Bearer JWT de ``CurrentPortalClient``.

    Rate limit:
        20 solicitudes por minuto por IP.

    Args:
        request: ``Request`` de FastAPI requerido por ``slowapi``.
        wompi_id: ID de transacción asignado por Wompi (no nuestra
            referencia interna).
        current_client: Cliente autenticado vía JWT del portal.
        db: Sesión async de SQLAlchemy inyectada.

    Returns:
        PaymentStatusResponse: Estado y datos de la transacción.

    Raises:
        HTTPException: 404 si no se encuentra (ni localmente ni en la
            API de Wompi) **o no pertenece al cliente autenticado**.
            Se devuelve el mismo código en ambos casos para no revelar
            la existencia de transacciones de otros clientes (defensa
            contra enumeración de IDs de Wompi).
    """
    from app.models.payment_transaction import PaymentTransaction

    result = await db.execute(
        select(PaymentTransaction).where(
            PaymentTransaction.wompi_transaction_id == wompi_id
        )
    )
    payment = result.scalar_one_or_none()

    # If not found locally, query Wompi API to get our reference
    if not payment:
        service = WompiService(db)
        reference = await service.resolve_reference_from_wompi(wompi_id)
        if reference:
            payment = await service.get_payment_status(reference)

    if not payment:
        raise HTTPException(status_code=404, detail="Transaccion no encontrada")

    # Ownership check — 404 (no 403) para no revelar existencia.
    owner_id = await _resolve_payment_owner_id(db, payment)
    if owner_id != current_client.id:
        raise HTTPException(status_code=404, detail="Transaccion no encontrada")

    return PaymentStatusResponse(
        reference=payment.reference,
        status=payment.status.value,
        amount_in_cents=payment.amount_in_cents,
        payment_method_type=payment.payment_method_type,
        order_id=payment.order_id,
        receivable_id=payment.receivable_id,
        created_at=payment.created_at,
        completed_at=payment.completed_at,
    )
