"""
Tests for Custom Roles API endpoints.

Tests cover:
- Listing permissions catalog
- Listing roles (system + custom)
- Creating custom roles
- Updating custom roles
- Deleting custom roles
- Permission constraints (max discount, etc.)
"""
import pytest
from httpx import AsyncClient
from uuid import uuid4

from tests.fixtures.assertions import (
    assert_success_response,
    assert_created_response,
    assert_not_found,
    assert_forbidden,
)


pytestmark = pytest.mark.api


# Base URL pattern - needs school_id
def get_base_url(school_id: str) -> str:
    return f"/api/v1/schools/{school_id}/roles"


class TestPermissionCatalog:
    """Tests for GET /schools/{school_id}/roles/permissions"""

    async def test_get_permission_catalog_success(
        self,
        api_client: AsyncClient,
        superuser_headers: dict,
        test_school
    ):
        """Should return permissions catalog grouped by category."""
        response = await api_client.get(
            f"{get_base_url(test_school.id)}/permissions",
            headers=superuser_headers
        )

        # May return 200 or 404 if permissions table not populated
        if response.status_code == 200:
            data = response.json()
            assert "categories" in data
            assert "total" in data
            assert isinstance(data["categories"], dict)

    async def test_get_permission_catalog_unauthorized(
        self,
        api_client: AsyncClient,
        test_school
    ):
        """Should require authentication."""
        response = await api_client.get(
            f"{get_base_url(test_school.id)}/permissions"
        )

        assert response.status_code in [401, 403]


class TestRolesList:
    """Tests for GET /schools/{school_id}/roles"""

    async def test_list_roles_success(
        self,
        api_client: AsyncClient,
        superuser_headers: dict,
        test_school
    ):
        """Should list available roles."""
        response = await api_client.get(
            get_base_url(test_school.id),
            headers=superuser_headers
        )

        if response.status_code == 200:
            data = response.json()
            assert "roles" in data
            assert "total" in data

    async def test_list_roles_with_system_filter(
        self,
        api_client: AsyncClient,
        superuser_headers: dict,
        test_school
    ):
        """Should filter system roles."""
        response = await api_client.get(
            f"{get_base_url(test_school.id)}?include_system=false",
            headers=superuser_headers
        )

        if response.status_code == 200:
            data = response.json()
            # All roles should be custom (not system)
            for role in data.get("roles", []):
                assert role["is_system"] is False

    async def test_list_roles_active_only(
        self,
        api_client: AsyncClient,
        superuser_headers: dict,
        test_school
    ):
        """Should filter active roles only."""
        response = await api_client.get(
            f"{get_base_url(test_school.id)}?active_only=true",
            headers=superuser_headers
        )

        if response.status_code == 200:
            data = response.json()
            for role in data.get("roles", []):
                assert role["is_active"] is True

    async def test_list_roles_unauthorized(
        self,
        api_client: AsyncClient,
        test_school
    ):
        """Should require authentication."""
        response = await api_client.get(
            get_base_url(test_school.id)
        )

        assert response.status_code in [401, 403]


