"""Unified revenue/COGS/margin across all business lines.

Single source of truth for the executive "Resumen" view of the Reports
module. Composes Sales + Orders + Alterations into a uniform shape so
the frontend can render them side-by-side without three different
shapes to translate.

Architecture (Strategy pattern):
  - ``StreamCalculator`` Protocol: methods every stream must implement
  - One concrete calculator per stream
  - ``RevenueStreamService`` holds a registry; iterates it in parallel
  - Adding B2B / SaaS in the future = one class + one registry entry,
    no changes to the service or endpoints

Why a fresh service instead of extending FinancialStatementsService:
  - FinancialStatementsService is built around P&L semantics (income
    statement + balance sheet) and serves a different audience
    (accountant view).
  - RevenueStreamService is built around operational visibility (the
    owner asking "how is each line of business doing this month").
  - Both can coexist; both reuse `_cogs_resolver` for cost arithmetic
    so margins agree numerically.

Date semantics across calculators (basis-dependent):
  - SALES: cash == accrual (sale = confirmed = revenue at moment of sale)
  - ORDERS:
      accrual = sum(Order.total) where Order.delivered_at in window
                (Order.status = DELIVERED)
      cash    = sum(Transaction.amount) where Transaction.order_id is
                not null and transaction_date in window
  - ALTERATIONS:
      cash    = sum(AlterationPayment.amount) where created_at in window
                (split-payment safe)
      accrual = sum(Alteration.cost) where delivered_date in window
"""
from __future__ import annotations

import asyncio
import calendar
from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Protocol
from uuid import UUID

from sqlalchemy import select, func, and_, case, cast, Numeric
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.sale import Sale, SaleItem, SaleStatus
from app.models.order import Order, OrderItem, OrderStatus
from app.models.alteration import Alteration, AlterationPayment, AlterationStatus
from app.models.b2b import Contract, ContractStatus
from app.models.product import Product
from app.models.school import School
from app.models.accounting import Transaction, TransactionType
from app.schemas.reports import (
    RevenueStreamId,
    RevenueBasis,
    StreamBreakdown,
    StreamSummary,
    StreamMonthlyPoint,
    StreamMonthlyReport,
    StreamsBreakdownBySchool,
    StreamsSchoolBreakdownRow,
)
from app.services._cogs_resolver import resolved_cost, has_real_cost
from app.services.order_audit import order_audit_revenue_excluded_exists


# Spanish month names — kept here so this service is self-contained.
_MONTH_NAMES_ES = {
    1: 'Enero', 2: 'Febrero', 3: 'Marzo', 4: 'Abril',
    5: 'Mayo', 6: 'Junio', 7: 'Julio', 8: 'Agosto',
    9: 'Septiembre', 10: 'Octubre', 11: 'Noviembre', 12: 'Diciembre',
}


class StreamCalculator(Protocol):
    """Contract each stream calculator must implement.

    Calculators receive plain dates and school/branch filters and return
    a ``StreamBreakdown`` for the period. Implementations should issue
    as few SQL queries as possible — ideally one or two grouped
    aggregations per call.
    """
    stream_id: RevenueStreamId

    async def breakdown(
        self,
        start_date: date | None,
        end_date: date | None,
        school_id: UUID | None,
        branch_id: UUID | None,
        basis: RevenueBasis,
        include_cost: bool,
    ) -> StreamBreakdown: ...

    async def monthly_series(
        self,
        start_date: date,
        end_date: date,
        school_id: UUID | None,
        branch_id: UUID | None,
        basis: RevenueBasis,
        include_cost: bool,
    ) -> dict[str, StreamBreakdown]: ...
    """Returns ``{'YYYY-MM': StreamBreakdown, ...}`` for every month in
    the range, including months with zero activity (gap-filled by
    ``RevenueStreamService.get_streams_monthly``)."""


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _date_range_months(start: date, end: date) -> list[tuple[str, str, date, date]]:
    """Iterate over months between start and end (inclusive).

    Returns ``[(period_key, period_label, month_start, month_end), ...]``.
    """
    out: list[tuple[str, str, date, date]] = []
    year, month = start.year, start.month
    while (year, month) <= (end.year, end.month):
        m_start = date(year, month, 1)
        last_day = calendar.monthrange(year, month)[1]
        m_end = date(year, month, last_day)
        # Clip to outer bounds
        if m_start < start:
            m_start = start
        if m_end > end:
            m_end = end
        period_key = f"{year:04d}-{month:02d}"
        period_label = f"{_MONTH_NAMES_ES[month]} {year}"
        out.append((period_key, period_label, m_start, m_end))
        if month == 12:
            year, month = year + 1, 1
        else:
            month += 1
    return out


