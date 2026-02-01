"""
Unit Tests for Multi-Channel Notification Service

Tests cover:
- Channel selection based on client preferences
- Fallback logic between channels
- Notification orchestration (email + WhatsApp)
- Individual notification types (order ready, order confirmation, etc.)
"""
import pytest
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4
from datetime import date

from app.services.notification_channels import (
    NotificationResult,
    _get_channels_for_client,
    notify_order_ready,
    notify_order_confirmation,
    notify_sale_confirmation,
    notify_welcome,
    notify_payment_reminder,
)
from app.models.client import Client, NotificationPreference, ClientType


# ============================================================================
# TEST: NotificationResult Dataclass
# ============================================================================

class TestNotificationResult:
    """Tests for NotificationResult dataclass"""

    def test_default_values(self):
        """Test default initialization"""
        result = NotificationResult()
        assert result.email_sent is False
        assert result.email_error is None
        assert result.whatsapp_sent is False
        assert result.whatsapp_error is None

    def test_any_sent_false_when_none_sent(self):
        """Test any_sent is False when no channel succeeded"""
        result = NotificationResult(email_sent=False, whatsapp_sent=False)
        assert result.any_sent is False

    def test_any_sent_true_when_email_sent(self):
        """Test any_sent is True when email succeeded"""
        result = NotificationResult(email_sent=True, whatsapp_sent=False)
        assert result.any_sent is True

    def test_any_sent_true_when_whatsapp_sent(self):
        """Test any_sent is True when WhatsApp succeeded"""
        result = NotificationResult(email_sent=False, whatsapp_sent=True)
        assert result.any_sent is True

    def test_all_sent_true_when_both_succeed(self):
        """Test all_sent is True when both channels succeed"""
        result = NotificationResult(email_sent=True, whatsapp_sent=True)
        assert result.all_sent is True

    def test_all_sent_false_when_one_fails(self):
        """Test all_sent is False when one channel fails"""
        result = NotificationResult(email_sent=True, whatsapp_sent=False)
        assert result.all_sent is False


# ============================================================================
# TEST: Channel Selection Logic
# ============================================================================

class TestGetChannelsForClient:
    """Tests for _get_channels_for_client function"""

    def test_preference_none_returns_empty(self):
        """Client with NONE preference gets no channels"""
        client = MagicMock(spec=Client)
        client.notification_preference = NotificationPreference.NONE
        client.email = "test@example.com"
        client.phone = "3001234567"

        channels = _get_channels_for_client(client)
        assert channels == []

    def test_preference_email_with_email(self):
        """Client with EMAIL preference and email address gets email channel"""
        client = MagicMock(spec=Client)
        client.notification_preference = NotificationPreference.EMAIL
        client.email = "test@example.com"
        client.phone = None

        channels = _get_channels_for_client(client)
        assert channels == ["email"]

    def test_preference_email_without_email(self):
        """Client with EMAIL preference but no email gets empty"""
        client = MagicMock(spec=Client)
        client.notification_preference = NotificationPreference.EMAIL
        client.email = None
        client.phone = "3001234567"

        channels = _get_channels_for_client(client)
        assert channels == []

    @patch("app.services.notification_channels.settings")
    def test_preference_whatsapp_with_phone_and_enabled(self, mock_settings):
        """Client with WHATSAPP preference and phone gets whatsapp channel when enabled"""
        mock_settings.WHATSAPP_ENABLED = True

        client = MagicMock(spec=Client)
        client.notification_preference = NotificationPreference.WHATSAPP
        client.email = None
        client.phone = "3001234567"

        channels = _get_channels_for_client(client)
        assert channels == ["whatsapp"]

    @patch("app.services.notification_channels.settings")
    def test_preference_whatsapp_disabled(self, mock_settings):
        """Client with WHATSAPP preference but WhatsApp disabled gets empty"""
        mock_settings.WHATSAPP_ENABLED = False

        client = MagicMock(spec=Client)
        client.notification_preference = NotificationPreference.WHATSAPP
        client.email = None
        client.phone = "3001234567"

        channels = _get_channels_for_client(client)
        assert channels == []

    @patch("app.services.notification_channels.settings")
    def test_preference_both_with_both_contacts(self, mock_settings):
        """Client with BOTH preference and both contacts gets both channels"""
        mock_settings.WHATSAPP_ENABLED = True

        client = MagicMock(spec=Client)
        client.notification_preference = NotificationPreference.BOTH
        client.email = "test@example.com"
        client.phone = "3001234567"

        channels = _get_channels_for_client(client)
        assert "email" in channels
        assert "whatsapp" in channels

    @patch("app.services.notification_channels.settings")
    def test_preference_both_email_only(self, mock_settings):
        """Client with BOTH preference but only email gets email"""
        mock_settings.WHATSAPP_ENABLED = True

        client = MagicMock(spec=Client)
        client.notification_preference = NotificationPreference.BOTH
        client.email = "test@example.com"
        client.phone = None

        channels = _get_channels_for_client(client)
        assert channels == ["email"]

    @patch("app.services.notification_channels.settings")
    def test_preference_auto_with_email(self, mock_settings):
        """Client with AUTO preference and email gets email channel"""
        mock_settings.WHATSAPP_ENABLED = False

        client = MagicMock(spec=Client)
        client.notification_preference = NotificationPreference.AUTO
        client.email = "test@example.com"
        client.phone = None

        channels = _get_channels_for_client(client)
        assert channels == ["email"]

    @patch("app.services.notification_channels.settings")
    def test_preference_auto_with_both(self, mock_settings):
        """Client with AUTO preference and both contacts gets both channels"""
        mock_settings.WHATSAPP_ENABLED = True

        client = MagicMock(spec=Client)
        client.notification_preference = NotificationPreference.AUTO
        client.email = "test@example.com"
        client.phone = "3001234567"

        channels = _get_channels_for_client(client)
        assert "email" in channels
        assert "whatsapp" in channels


