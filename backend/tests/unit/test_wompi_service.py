"""
Unit Tests for WompiService - Payment Gateway Integration

Tests cover:
- Integrity signature generation (deterministic SHA256)
- Webhook signature validation (valid, invalid, missing properties)
- Payment session creation (order, receivable, errors, double-pay protection)
- Webhook processing (valid, invalid signature, idempotency, approved/declined)
- Approved payment application (order cap, receivable update, Transaction creation)
- Status sync from Wompi API
- Reference resolution from Wompi API
- Payment method mapping
"""
import hashlib
import pytest
from decimal import Decimal
from uuid import uuid4, UUID
from datetime import datetime, date
from unittest.mock import AsyncMock, MagicMock, patch, PropertyMock

from app.services.wompi import WompiService, WOMPI_TO_ACC_PAYMENT_METHOD
from app.models.payment_transaction import PaymentTransaction, WompiTransactionStatus
from app.models.order import Order, OrderStatus
from app.models.accounting import (
    AccountsReceivable,
    Transaction,
    TransactionType,
    AccPaymentMethod,
)
from app.schemas.payment_transaction import PaymentSessionCreate


pytestmark = [pytest.mark.unit, pytest.mark.asyncio]


# ============================================================================
# HELPERS
# ============================================================================

def _make_order(
    order_id: UUID | None = None,
    school_id: UUID | None = None,
    client_id: UUID | None = None,
    code: str = "ENC-2026-0042",
    total: Decimal = Decimal("100000"),
    paid_amount: Decimal = Decimal("20000"),
) -> MagicMock:
    """Create a mock Order with computed balance."""
    order = MagicMock(spec=Order)
    order.id = order_id or uuid4()
    order.school_id = school_id or uuid4()
    order.client_id = client_id or uuid4()
    order.code = code
    order.total = total
    order.paid_amount = paid_amount
    order.balance = total - paid_amount  # Simulate Computed column
    return order


def _make_receivable(
    recv_id: UUID | None = None,
    school_id: UUID | None = None,
    client_id: UUID | None = None,
    amount: Decimal = Decimal("50000"),
    amount_paid: Decimal = Decimal("0"),
    is_paid: bool = False,
    description: str = "Saldo pendiente encargo",
) -> MagicMock:
    """Create a mock AccountsReceivable."""
    recv = MagicMock(spec=AccountsReceivable)
    recv.id = recv_id or uuid4()
    recv.school_id = school_id or uuid4()
    recv.client_id = client_id or uuid4()
    recv.amount = amount
    recv.amount_paid = amount_paid
    recv.is_paid = is_paid
    recv.description = description
    recv.balance = amount - amount_paid
    return recv


def _make_payment_tx(
    reference: str = "WP-ENC-2026-0042-1710345600",
    order_id: UUID | None = None,
    receivable_id: UUID | None = None,
    school_id: UUID | None = None,
    amount_in_cents: int = 8000000,
    status: WompiTransactionStatus = WompiTransactionStatus.PENDING,
    accounting_applied: bool = False,
    payment_method_type: str | None = None,
) -> MagicMock:
    """Create a mock PaymentTransaction."""
    tx = MagicMock(spec=PaymentTransaction)
    tx.id = uuid4()
    tx.reference = reference
    tx.order_id = order_id
    tx.receivable_id = receivable_id
    tx.school_id = school_id or uuid4()
    tx.client_id = uuid4()
    tx.amount_in_cents = amount_in_cents
    tx.currency = "COP"
    tx.status = status
    tx.accounting_applied = accounting_applied
    tx.payment_method_type = payment_method_type
    tx.wompi_transaction_id = None
    tx.status_message = None
    tx.wompi_response_data = None
    tx.completed_at = None
    tx.integrity_signature = "abc123"
    return tx


def _mock_scalar_result(value):
    """Create a mock execute result that returns value on scalar_one_or_none."""
    result = MagicMock()
    result.scalar_one_or_none.return_value = value
    return result


def _mock_scalars_result(values: list):
    """Create a mock execute result that returns list on scalars().all()."""
    result = MagicMock()
    scalars_mock = MagicMock()
    scalars_mock.all.return_value = values
    result.scalars.return_value = scalars_mock
    return result


# ============================================================================
# TEST: Integrity Signature Generation
# ============================================================================

class TestGenerateIntegritySignature:
    """Tests for WompiService.generate_integrity_signature"""

    @patch("app.services.wompi.settings")
    def test_deterministic_sha256_output(self, mock_settings):
        """Signature should be a deterministic SHA256 of reference+amount+currency+key."""
        mock_settings.WOMPI_INTEGRITY_KEY = "test_integrity_key_123"

        reference = "WP-ENC-2026-0042-1710345600"
        amount_in_cents = 8000000
        currency = "COP"

        # Compute expected manually
        raw = f"{reference}{amount_in_cents}{currency}test_integrity_key_123"
        expected = hashlib.sha256(raw.encode()).hexdigest()

        result = WompiService.generate_integrity_signature(
            reference, amount_in_cents, currency
        )

        assert result == expected
        assert len(result) == 64  # SHA256 hex digest is 64 characters

    @patch("app.services.wompi.settings")
    def test_different_references_produce_different_signatures(self, mock_settings):
        """Different references must produce different signatures."""
        mock_settings.WOMPI_INTEGRITY_KEY = "key"

        sig1 = WompiService.generate_integrity_signature("REF-001", 100000)
        sig2 = WompiService.generate_integrity_signature("REF-002", 100000)

        assert sig1 != sig2

    @patch("app.services.wompi.settings")
    def test_different_amounts_produce_different_signatures(self, mock_settings):
        """Different amounts must produce different signatures."""
        mock_settings.WOMPI_INTEGRITY_KEY = "key"

        sig1 = WompiService.generate_integrity_signature("REF-001", 100000)
        sig2 = WompiService.generate_integrity_signature("REF-001", 200000)

        assert sig1 != sig2

    @patch("app.services.wompi.settings")
    def test_default_currency_is_cop(self, mock_settings):
        """Default currency should be COP."""
        mock_settings.WOMPI_INTEGRITY_KEY = "key"

        sig_default = WompiService.generate_integrity_signature("REF", 100)
        sig_cop = WompiService.generate_integrity_signature("REF", 100, "COP")

        assert sig_default == sig_cop


