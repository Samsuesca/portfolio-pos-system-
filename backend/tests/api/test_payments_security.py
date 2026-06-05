"""
Security tests for /api/v1/payments — ownership y autorización.

Cubre los hallazgos cerrados en PR A:
- Fix #1: ownership check en GET /status/{ref} y GET /resolve/{wompi_id}
  (cross-tenant payment enumeration impedido).
- Fix #2: POST /sync-pending solo para superusuarios.

Patrón: tests aislados que solo prueban el comportamiento de seguridad,
sin solapar con los tests funcionales en test_payments_routes.py.
"""
import pytest
from decimal import Decimal
from uuid import uuid4, UUID
from datetime import datetime, date

from app.models.payment_transaction import PaymentTransaction, WompiTransactionStatus
from app.models.order import Order, OrderStatus
from app.models.accounting import AccountsReceivable

from tests.fixtures.assertions import (
    assert_success_response,
    assert_not_found,
    assert_forbidden,
)


pytestmark = [pytest.mark.api, pytest.mark.asyncio]

API_PREFIX = "/api/v1/payments"


# ============================================================================
# Helpers
# ============================================================================

async def _make_payment_for_client(
    db_session,
    client_id,
    *,
    via: str = "client_id",
    school_id=None,
) -> PaymentTransaction:
    """Crea un PaymentTransaction con el dueño determinado por ``via``.

    Args:
        via: ``"client_id"`` (FK directo), ``"order"`` (vía Order.client_id),
            ``"receivable"`` (vía AccountsReceivable.client_id).
    """
    reference = f"WP-SEC-{uuid4().hex[:8]}"
    payload = dict(
        reference=reference,
        amount_in_cents=5000000,
        currency="COP",
        status=WompiTransactionStatus.APPROVED,
        integrity_signature="z" * 64,
        payment_method_type="CARD",
        completed_at=datetime(2026, 5, 1, 12, 0, 0),
    )

    # Coerce client_id a UUID — los fixtures lo guardan como string.
    client_uuid = client_id if isinstance(client_id, UUID) else UUID(str(client_id))

    if via == "client_id":
        payload["client_id"] = client_uuid
    elif via == "order":
        order = Order(
            id=str(uuid4()),
            school_id=school_id,
            user_id=None,
            client_id=client_uuid,
            code=f"ORD-{uuid4().hex[:6]}",
            status=OrderStatus.PENDING,
            subtotal=Decimal("50000"),
            tax=Decimal("0"),
            total=Decimal("50000"),
            paid_amount=Decimal("0"),
        )
        db_session.add(order)
        await db_session.flush()
        payload["order_id"] = order.id
    elif via == "receivable":
        receivable = AccountsReceivable(
            id=str(uuid4()),
            client_id=client_uuid,
            amount=Decimal("50000"),
            amount_paid=Decimal("0"),
            description="Test CxC para tests de seguridad",
            invoice_date=date(2026, 5, 1),
            due_date=date(2026, 5, 31),
            is_paid=False,
        )
        db_session.add(receivable)
        await db_session.flush()
        payload["receivable_id"] = receivable.id
    else:
        raise ValueError(f"Unknown via: {via}")

    payment = PaymentTransaction(**payload)
    db_session.add(payment)
    await db_session.flush()
    # Refrescar para que las columnas UUID estén pobladas como UUID,
    # no como el string que se asignó en memoria.
    await db_session.refresh(payment)
    return payment


# ============================================================================
# Fix #1 — Ownership check en /status/{reference}
# ============================================================================

