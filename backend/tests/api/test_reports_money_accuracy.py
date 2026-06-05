"""
Reports — Money accuracy regression tests.

These tests reproduce three real-money bugs found in the reports module:

  Bug 1  — `/global/reports/profitability/by-school` computes COGS from
           Product.cost (current value), ignoring SaleItem.unit_cost (snapshot
           at the time of sale). Historical margins shift retroactively when
           costs are updated.

  Bug 2  — `/global/reports/sales/summary` aggregates by Sale.payment_method,
           so a sale paid 50k cash + 30k transfer is reported as 80k under a
           single method. The desktop POS already supports split payments
           (SalePayment rows), but reports ignore them.

  Bug 3  — `/schools/{school_id}/reports/sales/daily` enumerates cash /
           transfer / card / credit explicitly and OMITS nequi entirely. A
           day with Nequi sales shows total_revenue != sum(method subtotals).

The tests use the real DB fixtures (`api_client`, `superuser_headers`,
`test_school`, `test_product`, etc.) and exercise the HTTP layer so the
SQL queries are validated end-to-end.
"""
from __future__ import annotations

from decimal import Decimal
from uuid import uuid4

import pytest

from app.models.sale import Sale, SaleItem, SalePayment, SaleStatus, PaymentMethod
from tests.fixtures.assertions import assert_success_response


pytestmark = pytest.mark.api


# ---------------------------------------------------------------------------
# Bug 1 — profitability must use SaleItem.unit_cost snapshot, not Product.cost
# ---------------------------------------------------------------------------


class TestProfitabilityUsesUnitCostSnapshot:
    """`/global/reports/profitability/by-school` must respect the cost
    snapshot stored on SaleItem when the product's current cost has drifted.
    """

    async def test_cogs_uses_unit_cost_snapshot_when_product_cost_changes(
        self,
        api_client,
        superuser_headers,
        db_session,
        test_school,
        test_user,
        test_product,
    ):
        # Arrange: product currently costs 30,000 in catalog. A sale was
        # recorded earlier when the cost was 10,000 — the snapshot captures
        # that historical value on SaleItem.unit_cost.
        test_product.cost = Decimal("30000")
        test_product.price = Decimal("50000")
        await db_session.flush()

        sale = Sale(
            id=str(uuid4()),
            school_id=test_school.id,
            user_id=test_user.id,
            code=f"{test_school.code}-VNT-2026-COSTSNAP",
            status=SaleStatus.COMPLETED,
            total=Decimal("50000"),
            paid_amount=Decimal("50000"),
            payment_method=PaymentMethod.CASH,
        )
        db_session.add(sale)
        await db_session.flush()

        # SaleItem snapshot: unit_cost = 10,000 (the historical cost)
        item = SaleItem(
            id=str(uuid4()),
            sale_id=sale.id,
            product_id=test_product.id,
            quantity=1,
            unit_price=Decimal("50000"),
            unit_cost=Decimal("10000"),
            subtotal=Decimal("50000"),
        )
        db_session.add(item)
        await db_session.commit()

        # Act: ask for profitability covering this sale.
        response = await api_client.get(
            "/api/v1/global/reports/profitability/by-school",
            headers=superuser_headers,
        )
        data = assert_success_response(response)

        # Assert: locate this school's row and validate the COGS used the
        # snapshot (10,000) not Product.cost (30,000).
        school_row = next(
            (s for s in data["schools"] if s["school_id"] == str(test_school.id)),
            None,
        )
        assert school_row is not None, (
            "Test school missing from profitability response — fixture/route mismatch"
        )

        # Revenue should be 50,000 (the subtotal of the single sale item).
        assert school_row["revenue"] == pytest.approx(50000.0), (
            f"Revenue mismatch: expected 50,000 got {school_row['revenue']}"
        )

        # COGS = quantity * unit_cost = 1 * 10,000 = 10,000.
        # Current bug: uses Product.cost (30,000) → COGS reported as 30,000.
        assert school_row["cogs"] == pytest.approx(10000.0), (
            f"COGS must use SaleItem.unit_cost snapshot (10,000), got "
            f"{school_row['cogs']}. Likely using Product.cost (30,000) — "
            "see global_reports.py:459."
        )

        # Gross profit = 50,000 - 10,000 = 40,000 → margin 80%.
        assert school_row["gross_profit"] == pytest.approx(40000.0)
        assert school_row["gross_margin"] == pytest.approx(80.0, abs=0.5)


# ---------------------------------------------------------------------------
# Bug 2 — sales/summary must split a mixed-payment sale across methods
# ---------------------------------------------------------------------------