# ============================================================================
# TEST: Order Ready Notification
# ============================================================================

class TestNotifyOrderReady:
    """Tests for notify_order_ready function"""

    @pytest.mark.asyncio
    @patch("app.services.notification_channels.email_service")
    async def test_sends_email_when_available(self, mock_email):
        """Test email is sent when client has email and email preference"""
        mock_email.send_order_ready_email = MagicMock(return_value=True)

        client = MagicMock(spec=Client)
        client.notification_preference = NotificationPreference.EMAIL
        client.email = "test@example.com"
        client.phone = None
        client.name = "Test Client"
        client.code = "CLI-001"

        order = MagicMock()
        order.code = "ENC-2026-0001"

        result = await notify_order_ready(client, order, "Test School")

        assert result.email_sent is True
        mock_email.send_order_ready_email.assert_called_once_with(
            email="test@example.com",
            name="Test Client",
            order_code="ENC-2026-0001",
            school_name="Test School"
        )

    @pytest.mark.asyncio
    @patch("app.services.notification_channels.settings")
    @patch("app.services.notification_channels.whatsapp_service")
    async def test_sends_whatsapp_when_available(self, mock_whatsapp, mock_settings):
        """Test WhatsApp is sent when client has phone and WhatsApp enabled"""
        mock_settings.WHATSAPP_ENABLED = True
        mock_whatsapp.send_order_ready = MagicMock(return_value=True)

        client = MagicMock(spec=Client)
        client.notification_preference = NotificationPreference.WHATSAPP
        client.email = None
        client.phone = "3001234567"
        client.name = "Test Client"
        client.code = "CLI-001"

        order = MagicMock()
        order.code = "ENC-2026-0001"

        result = await notify_order_ready(client, order, "Test School")

        assert result.whatsapp_sent is True
        mock_whatsapp.send_order_ready.assert_called_once()

    @pytest.mark.asyncio
    async def test_returns_empty_result_for_no_channels(self):
        """Test returns empty result when client has no available channels"""
        client = MagicMock(spec=Client)
        client.notification_preference = NotificationPreference.NONE
        client.email = None
        client.phone = None
        client.code = "CLI-001"

        order = MagicMock()
        order.code = "ENC-2026-0001"

        result = await notify_order_ready(client, order)

        assert result.any_sent is False

    @pytest.mark.asyncio
    @patch("app.services.notification_channels.email_service")
    async def test_handles_email_error_gracefully(self, mock_email):
        """Test email errors are captured without raising"""
        mock_email.send_order_ready_email = MagicMock(side_effect=Exception("SMTP error"))

        client = MagicMock(spec=Client)
        client.notification_preference = NotificationPreference.EMAIL
        client.email = "test@example.com"
        client.phone = None
        client.name = "Test"
        client.code = "CLI-001"

        order = MagicMock()
        order.code = "ENC-001"

        result = await notify_order_ready(client, order)

        assert result.email_sent is False
        assert result.email_error is not None


