"""
Payment Gateway Routes - Wompi Integration

Endpoints:
- POST /payments/sessions       - Create payment session (authenticated client)
- POST /payments/webhooks/wompi - Receive Wompi webhook (public, signature-validated)
- GET  /payments/status/{ref}   - Check payment status (authenticated)
- GET  /payments/config         - Get public Wompi config (public)
"""
import logging
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.core.config import settings
from app.core.limiter import limiter
from app.services.wompi import WompiService
from app.schemas.payment_transaction import (
    PaymentSessionCreate,
    PaymentSessionResponse,
    PaymentStatusResponse,
    PaymentTransactionResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/payments", tags=["Payments"])


@router.get("/config")
async def get_payment_config():
    """
    Get public Wompi configuration for frontend.
    No authentication needed - only exposes public key.
    """
    return {
        "enabled": settings.WOMPI_ENABLED,
        "public_key": settings.WOMPI_PUBLIC_KEY if settings.WOMPI_ENABLED else None,
        "environment": settings.WOMPI_ENVIRONMENT if settings.WOMPI_ENABLED else None,
    }


@router.post("/sessions", response_model=PaymentSessionResponse)
@limiter.limit("10/minute")
async def create_payment_session(
    request: Request,
    data: PaymentSessionCreate,
    db: AsyncSession = Depends(get_db),
):
    """
    Create a Wompi payment session.

    Returns the data needed to redirect to Wompi checkout:
    - reference, amount, signature, public_key, redirect_url

    The frontend constructs the redirect URL:
    https://checkout.wompi.co/p/?public-key={key}&currency=COP&amount-in-cents={amount}
    &reference={ref}&signature:integrity={sig}&redirect-url={url}
    """
    if not settings.WOMPI_ENABLED:
        raise HTTPException(status_code=503, detail="Pagos en linea no disponibles")

    service = WompiService(db)
    try:
        session = await service.create_payment_session(data)
        await db.commit()
        return session
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/webhooks/wompi")
async def wompi_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    """
    Receive Wompi webhook events.

    PUBLIC endpoint - no JWT auth required.
    Security is via Wompi's webhook signature validation.

    MUST always return 200 to Wompi (even on errors),
    otherwise Wompi will retry (30min, 3h, 24h).
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


@router.get("/status/{reference}", response_model=PaymentStatusResponse)
@limiter.limit("20/minute")
async def check_payment_status(
    request: Request,
    reference: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Check payment transaction status by reference.
    """
    service = WompiService(db)
    payment = await service.get_payment_status(reference)

    if not payment:
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


@router.post("/sync-pending")
@limiter.limit("5/minute")
async def sync_pending_payments(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    Sync all PENDING payment transactions with Wompi.
    Called by frontend on page load to catch missed webhooks.
    """
    from sqlalchemy import select
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


@router.get("/order/{order_id}", response_model=list[PaymentTransactionResponse])
async def get_order_payments(
    order_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Get all payment transactions for an order."""
    from uuid import UUID
    try:
        uid = UUID(order_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="ID de pedido invalido")

    service = WompiService(db)
    payments = await service.get_payments_for_order(uid)
    return [PaymentTransactionResponse.model_validate(p) for p in payments]


@router.get("/resolve/{wompi_id}", response_model=PaymentStatusResponse)
@limiter.limit("20/minute")
async def resolve_by_wompi_id(
    request: Request,
    wompi_id: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Resolve payment status by Wompi transaction ID.
    Used when Wompi redirects with ?id= instead of ?ref=.
    """
    from sqlalchemy import select
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
