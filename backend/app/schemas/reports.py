"""Pydantic response schemas for the Reports module.

Until this module existed, ``/global/reports/*`` endpoints returned raw
dicts — a violation of the project ``api-design.md`` rule that every
endpoint must declare a Pydantic ``response_model``. This module is the
canonical home for those schemas, starting with the Orders coverage
(Fase 1 of the Reports Coverage plan).

Shared conventions:
  * ``Decimal`` is preserved through serialization (returned as a string
    in JSON to keep money-precision intact). The frontend parses it as a
    number when ready.
  * ``None`` is the explicit signal for "absent / not computable", e.g.
    ``avg_lead_time_days`` is ``None`` when there are no delivered orders
    in the period — distinguishable from ``0`` (delivered same day).
  * Every list field is concrete (``list[Row]``), never a bare ``list`` —
    OpenAPI consumers depend on the item shape.
"""
from __future__ import annotations

from datetime import date
from decimal import Decimal
from enum import Enum
from uuid import UUID

from pydantic import Field

from app.schemas.base import BaseSchema


# ---------------------------------------------------------------------------
# Orders summary
# ---------------------------------------------------------------------------


class OrdersStatusCounts(BaseSchema):
    """Count of orders per status within a period."""

    pending: int = 0
    in_production: int = 0
    ready: int = 0
    delivered: int = 0
    cancelled: int = 0


class OrdersSummary(BaseSchema):
    """Aggregate summary of orders for a period.

    Notes on the two revenue numbers:
      * ``revenue_delivered`` — accrual basis (matches P&L): ``Order.total``
        summed where the order transitioned to DELIVERED in the period.
      * ``revenue_paid`` — cash basis (matches cash drawer): payments
        landed in the period regardless of when the order was created.

    Both are reported so the caller can pick the right semantic for the
    question being asked (financial P&L vs. cash availability).
    """

    period_start: date | None = None
    period_end: date | None = None
    school_id: UUID | None = None

    total_count: int
    revenue_delivered: Decimal
    revenue_paid: Decimal
    balance_pending: Decimal = Field(
        description=(
            "Sum of Order.balance for non-cancelled orders received in the "
            "period — money still to be collected."
        ),
    )
    avg_ticket: Decimal | None = Field(
        default=None,
        description="revenue_delivered / delivered_count, or None when zero.",
    )

    by_status: OrdersStatusCounts
    delivered_count: int
    cancelled_count: int


# ---------------------------------------------------------------------------
# Status funnel (operational view, not financial)
# ---------------------------------------------------------------------------


class OrdersFunnelStep(BaseSchema):
    """One step of the orders status funnel."""

    status: str
    label: str
    count: int


class OrdersStatusFunnel(BaseSchema):
    """Funnel of orders received in the period, by status.

    Useful for spotting bottlenecks: many `pending` and few
    `in_production` signals queue stuck at intake.
    """

    period_start: date | None = None
    period_end: date | None = None
    school_id: UUID | None = None
    steps: list[OrdersFunnelStep]


# ---------------------------------------------------------------------------
# On-time delivery
# ---------------------------------------------------------------------------


class OrdersOnTimeDelivery(BaseSchema):
    """Cumplimiento de entregas in a period.

    ``avg_lead_time_days`` is computed against ``delivered_at - order_date``
    on delivered orders; ``None`` when no orders were delivered.
    ``on_time_pct`` is the share of delivered orders whose
    ``delivered_at`` is on or before ``delivery_date``. Orders with
    ``delivery_date IS NULL`` are excluded from both numerator and
    denominator.
    """

    period_start: date | None = None
    period_end: date | None = None
    school_id: UUID | None = None
    delivered_count: int
    on_time_count: int
    late_count: int
    on_time_pct: float | None = None
    avg_lead_time_days: float | None = None
    oldest_pending_days: int = Field(
        default=0,
        description=(
            "Days since the oldest non-delivered order's delivery_date "
            "(0 when nothing is overdue)."
        ),
    )