# ============================================================================
# TEST: Webhook Signature Validation
# ============================================================================

class TestValidateWebhookSignature:
    """Tests for WompiService.validate_webhook_signature"""

    @patch("app.services.wompi.settings")
    def test_valid_signature_returns_true(self, mock_settings):
        """Valid webhook signature should be accepted."""
        mock_settings.WOMPI_EVENTS_KEY = "test_events_secret"

        # Build a realistic webhook payload
        properties = [
            "transaction.id",
            "transaction.status",
            "transaction.amount_in_cents",
        ]
        data = {
            "transaction": {
                "id": "12345-abc",
                "status": "APPROVED",
                "amount_in_cents": 8000000,
                "reference": "WP-ENC-2026-0042-1710345600",
            }
        }
        timestamp = 1710345600

        # Compute the valid checksum using the same algorithm
        values = []
        for prop in properties:
            parts = prop.split(".")
            value = data
            for part in parts:
                value = value.get(part) if isinstance(value, dict) else None
            values.append(str(value) if value is not None else "")

        concat = "".join(values) + str(timestamp) + "test_events_secret"
        valid_checksum = hashlib.sha256(concat.encode()).hexdigest()

        payload = {
            "event": "transaction.updated",
            "data": data,
            "timestamp": timestamp,
            "signature": {
                "properties": properties,
                "checksum": valid_checksum,
            },
        }

        assert WompiService.validate_webhook_signature(payload) is True

    @patch("app.services.wompi.settings")
    def test_invalid_checksum_returns_false(self, mock_settings):
        """Tampered checksum should be rejected."""
        mock_settings.WOMPI_EVENTS_KEY = "test_events_secret"

        payload = {
            "event": "transaction.updated",
            "data": {
                "transaction": {
                    "id": "12345-abc",
                    "status": "APPROVED",
                    "amount_in_cents": 8000000,
                }
            },
            "timestamp": 1710345600,
            "signature": {
                "properties": ["transaction.id", "transaction.status"],
                "checksum": "definitely_not_a_valid_checksum_value_aaaa",
            },
        }

        assert WompiService.validate_webhook_signature(payload) is False

    @patch("app.services.wompi.settings")
    def test_missing_signature_returns_false(self, mock_settings):
        """Payload without signature block should return False."""
        mock_settings.WOMPI_EVENTS_KEY = "key"

        payload = {
            "event": "transaction.updated",
            "data": {"transaction": {"id": "abc"}},
            "timestamp": 123,
        }

        assert WompiService.validate_webhook_signature(payload) is False

    @patch("app.services.wompi.settings")
    def test_empty_properties_still_validates(self, mock_settings):
        """Empty properties list should still compute a valid hash."""
        mock_settings.WOMPI_EVENTS_KEY = "key"

        timestamp = 999
        concat = "" + str(timestamp) + "key"
        checksum = hashlib.sha256(concat.encode()).hexdigest()

        payload = {
            "event": "transaction.updated",
            "data": {},
            "timestamp": timestamp,
            "signature": {
                "properties": [],
                "checksum": checksum,
            },
        }

        assert WompiService.validate_webhook_signature(payload) is True

    @patch("app.services.wompi.settings")
    def test_nested_dot_notation_extraction(self, mock_settings):
        """Properties with deep dot-notation should resolve correctly."""
        mock_settings.WOMPI_EVENTS_KEY = "secret"

        data = {
            "transaction": {
                "payment_method": {
                    "type": "CARD",
                    "extra": {
                        "brand": "VISA",
                    }
                }
            }
        }
        properties = [
            "transaction.payment_method.type",
            "transaction.payment_method.extra.brand",
        ]
        timestamp = 100

        values = ["CARD", "VISA"]
        concat = "".join(values) + str(timestamp) + "secret"
        checksum = hashlib.sha256(concat.encode()).hexdigest()

        payload = {
            "event": "transaction.updated",
            "data": data,
            "timestamp": timestamp,
            "signature": {
                "properties": properties,
                "checksum": checksum,
            },
        }

        assert WompiService.validate_webhook_signature(payload) is True


# ============================================================================
# TEST: Create Payment Session
# ============================================================================

