"""
Reports Service - Business analytics and reporting
"""
from uuid import UUID
from datetime import datetime, date, timedelta
from decimal import Decimal
from sqlalchemy import select, func, and_, case, union_all, exists
from sqlalchemy.ext.asyncio import AsyncSession

from app.utils.timezone import get_colombia_date
from app.models.sale import Sale, SaleItem, SalePayment, SaleStatus, PaymentMethod
from app.models.product import Product, Inventory
from app.models.client import Client
from app.models.order import Order, OrderStatus


def _payment_breakdown_subquery():
    """One row per completed-sale payment event.

    For sales with explicit ``SalePayment`` rows, yields each split payment.
    For sales WITHOUT ``SalePayment`` rows (legacy / single-method sales),
    yields the header ``(Sale.payment_method, Sale.total)``.

    Lets aggregations operate on the real per-method amounts instead of
    collapsing every split payment into ``Sale.payment_method`` (which
    drops Nequi entirely and double-counts mixed-payment sales).
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


class ReportsService:
    """Service for generating business reports"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_sales_summary(
        self,
        school_id: UUID,
        start_date: date | None = None,
        end_date: date | None = None
    ) -> dict:
        """
        Get sales summary for a period
        """
        # Default to today if no dates provided
        if not start_date:
            start_date = get_colombia_date()
        if not end_date:
            end_date = get_colombia_date()

        # Build date filter
        start_datetime = datetime.combine(start_date, datetime.min.time())
        end_datetime = datetime.combine(end_date, datetime.max.time())

        # Query sales
        query = select(
            func.count(Sale.id).label('total_sales'),
            func.coalesce(func.sum(Sale.total), 0).label('total_revenue'),
            func.coalesce(func.avg(Sale.total), 0).label('average_ticket'),
        ).where(
            and_(
                Sale.school_id == school_id,
                Sale.status == SaleStatus.COMPLETED, Sale.is_historical.is_(False),
                Sale.sale_date >= start_datetime,
                Sale.sale_date <= end_datetime
            )
        )

        result = await self.db.execute(query)
        row = result.one()

        # Sales by payment method
        payment_query = select(
            Sale.payment_method,
            func.count(Sale.id).label('count'),
            func.coalesce(func.sum(Sale.total), 0).label('total')
        ).where(
            and_(
                Sale.school_id == school_id,
                Sale.status == SaleStatus.COMPLETED, Sale.is_historical.is_(False),
                Sale.sale_date >= start_datetime,
                Sale.sale_date <= end_datetime
            )
        ).group_by(Sale.payment_method)

        payment_result = await self.db.execute(payment_query)
        payment_rows = payment_result.all()

        sales_by_payment = {}
        for p_row in payment_rows:
            method = p_row.payment_method.value if p_row.payment_method else 'other'
            sales_by_payment[method] = {
                'count': p_row.count,
                'total': float(p_row.total)
            }

        return {
            'total_sales': row.total_sales,
            'total_revenue': float(row.total_revenue),
            'average_ticket': float(row.average_ticket),
            'sales_by_payment': sales_by_payment,
            'start_date': start_date.isoformat(),
            'end_date': end_date.isoformat()
        }

    async def get_daily_sales(
        self,
        school_id: UUID,
        target_date: date | None = None
    ) -> dict:
        """
        Get sales for a specific day.

        Aggregates payment-method totals from ``SalePayment`` rows when
        present (split payments) and from ``Sale.payment_method`` otherwise.
        Nequi is reported alongside cash / transfer / card / credit so the
        sum of method totals matches ``total_revenue`` even on mixed days.
        """
        if not target_date:
            target_date = get_colombia_date()

        start_datetime = datetime.combine(target_date, datetime.min.time())
        end_datetime = datetime.combine(target_date, datetime.max.time())

        # Sale status counts (single grouped query, in SQL).
        status_query = (
            select(Sale.status, func.count(Sale.id))
            .where(
                Sale.school_id == school_id,
                Sale.sale_date >= start_datetime,
                Sale.sale_date <= end_datetime,
            )
            .group_by(Sale.status)
        )
        status_counts = {row[0]: row[1] for row in (await self.db.execute(status_query)).all()}
        completed_count = status_counts.get(SaleStatus.COMPLETED, 0)
        pending_count = status_counts.get(SaleStatus.PENDING, 0)
        cancelled_count = status_counts.get(SaleStatus.CANCELLED, 0)

        # Per-method totals using the split-payment subquery so a sale paid
        # 50k cash + 30k transfer is reported correctly (not collapsed into
        # whatever Sale.payment_method holds).
        breakdown = _payment_breakdown_subquery()
        method_query = (
            select(
                breakdown.c.method,
                func.coalesce(func.sum(breakdown.c.amount), 0).label('total'),
            )
            .where(
                breakdown.c.school_id == school_id,
                breakdown.c.sale_date >= start_datetime,
                breakdown.c.sale_date <= end_datetime,
            )
            .group_by(breakdown.c.method)
        )
        method_rows = (await self.db.execute(method_query)).all()
        by_method: dict[str, float] = {}
        for row in method_rows:
            key = row.method.value if row.method else 'other'
            by_method[key] = float(row.total)

        # Total revenue from completed sales — use Sale.total to keep the
        # invariant `total_revenue == sum(by_method)` (modulo rounding).
        revenue_row = (
            await self.db.execute(
                select(func.coalesce(func.sum(Sale.total), 0))
                .where(
                    Sale.school_id == school_id,
                    Sale.status == SaleStatus.COMPLETED, Sale.is_historical.is_(False),
                    Sale.sale_date >= start_datetime,
                    Sale.sale_date <= end_datetime,
                )
            )
        ).scalar_one()

        return {
            'date': target_date.isoformat(),
            'total_sales': completed_count,
            'total_revenue': float(revenue_row),
            'completed_count': completed_count,
            'pending_count': pending_count,
            'cancelled_count': cancelled_count,
            # Backwards-compatible per-method fields (existing frontend reads
            # `cash_sales`, `transfer_sales`, etc.).
            'cash_sales': by_method.get('cash', 0.0),
            'transfer_sales': by_method.get('transfer', 0.0),
            'card_sales': by_method.get('card', 0.0),
            'credit_sales': by_method.get('credit', 0.0),
            'nequi_sales': by_method.get('nequi', 0.0),
            'other_sales': by_method.get('other', 0.0),
            # Unified shape for future consumers — list every method that
            # actually appeared today, so new payment methods don't require
            # backend changes.
            'sales_by_payment': {k: {'total': v} for k, v in by_method.items()},
        }

    async def get_top_products(
        self,
        school_id: UUID,
        limit: int = 10,
        start_date: date | None = None,
        end_date: date | None = None
    ) -> list[dict]:
        """
        Get top selling products
        """
        if not start_date:
            start_date = get_colombia_date() - timedelta(days=30)
        if not end_date:
            end_date = get_colombia_date()

        start_datetime = datetime.combine(start_date, datetime.min.time())
        end_datetime = datetime.combine(end_date, datetime.max.time())

        # Query top products
        query = select(
            SaleItem.product_id,
            Product.code,
            Product.name,
            Product.size,
            func.sum(SaleItem.quantity).label('units_sold'),
            func.sum(SaleItem.subtotal).label('total_revenue')
        ).join(
            Sale, Sale.id == SaleItem.sale_id
        ).join(
            Product, Product.id == SaleItem.product_id
        ).where(
            and_(
                Sale.school_id == school_id,
                Sale.status == SaleStatus.COMPLETED, Sale.is_historical.is_(False),
                Sale.sale_date >= start_datetime,
                Sale.sale_date <= end_datetime
            )
        ).group_by(
            SaleItem.product_id, Product.code, Product.name, Product.size
        ).order_by(
            func.sum(SaleItem.quantity).desc()
        ).limit(limit)

        result = await self.db.execute(query)
        rows = result.all()

        return [
            {
                'product_id': str(row.product_id),
                'product_code': row.code,
                'product_name': row.name or row.code,
                'product_size': row.size,
                'units_sold': row.units_sold,
                'total_revenue': float(row.total_revenue)
            }
            for row in rows
        ]

    async def get_low_stock_products(
        self,
        school_id: UUID,
        threshold: int = 5
    ) -> list[dict]:
        """
        Get products with low stock
        """
        query = select(
            Product.id,
            Product.code,
            Product.name,
            Product.size,
            Inventory.quantity,
            Inventory.min_stock_alert
        ).join(
            Inventory, Inventory.product_id == Product.id
        ).where(
            and_(
                Product.school_id == school_id,
                Product.is_active == True,
                Inventory.quantity <= func.coalesce(Inventory.min_stock_alert, threshold)
            )
        ).order_by(Inventory.quantity.asc())

        result = await self.db.execute(query)
        rows = result.all()

        return [
            {
                'product_id': str(row.id),
                'product_code': row.code,
                'product_name': row.name or row.code,
                'product_size': row.size,
                'current_stock': row.quantity,
                'min_stock': row.min_stock_alert or threshold
            }
            for row in rows
        ]

    async def get_inventory_value(self, school_id: UUID) -> dict:
        """
        Get total inventory value
        """
        query = select(
            func.count(Product.id).label('total_products'),
            func.coalesce(func.sum(Inventory.quantity), 0).label('total_units'),
            func.coalesce(func.sum(Inventory.quantity * Product.price), 0).label('total_value')
        ).join(
            Inventory, Inventory.product_id == Product.id
        ).where(
            and_(
                Product.school_id == school_id,
                Product.is_active == True
            )
        )

        result = await self.db.execute(query)
        row = result.one()

        return {
            'total_products': row.total_products,
            'total_units': int(row.total_units),
            'total_value': float(row.total_value)
        }

    async def get_pending_orders(self, school_id: UUID) -> list[dict]:
        """
        Get orders that are pending or in production
        """
        query = select(Order).where(
            and_(
                Order.school_id == school_id,
                Order.status.in_([OrderStatus.PENDING, OrderStatus.IN_PRODUCTION])
            )
        ).order_by(Order.delivery_date.asc().nulls_last())

        result = await self.db.execute(query)
        orders = result.scalars().all()

        return [
            {
                'order_id': str(o.id),
                'order_code': o.code,
                'status': o.status.value,
                'delivery_date': o.delivery_date.isoformat() if o.delivery_date else None,
                'total': float(o.total),
                'balance': float(o.balance),
                'created_at': o.created_at.isoformat()
            }
            for o in orders
        ]

    async def get_top_clients(
        self,
        school_id: UUID,
        limit: int = 10,
        start_date: date | None = None,
        end_date: date | None = None
    ) -> list[dict]:
        """
        Get top clients by purchase amount (with optional date filters)
        """
        # Build conditions
        conditions = [
            Client.school_id == school_id,
            Client.is_active == True,
            Sale.status == SaleStatus.COMPLETED, Sale.is_historical.is_(False)
        ]

        # Add date filters if provided
        if start_date:
            start_datetime = datetime.combine(start_date, datetime.min.time())
            conditions.append(Sale.sale_date >= start_datetime)
        if end_date:
            end_datetime = datetime.combine(end_date, datetime.max.time())
            conditions.append(Sale.sale_date <= end_datetime)

        query = select(
            Client.id,
            Client.code,
            Client.name,
            Client.phone,
            func.count(Sale.id).label('total_purchases'),
            func.coalesce(func.sum(Sale.total), 0).label('total_spent')
        ).join(
            Sale, Sale.client_id == Client.id
        ).where(
            and_(*conditions)
        ).group_by(
            Client.id, Client.code, Client.name, Client.phone
        ).order_by(
            func.sum(Sale.total).desc()
        ).limit(limit)

        result = await self.db.execute(query)
        rows = result.all()

        return [
            {
                'client_id': str(row.id),
                'client_code': row.code,
                'client_name': row.name,
                'client_phone': row.phone,
                'total_purchases': row.total_purchases,
                'total_spent': float(row.total_spent)
            }
            for row in rows
        ]

    async def get_dashboard_summary(self, school_id: UUID) -> dict:
        """
        Get dashboard summary with key metrics
        """
        today = get_colombia_date()
        month_start = today.replace(day=1)

        # Today's sales
        daily = await self.get_daily_sales(school_id, today)

        # This month's sales
        monthly = await self.get_sales_summary(school_id, month_start, today)

        # Low stock count
        low_stock = await self.get_low_stock_products(school_id)

        # Pending orders count
        pending_orders = await self.get_pending_orders(school_id)

        # Inventory value
        inventory = await self.get_inventory_value(school_id)

        return {
            'today': {
                'sales_count': daily['total_sales'],
                'revenue': daily['total_revenue']
            },
            'this_month': {
                'sales_count': monthly['total_sales'],
                'revenue': monthly['total_revenue'],
                'average_ticket': monthly['average_ticket']
            },
            'alerts': {
                'low_stock_count': len(low_stock),
                'pending_orders_count': len(pending_orders)
            },
            'inventory': {
                'total_products': inventory['total_products'],
                'total_value': inventory['total_value']
            }
        }
