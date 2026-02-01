"""
Unit Tests for Email Service.

Tests cover:
- Verification email sending
- Welcome email sending
- Order confirmation emails
- Error handling
- Dev mode (no API key)
"""
import pytest
from unittest.mock import patch, MagicMock

from app.services.email import (
    send_verification_email,
    send_welcome_email,
    send_password_reset_email,
    send_order_confirmation_email,
    send_sale_confirmation_email,
    send_activation_email,
    send_order_ready_email,
    send_welcome_with_activation_email,
)


pytestmark = pytest.mark.unit


# ============================================================================
# VERIFICATION EMAIL TESTS
# ============================================================================

class TestSendVerificationEmail:
    """Tests for send_verification_email function."""

    def test_dev_mode_returns_true(self):
        """Should return True in dev mode (no API key)."""
        with patch('app.services.email.settings') as mock_settings:
            mock_settings.RESEND_API_KEY = None

            result = send_verification_email(
                email="test@example.com",
                code="123456",
                name="Test User"
            )

            assert result is True

    def test_sends_email_with_api_key(self):
        """Should send email when API key is configured."""
        with patch('app.services.email.settings') as mock_settings, \
             patch('app.services.email.resend') as mock_resend:
            mock_settings.RESEND_API_KEY = "test_api_key"
            mock_settings.EMAIL_FROM = "test@uniformes.com"

            mock_resend.Emails.send = MagicMock()

            result = send_verification_email(
                email="test@example.com",
                code="123456",
                name="Test User"
            )

            assert result is True
            mock_resend.Emails.send.assert_called_once()

    def test_includes_verification_code_in_email(self):
        """Should include verification code in email body."""
        with patch('app.services.email.settings') as mock_settings, \
             patch('app.services.email.resend') as mock_resend:
            mock_settings.RESEND_API_KEY = "test_api_key"
            mock_settings.EMAIL_FROM = "test@uniformes.com"

            mock_resend.Emails.send = MagicMock()

            send_verification_email(
                email="test@example.com",
                code="654321",
                name="María"
            )

            # Check the email was sent with correct code
            call_args = mock_resend.Emails.send.call_args
            email_data = call_args[0][0]
            assert "654321" in email_data["html"]
            assert "María" in email_data["html"]

    def test_returns_false_on_error(self):
        """Should return False when sending fails."""
        with patch('app.services.email.settings') as mock_settings, \
             patch('app.services.email.resend') as mock_resend:
            mock_settings.RESEND_API_KEY = "test_api_key"
            mock_settings.EMAIL_FROM = "test@uniformes.com"

            mock_resend.Emails.send = MagicMock(
                side_effect=Exception("API Error")
            )

            result = send_verification_email(
                email="test@example.com",
                code="123456"
            )

            assert result is False

    def test_uses_default_name_if_not_provided(self):
        """Should use default name 'Usuario' if not provided."""
        with patch('app.services.email.settings') as mock_settings, \
             patch('app.services.email.resend') as mock_resend:
            mock_settings.RESEND_API_KEY = "test_api_key"
            mock_settings.EMAIL_FROM = "test@uniformes.com"

            mock_resend.Emails.send = MagicMock()

            send_verification_email(
                email="test@example.com",
                code="123456"
                # No name provided - should use default
            )

            call_args = mock_resend.Emails.send.call_args
            email_data = call_args[0][0]
            assert "Usuario" in email_data["html"]


# ============================================================================
# WELCOME EMAIL TESTS
# ============================================================================

