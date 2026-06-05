"""
Global Reports Endpoints - Business-wide analytics and reporting

These endpoints provide global sales reports across all schools with optional
school filtering. Unlike /schools/{school_id}/reports, these don't require
a specific school to be selected.
"""
from uuid import UUID
from datetime import date, datetime
from decimal import Decimal
from fastapi import APIRouter, Query, Depends

from app.utils.timezone import get_colombia_date
from sqlalchemy import select, func, and_, case, union_all, exists

from app.api.dependencies import DatabaseSession, CurrentUser, require_global_permission, validate_date_range
from app.api.error_responses import responses, AUTHENTICATED
from app.models.sale import Sale, SaleItem, SalePayment, SaleStatus, PaymentMethod
from app.models.product import Product
from app.models.client import Client
from app.models.school import School
from app.services._cogs_resolver import resolved_cost, has_real_cost, DEFAULT_COST_MARGIN
from app.services.order import OrderService
from app.services.alteration import AlterationService
from app.services.permission import PermissionService
from app.services.revenue_streams import RevenueStreamService
from app.schemas.alteration import AlterationsSummary
from app.schemas.reports import (
    OrdersSummary,
    OrdersStatusFunnel,
    OrdersOnTimeDelivery,
    OrdersCumplimientoRow,
    OrdersProfitabilityResponse,
    OrdersTopProduct,
    OrdersTopClient,
    AlterationsResponseTime,
    AlterationsTopType,
    RevenueStreamId,
    RevenueBasis,
    StreamSummary,
    StreamMonthlyReport,
    StreamsBreakdownBySchool,
)


router = APIRouter(prefix="/global/reports", tags=["Global Reports"])


def _payment_breakdown_subquery():
    """Subquery yielding one row per completed-sale payment.

    Combines two sources so a sale's amount is never double-counted nor lost
    when it has multiple payment methods (cash + transfer for example):

    * For sales WITH ``SalePayment`` rows, each row contributes its own
      ``(payment_method, amount)``.
    * For sales WITHOUT ``SalePayment`` rows (legacy data or single-method
      sales created via ``Sale.payment_method`` only), the sale header
      contributes one row ``(Sale.payment_method, Sale.total)``.

    Callers add ``.where(...)`` for date / school filters and aggregate.
    The status filter (``COMPLETED``) is already applied here.
    """
    split = (
        select(
            SalePayment.payment_method.label('method'),
            SalePayment.amount.label('amount'),
            Sale.school_id.label('school_id'),
            Sale.sale_date.label('sale_date'),
            Sale.id.label('sale_id'),
        )
        .join(Sale, Sale.id == SalePayment.sale_id)
        .where(Sale.status == SaleStatus.COMPLETED, Sale.is_historical.is_(False))
    )
    header_only = (
        select(
            Sale.payment_method.label('method'),
            Sale.total.label('amount'),
            Sale.school_id.label('school_id'),
            Sale.sale_date.label('sale_date'),
            Sale.id.label('sale_id'),
        )
        .where(
            Sale.status == SaleStatus.COMPLETED, Sale.is_historical.is_(False),
            ~exists().where(SalePayment.sale_id == Sale.id),
        )
    )
    return union_all(split, header_only).subquery('payment_breakdown')