def _zero_breakdown(include_cost: bool, note: str | None = None) -> StreamBreakdown:
    return StreamBreakdown(
        revenue=Decimal("0"),
        cogs=Decimal("0") if include_cost else None,
        gross_profit=Decimal("0") if include_cost else None,
        gross_margin_pct=0.0 if include_cost else None,
        count=0,
        note=note,
    )


def _mask_costs(b: StreamBreakdown) -> StreamBreakdown:
    """Drop cost / margin fields — used when caller lacks
    `reports.cost_visibility`."""
    return StreamBreakdown(
        revenue=b.revenue,
        cogs=None,
        gross_profit=None,
        gross_margin_pct=None,
        count=b.count,
        note=b.note,
    )


# ---------------------------------------------------------------------------
# Sales calculator
# ---------------------------------------------------------------------------


class SalesStreamCalculator:
    stream_id = RevenueStreamId.SALES

    def __init__(self, db: AsyncSession):
        self.db = db

    def _date_filters(self, start_date: date | None, end_date: date | None) -> list:
        filters: list = [
            Sale.status == SaleStatus.COMPLETED,
            Sale.is_historical.is_(False),
        ]
        if start_date is not None:
            filters.append(Sale.sale_date >= datetime.combine(start_date, datetime.min.time()))
        if end_date is not None:
            filters.append(Sale.sale_date <= datetime.combine(end_date, datetime.max.time()))
        return filters

    async def breakdown(
        self, start_date, end_date, school_id, branch_id, basis, include_cost,
    ) -> StreamBreakdown:
        filters = self._date_filters(start_date, end_date)
        if school_id is not None:
            filters.append(Sale.school_id == school_id)
        # branch_id es filtro OPCIONAL (v3.1): None ⇒ sin filtrar (= consolidado).
        if branch_id is not None:
            filters.append(Sale.branch_id == branch_id)

        # Single aggregation: revenue + cogs + count
        if include_cost:
            cost_expr = resolved_cost(
                item_unit_cost_col=SaleItem.unit_cost,
                item_unit_price_col=SaleItem.unit_price,
                product_cost_col=Product.cost,
            )
            row = (await self.db.execute(
                select(
                    func.coalesce(func.sum(SaleItem.subtotal), 0).label('revenue'),
                    func.coalesce(func.sum(SaleItem.quantity * cost_expr), 0).label('cogs'),
                    func.count(func.distinct(Sale.id)).label('count'),
                )
                .select_from(SaleItem)
                .join(Sale, Sale.id == SaleItem.sale_id)
                .join(Product, Product.id == SaleItem.product_id)
                .where(and_(*filters))
            )).one()
            revenue = Decimal(str(row.revenue))
            cogs = Decimal(str(row.cogs))
            gp = revenue - cogs
            margin = float((gp / revenue * 100) if revenue > 0 else 0)
            return StreamBreakdown(
                revenue=revenue,
                cogs=cogs,
                gross_profit=gp,
                gross_margin_pct=round(margin, 1),
                count=int(row.count or 0),
            )
        # When cost is masked, skip the JOIN to SaleItem/Product (faster)
        row = (await self.db.execute(
            select(
                func.coalesce(func.sum(Sale.total), 0).label('revenue'),
                func.count(Sale.id).label('count'),
            ).where(and_(*filters))
        )).one()
        return StreamBreakdown(
            revenue=Decimal(str(row.revenue)),
            cogs=None, gross_profit=None, gross_margin_pct=None,
            count=int(row.count or 0),
        )

    async def monthly_series(
        self, start_date, end_date, school_id, branch_id, basis, include_cost,
    ) -> dict[str, StreamBreakdown]:
        # Group at the DB by month using date_trunc; faster than calling
        # breakdown() per month.
        filters = self._date_filters(start_date, end_date)
        if school_id is not None:
            filters.append(Sale.school_id == school_id)
        # branch_id es filtro OPCIONAL (v3.1): None ⇒ sin filtrar (= consolidado).
        if branch_id is not None:
            filters.append(Sale.branch_id == branch_id)

        month_trunc = func.date_trunc('month', Sale.sale_date)
        if include_cost:
            cost_expr = resolved_cost(
                item_unit_cost_col=SaleItem.unit_cost,
                item_unit_price_col=SaleItem.unit_price,
                product_cost_col=Product.cost,
            )
            rows = (await self.db.execute(
                select(
                    month_trunc.label('month'),
                    func.coalesce(func.sum(SaleItem.subtotal), 0).label('revenue'),
                    func.coalesce(func.sum(SaleItem.quantity * cost_expr), 0).label('cogs'),
                    func.count(func.distinct(Sale.id)).label('count'),
                )
                .select_from(SaleItem)
                .join(Sale, Sale.id == SaleItem.sale_id)
                .join(Product, Product.id == SaleItem.product_id)
                .where(and_(*filters))
                .group_by(month_trunc)
            )).all()
        else:
            rows = (await self.db.execute(
                select(
                    month_trunc.label('month'),
                    func.coalesce(func.sum(Sale.total), 0).label('revenue'),
                    func.count(Sale.id).label('count'),
                )
                .where(and_(*filters))
                .group_by(month_trunc)
            )).all()

        out: dict[str, StreamBreakdown] = {}
        for row in rows:
            key = row.month.strftime('%Y-%m')
            revenue = Decimal(str(row.revenue))
            if include_cost:
                cogs = Decimal(str(row.cogs))
                gp = revenue - cogs
                out[key] = StreamBreakdown(
                    revenue=revenue,
                    cogs=cogs,
                    gross_profit=gp,
                    gross_margin_pct=round(float((gp / revenue * 100) if revenue > 0 else 0), 1),
                    count=int(row.count or 0),
                )
            else:
                out[key] = StreamBreakdown(
                    revenue=revenue,
                    cogs=None, gross_profit=None, gross_margin_pct=None,
                    count=int(row.count or 0),
                )
        return out


