"""Backfill ``orders.delivered_at`` and ``alterations.ready_at`` from
``updated_at`` for historical rows.

Reports Coverage Expansion (v3) added two timestamp columns:

  - ``orders.delivered_at``     — set automatically by
    OrderStatusMixin.update_status when transitioning to DELIVERED
  - ``alterations.ready_at``    — set automatically by AlterationService
    when transitioning to READY

The migration leaves both NULL for rows created BEFORE the migration
landed (commit 06cb7d7). Without backfill, the accrual-basis revenue
on /global/reports/revenue/streams-summary shows $0 for Encargos and
the alterations response-time KPIs return ``null`` (avg) — caught by
QA on 2026-05-24: a dev DB with 210 DELIVERED orders + 209 DELIVERED
alterations had $23.5M of orders revenue invisible in the new
Resumen tab.

This script backfills using ``updated_at`` as the best available
approximation:

  UPDATE orders
     SET delivered_at = updated_at
   WHERE status = 'DELIVERED' AND delivered_at IS NULL

  UPDATE alterations
     SET ready_at = updated_at
   WHERE status IN ('READY', 'DELIVERED') AND ready_at IS NULL

CAVEAT: ``updated_at`` is overwritten on ANY UPDATE to the row. If an
order was DELIVERED six months ago but its notes were edited
yesterday, the backfilled delivered_at = yesterday → lead-time
metrics for that row are skewed but the row at least participates in
revenue aggregations. Documented behavior. NOT IDEAL for analytics
purity, but the alternative (NULL → invisible in accrual reports) is
strictly worse for the business owner.

Idempotent: re-running after rows are populated is a no-op (filter
``IS NULL`` only matches missing rows).

Reversible: pass --revert to set the backfilled values back to NULL.
Useful in dev environments to retest the migration path.

Usage:
    cd backend
    venv/bin/python -m scripts.backfill_reports_timestamps                # dry-run, all
    venv/bin/python -m scripts.backfill_reports_timestamps --commit       # persists, all
    venv/bin/python -m scripts.backfill_reports_timestamps --orders --commit
    venv/bin/python -m scripts.backfill_reports_timestamps --alterations --commit
    venv/bin/python -m scripts.backfill_reports_timestamps --revert       # set back to NULL

Always run dry-run FIRST. Always run a DB dump before --commit in
production. See ``docs/v3/v3-branch-architecture/reports-coverage.md``
section "Backfill Checklist" for the full deploy procedure.
"""
from __future__ import annotations

import argparse
import asyncio
import logging
import sys
from decimal import Decimal

from sqlalchemy import select, update, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import AsyncSessionLocal
from app.models.order import Order, OrderStatus
from app.models.alteration import Alteration, AlterationStatus


logger = logging.getLogger("backfill_reports_timestamps")


# ---------------------------------------------------------------------------
# Diagnostics
# ---------------------------------------------------------------------------


async def _orders_diagnostics(db: AsyncSession) -> dict:
    """Snapshot of orders.delivered_at coverage."""
    row = (await db.execute(
        select(
            func.count(Order.id).filter(Order.status == OrderStatus.DELIVERED).label("delivered"),
            func.count(Order.id).filter(
                (Order.status == OrderStatus.DELIVERED) & (Order.delivered_at.isnot(None))
            ).label("with_timestamp"),
            func.count(Order.id).filter(
                (Order.status == OrderStatus.DELIVERED) & (Order.delivered_at.is_(None))
            ).label("missing"),
            func.coalesce(
                func.sum(Order.total).filter(
                    (Order.status == OrderStatus.DELIVERED) & (Order.delivered_at.is_(None))
                ),
                0,
            ).label("revenue_invisible"),
        )
    )).one()
    return {
        "delivered": int(row.delivered or 0),
        "with_timestamp": int(row.with_timestamp or 0),
        "missing": int(row.missing or 0),
        "revenue_invisible": Decimal(str(row.revenue_invisible or 0)),
    }


async def _alterations_diagnostics(db: AsyncSession) -> dict:
    """Snapshot of alterations.ready_at coverage."""
    row = (await db.execute(
        select(
            func.count(Alteration.id).filter(
                Alteration.status.in_([AlterationStatus.READY, AlterationStatus.DELIVERED])
            ).label("ready_or_delivered"),
            func.count(Alteration.id).filter(
                Alteration.status.in_([AlterationStatus.READY, AlterationStatus.DELIVERED])
                & (Alteration.ready_at.isnot(None))
            ).label("with_timestamp"),
            func.count(Alteration.id).filter(
                Alteration.status.in_([AlterationStatus.READY, AlterationStatus.DELIVERED])
                & (Alteration.ready_at.is_(None))
            ).label("missing"),
        )
    )).one()
    return {
        "ready_or_delivered": int(row.ready_or_delivered or 0),
        "with_timestamp": int(row.with_timestamp or 0),
        "missing": int(row.missing or 0),
    }


# ---------------------------------------------------------------------------
# Backfill operations
# ---------------------------------------------------------------------------


async def _backfill_orders(db: AsyncSession, commit: bool) -> int:
    """Set delivered_at = updated_at for orders DELIVERED with NULL ts."""
    stmt = (
        update(Order)
        .where(Order.status == OrderStatus.DELIVERED, Order.delivered_at.is_(None))
        .values(delivered_at=Order.updated_at)
        .execution_options(synchronize_session=False)
    )
    result = await db.execute(stmt)
    rows = result.rowcount
    if commit:
        await db.commit()
    else:
        await db.rollback()
    return rows


