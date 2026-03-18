"""
API Tests for Payment Gateway Routes (/api/v1/payments)

Tests cover:
- GET  /payments/config         - Public config (enabled/disabled)
- POST /payments/sessions       - Create payment session
- POST /payments/webhooks/wompi - Wompi webhook receiver
- GET  /payments/status/{ref}   - Payment status lookup
- POST /payments/sync-pending   - Sync pending payments
- GET  /payments/resolve/{id}   - Resolve by Wompi ID
"""
import hashlib
import pytest
from decimal import Decimal
from uuid import uuid4
from datetime import datetime, date
from unittest.mock import AsyncMock, MagicMock, patch

from app.models.payment_transaction import PaymentTransaction, WompiTransactionStatus
from app.models.order import Order, OrderStatus
from app.models.accounting import AccountsReceivable

from tests.fixtures.assertions import (
    assert_success_response,
    assert_error_response,
    assert_not_found,
    assert_bad_request,
)


pytestmark = [pytest.mark.api, pytest.mark.asyncio]

API_PREFIX = "/api/v1/payments"


# ============================================================================
# HELPERS
# ============================================================================

def _build_valid_webhook_payload(
    events_key: str,
    reference: str = "WP-ENC-2026-0042-1710345600",
    wompi_status: str = "APPROVED",
    wompi_id: str = "txn-abc-123",
) -> dict:
    """Build a Wompi webhook payload with valid signature."""
    properties = [
        "transaction.id",
        "transaction.status",
        "transaction.amount_in_cents",
    ]
    data = {
        "transaction": {
            "id": wompi_id,
            "status": wompi_status,
            "amount_in_cents": 8000000,
            "reference": reference,
            "payment_method_type": "CARD",
            "status_message": None,
        }
    }
    timestamp = 1710345600

    values = [str(wompi_id), str(wompi_status), str(8000000)]
    concat = "".join(values) + str(timestamp) + events_key
    checksum = hashlib.sha256(concat.encode()).hexdigest()

    return {
        "event": "transaction.updated",
        "data": data,
        "timestamp": timestamp,
        "signature": {
            "properties": properties,
            "checksum": checksum,
        },
    }


# ============================================================================
# TEST: GET /payments/config
# ============================================================================

class TestPaymentConfig:
    """Tests for GET /api/v1/payments/config"""

    @patch("app.api.routes.payments.settings")
    async def test_config_when_enabled(self, mock_settings, api_client):
        """Should return enabled=True with public key when Wompi is enabled."""
        mock_settings.WOMPI_ENABLED = True
        mock_settings.WOMPI_PUBLIC_KEY = "pub_test_key_abc"
        mock_settings.WOMPI_ENVIRONMENT = "sandbox"

        response = await api_client.get(f"{API_PREFIX}/config")

        data = assert_success_response(response)
        assert data["enabled"] is True
        assert data["public_key"] == "pub_test_key_abc"
        assert data["environment"] == "sandbox"

    @patch("app.api.routes.payments.settings")
    async def test_config_when_disabled(self, mock_settings, api_client):
        """Should return enabled=False with null keys when Wompi is disabled."""
        mock_settings.WOMPI_ENABLED = False

        response = await api_client.get(f"{API_PREFIX}/config")

        data = assert_success_response(response)
        assert data["enabled"] is False
        assert data["public_key"] is None
        assert data["environment"] is None

    async def test_config_is_public_no_auth_needed(self, api_client):
        """Config endpoint should be accessible without authentication."""
        response = await api_client.get(f"{API_PREFIX}/config")

        # Should not return 401/403
        assert response.status_code == 200


# ============================================================================
# TEST: POST /payments/sessions
# ============================================================================