# ---------------------------------------------------------------------------
# Orders calculator
# ---------------------------------------------------------------------------


class OrdersStreamCalculator:
    stream_id = RevenueStreamId.ORDERS

    def __init__(self, db: AsyncSession):
        self.db = db

    def _accrual_filters(self, start_date, end_date, school_id, branch_id=None):
        filters: list = [
            Order.status == OrderStatus.DELIVERED,
            Order.delivered_at.isnot(None),
            # Excluir encargos que la auditoría forense marcó cambio fantasma
            # (duplican el ingreso de la venta original) o cancelados.
            ~order_audit_revenue_excluded_exists(Order.id),
        ]
        if start_date is not None:
            filters.append(Order.delivered_at >= datetime.combine(start_date, datetime.min.time()))
        if end_date is not None:
            filters.append(Order.delivered_at <= datetime.combine(end_date, datetime.max.time()))
        if school_id is not None:
            filters.append(Order.school_id == school_id)
        # branch_id es filtro OPCIONAL (v3.1): None ⇒ sin filtrar (= consolidado).
        if branch_id is not None:
            filters.append(Order.branch_id == branch_id)
        return filters

    def _cash_filters(self, start_date, end_date, school_id, branch_id=None):
        filters: list = [
            Transaction.type == TransactionType.INCOME,
            Transaction.order_id.isnot(None),
        ]
        if start_date is not None:
            filters.append(Transaction.transaction_date >= start_date)
        if end_date is not None:
            filters.append(Transaction.transaction_date <= end_date)
        if school_id is not None:
            filters.append(Transaction.school_id == school_id)
        # branch_id es filtro OPCIONAL (v3.1): None ⇒ sin filtrar (= consolidado).
        if branch_id is not None:
            filters.append(Transaction.branch_id == branch_id)
        return filters

    async def breakdown(
        self, start_date, end_date, school_id, branch_id, basis, include_cost,
    ) -> StreamBreakdown:
        # Revenue depends on basis
        if basis == RevenueBasis.CASH:
            cash_filters = self._cash_filters(start_date, end_date, school_id, branch_id)
            rev_row = (await self.db.execute(
                select(
                    func.coalesce(func.sum(Transaction.amount), 0).label('revenue'),
                    func.count(Transaction.id).label('count'),
                ).where(and_(*cash_filters))
            )).one()
            revenue = Decimal(str(rev_row.revenue))
            count = int(rev_row.count or 0)
        else:
            accrual_filters = self._accrual_filters(start_date, end_date, school_id, branch_id)
            rev_row = (await self.db.execute(
                select(
                    func.coalesce(func.sum(Order.total), 0).label('revenue'),
                    func.count(Order.id).label('count'),
                ).where(and_(*accrual_filters))
            )).one()
            revenue = Decimal(str(rev_row.revenue))
            count = int(rev_row.count or 0)

        if not include_cost:
            return StreamBreakdown(
                revenue=revenue,
                cogs=None, gross_profit=None, gross_margin_pct=None,
                count=count,
            )

        # COGS — same fallback chain as Sales, over OrderItem.
        cogs_filters: list = [Order.status != OrderStatus.CANCELLED]
        if start_date is not None:
            cogs_filters.append(Order.order_date >= datetime.combine(start_date, datetime.min.time()))
        if end_date is not None:
            cogs_filters.append(Order.order_date <= datetime.combine(end_date, datetime.max.time()))
        if school_id is not None:
            cogs_filters.append(Order.school_id == school_id)
        # branch_id es filtro OPCIONAL (v3.1): None ⇒ sin filtrar (= consolidado).
        if branch_id is not None:
            cogs_filters.append(Order.branch_id == branch_id)

        item_cost = resolved_cost(
            item_unit_cost_col=OrderItem.unit_cost,
            item_unit_price_col=OrderItem.unit_price,
            product_cost_col=Product.cost,
        )
        cogs_row = (await self.db.execute(
            select(
                func.coalesce(func.sum(OrderItem.quantity * item_cost), 0).label('cogs'),
            )
            .select_from(OrderItem)
            .join(Order, Order.id == OrderItem.order_id)
            .join(Product, Product.id == OrderItem.product_id)
            .where(and_(*cogs_filters, OrderItem.product_id.isnot(None)))
        )).one()
        cogs = Decimal(str(cogs_row.cogs))
        gp = revenue - cogs
        margin = float((gp / revenue * 100) if revenue > 0 else 0)
        return StreamBreakdown(
            revenue=revenue,
            cogs=cogs,
            gross_profit=gp,
            gross_margin_pct=round(margin, 1),
            count=count,
        )

    async def monthly_series(
        self, start_date, end_date, school_id, branch_id, basis, include_cost,
    ) -> dict[str, StreamBreakdown]:
        # For Orders, revenue grouping by month differs between accrual
        # (group by delivered_at) and cash (group by Transaction.transaction_date).
        if basis == RevenueBasis.CASH:
            filters = self._cash_filters(start_date, end_date, school_id, branch_id)
            month_trunc = func.date_trunc('month', Transaction.transaction_date)
            rows = (await self.db.execute(
                select(
                    month_trunc.label('month'),
                    func.coalesce(func.sum(Transaction.amount), 0).label('revenue'),
                    func.count(Transaction.id).label('count'),
                )
                .where(and_(*filters))
                .group_by(month_trunc)
            )).all()
        else:
            filters = self._accrual_filters(start_date, end_date, school_id, branch_id)
            month_trunc = func.date_trunc('month', Order.delivered_at)
            rows = (await self.db.execute(
                select(
                    month_trunc.label('month'),
                    func.coalesce(func.sum(Order.total), 0).label('revenue'),
                    func.count(Order.id).label('count'),
                )
                .where(and_(*filters))
                .group_by(month_trunc)
            )).all()

        out: dict[str, StreamBreakdown] = {}
        for row in rows:
            key = row.month.strftime('%Y-%m')
            out[key] = StreamBreakdown(
                revenue=Decimal(str(row.revenue)),
                cogs=None if not include_cost else Decimal("0"),
                gross_profit=None if not include_cost else Decimal("0"),
                gross_margin_pct=None if not include_cost else 0.0,
                count=int(row.count or 0),
            )
        # NOTE: monthly COGS for Orders is intentionally not computed in the
        # trend chart — would require a second per-month query and slow down
        # the endpoint significantly. The headline `breakdown()` returns the
        # accurate period COGS; the trend chart focuses on revenue volume.
        return out