@router.get(
    "/sales/summary",
    dependencies=[Depends(require_global_permission("reports.sales"))],
    responses=AUTHENTICATED,
    operation_id="getGlobalSalesSummary",
)
async def get_global_sales_summary(
    db: DatabaseSession,
    start_date: date | None = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: date | None = Query(None, description="End date (YYYY-MM-DD)"),
    school_id: UUID | None = Query(None, description="Optional school filter")
):
    """
    Get global sales summary across all schools (or filtered by school).

    **Auth:** Bearer JWT (staff)
    **Permission:** `reports.sales` (global)

    Returns:
        - total_sales: Number of completed sales
        - total_revenue: Total revenue
        - average_ticket: Average sale amount
        - sales_by_payment: Breakdown by payment method
        - sales_by_school: Breakdown by school (when no school filter)
    """
    # Build base conditions
    conditions = [Sale.status == SaleStatus.COMPLETED, Sale.is_historical.is_(False)]

    # Date filters
    if start_date:
        start_datetime = datetime.combine(start_date, datetime.min.time())
        conditions.append(Sale.sale_date >= start_datetime)
    if end_date:
        end_datetime = datetime.combine(end_date, datetime.max.time())
        conditions.append(Sale.sale_date <= end_datetime)

    # Optional school filter
    if school_id:
        conditions.append(Sale.school_id == school_id)

    # Main aggregation query
    query = select(
        func.count(Sale.id).label('total_sales'),
        func.coalesce(func.sum(Sale.total), 0).label('total_revenue'),
        func.coalesce(func.avg(Sale.total), 0).label('average_ticket'),
    ).where(and_(*conditions))

    result = await db.execute(query)
    row = result.one()

    # Sales by payment method — respects split payments (SalePayment table)
    # when present and falls back to Sale.payment_method for sales that only
    # have a single header method recorded.
    #
    # NOTE: `count` is the number of *payment events* of that method, not the
    # number of distinct sales. A sale paid 50k cash + 30k transfer counts as
    # one event under "cash" and one under "transfer". This is the correct
    # semantic for cash-drawer reconciliation.
    breakdown = _payment_breakdown_subquery()
    payment_filters = []
    if start_date:
        payment_filters.append(
            breakdown.c.sale_date >= datetime.combine(start_date, datetime.min.time())
        )
    if end_date:
        payment_filters.append(
            breakdown.c.sale_date <= datetime.combine(end_date, datetime.max.time())
        )
    if school_id:
        payment_filters.append(breakdown.c.school_id == school_id)

    payment_query = (
        select(
            breakdown.c.method,
            func.count().label('count'),
            func.coalesce(func.sum(breakdown.c.amount), 0).label('total'),
        )
        .group_by(breakdown.c.method)
    )
    if payment_filters:
        payment_query = payment_query.where(and_(*payment_filters))

    payment_result = await db.execute(payment_query)
    payment_rows = payment_result.all()

    sales_by_payment = {}
    for p_row in payment_rows:
        method = p_row.method.value if p_row.method else 'other'
        sales_by_payment[method] = {
            'count': p_row.count,
            'total': float(p_row.total)
        }

    # Sales by school (only if no school filter)
    sales_by_school = []
    if not school_id:
        school_query = select(
            School.id,
            School.name,
            func.count(Sale.id).label('sales_count'),
            func.coalesce(func.sum(Sale.total), 0).label('revenue')
        ).join(Sale, Sale.school_id == School.id).where(
            and_(*conditions)
        ).group_by(School.id, School.name).order_by(
            func.sum(Sale.total).desc()
        )

        school_result = await db.execute(school_query)
        school_rows = school_result.all()

        sales_by_school = [
            {
                'school_id': str(s_row.id),
                'school_name': s_row.name,
                'sales_count': s_row.sales_count,
                'revenue': float(s_row.revenue)
            }
            for s_row in school_rows
        ]

    return {
        'total_sales': row.total_sales,
        'total_revenue': float(row.total_revenue),
        'average_ticket': float(row.average_ticket),
        'sales_by_payment': sales_by_payment,
        'sales_by_school': sales_by_school,
        'start_date': start_date.isoformat() if start_date else None,
        'end_date': end_date.isoformat() if end_date else None,
        'school_id': str(school_id) if school_id else None
    }


@router.get(
    "/sales/top-products",
    dependencies=[Depends(require_global_permission("reports.sales"))],
    responses=AUTHENTICATED,
    operation_id="getGlobalTopProducts",
)
async def get_global_top_products(
    db: DatabaseSession,
    limit: int = Query(10, ge=1, le=50),
    start_date: date | None = Query(None),
    end_date: date | None = Query(None),
    school_id: UUID | None = Query(None, description="Optional school filter")
):
    """
    Get top selling products across all schools (or filtered by school).

    **Auth:** Bearer JWT (staff)
    **Permission:** `reports.sales` (global)
    """
    # Build conditions
    conditions = [Sale.status == SaleStatus.COMPLETED, Sale.is_historical.is_(False)]

    if start_date:
        start_datetime = datetime.combine(start_date, datetime.min.time())
        conditions.append(Sale.sale_date >= start_datetime)
    if end_date:
        end_datetime = datetime.combine(end_date, datetime.max.time())
        conditions.append(Sale.sale_date <= end_datetime)
    if school_id:
        conditions.append(Sale.school_id == school_id)

    # Query top products
    query = select(
        SaleItem.product_id,
        Product.code,
        Product.name,
        Product.size,
        School.name.label('school_name'),
        func.sum(SaleItem.quantity).label('units_sold'),
        func.sum(SaleItem.subtotal).label('total_revenue')
    ).join(
        Sale, Sale.id == SaleItem.sale_id
    ).join(
        Product, Product.id == SaleItem.product_id
    ).join(
        School, School.id == Sale.school_id
    ).where(
        and_(*conditions)
    ).group_by(
        SaleItem.product_id, Product.code, Product.name, Product.size, School.name
    ).order_by(
        func.sum(SaleItem.quantity).desc()
    ).limit(limit)

    result = await db.execute(query)
    rows = result.all()

    return [
        {
            'product_id': str(row.product_id),
            'product_code': row.code,
            'product_name': row.name or row.code,
            'product_size': row.size,
            'school_name': row.school_name,
            'units_sold': row.units_sold,
            'total_revenue': float(row.total_revenue)
        }
        for row in rows
    ]


