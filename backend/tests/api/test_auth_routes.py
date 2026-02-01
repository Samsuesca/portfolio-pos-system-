"""
Tests for Authentication API endpoints.

Tests cover:
- Login with username/password
- Token validation
- Get current user info
- Password change
- Error handling for invalid credentials
"""
import pytest
from uuid import uuid4

from tests.fixtures.assertions import (
    assert_success_response,
    assert_unauthorized,
    assert_bad_request,
    assert_token_response,
    assert_jwt_structure,
)
from tests.fixtures.builders import build_login_request


pytestmark = pytest.mark.api


# ============================================================================
# LOGIN TESTS
# ============================================================================

class TestLogin:
    """Tests for POST /api/v1/auth/login"""

    async def test_login_success_with_username(self, api_client, test_user):
        """Should return JWT token on valid username/password."""
        response = await api_client.post(
            "/api/v1/auth/login",
            json=build_login_request(
                username=test_user.username,
                password="TestPassword123!"
            )
        )

        data = assert_success_response(response)

        # Verify token structure
        assert "token" in data
        token_data = data["token"]
        access_token = assert_token_response(token_data)
        assert_jwt_structure(access_token)

        # Verify user data
        assert "user" in data
        user = data["user"]
        assert user["username"] == test_user.username
        assert user["email"] == test_user.email
        assert user["is_active"] is True

    async def test_login_success_with_email(self, api_client, test_user):
        """Should accept email as username for login."""
        response = await api_client.post(
            "/api/v1/auth/login",
            json=build_login_request(
                username=test_user.email,
                password="TestPassword123!"
            )
        )

        data = assert_success_response(response)
        assert "token" in data
        assert "user" in data

    async def test_login_invalid_password(self, api_client, test_user):
        """Should return 401 on wrong password."""
        response = await api_client.post(
            "/api/v1/auth/login",
            json=build_login_request(
                username=test_user.username,
                password="WrongPassword123!"
            )
        )

        assert_unauthorized(response, detail_contains="Incorrect")

    async def test_login_user_not_found(self, api_client):
        """Should return 401 on non-existent user."""
        response = await api_client.post(
            "/api/v1/auth/login",
            json=build_login_request(
                username="nonexistent",
                password="AnyPassword123!"
            )
        )

        assert_unauthorized(response, detail_contains="Incorrect")

    async def test_login_inactive_user(self, api_client, db_session):
        """Should return 401 for inactive users."""
        from app.models.user import User
        from app.services.user import UserService

        # Create inactive user
        inactive_user = User(
            id=str(uuid4()),
            username="inactive",
            email="inactive@test.com",
            hashed_password=UserService.hash_password("Password123!"),
            is_active=False
        )
        db_session.add(inactive_user)
        await db_session.flush()

        response = await api_client.post(
            "/api/v1/auth/login",
            json=build_login_request(
                username="inactive",
                password="Password123!"
            )
        )

        # Inactive users should fail authentication
        assert_unauthorized(response)

    async def test_login_missing_username(self, api_client):
        """Should return 400 when username is missing (custom validation handler)."""
        response = await api_client.post(
            "/api/v1/auth/login",
            json={"password": "Password123!"}
        )

        # Custom handler converts validation errors to 400
        assert response.status_code == 400

    async def test_login_missing_password(self, api_client):
        """Should return 400 when password is missing (custom validation handler)."""
        response = await api_client.post(
            "/api/v1/auth/login",
            json={"username": "testuser"}
        )

        # Custom handler converts validation errors to 400
        assert response.status_code == 400

    async def test_login_empty_credentials(self, api_client):
        """Should reject empty credentials."""
        response = await api_client.post(
            "/api/v1/auth/login",
            json={"username": "", "password": ""}
        )

        # API may return 401 (unauthorized) or 422 (validation error)
        assert response.status_code in [401, 422]

    async def test_login_returns_school_roles(
        self,
        api_client,
        test_user_with_school_role
    ):
        """Should return user's school roles on successful login."""
        user, school = test_user_with_school_role

        response = await api_client.post(
            "/api/v1/auth/login",
            json=build_login_request(
                username=user.username,
                password="TestPassword123!"
            )
        )

        data = assert_success_response(response)
        user_data = data["user"]

        assert "school_roles" in user_data
        assert len(user_data["school_roles"]) >= 1

        # Find the role for our test school
        school_role = next(
            (r for r in user_data["school_roles"]
             if r["school_id"] == str(school.id)),
            None
        )
        assert school_role is not None
        assert school_role["role"] == "admin"


# ============================================================================
# TOKEN VALIDATION TESTS
# ============================================================================

class TestTokenValidation:
    """Tests for JWT token validation."""

    async def test_access_with_valid_token(self, api_client, auth_headers, test_user):
        """Should allow access with valid token."""
        response = await api_client.get(
            "/api/v1/auth/me",
            headers=auth_headers
        )

        data = assert_success_response(response)
        assert data["username"] == test_user.username

    async def test_access_without_token(self, api_client):
        """Should return 401 without token."""
        response = await api_client.get("/api/v1/auth/me")

        # FastAPI returns 403 for missing Bearer token
        assert response.status_code in [401, 403]

    async def test_access_with_invalid_token(self, api_client):
        """Should return 401 with malformed token."""
        response = await api_client.get(
            "/api/v1/auth/me",
            headers={"Authorization": "Bearer invalid.token.here"}
        )

        assert_unauthorized(response)

    async def test_access_with_expired_token(self, api_client, test_user):
        """Should return 401 with expired token."""
        from app.services.user import UserService
        from app.core.config import settings
        from datetime import timedelta
        from unittest.mock import MagicMock, patch

        # Create token with -1 hour expiration (already expired)
        mock_db = MagicMock()
        user_service = UserService(mock_db)

        # Patch settings to use very short expiration
        with patch.object(
            settings,
            'ACCESS_TOKEN_EXPIRE_MINUTES',
            -60  # Negative = already expired
        ):
            token = user_service.create_access_token(
                user_id=test_user.id,
                username=test_user.username
            )

        response = await api_client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {token.access_token}"}
        )

        assert_unauthorized(response)

    async def test_access_with_wrong_bearer_format(self, api_client):
        """Should return error for wrong authorization format."""
        response = await api_client.get(
            "/api/v1/auth/me",
            headers={"Authorization": "Basic sometoken"}
        )

        # Should fail - wrong auth scheme
        assert response.status_code in [401, 403]


