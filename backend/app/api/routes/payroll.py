"""
Payroll Routes - Payroll management endpoints
"""
import logging
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy import select, func

from app.api.dependencies import DatabaseSession, CurrentUser, require_global_permission
from app.api.error_responses import responses, AUTHENTICATED
from app.schemas.base import PaginatedResponse, paginate
from app.models.payroll import PayrollRun, PayrollStatus
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

logger = logging.getLogger(__name__)


# ============================================
# Payroll Summary
# ============================================

@router.get("/summary", response_model=PayrollSummary, dependencies=[Depends(require_global_permission("payroll.manage"))], responses=AUTHENTICATED, operation_id="getPayrollSummary")
async def get_payroll_summary(
    db: DatabaseSession,
    current_user: CurrentUser,
):
    """
    Get payroll summary (active employees, totals, etc.).

    **Auth:** Bearer JWT (staff)
    **Permission:** `payroll.manage` (global)
    """
    summary = await payroll_service.get_payroll_summary(db)
    return summary


# ============================================
# Payroll Run CRUD
# ============================================

@router.get("", response_model=PaginatedResponse[PayrollRunListResponse], dependencies=[Depends(require_global_permission("payroll.manage"))], responses=AUTHENTICATED, operation_id="listPayrollRuns")
async def list_payroll_runs(
    db: DatabaseSession,
    current_user: CurrentUser,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    payroll_status: PayrollStatus | None = Query(None, alias="status"),
):
    """
    List all payroll runs.

    **Auth:** Bearer JWT (staff)
    **Permission:** `payroll.manage` (global)
    """
    count_stmt = select(func.count(PayrollRun.id))
    if payroll_status is not None:
        count_stmt = count_stmt.where(PayrollRun.status == payroll_status)
    total = (await db.execute(count_stmt)).scalar_one()

    runs = await payroll_service.get_payroll_runs(
        db, skip=skip, limit=limit, status=payroll_status
    )
    return paginate(runs, total, skip, limit)


@router.get("/{payroll_id}", response_model=PayrollRunDetailResponse, dependencies=[Depends(require_global_permission("payroll.manage"))], responses=responses(404), operation_id="getPayrollRun")
async def get_payroll_run(
    payroll_id: UUID,
    db: DatabaseSession,
    current_user: CurrentUser,
):
    """
    Get a single payroll run with items.

    **Auth:** Bearer JWT (staff)
    **Permission:** `payroll.manage` (global)
    """
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


@router.post("", response_model=PayrollRunResponse, status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_global_permission("payroll.manage"))], responses=responses(400), operation_id="createPayrollRun")
async def create_payroll_run(
    data: PayrollRunCreate,
    db: DatabaseSession,
    current_user: CurrentUser,
):
    """
    Create a new payroll run.

    **Auth:** Bearer JWT (staff)
    **Permission:** `payroll.manage` (global)
    """
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
    except Exception:
        logger.exception("Error creating payroll run")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error interno al crear la liquidación de nómina"
        )


@router.patch("/{payroll_id}", response_model=PayrollRunResponse, dependencies=[Depends(require_global_permission("payroll.manage"))], responses=responses(404), operation_id="updatePayrollRun")
async def update_payroll_run(
    payroll_id: UUID,
    data: PayrollRunUpdate,
    db: DatabaseSession,
    current_user: CurrentUser,
):
    """
    Update a payroll run (only in draft status).

    **Auth:** Bearer JWT (staff)
    **Permission:** `payroll.manage` (global)
    """
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

@router.post("/{payroll_id}/approve", response_model=PayrollRunResponse, dependencies=[Depends(require_global_permission("payroll.manage"))], responses=responses(404), operation_id="approvePayrollRun")
async def approve_payroll_run(
    payroll_id: UUID,
    db: DatabaseSession,
    current_user: CurrentUser,
):
    """
    Approve a payroll run (creates expense).

    **Auth:** Bearer JWT (staff)
    **Permission:** `payroll.manage` (global)
    """
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


@router.post("/{payroll_id}/pay", response_model=PayrollRunResponse, dependencies=[Depends(require_global_permission("payroll.manage"))], responses=responses(404), operation_id="payPayrollRun")
async def pay_payroll_run(
    payroll_id: UUID,
    db: DatabaseSession,
    current_user: CurrentUser,
):
    """
    Mark entire payroll as paid.

    **Auth:** Bearer JWT (staff)
    **Permission:** `payroll.manage` (global)
    """
    try:
        payroll = await payroll_service.mark_payroll_paid(
            db, payroll_id, paid_by=current_user.id
        )
        return payroll
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post("/{payroll_id}/cancel", response_model=PayrollRunResponse, dependencies=[Depends(require_global_permission("payroll.manage"))], responses=responses(404), operation_id="cancelPayrollRun")
async def cancel_payroll_run(
    payroll_id: UUID,
    db: DatabaseSession,
    current_user: CurrentUser,
):
    """
    Cancel a payroll run.

    **Auth:** Bearer JWT (staff)
    **Permission:** `payroll.manage` (global)
    """
    try:
        payroll = await payroll_service.cancel_payroll_run(
            db, payroll_id, cancelled_by=current_user.id
        )
        return payroll
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


# ============================================
# Payroll Item Operations
# ============================================

@router.patch("/{payroll_id}/items/{item_id}", response_model=PayrollItemResponse, dependencies=[Depends(require_global_permission("payroll.manage"))], responses=responses(404), operation_id="updatePayrollItem")
async def update_payroll_item(
    payroll_id: UUID,
    item_id: UUID,
    data: PayrollItemUpdate,
    db: DatabaseSession,
    current_user: CurrentUser,
):
    """
    Update a payroll item (only in draft status).

    **Auth:** Bearer JWT (staff)
    **Permission:** `payroll.manage` (global)
    """
    try:
        item = await payroll_service.update_payroll_item(db, item_id, data)
        return item
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post("/{payroll_id}/items/{item_id}/pay", response_model=PayrollItemResponse, dependencies=[Depends(require_global_permission("payroll.manage"))], responses=responses(404), operation_id="payPayrollItem")
async def pay_payroll_item(
    payroll_id: UUID,
    item_id: UUID,
    data: PayrollItemPayRequest,
    db: DatabaseSession,
    current_user: CurrentUser,
):
    """
    Pay a single employee in the payroll.

    **Auth:** Bearer JWT (staff)
    **Permission:** `payroll.manage` (global)
    """
    try:
        item = await payroll_service.pay_payroll_item(
            db, item_id, data.payment_method, data.payment_reference,
            paid_by=current_user.id,
        )
        return item
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