class TestCreatePaymentSession:
    """Tests for WompiService.create_payment_session"""

    @patch("app.services.wompi.settings")
    async def test_create_session_for_order_happy_path(self, mock_settings):
        """Should create payment session for an order with balance > 0."""
        mock_settings.WOMPI_ENABLED = True
        mock_settings.WOMPI_INTEGRITY_KEY = "integrity_key"
        mock_settings.WOMPI_PUBLIC_KEY = "pub_test_key"
        mock_settings.WOMPI_REDIRECT_URL = "https://example.com/resultado"

        order = _make_order(total=Decimal("100000"), paid_amount=Decimal("20000"))
        db = AsyncMock()

        # First execute: find Order
        # Second execute: find existing PENDING PaymentTransaction (none)
        db.execute = AsyncMock(side_effect=[
            _mock_scalar_result(order),
            _mock_scalar_result(None),  # No existing PENDING tx
        ])

        service = WompiService(db)
        data = PaymentSessionCreate(order_id=order.id)

        result = await service.create_payment_session(data)

        assert result.amount_in_cents == 8000000  # 80000 * 100
        assert result.currency == "COP"
        assert result.public_key == "pub_test_key"
        assert result.reference.startswith("WP-ENC-2026-0042-")
        assert len(result.integrity_signature) == 64
        assert "Pago encargo ENC-2026-0042" in result.description
        db.add.assert_called_once()
        db.flush.assert_awaited_once()

    @patch("app.services.wompi.settings")
    async def test_create_session_for_receivable_happy_path(self, mock_settings):
        """Should create payment session for an accounts receivable."""
        mock_settings.WOMPI_ENABLED = True
        mock_settings.WOMPI_INTEGRITY_KEY = "key"
        mock_settings.WOMPI_PUBLIC_KEY = "pub_key"
        mock_settings.WOMPI_REDIRECT_URL = "https://example.com/resultado"

        recv = _make_receivable(
            amount=Decimal("50000"),
            amount_paid=Decimal("10000"),
            description="Saldo CxC pendiente del cliente",
        )
        db = AsyncMock()
        db.execute = AsyncMock(return_value=_mock_scalar_result(recv))

        service = WompiService(db)
        data = PaymentSessionCreate(receivable_id=recv.id)

        result = await service.create_payment_session(data)

        assert result.amount_in_cents == 4000000  # 40000 * 100
        assert "Pago CxC:" in result.description
        assert result.reference.startswith("WP-CXC-")

    @patch("app.services.wompi.settings")
    async def test_create_session_when_wompi_disabled_raises(self, mock_settings):
        """Should raise ValueError when Wompi is disabled."""
        mock_settings.WOMPI_ENABLED = False

        db = AsyncMock()
        service = WompiService(db)
        data = PaymentSessionCreate(order_id=uuid4())

        with pytest.raises(ValueError, match="no estan habilitados"):
            await service.create_payment_session(data)

    @patch("app.services.wompi.settings")
    async def test_create_session_order_not_found_raises(self, mock_settings):
        """Should raise ValueError when order does not exist."""
        mock_settings.WOMPI_ENABLED = True

        db = AsyncMock()
        db.execute = AsyncMock(return_value=_mock_scalar_result(None))

        service = WompiService(db)
        data = PaymentSessionCreate(order_id=uuid4())

        with pytest.raises(ValueError, match="no encontrado"):
            await service.create_payment_session(data)

    @patch("app.services.wompi.settings")
    async def test_create_session_order_already_paid_raises(self, mock_settings):
        """Should raise ValueError when order balance is zero."""
        mock_settings.WOMPI_ENABLED = True

        order = _make_order(total=Decimal("100000"), paid_amount=Decimal("100000"))
        order.balance = Decimal("0")

        db = AsyncMock()
        db.execute = AsyncMock(return_value=_mock_scalar_result(order))

        service = WompiService(db)
        data = PaymentSessionCreate(order_id=order.id)

        with pytest.raises(ValueError, match="ya esta pagado"):
            await service.create_payment_session(data)

    @patch("app.services.wompi.settings")
    async def test_create_session_double_payment_protection(self, mock_settings):
        """Should reject if there is already a PENDING transaction for the order."""
        mock_settings.WOMPI_ENABLED = True

        order = _make_order()
        existing_pending_tx = _make_payment_tx(order_id=order.id)

        db = AsyncMock()
        db.execute = AsyncMock(side_effect=[
            _mock_scalar_result(order),          # Order found
            _mock_scalar_result(existing_pending_tx),  # Existing PENDING tx found
        ])

        service = WompiService(db)
        data = PaymentSessionCreate(order_id=order.id)

        with pytest.raises(ValueError, match="pago en proceso"):
            await service.create_payment_session(data)

    @patch("app.services.wompi.settings")
    async def test_create_session_receivable_already_paid_raises(self, mock_settings):
        """Should raise ValueError when receivable is already paid."""
        mock_settings.WOMPI_ENABLED = True

        recv = _make_receivable(is_paid=True)

        db = AsyncMock()
        db.execute = AsyncMock(return_value=_mock_scalar_result(recv))

        service = WompiService(db)
        data = PaymentSessionCreate(receivable_id=recv.id)

        with pytest.raises(ValueError, match="ya esta pagada"):
            await service.create_payment_session(data)

    @patch("app.services.wompi.settings")
    async def test_create_session_receivable_not_found_raises(self, mock_settings):
        """Should raise ValueError when receivable does not exist."""
        mock_settings.WOMPI_ENABLED = True

        db = AsyncMock()
        db.execute = AsyncMock(return_value=_mock_scalar_result(None))

        service = WompiService(db)
        data = PaymentSessionCreate(receivable_id=uuid4())

        with pytest.raises(ValueError, match="no encontrada"):
            await service.create_payment_session(data)


# ============================================================================
# TEST: Process Webhook
# ============================================================================