class TestSendWelcomeEmail:
    """Tests for send_welcome_email function."""

    def test_dev_mode_returns_true(self):
        """Should return True in dev mode (no API key)."""
        with patch('app.services.email.settings') as mock_settings:
            mock_settings.RESEND_API_KEY = None

            result = send_welcome_email(
                email="test@example.com",
                name="Test User"
            )

            assert result is True

    def test_sends_welcome_email_with_api_key(self):
        """Should send welcome email when API key is configured."""
        with patch('app.services.email.settings') as mock_settings, \
             patch('app.services.email.resend') as mock_resend:
            mock_settings.RESEND_API_KEY = "test_api_key"
            mock_settings.EMAIL_FROM = "test@uniformes.com"
            mock_settings.FRONTEND_URL = "https://uniformes.com"

            mock_resend.Emails.send = MagicMock()

            result = send_welcome_email(
                email="test@example.com",
                name="María García"
            )

            assert result is True
            mock_resend.Emails.send.assert_called_once()

    def test_includes_user_name_in_email(self):
        """Should include user name in welcome email."""
        with patch('app.services.email.settings') as mock_settings, \
             patch('app.services.email.resend') as mock_resend:
            mock_settings.RESEND_API_KEY = "test_api_key"
            mock_settings.EMAIL_FROM = "test@uniformes.com"
            mock_settings.FRONTEND_URL = "https://uniformes.com"

            mock_resend.Emails.send = MagicMock()

            send_welcome_email(
                email="test@example.com",
                name="Carlos López"
            )

            call_args = mock_resend.Emails.send.call_args
            email_data = call_args[0][0]
            assert "Carlos López" in email_data["html"]

    def test_has_correct_subject(self):
        """Should have welcome subject."""
        with patch('app.services.email.settings') as mock_settings, \
             patch('app.services.email.resend') as mock_resend:
            mock_settings.RESEND_API_KEY = "test_api_key"
            mock_settings.EMAIL_FROM = "test@uniformes.com"
            mock_settings.FRONTEND_URL = "https://uniformes.com"

            mock_resend.Emails.send = MagicMock()

            send_welcome_email(
                email="test@example.com",
                name="Test"
            )

            call_args = mock_resend.Emails.send.call_args
            email_data = call_args[0][0]
            assert "Bienvenido" in email_data["subject"]

    def test_returns_false_on_error(self):
        """Should return False when sending fails."""
        with patch('app.services.email.settings') as mock_settings, \
             patch('app.services.email.resend') as mock_resend:
            mock_settings.RESEND_API_KEY = "test_api_key"
            mock_settings.EMAIL_FROM = "test@uniformes.com"
            mock_settings.FRONTEND_URL = "https://uniformes.com"

            mock_resend.Emails.send = MagicMock(
                side_effect=Exception("API Error")
            )

            result = send_welcome_email(
                email="test@example.com",
                name="Test"
            )

            assert result is False


# ============================================================================
# EMAIL FORMAT TESTS
# ============================================================================

class TestEmailFormat:
    """Tests for email formatting."""

    def test_verification_email_has_html_structure(self):
        """Verification email should have proper HTML structure."""
        with patch('app.services.email.settings') as mock_settings, \
             patch('app.services.email.resend') as mock_resend:
            mock_settings.RESEND_API_KEY = "test_api_key"
            mock_settings.EMAIL_FROM = "test@uniformes.com"

            mock_resend.Emails.send = MagicMock()

            send_verification_email(
                email="test@example.com",
                code="123456"
            )

            call_args = mock_resend.Emails.send.call_args
            email_data = call_args[0][0]

            # Check for expected HTML elements
            assert "<div" in email_data["html"]
            assert "style=" in email_data["html"]
            assert "Uniformes" in email_data["html"]

    def test_verification_email_mentions_expiration(self):
        """Verification email should mention code expiration."""
        with patch('app.services.email.settings') as mock_settings, \
             patch('app.services.email.resend') as mock_resend:
            mock_settings.RESEND_API_KEY = "test_api_key"
            mock_settings.EMAIL_FROM = "test@uniformes.com"

            mock_resend.Emails.send = MagicMock()

            send_verification_email(
                email="test@example.com",
                code="123456"
            )

            call_args = mock_resend.Emails.send.call_args
            email_data = call_args[0][0]

            assert "10 minutos" in email_data["html"] or "expira" in email_data["html"].lower()


# ============================================================================
# EDGE CASES
# ============================================================================

