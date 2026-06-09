"""
CFO Dashboard API Routes - Executive financial health metrics

Ruta delgada: toda la lógica vive en
`app.services.accounting.financial_model.cfo_dashboard.CFODashboardService`.
"""
from fastapi import APIRouter, Depends

from app.api.dependencies import DatabaseSession, CurrentUser, require_global_permission
from app.api.error_responses import AUTHENTICATED
from app.services.accounting.financial_model.cfo_dashboard import CFODashboardService


router = APIRouter(prefix="/cfo-dashboard", tags=["CFO Dashboard"])


@router.get(
    "/health-metrics",
    summary="Get CFO financial health metrics",
    description="Returns comprehensive financial health indicators for executive decision-making",
    dependencies=[Depends(require_global_permission("reports.financial"))],
    responses=AUTHENTICATED,
    operation_id="getCfoHealthMetrics",
)
async def get_health_metrics(
    db: DatabaseSession,
    current_user: CurrentUser,
):
    """
    Get comprehensive CFO dashboard metrics.

    Includes cash runway, debt service coverage ratio, payroll coverage status,
    data quality score, and urgent alerts count.

    **Auth:** Bearer JWT (staff)
    **Permission:** `reports.financial` (global)
    """
    return await CFODashboardService(db).get_health_metrics()