class TestProcessWebhook:
    """Tests for WompiService.process_webhook"""

    def _build_valid_webhook(
        self,
        events_key: str,
        reference: str = "WP-ENC-2026-0042-1710345600",
        wompi_status: str = "APPROVED",
        wompi_id: str = "txn-abc-123",
        payment_method_type: str = "CARD",
        amount_in_cents: int = 8000000,
    ) -> dict:
        """Build a webhook payload with a valid signature."""
        properties = [
            "transaction.id",
            "transaction.status",
            "transaction.amount_in_cents",
        ]
        data = {
            "transaction": {
                "id": wompi_id,
                "status": wompi_status,
                "amount_in_cents": amount_in_cents,
                "reference": reference,
                "payment_method_type": payment_method_type,
                "status_message": None,
            }
        }
        timestamp = 1710345600

        values = [str(wompi_id), str(wompi_status), str(amount_in_cents)]
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

    @patch("app.services.wompi.settings")
    async def test_valid_approved_webhook_applies_accounting(self, mock_settings):
        """Approved payment webhook should update status and apply accounting."""
        mock_settings.WOMPI_EVENTS_KEY = "events_secret"

        payment_tx = _make_payment_tx(
            order_id=uuid4(),
            amount_in_cents=8000000,
        )
        order = _make_order(
            order_id=payment_tx.order_id,
            total=Decimal("100000"),
            paid_amount=Decimal("20000"),
        )

        db = AsyncMock()
        # First execute: find PaymentTransaction by reference
        # Second execute (inside _apply_approved_payment): find Order
        # Third execute: find related AccountsReceivable
        db.execute = AsyncMock(side_effect=[
            _mock_scalar_result(payment_tx),
            _mock_scalar_result(order),
            _mock_scalar_result(None),  # No receivable linked
        ])

        payload = self._build_valid_webhook("events_secret")

        service = WompiService(db)

        with patch.object(service, "_apply_approved_payment", new_callable=AsyncMock) as mock_apply:
            result = await service.process_webhook(payload)

        assert result is True
        assert payment_tx.status == WompiTransactionStatus.APPROVED
        assert payment_tx.wompi_transaction_id == "txn-abc-123"
        assert payment_tx.payment_method_type == "CARD"
        mock_apply.assert_awaited_once_with(payment_tx)

    @patch("app.services.wompi.settings")
    async def test_invalid_signature_returns_false(self, mock_settings):
        """Invalid webhook signature should reject the webhook."""
        mock_settings.WOMPI_EVENTS_KEY = "real_secret"

        # Build with wrong key so signature won't match
        payload = self._build_valid_webhook("wrong_secret")

        db = AsyncMock()
        service = WompiService(db)

        result = await service.process_webhook(payload)

        assert result is False
        db.execute.assert_not_called()

    @patch("app.services.wompi.settings")
    async def test_idempotency_skips_already_processed(self, mock_settings):
        """Should skip processing if transaction is no longer PENDING."""
        mock_settings.WOMPI_EVENTS_KEY = "events_secret"

        payment_tx = _make_payment_tx(
            status=WompiTransactionStatus.APPROVED  # Already processed
        )

        db = AsyncMock()
        db.execute = AsyncMock(return_value=_mock_scalar_result(payment_tx))

        payload = self._build_valid_webhook("events_secret")
        service = WompiService(db)

        result = await service.process_webhook(payload)

        assert result is True  # Returns True (idempotent success)
        # Status should not have changed - no accounting called

    @patch("app.services.wompi.settings")
    async def test_declined_webhook_does_not_apply_accounting(self, mock_settings):
        """Declined payment should update status but not apply accounting."""
        mock_settings.WOMPI_EVENTS_KEY = "events_secret"

        payment_tx = _make_payment_tx()

        db = AsyncMock()
        db.execute = AsyncMock(return_value=_mock_scalar_result(payment_tx))

        payload = self._build_valid_webhook(
            "events_secret",
            wompi_status="DECLINED",
        )

        service = WompiService(db)

        with patch.object(service, "_apply_approved_payment", new_callable=AsyncMock) as mock_apply:
            result = await service.process_webhook(payload)

        assert result is True
        assert payment_tx.status == WompiTransactionStatus.DECLINED
        mock_apply.assert_not_called()

    @patch("app.services.wompi.settings")
    async def test_non_transaction_event_is_ignored(self, mock_settings):
        """Non-transaction.updated events should be ignored."""
        mock_settings.WOMPI_EVENTS_KEY = "events_secret"

        # Build valid webhook but change event type
        payload = self._build_valid_webhook("events_secret")
        payload["event"] = "nequi_token.updated"

        db = AsyncMock()
        service = WompiService(db)

        result = await service.process_webhook(payload)

        assert result is True  # Ignored, not an error

    @patch("app.services.wompi.settings")
    async def test_missing_reference_returns_false(self, mock_settings):
        """Webhook without reference in transaction data should return False."""
        mock_settings.WOMPI_EVENTS_KEY = "events_secret"

        payload = self._build_valid_webhook("events_secret")
        # Remove reference from transaction data
        payload["data"]["transaction"]["reference"] = None

        db = AsyncMock()
        service = WompiService(db)

        # The signature validation might still pass since reference is not
        # in the signed properties; what matters is the reference check
        with patch.object(WompiService, "validate_webhook_signature", return_value=True):
            result = await service.process_webhook(payload)

        assert result is False

    @patch("app.services.wompi.settings")
    async def test_payment_tx_not_found_returns_false(self, mock_settings):
        """Should return False if PaymentTransaction not found for reference."""
        mock_settings.WOMPI_EVENTS_KEY = "events_secret"

        db = AsyncMock()
        db.execute = AsyncMock(return_value=_mock_scalar_result(None))

        payload = self._build_valid_webhook("events_secret")

        service = WompiService(db)
        result = await service.process_webhook(payload)

        assert result is False

    @patch("app.services.wompi.settings")
    async def test_unknown_status_maps_to_error(self, mock_settings):
        """Unknown Wompi status should map to ERROR."""
        mock_settings.WOMPI_EVENTS_KEY = "events_secret"

        payment_tx = _make_payment_tx()

        db = AsyncMock()
        db.execute = AsyncMock(return_value=_mock_scalar_result(payment_tx))

        payload = self._build_valid_webhook(
            "events_secret",
            wompi_status="UNKNOWN_STATUS_XYZ",
        )

        service = WompiService(db)

        with patch.object(service, "_apply_approved_payment", new_callable=AsyncMock) as mock_apply:
            result = await service.process_webhook(payload)

        assert result is True
        assert payment_tx.status == WompiTransactionStatus.ERROR
        mock_apply.assert_not_called()


