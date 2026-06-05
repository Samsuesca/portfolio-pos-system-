"""Aggregate analytics for Encargos (Orders).

Added to ``OrderService`` as a mixin (same pattern as ``OrderPaymentMixin``,
``OrderStatusMixin``, etc.). All methods return Pydantic schemas from
``app.schemas.reports`` so the endpoints can declare ``response_model``
and OpenAPI consumers get a typed contract.

Cost-of-goods-sold across these methods uses the shared ``_cogs_resolver``
helper — same fallback chain as Sales (``SaleItem.unit_cost → Product.cost
→ unit_price * 0.80``) but over ``OrderItem``. This guarantees the Orders
profitability tab matches the Sales profitability tab semantically.

Date semantics:
  * Period filters apply to ``Order.order_date`` for intake-side metrics
    (status counts, top products, top clients).
  * Period filters apply to ``Order.delivered_at`` for revenue-delivered
    and on-time metrics. Orders delivered before this column existed
    (NULL) are excluded from accrual-basis revenue and lead-time
    calculations, never approximated with ``updated_at``.
  * ``cumplimiento`` uses ``Order.delivery_date`` (the target date) to
    compute overdue.

``branch_id`` parameter is accepted everywhere but currently a no-op
(awaits v3.1 ``branches`` table). Plumbed through so v3.1 is one-line
change per query.
"""
from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from sqlalchemy import select, func, and_, case, cast, Numeric, Date
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.order import Order, OrderItem, OrderStatus
from app.models.product import Product
from app.models.school import School
from app.models.client import Client
from app.models.accounting import Transaction, TransactionType
from app.models.sale import SaleSource
from app.schemas.reports import (
    OrdersStatusCounts,
    OrdersSummary,
    OrdersFunnelStep,
    OrdersStatusFunnel,
    OrdersOnTimeDelivery,
    OrdersCumplimientoRow,
    OrdersProfitabilityRow,
    OrdersProfitabilityResponse,
    OrdersProfitabilityTotals,
    OrdersTopProduct,
    OrdersTopClient,
)
from app.services._cogs_resolver import resolved_cost, has_real_cost
from app.utils.timezone import get_colombia_date


# Spanish labels for the status funnel UI. Kept here (not in a global
# enum) so changing display strings doesn't touch the model.
ORDER_STATUS_LABELS_ES: dict[OrderStatus, str] = {
    OrderStatus.PENDING: "Pendiente",
    OrderStatus.IN_PRODUCTION: "En produccion",
    OrderStatus.READY: "Listo",
    OrderStatus.DELIVERED: "Entregado",
    OrderStatus.CANCELLED: "Cancelado",
}

# Ordered list defining the funnel sequence — UI iterates this list to
# render the funnel left-to-right.
ORDER_FUNNEL_SEQUENCE: list[OrderStatus] = [
    OrderStatus.PENDING,
    OrderStatus.IN_PRODUCTION,
    OrderStatus.READY,
    OrderStatus.DELIVERED,
    OrderStatus.CANCELLED,
]


