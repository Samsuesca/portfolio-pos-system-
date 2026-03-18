"""
Tests for Delivery Zones API endpoints.

Tests cover:
- Public zone listing (no auth)
- Admin zone CRUD (auth required, superuser for write ops)
- Zone detail retrieval
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
)

pytestmark = pytest.mark.api

NEEDS_ISOLATION_FIX = pytest.mark.skip(reason="DB isolation issue")


# ============================================================================
# PUBLIC ENDPOINTS
# ============================================================================

class TestPublicZones:
    """Tests for GET /api/v1/delivery-zones/public"""

    async def test_list_public_zones_no_auth(self, api_client):
        """Public endpoint should work without auth."""
        response = await api_client.get("/api/v1/delivery-zones/public")
        data = assert_success_response(response)
        assert isinstance(data, list)

    async def test_public_zones_only_active(self, api_client):
        """Public endpoint returns only active zones."""
        response = await api_client.get("/api/v1/delivery-zones/public")
        data = assert_success_response(response)
        # All returned zones should be active (if any)
        for zone in data:
            assert zone.get("is_active", True) is True


# ============================================================================
# ADMIN LISTING
# ============================================================================

class TestAdminZoneListing:
    """Tests for GET /api/v1/delivery-zones"""

    async def test_list_zones_requires_auth(self, api_client):
        """Non-authenticated users cannot list admin zones."""
        response = await api_client.get("/api/v1/delivery-zones")
        assert_unauthorized(response)

    async def test_list_zones_success(
        self, api_client, auth_headers
    ):
        """Authenticated users can list zones."""
        response = await api_client.get(
            "/api/v1/delivery-zones",
            headers=auth_headers,
        )
        data = assert_success_response(response)
        assert isinstance(data, list)

    async def test_list_zones_include_inactive(
        self, api_client, auth_headers
    ):
        """Should support include_inactive param."""
        response = await api_client.get(
            "/api/v1/delivery-zones?include_inactive=true",
            headers=auth_headers,
        )
        data = assert_success_response(response)
        assert isinstance(data, list)


# ============================================================================
# ZONE CREATION (SUPERUSER)
# ============================================================================

class TestZoneCreation:
    """Tests for POST /api/v1/delivery-zones"""

    async def test_create_zone_requires_auth(self, api_client):
        """Non-authenticated users cannot create zones."""
        response = await api_client.post(
            "/api/v1/delivery-zones",
            json={"name": "Test Zone", "fee": 5000},
        )
        assert_unauthorized(response)

    async def test_create_zone_regular_user_forbidden(
        self, api_client, auth_headers
    ):
        """Regular users cannot create zones."""
        response = await api_client.post(
            "/api/v1/delivery-zones",
            headers=auth_headers,
            json={"name": "Test Zone", "fee": 5000},
        )
        assert_forbidden(response)

    @NEEDS_ISOLATION_FIX
    async def test_create_zone_success(
        self, api_client, superuser_headers
    ):
        """Superuser can create a delivery zone."""
        response = await api_client.post(
            "/api/v1/delivery-zones",
            headers=superuser_headers,
            json={
                "name": "Zona Norte",
                "fee": 8000,
                "description": "Envíos al norte de la ciudad",
                "is_active": True,
            },
        )
        data = assert_created_response(response)
        assert data["name"] == "Zona Norte"
        assert data["fee"] == 8000
        assert "id" in data


# ============================================================================
# ZONE DETAIL
# ============================================================================

class TestZoneDetail:
    """Tests for GET /api/v1/delivery-zones/{id}"""

    async def test_get_zone_requires_auth(self, api_client):
        """Non-authenticated users cannot get zone details."""
        response = await api_client.get(
            f"/api/v1/delivery-zones/{uuid4()}"
        )
        assert_unauthorized(response)

    async def test_get_zone_not_found(
        self, api_client, auth_headers
    ):
        """Non-existent zone returns 404."""
        response = await api_client.get(
            f"/api/v1/delivery-zones/{uuid4()}",
            headers=auth_headers,
        )
        assert_not_found(response)


# ============================================================================
# ZONE UPDATE (SUPERUSER)
# ============================================================================

class TestZoneUpdate:
    """Tests for PATCH /api/v1/delivery-zones/{id}"""

    async def test_update_zone_requires_superuser(
        self, api_client, auth_headers
    ):
        """Regular users cannot update zones."""
        response = await api_client.patch(
            f"/api/v1/delivery-zones/{uuid4()}",
            headers=auth_headers,
            json={"name": "Updated Zone"},
        )
        assert_forbidden(response)

    async def test_update_zone_not_found(
        self, api_client, superuser_headers
    ):
        """Updating non-existent zone returns 404."""
        response = await api_client.patch(
            f"/api/v1/delivery-zones/{uuid4()}",
            headers=superuser_headers,
            json={"name": "Ghost Zone"},
        )
        assert_not_found(response)


# ============================================================================
# ZONE DELETION (SUPERUSER)
# ============================================================================

class TestZoneDeletion:
    """Tests for DELETE /api/v1/delivery-zones/{id}"""

    async def test_delete_zone_requires_superuser(
        self, api_client, auth_headers
    ):
        """Regular users cannot delete zones."""
        response = await api_client.delete(
            f"/api/v1/delivery-zones/{uuid4()}",
            headers=auth_headers,
        )
        assert_forbidden(response)

    async def test_delete_zone_not_found(
        self, api_client, superuser_headers
    ):
        """Deleting non-existent zone returns 404."""
        response = await api_client.delete(
            f"/api/v1/delivery-zones/{uuid4()}",
            headers=superuser_headers,
        )
        assert_not_found(response)