@router.get(
    "/sales/top-clients",
    dependencies=[Depends(require_global_permission("reports.sales"))],
    responses=AUTHENTICATED,
    operation_id="getGlobalTopClients",
)
async def get_global_top_clients(
    db: DatabaseSession,
    limit: int = Query(10, ge=1, le=50),
    start_date: date | None = Query(None),
    end_date: date | None = Query(None),
    school_id: UUID | None = Query(None, description="Optional school filter")
):
    """
    Get top clients across all schools (or filtered by school).

    **Auth:** Bearer JWT (staff)
    **Permission:** `reports.sales` (global)
    """
    # Build conditions
    conditions = [
        Client.is_active == True,
        Sale.status == SaleStatus.COMPLETED, Sale.is_historical.is_(False)
    ]

    if start_date:
        start_datetime = datetime.combine(start_date, datetime.min.time())
        conditions.append(Sale.sale_date >= start_datetime)
    if end_date:
        end_datetime = datetime.combine(end_date, datetime.max.time())
        conditions.append(Sale.sale_date <= end_datetime)
    if school_id:
        conditions.append(Client.school_id == school_id)

    query = select(
        Client.id,
        Client.code,
        Client.name,
        Client.phone,
        School.name.label('school_name'),
        func.count(Sale.id).label('total_purchases'),
        func.coalesce(func.sum(Sale.total), 0).label('total_spent')
    ).join(
        Sale, Sale.client_id == Client.id
    ).join(
        School, School.id == Client.school_id
    ).where(
        and_(*conditions)
    ).group_by(
        Client.id, Client.code, Client.name, Client.phone, School.name
    ).order_by(
        func.sum(Sale.total).desc()
    ).limit(limit)

    result = await db.execute(query)
    rows = result.all()

    return [
        {
            'client_id': str(row.id),
            'client_code': row.code,
            'client_name': row.name,
            'client_phone': row.phone,
            'school_name': row.school_name,
            'total_purchases': row.total_purchases,
            'total_spent': float(row.total_spent)
        }
        for row in rows
    ]


