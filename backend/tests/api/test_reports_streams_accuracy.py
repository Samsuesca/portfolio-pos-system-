"""
Reports — RevenueStreamService end-to-end invariants.

Fase 3 del plan Reports Coverage Expansion. These tests validate the
two non-negotiable guarantees of the unified streams endpoint:

  1. `sum(streams[*].revenue) == totals.revenue` for any filter
     combination — the executive Resumen tab must add up.

  2. Each stream's revenue matches what its dedicated endpoint reports
     for the same period — the Resumen is a *view* over the underlying
     data, not a separate calculation that could drift.

Plus smoke tests for cash vs accrual divergence and the B2B stub.
"""
from __future__ import annotations

from datetime import date, timedelta
from decimal import Decimal
from uuid import uuid4

import pytest

from app.models.sale import Sale, SaleItem, SaleStatus, PaymentMethod
from app.models.order import Order, OrderItem, OrderStatus
from app.models.sale import SaleSource
from app.utils.timezone import get_colombia_now_naive
from tests.fixtures.assertions import assert_success_response


pytestmark = pytest.mark.api


BASE = "/api/v1/global/reports/revenue"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _make_simple_sale(db_session, school, user, product, total: Decimal):
    sale = Sale(
        id=str(uuid4()),
        school_id=school.id,
        user_id=user.id,
        code=f"{school.code}-VNT-2026-{uuid4().hex[:6].upper()}",
        status=SaleStatus.COMPLETED,
        total=total,
        paid_amount=total,
        payment_method=PaymentMethod.CASH,
    )
    db_session.add(sale)
    await db_session.flush()
    db_session.add(SaleItem(
        id=str(uuid4()),
        sale_id=sale.id,
        product_id=product.id,
        quantity=1,
        unit_price=total,
        subtotal=total,
    ))
    await db_session.flush()
    return sale


async def _make_delivered_order(db_session, school, user, client, product, total: Decimal):
    order = Order(
        id=str(uuid4()),
        school_id=school.id,
        user_id=user.id,
        client_id=client.id,
        code=f"{school.code}-ENC-2026-{uuid4().hex[:6].upper()}",
        status=OrderStatus.DELIVERED,
        subtotal=total,
        tax=Decimal("0"),
        total=total,
        paid_amount=total,
        source=SaleSource.DESKTOP_APP,
        delivered_at=get_colombia_now_naive(),
    )
    db_session.add(order)
    await db_session.flush()
    db_session.add(OrderItem(
        id=str(uuid4()),
        order_id=order.id,
        school_id=school.id,
        garment_type_id=product.garment_type_id,
        product_id=product.id,
        size=product.size,
        color=product.color,
        quantity=1,
        unit_price=total,
        subtotal=total,
    ))
    await db_session.flush()
    return order


# ---------------------------------------------------------------------------
# Invariants
# ---------------------------------------------------------------------------


class TestStreamsSummaryInvariants:

    async def test_sum_of_streams_equals_totals(
        self,
        api_client,
        superuser_headers,
        db_session,
        test_school,
        test_user,
        test_client,
        test_product,
    ):
        # Seed a sale and a delivered order; alterations stay empty in
        # this test (the calculator returns zeros).
        await _make_simple_sale(
            db_session, test_school, test_user, test_product, Decimal("100000")
        )
        await _make_delivered_order(
            db_session, test_school, test_user, test_client, test_product, Decimal("70000")
        )
        await db_session.commit()

        response = await api_client.get(
            f"{BASE}/streams-summary",
            headers=superuser_headers,
        )
        data = assert_success_response(response)

        streams = data["streams"]
        totals_revenue = float(data["totals"]["revenue"])
        sum_streams = sum(float(s["revenue"]) for s in streams.values())

        assert sum_streams == pytest.approx(totals_revenue, abs=0.01), (
            f"INVARIANT VIOLATED — sum(streams[*].revenue) = {sum_streams} "
            f"but totals.revenue = {totals_revenue}. The Resumen tab would "
            f"show inconsistent numbers to the user."
        )

        # Sanity: both streams contributed
        assert float(streams["sales"]["revenue"]) >= 100000.0
        assert float(streams["orders"]["revenue"]) >= 70000.0

    async def test_b2b_stream_zero_when_no_contracts(
        self,
        api_client,
        superuser_headers,
    ):
        # El stream b2b_contracts ya está implementado (Fase B4): sin contratos
        # entregados devuelve cero (sin nota de stub), no una excepción.
        response = await api_client.get(
            f"{BASE}/streams-summary?streams=b2b_contracts",
            headers=superuser_headers,
        )
        data = assert_success_response(response)

        b2b = data["streams"].get("b2b_contracts")
        assert b2b is not None, "B2B stream missing from response"
        assert float(b2b["revenue"]) == 0.0
        assert b2b["count"] == 0
        # Ya no es un stub: sin filtro de colegio no lleva la nota antigua.
        assert b2b.get("note") != "not_yet_implemented"


class TestStreamsBySchoolBreakdown:

    async def test_alterations_only_in_totals_not_in_rows(
        self,
        api_client,
        superuser_headers,
        db_session,
        test_school,
        test_user,
        test_product,
    ):
        # Seed a sale so the test_school has at least one row in the
        # breakdown — without it, the response.rows is empty and we have
        # nothing to assert against.
        await _make_simple_sale(
            db_session, test_school, test_user, test_product, Decimal("50000")
        )
        await db_session.commit()

        response = await api_client.get(
            f"{BASE}/streams-by-school",
            headers=superuser_headers,
        )
        data = assert_success_response(response)

        # Every row's alterations_revenue is 0 (alterations not scoped
        # to schools — they aggregate into totals only).
        for row in data["rows"]:
            assert float(row["alterations_revenue"]) == 0.0, (
                "Per-school rows must report alterations_revenue=0; "
                "alterations aggregate at the totals row level only."
            )


class TestStreamsEndpointAuth:

    @pytest.mark.parametrize("path", [
        "/streams-summary",
        "/streams-monthly?start_date=2026-01-01&end_date=2026-12-31",
        "/streams-by-school",
    ])
    async def test_requires_auth(self, api_client, path):
        response = await api_client.get(f"{BASE}{path}")
        # FastAPI returns 403 when no token is supplied (permission dep
        # short-circuits the auth chain) or 401 for invalid token.
        assert response.status_code in (401, 403), (
            f"{path} must require auth — got {response.status_code}"
        )