# ---------------------------------------------------------------------------
# Cumplimiento por colegio (overdue orders)
# ---------------------------------------------------------------------------


class OrdersCumplimientoRow(BaseSchema):
    """One row of the overdue-by-school report."""

    school_id: UUID
    school_name: str
    overdue_count: int = Field(
        description=(
            "Orders whose delivery_date is before today and status NOT IN "
            "(DELIVERED, CANCELLED)."
        ),
    )
    avg_days_late: float
    oldest_overdue_days: int


# ---------------------------------------------------------------------------
# Orders profitability by school
# ---------------------------------------------------------------------------


class OrdersProfitabilityRow(BaseSchema):
    """Per-school profitability row for Orders.

    Same shape as ``SalesProfitabilityRow`` so the frontend can render
    them with the same table component. Uses the shared
    ``_cogs_resolver`` fallback chain (SaleItem.unit_cost → Product.cost
    → unit_price * 0.80), guaranteeing parity with the Sales report.
    """

    school_id: UUID
    school_name: str
    revenue: Decimal
    cogs: Decimal | None = Field(
        default=None,
        description=(
            "Null when the caller lacks `reports.cost_visibility` "
            "permission — masking applied at the endpoint layer."
        ),
    )
    gross_profit: Decimal | None = None
    gross_margin: float | None = None
    units_with_cost: int
    units_estimated: int
    cost_coverage_percent: float


class OrdersProfitabilityTotals(BaseSchema):
    revenue: Decimal
    cogs: Decimal | None = None
    gross_profit: Decimal | None = None
    gross_margin: float | None = None


class OrdersProfitabilityResponse(BaseSchema):
    period_start: date | None = None
    period_end: date | None = None
    schools: list[OrdersProfitabilityRow]
    totals: OrdersProfitabilityTotals


# ---------------------------------------------------------------------------
# Top lists shared between Sales and Orders reports
# ---------------------------------------------------------------------------


class OrdersTopProduct(BaseSchema):
    """Most-ordered products in a period (by units)."""

    product_id: UUID | None = None
    product_code: str | None = None
    product_name: str
    product_size: str | None = None
    school_name: str | None = None
    units_ordered: int
    total_revenue: Decimal


class OrdersTopClient(BaseSchema):
    """Clients with the most orders in a period."""

    client_id: UUID
    client_code: str
    client_name: str
    client_phone: str | None = None
    school_name: str | None = None
    total_orders: int
    total_spent: Decimal
    total_pending: Decimal = Field(
        description="Sum of balance pending across this client's orders.",
    )


# ---------------------------------------------------------------------------
# Alterations enhancement — Fase 2 del plan Reports Coverage
# ---------------------------------------------------------------------------


class AlterationsTopType(BaseSchema):
    """One row of the "top alteration types" report.

    Reports the most-frequent alteration types in the period with their
    revenue and average response time so the user can spot patterns —
    e.g. dobladillos are 60% of volume and average 2 days vs ajustes at
    7 days, suggesting capacity could be re-balanced.
    """

    alteration_type: str
    type_label: str
    count: int
    revenue: Decimal
    avg_response_hours: float | None = Field(
        default=None,
        description=(
            "Average hours between received_date and ready_at, "
            "computed only on alterations that reached READY in the "
            "period. Null when no alteration of this type has a "
            "ready_at timestamp (legacy rows pre-migration)."
        ),
    )


class AlterationsOverdueRow(BaseSchema):
    """An alteration that is READY but the client hasn't picked it up."""

    id: UUID
    code: str
    client_name: str
    garment_name: str
    status: str
    ready_at: str | None
    days_since_ready: int
    balance: Decimal