@router.get(
    "/sales/monthly",
    dependencies=[Depends(require_global_permission("reports.sales"))],
    responses=AUTHENTICATED,
    operation_id="getGlobalMonthlySales",
)
async def get_monthly_sales_breakdown(
    db: DatabaseSession,
    start_date: date | None = Query(None, description="Start date (defaults to 12 months ago)"),
    end_date: date | None = Query(None, description="End date (defaults to today)"),
    school_id: UUID | None = Query(None, description="Optional school filter")
):
    """
    Get sales aggregated by month for trend analysis.

    **Auth:** Bearer JWT (staff)
    **Permission:** `reports.sales` (global)

    Returns monthly breakdown with:
    - period: Year-month (YYYY-MM)
    - period_label: Human readable label (e.g., "Enero 2024")
    - sales_count: Number of completed sales
    - total_revenue: Total revenue for the month
    - average_ticket: Average sale amount
    - by_payment: Breakdown by payment method
    """
    # Default to last 12 months if no dates provided
    if not end_date:
        end_date = get_colombia_date()
    if not start_date:
        # Go back 12 months from end_date
        if end_date.month > 1:
            start_date = date(end_date.year - 1, end_date.month, 1)
        else:
            start_date = date(end_date.year - 2, 12, 1)

    # Build base conditions
    start_datetime = datetime.combine(start_date, datetime.min.time())
    end_datetime = datetime.combine(end_date, datetime.max.time())

    conditions = [
        Sale.status == SaleStatus.COMPLETED, Sale.is_historical.is_(False),
        Sale.sale_date >= start_datetime,
        Sale.sale_date <= end_datetime
    ]

    if school_id:
        conditions.append(Sale.school_id == school_id)

    # Use date_trunc for PostgreSQL to group by month
    month_trunc = func.date_trunc('month', Sale.sale_date)

    # Main aggregation query grouped by month
    query = select(
        month_trunc.label('month'),
        func.count(Sale.id).label('sales_count'),
        func.coalesce(func.sum(Sale.total), 0).label('total_revenue'),
        func.coalesce(func.avg(Sale.total), 0).label('average_ticket'),
    ).where(
        and_(*conditions)
    ).group_by(
        month_trunc
    ).order_by(
        month_trunc.asc()
    )

    result = await db.execute(query)
    rows = result.all()

    # Get payment method breakdown for each month
    payment_query = select(
        month_trunc.label('month'),
        Sale.payment_method,
        func.count(Sale.id).label('count'),
        func.coalesce(func.sum(Sale.total), 0).label('total')
    ).where(
        and_(*conditions)
    ).group_by(
        month_trunc, Sale.payment_method
    ).order_by(
        month_trunc.asc()
    )

    payment_result = await db.execute(payment_query)
    payment_rows = payment_result.all()

    # Build payment breakdown dictionary
    payment_by_month: dict[str, dict[str, dict]] = {}
    for p_row in payment_rows:
        month_key = p_row.month.strftime('%Y-%m')
        if month_key not in payment_by_month:
            payment_by_month[month_key] = {}
        method = p_row.payment_method.value if p_row.payment_method else 'other'
        payment_by_month[month_key][method] = {
            'count': p_row.count,
            'total': float(p_row.total)
        }

    # Spanish month names
    MONTH_NAMES_ES = {
        1: 'Enero', 2: 'Febrero', 3: 'Marzo', 4: 'Abril',
        5: 'Mayo', 6: 'Junio', 7: 'Julio', 8: 'Agosto',
        9: 'Septiembre', 10: 'Octubre', 11: 'Noviembre', 12: 'Diciembre'
    }

    # Build response
    months = []
    total_sales = 0
    total_revenue = 0.0

    for row in rows:
        month_key = row.month.strftime('%Y-%m')
        month_num = row.month.month
        year = row.month.year

        months.append({
            'period': month_key,
            'period_label': f"{MONTH_NAMES_ES[month_num]} {year}",
            'sales_count': row.sales_count,
            'total_revenue': float(row.total_revenue),
            'average_ticket': float(row.average_ticket),
            'by_payment': payment_by_month.get(month_key, {})
        })

        total_sales += row.sales_count
        total_revenue += float(row.total_revenue)

    return {
        'months': months,
        'totals': {
            'sales_count': total_sales,
            'total_revenue': total_revenue,
            'average_ticket': total_revenue / total_sales if total_sales > 0 else 0
        },
        'start_date': start_date.isoformat(),
        'end_date': end_date.isoformat(),
        'school_id': str(school_id) if school_id else None
    }


