"""
Global Reports Endpoints - Business-wide analytics and reporting

These endpoints provide global sales reports across all schools with optional
school filtering. Unlike /schools/{school_id}/reports, these don't require
a specific school to be selected.
"""
from uuid import UUID
from datetime import date, datetime
from fastapi import APIRouter, Query, Depends

from app.utils.timezone import get_colombia_date
from sqlalchemy import select, func, and_

from app.api.dependencies import DatabaseSession, require_any_school_admin
from app.models.sale import Sale, SaleItem, SaleStatus, PaymentMethod
from app.models.product import Product
from app.models.client import Client
from app.models.school import School


router = APIRouter(prefix="/global/reports", tags=["Global Reports"])


@router.get(
    "/sales/summary",
    dependencies=[Depends(require_any_school_admin)]
)
async def get_global_sales_summary(
    db: DatabaseSession,
    start_date: date | None = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: date | None = Query(None, description="End date (YYYY-MM-DD)"),
    school_id: UUID | None = Query(None, description="Optional school filter")
):
    """
    Get global sales summary across all schools (or filtered by school)

    Returns:
        - total_sales: Number of completed sales
        - total_revenue: Total revenue
        - average_ticket: Average sale amount
        - sales_by_payment: Breakdown by payment method
        - sales_by_school: Breakdown by school (when no school filter)
    """
    # Build base conditions
    conditions = [Sale.status == SaleStatus.COMPLETED]

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

    # Sales by payment method
    payment_query = select(
        Sale.payment_method,
        func.count(Sale.id).label('count'),
        func.coalesce(func.sum(Sale.total), 0).label('total')
    ).where(and_(*conditions)).group_by(Sale.payment_method)

    payment_result = await db.execute(payment_query)
    payment_rows = payment_result.all()

    sales_by_payment = {}
    for p_row in payment_rows:
        method = p_row.payment_method.value if p_row.payment_method else 'other'
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
    dependencies=[Depends(require_any_school_admin)]
)
async def get_global_top_products(
    db: DatabaseSession,
    limit: int = Query(10, ge=1, le=50),
    start_date: date | None = Query(None),
    end_date: date | None = Query(None),
    school_id: UUID | None = Query(None, description="Optional school filter")
):
    """Get top selling products across all schools (or filtered by school)"""
    # Build conditions
    conditions = [Sale.status == SaleStatus.COMPLETED]

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
    dependencies=[Depends(require_any_school_admin)]
)
async def get_global_top_clients(
    db: DatabaseSession,
    limit: int = Query(10, ge=1, le=50),
    start_date: date | None = Query(None),
    end_date: date | None = Query(None),
    school_id: UUID | None = Query(None, description="Optional school filter")
):
    """Get top clients across all schools (or filtered by school)"""
    # Build conditions
    conditions = [
        Client.is_active == True,
        Sale.status == SaleStatus.COMPLETED
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
    dependencies=[Depends(require_any_school_admin)]
)
async def get_monthly_sales_breakdown(
    db: DatabaseSession,
    start_date: date | None = Query(None, description="Start date (defaults to 12 months ago)"),
    end_date: date | None = Query(None, description="End date (defaults to today)"),
    school_id: UUID | None = Query(None, description="Optional school filter")
):
    """
    Get sales aggregated by month for trend analysis.

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
        Sale.status == SaleStatus.COMPLETED,
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
    dependencies=[Depends(require_any_school_admin)]
)
async def get_profitability_by_school(
    db: DatabaseSession,
    start_date: date | None = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: date | None = Query(None, description="End date (YYYY-MM-DD)")
):
    """
    Get profitability metrics by school.

    For each school, calculates:
    - revenue: Total sales revenue
    - cogs: Cost of goods sold (using Product.cost or 80% of price if null)
    - gross_profit: Revenue - COGS
    - gross_margin: Gross profit as percentage of revenue
    - products_with_cost: Count of products with real cost data
    - products_estimated: Count of products using estimated cost

    Returns list ordered by gross profit descending.
    """
    from decimal import Decimal

    DEFAULT_COST_MARGIN = Decimal('0.80')  # If no cost, assume cost = 80% of price

    # Build conditions
    conditions = [Sale.status == SaleStatus.COMPLETED]
    if start_date:
        start_datetime = datetime.combine(start_date, datetime.min.time())
        conditions.append(Sale.sale_date >= start_datetime)
    if end_date:
        end_datetime = datetime.combine(end_date, datetime.max.time())
        conditions.append(Sale.sale_date <= end_datetime)

    # Get all sale items with product and school info
    query = select(
        School.id.label('school_id'),
        School.name.label('school_name'),
        SaleItem.unit_price,
        SaleItem.quantity,
        Product.cost,
        Product.price.label('product_price')
    ).select_from(SaleItem).join(
        Sale, Sale.id == SaleItem.sale_id
    ).join(
        Product, Product.id == SaleItem.product_id
    ).join(
        School, School.id == Sale.school_id
    ).where(and_(*conditions))

    result = await db.execute(query)
    rows = result.all()

    # Aggregate by school
    school_data: dict = {}
    for row in rows:
        school_id = str(row.school_id)
        if school_id not in school_data:
            school_data[school_id] = {
                'school_id': school_id,
                'school_name': row.school_name,
                'revenue': Decimal('0'),
                'cogs': Decimal('0'),
                'products_with_cost': 0,
                'products_estimated': 0
            }

        item_revenue = Decimal(str(row.unit_price)) * row.quantity

        # Calculate cost: use product.cost if available, otherwise estimate
        if row.cost is not None and row.cost > 0:
            item_cost = row.cost * row.quantity
            school_data[school_id]['products_with_cost'] += 1
        else:
            # Estimate: cost = price * 80%
            estimated_cost = Decimal(str(row.product_price)) * DEFAULT_COST_MARGIN
            item_cost = estimated_cost * row.quantity
            school_data[school_id]['products_estimated'] += 1

        school_data[school_id]['revenue'] += item_revenue
        school_data[school_id]['cogs'] += item_cost

    # Calculate margins and format response
    profitability = []
    for data in school_data.values():
        revenue = float(data['revenue'])
        cogs = float(data['cogs'])
        gross_profit = revenue - cogs
        gross_margin = (gross_profit / revenue * 100) if revenue > 0 else 0

        total_products = data['products_with_cost'] + data['products_estimated']
        coverage_percent = (data['products_with_cost'] / total_products * 100) if total_products > 0 else 0

        profitability.append({
            'school_id': data['school_id'],
            'school_name': data['school_name'],
            'revenue': revenue,
            'cogs': cogs,
            'gross_profit': gross_profit,
            'gross_margin': round(gross_margin, 1),
            'products_with_cost': data['products_with_cost'],
            'products_estimated': data['products_estimated'],
            'cost_coverage_percent': round(coverage_percent, 1)
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