# ---------------------------------------------------------------------------
# Alterations calculator
# ---------------------------------------------------------------------------


class AlterationsStreamCalculator:
    stream_id = RevenueStreamId.ALTERATIONS

    def __init__(self, db: AsyncSession):
        self.db = db

    async def breakdown(
        self, start_date, end_date, school_id, branch_id, basis, include_cost,
    ) -> StreamBreakdown:
        # Alterations don't have school_id NOR branch_id (workshop is global
        # today). Both filters are ignored — same total returned regardless of
        # school_id/branch_id. branch_id stays no-op here until a future phase
        # adds the column to `alterations` (documented in the Phase 0b ADR).
        if basis == RevenueBasis.CASH:
            filters: list = []
            if start_date is not None:
                filters.append(AlterationPayment.created_at >= datetime.combine(start_date, datetime.min.time()))
            if end_date is not None:
                filters.append(AlterationPayment.created_at <= datetime.combine(end_date, datetime.max.time()))
            row = (await self.db.execute(
                select(
                    func.coalesce(func.sum(AlterationPayment.amount), 0).label('revenue'),
                    func.count(AlterationPayment.id).label('count'),
                ).where(and_(*filters) if filters else True)
            )).one()
        else:
            filters = [
                Alteration.delivered_date.isnot(None),
                Alteration.status == AlterationStatus.DELIVERED,
            ]
            if start_date is not None:
                filters.append(Alteration.delivered_date >= start_date)
            if end_date is not None:
                filters.append(Alteration.delivered_date <= end_date)
            row = (await self.db.execute(
                select(
                    func.coalesce(func.sum(Alteration.cost), 0).label('revenue'),
                    func.count(Alteration.id).label('count'),
                ).where(and_(*filters))
            )).one()

        revenue = Decimal(str(row.revenue))
        count = int(row.count or 0)

        # Alterations have zero COGS by default (pure service — no
        # material cost tracked). A future `cost_of_service` hook would
        # subtract labor cost here.
        if not include_cost:
            return StreamBreakdown(
                revenue=revenue,
                cogs=None, gross_profit=None, gross_margin_pct=None,
                count=count,
            )
        return StreamBreakdown(
            revenue=revenue,
            cogs=Decimal("0"),
            gross_profit=revenue,
            gross_margin_pct=100.0 if revenue > 0 else 0.0,
            count=count,
            note=None,
        )

    async def monthly_series(
        self, start_date, end_date, school_id, branch_id, basis, include_cost,
    ) -> dict[str, StreamBreakdown]:
        if basis == RevenueBasis.CASH:
            filters: list = []
            if start_date is not None:
                filters.append(AlterationPayment.created_at >= datetime.combine(start_date, datetime.min.time()))
            if end_date is not None:
                filters.append(AlterationPayment.created_at <= datetime.combine(end_date, datetime.max.time()))
            month_trunc = func.date_trunc('month', AlterationPayment.created_at)
            rows = (await self.db.execute(
                select(
                    month_trunc.label('month'),
                    func.coalesce(func.sum(AlterationPayment.amount), 0).label('revenue'),
                    func.count(AlterationPayment.id).label('count'),
                )
                .where(and_(*filters) if filters else True)
                .group_by(month_trunc)
            )).all()
        else:
            filters = [
                Alteration.delivered_date.isnot(None),
                Alteration.status == AlterationStatus.DELIVERED,
            ]
            if start_date is not None:
                filters.append(Alteration.delivered_date >= start_date)
            if end_date is not None:
                filters.append(Alteration.delivered_date <= end_date)
            month_trunc = func.date_trunc('month', Alteration.delivered_date)
            rows = (await self.db.execute(
                select(
                    month_trunc.label('month'),
                    func.coalesce(func.sum(Alteration.cost), 0).label('revenue'),
                    func.count(Alteration.id).label('count'),
                )
                .where(and_(*filters))
                .group_by(month_trunc)
            )).all()

        out: dict[str, StreamBreakdown] = {}
        for row in rows:
            key = row.month.strftime('%Y-%m')
            revenue = Decimal(str(row.revenue))
            if include_cost:
                out[key] = StreamBreakdown(
                    revenue=revenue, cogs=Decimal("0"),
                    gross_profit=revenue,
                    gross_margin_pct=100.0 if revenue > 0 else 0.0,
                    count=int(row.count or 0),
                )
            else:
                out[key] = StreamBreakdown(
                    revenue=revenue,
                    cogs=None, gross_profit=None, gross_margin_pct=None,
                    count=int(row.count or 0),
                )
        return out


