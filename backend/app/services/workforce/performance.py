"""
Performance Service - Employee performance metrics and reviews
"""
from uuid import UUID
from decimal import Decimal
from datetime import date
from sqlalchemy import select, and_, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.utils.timezone import get_colombia_date, get_colombia_now_naive, get_colombia_datetime_range_naive
from app.models.workforce import PerformanceReview, ReviewPeriod
from app.models.payroll import Employee
from app.models.sale import Sale
from app.schemas.workforce import (
    EmployeePerformanceMetrics,
    PerformanceSummaryItem,
    ReviewGenerateRequest,
    ReviewUpdateRequest,
)
from app.services.workforce.attendance import attendance_service
from app.services.workforce.checklists import checklist_service


# Score weights
WEIGHT_ATTENDANCE = Decimal("30")
WEIGHT_PUNCTUALITY = Decimal("20")
WEIGHT_CHECKLISTS = Decimal("30")
WEIGHT_SALES = Decimal("20")


class PerformanceService:
    """Service for performance metrics and reviews"""

    # ============================================
    # Real-time Metrics
    # ============================================

    async def get_employee_metrics(
        self,
        db: AsyncSession,
        employee_id: UUID,
        period_start: date,
        period_end: date,
    ) -> EmployeePerformanceMetrics:
        """Calculate real-time performance metrics for an employee"""
        # Get employee
        stmt = select(Employee).where(Employee.id == employee_id)
        result = await db.execute(stmt)
        employee = result.scalar_one_or_none()
        if not employee:
            raise ValueError("Empleado no encontrado")

        # Attendance rate
        attendance_rate = await attendance_service.get_attendance_rate(
            db, employee_id, period_start, period_end
        )

        # Punctuality rate
        punctuality_rate = await attendance_service.get_punctuality_rate(
            db, employee_id, period_start, period_end
        )

        # Checklist completion rate
        checklist_rate = await checklist_service.get_completion_rate(
            db, employee_id, period_start, period_end
        )

        # Sales metrics (via user_id link)
        sales_amount = Decimal("0")
        sales_count = 0
        if employee.user_id:
            sales_amount, sales_count = await self._get_sales_metrics(
                db, employee.user_id, period_start, period_end
            )

        # Overall score
        overall_score = self._calculate_overall_score(
            attendance_rate, punctuality_rate, checklist_rate,
            has_sales=employee.user_id is not None,
        )

        return EmployeePerformanceMetrics(
            employee_id=employee_id,
            employee_name=employee.full_name,
            period_start=period_start,
            period_end=period_end,
            attendance_rate=attendance_rate,
            punctuality_rate=punctuality_rate,
            checklist_completion_rate=checklist_rate,
            total_sales_amount=sales_amount,
            total_sales_count=sales_count,
            overall_score=overall_score,
        )

    async def get_all_employees_summary(
        self,
        db: AsyncSession,
        period_start: date | None = None,
        period_end: date | None = None,
    ) -> list[PerformanceSummaryItem]:
        """Get performance summary for all active employees"""
        if period_end is None:
            period_end = get_colombia_date()
        if period_start is None:
            # Default to last 30 days
            from datetime import timedelta
            period_start = period_end - timedelta(days=30)

        stmt = select(Employee).where(Employee.is_active == True).order_by(Employee.full_name)
        result = await db.execute(stmt)
        employees = list(result.scalars().all())

        summaries = []
        for emp in employees:
            attendance_rate = await attendance_service.get_attendance_rate(
                db, emp.id, period_start, period_end
            )
            punctuality_rate = await attendance_service.get_punctuality_rate(
                db, emp.id, period_start, period_end
            )
            checklist_rate = await checklist_service.get_completion_rate(
                db, emp.id, period_start, period_end
            )
            overall = self._calculate_overall_score(
                attendance_rate, punctuality_rate, checklist_rate,
                has_sales=emp.user_id is not None,
            )

            summaries.append(PerformanceSummaryItem(
                employee_id=emp.id,
                employee_name=emp.full_name,
                position=emp.position,
                attendance_rate=attendance_rate,
                punctuality_rate=punctuality_rate,
                checklist_completion_rate=checklist_rate,
                overall_score=overall,
            ))

        # Sort by overall score descending
        summaries.sort(key=lambda x: x.overall_score, reverse=True)
        return summaries

    # ============================================
    # Reviews
    # ============================================

    async def get_reviews(
        self,
        db: AsyncSession,
        *,
        employee_id: UUID | None = None,
        review_period: ReviewPeriod | None = None,
    ) -> list[PerformanceReview]:
        """Get performance reviews"""
        stmt = select(PerformanceReview).options(
            selectinload(PerformanceReview.employee)
        )
        if employee_id is not None:
            stmt = stmt.where(PerformanceReview.employee_id == employee_id)
        if review_period is not None:
            stmt = stmt.where(PerformanceReview.review_period == review_period)
        stmt = stmt.order_by(PerformanceReview.period_end.desc())
        result = await db.execute(stmt)
        return list(result.scalars().all())

    async def get_review(
        self,
        db: AsyncSession,
        review_id: UUID,
    ) -> PerformanceReview | None:
        """Get a single review"""
        stmt = (
            select(PerformanceReview)
            .options(selectinload(PerformanceReview.employee))
            .where(PerformanceReview.id == review_id)
        )
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    async def generate_review(
        self,
        db: AsyncSession,
        data: ReviewGenerateRequest,
        *,
        reviewed_by: UUID | None = None,
    ) -> PerformanceReview:
        """Generate a performance review (snapshot of metrics)"""
        metrics = await self.get_employee_metrics(
            db, data.employee_id, data.period_start, data.period_end
        )

        # Get sales data
        stmt = select(Employee).where(Employee.id == data.employee_id)
        result = await db.execute(stmt)
        employee = result.scalar_one_or_none()

        sales_amount = Decimal("0")
        sales_count = 0
        if employee and employee.user_id:
            sales_amount, sales_count = await self._get_sales_metrics(
                db, employee.user_id, data.period_start, data.period_end
            )

        review = PerformanceReview(
            employee_id=data.employee_id,
            review_period=data.review_period,
            period_start=data.period_start,
            period_end=data.period_end,
            attendance_rate=metrics.attendance_rate,
            punctuality_rate=metrics.punctuality_rate,
            checklist_completion_rate=metrics.checklist_completion_rate,
            total_sales_amount=sales_amount,
            total_sales_count=sales_count,
            overall_score=metrics.overall_score,
            reviewed_by=reviewed_by,
            reviewed_at=get_colombia_now_naive() if reviewed_by else None,
        )
        db.add(review)
        await db.commit()
        await db.refresh(review)
        return review

    async def update_review(
        self,
        db: AsyncSession,
        review_id: UUID,
        data: ReviewUpdateRequest,
        *,
        reviewed_by: UUID | None = None,
    ) -> PerformanceReview:
        """Update a review (add reviewer notes)"""
        review = await self.get_review(db, review_id)
        if not review:
            raise ValueError("Evaluacion no encontrada")

        if data.reviewer_notes is not None:
            review.reviewer_notes = data.reviewer_notes
        if reviewed_by:
            review.reviewed_by = reviewed_by
            review.reviewed_at = get_colombia_now_naive()

        await db.commit()
        await db.refresh(review)
        return review

    # ============================================
    # Helpers
    # ============================================

    async def _get_sales_metrics(
        self,
        db: AsyncSession,
        user_id: UUID,
        period_start: date,
        period_end: date,
    ) -> tuple[Decimal, int]:
        """Get sales metrics for an employee via their user_id"""
        # Use datetime ranges for precise filtering in Colombia timezone
        start_dt, _ = get_colombia_datetime_range_naive(period_start)
        _, end_dt = get_colombia_datetime_range_naive(period_end)
        stmt = select(
            func.coalesce(func.sum(Sale.total), 0),
            func.count(Sale.id),
        ).where(
            and_(
                Sale.user_id == user_id,
                Sale.created_at >= start_dt,
                Sale.created_at <= end_dt,
            )
        )
        result = await db.execute(stmt)
        row = result.one()
        return Decimal(str(row[0])), int(row[1])

    @staticmethod
    def _calculate_overall_score(
        attendance_rate: Decimal,
        punctuality_rate: Decimal,
        checklist_rate: Decimal,
        *,
        has_sales: bool = False,
    ) -> Decimal:
        """Calculate weighted overall score"""
        if has_sales:
            # Standard weights: 30/20/30/20
            score = (
                attendance_rate * WEIGHT_ATTENDANCE +
                punctuality_rate * WEIGHT_PUNCTUALITY +
                checklist_rate * WEIGHT_CHECKLISTS
            ) / (WEIGHT_ATTENDANCE + WEIGHT_PUNCTUALITY + WEIGHT_CHECKLISTS + WEIGHT_SALES)
            # Note: sales weight is included in denominator but sales metric
            # would need normalization - for now, score is based on non-sales metrics
            # weighted proportionally
        else:
            # Without sales: redistribute equally among 3 metrics
            total_weight = WEIGHT_ATTENDANCE + WEIGHT_PUNCTUALITY + WEIGHT_CHECKLISTS
            score = (
                attendance_rate * WEIGHT_ATTENDANCE +
                punctuality_rate * WEIGHT_PUNCTUALITY +
                checklist_rate * WEIGHT_CHECKLISTS
            ) / total_weight

        return Decimal(str(round(float(score), 2)))


# Singleton
performance_service = PerformanceService()