class AlterationsResponseTime(BaseSchema):
    """Operational KPIs for alteration turnaround.

    Two distinct windows:
      * `received_to_ready` — production time. Excludes rows without
        `ready_at` (legacy rows that pre-date the migration).
      * `ready_to_delivered` — pickup time. Excludes rows without
        `delivered_date`.

    Overdue pickup counts alterations marked READY more than
    `overdue_threshold_days` ago but not yet DELIVERED — money the
    business already earned (the alteration is done) but not yet
    collected because the client hasn't returned.
    """

    period_start: date | None = None
    period_end: date | None = None

    avg_received_to_ready_days: float | None = None
    median_received_to_ready_days: float | None = None
    sample_received_to_ready: int = 0

    avg_ready_to_delivered_days: float | None = None
    sample_ready_to_delivered: int = 0

    overdue_pickup_count: int
    overdue_pickup_threshold_days: int
    overdue_pickup_revenue_pending: Decimal


# ---------------------------------------------------------------------------
# Unified Revenue Streams — Fase 3 del plan Reports Coverage
# ---------------------------------------------------------------------------


class RevenueStreamId(str, Enum):
    """Discriminator for each revenue stream the business has.

    The enum is the single source of truth — adding B2B contracts or SaaS
    is a one-line addition here plus registering a calculator.
    Mirrored on the frontend in components/reports/types.ts.
    """
    SALES = "sales"
    ORDERS = "orders"
    ALTERATIONS = "alterations"
    B2B_CONTRACTS = "b2b_contracts"  # Fase 4 placeholder (returns zeros)
    SAAS = "saas"                    # Future


class RevenueBasis(str, Enum):
    """Whether revenue is recognized at payment (cash) or at delivery
    (accrual). Cash basis aligns with caja drawer / cash flow. Accrual
    basis is the canonical P&L semantic.
    """
    CASH = "cash"
    ACCRUAL = "accrual"


class StreamBreakdown(BaseSchema):
    """One stream's contribution within a period.

    `cogs`, `gross_profit`, `gross_margin_pct` are nullable so the
    endpoint can mask them when the caller lacks
    `reports.cost_visibility`. `revenue` and `count` stay visible
    regardless of permission.
    """
    revenue: Decimal
    cogs: Decimal | None = None
    gross_profit: Decimal | None = None
    gross_margin_pct: float | None = None
    count: int = Field(
        description="Number of underlying transactions (sales, deliveries, payments) for this stream in this period.",
    )
    note: str | None = Field(
        default=None,
        description="Free-form note from the calculator (e.g. 'not_yet_implemented' for B2B stub).",
    )


class StreamSummary(BaseSchema):
    """Aggregate of every requested stream for a period.

    Invariant: `sum(streams[*].revenue) == totals.revenue` modulo
    rounding. The frontend can verify this client-side as a sanity
    check and surface a warning if it ever drifts.
    """
    period_start: date | None = None
    period_end: date | None = None
    school_id: UUID | None = None
    branch_id: UUID | None = None  # Reserved for v3.1 (no-op today)
    basis: RevenueBasis
    streams: dict[RevenueStreamId, StreamBreakdown]
    totals: StreamBreakdown


class StreamMonthlyPoint(BaseSchema):
    """One month bucket of the multi-stream monthly trend."""
    period: str               # YYYY-MM
    period_label: str         # "Enero 2026"
    streams: dict[RevenueStreamId, StreamBreakdown]


class StreamMonthlyReport(BaseSchema):
    """Monthly trend across streams. Useful for the trend chart on the
    Resumen tab.
    """
    period_start: date | None = None
    period_end: date | None = None
    school_id: UUID | None = None
    branch_id: UUID | None = None
    basis: RevenueBasis
    months: list[StreamMonthlyPoint]
    totals: dict[RevenueStreamId, StreamBreakdown]
    grand_total: StreamBreakdown


class StreamsSchoolBreakdownRow(BaseSchema):
    """One school's contribution per stream for the by-school table on
    the Resumen tab.
    """
    school_id: UUID
    school_name: str
    sales_revenue: Decimal
    orders_revenue: Decimal
    alterations_revenue: Decimal
    total_revenue: Decimal


class StreamsBreakdownBySchool(BaseSchema):
    period_start: date | None = None
    period_end: date | None = None
    basis: RevenueBasis
    rows: list[StreamsSchoolBreakdownRow]
    totals: StreamsSchoolBreakdownRow