# ============================================================================
# TEST: Apply Approved Payment
# ============================================================================

class TestApplyApprovedPayment:
    """Tests for WompiService._apply_approved_payment"""

    @patch("app.services.balance_integration.BalanceIntegrationService")
    @patch("app.services.wompi.get_colombia_date")
    async def test_apply_payment_to_order_updates_paid_amount(
        self, mock_date, MockBalanceService
    ):
        """Should update order.paid_amount and cap at order.total."""
        mock_date.return_value = date(2026, 3, 15)
        mock_balance_instance = AsyncMock()
        MockBalanceService.return_value = mock_balance_instance

        order_id = uuid4()
        school_id = uuid4()

        order = _make_order(
            order_id=order_id,
            school_id=school_id,
            total=Decimal("100000"),
            paid_amount=Decimal("20000"),
        )

        payment_tx = _make_payment_tx(
            order_id=order_id,
            school_id=school_id,
            amount_in_cents=8000000,  # 80,000 COP
            payment_method_type="CARD",
        )
        payment_tx.accounting_applied = False

        db = AsyncMock()
        # First execute: find Order by order_id
        # Second execute: find linked AccountsReceivable
        db.execute = AsyncMock(side_effect=[
            _mock_scalar_result(order),
            _mock_scalar_result(None),  # No linked receivable
        ])

        service = WompiService(db)
        await service._apply_approved_payment(payment_tx)

        # Order paid_amount should be updated: min(20000 + 80000, 100000) = 100000
        assert order.paid_amount == Decimal("100000")
        # Transaction record should be added to session
        assert db.add.called
        # Balance integration should be invoked
        mock_balance_instance.apply_transaction_to_balance.assert_awaited_once()
        # Idempotency flag
        assert payment_tx.accounting_applied is True

    @patch("app.services.balance_integration.BalanceIntegrationService")
    @patch("app.services.wompi.get_colombia_date")
    async def test_apply_payment_caps_at_order_total(
        self, mock_date, MockBalanceService
    ):
        """Overpayment should be capped: paid_amount cannot exceed total."""
        mock_date.return_value = date(2026, 3, 15)
        MockBalanceService.return_value = AsyncMock()

        order_id = uuid4()
        order = _make_order(
            order_id=order_id,
            total=Decimal("50000"),
            paid_amount=Decimal("30000"),
        )

        payment_tx = _make_payment_tx(
            order_id=order_id,
            amount_in_cents=5000000,  # 50,000 COP - more than remaining 20,000
        )
        payment_tx.accounting_applied = False

        db = AsyncMock()
        db.execute = AsyncMock(side_effect=[
            _mock_scalar_result(order),
            _mock_scalar_result(None),
        ])

        service = WompiService(db)
        await service._apply_approved_payment(payment_tx)

        # Should cap at total: min(30000 + 50000, 50000) = 50000
        assert order.paid_amount == Decimal("50000")

    @patch("app.services.balance_integration.BalanceIntegrationService")
    @patch("app.services.wompi.get_colombia_date")
    async def test_apply_payment_updates_receivable(
        self, mock_date, MockBalanceService
    ):
        """Should update linked AccountsReceivable and mark paid if fully covered."""
        mock_date.return_value = date(2026, 3, 15)
        MockBalanceService.return_value = AsyncMock()

        order_id = uuid4()
        recv = _make_receivable(
            amount=Decimal("80000"),
            amount_paid=Decimal("0"),
        )
        recv.order_id = order_id

        order = _make_order(
            order_id=order_id,
            total=Decimal("100000"),
            paid_amount=Decimal("20000"),
        )

        payment_tx = _make_payment_tx(
            order_id=order_id,
            amount_in_cents=8000000,  # 80,000 COP
        )
        payment_tx.accounting_applied = False

        db = AsyncMock()
        db.execute = AsyncMock(side_effect=[
            _mock_scalar_result(order),
            _mock_scalar_result(recv),  # Linked receivable found
        ])

        service = WompiService(db)
        await service._apply_approved_payment(payment_tx)

        # Receivable should be updated
        assert recv.amount_paid == Decimal("80000")
        assert recv.is_paid is True

    @patch("app.services.balance_integration.BalanceIntegrationService")
    @patch("app.services.wompi.get_colombia_date")
    async def test_apply_payment_to_standalone_receivable(
        self, mock_date, MockBalanceService
    ):
        """Should handle receivable-only payment (no order)."""
        mock_date.return_value = date(2026, 3, 15)
        MockBalanceService.return_value = AsyncMock()

        recv_id = uuid4()
        recv = _make_receivable(
            recv_id=recv_id,
            amount=Decimal("50000"),
            amount_paid=Decimal("10000"),
        )

        payment_tx = _make_payment_tx(
            order_id=None,
            receivable_id=recv_id,
            amount_in_cents=4000000,  # 40,000 COP
        )
        payment_tx.accounting_applied = False

        db = AsyncMock()
        db.execute = AsyncMock(return_value=_mock_scalar_result(recv))

        service = WompiService(db)
        await service._apply_approved_payment(payment_tx)

        assert recv.amount_paid == Decimal("50000")
        assert recv.is_paid is True
        assert payment_tx.accounting_applied is True

    async def test_idempotency_skips_if_already_applied(self):
        """Should do nothing if accounting_applied is already True."""
        payment_tx = _make_payment_tx(accounting_applied=True)

        db = AsyncMock()
        service = WompiService(db)

        await service._apply_approved_payment(payment_tx)

        db.execute.assert_not_called()
        db.add.assert_not_called()

    @patch("app.services.balance_integration.BalanceIntegrationService")
    @patch("app.services.wompi.get_colombia_date")
    async def test_apply_payment_creates_income_transaction(
        self, mock_date, MockBalanceService
    ):
        """Should create a Transaction of type INCOME with correct values."""
        mock_date.return_value = date(2026, 3, 15)
        mock_balance = AsyncMock()
        MockBalanceService.return_value = mock_balance

        order_id = uuid4()
        school_id = uuid4()

        order = _make_order(
            order_id=order_id,
            school_id=school_id,
            total=Decimal("100000"),
            paid_amount=Decimal("0"),
        )

        payment_tx = _make_payment_tx(
            order_id=order_id,
            school_id=school_id,
            amount_in_cents=10000000,
            payment_method_type="PSE",
        )
        payment_tx.accounting_applied = False

        db = AsyncMock()
        db.execute = AsyncMock(side_effect=[
            _mock_scalar_result(order),
            _mock_scalar_result(None),
        ])

        service = WompiService(db)
        await service._apply_approved_payment(payment_tx)

        # Verify Transaction was added
        add_call = db.add.call_args_list[0]
        transaction = add_call[0][0]
        assert isinstance(transaction, Transaction)
        assert transaction.type == TransactionType.INCOME
        assert transaction.amount == Decimal("100000")
        assert transaction.payment_method == AccPaymentMethod.TRANSFER
        assert transaction.category == "orders"
        assert "[Wompi]" in transaction.description
        assert transaction.school_id == school_id
        assert transaction.order_id == order_id

    @patch("app.services.balance_integration.BalanceIntegrationService")
    @patch("app.services.wompi.get_colombia_date")
    async def test_order_not_found_during_apply_returns_early(
        self, mock_date, MockBalanceService
    ):
        """Should return early without creating Transaction if order not found."""
        mock_date.return_value = date(2026, 3, 15)

        payment_tx = _make_payment_tx(
            order_id=uuid4(),
            amount_in_cents=5000000,
        )
        payment_tx.accounting_applied = False

        db = AsyncMock()
        db.execute = AsyncMock(return_value=_mock_scalar_result(None))

        service = WompiService(db)
        await service._apply_approved_payment(payment_tx)

        db.add.assert_not_called()
        assert payment_tx.accounting_applied is not True


