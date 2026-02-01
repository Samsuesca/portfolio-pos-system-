"""
Fixed Expenses Endpoints - Recurring/Periodic Expense Templates

These endpoints manage fixed expense templates for recurring business expenses.
Generated expenses are created as pending Expense records in the accounting system.
"""
from uuid import UUID
from datetime import date
from decimal import Decimal
from fastapi import APIRouter, HTTPException, status, Query, Depends

from app.api.dependencies import DatabaseSession, CurrentUser, require_any_school_admin
from app.models.accounting import ExpenseCategory
from app.models.fixed_expense import FixedExpenseType, ExpenseFrequency
from app.services.fixed_expense_service import FixedExpenseService
from app.schemas.fixed_expense import (
    FixedExpenseCreate,
    FixedExpenseUpdate,
    FixedExpenseResponse,
    FixedExpenseListResponse,
    FixedExpenseWithStats,
    GenerateExpensesRequest,
    GenerateExpensesResponse,
    PendingGenerationResponse,
)

router = APIRouter(prefix="/global/fixed-expenses", tags=["Fixed Expenses"])


# ============================================
# CRUD Operations
# ============================================

@router.get(
    "",
    response_model=list[FixedExpenseListResponse],
    dependencies=[Depends(require_any_school_admin)]
)
async def list_fixed_expenses(
    db: DatabaseSession,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    is_active: bool | None = Query(None, description="Filter by active status"),
    category: ExpenseCategory | None = Query(None, description="Filter by category")
):
    """
    List all fixed expense templates.

    Returns templates for recurring expenses like rent, utilities, etc.
    """
    service = FixedExpenseService(db)
    fixed_expenses = await service.get_multi(
        skip=skip,
        limit=limit,
        is_active=is_active,
        category=category
    )

    return [
        FixedExpenseListResponse(
            id=fe.id,
            name=fe.name,
            category=fe.category,
            expense_type=fe.expense_type,
            amount=fe.amount,
            min_amount=fe.min_amount,
            max_amount=fe.max_amount,
            # Legacy frequency
            frequency=fe.frequency,
            day_of_month=fe.day_of_month,
            # Advanced recurrence
            recurrence_frequency=fe.recurrence_frequency,
            recurrence_interval=fe.recurrence_interval,
            recurrence_weekdays=fe.recurrence_weekdays,
            recurrence_month_days=fe.recurrence_month_days,
            recurrence_month_day_type=fe.recurrence_month_day_type,
            uses_new_recurrence=fe.uses_new_recurrence,
            # Common
            vendor=fe.vendor,
            auto_generate=fe.auto_generate,
            next_generation_date=fe.next_generation_date,
            last_generated_date=fe.last_generated_date,
            is_active=fe.is_active
        )
        for fe in fixed_expenses
    ]


@router.post(
    "",
    response_model=FixedExpenseResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_any_school_admin)]
)
async def create_fixed_expense(
    data: FixedExpenseCreate,
    db: DatabaseSession,
    current_user: CurrentUser
):
    """
    Create a new fixed expense template.

    This creates a template that can automatically generate Expense records
    at the specified frequency (monthly, biweekly, etc.).

    Expense Types:
    - **exact**: Fixed value (e.g., rent, internet)
    - **variable**: Variable value within range (e.g., utilities, servers)

    For variable expenses, provide min_amount and max_amount to define the expected range.
    The amount field represents the default/estimated value.
    """
    service = FixedExpenseService(db)

    try:
        fixed_expense = await service.create(data, created_by=current_user.id)
        await db.commit()
        return fixed_expense
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
            detail=f"Error creating fixed expense: {str(e)}"
        )


@router.get(
    "/pending-generation",
    response_model=PendingGenerationResponse,
    dependencies=[Depends(require_any_school_admin)]
)
async def get_pending_generation(db: DatabaseSession):
    """
    Get fixed expenses that are pending generation.

    Returns a list of fixed expense templates that are due for expense generation,
    along with counts of pending and overdue items.
    """
    service = FixedExpenseService(db)
    return await service.get_pending_generation()


@router.get(
    "/{fixed_expense_id}",
    response_model=FixedExpenseWithStats,
    dependencies=[Depends(require_any_school_admin)]
)
async def get_fixed_expense(
    fixed_expense_id: UUID,
    db: DatabaseSession
):
    """
    Get a single fixed expense template with generation statistics.
    """
    service = FixedExpenseService(db)
    fixed_expense = await service.get(fixed_expense_id)

    if not fixed_expense:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Fixed expense not found"
        )

    # Get statistics
    stats = await service.get_stats(fixed_expense_id)

    # Get last generated expense
    generated = await service.get_generated_expenses(fixed_expense_id, limit=1)
    last_expense_id = generated[0].id if generated else None

    return FixedExpenseWithStats(
        id=fixed_expense.id,
        name=fixed_expense.name,
        description=fixed_expense.description,
        category=fixed_expense.category,
        expense_type=fixed_expense.expense_type,
        amount=fixed_expense.amount,
        min_amount=fixed_expense.min_amount,
        max_amount=fixed_expense.max_amount,
        frequency=fixed_expense.frequency,
        day_of_month=fixed_expense.day_of_month,
        auto_generate=fixed_expense.auto_generate,
        next_generation_date=fixed_expense.next_generation_date,
        last_generated_date=fixed_expense.last_generated_date,
        vendor=fixed_expense.vendor,
        is_active=fixed_expense.is_active,
        created_by=fixed_expense.created_by,
        created_at=fixed_expense.created_at,
        updated_at=fixed_expense.updated_at,
        total_generated=stats["total_generated"],
        total_amount_generated=stats["total_amount_generated"],
        last_expense_id=last_expense_id
    )


