"""
Payroll Routes - Payroll management endpoints
"""
from uuid import UUID
from fastapi import APIRouter, HTTPException, status, Query

from app.api.dependencies import DatabaseSession, CurrentUser
from app.models.payroll import PayrollStatus
from app.services.payroll_service import payroll_service
from app.schemas.payroll import (
    PayrollRunCreate,
    PayrollRunUpdate,
    PayrollRunResponse,
    PayrollRunListResponse,
    PayrollRunDetailResponse,
    PayrollItemUpdate,
    PayrollItemResponse,
    PayrollItemPayRequest,
    PayrollSummary,
)

router = APIRouter(prefix="/global/payroll", tags=["Payroll"])


# ============================================
# Payroll Summary
# ============================================

@router.get("/summary", response_model=PayrollSummary)
async def get_payroll_summary(
    db: DatabaseSession,
    current_user: CurrentUser,
):
    """Get payroll summary (active employees, totals, etc.)"""
    summary = await payroll_service.get_payroll_summary(db)
    return summary


# ============================================
# Payroll Run CRUD
# ============================================

@router.get("", response_model=list[PayrollRunListResponse])
async def list_payroll_runs(
    db: DatabaseSession,
    current_user: CurrentUser,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    payroll_status: PayrollStatus | None = Query(None, alias="status"),
):
    """List all payroll runs"""
    runs = await payroll_service.get_payroll_runs(
        db, skip=skip, limit=limit, status=payroll_status
    )
    return runs


@router.get("/{payroll_id}", response_model=PayrollRunDetailResponse)
async def get_payroll_run(
    payroll_id: UUID,
    db: DatabaseSession,
    current_user: CurrentUser,
):
    """Get a single payroll run with items"""
    payroll = await payroll_service.get_payroll_run(db, payroll_id)
    if not payroll:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Liquidación de nómina no encontrada"
        )

    # Build response with employee names
    items = []
    for item in payroll.items:
        item_dict = {
            "id": item.id,
            "payroll_run_id": item.payroll_run_id,
            "employee_id": item.employee_id,
            "base_salary": item.base_salary,
            "total_bonuses": item.total_bonuses,
            "total_deductions": item.total_deductions,
            "net_amount": item.net_amount,
            "bonus_breakdown": item.bonus_breakdown,
            "deduction_breakdown": item.deduction_breakdown,
            "is_paid": item.is_paid,
            "paid_at": item.paid_at,
            "payment_method": item.payment_method,
            "payment_reference": item.payment_reference,
            "employee_name": item.employee.full_name if item.employee else None,
        }
        items.append(item_dict)

    return {
        "id": payroll.id,
        "period_start": payroll.period_start,
        "period_end": payroll.period_end,
        "payment_date": payroll.payment_date,
        "status": payroll.status,
        "total_base_salary": payroll.total_base_salary,
        "total_bonuses": payroll.total_bonuses,
        "total_deductions": payroll.total_deductions,
        "total_net": payroll.total_net,
        "employee_count": payroll.employee_count,
        "expense_id": payroll.expense_id,
        "notes": payroll.notes,
        "approved_by": payroll.approved_by,
        "approved_at": payroll.approved_at,
        "paid_at": payroll.paid_at,
        "created_by": payroll.created_by,
        "created_at": payroll.created_at,
        "items": items,
    }


@router.post("", response_model=PayrollRunResponse, status_code=status.HTTP_201_CREATED)
async def create_payroll_run(
    data: PayrollRunCreate,
    db: DatabaseSession,
    current_user: CurrentUser,
):
    """Create a new payroll run"""
    import logging
    logger = logging.getLogger(__name__)
    try:
        payroll = await payroll_service.create_payroll_run(
            db, data, created_by=current_user.id
        )
        return payroll
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.exception(f"Error creating payroll run: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error interno al crear liquidación: {str(e)}"
        )


@router.patch("/{payroll_id}", response_model=PayrollRunResponse)
async def update_payroll_run(
    payroll_id: UUID,
    data: PayrollRunUpdate,
    db: DatabaseSession,
    current_user: CurrentUser,
):
    """Update a payroll run (only in draft status)"""
    try:
        payroll = await payroll_service.update_payroll_run(db, payroll_id, data)
        return payroll
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


# ============================================
# Payroll Actions
# ============================================

@router.post("/{payroll_id}/approve", response_model=PayrollRunResponse)
async def approve_payroll_run(
    payroll_id: UUID,
    db: DatabaseSession,
    current_user: CurrentUser,
):
    """Approve a payroll run (creates expense)"""
    try:
        payroll = await payroll_service.approve_payroll_run(
            db, payroll_id, approved_by=current_user.id
        )
        return payroll
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post("/{payroll_id}/pay", response_model=PayrollRunResponse)
async def pay_payroll_run(
    payroll_id: UUID,
    db: DatabaseSession,
    current_user: CurrentUser,
):
    """Mark entire payroll as paid"""
    try:
        payroll = await payroll_service.mark_payroll_paid(db, payroll_id)
        return payroll
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post("/{payroll_id}/cancel", response_model=PayrollRunResponse)
async def cancel_payroll_run(
    payroll_id: UUID,
    db: DatabaseSession,
    current_user: CurrentUser,
):
    """Cancel a payroll run"""
    try:
        payroll = await payroll_service.cancel_payroll_run(db, payroll_id)
        return payroll
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


# ============================================
# Payroll Item Operations
# ============================================

@router.patch("/{payroll_id}/items/{item_id}", response_model=PayrollItemResponse)
async def update_payroll_item(
    payroll_id: UUID,
    item_id: UUID,
    data: PayrollItemUpdate,
    db: DatabaseSession,
    current_user: CurrentUser,
):
    """Update a payroll item (only in draft status)"""
    try:
        item = await payroll_service.update_payroll_item(db, item_id, data)
        return item
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post("/{payroll_id}/items/{item_id}/pay", response_model=PayrollItemResponse)
async def pay_payroll_item(
    payroll_id: UUID,
    item_id: UUID,
    data: PayrollItemPayRequest,
    db: DatabaseSession,
    current_user: CurrentUser,
):
    """Pay a single employee in the payroll"""
    try:
        item = await payroll_service.pay_payroll_item(
            db, item_id, data.payment_method, data.payment_reference
        )
        return item
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