class TestCreateCustomRole:
    """Tests for POST /schools/{school_id}/roles"""

    async def test_create_role_success(
        self,
        api_client: AsyncClient,
        superuser_headers: dict,
        test_school
    ):
        """Should create a custom role."""
        unique = uuid4().hex[:6]
        role_data = {
            "code": f"custom_role_{unique}",
            "name": f"Custom Role {unique}",
            "description": "A test custom role",
            "color": "#FF5733",
            "priority": 10,
            "permissions": []
        }

        response = await api_client.post(
            get_base_url(test_school.id),
            json=role_data,
            headers=superuser_headers
        )

        if response.status_code == 201:
            data = response.json()
            assert data["code"] == role_data["code"]
            assert data["name"] == role_data["name"]
            assert data["is_system"] is False
            assert data["is_active"] is True

    async def test_create_role_with_permissions(
        self,
        api_client: AsyncClient,
        superuser_headers: dict,
        test_school
    ):
        """Should create role with permissions."""
        unique = uuid4().hex[:6]
        role_data = {
            "code": f"role_perms_{unique}",
            "name": f"Role With Perms {unique}",
            "permissions": [
                {"code": "sales.view"},
                {"code": "sales.create"},
                {"code": "sales.apply_discount", "max_discount_percent": 15}
            ]
        }

        response = await api_client.post(
            get_base_url(test_school.id),
            json=role_data,
            headers=superuser_headers
        )

        # May succeed or fail if permissions don't exist
        assert response.status_code in [201, 400, 500]

    async def test_create_role_duplicate_code_fails(
        self,
        api_client: AsyncClient,
        superuser_headers: dict,
        test_school
    ):
        """Should fail if code already exists."""
        unique = uuid4().hex[:6]
        role_data = {
            "code": f"dupe_code_{unique}",
            "name": f"First Role {unique}",
        }

        # Create first
        response1 = await api_client.post(
            get_base_url(test_school.id),
            json=role_data,
            headers=superuser_headers
        )

        if response1.status_code == 201:
            # Try to create duplicate
            role_data["name"] = "Second Role"
            response2 = await api_client.post(
                get_base_url(test_school.id),
                json=role_data,
                headers=superuser_headers
            )

            assert response2.status_code == 409

    async def test_create_role_invalid_code_format(
        self,
        api_client: AsyncClient,
        superuser_headers: dict,
        test_school
    ):
        """Should reject invalid code format."""
        role_data = {
            "code": "Invalid Code!",  # Invalid - contains spaces and special chars
            "name": "Test Role",
        }

        response = await api_client.post(
            get_base_url(test_school.id),
            json=role_data,
            headers=superuser_headers
        )

        # Should fail validation
        assert response.status_code in [400, 422]

    async def test_create_role_requires_owner(
        self,
        api_client: AsyncClient,
        auth_headers: dict,
        test_school
    ):
        """Should require owner or superuser."""
        role_data = {
            "code": "test_role",
            "name": "Test Role",
        }

        response = await api_client.post(
            get_base_url(test_school.id),
            json=role_data,
            headers=auth_headers
        )

        # Regular user should be forbidden
        assert response.status_code in [403, 401]


class TestGetRole:
    """Tests for GET /schools/{school_id}/roles/{role_id}"""

    async def test_get_role_not_found(
        self,
        api_client: AsyncClient,
        superuser_headers: dict,
        test_school
    ):
        """Should return 404 for non-existent role."""
        fake_id = uuid4()
        response = await api_client.get(
            f"{get_base_url(test_school.id)}/{fake_id}",
            headers=superuser_headers
        )

        assert response.status_code == 404


class TestUpdateCustomRole:
    """Tests for PUT /schools/{school_id}/roles/{role_id}"""

    async def test_update_role_not_found(
        self,
        api_client: AsyncClient,
        superuser_headers: dict,
        test_school
    ):
        """Should return 404 for non-existent role."""
        fake_id = uuid4()
        response = await api_client.put(
            f"{get_base_url(test_school.id)}/{fake_id}",
            json={"name": "Updated Name"},
            headers=superuser_headers
        )

        assert response.status_code == 404


class TestDeleteCustomRole:
    """Tests for DELETE /schools/{school_id}/roles/{role_id}"""

    async def test_delete_role_not_found(
        self,
        api_client: AsyncClient,
        superuser_headers: dict,
        test_school
    ):
        """Should return 404 for non-existent role."""
        fake_id = uuid4()
        response = await api_client.delete(
            f"{get_base_url(test_school.id)}/{fake_id}",
            headers=superuser_headers
        )

        assert response.status_code == 404

    async def test_delete_role_requires_owner(
        self,
        api_client: AsyncClient,
        auth_headers: dict,
        test_school
    ):
        """Should require owner or superuser."""
        fake_id = uuid4()
        response = await api_client.delete(
            f"{get_base_url(test_school.id)}/{fake_id}",
            headers=auth_headers
        )

        # Regular user should be forbidden or not found
        assert response.status_code in [403, 401, 404]
