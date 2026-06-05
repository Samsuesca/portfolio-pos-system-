"""
Cost Insights Routes — endpoints agregados para el dashboard de costos.

Gated por `inventory.view_cost` (mismo permiso que el resto del módulo de
costos). Multi-tenant: filtran por `user_school_ids` excepto superuser.

Todas las queries hacen 1 round-trip y agregan en SQL (sin N+1).
"""
from typing import Literal
from fastapi import APIRouter, Depends, Query

from app.api.dependencies import (
    DatabaseSession, CurrentUser, UserSchoolIds,
    require_global_permission,
)
from app.api.error_responses import AUTHENTICATED
from app.schemas.cost_insights import (
    CostInsightsSummary,
    SchoolCostBreakdown,
    TopMarginProduct,
    ComponentDistribution,
)
from app.services.cost_insights import CostInsightsService


router = APIRouter(prefix="/global/cost-insights", tags=["Cost Insights"])


def _scope(current_user, user_school_ids):
    """None si superuser (sin filtro), lista si no."""
    return None if current_user.is_superuser else list(user_school_ids)


@router.get(
    "/summary",
    response_model=CostInsightsSummary,
    dependencies=[Depends(require_global_permission("inventory.view_cost"))],
    responses=AUTHENTICATED,
    operation_id="getCostInsightsSummary",
)
async def get_summary(
    db: DatabaseSession,
    current_user: CurrentUser,
    user_school_ids: UserSchoolIds,
):
    """KPIs globales: cobertura, márgenes, underwater, etc."""
    service = CostInsightsService(db)
    return await service.get_summary(_scope(current_user, user_school_ids))


@router.get(
    "/by-school",
    response_model=list[SchoolCostBreakdown],
    dependencies=[Depends(require_global_permission("inventory.view_cost"))],
    responses=AUTHENTICATED,
    operation_id="getCostInsightsBySchool",
)
async def get_by_school(
    db: DatabaseSession,
    current_user: CurrentUser,
    user_school_ids: UserSchoolIds,
):
    """Tabla comparativa por colegio. Productos globales como fila 'GLOBAL'."""
    service = CostInsightsService(db)
    return await service.get_by_school(_scope(current_user, user_school_ids))


@router.get(
    "/top-margin",
    response_model=list[TopMarginProduct],
    dependencies=[Depends(require_global_permission("inventory.view_cost"))],
    responses=AUTHENTICATED,
    operation_id="getCostInsightsTopMargin",
)
async def get_top_margin(
    db: DatabaseSession,
    current_user: CurrentUser,
    user_school_ids: UserSchoolIds,
    direction: Literal["best", "worst"] = Query("best"),
    limit: int = Query(10, ge=1, le=50),
):
    """Ranking de productos por margen (mejor o peor)."""
    service = CostInsightsService(db)
    return await service.get_top_margin(
        _scope(current_user, user_school_ids),
        direction=direction,
        limit=limit,
    )


@router.get(
    "/component-distribution",
    response_model=list[ComponentDistribution],
    dependencies=[Depends(require_global_permission("inventory.view_cost"))],
    responses=AUTHENTICATED,
    operation_id="getCostInsightsComponentDistribution",
)
async def get_component_distribution(
    db: DatabaseSession,
    current_user: CurrentUser,
    user_school_ids: UserSchoolIds,
):
    """Distribución del costo total por componente (PieChart)."""
    service = CostInsightsService(db)
    return await service.get_component_distribution(_scope(current_user, user_school_ids))