class TestEdgeCases:
    """Tests for edge cases."""

    def test_empty_email_address(self):
        """Should handle empty email address gracefully."""
        with patch('app.services.email.settings') as mock_settings, \
             patch('app.services.email.resend') as mock_resend:
            mock_settings.RESEND_API_KEY = "test_api_key"
            mock_settings.EMAIL_FROM = "test@uniformes.com"

            mock_resend.Emails.send = MagicMock(
                side_effect=Exception("Invalid email")
            )

            result = send_verification_email(
                email="",
                code="123456"
            )

            assert result is False

    def test_special_characters_in_name(self):
        """Should handle special characters in name."""
        with patch('app.services.email.settings') as mock_settings, \
             patch('app.services.email.resend') as mock_resend:
            mock_settings.RESEND_API_KEY = "test_api_key"
            mock_settings.EMAIL_FROM = "test@uniformes.com"

            mock_resend.Emails.send = MagicMock()

            result = send_verification_email(
                email="test@example.com",
                code="123456",
                name="José María O'Connor"
            )

            assert result is True
            call_args = mock_resend.Emails.send.call_args
            email_data = call_args[0][0]
            assert "José María O'Connor" in email_data["html"]

    def test_unicode_in_name(self):
        """Should handle unicode characters in name."""
        with patch('app.services.email.settings') as mock_settings, \
             patch('app.services.email.resend') as mock_resend:
            mock_settings.RESEND_API_KEY = "test_api_key"
            mock_settings.EMAIL_FROM = "test@uniformes.com"

            mock_resend.Emails.send = MagicMock()

            result = send_verification_email(
                email="test@example.com",
                code="123456",
                name="北京用户"
            )

            assert result is True


# ============================================================================
# ORDER READY EMAIL TESTS
# ============================================================================

class TestSendOrderReadyEmail:
    """Tests for send_order_ready_email function."""

    def test_dev_mode_returns_true(self):
        """Should return True in dev mode (no API key)."""
        with patch('app.services.email.settings') as mock_settings:
            mock_settings.RESEND_API_KEY = None

            result = send_order_ready_email(
                email="customer@example.com",
                name="Customer",
                order_code="ENC-2026-0001",
                school_name="Test School"
            )

            assert result is True

    def test_sends_order_ready_with_api_key(self):
        """Should send order ready email when API key is configured."""
        with patch('app.services.email.settings') as mock_settings, \
             patch('app.services.email.resend') as mock_resend:
            mock_settings.RESEND_API_KEY = "test_api_key"
            mock_settings.EMAIL_FROM = "test@uniformes.com"

            mock_resend.Emails.send = MagicMock()

            result = send_order_ready_email(
                email="customer@example.com",
                name="Customer Name",
                order_code="ENC-2026-0001",
                school_name="Test School"
            )

            assert result is True
            mock_resend.Emails.send.assert_called_once()

    def test_includes_order_code_in_subject(self):
        """Should include order code in subject."""
        with patch('app.services.email.settings') as mock_settings, \
             patch('app.services.email.resend') as mock_resend:
            mock_settings.RESEND_API_KEY = "test_api_key"
            mock_settings.EMAIL_FROM = "test@uniformes.com"

            mock_resend.Emails.send = MagicMock()

            send_order_ready_email(
                email="customer@example.com",
                name="Customer",
                order_code="ENC-2026-0001"
            )

            call_args = mock_resend.Emails.send.call_args
            email_data = call_args[0][0]
            assert "ENC-2026-0001" in email_data["subject"]
            assert "listo" in email_data["subject"].lower()

    def test_includes_customer_name_in_body(self):
        """Should include customer name in email body."""
        with patch('app.services.email.settings') as mock_settings, \
             patch('app.services.email.resend') as mock_resend:
            mock_settings.RESEND_API_KEY = "test_api_key"
            mock_settings.EMAIL_FROM = "test@uniformes.com"

            mock_resend.Emails.send = MagicMock()

            send_order_ready_email(
                email="customer@example.com",
                name="Maria Garcia",
                order_code="ENC-001"
            )

            call_args = mock_resend.Emails.send.call_args
            email_data = call_args[0][0]
            assert "Maria Garcia" in email_data["html"]

    def test_includes_pickup_instructions(self):
        """Should include pickup instructions."""
        with patch('app.services.email.settings') as mock_settings, \
             patch('app.services.email.resend') as mock_resend:
            mock_settings.RESEND_API_KEY = "test_api_key"
            mock_settings.EMAIL_FROM = "test@uniformes.com"

            mock_resend.Emails.send = MagicMock()

            send_order_ready_email(
                email="customer@example.com",
                name="Customer",
                order_code="ENC-001"
            )

            call_args = mock_resend.Emails.send.call_args
            email_data = call_args[0][0]
            html_lower = email_data["html"].lower()
            assert "recoger" in html_lower

    def test_includes_contact_info(self):
        """Should include business contact information."""
        with patch('app.services.email.settings') as mock_settings, \
             patch('app.services.email.resend') as mock_resend:
            mock_settings.RESEND_API_KEY = "test_api_key"
            mock_settings.EMAIL_FROM = "test@uniformes.com"

            mock_resend.Emails.send = MagicMock()

            send_order_ready_email(
                email="customer@example.com",
                name="Customer",
                order_code="ENC-001"
            )

            call_args = mock_resend.Emails.send.call_args
            email_data = call_args[0][0]
            # Should include WhatsApp/phone
            assert "310" in email_data["html"] or "WhatsApp" in email_data["html"]

    def test_includes_school_name_when_provided(self):
        """Should include school name when provided."""
        with patch('app.services.email.settings') as mock_settings, \
             patch('app.services.email.resend') as mock_resend:
            mock_settings.RESEND_API_KEY = "test_api_key"
            mock_settings.EMAIL_FROM = "test@uniformes.com"

            mock_resend.Emails.send = MagicMock()

            send_order_ready_email(
                email="customer@example.com",
                name="Customer",
                order_code="ENC-001",
                school_name="Colegio San Jose"
            )

            call_args = mock_resend.Emails.send.call_args
            email_data = call_args[0][0]
            assert "Colegio San Jose" in email_data["html"] or "San Jose" in email_data["html"]

    def test_returns_false_on_error(self):
        """Should return False when sending fails."""
        with patch('app.services.email.settings') as mock_settings, \
             patch('app.services.email.resend') as mock_resend:
            mock_settings.RESEND_API_KEY = "test_api_key"
            mock_settings.EMAIL_FROM = "test@uniformes.com"

            mock_resend.Emails.send = MagicMock(
                side_effect=Exception("API Error")
            )

            result = send_order_ready_email(
                email="customer@example.com",
                name="Customer",
                order_code="ENC-001"
            )

            assert result is False


