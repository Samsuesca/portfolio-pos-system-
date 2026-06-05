"""
Workforce Performance Routes - Performance metrics and reviews
"""
from uuid import UUID
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, status, Query

from app.api.dependencies import DatabaseSession, CurrentUser, require_global_permission
from app.api.error_responses import responses, AUTHENTICATED
from app.services.workforce.performance import performance_service
from app.models.workforce import ReviewPeriod
from app.schemas.workforce import (
    EmployeePerformanceMetrics,
    PerformanceSummaryItem,
    PerformanceStatsResponse,
    ReviewGenerateRequest,
    ReviewUpdateRequest,
    PerformanceReviewResponse,
)
from app.schemas.base import PaginatedResponse, paginate

router = APIRouter(prefix="/global/workforce", tags=["Workforce - Performance"])


# ============================================
# Metrics
# ============================================

@router.get(
    "/performance/employee/{employee_id}",
    response_model=EmployeePerformanceMetrics,
    dependencies=[Depends(require_global_permission("workforce.view_performance"))],
    responses=responses(404),
    operation_id="getEmployeePerformance",
)
async def get_employee_performance(
    employee_id: UUID,
    db: DatabaseSession,
    current_user: CurrentUser,
    period_start: date = Query(...),
    period_end: date = Query(...),
):
    """
    Get real-time performance metrics for an employee in a date range.

    **Auth:** Bearer JWT (staff)
    **Permission:** `workforce.view_performance` (global)
    """
    try:
        return await performance_service.get_employee_metrics(
            db, employee_id, period_start, period_end
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get(
    "/performance/summary",
    response_model=PaginatedResponse[PerformanceSummaryItem],
    dependencies=[Depends(require_global_permission("workforce.view_performance"))],
    responses=AUTHENTICATED,
    operation_id="getPerformanceSummary",
)
async def get_performance_summary(
    db: DatabaseSession,
    current_user: CurrentUser,
    period_start: date | None = Query(None),
    period_end: date | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
):
    """
    Get performance summary for all active employees.

    **Auth:** Bearer JWT (staff)
    **Permission:** `workforce.view_performance` (global)
    """
    summaries = await performance_service.get_all_employees_summary(
        db, period_start=period_start, period_end=period_end
    )
    total = len(summaries)
    items = summaries[skip:skip + limit]
    return PaginatedResponse[PerformanceSummaryItem](**paginate(items, total, skip, limit))


@router.get(
    "/performance/stats",
    response_model=PerformanceStatsResponse,
    dependencies=[Depends(require_global_permission("workforce.view_performance"))],
    responses=AUTHENTICATED,
    operation_id="getPerformanceStats",
)
async def get_performance_stats(
    db: DatabaseSession,
    current_user: CurrentUser,
    period_start: date | None = Query(None),
    period_end: date | None = Query(None),
):
    """
    Aggregated performance KPIs across all employees in a period.

    Returns total/avg/top/needs-attention counts so dashboards reflect the
    full population instead of the currently paginated rows of /summary.

    **Auth:** Bearer JWT (staff)
    **Permission:** `workforce.view_performance` (global)
    """
    summaries = await performance_service.get_all_employees_summary(
        db, period_start=period_start, period_end=period_end
    )
    total = len(summaries)
    if total == 0:
        return PerformanceStatsResponse(
            total_employees=0, avg_score=0, top_performers=0, needs_attention=0
        )
    avg_score = int(sum(int(s.overall_score) for s in summaries) / total)
    top_performers = sum(1 for s in summaries if s.overall_score >= 90)
    needs_attention = sum(1 for s in summaries if s.overall_score < 50)
    return PerformanceStatsResponse(
        total_employees=total,
        avg_score=avg_score,
        top_performers=top_performers,
        needs_attention=needs_attention,
    )


# ============================================
# Reviews
# ============================================

@router.get(
    "/performance/reviews",
    response_model=PaginatedResponse[PerformanceReviewResponse],
    dependencies=[Depends(require_global_permission("workforce.view_performance"))],
    responses=AUTHENTICATED,
    operation_id="listPerformanceReviews",
)
async def list_reviews(
    db: DatabaseSession,
    current_user: CurrentUser,
    employee_id: UUID | None = Query(None),
    review_period: ReviewPeriod | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
):
    """
    List performance reviews with optional employee and period filters.

    **Auth:** Bearer JWT (staff)
    **Permission:** `workforce.view_performance` (global)
    """
    reviews = await performance_service.get_reviews(
        db, employee_id=employee_id, review_period=review_period
    )
    total = len(reviews)
    items = [_review_to_response(r) for r in reviews[skip:skip + limit]]
    return PaginatedResponse[PerformanceReviewResponse](**paginate(items, total, skip, limit))


@router.post(
    "/performance/reviews/generate",
    response_model=PerformanceReviewResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_global_permission("workforce.manage_performance"))],
    responses=responses(400),
    operation_id="generatePerformanceReview",
)
async def generate_review(
    data: ReviewGenerateRequest,
    db: DatabaseSession,
    current_user: CurrentUser,
):
    """
    Generate a performance review as a snapshot of current metrics.

    **Auth:** Bearer JWT (staff)
    **Permission:** `workforce.manage_performance` (global)
    """
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
    responses=responses(404),
    operation_id="getPerformanceReview",
)
async def get_review(
    review_id: UUID,
    db: DatabaseSession,
    current_user: CurrentUser,
):
    """
    Get a single performance review by ID.

    **Auth:** Bearer JWT (staff)
    **Permission:** `workforce.view_performance` (global)
    """
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
    responses=responses(404),
    operation_id="updatePerformanceReview",
)
async def update_review(
    review_id: UUID,
    data: ReviewUpdateRequest,
    db: DatabaseSession,
    current_user: CurrentUser,
):
    """
    Update a review with reviewer notes.

    **Auth:** Bearer JWT (staff)
    **Permission:** `workforce.manage_performance` (global)
    """
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