@router.get(
    "/profitability/by-school",
    dependencies=[Depends(require_global_permission("reports.financial"))],
    responses=AUTHENTICATED,
    operation_id="getGlobalProfitabilityBySchool",
)
async def get_profitability_by_school(
    db: DatabaseSession,
    start_date: date | None = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: date | None = Query(None, description="End date (YYYY-MM-DD)")
):
    """
    Get profitability metrics by school.

    **Auth:** Bearer JWT (staff)
    **Permission:** `reports.financial` (global)

    For each school, calculates:
    - revenue: Sum of SaleItem.subtotal for completed sales
    - cogs: Cost of goods sold using the historical-cost fallback chain
            (SaleItem.unit_cost -> Product.cost -> unit_price * 0.80)
    - gross_profit: Revenue - COGS
    - gross_margin: Gross profit as percentage of revenue
    - products_with_cost: Units sold with a real cost (snapshot or product)
    - products_estimated: Units sold whose cost had to be estimated
    - cost_coverage_percent: Units with real cost / total units sold

    Returns list ordered by gross profit descending.
    """
    # Build conditions
    conditions = [Sale.status == SaleStatus.COMPLETED, Sale.is_historical.is_(False)]
    if start_date:
        start_datetime = datetime.combine(start_date, datetime.min.time())
        conditions.append(Sale.sale_date >= start_datetime)
    if end_date:
        end_datetime = datetime.combine(end_date, datetime.max.time())
        conditions.append(Sale.sale_date <= end_datetime)

    # Cost resolution via the shared _cogs_resolver helper: same fallback
    # chain used by FinancialStatementsService and ProfitabilityService.
    sale_cost = resolved_cost(
        item_unit_cost_col=SaleItem.unit_cost,
        item_unit_price_col=SaleItem.unit_price,
        product_cost_col=Product.cost,
    )
    sale_has_real_cost = has_real_cost(
        item_unit_cost_col=SaleItem.unit_cost,
        product_cost_col=Product.cost,
    )

    # Aggregate everything in a single GROUP BY query.
    query = (
        select(
            School.id.label('school_id'),
            School.name.label('school_name'),
            func.coalesce(func.sum(SaleItem.subtotal), 0).label('revenue'),
            func.coalesce(func.sum(SaleItem.quantity * sale_cost), 0).label('cogs'),
            func.coalesce(
                func.sum(case((sale_has_real_cost == 1, SaleItem.quantity), else_=0)),
                0,
            ).label('units_with_cost'),
            func.coalesce(
                func.sum(case((sale_has_real_cost == 0, SaleItem.quantity), else_=0)),
                0,
            ).label('units_estimated'),
        )
        .select_from(SaleItem)
        .join(Sale, Sale.id == SaleItem.sale_id)
        .join(Product, Product.id == SaleItem.product_id)
        .join(School, School.id == Sale.school_id)
        .where(and_(*conditions))
        .group_by(School.id, School.name)
    )
    result = await db.execute(query)
    rows = result.all()

    profitability = []
    for row in rows:
        revenue = float(row.revenue)
        cogs = float(row.cogs)
        gross_profit = revenue - cogs
        gross_margin = (gross_profit / revenue * 100) if revenue > 0 else 0

        units_with_cost = int(row.units_with_cost)
        units_estimated = int(row.units_estimated)
        total_units = units_with_cost + units_estimated
        coverage_percent = (
            units_with_cost / total_units * 100 if total_units > 0 else 0
        )

        profitability.append({
            'school_id': str(row.school_id),
            'school_name': row.school_name,
            'revenue': revenue,
            'cogs': cogs,
            'gross_profit': gross_profit,
            'gross_margin': round(gross_margin, 1),
            # Renamed semantics: cobertura por unidad vendida, no por
            # SaleItem row. Backwards-compatible keys preserved.
            'products_with_cost': units_with_cost,
            'products_estimated': units_estimated,
            'cost_coverage_percent': round(coverage_percent, 1),
        })

    # Sort by gross profit descending
    profitability.sort(key=lambda x: x['gross_profit'], reverse=True)

    # Calculate totals
    total_revenue = sum(p['revenue'] for p in profitability)
    total_cogs = sum(p['cogs'] for p in profitability)
    total_gross_profit = total_revenue - total_cogs
    total_gross_margin = (total_gross_profit / total_revenue * 100) if total_revenue > 0 else 0

    return {
        'schools': profitability,
        'totals': {
            'revenue': total_revenue,
            'cogs': total_cogs,
            'gross_profit': total_gross_profit,
            'gross_margin': round(total_gross_margin, 1)
        },
        'start_date': start_date.isoformat() if start_date else None,
        'end_date': end_date.isoformat() if end_date else None
    }


# ============================================================================
# Orders (Encargos) coverage — Fase 1 del plan Reports Coverage Expansion
# ============================================================================
#
# These endpoints expose aggregations from OrderAnalyticsMixin so the
# Encargos tab in the Reports module has the same depth as the Sales tab.
# All accept `start_date`, `end_date`, `school_id?`, `branch_id?` (no-op
# until v3.1). Permissions:
#   * `reports.orders` — operational aggregations (counts, funnel, top lists)
#   * `reports.financial` — profitability (revenue/COGS/margin)
#   * `reports.cost_visibility` — when ABSENT, masks COGS/margin in
#     profitability response (rows return cogs=null, gross_profit=null,
#     gross_margin=null). Revenue and counts stay visible.


@router.get(
    "/orders/summary",
    response_model=OrdersSummary,
    dependencies=[Depends(require_global_permission("reports.orders"))],
    responses=AUTHENTICATED,
    operation_id="getGlobalOrdersSummary",
)
async def get_global_orders_summary(
    db: DatabaseSession,
    start_date: date | None = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: date | None = Query(None, description="End date (YYYY-MM-DD)"),
    school_id: UUID | None = Query(None, description="Optional school filter"),
    branch_id: UUID | None = Query(
        None,
        description="Optional branch filter (reserved for v3.1, currently no-op)",
    ),
):
    """Headline aggregates for the Encargos tab: counts by status, revenue
    (accrual + cash), balance pending, avg ticket."""
    validate_date_range(start_date, end_date)
    service = OrderService(db)
    return await service.get_orders_summary(
        start_date=start_date,
        end_date=end_date,
        school_id=school_id,
        branch_id=branch_id,
    )