# ============================================================================
# WELCOME WITH ACTIVATION EMAIL TESTS
# ============================================================================

class TestSendWelcomeWithActivationEmail:
    """Tests for send_welcome_with_activation_email function."""

    def test_dev_mode_returns_true(self):
        """Should return True in dev mode (no API key)."""
        with patch('app.services.email.settings') as mock_settings:
            mock_settings.RESEND_API_KEY = None
            mock_settings.FRONTEND_URL = "https://test.com"

            result = send_welcome_with_activation_email(
                email="new@example.com",
                token="token123",
                name="New Client",
                transaction_type="encargo"
            )

            assert result is True

    def test_sends_welcome_with_activation(self):
        """Should send welcome email with activation link."""
        with patch('app.services.email.settings') as mock_settings, \
             patch('app.services.email.resend') as mock_resend:
            mock_settings.RESEND_API_KEY = "test_api_key"
            mock_settings.EMAIL_FROM = "test@uniformes.com"
            mock_settings.FRONTEND_URL = "https://uniformes.com"

            mock_resend.Emails.send = MagicMock()

            result = send_welcome_with_activation_email(
                email="client@example.com",
                token="activation_token",
                name="New Client",
                transaction_type="encargo"
            )

            assert result is True
            mock_resend.Emails.send.assert_called_once()

    def test_includes_activation_link(self):
        """Should include activation link with token."""
        with patch('app.services.email.settings') as mock_settings, \
             patch('app.services.email.resend') as mock_resend:
            mock_settings.RESEND_API_KEY = "test_api_key"
            mock_settings.EMAIL_FROM = "test@uniformes.com"
            mock_settings.FRONTEND_URL = "https://uniformes.com"

            mock_resend.Emails.send = MagicMock()

            send_welcome_with_activation_email(
                email="client@example.com",
                token="abc123token",
                name="Client"
            )

            call_args = mock_resend.Emails.send.call_args
            email_data = call_args[0][0]
            assert "activar-cuenta/abc123token" in email_data["html"]

    def test_includes_client_name(self):
        """Should include client name in email."""
        with patch('app.services.email.settings') as mock_settings, \
             patch('app.services.email.resend') as mock_resend:
            mock_settings.RESEND_API_KEY = "test_api_key"
            mock_settings.EMAIL_FROM = "test@uniformes.com"
            mock_settings.FRONTEND_URL = "https://uniformes.com"

            mock_resend.Emails.send = MagicMock()

            send_welcome_with_activation_email(
                email="client@example.com",
                token="token",
                name="Maria Garcia",
                transaction_type="encargo"
            )

            call_args = mock_resend.Emails.send.call_args
            email_data = call_args[0][0]
            assert "Maria Garcia" in email_data["html"]

    def test_includes_transaction_type(self):
        """Should include transaction type in email."""
        with patch('app.services.email.settings') as mock_settings, \
             patch('app.services.email.resend') as mock_resend:
            mock_settings.RESEND_API_KEY = "test_api_key"
            mock_settings.EMAIL_FROM = "test@uniformes.com"
            mock_settings.FRONTEND_URL = "https://uniformes.com"

            mock_resend.Emails.send = MagicMock()

            send_welcome_with_activation_email(
                email="client@example.com",
                token="token",
                name="Client",
                transaction_type="venta"
            )

            call_args = mock_resend.Emails.send.call_args
            email_data = call_args[0][0]
            assert "venta" in email_data["html"]

    def test_has_welcome_subject(self):
        """Should have welcome subject."""
        with patch('app.services.email.settings') as mock_settings, \
             patch('app.services.email.resend') as mock_resend:
            mock_settings.RESEND_API_KEY = "test_api_key"
            mock_settings.EMAIL_FROM = "test@uniformes.com"
            mock_settings.FRONTEND_URL = "https://uniformes.com"

            mock_resend.Emails.send = MagicMock()

            send_welcome_with_activation_email(
                email="client@example.com",
                token="token",
                name="Client"
            )

            call_args = mock_resend.Emails.send.call_args
            email_data = call_args[0][0]
            assert "Bienvenido" in email_data["subject"]

    def test_mentions_activation_expiration(self):
        """Should mention token expiration (7 days)."""
        with patch('app.services.email.settings') as mock_settings, \
             patch('app.services.email.resend') as mock_resend:
            mock_settings.RESEND_API_KEY = "test_api_key"
            mock_settings.EMAIL_FROM = "test@uniformes.com"
            mock_settings.FRONTEND_URL = "https://uniformes.com"

            mock_resend.Emails.send = MagicMock()

            send_welcome_with_activation_email(
                email="client@example.com",
                token="token",
                name="Client"
            )

            call_args = mock_resend.Emails.send.call_args
            email_data = call_args[0][0]
            assert "7 d" in email_data["html"].lower()  # "7 dias" or "7 days"

    def test_returns_false_on_error(self):
        """Should return False when sending fails."""
        with patch('app.services.email.settings') as mock_settings, \
             patch('app.services.email.resend') as mock_resend:
            mock_settings.RESEND_API_KEY = "test_api_key"
            mock_settings.EMAIL_FROM = "test@uniformes.com"
            mock_settings.FRONTEND_URL = "https://uniformes.com"

            mock_resend.Emails.send = MagicMock(
                side_effect=Exception("API Error")
            )

            result = send_welcome_with_activation_email(
                email="client@example.com",
                token="token",
                name="Client"
            )

            assert result is False