# ============================================================================
# TEST: Sync Status From Reference
# ============================================================================

class TestSyncStatusFromReference:
    """Tests for WompiService.sync_status_from_reference"""

    @patch("app.services.wompi.settings")
    @patch("app.services.wompi.httpx.AsyncClient")
    async def test_sync_approved_updates_status_and_applies_accounting(
        self, MockHttpClient, mock_settings
    ):
        """Should sync APPROVED status from Wompi and apply accounting."""
        mock_settings.wompi_base_url = "https://sandbox.wompi.co/v1"
        mock_settings.WOMPI_PRIVATE_KEY = "prv_test_key"

        payment_tx = _make_payment_tx(status=WompiTransactionStatus.PENDING)

        # Mock httpx response
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "data": [
                {
                    "id": "wompi-tx-id-001",
                    "status": "APPROVED",
                    "payment_method_type": "NEQUI",
                    "reference": payment_tx.reference,
                }
            ]
        }

        mock_client_instance = AsyncMock()
        mock_client_instance.get = AsyncMock(return_value=mock_response)
        mock_client_instance.__aenter__ = AsyncMock(return_value=mock_client_instance)
        mock_client_instance.__aexit__ = AsyncMock(return_value=False)
        MockHttpClient.return_value = mock_client_instance

        db = AsyncMock()
        service = WompiService(db)

        with patch.object(service, "_apply_approved_payment", new_callable=AsyncMock) as mock_apply:
            result = await service.sync_status_from_reference(payment_tx)

        assert result is True
        assert payment_tx.status == WompiTransactionStatus.APPROVED
        assert payment_tx.wompi_transaction_id == "wompi-tx-id-001"
        assert payment_tx.payment_method_type == "NEQUI"
        mock_apply.assert_awaited_once_with(payment_tx)

    @patch("app.services.wompi.settings")
    @patch("app.services.wompi.httpx.AsyncClient")
    async def test_sync_declined_does_not_apply_accounting(
        self, MockHttpClient, mock_settings
    ):
        """Declined status should update but not apply accounting."""
        mock_settings.wompi_base_url = "https://sandbox.wompi.co/v1"
        mock_settings.WOMPI_PRIVATE_KEY = "prv_test_key"

        payment_tx = _make_payment_tx(status=WompiTransactionStatus.PENDING)

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "data": [{"id": "tx-1", "status": "DECLINED", "payment_method_type": "PSE"}]
        }

        mock_client_instance = AsyncMock()
        mock_client_instance.get = AsyncMock(return_value=mock_response)
        mock_client_instance.__aenter__ = AsyncMock(return_value=mock_client_instance)
        mock_client_instance.__aexit__ = AsyncMock(return_value=False)
        MockHttpClient.return_value = mock_client_instance

        db = AsyncMock()
        service = WompiService(db)

        with patch.object(service, "_apply_approved_payment", new_callable=AsyncMock) as mock_apply:
            result = await service.sync_status_from_reference(payment_tx)

        assert result is True
        assert payment_tx.status == WompiTransactionStatus.DECLINED
        mock_apply.assert_not_called()

    @patch("app.services.wompi.settings")
    @patch("app.services.wompi.httpx.AsyncClient")
    async def test_sync_no_data_returns_false(self, MockHttpClient, mock_settings):
        """Should return False when Wompi returns no data."""
        mock_settings.wompi_base_url = "https://sandbox.wompi.co/v1"
        mock_settings.WOMPI_PRIVATE_KEY = "prv_test_key"

        payment_tx = _make_payment_tx(status=WompiTransactionStatus.PENDING)

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"data": []}

        mock_client_instance = AsyncMock()
        mock_client_instance.get = AsyncMock(return_value=mock_response)
        mock_client_instance.__aenter__ = AsyncMock(return_value=mock_client_instance)
        mock_client_instance.__aexit__ = AsyncMock(return_value=False)
        MockHttpClient.return_value = mock_client_instance

        db = AsyncMock()
        service = WompiService(db)

        result = await service.sync_status_from_reference(payment_tx)

        assert result is False

    @patch("app.services.wompi.settings")
    @patch("app.services.wompi.httpx.AsyncClient")
    async def test_sync_api_error_returns_false(self, MockHttpClient, mock_settings):
        """Should return False when Wompi API returns non-200."""
        mock_settings.wompi_base_url = "https://sandbox.wompi.co/v1"
        mock_settings.WOMPI_PRIVATE_KEY = "prv_test_key"

        payment_tx = _make_payment_tx(status=WompiTransactionStatus.PENDING)

        mock_response = MagicMock()
        mock_response.status_code = 500

        mock_client_instance = AsyncMock()
        mock_client_instance.get = AsyncMock(return_value=mock_response)
        mock_client_instance.__aenter__ = AsyncMock(return_value=mock_client_instance)
        mock_client_instance.__aexit__ = AsyncMock(return_value=False)
        MockHttpClient.return_value = mock_client_instance

        db = AsyncMock()
        service = WompiService(db)

        result = await service.sync_status_from_reference(payment_tx)

        assert result is False

    @patch("app.services.wompi.settings")
    @patch("app.services.wompi.httpx.AsyncClient")
    async def test_sync_same_status_returns_false(self, MockHttpClient, mock_settings):
        """Should return False when Wompi status hasn't changed."""
        mock_settings.wompi_base_url = "https://sandbox.wompi.co/v1"
        mock_settings.WOMPI_PRIVATE_KEY = "prv_test_key"

        # Payment is already PENDING, and Wompi still reports PENDING
        # (PENDING is not in the status_map, so new_status will be None)
        payment_tx = _make_payment_tx(status=WompiTransactionStatus.PENDING)

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "data": [{"id": "tx-1", "status": "PENDING", "payment_method_type": "PSE"}]
        }

        mock_client_instance = AsyncMock()
        mock_client_instance.get = AsyncMock(return_value=mock_response)
        mock_client_instance.__aenter__ = AsyncMock(return_value=mock_client_instance)
        mock_client_instance.__aexit__ = AsyncMock(return_value=False)
        MockHttpClient.return_value = mock_client_instance

        db = AsyncMock()
        service = WompiService(db)

        result = await service.sync_status_from_reference(payment_tx)

        assert result is False


