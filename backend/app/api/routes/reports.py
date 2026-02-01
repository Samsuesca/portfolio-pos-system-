"""
Reports Endpoints - Business analytics and reporting
"""
from uuid import UUID
from datetime import date
from fastapi import APIRouter, Query, Depends

from app.api.dependencies import DatabaseSession, require_school_access
from app.models.user import UserRole
from app.services.reports import ReportsService


router = APIRouter(prefix="/schools/{school_id}/reports", tags=["Reports"])


@router.get(
    "/dashboard",
    dependencies=[Depends(require_school_access(UserRole.VIEWER))]
)
async def get_dashboard_summary(
    school_id: UUID,
    db: DatabaseSession
):
    """Get dashboard summary with key metrics"""
    reports_service = ReportsService(db)
    return await reports_service.get_dashboard_summary(school_id)


@router.get(
    "/sales/daily",
    dependencies=[Depends(require_school_access(UserRole.VIEWER))]
)
async def get_daily_sales(
    school_id: UUID,
    db: DatabaseSession,
    target_date: date | None = Query(None, description="Date to query (defaults to today)")
):
    """Get sales for a specific day"""
    reports_service = ReportsService(db)
    return await reports_service.get_daily_sales(school_id, target_date)


@router.get(
    "/sales/summary",
    dependencies=[Depends(require_school_access(UserRole.VIEWER))]
)
async def get_sales_summary(
    school_id: UUID,
    db: DatabaseSession,
    start_date: date | None = Query(None, description="Start date"),
    end_date: date | None = Query(None, description="End date")
):
    """Get sales summary for a period"""
    reports_service = ReportsService(db)
    return await reports_service.get_sales_summary(school_id, start_date, end_date)


@router.get(
    "/sales/top-products",
    dependencies=[Depends(require_school_access(UserRole.VIEWER))]
)
async def get_top_products(
    school_id: UUID,
    db: DatabaseSession,
    limit: int = Query(10, ge=1, le=50),
    start_date: date | None = Query(None),
    end_date: date | None = Query(None)
):
    """Get top selling products"""
    reports_service = ReportsService(db)
    return await reports_service.get_top_products(school_id, limit, start_date, end_date)


@router.get(
    "/inventory/low-stock",
    dependencies=[Depends(require_school_access(UserRole.VIEWER))]
)
async def get_low_stock(
    school_id: UUID,
    db: DatabaseSession,
    threshold: int = Query(5, ge=1, description="Stock threshold")
):
    """Get products with low stock"""
    reports_service = ReportsService(db)
    return await reports_service.get_low_stock_products(school_id, threshold)


@router.get(
    "/inventory/value",
    dependencies=[Depends(require_school_access(UserRole.VIEWER))]
)
async def get_inventory_value(
    school_id: UUID,
    db: DatabaseSession
):
    """Get total inventory value"""
    reports_service = ReportsService(db)
    return await reports_service.get_inventory_value(school_id)


@router.get(
    "/orders/pending",
    dependencies=[Depends(require_school_access(UserRole.VIEWER))]
)
async def get_pending_orders(
    school_id: UUID,
    db: DatabaseSession
):
    """Get pending orders"""
    reports_service = ReportsService(db)
    return await reports_service.get_pending_orders(school_id)


@router.get(
    "/clients/top",
    dependencies=[Depends(require_school_access(UserRole.VIEWER))]
)
async def get_top_clients(
    school_id: UUID,
    db: DatabaseSession,
    limit: int = Query(10, ge=1, le=50),
    start_date: date | None = Query(None, description="Start date for sales filter"),
    end_date: date | None = Query(None, description="End date for sales filter")
):
    """Get top clients by purchase amount (with optional date filter)"""
    reports_service = ReportsService(db)
    return await reports_service.get_top_clients(school_id, limit, start_date, end_date)