class TestSalesSummarySplitPaymentBreakdown:
    """`/global/reports/sales/summary` must aggregate the per-method totals
    from SalePayment rows when present, not from Sale.payment_method.
    """

    async def test_split_payment_is_distributed_across_methods(
        self,
        api_client,
        superuser_headers,
        db_session,
        test_school,
        test_user,
        test_product,
    ):
        # Arrange: one sale of 80,000 paid 50,000 cash + 30,000 transfer.
        sale = Sale(
            id=str(uuid4()),
            school_id=test_school.id,
            user_id=test_user.id,
            code=f"{test_school.code}-VNT-2026-SPLITPAY",
            status=SaleStatus.COMPLETED,
            total=Decimal("80000"),
            paid_amount=Decimal("80000"),
            # Header method is whatever the POS recorded first — irrelevant
            # to the breakdown when SalePayment rows exist.
            payment_method=PaymentMethod.CASH,
        )
        db_session.add(sale)
        await db_session.flush()

        db_session.add(
            SaleItem(
                id=str(uuid4()),
                sale_id=sale.id,
                product_id=test_product.id,
                quantity=1,
                unit_price=Decimal("80000"),
                subtotal=Decimal("80000"),
            )
        )
        db_session.add(
            SalePayment(
                id=str(uuid4()),
                sale_id=sale.id,
                amount=Decimal("50000"),
                payment_method=PaymentMethod.CASH,
            )
        )
        db_session.add(
            SalePayment(
                id=str(uuid4()),
                sale_id=sale.id,
                amount=Decimal("30000"),
                payment_method=PaymentMethod.TRANSFER,
            )
        )
        await db_session.commit()

        # Act
        response = await api_client.get(
            f"/api/v1/global/reports/sales/summary?school_id={test_school.id}",
            headers=superuser_headers,
        )
        data = assert_success_response(response)

        by_method = data["sales_by_payment"]

        # Assert: cash got 50k, transfer got 30k. Current bug puts 80k under
        # whichever method Sale.payment_method holds.
        assert "cash" in by_method, "Cash bucket missing from breakdown"
        assert "transfer" in by_method, (
            "Transfer bucket missing — the split payment is being collapsed "
            "into Sale.payment_method"
        )

        assert by_method["cash"]["total"] == pytest.approx(50000.0), (
            f"Cash total should be 50,000 (the SalePayment row), got "
            f"{by_method['cash']['total']}. Likely aggregating Sale.total."
        )
        assert by_method["transfer"]["total"] == pytest.approx(30000.0), (
            f"Transfer total should be 30,000 (the SalePayment row), got "
            f"{by_method['transfer']['total']}."
        )

        # Sanity: the sum of all method totals equals total_revenue.
        sum_methods = sum(b["total"] for b in by_method.values())
        assert sum_methods == pytest.approx(data["total_revenue"]), (
            f"Sum of payment-method totals ({sum_methods}) must equal "
            f"total_revenue ({data['total_revenue']})"
        )


# ---------------------------------------------------------------------------
# Bug 3 — daily sales endpoint must include NEQUI
# ---------------------------------------------------------------------------


class TestDailySalesIncludesNequi:
    """`/schools/{school_id}/reports/sales/daily` must report nequi sales.
    The current implementation enumerates cash/transfer/card/credit only.
    """

    async def test_nequi_sale_appears_in_daily_breakdown(
        self,
        api_client,
        superuser_headers,
        db_session,
        test_school,
        test_user,
        test_product,
    ):
        # Arrange: one Nequi sale today.
        from app.utils.timezone import get_colombia_now_naive

        sale = Sale(
            id=str(uuid4()),
            school_id=test_school.id,
            user_id=test_user.id,
            code=f"{test_school.code}-VNT-2026-NEQUI",
            status=SaleStatus.COMPLETED,
            total=Decimal("50000"),
            paid_amount=Decimal("50000"),
            payment_method=PaymentMethod.NEQUI,
            sale_date=get_colombia_now_naive(),
        )
        db_session.add(sale)
        await db_session.flush()
        db_session.add(
            SaleItem(
                id=str(uuid4()),
                sale_id=sale.id,
                product_id=test_product.id,
                quantity=1,
                unit_price=Decimal("50000"),
                subtotal=Decimal("50000"),
            )
        )
        await db_session.commit()

        # Act: default `target_date` is today (Colombia).
        response = await api_client.get(
            f"/api/v1/schools/{test_school.id}/reports/sales/daily",
            headers=superuser_headers,
        )
        data = assert_success_response(response)

        # Assert: the daily payload must surface nequi. Either as a dedicated
        # field (matching the existing cash_sales/transfer_sales/... shape)
        # or, ideally, as part of a unified per-method dict so future methods
        # don't require code changes.
        nequi_total = data.get("nequi_sales")
        if nequi_total is None:
            # Tolerate a unified shape — but at least the value must be there.
            method_dict = data.get("sales_by_payment") or {}
            nequi_total = method_dict.get("nequi", {}).get("total")

        assert nequi_total is not None, (
            "Daily sales payload omits Nequi entirely — neither "
            "`nequi_sales` field nor `sales_by_payment['nequi']` exists. "
            "See reports.py:99-103."
        )
        assert nequi_total == pytest.approx(50000.0), (
            f"Nequi sale of 50,000 should appear in the breakdown, got "
            f"{nequi_total}."
        )

        # Sanity: total_revenue includes the nequi sale (this passes today,
        # confirming the bug is in the per-method breakdown, not the total).
        assert data["total_revenue"] == pytest.approx(50000.0)