@router.patch(
    "/{fixed_expense_id}",
    response_model=FixedExpenseResponse,
    dependencies=[Depends(require_any_school_admin)]
)
async def update_fixed_expense(
    fixed_expense_id: UUID,
    data: FixedExpenseUpdate,
    db: DatabaseSession
):
    """
    Update a fixed expense template.

    Changes will apply to future generated expenses.
    Already generated expenses are not affected.
    """
    service = FixedExpenseService(db)

    try:
        fixed_expense = await service.update(fixed_expense_id, data)

        if not fixed_expense:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Fixed expense not found"
            )

        await db.commit()
        return fixed_expense
    except ValueError as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error updating fixed expense: {str(e)}"
        )


@router.delete(
    "/{fixed_expense_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_any_school_admin)]
)
async def delete_fixed_expense(
    fixed_expense_id: UUID,
    db: DatabaseSession
):
    """
    Delete (deactivate) a fixed expense template.

    This performs a soft delete by setting is_active = False.
    The template won't generate new expenses but historical data is preserved.
    """
    service = FixedExpenseService(db)

    deleted = await service.delete(fixed_expense_id)

    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Fixed expense not found"
        )

    await db.commit()


# ============================================
# Generation Operations
# ============================================

@router.post(
    "/generate",
    response_model=GenerateExpensesResponse,
    dependencies=[Depends(require_any_school_admin)]
)
async def generate_expenses(
    db: DatabaseSession,
    current_user: CurrentUser,
    request: GenerateExpensesRequest | None = None
):
    """
    Generate Expense records from fixed expense templates.

    This creates pending Expense records that need to be paid manually.
    Generated expenses appear in the regular expense list for payment.

    Options:
    - **fixed_expense_ids**: Generate only specific templates (default: all due)
    - **target_date**: Generate for a specific date (default: today)
    - **override_amounts**: Override amounts for specific templates (for variable expenses)

    If no request body is provided, generates all due expenses for today.
    """
    service = FixedExpenseService(db)

    if request is None:
        request = GenerateExpensesRequest()

    try:
        result = await service.generate_expenses(request, created_by=current_user.id)
        await db.commit()
        return result
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
            detail=f"Error generating expenses: {str(e)}"
        )


@router.post(
    "/{fixed_expense_id}/generate",
    response_model=dict,
    dependencies=[Depends(require_any_school_admin)]
)
async def generate_single_expense(
    fixed_expense_id: UUID,
    db: DatabaseSession,
    current_user: CurrentUser,
    amount: Decimal | None = Query(None, gt=0, description="Override amount"),
    expense_date: date | None = Query(None, description="Expense date (default: today)")
):
    """
    Generate a single expense from a fixed expense template.

    Useful for manually triggering expense generation or generating
    with a custom amount for variable expenses.
    """
    service = FixedExpenseService(db)

    try:
        expense = await service.generate_single_expense(
            fixed_expense_id,
            amount=amount,
            expense_date=expense_date,
            created_by=current_user.id
        )

        if not expense:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Fixed expense not found"
            )

        await db.commit()

        return {
            "message": "Expense generated successfully",
            "expense_id": str(expense.id),
            "amount": float(expense.amount),
            "expense_date": expense.expense_date.isoformat(),
            "due_date": expense.due_date.isoformat() if expense.due_date else None
        }
    except HTTPException:
        raise
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
            detail=f"Error generating expense: {str(e)}"
        )


@router.get(
    "/{fixed_expense_id}/history",
    response_model=list[dict],
    dependencies=[Depends(require_any_school_admin)]
)
async def get_expense_history(
    fixed_expense_id: UUID,
    db: DatabaseSession,
    limit: int = Query(12, ge=1, le=100, description="Number of records to return")
):
    """
    Get the history of generated expenses for a fixed expense template.

    Returns the most recent generated expenses, useful for tracking
    payment history and patterns.
    """
    service = FixedExpenseService(db)

    # Verify fixed expense exists
    fixed_expense = await service.get(fixed_expense_id)
    if not fixed_expense:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Fixed expense not found"
        )

    expenses = await service.get_generated_expenses(fixed_expense_id, limit=limit)

    return [
        {
            "id": str(e.id),
            "description": e.description,
            "amount": float(e.amount),
            "amount_paid": float(e.amount_paid),
            "balance": float(e.balance),
            "is_paid": e.is_paid,
            "expense_date": e.expense_date.isoformat(),
            "due_date": e.due_date.isoformat() if e.due_date else None,
            "payment_method": e.payment_method,
            "paid_at": e.paid_at.isoformat() if e.paid_at else None
        }
        for e in expenses
    ]