class OrderAnalyticsMixin:
    """Mixin exposing aggregation methods for the Reports module."""

    db: AsyncSession  # type hint for IDE — real attribute lives on OrderService

    # ----- Internal helpers --------------------------------------------------

    def _intake_window_conditions(
        self,
        start_date: date | None,
        end_date: date | None,
        school_id: UUID | None,
        branch_id: UUID | None,  # noqa: ARG002 — reserved for v3.1
    ) -> list:
        """Filters applied against Order.order_date (intake metrics)."""
        filters: list = []
        if start_date is not None:
            filters.append(
                Order.order_date >= datetime.combine(start_date, datetime.min.time())
            )
        if end_date is not None:
            filters.append(
                Order.order_date <= datetime.combine(end_date, datetime.max.time())
            )
        if school_id is not None:
            filters.append(Order.school_id == school_id)
        return filters

    def _delivery_window_conditions(
        self,
        start_date: date | None,
        end_date: date | None,
        school_id: UUID | None,
        branch_id: UUID | None,  # noqa: ARG002 — reserved for v3.1
    ) -> list:
        """Filters applied against Order.delivered_at (accrual revenue)."""
        filters: list = [
            Order.status == OrderStatus.DELIVERED,
            Order.delivered_at.isnot(None),
        ]
        if start_date is not None:
            filters.append(
                Order.delivered_at >= datetime.combine(start_date, datetime.min.time())
            )
        if end_date is not None:
            filters.append(
                Order.delivered_at <= datetime.combine(end_date, datetime.max.time())
            )
        if school_id is not None:
            filters.append(Order.school_id == school_id)
        return filters

    # ----- Summary -----------------------------------------------------------

    async def get_orders_summary(
        self,
        start_date: date | None = None,
        end_date: date | None = None,
        school_id: UUID | None = None,
        branch_id: UUID | None = None,
    ) -> OrdersSummary:
        """Headline aggregate for the Encargos tab.

        Counts and balance_pending are computed over ``order_date`` window
        (intake side). ``revenue_delivered`` uses the ``delivered_at``
        window for accrual semantics; ``revenue_paid`` reads payments via
        the Transactions table.
        """
        intake = self._intake_window_conditions(start_date, end_date, school_id, branch_id)
        delivery = self._delivery_window_conditions(start_date, end_date, school_id, branch_id)

        # Status counts + balance pending in one grouped query
        status_query = (
            select(Order.status, func.count(Order.id))
            .where(and_(*intake) if intake else True)
            .group_by(Order.status)
        )
        status_rows = (await self.db.execute(status_query)).all()
        counts = {row[0]: row[1] for row in status_rows}

        by_status = OrdersStatusCounts(
            pending=counts.get(OrderStatus.PENDING, 0),
            in_production=counts.get(OrderStatus.IN_PRODUCTION, 0),
            ready=counts.get(OrderStatus.READY, 0),
            delivered=counts.get(OrderStatus.DELIVERED, 0),
            cancelled=counts.get(OrderStatus.CANCELLED, 0),
        )
        total_count = sum(counts.values())
        delivered_count = by_status.delivered
        cancelled_count = by_status.cancelled

        # Balance pending = sum of Order.balance for non-cancelled orders in intake window
        balance_query = (
            select(func.coalesce(func.sum(Order.balance), 0))
            .where(
                and_(
                    Order.status != OrderStatus.CANCELLED,
                    *intake,
                )
            )
        )
        balance_pending = Decimal(str(
            (await self.db.execute(balance_query)).scalar_one() or 0
        ))

        # Revenue delivered (accrual): sum(Order.total) where delivered_at in window
        revenue_delivered_query = (
            select(func.coalesce(func.sum(Order.total), 0))
            .where(and_(*delivery))
        )
        revenue_delivered = Decimal(str(
            (await self.db.execute(revenue_delivered_query)).scalar_one() or 0
        ))

        # Revenue paid (cash): sum(Transaction.amount) where order_id IS NOT NULL
        # and the transaction date falls in the window. Uses transaction_date
        # (a Date column) so we compare against date values directly.
        revenue_paid_filters: list = [
            Transaction.type == TransactionType.INCOME,
            Transaction.order_id.isnot(None),
        ]
        if start_date is not None:
            revenue_paid_filters.append(Transaction.transaction_date >= start_date)
        if end_date is not None:
            revenue_paid_filters.append(Transaction.transaction_date <= end_date)
        if school_id is not None:
            revenue_paid_filters.append(Transaction.school_id == school_id)

        revenue_paid_query = (
            select(func.coalesce(func.sum(Transaction.amount), 0))
            .where(and_(*revenue_paid_filters))
        )
        revenue_paid = Decimal(str(
            (await self.db.execute(revenue_paid_query)).scalar_one() or 0
        ))

        avg_ticket = (
            (revenue_delivered / delivered_count).quantize(Decimal("0.01"))
            if delivered_count > 0 else None
        )

        return OrdersSummary(
            period_start=start_date,
            period_end=end_date,
            school_id=school_id,
            total_count=total_count,
            revenue_delivered=revenue_delivered,
            revenue_paid=revenue_paid,
            balance_pending=balance_pending,
            avg_ticket=avg_ticket,
            by_status=by_status,
            delivered_count=delivered_count,
            cancelled_count=cancelled_count,
        )

    # ----- Status funnel -----------------------------------------------------

    async def get_orders_status_funnel(
        self,
        start_date: date | None = None,
        end_date: date | None = None,
        school_id: UUID | None = None,
        branch_id: UUID | None = None,
    ) -> OrdersStatusFunnel:
        """Funnel of orders received in the period, ordered by status."""
        intake = self._intake_window_conditions(start_date, end_date, school_id, branch_id)
        query = (
            select(Order.status, func.count(Order.id))
            .where(and_(*intake) if intake else True)
            .group_by(Order.status)
        )
        rows = (await self.db.execute(query)).all()
        counts = {row[0]: row[1] for row in rows}

        steps = [
            OrdersFunnelStep(
                status=status.value,
                label=ORDER_STATUS_LABELS_ES[status],
                count=counts.get(status, 0),
            )
            for status in ORDER_FUNNEL_SEQUENCE
        ]

        return OrdersStatusFunnel(
            period_start=start_date,
            period_end=end_date,
            school_id=school_id,
            steps=steps,
        )

    # ----- On-time delivery --------------------------------------------------

    async def get_orders_on_time_delivery(
        self,
        start_date: date | None = None,
        end_date: date | None = None,
        school_id: UUID | None = None,
        branch_id: UUID | None = None,
    ) -> OrdersOnTimeDelivery:
        """Cumplimiento de entregas para encargos en la ventana."""
        delivery = self._delivery_window_conditions(start_date, end_date, school_id, branch_id)

        # Only orders with delivery_date set can be evaluated for on-time.
        # PostgreSQL: cast delivered_at to date before comparing.
        on_time_expr = cast(Order.delivered_at, Date) <= Order.delivery_date

        rows = (
            await self.db.execute(
                select(
                    func.count(Order.id).label("delivered_count"),
                    func.sum(case((on_time_expr, 1), else_=0)).label("on_time_count"),
                    func.sum(case((~on_time_expr, 1), else_=0)).label("late_count"),
                    func.avg(
                        cast(
                            func.extract("epoch", Order.delivered_at - Order.order_date) / 86400.0,
                            Numeric,
                        )
                    ).label("avg_lead_days"),
                ).where(and_(Order.delivery_date.isnot(None), *delivery))
            )
        ).one()

        delivered_count = int(rows.delivered_count or 0)
        on_time_count = int(rows.on_time_count or 0)
        late_count = int(rows.late_count or 0)

        on_time_pct = (
            round(on_time_count / delivered_count * 100, 1)
            if delivered_count > 0 else None
        )
        avg_lead_time_days = (
            round(float(rows.avg_lead_days), 1) if rows.avg_lead_days is not None else None
        )

        # Oldest pending: maxdays past delivery_date among non-delivered orders
        today = get_colombia_date()
        oldest_pending_query = (
            select(func.min(Order.delivery_date))
            .where(
                Order.delivery_date.isnot(None),
                Order.delivery_date < today,
                Order.status.notin_([OrderStatus.DELIVERED, OrderStatus.CANCELLED]),
                *(
                    [Order.school_id == school_id] if school_id is not None else []
                ),
            )
        )
        oldest_delivery_date = (await self.db.execute(oldest_pending_query)).scalar_one_or_none()
        oldest_pending_days = (
            (today - oldest_delivery_date).days if oldest_delivery_date else 0
        )

        return OrdersOnTimeDelivery(
            period_start=start_date,
            period_end=end_date,
            school_id=school_id,
            delivered_count=delivered_count,
            on_time_count=on_time_count,
            late_count=late_count,
            on_time_pct=on_time_pct,
            avg_lead_time_days=avg_lead_time_days,
            oldest_pending_days=oldest_pending_days,
        )

    # ----- Cumplimiento por colegio (overdue list) ---------------------------

    async def get_orders_cumplimiento(
        self,
        start_date: date | None = None,  # noqa: ARG002 — overdue is "as of today", not period-bound
        end_date: date | None = None,    # noqa: ARG002 — same
        school_id: UUID | None = None,
        branch_id: UUID | None = None,   # noqa: ARG002 — reserved for v3.1
        overdue_threshold_days: int = 0,
    ) -> list[OrdersCumplimientoRow]:
        """Orders past their delivery_date and not yet delivered, by school.

        ``overdue_threshold_days=0`` = anything past delivery_date counts.
        Use a positive threshold (e.g. 3) to ignore minor delays.
        """
        today = get_colombia_date()
        cutoff = today
        if overdue_threshold_days > 0:
            from datetime import timedelta
            cutoff = today - timedelta(days=overdue_threshold_days)

        filters: list = [
            Order.delivery_date.isnot(None),
            Order.delivery_date < cutoff,
            Order.status.notin_([OrderStatus.DELIVERED, OrderStatus.CANCELLED]),
        ]
        if school_id is not None:
            filters.append(Order.school_id == school_id)

        # days_late: in PostgreSQL, (DATE - DATE) returns an INTEGER number
        # of days. No need to cast to interval or extract epoch.
        days_late_expr = cast(today, Date) - Order.delivery_date

        query = (
            select(
                School.id.label("school_id"),
                School.name.label("school_name"),
                func.count(Order.id).label("overdue_count"),
                func.avg(cast(days_late_expr, Numeric)).label("avg_days_late"),
                func.max(days_late_expr).label("oldest_overdue_days"),
            )
            .join(School, School.id == Order.school_id)
            .where(and_(*filters))
            .group_by(School.id, School.name)
            .order_by(func.count(Order.id).desc())
        )
        rows = (await self.db.execute(query)).all()

        return [
            OrdersCumplimientoRow(
                school_id=row.school_id,
                school_name=row.school_name,
                overdue_count=int(row.overdue_count),
                avg_days_late=round(float(row.avg_days_late or 0), 1),
                oldest_overdue_days=int(row.oldest_overdue_days or 0),
            )
            for row in rows
        ]

    # ----- Profitability by school -------------------------------------------

    async def get_orders_profitability_by_school(
        self,
        start_date: date | None = None,
        end_date: date | None = None,
        branch_id: UUID | None = None,  # noqa: ARG002 — reserved for v3.1
        mask_costs: bool = False,
    ) -> OrdersProfitabilityResponse:
        """Per-school profitability for Encargos.

        Mirrors the Sales profitability endpoint exactly: same fallback
        chain via ``_cogs_resolver``, same coverage metric (units sold
        with real cost / total units).

        ``mask_costs=True`` returns ``cogs/gross_profit/gross_margin`` as
        ``None`` — used by the route handler when the caller lacks
        ``reports.cost_visibility`` permission.
        """
        filters: list = [Order.status != OrderStatus.CANCELLED]
        if start_date is not None:
            filters.append(
                Order.order_date >= datetime.combine(start_date, datetime.min.time())
            )
        if end_date is not None:
            filters.append(
                Order.order_date <= datetime.combine(end_date, datetime.max.time())
            )

        item_cost = resolved_cost(
            item_unit_cost_col=OrderItem.unit_cost,
            item_unit_price_col=OrderItem.unit_price,
            product_cost_col=Product.cost,
        )
        item_has_real_cost = has_real_cost(
            item_unit_cost_col=OrderItem.unit_cost,
            product_cost_col=Product.cost,
        )

        # OrderItem.product_id is nullable (custom orders without a catalog
        # product). Those rows can't have a meaningful COGS and are excluded
        # — they still appear in the order's revenue, just not in COGS.
        query = (
            select(
                School.id.label("school_id"),
                School.name.label("school_name"),
                func.coalesce(func.sum(OrderItem.subtotal), 0).label("revenue"),
                func.coalesce(func.sum(OrderItem.quantity * item_cost), 0).label("cogs"),
                func.coalesce(
                    func.sum(case((item_has_real_cost == 1, OrderItem.quantity), else_=0)),
                    0,
                ).label("units_with_cost"),
                func.coalesce(
                    func.sum(case((item_has_real_cost == 0, OrderItem.quantity), else_=0)),
                    0,
                ).label("units_estimated"),
            )
            .select_from(OrderItem)
            .join(Order, Order.id == OrderItem.order_id)
            .join(Product, Product.id == OrderItem.product_id)
            .join(School, School.id == Order.school_id)
            .where(and_(*filters, OrderItem.product_id.isnot(None)))
            .group_by(School.id, School.name)
        )
        rows = (await self.db.execute(query)).all()

        schools_out: list[OrdersProfitabilityRow] = []
        total_revenue = Decimal("0")
        total_cogs = Decimal("0")

        for row in rows:
            revenue = Decimal(str(row.revenue))
            cogs = Decimal(str(row.cogs))
            gross_profit = revenue - cogs
            gross_margin = float(
                (gross_profit / revenue * 100) if revenue > 0 else 0
            )
            units_with_cost = int(row.units_with_cost)
            units_estimated = int(row.units_estimated)
            total_units = units_with_cost + units_estimated
            coverage_pct = float(
                units_with_cost / total_units * 100 if total_units > 0 else 0
            )

            total_revenue += revenue
            total_cogs += cogs

            schools_out.append(
                OrdersProfitabilityRow(
                    school_id=row.school_id,
                    school_name=row.school_name,
                    revenue=revenue,
                    cogs=None if mask_costs else cogs,
                    gross_profit=None if mask_costs else gross_profit,
                    gross_margin=None if mask_costs else round(gross_margin, 1),
                    units_with_cost=units_with_cost,
                    units_estimated=units_estimated,
                    cost_coverage_percent=round(coverage_pct, 1),
                )
            )

        # Sort by gross_profit when visible, by revenue otherwise
        schools_out.sort(
            key=lambda s: (
                float(s.gross_profit) if s.gross_profit is not None else float(s.revenue)
            ),
            reverse=True,
        )

        total_gross_profit = total_revenue - total_cogs
        total_margin = float(
            (total_gross_profit / total_revenue * 100) if total_revenue > 0 else 0
        )

        return OrdersProfitabilityResponse(
            period_start=start_date,
            period_end=end_date,
            schools=schools_out,
            totals=OrdersProfitabilityTotals(
                revenue=total_revenue,
                cogs=None if mask_costs else total_cogs,
                gross_profit=None if mask_costs else total_gross_profit,
                gross_margin=None if mask_costs else round(total_margin, 1),
            ),
        )

    # ----- Top products / clients --------------------------------------------

    async def get_orders_top_products(
        self,
        limit: int = 10,
        start_date: date | None = None,
        end_date: date | None = None,
        school_id: UUID | None = None,
        branch_id: UUID | None = None,
    ) -> list[OrdersTopProduct]:
        """Most-ordered products (by units) in the period."""
        intake = self._intake_window_conditions(start_date, end_date, school_id, branch_id)
        # Status != CANCELLED to exclude voided orders' demand from the top list
        intake = [Order.status != OrderStatus.CANCELLED, *intake]

        # When viewing across schools, group by product+school so the
        # caller sees which school is driving a product's demand. When a
        # single school is filtered, group_by(School.name) collapses to
        # one row per product anyway.
        query = (
            select(
                OrderItem.product_id,
                Product.code,
                Product.name,
                Product.size,
                School.name.label("school_name"),
                func.sum(OrderItem.quantity).label("units_ordered"),
                func.sum(OrderItem.subtotal).label("total_revenue"),
            )
            .select_from(OrderItem)
            .join(Order, Order.id == OrderItem.order_id)
            .join(Product, Product.id == OrderItem.product_id)
            .join(School, School.id == Order.school_id)
            .where(and_(*intake, OrderItem.product_id.isnot(None)))
            .group_by(
                OrderItem.product_id, Product.code, Product.name, Product.size, School.name
            )
            .order_by(func.sum(OrderItem.quantity).desc())
            .limit(limit)
        )
        rows = (await self.db.execute(query)).all()

        return [
            OrdersTopProduct(
                product_id=row.product_id,
                product_code=row.code,
                product_name=row.name or row.code or "(sin nombre)",
                product_size=row.size,
                school_name=row.school_name,
                units_ordered=int(row.units_ordered),
                total_revenue=Decimal(str(row.total_revenue)),
            )
            for row in rows
        ]

    async def get_orders_top_clients(
        self,
        limit: int = 10,
        start_date: date | None = None,
        end_date: date | None = None,
        school_id: UUID | None = None,
        branch_id: UUID | None = None,
    ) -> list[OrdersTopClient]:
        """Clients with the most orders (by count) in the period."""
        intake = self._intake_window_conditions(start_date, end_date, school_id, branch_id)
        intake = [Order.status != OrderStatus.CANCELLED, *intake]

        query = (
            select(
                Client.id.label("client_id"),
                Client.code.label("client_code"),
                Client.name.label("client_name"),
                Client.phone.label("client_phone"),
                School.name.label("school_name"),
                func.count(Order.id).label("total_orders"),
                func.coalesce(func.sum(Order.total), 0).label("total_spent"),
                func.coalesce(func.sum(Order.balance), 0).label("total_pending"),
            )
            .join(Order, Order.client_id == Client.id)
            .outerjoin(School, School.id == Order.school_id)
            .where(and_(*intake))
            .group_by(
                Client.id, Client.code, Client.name, Client.phone, School.name
            )
            .order_by(func.count(Order.id).desc(), func.sum(Order.total).desc())
            .limit(limit)
        )
        rows = (await self.db.execute(query)).all()

        return [
            OrdersTopClient(
                client_id=row.client_id,
                client_code=row.client_code,
                client_name=row.client_name,
                client_phone=row.client_phone,
                school_name=row.school_name,
                total_orders=int(row.total_orders),
                total_spent=Decimal(str(row.total_spent)),
                total_pending=Decimal(str(row.total_pending)),
            )
            for row in rows
        ]