async def _backfill_alterations(db: AsyncSession, commit: bool) -> int:
    """Set ready_at = updated_at for alterations READY/DELIVERED with NULL ts."""
    stmt = (
        update(Alteration)
        .where(
            Alteration.status.in_([AlterationStatus.READY, AlterationStatus.DELIVERED]),
            Alteration.ready_at.is_(None),
        )
        .values(ready_at=Alteration.updated_at)
        .execution_options(synchronize_session=False)
    )
    result = await db.execute(stmt)
    rows = result.rowcount
    if commit:
        await db.commit()
    else:
        await db.rollback()
    return rows


async def _revert_orders(db: AsyncSession, commit: bool) -> int:
    """Set delivered_at = NULL for ALL DELIVERED orders.

    Use to retest the backfill in dev. NOT recommended on production —
    you'd lose every timestamp set by the hooks since deploy.
    """
    stmt = (
        update(Order)
        .where(Order.status == OrderStatus.DELIVERED, Order.delivered_at.isnot(None))
        .values(delivered_at=None)
        .execution_options(synchronize_session=False)
    )
    result = await db.execute(stmt)
    rows = result.rowcount
    if commit:
        await db.commit()
    else:
        await db.rollback()
    return rows


async def _revert_alterations(db: AsyncSession, commit: bool) -> int:
    stmt = (
        update(Alteration)
        .where(Alteration.ready_at.isnot(None))
        .values(ready_at=None)
        .execution_options(synchronize_session=False)
    )
    result = await db.execute(stmt)
    rows = result.rowcount
    if commit:
        await db.commit()
    else:
        await db.rollback()
    return rows


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


async def main(args: argparse.Namespace) -> int:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
        stream=sys.stderr,
    )

    target_orders = args.orders or args.all
    target_alterations = args.alterations or args.all
    if not (target_orders or target_alterations):
        logger.error("Specify at least one of --orders / --alterations / --all")
        return 2

    async with AsyncSessionLocal() as db:
        # Diagnostics BEFORE
        logger.info("=" * 70)
        logger.info("BEFORE  (status as-of now)")
        logger.info("=" * 70)
        if target_orders:
            d = await _orders_diagnostics(db)
            logger.info(
                "Orders DELIVERED: %d total | %d with delivered_at | %d missing | "
                "$%s revenue invisible in accrual",
                d["delivered"], d["with_timestamp"], d["missing"], f"{d['revenue_invisible']:,.0f}",
            )
        if target_alterations:
            d = await _alterations_diagnostics(db)
            logger.info(
                "Alterations READY+DELIVERED: %d total | %d with ready_at | %d missing",
                d["ready_or_delivered"], d["with_timestamp"], d["missing"],
            )

        logger.info("")
        if args.revert:
            logger.warning("MODE: revert (set timestamps back to NULL)")
        else:
            logger.info("MODE: backfill (set timestamp = updated_at when NULL)")
        logger.info("COMMIT: %s", "YES (writes to DB)" if args.commit else "no (dry-run)")
        logger.info("")

        # Apply
        if args.revert:
            if target_orders:
                n = await _revert_orders(db, args.commit)
                logger.info("orders.delivered_at → NULL: %d rows", n)
            if target_alterations:
                n = await _revert_alterations(db, args.commit)
                logger.info("alterations.ready_at → NULL: %d rows", n)
        else:
            if target_orders:
                n = await _backfill_orders(db, args.commit)
                logger.info("orders.delivered_at backfilled: %d rows", n)
            if target_alterations:
                n = await _backfill_alterations(db, args.commit)
                logger.info("alterations.ready_at backfilled: %d rows", n)

        if not args.commit:
            logger.info("")
            logger.info("Dry-run only — no changes persisted.")
            logger.info("Re-run with --commit to apply.")
            return 0

        # Diagnostics AFTER (only meaningful when --commit)
        logger.info("")
        logger.info("=" * 70)
        logger.info("AFTER  (post-commit)")
        logger.info("=" * 70)
        if target_orders:
            d = await _orders_diagnostics(db)
            logger.info(
                "Orders DELIVERED: %d total | %d with delivered_at | %d missing",
                d["delivered"], d["with_timestamp"], d["missing"],
            )
        if target_alterations:
            d = await _alterations_diagnostics(db)
            logger.info(
                "Alterations READY+DELIVERED: %d total | %d with ready_at | %d missing",
                d["ready_or_delivered"], d["with_timestamp"], d["missing"],
            )
        return 0


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="Backfill orders.delivered_at and alterations.ready_at from updated_at.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="See docs/v3/v3-branch-architecture/reports-coverage.md for the checklist.",
    )
    p.add_argument("--orders", action="store_true", help="Operate on orders only.")
    p.add_argument("--alterations", action="store_true", help="Operate on alterations only.")
    p.add_argument("--all", action="store_true", help="Operate on both (default if none specified).")
    p.add_argument(
        "--commit", action="store_true",
        help="Persist changes. Without this flag the script is dry-run only.",
    )
    p.add_argument(
        "--revert", action="store_true",
        help="Reverse mode: set backfilled timestamps back to NULL. Use only in dev.",
    )
    args = p.parse_args()
    # Default to --all when nothing specified
    if not args.orders and not args.alterations and not args.all:
        args.all = True
    return args


if __name__ == "__main__":
    sys.exit(asyncio.run(main(parse_args())))
