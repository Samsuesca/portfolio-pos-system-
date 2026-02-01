"""
Workforce Performance Routes - Performance metrics and reviews
"""
from uuid import UUID
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, status, Query

from app.api.dependencies import DatabaseSession, CurrentUser, require_global_permission
from app.services.workforce.performance import performance_service
from app.models.workforce import ReviewPeriod
from app.schemas.workforce import (
    EmployeePerformanceMetrics,
    PerformanceSummaryItem,
    ReviewGenerateRequest,
    ReviewUpdateRequest,
    PerformanceReviewResponse,
)

router = APIRouter(prefix="/global/workforce", tags=["Workforce - Performance"])


# ============================================
# Metrics
# ============================================

@router.get(
    "/performance/employee/{employee_id}",
    response_model=EmployeePerformanceMetrics,
    dependencies=[Depends(require_global_permission("workforce.view_performance"))],
)
async def get_employee_performance(
    employee_id: UUID,
    db: DatabaseSession,
    current_user: CurrentUser,
    period_start: date = Query(...),
    period_end: date = Query(...),
):
    """Get real-time performance metrics for an employee"""
    try:
        return await performance_service.get_employee_metrics(
            db, employee_id, period_start, period_end
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get(
    "/performance/summary",
    response_model=list[PerformanceSummaryItem],
    dependencies=[Depends(require_global_permission("workforce.view_performance"))],
)
async def get_performance_summary(
    db: DatabaseSession,
    current_user: CurrentUser,
    period_start: date | None = Query(None),
    period_end: date | None = Query(None),
):
    """Get performance summary for all active employees"""
    return await performance_service.get_all_employees_summary(
        db, period_start=period_start, period_end=period_end
    )


# ============================================
# Reviews
# ============================================

@router.get(
    "/performance/reviews",
    response_model=list[PerformanceReviewResponse],
    dependencies=[Depends(require_global_permission("workforce.view_performance"))],
)
async def list_reviews(
    db: DatabaseSession,
    current_user: CurrentUser,
    employee_id: UUID | None = Query(None),
    review_period: ReviewPeriod | None = Query(None),
):
    """List performance reviews"""
    reviews = await performance_service.get_reviews(
        db, employee_id=employee_id, review_period=review_period
    )
    return [_review_to_response(r) for r in reviews]


@router.post(
    "/performance/reviews/generate",
    response_model=PerformanceReviewResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_global_permission("workforce.manage_performance"))],
)
async def generate_review(
    data: ReviewGenerateRequest,
    db: DatabaseSession,
    current_user: CurrentUser,
):
    """Generate a performance review (snapshot of metrics)"""
    try:
        review = await performance_service.generate_review(
            db, data, reviewed_by=current_user.id
        )
        return _review_to_response(review)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get(
    "/performance/reviews/{review_id}",
    response_model=PerformanceReviewResponse,
    dependencies=[Depends(require_global_permission("workforce.view_performance"))],
)
async def get_review(
    review_id: UUID,
    db: DatabaseSession,
    current_user: CurrentUser,
):
    """Get a single performance review"""
    review = await performance_service.get_review(db, review_id)
    if not review:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Evaluacion no encontrada",
        )
    return _review_to_response(review)


@router.patch(
    "/performance/reviews/{review_id}",
    response_model=PerformanceReviewResponse,
    dependencies=[Depends(require_global_permission("workforce.manage_performance"))],
)
async def update_review(
    review_id: UUID,
    data: ReviewUpdateRequest,
    db: DatabaseSession,
    current_user: CurrentUser,
):
    """Update a review (add reviewer notes)"""
    try:
        review = await performance_service.update_review(
            db, review_id, data, reviewed_by=current_user.id
        )
        return _review_to_response(review)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


# ============================================
# Helpers
# ============================================

def _review_to_response(review: object) -> dict:
    """Convert review ORM to response with employee name"""
    return {
        "id": review.id,
        "employee_id": review.employee_id,
        "employee_name": review.employee.full_name if review.employee else None,
        "review_period": review.review_period,
        "period_start": review.period_start,
        "period_end": review.period_end,
        "attendance_rate": review.attendance_rate,
        "punctuality_rate": review.punctuality_rate,
        "checklist_completion_rate": review.checklist_completion_rate,
        "total_sales_amount": review.total_sales_amount,
        "total_sales_count": review.total_sales_count,
        "overall_score": review.overall_score,
        "reviewer_notes": review.reviewer_notes,
        "reviewed_by": review.reviewed_by,
        "reviewed_at": review.reviewed_at,
        "created_at": review.created_at,
    }