class TestCreatePaymentSession:
    """Tests for POST /api/v1/payments/sessions"""

    @patch("app.api.routes.payments.settings")
    async def test_create_session_returns_503_when_disabled(
        self, mock_settings, api_client
    ):
        """Should return 503 when Wompi is disabled."""
        mock_settings.WOMPI_ENABLED = False

        response = await api_client.post(
            f"{API_PREFIX}/sessions",
            json={"order_id": str(uuid4())},
        )

        assert_error_response(response, 503, "no disponibles")

    @patch("app.api.routes.payments.WompiService")
    @patch("app.api.routes.payments.settings")
    async def test_create_session_success(
        self, mock_settings, MockWompiService, api_client
    ):
        """Should create session and return redirect data."""
        mock_settings.WOMPI_ENABLED = True

        from app.schemas.payment_transaction import PaymentSessionResponse

        mock_response = PaymentSessionResponse(
            reference="WP-ENC-2026-0042-1710345600",
            amount_in_cents=8000000,
            currency="COP",
            public_key="pub_test_key",
            integrity_signature="a" * 64,
            redirect_url="https://example.com/resultado",
            description="Pago encargo ENC-2026-0042",
        )

        mock_service_instance = AsyncMock()
        mock_service_instance.create_payment_session = AsyncMock(
            return_value=mock_response
        )
        MockWompiService.return_value = mock_service_instance

        response = await api_client.post(
            f"{API_PREFIX}/sessions",
            json={"order_id": str(uuid4())},
        )

        data = assert_success_response(response)
        assert data["reference"] == "WP-ENC-2026-0042-1710345600"
        assert data["amount_in_cents"] == 8000000
        assert data["currency"] == "COP"
        assert data["public_key"] == "pub_test_key"
        assert len(data["integrity_signature"]) == 64

    @patch("app.api.routes.payments.WompiService")
    @patch("app.api.routes.payments.settings")
    async def test_create_session_order_not_found_returns_400(
        self, mock_settings, MockWompiService, api_client
    ):
        """Should return 400 when order not found."""
        mock_settings.WOMPI_ENABLED = True

        mock_service_instance = AsyncMock()
        mock_service_instance.create_payment_session = AsyncMock(
            side_effect=ValueError("Pedido no encontrado")
        )
        MockWompiService.return_value = mock_service_instance

        response = await api_client.post(
            f"{API_PREFIX}/sessions",
            json={"order_id": str(uuid4())},
        )

        assert_bad_request(response, "no encontrado")

    @patch("app.api.routes.payments.WompiService")
    @patch("app.api.routes.payments.settings")
    async def test_create_session_double_payment_returns_400(
        self, mock_settings, MockWompiService, api_client
    ):
        """Should return 400 when a PENDING transaction already exists."""
        mock_settings.WOMPI_ENABLED = True

        mock_service_instance = AsyncMock()
        mock_service_instance.create_payment_session = AsyncMock(
            side_effect=ValueError("Ya existe un pago en proceso para este pedido")
        )
        MockWompiService.return_value = mock_service_instance

        response = await api_client.post(
            f"{API_PREFIX}/sessions",
            json={"order_id": str(uuid4())},
        )

        assert_bad_request(response, "pago en proceso")

    async def test_create_session_validation_error_without_ids(self, api_client):
        """Should return 422 when neither order_id nor receivable_id provided."""
        response = await api_client.post(
            f"{API_PREFIX}/sessions",
            json={},
        )

        # Pydantic validator rejects — 400 (custom handler) or 422 or 503 (Wompi disabled)
        assert response.status_code in (400, 422, 503)

    async def test_create_session_validation_error_both_ids(self, api_client):
        """Should return 400/422 when both order_id and receivable_id provided."""
        response = await api_client.post(
            f"{API_PREFIX}/sessions",
            json={
                "order_id": str(uuid4()),
                "receivable_id": str(uuid4()),
            },
        )

        # Pydantic validator rejects both — 400 (custom handler) or 422 or 503
        assert response.status_code in (400, 422, 503)


# ============================================================================
# TEST: POST /payments/webhooks/wompi
# ============================================================================