@router.get(
    "/orders/status-funnel",
    response_model=OrdersStatusFunnel,
    dependencies=[Depends(require_global_permission("reports.orders"))],
    responses=AUTHENTICATED,
    operation_id="getGlobalOrdersStatusFunnel",
)
async def get_global_orders_status_funnel(
    db: DatabaseSession,
    start_date: date | None = Query(None),
    end_date: date | None = Query(None),
    school_id: UUID | None = Query(None),
    branch_id: UUID | None = Query(None, description="Reserved for v3.1"),
):
    """Embudo de estados: cuantos encargos hay en pending / in_production /
    ready / delivered / cancelled dentro del periodo."""
    validate_date_range(start_date, end_date)
    service = OrderService(db)
    return await service.get_orders_status_funnel(
        start_date=start_date,
        end_date=end_date,
        school_id=school_id,
        branch_id=branch_id,
    )


@router.get(
    "/orders/on-time-delivery",
    response_model=OrdersOnTimeDelivery,
    dependencies=[Depends(require_global_permission("reports.orders"))],
    responses=AUTHENTICATED,
    operation_id="getGlobalOrdersOnTimeDelivery",
)
async def get_global_orders_on_time_delivery(
    db: DatabaseSession,
    start_date: date | None = Query(None),
    end_date: date | None = Query(None),
    school_id: UUID | None = Query(None),
    branch_id: UUID | None = Query(None, description="Reserved for v3.1"),
):
    """Cumplimiento de entregas: % a tiempo, lead time promedio, antiguedad
    del pedido vencido mas viejo."""
    validate_date_range(start_date, end_date)
    service = OrderService(db)
    return await service.get_orders_on_time_delivery(
        start_date=start_date,
        end_date=end_date,
        school_id=school_id,
        branch_id=branch_id,
    )


@router.get(
    "/orders/cumplimiento",
    response_model=list[OrdersCumplimientoRow],
    dependencies=[Depends(require_global_permission("reports.orders"))],
    responses=AUTHENTICATED,
    operation_id="getGlobalOrdersCumplimiento",
)
async def get_global_orders_cumplimiento(
    db: DatabaseSession,
    school_id: UUID | None = Query(None),
    branch_id: UUID | None = Query(None, description="Reserved for v3.1"),
    overdue_threshold_days: int = Query(
        0,
        ge=0,
        description="Tolerance in days before counting as overdue (0 = strict).",
    ),
):
    """Encargos vencidos por colegio. No usa start/end_date — siempre es
    "hoy vs. delivery_date"; el threshold permite ignorar atrasos menores."""
    service = OrderService(db)
    return await service.get_orders_cumplimiento(
        school_id=school_id,
        branch_id=branch_id,
        overdue_threshold_days=overdue_threshold_days,
    )


@router.get(
    "/orders/top-products",
    response_model=list[OrdersTopProduct],
    dependencies=[Depends(require_global_permission("reports.orders"))],
    responses=AUTHENTICATED,
    operation_id="getGlobalOrdersTopProducts",
)
async def get_global_orders_top_products(
    db: DatabaseSession,
    limit: int = Query(10, ge=1, le=50),
    start_date: date | None = Query(None),
    end_date: date | None = Query(None),
    school_id: UUID | None = Query(None),
    branch_id: UUID | None = Query(None, description="Reserved for v3.1"),
):
    """Productos mas pedidos en encargos durante el periodo."""
    validate_date_range(start_date, end_date)
    service = OrderService(db)
    return await service.get_orders_top_products(
        limit=limit,
        start_date=start_date,
        end_date=end_date,
        school_id=school_id,
        branch_id=branch_id,
    )


@router.get(
    "/orders/top-clients",
    response_model=list[OrdersTopClient],
    dependencies=[Depends(require_global_permission("reports.orders"))],
    responses=AUTHENTICATED,
    operation_id="getGlobalOrdersTopClients",
)
async def get_global_orders_top_clients(
    db: DatabaseSession,
    limit: int = Query(10, ge=1, le=50),
    start_date: date | None = Query(None),
    end_date: date | None = Query(None),
    school_id: UUID | None = Query(None),
    branch_id: UUID | None = Query(None, description="Reserved for v3.1"),
):
    """Clientes con mas encargos durante el periodo."""
    validate_date_range(start_date, end_date)
    service = OrderService(db)
    return await service.get_orders_top_clients(
        limit=limit,
        start_date=start_date,
        end_date=end_date,
        school_id=school_id,
        branch_id=branch_id,
    )