# ============================================================================
# TEST: Order Confirmation Notification
# ============================================================================

class TestNotifyOrderConfirmation:
    """Tests for notify_order_confirmation function"""

    @pytest.mark.asyncio
    @patch("app.services.notification_channels.email_service")
    async def test_sends_email_with_html_content(self, mock_email):
        """Test email is sent with provided HTML content"""
        mock_email.send_order_confirmation_email = MagicMock(return_value=True)

        client = MagicMock(spec=Client)
        client.notification_preference = NotificationPreference.EMAIL
        client.email = "test@example.com"
        client.phone = None
        client.name = "Test Client"
        client.code = "CLI-001"

        order = MagicMock()
        order.code = "ENC-2026-0001"
        order.total = Decimal("150000")

        html_content = "<html><body>Order confirmed</body></html>"

        result = await notify_order_confirmation(client, order, html_content, "Test School")

        assert result.email_sent is True
        mock_email.send_order_confirmation_email.assert_called_once_with(
            email="test@example.com",
            name="Test Client",
            order_code="ENC-2026-0001",
            html_content=html_content
        )


# ============================================================================
# TEST: Sale Confirmation Notification
# ============================================================================

class TestNotifySaleConfirmation:
    """Tests for notify_sale_confirmation function"""

    @pytest.mark.asyncio
    @patch("app.services.notification_channels.email_service")
    async def test_sends_sale_email(self, mock_email):
        """Test sale confirmation email is sent"""
        mock_email.send_sale_confirmation_email = MagicMock(return_value=True)

        client = MagicMock(spec=Client)
        client.notification_preference = NotificationPreference.EMAIL
        client.email = "test@example.com"
        client.phone = None
        client.name = "Test Client"
        client.code = "CLI-001"

        sale = MagicMock()
        sale.code = "VNT-2026-0001"
        sale.total = Decimal("100000")

        html_content = "<html><body>Sale receipt</body></html>"

        result = await notify_sale_confirmation(client, sale, html_content)

        assert result.email_sent is True


# ============================================================================
# TEST: Welcome Notification
# ============================================================================

class TestNotifyWelcome:
    """Tests for notify_welcome function"""

    @pytest.mark.asyncio
    @patch("app.services.notification_channels.email_service")
    async def test_sends_welcome_with_activation(self, mock_email):
        """Test welcome email with activation token is sent"""
        mock_email.send_welcome_with_activation_email = MagicMock(return_value=True)

        client = MagicMock(spec=Client)
        client.notification_preference = NotificationPreference.EMAIL
        client.email = "newclient@example.com"
        client.phone = None
        client.name = "New Client"
        client.code = "CLI-001"

        activation_token = "abc123token"

        result = await notify_welcome(client, activation_token, "encargo")

        assert result.email_sent is True
        mock_email.send_welcome_with_activation_email.assert_called_once_with(
            email="newclient@example.com",
            token="abc123token",
            name="New Client",
            transaction_type="encargo"
        )

    @pytest.mark.asyncio
    @patch("app.services.notification_channels.settings")
    @patch("app.services.notification_channels.whatsapp_service")
    async def test_sends_welcome_whatsapp(self, mock_whatsapp, mock_settings):
        """Test welcome WhatsApp is sent when available"""
        mock_settings.WHATSAPP_ENABLED = True
        mock_whatsapp.send_welcome_message = MagicMock(return_value=True)

        client = MagicMock(spec=Client)
        client.notification_preference = NotificationPreference.WHATSAPP
        client.email = None
        client.phone = "3001234567"
        client.name = "New Client"
        client.code = "CLI-001"

        result = await notify_welcome(client, "token123", "venta")

        assert result.whatsapp_sent is True


