"""
Tests for WhatsApp Business API Service

Tests cover:
- Phone number formatting for international format
- Dev mode (without API key)
- Channel selection based on client preferences
"""
import pytest
from decimal import Decimal
from unittest.mock import patch, MagicMock

from app.services.whatsapp import (
    format_phone_for_whatsapp,
    send_order_ready,
    send_order_confirmation,
    send_sale_confirmation,
    send_welcome_message,
    send_payment_reminder,
    _send_template_message,
)
from app.services.notification_channels import (
    _get_channels_for_client,
    NotificationResult,
)
from app.models.client import NotificationPreference


class TestPhoneFormatting:
    """Tests for phone number formatting"""

    def test_format_colombian_mobile(self):
        """Colombian mobile number (10 digits starting with 3)"""
        assert format_phone_for_whatsapp("3001234567") == "573001234567"

    def test_format_with_spaces(self):
        """Phone with spaces should be cleaned"""
        assert format_phone_for_whatsapp("300 123 4567") == "573001234567"

    def test_format_with_dashes(self):
        """Phone with dashes should be cleaned"""
        assert format_phone_for_whatsapp("300-123-4567") == "573001234567"

    def test_format_already_international(self):
        """Phone already in international format should remain unchanged"""
        assert format_phone_for_whatsapp("573001234567") == "573001234567"

    def test_format_with_plus(self):
        """Phone with + prefix should have it removed"""
        assert format_phone_for_whatsapp("+573001234567") == "573001234567"

    def test_format_empty_string(self):
        """Empty string should return empty"""
        assert format_phone_for_whatsapp("") == ""

    def test_format_none(self):
        """None should return empty string"""
        assert format_phone_for_whatsapp(None) == ""

    def test_format_non_colombian(self):
        """Non-Colombian format should be returned as-is"""
        # US number - not Colombian format
        assert format_phone_for_whatsapp("12025551234") == "12025551234"


class TestDevMode:
    """Tests for dev mode (without API credentials)"""

    @patch('app.services.whatsapp.settings')
    def test_dev_mode_disabled(self, mock_settings):
        """Should log and return True when WHATSAPP_ENABLED is False"""
        mock_settings.WHATSAPP_ENABLED = False

        result = send_order_ready(
            phone="3001234567",
            name="Test User",
            order_code="ENC-2026-0001"
        )

        assert result is True

    @patch('app.services.whatsapp.settings')
    def test_dev_mode_no_token(self, mock_settings):
        """Should log and return True when no access token"""
        mock_settings.WHATSAPP_ENABLED = True
        mock_settings.WHATSAPP_ACCESS_TOKEN = None
        mock_settings.WHATSAPP_PHONE_NUMBER_ID = None

        result = send_order_ready(
            phone="3001234567",
            name="Test User",
            order_code="ENC-2026-0001"
        )

        assert result is True


class TestNotificationFunctions:
    """Tests for specific notification functions"""

    @patch('app.services.whatsapp._send_template_message')
    def test_send_order_ready(self, mock_send):
        """send_order_ready should call template with correct params"""
        mock_send.return_value = True

        result = send_order_ready(
            phone="3001234567",
            name="Juan Garcia",
            order_code="ENC-2026-0001",
            school_name="Colegio San Jose"
        )

        mock_send.assert_called_once_with(
            "3001234567",
            "order_ready_v1",
            ["Juan Garcia", "ENC-2026-0001"]
        )
        assert result is True

    @patch('app.services.whatsapp._send_template_message')
    def test_send_order_confirmation(self, mock_send):
        """send_order_confirmation should format total correctly"""
        mock_send.return_value = True

        result = send_order_confirmation(
            phone="3001234567",
            name="Maria Lopez",
            order_code="ENC-2026-0002",
            total=Decimal("150000")
        )

        mock_send.assert_called_once_with(
            "3001234567",
            "order_confirmation_v1",
            ["Maria Lopez", "ENC-2026-0002", "$150.000"]
        )
        assert result is True

    @patch('app.services.whatsapp._send_template_message')
    def test_send_sale_confirmation(self, mock_send):
        """send_sale_confirmation should format total correctly"""
        mock_send.return_value = True

        result = send_sale_confirmation(
            phone="3001234567",
            name="Pedro Ramirez",
            sale_code="VNT-2026-0001",
            total=Decimal("85000")
        )

        mock_send.assert_called_once_with(
            "3001234567",
            "sale_confirmation_v1",
            ["Pedro Ramirez", "VNT-2026-0001", "$85.000"]
        )
        assert result is True

    @patch('app.services.whatsapp._send_template_message')
    def test_send_welcome_message(self, mock_send):
        """send_welcome_message should call with client name"""
        mock_send.return_value = True

        result = send_welcome_message(
            phone="3001234567",
            name="Ana Martinez"
        )

        mock_send.assert_called_once_with(
            "3001234567",
            "welcome_v1",
            ["Ana Martinez"]
        )
        assert result is True

    @patch('app.services.whatsapp._send_template_message')
    def test_send_payment_reminder(self, mock_send):
        """send_payment_reminder should format amount and date"""
        mock_send.return_value = True

        result = send_payment_reminder(
            phone="3001234567",
            name="Carlos Gomez",
            amount=Decimal("50000"),
            due_date="15 de enero"
        )

        mock_send.assert_called_once_with(
            "3001234567",
            "payment_reminder_v1",
            ["Carlos Gomez", "$50.000", "15 de enero"]
        )
        assert result is True