@router.get(
    "/orders/profitability/by-school",
    response_model=OrdersProfitabilityResponse,
    dependencies=[Depends(require_global_permission("reports.financial"))],
    responses=AUTHENTICATED,
    operation_id="getGlobalOrdersProfitabilityBySchool",
)
async def get_global_orders_profitability_by_school(
    db: DatabaseSession,
    current_user: CurrentUser,
    start_date: date | None = Query(None),
    end_date: date | None = Query(None),
    branch_id: UUID | None = Query(None, description="Reserved for v3.1"),
):
    """Rentabilidad de encargos por colegio.

    Usa el mismo fallback chain (`_cogs_resolver`) que el reporte de Ventas,
    aplicado sobre `OrderItem.unit_cost`. Cuando el caller no tiene
    `reports.cost_visibility`, los campos `cogs`, `gross_profit`,
    `gross_margin` se devuelven como `null` — el ingreso y la cobertura
    de costos siguen visibles.
    """
    validate_date_range(start_date, end_date)
    permission_service = PermissionService(db)
    can_view_costs = await permission_service.has_global_permission(
        current_user, "reports.cost_visibility"
    )
    service = OrderService(db)
    return await service.get_orders_profitability_by_school(
        start_date=start_date,
        end_date=end_date,
        branch_id=branch_id,
        mask_costs=not can_view_costs,
    )


# ============================================================================
# Alterations (Arreglos) coverage — Fase 2 del plan Reports Coverage Expansion
# ============================================================================
#
# Three endpoints that extend the Arreglos tab from a static counter to
# a date-aware operational view:
#
#   /alterations/summary       — extends the existing /global/alterations/
#                                summary with optional date filters
#                                (backward-compatible: no args = old behavior)
#   /alterations/response-time — operational KPIs: production turnaround
#                                + overdue pickup (cliente no retira)
#   /alterations/top-types     — most-frequent types by volume + revenue


@router.get(
    "/alterations/summary",
    response_model=AlterationsSummary,
    dependencies=[Depends(require_global_permission("reports.alterations"))],
    responses=AUTHENTICATED,
    operation_id="getGlobalAlterationsSummary",
)
async def get_global_alterations_summary(
    db: DatabaseSession,
    current_user: CurrentUser,
    start_date: date | None = Query(None, description="Start date (received_date filter)"),
    end_date: date | None = Query(None, description="End date (received_date filter)"),
):
    """Date-filterable summary of alterations.

    Closes Bug 9 of the Reports audit: the existing
    `/global/alterations/summary` endpoint returns all-time totals
    regardless of the period selected in the UI. The new Reports endpoint
    accepts `start_date` / `end_date` and adds `received_in_period`,
    `delivered_in_period`, `revenue_in_period` fields. When no dates are
    sent, the response shape is identical to the legacy endpoint (used by
    the dashboard widget) — no breaking change.

    Financial fields (`total_revenue`, `total_pending_payment`,
    `revenue_in_period`) are masked when the caller lacks
    `alterations.view_revenue`.
    """
    validate_date_range(start_date, end_date)
    permission_service = PermissionService(db)
    include_financials = await permission_service.has_global_permission(
        current_user, "alterations.view_revenue"
    )
    service = AlterationService(db)
    return await service.get_summary(
        include_financials=include_financials,
        start_date=start_date,
        end_date=end_date,
    )


@router.get(
    "/alterations/response-time",
    response_model=AlterationsResponseTime,
    dependencies=[Depends(require_global_permission("reports.alterations"))],
    responses=AUTHENTICATED,
    operation_id="getGlobalAlterationsResponseTime",
)
async def get_global_alterations_response_time(
    db: DatabaseSession,
    start_date: date | None = Query(None),
    end_date: date | None = Query(None),
    overdue_pickup_threshold_days: int = Query(
        7,
        ge=1,
        le=90,
        description="Days a READY alteration can sit uncollected before counting as overdue pickup.",
    ),
):
    """Operational KPIs: production turnaround + pickup overdue.

    Notes on the metric definitions are in
    `AlterationService.get_response_time_metrics`. Critically, rows
    without `ready_at` (legacy alterations marked READY before the
    migration that added the column) are excluded from the average —
    never approximated with `updated_at`.
    """
    validate_date_range(start_date, end_date)
    service = AlterationService(db)
    return await service.get_response_time_metrics(
        start_date=start_date,
        end_date=end_date,
        overdue_pickup_threshold_days=overdue_pickup_threshold_days,
    )


@router.get(
    "/alterations/top-types",
    response_model=list[AlterationsTopType],
    dependencies=[Depends(require_global_permission("reports.alterations"))],
    responses=AUTHENTICATED,
    operation_id="getGlobalAlterationsTopTypes",
)
async def get_global_alterations_top_types(
    db: DatabaseSession,
    limit: int = Query(5, ge=1, le=20),
    start_date: date | None = Query(None),
    end_date: date | None = Query(None),
):
    """Most-frequent alteration types in the period.

    Returns count, revenue, and average response time per type so the
    user can decide whether to re-balance the workshop capacity.
    """
    validate_date_range(start_date, end_date)
    service = AlterationService(db)
    return await service.get_top_types(
        limit=limit,
        start_date=start_date,
        end_date=end_date,
    )


