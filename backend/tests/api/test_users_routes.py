"""
Tests for Users API endpoints.

Tests cover:
- User CRUD (superuser only for create/list/delete)
- User profile (own profile access)
- User-school role management
- Admin user management (password reset, email change, superuser toggle)
"""
import pytest
from uuid import uuid4

from tests.fixtures.assertions import (
    assert_success_response,
    assert_created_response,
    assert_no_content_response,
    assert_unauthorized,
    assert_forbidden,
    assert_not_found,
    assert_bad_request,
)
from tests.fixtures.builders import build_user_request

pytestmark = pytest.mark.api

NEEDS_ISOLATION_FIX = pytest.mark.skip(reason="DB isolation issue")


# ============================================================================
# USER LISTING (SUPERUSER)
# ============================================================================

class TestUserListing:
    """Tests for GET /api/v1/users"""

    async def test_list_users_requires_auth(self, api_client):
        """Non-authenticated users cannot list users."""
        response = await api_client.get("/api/v1/users")
        assert_unauthorized(response)

    async def test_list_users_regular_user_forbidden(
        self, api_client, auth_headers
    ):
        """Regular users cannot list all users."""
        response = await api_client.get(
            "/api/v1/users",
            headers=auth_headers,
        )
        assert_forbidden(response)

    async def test_list_users_superuser_success(
        self, api_client, superuser_headers
    ):
        """Superuser can list all users."""
        response = await api_client.get(
            "/api/v1/users",
            headers=superuser_headers,
        )
        data = assert_success_response(response)
        assert isinstance(data, list)
        assert len(data) >= 1  # At least the superuser itself


# ============================================================================
# USER CREATION (SUPERUSER)
# ============================================================================

class TestUserCreation:
    """Tests for POST /api/v1/users"""

    async def test_create_user_requires_auth(self, api_client):
        """Non-authenticated users cannot create users."""
        response = await api_client.post(
            "/api/v1/users",
            json=build_user_request(full_name="Unauthorized"),
        )
        assert_unauthorized(response)

    async def test_create_user_regular_user_forbidden(
        self, api_client, auth_headers
    ):
        """Regular users cannot create users."""
        response = await api_client.post(
            "/api/v1/users",
            headers=auth_headers,
            json=build_user_request(full_name="Forbidden User"),
        )
        assert_forbidden(response)

    @NEEDS_ISOLATION_FIX
    async def test_create_user_success(
        self, api_client, superuser_headers
    ):
        """Superuser can create a new user."""
        payload = build_user_request(
            full_name="New Test User",
            username="newuser_test",
            email="newuser_test@example.com",
        )
        response = await api_client.post(
            "/api/v1/users",
            headers=superuser_headers,
            json=payload,
        )
        data = assert_created_response(response)
        assert data["full_name"] == "New Test User"
        assert data["username"] == "newuser_test"
        assert "id" in data
        assert "password" not in data  # Password should not be in response


# ============================================================================
# USER DETAIL
# ============================================================================

class TestUserDetail:
    """Tests for GET /api/v1/users/{id}"""

    async def test_get_user_requires_auth(self, api_client):
        """Non-authenticated users cannot get user details."""
        response = await api_client.get(f"/api/v1/users/{uuid4()}")
        assert_unauthorized(response)

    async def test_get_own_profile(
        self, api_client, auth_headers, test_user
    ):
        """Users can view their own profile."""
        response = await api_client.get(
            f"/api/v1/users/{test_user.id}",
            headers=auth_headers,
        )
        data = assert_success_response(response)
        assert data["id"] == str(test_user.id)

    async def test_get_other_user_forbidden(
        self, api_client, auth_headers
    ):
        """Regular users cannot view other users' profiles."""
        response = await api_client.get(
            f"/api/v1/users/{uuid4()}",
            headers=auth_headers,
        )
        # Either 403 or 404 depending on implementation
        assert response.status_code in (403, 404)

    async def test_superuser_can_view_any(
        self, api_client, superuser_headers, test_user
    ):
        """Superuser can view any user's profile."""
        response = await api_client.get(
            f"/api/v1/users/{test_user.id}",
            headers=superuser_headers,
        )
        data = assert_success_response(response)
        assert data["id"] == str(test_user.id)


