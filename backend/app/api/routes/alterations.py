"""
Alterations (Arreglos) API Routes

GLOBAL module - operates business-wide like accounting.
Requires ADMIN role in at least one school.

Endpoints:
- GET /global/alterations - List alterations with filters
- GET /global/alterations/summary - Dashboard statistics
- GET /global/alterations/{id} - Get alteration with payments
- GET /global/alterations/code/{code} - Find by code
- POST /global/alterations - Create new alteration
- PATCH /global/alterations/{id} - Update alteration
- PATCH /global/alterations/{id}/status - Update status only
- POST /global/alterations/{id}/pay - Record payment
- DELETE /global/alterations/{id} - Cancel alteration
"""
from uuid import UUID
from datetime import date
from fastapi import APIRouter, HTTPException, status, Query, Depends

from app.api.dependencies import (
    DatabaseSession,
    CurrentUser,
    require_any_school_admin
)
from app.models.alteration import AlterationType, AlterationStatus
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
from app.services.alteration import AlterationService


router = APIRouter(
    prefix="/global/alterations",
    tags=["Global Alterations"],
    dependencies=[Depends(require_any_school_admin)]
)


# ============================================
# List and Search
# ============================================

@router.get(
    "",
    response_model=list[AlterationListResponse],
    summary="List alterations",
    description="List all alterations with optional filters"
)
async def list_alterations(
    db: DatabaseSession,
    current_user: CurrentUser,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    status: AlterationStatus | None = Query(None, description="Filter by status"),
    alteration_type: AlterationType | None = Query(None, alias="type", description="Filter by type"),
    search: str | None = Query(None, description="Search in code, garment, client"),
    start_date: date | None = Query(None, description="Filter by received_date >= start_date"),
    end_date: date | None = Query(None, description="Filter by received_date <= end_date"),
    is_paid: bool | None = Query(None, description="Filter by payment status")
):
    """List alterations with optional filters."""
    service = AlterationService(db)
    alterations = await service.list(
        skip=skip,
        limit=limit,
        status=status,
        alteration_type=alteration_type,
        search=search,
        start_date=start_date,
        end_date=end_date,
        is_paid=is_paid
    )

    # Convert to list response format
    return [
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


@router.get(
    "/summary",
    response_model=AlterationsSummary,
    summary="Get alterations summary",
    description="Get summary statistics for the alterations dashboard"
)
async def get_summary(
    db: DatabaseSession,
    current_user: CurrentUser
):
    """Get summary statistics for alterations."""
    service = AlterationService(db)
    return await service.get_summary()


# ============================================
# Get Single Alteration
# ============================================

@router.get(
    "/code/{code}",
    response_model=AlterationWithPayments,
    summary="Get alteration by code",
    description="Find an alteration by its code (e.g., ARR-2026-0001)"
)
async def get_by_code(
    code: str,
    db: DatabaseSession,
    current_user: CurrentUser
):
    """Get alteration by code."""
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
    description="Get alteration details with payment history"
)
async def get_alteration(
    alteration_id: UUID,
    db: DatabaseSession,
    current_user: CurrentUser
):
    """Get alteration by ID with payments."""
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
    description="Create a new alteration with optional initial payment"
)
async def create_alteration(
    data: AlterationCreate,
    db: DatabaseSession,
    current_user: CurrentUser
):
    """Create a new alteration."""
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
    description="Update alteration details"
)
async def update_alteration(
    alteration_id: UUID,
    data: AlterationUpdate,
    db: DatabaseSession,
    current_user: CurrentUser
):
    """Update an alteration."""
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
    description="Update alteration status only"
)
async def update_status(
    alteration_id: UUID,
    data: AlterationStatusUpdate,
    db: DatabaseSession,
    current_user: CurrentUser
):
    """Update alteration status."""
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
    description="Record a payment for an alteration"
)
async def record_payment(
    alteration_id: UUID,
    data: AlterationPaymentCreate,
    db: DatabaseSession,
    current_user: CurrentUser
):
    """Record a payment for an alteration."""
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
    response_model=list[AlterationPaymentResponse],
    summary="Get payments",
    description="Get payment history for an alteration"
)
async def get_payments(
    alteration_id: UUID,
    db: DatabaseSession,
    current_user: CurrentUser
):
    """Get payment history for an alteration."""
    service = AlterationService(db)

    # Verify alteration exists
    alteration = await service.get(alteration_id)
    if not alteration:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Alteration not found"
        )

    payments = await service.get_payments(alteration_id)
    return payments


# ============================================
# Cancel
# ============================================

@router.delete(
    "/{alteration_id}",
    response_model=AlterationResponse,
    summary="Cancel alteration",
    description="Cancel an alteration (only if no payments recorded)"
)
async def cancel_alteration(
    alteration_id: UUID,
    db: DatabaseSession,
    current_user: CurrentUser
):
    """Cancel an alteration."""
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