# ============================================================================
# ORDER CONFIRMATION EMAIL TESTS
# ============================================================================

class TestSendOrderConfirmationEmail:
    """Tests for send_order_confirmation_email function."""

    def test_dev_mode_returns_true(self):
        """Should return True in dev mode."""
        with patch('app.services.email.settings') as mock_settings:
            mock_settings.RESEND_API_KEY = None

            result = send_order_confirmation_email(
                email="customer@example.com",
                name="Customer",
                order_code="ENC-2026-0001",
                html_content="<html>Order details</html>"
            )

            assert result is True

    def test_uses_provided_html_content(self):
        """Should use the provided HTML content."""
        with patch('app.services.email.settings') as mock_settings, \
             patch('app.services.email.resend') as mock_resend:
            mock_settings.RESEND_API_KEY = "test_api_key"
            mock_settings.EMAIL_FROM = "test@uniformes.com"

            mock_resend.Emails.send = MagicMock()

            custom_html = "<html><body><h1>Custom Order Receipt</h1></body></html>"

            send_order_confirmation_email(
                email="customer@example.com",
                name="Customer",
                order_code="ENC-001",
                html_content=custom_html
            )

            call_args = mock_resend.Emails.send.call_args
            email_data = call_args[0][0]
            assert email_data["html"] == custom_html