class MockClient:
    """Mock Client for testing channel selection"""

    def __init__(
        self,
        email: str | None = None,
        phone: str | None = None,
        notification_preference: NotificationPreference = NotificationPreference.AUTO
    ):
        self.email = email
        self.phone = phone
        self.notification_preference = notification_preference
        self.name = "Test Client"
        self.code = "CLI-0001"


class TestChannelSelection:
    """Tests for notification channel selection logic"""

    @patch('app.services.notification_channels.settings')
    def test_auto_with_email_only(self, mock_settings):
        """AUTO preference with only email should return email channel"""
        mock_settings.WHATSAPP_ENABLED = True

        client = MockClient(email="test@example.com", phone=None)
        channels = _get_channels_for_client(client)

        assert channels == ["email"]

    @patch('app.services.notification_channels.settings')
    def test_auto_with_phone_only(self, mock_settings):
        """AUTO preference with only phone should return whatsapp channel"""
        mock_settings.WHATSAPP_ENABLED = True

        client = MockClient(email=None, phone="3001234567")
        channels = _get_channels_for_client(client)

        assert channels == ["whatsapp"]

    @patch('app.services.notification_channels.settings')
    def test_auto_with_both(self, mock_settings):
        """AUTO preference with both should return both channels"""
        mock_settings.WHATSAPP_ENABLED = True

        client = MockClient(email="test@example.com", phone="3001234567")
        channels = _get_channels_for_client(client)

        assert "email" in channels
        assert "whatsapp" in channels

    @patch('app.services.notification_channels.settings')
    def test_auto_whatsapp_disabled(self, mock_settings):
        """AUTO with WhatsApp disabled should only return email"""
        mock_settings.WHATSAPP_ENABLED = False

        client = MockClient(email="test@example.com", phone="3001234567")
        channels = _get_channels_for_client(client)

        assert channels == ["email"]

    @patch('app.services.notification_channels.settings')
    def test_email_preference(self, mock_settings):
        """EMAIL preference should only return email"""
        mock_settings.WHATSAPP_ENABLED = True

        client = MockClient(
            email="test@example.com",
            phone="3001234567",
            notification_preference=NotificationPreference.EMAIL
        )
        channels = _get_channels_for_client(client)

        assert channels == ["email"]

    @patch('app.services.notification_channels.settings')
    def test_whatsapp_preference(self, mock_settings):
        """WHATSAPP preference should only return whatsapp"""
        mock_settings.WHATSAPP_ENABLED = True

        client = MockClient(
            email="test@example.com",
            phone="3001234567",
            notification_preference=NotificationPreference.WHATSAPP
        )
        channels = _get_channels_for_client(client)

        assert channels == ["whatsapp"]

    @patch('app.services.notification_channels.settings')
    def test_both_preference(self, mock_settings):
        """BOTH preference should return both channels"""
        mock_settings.WHATSAPP_ENABLED = True

        client = MockClient(
            email="test@example.com",
            phone="3001234567",
            notification_preference=NotificationPreference.BOTH
        )
        channels = _get_channels_for_client(client)

        assert "email" in channels
        assert "whatsapp" in channels

    @patch('app.services.notification_channels.settings')
    def test_none_preference(self, mock_settings):
        """NONE preference should return empty list"""
        mock_settings.WHATSAPP_ENABLED = True

        client = MockClient(
            email="test@example.com",
            phone="3001234567",
            notification_preference=NotificationPreference.NONE
        )
        channels = _get_channels_for_client(client)

        assert channels == []


class TestNotificationResult:
    """Tests for NotificationResult dataclass"""

    def test_any_sent_email_only(self):
        """any_sent should be True if email sent"""
        result = NotificationResult(email_sent=True, whatsapp_sent=False)
        assert result.any_sent is True

    def test_any_sent_whatsapp_only(self):
        """any_sent should be True if whatsapp sent"""
        result = NotificationResult(email_sent=False, whatsapp_sent=True)
        assert result.any_sent is True

    def test_any_sent_both(self):
        """any_sent should be True if both sent"""
        result = NotificationResult(email_sent=True, whatsapp_sent=True)
        assert result.any_sent is True

    def test_any_sent_none(self):
        """any_sent should be False if none sent"""
        result = NotificationResult(email_sent=False, whatsapp_sent=False)
        assert result.any_sent is False

    def test_all_sent_true(self):
        """all_sent should be True only if both sent"""
        result = NotificationResult(email_sent=True, whatsapp_sent=True)
        assert result.all_sent is True

    def test_all_sent_partial(self):
        """all_sent should be False if only one sent"""
        result = NotificationResult(email_sent=True, whatsapp_sent=False)
        assert result.all_sent is False