# ============================================================================
# Unified Revenue Streams — Fase 3 del plan Reports Coverage Expansion
# ============================================================================
#
# Three endpoints powering the "Resumen" 360 tab. All consume
# RevenueStreamService which composes Sales + Orders + Alterations
# (and a B2B stub) into a single consistent shape.


@router.get(
    "/revenue/streams-summary",
    response_model=StreamSummary,
    dependencies=[Depends(require_global_permission("reports.financial"))],
    responses=AUTHENTICATED,
    operation_id="getGlobalRevenueStreamsSummary",
)
async def get_global_revenue_streams_summary(
    db: DatabaseSession,
    current_user: CurrentUser,
    start_date: date | None = Query(None),
    end_date: date | None = Query(None),
    school_id: UUID | None = Query(None),
    branch_id: UUID | None = Query(None, description="Reserved for v3.1"),
    basis: RevenueBasis = Query(
        RevenueBasis.ACCRUAL,
        description=(
            "`accrual` (default) recognizes revenue at delivery — matches "
            "P&L. `cash` recognizes at payment — matches caja drawer."
        ),
    ),
    streams: list[RevenueStreamId] | None = Query(
        None,
        description="Subset of streams to include. Default: all registered.",
    ),
):
    """Three-stream summary for the Resumen tab.

    Invariant: ``sum(streams[*].revenue) == totals.revenue`` (modulo
    rounding). Returns each stream's revenue, count, COGS, and margin
    side-by-side.

    Cost columns masked when caller lacks `reports.cost_visibility`.
    """
    validate_date_range(start_date, end_date)
    permission_service = PermissionService(db)
    include_cost = await permission_service.has_global_permission(
        current_user, "reports.cost_visibility"
    )
    service = RevenueStreamService(db)
    return await service.get_streams_summary(
        start_date=start_date,
        end_date=end_date,
        school_id=school_id,
        branch_id=branch_id,
        basis=basis,
        streams=streams,
        include_cost=include_cost,
    )


@router.get(
    "/revenue/streams-monthly",
    response_model=StreamMonthlyReport,
    dependencies=[Depends(require_global_permission("reports.financial"))],
    responses=AUTHENTICATED,
    operation_id="getGlobalRevenueStreamsMonthly",
)
async def get_global_revenue_streams_monthly(
    db: DatabaseSession,
    current_user: CurrentUser,
    start_date: date = Query(..., description="Required for monthly trend."),
    end_date: date = Query(..., description="Required for monthly trend."),
    school_id: UUID | None = Query(None),
    branch_id: UUID | None = Query(None, description="Reserved for v3.1"),
    basis: RevenueBasis = Query(RevenueBasis.ACCRUAL),
    streams: list[RevenueStreamId] | None = Query(None),
):
    """Monthly trend across streams. Every month in the range appears,
    even with zero activity (gap-filled).
    """
    validate_date_range(start_date, end_date)
    permission_service = PermissionService(db)
    include_cost = await permission_service.has_global_permission(
        current_user, "reports.cost_visibility"
    )
    service = RevenueStreamService(db)
    return await service.get_streams_monthly(
        start_date=start_date,
        end_date=end_date,
        school_id=school_id,
        branch_id=branch_id,
        basis=basis,
        streams=streams,
        include_cost=include_cost,
    )


@router.get(
    "/revenue/streams-by-school",
    response_model=StreamsBreakdownBySchool,
    dependencies=[Depends(require_global_permission("reports.financial"))],
    responses=AUTHENTICATED,
    operation_id="getGlobalRevenueStreamsBySchool",
)
async def get_global_revenue_streams_by_school(
    db: DatabaseSession,
    start_date: date | None = Query(None),
    end_date: date | None = Query(None),
    basis: RevenueBasis = Query(RevenueBasis.ACCRUAL),
):
    """Per-school breakdown showing Sales + Orders revenue side-by-side.

    Alterations are tracked workshop-wide (not by school) and only
    appear in the totals row — documented in the response shape.
    """
    validate_date_range(start_date, end_date)
    service = RevenueStreamService(db)
    return await service.get_streams_breakdown_by_school(
        start_date=start_date,
        end_date=end_date,
        basis=basis,
    )

