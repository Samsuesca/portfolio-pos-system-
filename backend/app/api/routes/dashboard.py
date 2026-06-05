"""
Global Dashboard Endpoints

Provides aggregated statistics across all schools the user has access to.
Does NOT depend on school_id - aggregates everything globally.
"""
from datetime import datetime
from uuid import UUID
from fastapi import APIRouter, Depends

from app.utils.timezone import get_colombia_now_naive
from sqlalchemy import select, func
from pydantic import BaseModel

from app.api.dependencies import DatabaseSession, CurrentUser, UserSchoolIds, require_global_permission
from app.api.error_responses import responses, AUTHENTICATED
from app.models.school import School
from app.models.product import Product
from app.models.client import Client
from app.models.sale import Sale, SaleStatus
from app.models.order import Order, OrderStatus


router = APIRouter(prefix="/global/dashboard", tags=["Dashboard"])


# ============= Schemas =============

class DashboardTotals(BaseModel):
    """Global totals across all accessible schools"""
    total_sales: int  # All-time count (excludes cancelled)
    sales_amount_total: float  # All-time revenue (excludes cancelled)
    sales_count_month: int
    sales_amount_month: float
    total_orders: int
    pending_orders: int
    total_clients: int
    total_products: int


class SchoolSummaryItem(BaseModel):
    """Summary for a single school"""
    school_id: str
    school_name: str
    school_code: str
    sales_count: int
    sales_amount: float
    pending_orders: int


class GlobalDashboardStats(BaseModel):
    """Complete global dashboard response"""
    totals: DashboardTotals
    schools_summary: list[SchoolSummaryItem]
    school_count: int


# ============= Endpoints =============

@router.get("/stats", response_model=GlobalDashboardStats, dependencies=[Depends(require_global_permission("reports.dashboard"))], responses=AUTHENTICATED, operation_id="getGlobalDashboardStats")
async def get_global_dashboard_stats(
    db: DatabaseSession,
    current_user: CurrentUser,
    user_school_ids: UserSchoolIds
):
    """
    Get aggregated dashboard statistics across ALL schools the user has access to.

    This endpoint does NOT depend on a school selector - it aggregates everything.

    For superusers: Returns stats for all active schools.
    For regular users: Returns stats for schools where they have a role.

    **Auth:** Bearer JWT (staff)
    **Permission:** `reports.dashboard` (global)
    """
    if not user_school_ids:
        return GlobalDashboardStats(
            totals=DashboardTotals(
                total_sales=0,
                sales_amount_total=0,
                sales_count_month=0,
                sales_amount_month=0,
                total_orders=0,
                pending_orders=0,
                total_clients=0,
                total_products=0
            ),
            schools_summary=[],
            school_count=0
        )

    # Calculate month start for filtering
    now = get_colombia_now_naive()
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    # ======== Global Totals ========

    # All-time sales: count + amount (exclude cancelled)
    total_sales_result = await db.execute(
        select(
            func.count(Sale.id),
            func.coalesce(func.sum(Sale.total), 0),
        )
        .where(Sale.school_id.in_(user_school_ids))
        .where(Sale.status != SaleStatus.CANCELLED)
        .where(Sale.is_historical.is_(False))
    )
    total_row = total_sales_result.first()
    total_sales = total_row[0] if total_row else 0
    sales_amount_total = float(total_row[1]) if total_row else 0

    # Sales this month (use sale_date for business accuracy, exclude cancelled)
    sales_month_result = await db.execute(
        select(func.count(Sale.id), func.coalesce(func.sum(Sale.total), 0))
        .where(Sale.school_id.in_(user_school_ids))
        .where(Sale.sale_date >= month_start)
        .where(Sale.status != SaleStatus.CANCELLED)
        .where(Sale.is_historical.is_(False))
    )
    month_row = sales_month_result.first()
    sales_count_month = month_row[0] if month_row else 0
    sales_amount_month = float(month_row[1]) if month_row else 0

    # Total orders count
    total_orders_result = await db.execute(
        select(func.count(Order.id))
        .where(Order.school_id.in_(user_school_ids))
    )
    total_orders = total_orders_result.scalar() or 0

    # Pending orders count (pending or in_production)
    pending_orders_result = await db.execute(
        select(func.count(Order.id))
        .where(Order.school_id.in_(user_school_ids))
        .where(Order.status.in_([OrderStatus.PENDING, OrderStatus.IN_PRODUCTION]))
    )
    pending_orders = pending_orders_result.scalar() or 0

    # Total clients count — Client is a global customer base by design
    # (school_id is legacy/nullable, client_students is optional, and many
    # clients have neither). Count all active clients — the dashboard
    # endpoint is already gated by `reports.dashboard` permission.
    total_clients_result = await db.execute(
        select(func.count(Client.id)).where(Client.is_active == True)
    )
    total_clients = total_clients_result.scalar() or 0

    # Total products count
    total_products_result = await db.execute(
        select(func.count(Product.id))
        .where(Product.school_id.in_(user_school_ids))
    )
    total_products = total_products_result.scalar() or 0

    # ======== Per-School Summary ========
    schools_summary = []

    # Get school info
    schools_result = await db.execute(
        select(School)
        .where(School.id.in_(user_school_ids))
        .where(School.is_active == True)
        .order_by(School.display_order, School.name)
    )
    schools = schools_result.scalars().all()

    for school in schools:
        # Sales count this month for this school (sale_date, exclude cancelled)
        school_sales_result = await db.execute(
            select(func.count(Sale.id), func.coalesce(func.sum(Sale.total), 0))
            .where(Sale.school_id == school.id)
            .where(Sale.sale_date >= month_start)
            .where(Sale.status != SaleStatus.CANCELLED)
            .where(Sale.is_historical.is_(False))
        )
        row = school_sales_result.first()
        school_sales_count = row[0] if row else 0
        school_sales_amount = float(row[1]) if row else 0

        # Pending orders for this school
        school_pending_result = await db.execute(
            select(func.count(Order.id))
            .where(Order.school_id == school.id)
            .where(Order.status.in_([OrderStatus.PENDING, OrderStatus.IN_PRODUCTION]))
        )
        school_pending_orders = school_pending_result.scalar() or 0

        schools_summary.append(SchoolSummaryItem(
            school_id=str(school.id),
            school_name=school.name,
            school_code=school.code,
            sales_count=school_sales_count,
            sales_amount=school_sales_amount,
            pending_orders=school_pending_orders
        ))

    return GlobalDashboardStats(
        totals=DashboardTotals(
            total_sales=total_sales,
            sales_amount_total=sales_amount_total,
            sales_count_month=sales_count_month,
            sales_amount_month=sales_amount_month,
            total_orders=total_orders,
            pending_orders=pending_orders,
            total_clients=total_clients,
            total_products=total_products
        ),
        schools_summary=schools_summary,
        school_count=len(schools)
    )