# ============================================================================
# TEST: Payment Reminder Notification
# ============================================================================

class TestNotifyPaymentReminder:
    """Tests for notify_payment_reminder function"""

    @pytest.mark.asyncio
    @patch("app.services.notification_channels.settings")
    @patch("app.services.notification_channels.whatsapp_service")
    async def test_sends_payment_reminder_whatsapp(self, mock_whatsapp, mock_settings):
        """Test payment reminder is sent via WhatsApp"""
        mock_settings.WHATSAPP_ENABLED = True
        mock_whatsapp.send_payment_reminder = MagicMock(return_value=True)

        client = MagicMock(spec=Client)
        client.notification_preference = NotificationPreference.WHATSAPP
        client.email = None
        client.phone = "3001234567"
        client.name = "Client with Debt"
        client.code = "CLI-001"

        result = await notify_payment_reminder(
            client,
            amount=Decimal("50000"),
            due_date="2026-01-31",
            reference="ENC-001"
        )

        assert result.whatsapp_sent is True
        mock_whatsapp.send_payment_reminder.assert_called_once_with(
            phone="3001234567",
            name="Client with Debt",
            amount=Decimal("50000"),
            due_date="2026-01-31"
        )


# ============================================================================
# TEST: Parallel Notification Sending
# ============================================================================

class TestParallelNotificationSending:
    """Tests for parallel notification sending behavior"""

    @pytest.mark.asyncio
    @patch("app.services.notification_channels.settings")
    @patch("app.services.notification_channels.whatsapp_service")
    @patch("app.services.notification_channels.email_service")
    async def test_sends_both_channels_in_parallel(
        self, mock_email, mock_whatsapp, mock_settings
    ):
        """Test both email and WhatsApp are sent when BOTH preference"""
        mock_settings.WHATSAPP_ENABLED = True
        mock_email.send_order_ready_email = MagicMock(return_value=True)
        mock_whatsapp.send_order_ready = MagicMock(return_value=True)

        client = MagicMock(spec=Client)
        client.notification_preference = NotificationPreference.BOTH
        client.email = "test@example.com"
        client.phone = "3001234567"
        client.name = "Test Client"
        client.code = "CLI-001"

        order = MagicMock()
        order.code = "ENC-001"

        result = await notify_order_ready(client, order, "School")

        assert result.email_sent is True
        assert result.whatsapp_sent is True
        mock_email.send_order_ready_email.assert_called_once()
        mock_whatsapp.send_order_ready.assert_called_once()

    @pytest.mark.asyncio
    @patch("app.services.notification_channels.settings")
    @patch("app.services.notification_channels.whatsapp_service")
    @patch("app.services.notification_channels.email_service")
    async def test_one_channel_failure_does_not_affect_other(
        self, mock_email, mock_whatsapp, mock_settings
    ):
        """Test one channel failing doesn't affect the other"""
        mock_settings.WHATSAPP_ENABLED = True
        mock_email.send_order_ready_email = MagicMock(side_effect=Exception("Email error"))
        mock_whatsapp.send_order_ready = MagicMock(return_value=True)

        client = MagicMock(spec=Client)
        client.notification_preference = NotificationPreference.BOTH
        client.email = "test@example.com"
        client.phone = "3001234567"
        client.name = "Test"
        client.code = "CLI-001"

        order = MagicMock()
        order.code = "ENC-001"

        result = await notify_order_ready(client, order)

        # Email should fail, WhatsApp should succeed
        assert result.email_sent is False
        assert result.whatsapp_sent is True
        assert result.any_sent is True
        assert result.all_sent is False