# ============================================================================
# GET CURRENT USER TESTS
# ============================================================================

class TestGetCurrentUser:
    """Tests for GET /api/v1/auth/me"""

    async def test_get_current_user_success(
        self,
        api_client,
        auth_headers,
        test_user
    ):
        """Should return current user information."""
        response = await api_client.get(
            "/api/v1/auth/me",
            headers=auth_headers
        )

        data = assert_success_response(response)

        assert data["id"] == str(test_user.id)
        assert data["username"] == test_user.username
        assert data["email"] == test_user.email
        assert data["is_active"] is True
        assert "hashed_password" not in data  # Should not expose password

    async def test_get_current_user_superuser(
        self,
        api_client,
        superuser_headers,
        test_superuser
    ):
        """Should return superuser information."""
        response = await api_client.get(
            "/api/v1/auth/me",
            headers=superuser_headers
        )

        data = assert_success_response(response)

        assert data["is_superuser"] is True


# ============================================================================
# CHANGE PASSWORD TESTS
# ============================================================================

class TestChangePassword:
    """Tests for POST /api/v1/auth/change-password"""

    async def test_change_password_success(
        self,
        api_client,
        auth_headers,
        test_user
    ):
        """Should change password successfully."""
        response = await api_client.post(
            "/api/v1/auth/change-password",
            headers=auth_headers,
            json={
                "old_password": "TestPassword123!",
                "new_password": "NewPassword456!"
            }
        )

        data = assert_success_response(response)
        assert "message" in data
        assert "success" in data["message"].lower()

    async def test_change_password_wrong_current(
        self,
        api_client,
        auth_headers
    ):
        """Should fail with wrong current password."""
        response = await api_client.post(
            "/api/v1/auth/change-password",
            headers=auth_headers,
            json={
                "old_password": "WrongCurrentPassword!",
                "new_password": "NewPassword456!"
            }
        )

        assert_bad_request(response)

    async def test_change_password_no_auth(self, api_client):
        """Should require authentication."""
        response = await api_client.post(
            "/api/v1/auth/change-password",
            json={
                "old_password": "OldPassword123!",
                "new_password": "NewPassword456!"
            }
        )

        assert response.status_code in [401, 403]

    async def test_change_password_same_as_current(
        self,
        api_client,
        auth_headers
    ):
        """Should handle same password case (API may accept or reject)."""
        response = await api_client.post(
            "/api/v1/auth/change-password",
            headers=auth_headers,
            json={
                "old_password": "TestPassword123!",
                "new_password": "TestPassword123!"  # Same password
            }
        )

        # API may accept (200) or reject (400/422) same password
        assert response.status_code in [200, 400, 422]

    async def test_change_password_weak_new_password(
        self,
        api_client,
        auth_headers
    ):
        """Should reject weak new password."""
        response = await api_client.post(
            "/api/v1/auth/change-password",
            headers=auth_headers,
            json={
                "old_password": "TestPassword123!",
                "new_password": "123"  # Too weak
            }
        )

        # Should fail validation
        assert response.status_code in [400, 422]


# ============================================================================
# EDGE CASES AND SECURITY TESTS
# ============================================================================

class TestAuthSecurity:
    """Security-related authentication tests."""

    async def test_password_not_in_response(
        self,
        api_client,
        auth_headers
    ):
        """Password should never be exposed in responses."""
        response = await api_client.get(
            "/api/v1/auth/me",
            headers=auth_headers
        )

        data = assert_success_response(response)

        # Check no password fields are exposed
        assert "password" not in data
        assert "hashed_password" not in data
        assert "password_hash" not in data

    async def test_token_contains_user_id(self, api_client, test_user):
        """Token should contain user ID claim."""
        response = await api_client.post(
            "/api/v1/auth/login",
            json=build_login_request(
                username=test_user.username,
                password="TestPassword123!"
            )
        )

        data = assert_success_response(response)
        token = data["token"]["access_token"]

        # Decode token to verify claims
        from jose import jwt
        from app.core.config import settings

        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=["HS256"]
        )

        assert "sub" in payload  # Subject claim
        assert payload["sub"] == str(test_user.id)

    async def test_sql_injection_prevention(self, api_client):
        """Should handle SQL injection attempts safely."""
        # Attempt SQL injection in username
        response = await api_client.post(
            "/api/v1/auth/login",
            json=build_login_request(
                username="admin'; DROP TABLE users; --",
                password="password"
            )
        )

        # Should fail safely without error
        assert_unauthorized(response)

    async def test_xss_in_login_handled(self, api_client):
        """Should handle XSS attempts in login."""
        response = await api_client.post(
            "/api/v1/auth/login",
            json=build_login_request(
                username="<script>alert('xss')</script>",
                password="password"
            )
        )

        # Should fail safely
        assert_unauthorized(response)