# ============================================================================
# TEST: Resolve Reference From Wompi
# ============================================================================

class TestResolveReferenceFromWompi:
    """Tests for WompiService.resolve_reference_from_wompi"""

    @patch("app.services.wompi.settings")
    @patch("app.services.wompi.httpx.AsyncClient")
    async def test_resolve_returns_reference(self, MockHttpClient, mock_settings):
        """Should return reference from Wompi transaction data."""
        mock_settings.wompi_base_url = "https://sandbox.wompi.co/v1"

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "data": {"reference": "WP-ENC-2026-0042-1710345600"}
        }

        mock_client_instance = AsyncMock()
        mock_client_instance.get = AsyncMock(return_value=mock_response)
        mock_client_instance.__aenter__ = AsyncMock(return_value=mock_client_instance)
        mock_client_instance.__aexit__ = AsyncMock(return_value=False)
        MockHttpClient.return_value = mock_client_instance

        db = AsyncMock()
        service = WompiService(db)

        result = await service.resolve_reference_from_wompi("wompi-tx-abc")

        assert result == "WP-ENC-2026-0042-1710345600"

    @patch("app.services.wompi.settings")
    @patch("app.services.wompi.httpx.AsyncClient")
    async def test_resolve_not_found_returns_none(self, MockHttpClient, mock_settings):
        """Should return None when Wompi transaction not found."""
        mock_settings.wompi_base_url = "https://sandbox.wompi.co/v1"

        mock_response = MagicMock()
        mock_response.status_code = 404

        mock_client_instance = AsyncMock()
        mock_client_instance.get = AsyncMock(return_value=mock_response)
        mock_client_instance.__aenter__ = AsyncMock(return_value=mock_client_instance)
        mock_client_instance.__aexit__ = AsyncMock(return_value=False)
        MockHttpClient.return_value = mock_client_instance

        db = AsyncMock()
        service = WompiService(db)

        result = await service.resolve_reference_from_wompi("nonexistent-id")

        assert result is None

    @patch("app.services.wompi.settings")
    @patch("app.services.wompi.httpx.AsyncClient")
    async def test_resolve_exception_returns_none(self, MockHttpClient, mock_settings):
        """Should return None on network errors."""
        mock_settings.wompi_base_url = "https://sandbox.wompi.co/v1"

        mock_client_instance = AsyncMock()
        mock_client_instance.get = AsyncMock(side_effect=Exception("Connection timeout"))
        mock_client_instance.__aenter__ = AsyncMock(return_value=mock_client_instance)
        mock_client_instance.__aexit__ = AsyncMock(return_value=False)
        MockHttpClient.return_value = mock_client_instance

        db = AsyncMock()
        service = WompiService(db)

        result = await service.resolve_reference_from_wompi("any-id")

        assert result is None