class TestWompiWebhook:
    """Tests for POST /api/v1/payments/webhooks/wompi"""

    async def test_webhook_always_returns_200(self, api_client):
        """Webhook endpoint must always return 200 to prevent Wompi retries."""
        response = await api_client.post(
            f"{API_PREFIX}/webhooks/wompi",
            json={"event": "transaction.updated", "data": {}, "timestamp": 0},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"

    async def test_webhook_returns_200_even_on_malformed_payload(self, api_client):
        """Should return 200 even with invalid/incomplete data."""
        response = await api_client.post(
            f"{API_PREFIX}/webhooks/wompi",
            json={"garbage": True},
        )

        assert response.status_code == 200

    @patch("app.api.routes.payments.WompiService")
    async def test_webhook_calls_process_webhook(
        self, MockWompiService, api_client
    ):
        """Should invoke WompiService.process_webhook with the payload."""
        mock_service_instance = AsyncMock()
        mock_service_instance.process_webhook = AsyncMock(return_value=True)
        MockWompiService.return_value = mock_service_instance

        payload = {
            "event": "transaction.updated",
            "data": {"transaction": {"reference": "WP-TEST-001"}},
            "timestamp": 1710345600,
            "signature": {"properties": [], "checksum": "abc"},
        }

        response = await api_client.post(
            f"{API_PREFIX}/webhooks/wompi",
            json=payload,
        )

        assert response.status_code == 200
        mock_service_instance.process_webhook.assert_awaited_once()

    @patch("app.api.routes.payments.WompiService")
    async def test_webhook_returns_200_when_processing_fails(
        self, MockWompiService, api_client
    ):
        """Should still return 200 when process_webhook returns False."""
        mock_service_instance = AsyncMock()
        mock_service_instance.process_webhook = AsyncMock(return_value=False)
        MockWompiService.return_value = mock_service_instance

        response = await api_client.post(
            f"{API_PREFIX}/webhooks/wompi",
            json={"event": "transaction.updated", "data": {}, "timestamp": 0},
        )

        assert response.status_code == 200

    @patch("app.api.routes.payments.WompiService")
    async def test_webhook_returns_200_when_exception_raised(
        self, MockWompiService, api_client
    ):
        """Should return 200 even when an exception occurs internally."""
        mock_service_instance = AsyncMock()
        mock_service_instance.process_webhook = AsyncMock(
            side_effect=Exception("DB connection lost")
        )
        MockWompiService.return_value = mock_service_instance

        response = await api_client.post(
            f"{API_PREFIX}/webhooks/wompi",
            json={"event": "transaction.updated", "data": {}, "timestamp": 0},
        )

        assert response.status_code == 200


# ============================================================================
# TEST: GET /payments/status/{reference}
# ============================================================================

class TestPaymentStatus:
    """Tests for GET /api/v1/payments/status/{reference}"""

    @patch("app.api.routes.payments.WompiService")
    async def test_status_found(self, MockWompiService, api_client):
        """Should return payment status when found."""
        mock_payment = MagicMock()
        mock_payment.reference = "WP-ENC-2026-0042-1710345600"
        mock_payment.status = WompiTransactionStatus.APPROVED
        mock_payment.amount_in_cents = 8000000
        mock_payment.payment_method_type = "CARD"
        mock_payment.order_id = uuid4()
        mock_payment.receivable_id = None
        mock_payment.created_at = datetime(2026, 3, 15, 10, 30, 0)
        mock_payment.completed_at = datetime(2026, 3, 15, 10, 31, 0)

        mock_service_instance = AsyncMock()
        mock_service_instance.get_payment_status = AsyncMock(
            return_value=mock_payment
        )
        mock_service_instance.sync_status_from_reference = AsyncMock(
            return_value=False
        )
        MockWompiService.return_value = mock_service_instance

        response = await api_client.get(
            f"{API_PREFIX}/status/WP-ENC-2026-0042-1710345600"
        )

        data = assert_success_response(response)
        assert data["reference"] == "WP-ENC-2026-0042-1710345600"
        assert data["status"] == "APPROVED"
        assert data["amount_in_cents"] == 8000000

    @patch("app.api.routes.payments.WompiService")
    async def test_status_not_found_returns_404(self, MockWompiService, api_client):
        """Should return 404 when reference not found."""
        mock_service_instance = AsyncMock()
        mock_service_instance.get_payment_status = AsyncMock(return_value=None)
        MockWompiService.return_value = mock_service_instance

        response = await api_client.get(f"{API_PREFIX}/status/NONEXISTENT-REF")

        assert_not_found(response, "no encontrada")

    @patch("app.api.routes.payments.WompiService")
    async def test_status_pending_triggers_sync(self, MockWompiService, api_client):
        """Should attempt sync with Wompi when status is PENDING."""
        mock_payment = MagicMock()
        mock_payment.reference = "WP-TEST-PENDING"
        mock_payment.status = WompiTransactionStatus.PENDING
        mock_payment.amount_in_cents = 5000000
        mock_payment.payment_method_type = None
        mock_payment.order_id = uuid4()
        mock_payment.receivable_id = None
        mock_payment.created_at = datetime(2026, 3, 15, 10, 0, 0)
        mock_payment.completed_at = None

        mock_service_instance = AsyncMock()
        mock_service_instance.get_payment_status = AsyncMock(
            return_value=mock_payment
        )
        mock_service_instance.sync_status_from_reference = AsyncMock(
            return_value=False  # No change
        )
        MockWompiService.return_value = mock_service_instance

        response = await api_client.get(f"{API_PREFIX}/status/WP-TEST-PENDING")

        data = assert_success_response(response)
        assert data["status"] == "PENDING"
        mock_service_instance.sync_status_from_reference.assert_awaited_once()


# ============================================================================
# TEST: POST /payments/sync-pending
# ============================================================================

class TestSyncPending:
    """Tests for POST /api/v1/payments/sync-pending"""

    async def test_sync_no_pending_returns_zeros(self, api_client, db_session):
        """Should return synced=0 when no pending payments exist."""
        response = await api_client.post(f"{API_PREFIX}/sync-pending")

        data = assert_success_response(response)
        assert data["synced"] == 0
        assert data["total_pending"] == 0

    @patch("app.api.routes.payments.WompiService")
    async def test_sync_pending_processes_transactions(
        self, MockWompiService, api_client, db_session
    ):
        """Should sync each pending payment and report count."""
        # Create PENDING payment transactions in DB
        from app.models.payment_transaction import PaymentTransaction

        tx1 = PaymentTransaction(
            reference=f"WP-SYNC-TEST-{uuid4().hex[:8]}",
            amount_in_cents=5000000,
            currency="COP",
            status=WompiTransactionStatus.PENDING,
            integrity_signature="a" * 64,
        )
        tx2 = PaymentTransaction(
            reference=f"WP-SYNC-TEST-{uuid4().hex[:8]}",
            amount_in_cents=3000000,
            currency="COP",
            status=WompiTransactionStatus.PENDING,
            integrity_signature="b" * 64,
        )
        db_session.add(tx1)
        db_session.add(tx2)
        await db_session.flush()

        # Mock the WompiService to sync one of them
        mock_service_instance = AsyncMock()
        mock_service_instance.sync_status_from_reference = AsyncMock(
            side_effect=[True, False]  # First syncs, second doesn't
        )
        MockWompiService.return_value = mock_service_instance

        response = await api_client.post(f"{API_PREFIX}/sync-pending")

        data = assert_success_response(response)
        assert data["total_pending"] == 2
        assert data["synced"] == 1


# ============================================================================
# TEST: GET /payments/resolve/{wompi_id}
# ============================================================================

class TestResolveByWompiId:
    """Tests for GET /api/v1/payments/resolve/{wompi_id}"""

    @patch("app.api.routes.payments.WompiService")
    async def test_resolve_found_locally(self, MockWompiService, api_client, db_session):
        """Should return payment when found by wompi_transaction_id locally."""
        from app.models.payment_transaction import PaymentTransaction

        wompi_id = f"wompi-tx-{uuid4().hex[:8]}"
        tx = PaymentTransaction(
            reference=f"WP-RESOLVE-{uuid4().hex[:8]}",
            wompi_transaction_id=wompi_id,
            amount_in_cents=6000000,
            currency="COP",
            status=WompiTransactionStatus.APPROVED,
            integrity_signature="c" * 64,
            payment_method_type="NEQUI",
        )
        db_session.add(tx)
        await db_session.flush()

        response = await api_client.get(f"{API_PREFIX}/resolve/{wompi_id}")

        data = assert_success_response(response)
        assert data["reference"] == tx.reference
        assert data["status"] == "APPROVED"
        assert data["amount_in_cents"] == 6000000

    @patch("app.api.routes.payments.WompiService")
    async def test_resolve_falls_back_to_wompi_api(
        self, MockWompiService, api_client, db_session
    ):
        """Should query Wompi API when not found locally, then look up by reference."""
        from app.models.payment_transaction import PaymentTransaction

        # Create a payment transaction (without wompi_transaction_id set)
        reference = f"WP-FALLBACK-{uuid4().hex[:8]}"
        tx = PaymentTransaction(
            reference=reference,
            amount_in_cents=4000000,
            currency="COP",
            status=WompiTransactionStatus.APPROVED,
            integrity_signature="d" * 64,
        )
        db_session.add(tx)
        await db_session.flush()

        # Mock WompiService to resolve reference from Wompi API
        mock_service_instance = AsyncMock()
        mock_service_instance.resolve_reference_from_wompi = AsyncMock(
            return_value=reference
        )
        mock_service_instance.get_payment_status = AsyncMock(return_value=tx)
        MockWompiService.return_value = mock_service_instance

        response = await api_client.get(f"{API_PREFIX}/resolve/unknown-wompi-id")

        data = assert_success_response(response)
        assert data["reference"] == reference

    @patch("app.api.routes.payments.WompiService")
    async def test_resolve_not_found_anywhere_returns_404(
        self, MockWompiService, api_client
    ):
        """Should return 404 when not found locally or via Wompi API."""
        mock_service_instance = AsyncMock()
        mock_service_instance.resolve_reference_from_wompi = AsyncMock(
            return_value=None
        )
        MockWompiService.return_value = mock_service_instance

        response = await api_client.get(f"{API_PREFIX}/resolve/totally-unknown")

        assert_not_found(response, "no encontrada")
