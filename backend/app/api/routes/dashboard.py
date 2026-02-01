"""
Global Dashboard Endpoints

Provides aggregated statistics across all schools the user has access to.
Does NOT depend on school_id - aggregates everything globally.
"""
from datetime import datetime
from uuid import UUID
from fastapi import APIRouter

from app.utils.timezone import get_colombia_now_naive
from sqlalchemy import select, func
from pydantic import BaseModel

from app.api.dependencies import DatabaseSession, CurrentUser, UserSchoolIds
from app.models.school import School
from app.models.product import Product
from app.models.client import Client
from app.models.sale import Sale
from app.models.order import Order, OrderStatus


router = APIRouter(prefix="/global/dashboard", tags=["Dashboard"])


# ============= Schemas =============

class DashboardTotals(BaseModel):
    """Global totals across all accessible schools"""
    total_sales: int
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

@router.get("/stats", response_model=GlobalDashboardStats)
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

    Returns:
        - totals: Aggregated counts and amounts
        - schools_summary: Breakdown by school
        - school_count: Number of accessible schools
    """
    if not user_school_ids:
        return GlobalDashboardStats(
            totals=DashboardTotals(
                total_sales=0,
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

    # Total sales count
    total_sales_result = await db.execute(
        select(func.count(Sale.id))
        .where(Sale.school_id.in_(user_school_ids))
    )
    total_sales = total_sales_result.scalar() or 0

    # Sales amount this month
    sales_amount_result = await db.execute(
        select(func.coalesce(func.sum(Sale.total), 0))
        .where(Sale.school_id.in_(user_school_ids))
        .where(Sale.created_at >= month_start)
    )
    sales_amount_month = float(sales_amount_result.scalar() or 0)

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

    # Total clients count
    total_clients_result = await db.execute(
        select(func.count(Client.id))
        .where(Client.school_id.in_(user_school_ids))
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
        # Sales count this month for this school
        school_sales_result = await db.execute(
            select(func.count(Sale.id), func.coalesce(func.sum(Sale.total), 0))
            .where(Sale.school_id == school.id)
            .where(Sale.created_at >= month_start)
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
            sales_amount_month=sales_amount_month,
            total_orders=total_orders,
            pending_orders=pending_orders,
            total_clients=total_clients,
            total_products=total_products
        ),
        schools_summary=schools_summary,
        school_count=len(schools)
    )