class TestStatusOwnership:
    """Cross-tenant denial en GET /payments/status/{reference}."""

    @pytest.mark.parametrize("via", ["client_id", "order", "receivable"])
    async def test_owner_can_read_own_payment(
        self,
        api_client,
        portal_client_headers,
        test_client,
        test_school,
        db_session,
        via,
    ):
        """Cliente dueño recibe 200 con cualquier mecanismo de vínculo."""
        payment = await _make_payment_for_client(
            db_session, test_client.id, via=via, school_id=test_school.id,
        )

        response = await api_client.get(
            f"{API_PREFIX}/status/{payment.reference}",
            headers=portal_client_headers,
        )

        data = assert_success_response(response)
        assert data["reference"] == payment.reference

    @pytest.mark.parametrize("via", ["client_id", "order", "receivable"])
    async def test_other_client_gets_404_not_403(
        self,
        api_client,
        portal_client_b_headers,
        test_client,
        test_school,
        db_session,
        via,
    ):
        """Cliente B consulta pago del cliente A → 404 (no 403, defensa contra enumeración)."""
        payment = await _make_payment_for_client(
            db_session, test_client.id, via=via, school_id=test_school.id,
        )

        response = await api_client.get(
            f"{API_PREFIX}/status/{payment.reference}",
            headers=portal_client_b_headers,
        )

        # Mismo código que cuando el pago no existe — no revela existencia
        assert_not_found(response, "no encontrada")

    async def test_orphan_payment_inaccessible(
        self,
        api_client,
        portal_client_headers,
        db_session,
    ):
        """Pago sin client_id, order_id, ni receivable_id → 404 para todos."""
        payment = PaymentTransaction(
            reference=f"WP-ORPHAN-{uuid4().hex[:8]}",
            amount_in_cents=1000,
            currency="COP",
            status=WompiTransactionStatus.APPROVED,
            integrity_signature="o" * 64,
        )
        db_session.add(payment)
        await db_session.flush()

        response = await api_client.get(
            f"{API_PREFIX}/status/{payment.reference}",
            headers=portal_client_headers,
        )

        assert_not_found(response, "no encontrada")

    async def test_unauthenticated_returns_401_or_403(self, api_client, db_session):
        """Sin JWT, el endpoint sigue siendo inaccesible (defensa preexistente)."""
        response = await api_client.get(f"{API_PREFIX}/status/WP-WHATEVER")
        assert response.status_code in (401, 403)


# ============================================================================
# Fix #1 — Ownership check en /resolve/{wompi_id}
# ============================================================================

class TestResolveOwnership:
    """Cross-tenant denial en GET /payments/resolve/{wompi_id}."""

    async def test_owner_can_resolve_own_payment(
        self,
        api_client,
        portal_client_headers,
        test_client,
        db_session,
    ):
        """Cliente dueño recibe 200 al resolver por wompi_transaction_id."""
        wompi_id = f"wompi-tx-{uuid4().hex[:8]}"
        payment = await _make_payment_for_client(
            db_session, test_client.id, via="client_id",
        )
        payment.wompi_transaction_id = wompi_id
        await db_session.flush()

        response = await api_client.get(
            f"{API_PREFIX}/resolve/{wompi_id}",
            headers=portal_client_headers,
        )

        data = assert_success_response(response)
        assert data["reference"] == payment.reference

    async def test_other_client_gets_404(
        self,
        api_client,
        portal_client_b_headers,
        test_client,
        db_session,
    ):
        """Cliente B intenta resolver pago de cliente A → 404."""
        wompi_id = f"wompi-tx-{uuid4().hex[:8]}"
        payment = await _make_payment_for_client(
            db_session, test_client.id, via="client_id",
        )
        payment.wompi_transaction_id = wompi_id
        await db_session.flush()

        response = await api_client.get(
            f"{API_PREFIX}/resolve/{wompi_id}",
            headers=portal_client_b_headers,
        )

        assert_not_found(response, "no encontrada")


# ============================================================================
# Fix #2 — /sync-pending solo superuser
# ============================================================================

class TestSyncPendingAuthorization:
    """Restricción de /sync-pending a superusuarios."""

    async def test_superuser_allowed(
        self, api_client, superuser_headers, db_session
    ):
        """Superuser puede invocar /sync-pending y obtener respuesta válida."""
        response = await api_client.post(
            f"{API_PREFIX}/sync-pending",
            headers=superuser_headers,
        )

        # 200 (cero pendientes en DB de test) — el endpoint NO falla auth
        data = assert_success_response(response)
        assert "synced" in data
        assert "total_pending" in data

    async def test_regular_user_denied_403(self, api_client, auth_headers):
        """Usuario regular (no superuser) → 403 'Not enough permissions'."""
        response = await api_client.post(
            f"{API_PREFIX}/sync-pending",
            headers=auth_headers,
        )
        assert_forbidden(response)

    async def test_portal_client_denied(
        self, api_client, portal_client_headers
    ):
        """Cliente del portal (no es staff) → 401/403.

        El JWT del portal lleva ``client_type=web_client`` que no se
        decodifica como ``User`` interno: ``get_current_user`` rechaza.
        """
        response = await api_client.post(
            f"{API_PREFIX}/sync-pending",
            headers=portal_client_headers,
        )
        assert response.status_code in (401, 403)

    async def test_unauthenticated_denied(self, api_client):
        """Sin JWT → 401/403."""
        response = await api_client.post(f"{API_PREFIX}/sync-pending")
        assert response.status_code in (401, 403)