# ============================================================================
# USER UPDATE
# ============================================================================

class TestUserUpdate:
    """Tests for PUT /api/v1/users/{id}"""

    async def test_update_user_requires_auth(self, api_client):
        """Non-authenticated users cannot update."""
        response = await api_client.put(
            f"/api/v1/users/{uuid4()}",
            json={"full_name": "Hacked"},
        )
        assert_unauthorized(response)

    @NEEDS_ISOLATION_FIX
    async def test_update_own_profile(
        self, api_client, auth_headers, test_user
    ):
        """Users can update their own profile."""
        response = await api_client.put(
            f"/api/v1/users/{test_user.id}",
            headers=auth_headers,
            json={"full_name": "Updated Name"},
        )
        data = assert_success_response(response)
        assert data["full_name"] == "Updated Name"


# ============================================================================
# USER DELETION (SUPERUSER)
# ============================================================================

class TestUserDeletion:
    """Tests for DELETE /api/v1/users/{id}"""

    async def test_delete_user_requires_superuser(
        self, api_client, auth_headers, test_user
    ):
        """Regular users cannot delete users."""
        response = await api_client.delete(
            f"/api/v1/users/{test_user.id}",
            headers=auth_headers,
        )
        assert_forbidden(response)

    async def test_delete_nonexistent_user(
        self, api_client, superuser_headers
    ):
        """Deleting non-existent user returns 404."""
        response = await api_client.delete(
            f"/api/v1/users/{uuid4()}",
            headers=superuser_headers,
        )
        assert_not_found(response)


# ============================================================================
# USER-SCHOOL ROLES (SUPERUSER)
# ============================================================================

class TestUserSchoolRoles:
    """Tests for user-school role management."""

    async def test_add_role_requires_superuser(
        self, api_client, auth_headers, test_user, test_school
    ):
        """Regular users cannot add school roles."""
        response = await api_client.post(
            f"/api/v1/users/{test_user.id}/schools/{test_school.id}/role",
            headers=auth_headers,
            json={"role": "seller"},
        )
        assert_forbidden(response)

    async def test_get_user_schools_requires_auth(self, api_client):
        """Non-authenticated cannot view user schools."""
        response = await api_client.get(
            f"/api/v1/users/{uuid4()}/schools"
        )
        assert_unauthorized(response)

    async def test_get_user_schools_success(
        self, api_client, auth_headers, test_user
    ):
        """User can see their own school assignments."""
        response = await api_client.get(
            f"/api/v1/users/{test_user.id}/schools",
            headers=auth_headers,
        )
        data = assert_success_response(response)
        assert isinstance(data, list)


# ============================================================================
# ADMIN USER MANAGEMENT (SUPERUSER)
# ============================================================================

class TestAdminUserManagement:
    """Tests for admin user operations."""

    async def test_reset_password_requires_superuser(
        self, api_client, auth_headers, test_user
    ):
        """Regular users cannot reset passwords."""
        response = await api_client.post(
            f"/api/v1/users/{test_user.id}/reset-password",
            headers=auth_headers,
            json={"new_password": "NewPass123!"},
        )
        assert_forbidden(response)

    async def test_change_email_requires_superuser(
        self, api_client, auth_headers, test_user
    ):
        """Regular users cannot change other users' emails."""
        response = await api_client.put(
            f"/api/v1/users/{test_user.id}/email",
            headers=auth_headers,
            json={"email": "new@test.com"},
        )
        assert_forbidden(response)

    async def test_set_superuser_requires_superuser(
        self, api_client, auth_headers, test_user
    ):
        """Regular users cannot toggle superuser status."""
        response = await api_client.put(
            f"/api/v1/users/{test_user.id}/superuser",
            headers=auth_headers,
            json={"is_superuser": True},
        )
        assert_forbidden(response)
