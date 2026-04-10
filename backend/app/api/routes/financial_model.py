"""
Financial Model Routes - Global accounting financial analysis

All endpoints under /global/accounting/financial-model/
"""
from uuid import UUID
from datetime import date
from decimal import Decimal
from fastapi import APIRouter, HTTPException, status, Query, Depends

from app.api.dependencies import DatabaseSession, CurrentUser, require_any_school_admin
from app.schemas.financial_model import (
    KPIDashboardResponse,
    ProfitabilityResponse,
    TrendAnalysisResponse,
    BudgetCreate, BudgetResponse, BudgetVsActualResponse,
    CashForecastResponse,
    HealthAlertsResponse,
    ExecutiveSummaryResponse,
)
from app.services.accounting.financial_model.kpis import KPIService
from app.services.accounting.financial_model.profitability import ProfitabilityService
from app.services.accounting.financial_model.trends import TrendAnalysisService
from app.services.accounting.financial_model.budgets import BudgetService
from app.services.accounting.financial_model.forecast import CashForecastService
from app.services.accounting.financial_model.alerts import HealthAlertService
from app.services.accounting.financial_model.executive_summary import ExecutiveSummaryService

router = APIRouter(
    prefix="/global/accounting/financial-model",
    tags=["Financial Model"],
    dependencies=[Depends(require_any_school_admin)],
)


# ============================================
# Module 1: KPI Dashboard
# ============================================

@router.get("/kpis", response_model=KPIDashboardResponse)
async def get_kpis(
    db: DatabaseSession,
    period: str = Query("monthly", description="Period type"),
    months: int = Query(6, ge=1, le=24, description="Number of months to analyze"),
    school_id: UUID | None = Query(None, description="Optional school filter"),
):
    """Get financial KPIs dashboard"""
    service = KPIService(db)
    return await service.compute_kpis(months=months, school_id=school_id)


# ============================================
# Module 2: Profitability by School
# ============================================

@router.get("/profitability/by-school", response_model=ProfitabilityResponse)
async def get_profitability_by_school(
    db: DatabaseSession,
    start_date: date | None = Query(None),
    end_date: date | None = Query(None),
    school_ids: str | None = Query(None, description="Comma-separated school UUIDs"),
):
    """Get profitability analysis broken down by school"""
    parsed_ids = None
    if school_ids:
        try:
            parsed_ids = [UUID(sid.strip()) for sid in school_ids.split(",")]
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="school_ids must be comma-separated valid UUIDs"
            )
    service = ProfitabilityService(db)
    return await service.get_profitability_by_school(
        start_date=start_date, end_date=end_date, school_ids=parsed_ids
    )


# ============================================
# Module 3: Trend Analysis
# ============================================

@router.get("/trends", response_model=TrendAnalysisResponse)
async def get_trends(
    db: DatabaseSession,
    metrics: str = Query("revenue,expenses,profit", description="Comma-separated metrics"),
    period: str = Query("monthly"),
    start_date: date | None = Query(None),
    end_date: date | None = Query(None),
):
    """Get historical trend analysis"""
    metric_list = [m.strip() for m in metrics.split(",")]
    service = TrendAnalysisService(db)
    return await service.get_trends(
        metrics=metric_list, period=period,
        start_date=start_date, end_date=end_date
    )


# ============================================
# Module 4: Budget vs Actual
# ============================================

@router.get("/budgets", response_model=list[BudgetResponse])
async def get_budgets(
    db: DatabaseSession,
    period_type: str | None = Query(None),
    period_start: date | None = Query(None),
):
    """List budgets"""
    service = BudgetService(db)
    return await service.get_budgets(period_type=period_type, period_start=period_start)


@router.post("/budgets", response_model=BudgetResponse, status_code=status.HTTP_201_CREATED)
async def create_budget(
    data: BudgetCreate,
    db: DatabaseSession,
    current_user: CurrentUser,
):
    """Create a budget entry"""
    service = BudgetService(db)
    result = await service.create_budget(data.model_dump(), created_by=current_user.id)
    await db.commit()
    return result


@router.delete("/budgets/{budget_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_budget(
    budget_id: UUID,
    db: DatabaseSession,
    current_user: CurrentUser,
):
    """Delete a budget entry"""
    service = BudgetService(db)
    deleted = await service.delete_budget(budget_id, requesting_user=current_user)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Budget not found"
        )
    await db.commit()


@router.get("/budget-vs-actual", response_model=BudgetVsActualResponse)
async def get_budget_vs_actual(
    db: DatabaseSession,
    period_type: str = Query(..., description="monthly, quarterly, or annual"),
    period_start: date = Query(..., description="Start date of the period"),
):
    """Get budget vs actual comparison"""
    service = BudgetService(db)
    return await service.get_budget_vs_actual(
        period_type=period_type, period_start=period_start
    )


# ============================================
# Module 5: Cash Flow Forecast
# ============================================

@router.get("/cash-forecast", response_model=CashForecastResponse)
async def get_cash_forecast(
    db: DatabaseSession,
    weeks: int = Query(4, ge=0, le=12),
    months: int = Query(6, ge=1, le=24),
    min_threshold: Decimal = Query(Decimal("500000")),
):
    """Get advanced cash flow forecast with 3 scenarios"""
    service = CashForecastService(db)
    return await service.get_forecast(
        weeks=weeks, months=months, min_threshold=min_threshold
    )


# ============================================
# Module 6: Health Alerts
# ============================================

@router.get("/health-alerts", response_model=HealthAlertsResponse)
async def get_health_alerts(
    db: DatabaseSession,
):
    """Get financial health alerts"""
    service = HealthAlertService(db)
    return await service.get_alerts()


# ============================================
# Module 7: Executive Summary
# ============================================

@router.get("/executive-summary", response_model=ExecutiveSummaryResponse)
async def get_executive_summary(
    db: DatabaseSession,
    period: str | None = Query(None, description="Period as YYYY-MM"),
):
    """Get executive financial summary"""
    service = ExecutiveSummaryService(db)
    try:
        return await service.get_summary(period=period)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