# ============================================================================
# TEST: Payment Method Mapping
# ============================================================================

class TestWompiToAccPaymentMethodMapping:
    """Tests for WOMPI_TO_ACC_PAYMENT_METHOD constant."""

    def test_all_wompi_methods_map_to_transfer(self):
        """All Wompi payment methods should map to AccPaymentMethod.TRANSFER."""
        expected_methods = [
            "CARD", "PSE", "NEQUI", "BANCOLOMBIA_TRANSFER",
            "BANCOLOMBIA_QR", "BANCOLOMBIA_COLLECT", "DAVIPLATA",
        ]

        for method in expected_methods:
            assert WOMPI_TO_ACC_PAYMENT_METHOD[method] == AccPaymentMethod.TRANSFER, (
                f"Expected {method} to map to TRANSFER, "
                f"got {WOMPI_TO_ACC_PAYMENT_METHOD.get(method)}"
            )

    def test_mapping_has_expected_keys(self):
        """Mapping should include all documented Wompi payment methods."""
        expected_keys = {
            "CARD", "PSE", "NEQUI", "BANCOLOMBIA_TRANSFER",
            "BANCOLOMBIA_QR", "BANCOLOMBIA_COLLECT", "DAVIPLATA",
        }
        assert set(WOMPI_TO_ACC_PAYMENT_METHOD.keys()) == expected_keys

    def test_unknown_method_defaults_to_transfer(self):
        """Using .get() with default should return TRANSFER for unknown methods."""
        result = WOMPI_TO_ACC_PAYMENT_METHOD.get(
            "UNKNOWN_METHOD", AccPaymentMethod.TRANSFER
        )
        assert result == AccPaymentMethod.TRANSFER


# ============================================================================
# TEST: Get Payment Status
# ============================================================================

class TestGetPaymentStatus:
    """Tests for WompiService.get_payment_status"""

    async def test_returns_payment_tx_by_reference(self):
        """Should return PaymentTransaction when found by reference."""
        payment_tx = _make_payment_tx(reference="WP-TEST-REF")

        db = AsyncMock()
        db.execute = AsyncMock(return_value=_mock_scalar_result(payment_tx))

        service = WompiService(db)
        result = await service.get_payment_status("WP-TEST-REF")

        assert result == payment_tx

    async def test_returns_none_when_not_found(self):
        """Should return None when no PaymentTransaction matches."""
        db = AsyncMock()
        db.execute = AsyncMock(return_value=_mock_scalar_result(None))

        service = WompiService(db)
        result = await service.get_payment_status("NONEXISTENT-REF")

        assert result is None


# ============================================================================
# TEST: Get Payments For Order
# ============================================================================

class TestGetPaymentsForOrder:
    """Tests for WompiService.get_payments_for_order"""

    async def test_returns_list_of_payment_transactions(self):
        """Should return all payment transactions for an order."""
        order_id = uuid4()
        txs = [
            _make_payment_tx(reference="WP-1", order_id=order_id),
            _make_payment_tx(reference="WP-2", order_id=order_id),
        ]

        db = AsyncMock()
        db.execute = AsyncMock(return_value=_mock_scalars_result(txs))

        service = WompiService(db)
        result = await service.get_payments_for_order(order_id)

        assert len(result) == 2
        assert result[0].reference == "WP-1"
        assert result[1].reference == "WP-2"

    async def test_returns_empty_list_when_no_payments(self):
        """Should return empty list when order has no payment transactions."""
        db = AsyncMock()
        db.execute = AsyncMock(return_value=_mock_scalars_result([]))

        service = WompiService(db)
        result = await service.get_payments_for_order(uuid4())

        assert result == []
