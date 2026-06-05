"""
Unit tests for GoogleAuthService.

Tests cover token verification, audience validation, email verification,
error handling, and behavior when google-auth library is unavailable.
"""
import pytest
import sys
from unittest.mock import MagicMock, patch

import app.services.google_auth as google_auth_module

pytestmark = pytest.mark.unit


@pytest.fixture
def mock_settings():
    settings = MagicMock()
    settings.google_client_ids = [
        "web-client-id.apps.googleusercontent.com",
        "ios-client-id.apps.googleusercontent.com",
    ]
    return settings


@pytest.fixture
def valid_idinfo():
    return {
        "sub": "google-user-id-123",
        "email": "carlos@gmail.com",
        "name": "Carlos Rodriguez",
        "given_name": "Carlos",
        "family_name": "Rodriguez",
        "picture": "https://lh3.googleusercontent.com/photo.jpg",
        "email_verified": True,
        "aud": "web-client-id.apps.googleusercontent.com",
    }


@pytest.fixture
def _enable_google(monkeypatch):
    """Inject mock google modules so GoogleAuthService.__init__ works."""
    mock_id_token_mod = MagicMock()
    mock_requests_mod = MagicMock()
    monkeypatch.setattr(google_auth_module, "_GOOGLE_AVAILABLE", True)
    monkeypatch.setattr(google_auth_module, "id_token", mock_id_token_mod, raising=False)
    monkeypatch.setattr(google_auth_module, "google_requests", mock_requests_mod, raising=False)
    return mock_id_token_mod, mock_requests_mod


class TestGoogleAuthServiceInit:
    def test_init_with_google_available(self, _enable_google, mock_settings):
        service = google_auth_module.GoogleAuthService(mock_settings)
        assert service._client_ids == mock_settings.google_client_ids
        assert service._request is not None

    def test_init_without_google_available(self, monkeypatch, mock_settings):
        monkeypatch.setattr(google_auth_module, "_GOOGLE_AVAILABLE", False)
        service = google_auth_module.GoogleAuthService(mock_settings)
        assert service._client_ids == []
        assert service._request is None


class TestVerifyIdToken:
    def test_valid_token_returns_user_info(
        self, _enable_google, mock_settings, valid_idinfo
    ):
        mock_id_token_mod, _ = _enable_google
        mock_id_token_mod.verify_oauth2_token.return_value = valid_idinfo

        service = google_auth_module.GoogleAuthService(mock_settings)
        result = service.verify_id_token("valid-token-string")

        assert result is not None
        assert result["sub"] == "google-user-id-123"
        assert result["email"] == "carlos@gmail.com"
        assert result["name"] == "Carlos Rodriguez"
        assert result["email_verified"] is True

    def test_valid_token_minimal_fields(self, _enable_google, mock_settings):
        mock_id_token_mod, _ = _enable_google
        idinfo = {
            "sub": "uid-456",
            "email": "ana@gmail.com",
            "email_verified": True,
            "aud": "web-client-id.apps.googleusercontent.com",
        }
        mock_id_token_mod.verify_oauth2_token.return_value = idinfo

        service = google_auth_module.GoogleAuthService(mock_settings)
        result = service.verify_id_token("token")

        assert result["sub"] == "uid-456"
        assert result["name"] == ""
        assert result["given_name"] == ""
        assert result["family_name"] == ""
        assert result["picture"] is None

    def test_invalid_audience_returns_none(
        self, _enable_google, mock_settings, valid_idinfo
    ):
        mock_id_token_mod, _ = _enable_google
        valid_idinfo["aud"] = "attacker-client-id.apps.googleusercontent.com"
        mock_id_token_mod.verify_oauth2_token.return_value = valid_idinfo

        service = google_auth_module.GoogleAuthService(mock_settings)
        result = service.verify_id_token("token-with-wrong-aud")
        assert result is None

    def test_unverified_email_returns_none(
        self, _enable_google, mock_settings, valid_idinfo
    ):
        mock_id_token_mod, _ = _enable_google
        valid_idinfo["email_verified"] = False
        mock_id_token_mod.verify_oauth2_token.return_value = valid_idinfo

        service = google_auth_module.GoogleAuthService(mock_settings)
        result = service.verify_id_token("token-unverified-email")
        assert result is None

    def test_missing_email_verified_field_returns_none(
        self, _enable_google, mock_settings, valid_idinfo
    ):
        mock_id_token_mod, _ = _enable_google
        del valid_idinfo["email_verified"]
        mock_id_token_mod.verify_oauth2_token.return_value = valid_idinfo

        service = google_auth_module.GoogleAuthService(mock_settings)
        result = service.verify_id_token("token")
        assert result is None

    def test_value_error_from_google_lib_returns_none(
        self, _enable_google, mock_settings
    ):
        mock_id_token_mod, _ = _enable_google
        mock_id_token_mod.verify_oauth2_token.side_effect = ValueError("Token expired")

        service = google_auth_module.GoogleAuthService(mock_settings)
        result = service.verify_id_token("expired-token")
        assert result is None

    def test_google_not_available_returns_none(self, monkeypatch, mock_settings):
        monkeypatch.setattr(google_auth_module, "_GOOGLE_AVAILABLE", False)
        service = google_auth_module.GoogleAuthService(mock_settings)
        result = service.verify_id_token("any-token")
        assert result is None

    def test_no_client_ids_configured_returns_none(self, _enable_google):
        settings = MagicMock()
        settings.google_client_ids = []
        service = google_auth_module.GoogleAuthService(settings)
        result = service.verify_id_token("token")
        assert result is None

    def test_ios_client_id_accepted(
        self, _enable_google, mock_settings, valid_idinfo
    ):
        mock_id_token_mod, _ = _enable_google
        valid_idinfo["aud"] = "ios-client-id.apps.googleusercontent.com"
        mock_id_token_mod.verify_oauth2_token.return_value = valid_idinfo

        service = google_auth_module.GoogleAuthService(mock_settings)
        result = service.verify_id_token("ios-token")
        assert result is not None
        assert result["email"] == "carlos@gmail.com"

    def test_missing_aud_in_idinfo_returns_none(
        self, _enable_google, mock_settings
    ):
        mock_id_token_mod, _ = _enable_google
        idinfo = {"sub": "uid", "email": "test@test.com", "email_verified": True}
        mock_id_token_mod.verify_oauth2_token.return_value = idinfo

        service = google_auth_module.GoogleAuthService(mock_settings)
        result = service.verify_id_token("token-no-aud")
        assert result is None