# ============================================================================
# SALE CONFIRMATION EMAIL TESTS
# ============================================================================

class TestSendSaleConfirmationEmail:
    """Tests for send_sale_confirmation_email function."""

    def test_dev_mode_returns_true(self):
        """Should return True in dev mode."""
        with patch('app.services.email.settings') as mock_settings:
            mock_settings.RESEND_API_KEY = None

            result = send_sale_confirmation_email(
                email="buyer@example.com",
                name="Buyer",
                sale_code="VNT-2026-0001",
                html_content="<html>Receipt</html>"
            )

            assert result is True

    def test_includes_sale_code_in_subject(self):
        """Should include sale code in subject."""
        with patch('app.services.email.settings') as mock_settings, \
             patch('app.services.email.resend') as mock_resend:
            mock_settings.RESEND_API_KEY = "test_api_key"
            mock_settings.EMAIL_FROM = "test@uniformes.com"

            mock_resend.Emails.send = MagicMock()

            send_sale_confirmation_email(
                email="buyer@example.com",
                name="Buyer",
                sale_code="VNT-2026-0001",
                html_content="<html></html>"
            )

            call_args = mock_resend.Emails.send.call_args
            email_data = call_args[0][0]
            assert "VNT-2026-0001" in email_data["subject"]
            assert "Recibo" in email_data["subject"]


# ============================================================================
# PASSWORD RESET EMAIL TESTS
# ============================================================================

class TestSendPasswordResetEmail:
    """Tests for send_password_reset_email function."""

    def test_dev_mode_returns_true(self):
        """Should return True in dev mode."""
        with patch('app.services.email.settings') as mock_settings:
            mock_settings.RESEND_API_KEY = None

            result = send_password_reset_email(
                email="reset@example.com",
                code="RESET123",
                name="Reset User"
            )

            assert result is True

    def test_includes_reset_code(self):
        """Should include reset code in email."""
        with patch('app.services.email.settings') as mock_settings, \
             patch('app.services.email.resend') as mock_resend:
            mock_settings.RESEND_API_KEY = "test_api_key"
            mock_settings.EMAIL_FROM = "test@uniformes.com"

            mock_resend.Emails.send = MagicMock()

            send_password_reset_email(
                email="user@example.com",
                code="ABC123",
                name="Test User"
            )

            call_args = mock_resend.Emails.send.call_args
            email_data = call_args[0][0]
            assert "ABC123" in email_data["html"]

    def test_mentions_expiration(self):
        """Should mention code expiration."""
        with patch('app.services.email.settings') as mock_settings, \
             patch('app.services.email.resend') as mock_resend:
            mock_settings.RESEND_API_KEY = "test_api_key"
            mock_settings.EMAIL_FROM = "test@uniformes.com"

            mock_resend.Emails.send = MagicMock()

            send_password_reset_email(
                email="user@example.com",
                code="123456",
                name="User"
            )

            call_args = mock_resend.Emails.send.call_args
            email_data = call_args[0][0]
            assert "15 minutos" in email_data["html"]


# ============================================================================
# ACTIVATION EMAIL TESTS
# ============================================================================

class TestSendActivationEmail:
    """Tests for send_activation_email function."""

    def test_dev_mode_returns_true(self):
        """Should return True in dev mode."""
        with patch('app.services.email.settings') as mock_settings:
            mock_settings.RESEND_API_KEY = None
            mock_settings.FRONTEND_URL = "https://test.com"

            result = send_activation_email(
                email="new@example.com",
                token="activation_token",
                name="New Client"
            )

            assert result is True

    def test_includes_activation_link(self):
        """Should include activation link with token."""
        with patch('app.services.email.settings') as mock_settings, \
             patch('app.services.email.resend') as mock_resend:
            mock_settings.RESEND_API_KEY = "test_api_key"
            mock_settings.EMAIL_FROM = "test@uniformes.com"
            mock_settings.FRONTEND_URL = "https://uniformes.com"

            mock_resend.Emails.send = MagicMock()

            send_activation_email(
                email="client@example.com",
                token="my_token_123",
                name="Client"
            )

            call_args = mock_resend.Emails.send.call_args
            email_data = call_args[0][0]
            assert "activar-cuenta/my_token_123" in email_data["html"]