# ---------------------------------------------------------------------------
# B2B contracts calculator
# ---------------------------------------------------------------------------


class B2BContractsStreamCalculator:
    """Stream de contratos B2B (dotación corporativa / eventos).

    Date semantics (espeja Orders):
      - accrual = sum(Contract.total) con Contract.delivered_at en ventana
                  (Contract.status = DELIVERED). Las entregas por hito
                  (partial_delivery) se contabilizan al cerrar el contrato.
      - cash    = sum(Transaction.amount) con type=INCOME y category='b2b'
                  en ventana (el ingreso B2B se reconoce vía record() en la
                  entrega; el anticipo NO es ingreso → no aparece aquí).
      - COGS    = sum(Transaction.amount) con type=EXPENSE y category='b2b_cogs'.

    B2B es GLOBAL (sin school_id): si se filtra por school_id devuelve cero,
    para no atribuir un contrato corporativo a un colegio puntual. `branch_id`
    es no-op aquí: `contracts` no tiene la columna (B2B es corporativo, sin
    sucursal) hasta una fase futura — documentado en el ADR de la Fase 0b.
    """
    stream_id = RevenueStreamId.B2B_CONTRACTS

    def __init__(self, db: AsyncSession):
        self.db = db

    def _accrual_filters(self, start_date, end_date) -> list:
        filters: list = [
            Contract.status == ContractStatus.DELIVERED,
            Contract.delivered_at.isnot(None),
        ]
        if start_date is not None:
            filters.append(Contract.delivered_at >= datetime.combine(start_date, datetime.min.time()))
        if end_date is not None:
            filters.append(Contract.delivered_at <= datetime.combine(end_date, datetime.max.time()))
        return filters

    def _cash_filters(self, start_date, end_date) -> list:
        filters: list = [
            Transaction.type == TransactionType.INCOME,
            Transaction.category == 'b2b',
        ]
        if start_date is not None:
            filters.append(Transaction.transaction_date >= start_date)
        if end_date is not None:
            filters.append(Transaction.transaction_date <= end_date)
        return filters

    async def breakdown(
        self, start_date, end_date, school_id, branch_id, basis, include_cost,
    ) -> StreamBreakdown:
        # B2B no se atribuye a un colegio puntual.
        if school_id is not None:
            return _zero_breakdown(include_cost, note='b2b_global_only')

        if basis == RevenueBasis.CASH:
            row = (await self.db.execute(
                select(
                    func.coalesce(func.sum(Transaction.amount), 0).label('revenue'),
                    func.count(Transaction.id).label('count'),
                ).where(and_(*self._cash_filters(start_date, end_date)))
            )).one()
        else:
            row = (await self.db.execute(
                select(
                    func.coalesce(func.sum(Contract.total), 0).label('revenue'),
                    func.count(Contract.id).label('count'),
                ).where(and_(*self._accrual_filters(start_date, end_date)))
            )).one()
        revenue = Decimal(str(row.revenue))
        count = int(row.count or 0)

        if not include_cost:
            return StreamBreakdown(
                revenue=revenue, cogs=None, gross_profit=None,
                gross_margin_pct=None, count=count,
            )

        cogs_filters: list = [
            Transaction.type == TransactionType.EXPENSE,
            Transaction.category == 'b2b_cogs',
        ]
        if start_date is not None:
            cogs_filters.append(Transaction.transaction_date >= start_date)
        if end_date is not None:
            cogs_filters.append(Transaction.transaction_date <= end_date)
        cogs_row = (await self.db.execute(
            select(func.coalesce(func.sum(Transaction.amount), 0).label('cogs'))
            .where(and_(*cogs_filters))
        )).one()
        cogs = Decimal(str(cogs_row.cogs))
        gp = revenue - cogs
        margin = float((gp / revenue * 100) if revenue > 0 else 0)
        return StreamBreakdown(
            revenue=revenue, cogs=cogs, gross_profit=gp,
            gross_margin_pct=round(margin, 1), count=count,
        )

    async def monthly_series(
        self, start_date, end_date, school_id, branch_id, basis, include_cost,
    ) -> dict[str, StreamBreakdown]:
        if school_id is not None:
            return {}
        if basis == RevenueBasis.CASH:
            month_trunc = func.date_trunc('month', Transaction.transaction_date)
            rows = (await self.db.execute(
                select(
                    month_trunc.label('month'),
                    func.coalesce(func.sum(Transaction.amount), 0).label('revenue'),
                    func.count(Transaction.id).label('count'),
                ).where(and_(*self._cash_filters(start_date, end_date))).group_by(month_trunc)
            )).all()
        else:
            month_trunc = func.date_trunc('month', Contract.delivered_at)
            rows = (await self.db.execute(
                select(
                    month_trunc.label('month'),
                    func.coalesce(func.sum(Contract.total), 0).label('revenue'),
                    func.count(Contract.id).label('count'),
                ).where(and_(*self._accrual_filters(start_date, end_date))).group_by(month_trunc)
            )).all()

        out: dict[str, StreamBreakdown] = {}
        for row in rows:
            key = row.month.strftime('%Y-%m')
            out[key] = StreamBreakdown(
                revenue=Decimal(str(row.revenue)),
                cogs=None if not include_cost else Decimal("0"),
                gross_profit=None if not include_cost else Decimal("0"),
                gross_margin_pct=None if not include_cost else 0.0,
                count=int(row.count or 0),
            )
        return out


