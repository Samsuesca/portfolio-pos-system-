"""Shared COGS resolution helpers.

Single source of truth for the cost-of-goods-sold fallback chain:

    1. item.unit_cost  (snapshot at sale/order time — most accurate)
    2. product.cost    (current catalog cost — best available if no snapshot)
    3. item.unit_price * DEFAULT_COST_MARGIN  (estimate when nothing else)

Before this helper, three services implemented the same chain inline and
diverged over time (Bug 12 of the Reports audit). Importing
``resolved_cost`` / ``has_real_cost`` from here guarantees Sales, Orders,
and any future stream (B2B contracts, SaaS) compute COGS identically.

Why use ``item.unit_price`` (not ``product.price``) in the estimate:
``product.price`` is the *current* catalog price. Using it makes a sale
from January 2024 re-priced at May 2026 levels, distorting historical
margins. ``item.unit_price`` is frozen at the moment the item was
recorded, which is what reports actually want.

Usage:

    from sqlalchemy import func
    from app.models.sale import SaleItem
    from app.models.product import Product
    from app.services._cogs_resolver import resolved_cost, has_real_cost

    cogs_expr = func.sum(SaleItem.quantity * resolved_cost(
        item_unit_cost_col=SaleItem.unit_cost,
        item_unit_price_col=SaleItem.unit_price,
        product_cost_col=Product.cost,
    ))

The helper takes columns (not the model) so it works equally for
``SaleItem`` and ``OrderItem`` — both have ``unit_cost``, ``unit_price``,
and a joined ``Product.cost``.
"""
from decimal import Decimal

from sqlalchemy import case


DEFAULT_COST_MARGIN = Decimal("0.80")
"""Fraction of historical unit_price used when neither item.unit_cost nor
product.cost is available. 0.80 = assume 20% gross margin. Kept in sync
with FinancialStatementsService and ProfitabilityService."""


def resolved_cost(item_unit_cost_col, item_unit_price_col, product_cost_col):
    """Return a SQLAlchemy ``CASE`` expression resolving the per-unit cost.

    The result is a per-unit cost; multiply by ``item.quantity`` to get
    line-level COGS.

    Parameters mirror the *columns* (not the model classes) so the helper
    is reusable across SaleItem, OrderItem, and any future line-item table
    that follows the same snapshot pattern.
    """
    return case(
        (item_unit_cost_col.isnot(None), item_unit_cost_col),
        (product_cost_col.isnot(None), product_cost_col),
        else_=item_unit_price_col * float(DEFAULT_COST_MARGIN),
    )


def has_real_cost(item_unit_cost_col, product_cost_col):
    """Return a SQLAlchemy ``CASE`` expression: ``1`` when the row had a
    real (non-estimated) cost source, ``0`` otherwise.

    Use with ``func.sum(case((expr == 1, item.quantity), else_=0))`` to
    count units with real cost vs. units with estimated cost — the
    backbone of the ``cost_coverage_percent`` metric in profitability
    reports.
    """
    return case(
        (item_unit_cost_col.isnot(None), 1),
        (product_cost_col.isnot(None), 1),
        else_=0,
    )