# ---------------------------------------------------------------------------
# Aggregator
# ---------------------------------------------------------------------------


class RevenueStreamService:
    """Unified read-side aggregator for the Resumen tab.

    Keeps stream calculators decoupled — adding a new revenue stream =
    one calculator class + one registry entry. The HTTP endpoints
    consume this service only.
    """

    def __init__(self, db: AsyncSession):
        self.db = db
        # Fase 4: B2B_CONTRACTS calculator is registered as a stub that
        # returns zeros until the b2b_contracts model lands.
        self._registry: dict[RevenueStreamId, StreamCalculator] = {
            RevenueStreamId.SALES: SalesStreamCalculator(db),
            RevenueStreamId.ORDERS: OrdersStreamCalculator(db),
            RevenueStreamId.ALTERATIONS: AlterationsStreamCalculator(db),
            RevenueStreamId.B2B_CONTRACTS: B2BContractsStreamCalculator(db),
        }

    def _select_streams(
        self,
        streams: list[RevenueStreamId] | None,
    ) -> list[StreamCalculator]:
        """Default = all registered streams. Caller can pass a subset
        (e.g. just SALES+ORDERS to skip the slow Alterations payment query)."""
        if not streams:
            return list(self._registry.values())
        return [self._registry[s] for s in streams if s in self._registry]

    async def get_streams_summary(
        self,
        start_date: date | None = None,
        end_date: date | None = None,
        school_id: UUID | None = None,
        branch_id: UUID | None = None,
        basis: RevenueBasis = RevenueBasis.ACCRUAL,
        streams: list[RevenueStreamId] | None = None,
        include_cost: bool = True,
    ) -> StreamSummary:
        """Returns one ``StreamBreakdown`` per requested stream plus
        the totals row. All calculators run in parallel via asyncio.gather.
        """
        targets = self._select_streams(streams)

        # Parallel fan-out: each calculator runs its query independently.
        # asyncpg connections within an asyncio task are safe because each
        # calculator uses the same AsyncSession serially internally.
        results = await asyncio.gather(*[
            calc.breakdown(
                start_date, end_date, school_id, branch_id, basis, include_cost,
            )
            for calc in targets
        ])

        per_stream = {calc.stream_id: res for calc, res in zip(targets, results)}

        # Totals
        total_revenue = sum((b.revenue for b in per_stream.values()), Decimal("0"))
        total_count = sum(b.count for b in per_stream.values())
        if include_cost:
            total_cogs = sum(
                (b.cogs for b in per_stream.values() if b.cogs is not None),
                Decimal("0"),
            )
            total_gp = total_revenue - total_cogs
            total_margin = float((total_gp / total_revenue * 100) if total_revenue > 0 else 0)
            totals = StreamBreakdown(
                revenue=total_revenue,
                cogs=total_cogs,
                gross_profit=total_gp,
                gross_margin_pct=round(total_margin, 1),
                count=total_count,
            )
        else:
            totals = StreamBreakdown(
                revenue=total_revenue,
                cogs=None, gross_profit=None, gross_margin_pct=None,
                count=total_count,
            )

        # If cost masking is on (include_cost=False) ensure each stream's
        # breakdown also has nulls (some calculators always compute cogs).
        if not include_cost:
            per_stream = {k: _mask_costs(v) for k, v in per_stream.items()}

        return StreamSummary(
            period_start=start_date,
            period_end=end_date,
            school_id=school_id,
            branch_id=branch_id,
            basis=basis,
            streams=per_stream,
            totals=totals,
        )

    async def get_streams_monthly(
        self,
        start_date: date,
        end_date: date,
        school_id: UUID | None = None,
        branch_id: UUID | None = None,
        basis: RevenueBasis = RevenueBasis.ACCRUAL,
        streams: list[RevenueStreamId] | None = None,
        include_cost: bool = True,
    ) -> StreamMonthlyReport:
        """Monthly trend across streams. Every month in the range
        appears even if zero (gap-fill)."""
        targets = self._select_streams(streams)

        series_results = await asyncio.gather(*[
            calc.monthly_series(
                start_date, end_date, school_id, branch_id, basis, include_cost,
            )
            for calc in targets
        ])

        per_stream_series: dict[RevenueStreamId, dict[str, StreamBreakdown]] = {
            calc.stream_id: series for calc, series in zip(targets, series_results)
        }

        month_buckets = _date_range_months(start_date, end_date)
        months: list[StreamMonthlyPoint] = []
        totals_per_stream: dict[RevenueStreamId, StreamBreakdown] = {
            s: _zero_breakdown(include_cost) for s in per_stream_series.keys()
        }

        for period_key, period_label, _, _ in month_buckets:
            row_streams: dict[RevenueStreamId, StreamBreakdown] = {}
            for stream_id, series in per_stream_series.items():
                bd = series.get(period_key, _zero_breakdown(include_cost))
                row_streams[stream_id] = bd
                # Accumulate totals per stream
                existing = totals_per_stream[stream_id]
                totals_per_stream[stream_id] = StreamBreakdown(
                    revenue=existing.revenue + bd.revenue,
                    cogs=(
                        (existing.cogs or Decimal("0")) + (bd.cogs or Decimal("0"))
                        if include_cost else None
                    ),
                    gross_profit=None,  # Computed in a final pass
                    gross_margin_pct=None,
                    count=existing.count + bd.count,
                )
            months.append(StreamMonthlyPoint(
                period=period_key,
                period_label=period_label,
                streams=row_streams,
            ))

        # Final pass: compute gross_profit / margin for the per-stream totals
        for s, bd in totals_per_stream.items():
            if include_cost:
                gp = bd.revenue - (bd.cogs or Decimal("0"))
                margin = float((gp / bd.revenue * 100) if bd.revenue > 0 else 0)
                totals_per_stream[s] = StreamBreakdown(
                    revenue=bd.revenue,
                    cogs=bd.cogs,
                    gross_profit=gp,
                    gross_margin_pct=round(margin, 1),
                    count=bd.count,
                )

        grand_revenue = sum((b.revenue for b in totals_per_stream.values()), Decimal("0"))
        grand_count = sum(b.count for b in totals_per_stream.values())
        if include_cost:
            grand_cogs = sum(
                (b.cogs for b in totals_per_stream.values() if b.cogs is not None),
                Decimal("0"),
            )
            grand_gp = grand_revenue - grand_cogs
            grand_total = StreamBreakdown(
                revenue=grand_revenue,
                cogs=grand_cogs,
                gross_profit=grand_gp,
                gross_margin_pct=round(
                    float((grand_gp / grand_revenue * 100) if grand_revenue > 0 else 0),
                    1,
                ),
                count=grand_count,
            )
        else:
            grand_total = StreamBreakdown(
                revenue=grand_revenue,
                cogs=None, gross_profit=None, gross_margin_pct=None,
                count=grand_count,
            )

        return StreamMonthlyReport(
            period_start=start_date,
            period_end=end_date,
            school_id=school_id,
            branch_id=branch_id,
            basis=basis,
            months=months,
            totals=totals_per_stream,
            grand_total=grand_total,
        )

    async def get_streams_breakdown_by_school(
        self,
        start_date: date | None = None,
        end_date: date | None = None,
        basis: RevenueBasis = RevenueBasis.ACCRUAL,
    ) -> StreamsBreakdownBySchool:
        """3-column-per-school table for the Resumen tab.

        Alterations are NOT broken down per school (the workshop is
        global today). They appear only in the totals row to keep the
        sum-of-rows == grand-total invariant intact via a sentinel
        "Sin colegio" pseudo-row.
        """
        # Sales revenue by school
        sale_filters: list = [
            Sale.status == SaleStatus.COMPLETED,
            Sale.is_historical.is_(False),
        ]
        if start_date is not None:
            sale_filters.append(Sale.sale_date >= datetime.combine(start_date, datetime.min.time()))
        if end_date is not None:
            sale_filters.append(Sale.sale_date <= datetime.combine(end_date, datetime.max.time()))

        sales_by_school = {
            r.school_id: Decimal(str(r.revenue))
            for r in (await self.db.execute(
                select(
                    Sale.school_id.label('school_id'),
                    func.coalesce(func.sum(Sale.total), 0).label('revenue'),
                ).where(and_(*sale_filters)).group_by(Sale.school_id)
            )).all()
        }

        # Orders revenue by school — basis-aware
        if basis == RevenueBasis.CASH:
            o_filters: list = [
                Transaction.type == TransactionType.INCOME,
                Transaction.order_id.isnot(None),
            ]
            if start_date is not None:
                o_filters.append(Transaction.transaction_date >= start_date)
            if end_date is not None:
                o_filters.append(Transaction.transaction_date <= end_date)
            orders_by_school = {
                r.school_id: Decimal(str(r.revenue))
                for r in (await self.db.execute(
                    select(
                        Transaction.school_id.label('school_id'),
                        func.coalesce(func.sum(Transaction.amount), 0).label('revenue'),
                    ).where(and_(*o_filters)).group_by(Transaction.school_id)
                )).all()
            }
        else:
            o_filters = [
                Order.status == OrderStatus.DELIVERED,
                Order.delivered_at.isnot(None),
            ]
            if start_date is not None:
                o_filters.append(Order.delivered_at >= datetime.combine(start_date, datetime.min.time()))
            if end_date is not None:
                o_filters.append(Order.delivered_at <= datetime.combine(end_date, datetime.max.time()))
            orders_by_school = {
                r.school_id: Decimal(str(r.revenue))
                for r in (await self.db.execute(
                    select(
                        Order.school_id.label('school_id'),
                        func.coalesce(func.sum(Order.total), 0).label('revenue'),
                    ).where(and_(*o_filters)).group_by(Order.school_id)
                )).all()
            }

        # Resolve school names — use all schools that appear in either map
        school_ids = set(sales_by_school.keys()) | set(orders_by_school.keys())
        schools_meta = (await self.db.execute(
            select(School.id, School.name)
            .where(School.id.in_(school_ids))
        )).all() if school_ids else []
        school_names = {s.id: s.name for s in schools_meta}

        # Build per-school rows. Alterations not included here.
        rows: list[StreamsSchoolBreakdownRow] = []
        total_sales = Decimal("0")
        total_orders = Decimal("0")
        for sid in school_ids:
            sales = sales_by_school.get(sid, Decimal("0"))
            orders = orders_by_school.get(sid, Decimal("0"))
            total_sales += sales
            total_orders += orders
            rows.append(StreamsSchoolBreakdownRow(
                school_id=sid,
                school_name=school_names.get(sid, '(sin nombre)'),
                sales_revenue=sales,
                orders_revenue=orders,
                alterations_revenue=Decimal("0"),  # not school-scoped
                total_revenue=sales + orders,
            ))
        # Sort by total_revenue desc
        rows.sort(key=lambda r: r.total_revenue, reverse=True)

        # Alterations total (cross-school) — added only to the totals row
        alt_calc = self._registry[RevenueStreamId.ALTERATIONS]
        alt_breakdown = await alt_calc.breakdown(
            start_date, end_date, None, None, basis, include_cost=False,
        )
        total_alterations = alt_breakdown.revenue

        totals = StreamsSchoolBreakdownRow(
            school_id=UUID(int=0),  # sentinel
            school_name='TOTAL',
            sales_revenue=total_sales,
            orders_revenue=total_orders,
            alterations_revenue=total_alterations,
            total_revenue=total_sales + total_orders + total_alterations,
        )

        return StreamsBreakdownBySchool(
            period_start=start_date,
            period_end=end_date,
            basis=basis,
            rows=rows,
            totals=totals,
        )
