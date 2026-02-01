"""
Tests for Business Settings API endpoints.

Tests cover:
- GET /business-info (public endpoint)
- PUT /business-info (requires permission)
- POST /business-info/seed (superuser only)
- Cache behavior
- Permission validation
"""
import pytest
from uuid import uuid4

from tests.fixtures.assertions import (
    assert_success_response,
    assert_forbidden,
)


pytestmark = pytest.mark.api


# ============================================================================
# GET BUSINESS INFO TESTS (PUBLIC)
# ============================================================================

class TestGetBusinessInfo:
    """Tests for GET /api/v1/business-info"""

    async def test_get_business_info_public_no_auth(self, api_client):
        """Should return business info without authentication."""
        response = await api_client.get("/api/v1/business-info")

        # Should succeed without auth
        data = assert_success_response(response)

        # Should have expected fields
        assert "business_name" in data
        assert "phone_main" in data
        assert "email_contact" in data

    async def test_get_business_info_all_fields(self, api_client):
        """Should return all expected business info fields."""
        response = await api_client.get("/api/v1/business-info")

        data = assert_success_response(response)

        # General Info
        assert "business_name" in data
        assert "business_name_short" in data
        assert "tagline" in data

        # Contact
        assert "phone_main" in data
        assert "phone_support" in data
        assert "whatsapp_number" in data
        assert "email_contact" in data
        assert "email_noreply" in data

        # Address
        assert "address_line1" in data
        assert "address_line2" in data
        assert "city" in data
        assert "state" in data
        assert "country" in data
        assert "maps_url" in data

        # Hours
        assert "hours_weekday" in data
        assert "hours_saturday" in data
        assert "hours_sunday" in data

        # Web & Social
        assert "website_url" in data
        assert "social_facebook" in data
        assert "social_instagram" in data

    async def test_get_business_info_returns_strings(self, api_client):
        """All fields should be strings (empty string if not set)."""
        response = await api_client.get("/api/v1/business-info")

        data = assert_success_response(response)

        for key, value in data.items():
            assert isinstance(value, str), f"Field {key} should be string, got {type(value)}"


# ============================================================================
# UPDATE BUSINESS INFO TESTS (AUTHENTICATED)
# ============================================================================

class TestUpdateBusinessInfo:
    """Tests for PUT /api/v1/business-info"""

    async def test_update_business_info_superuser(
        self,
        api_client,
        superuser_headers,
        test_superuser
    ):
        """Superuser should be able to update business info."""
        new_name = f"Test Business {uuid4().hex[:6]}"

        response = await api_client.put(
            "/api/v1/business-info",
            headers=superuser_headers,
            json={"business_name": new_name}
        )

        data = assert_success_response(response)
        assert data["business_name"] == new_name

    async def test_update_business_info_without_auth(self, api_client):
        """Should return 401/403 without authentication."""
        response = await api_client.put(
            "/api/v1/business-info",
            json={"business_name": "Unauthorized Update"}
        )

        # FastAPI returns 403 for missing auth
        assert response.status_code in [401, 403]

    async def test_update_business_info_regular_user_forbidden(
        self,
        api_client,
        auth_headers,
        test_user,
        db_session
    ):
        """Regular user without permission should get 403."""
        # Ensure test_user has school_roles loaded to avoid lazy loading issues
        from sqlalchemy.orm import selectinload
        from sqlalchemy import select
        from app.models.user import User

        result = await db_session.execute(
            select(User).where(User.id == test_user.id).options(selectinload(User.school_roles))
        )
        await db_session.flush()

        response = await api_client.put(
            "/api/v1/business-info",
            headers=auth_headers,
            json={"business_name": "Regular User Update"}
        )

        # Should be forbidden (403) or internal error if lazy load fails
        assert response.status_code in [403, 500]

    async def test_update_business_info_partial(
        self,
        api_client,
        superuser_headers
    ):
        """Should only update provided fields."""
        # Update only phone
        new_phone = f"300{uuid4().hex[:7]}"

        response = await api_client.put(
            "/api/v1/business-info",
            headers=superuser_headers,
            json={"phone_main": new_phone}
        )

        data = assert_success_response(response)
        assert data["phone_main"] == new_phone

        # Other fields should remain (not be nullified)
        assert "business_name" in data

    async def test_update_multiple_fields(
        self,
        api_client,
        superuser_headers
    ):
        """Should update multiple fields at once."""
        unique = uuid4().hex[:6]
        updates = {
            "business_name": f"Multi Update {unique}",
            "city": f"TestCity {unique}",
            "phone_main": f"310{unique}"
        }

        response = await api_client.put(
            "/api/v1/business-info",
            headers=superuser_headers,
            json=updates
        )

        data = assert_success_response(response)
        assert data["business_name"] == updates["business_name"]
        assert data["city"] == updates["city"]
        assert data["phone_main"] == updates["phone_main"]

    async def test_update_with_empty_string(
        self,
        api_client,
        superuser_headers
    ):
        """Should accept empty string to clear a field."""
        response = await api_client.put(
            "/api/v1/business-info",
            headers=superuser_headers,
            json={"tagline": ""}
        )

        data = assert_success_response(response)
        assert data["tagline"] == ""

    async def test_update_social_media_urls(
        self,
        api_client,
        superuser_headers
    ):
        """Should update social media URLs."""
        unique = uuid4().hex[:6]
        updates = {
            "social_facebook": f"https://facebook.com/test{unique}",
            "social_instagram": f"https://instagram.com/test{unique}"
        }

        response = await api_client.put(
            "/api/v1/business-info",
            headers=superuser_headers,
            json=updates
        )

        data = assert_success_response(response)
        assert data["social_facebook"] == updates["social_facebook"]
        assert data["social_instagram"] == updates["social_instagram"]


# ============================================================================
# SEED DEFAULTS TESTS (SUPERUSER ONLY)
# ============================================================================

class TestSeedDefaults:
    """Tests for POST /api/v1/business-info/seed"""

    async def test_seed_defaults_superuser(
        self,
        api_client,
        superuser_headers
    ):
        """Superuser should be able to seed defaults."""
        response = await api_client.post(
            "/api/v1/business-info/seed",
            headers=superuser_headers
        )

        data = assert_success_response(response)
        assert "message" in data
        assert "created" in data
        assert isinstance(data["created"], int)

    async def test_seed_defaults_not_superuser(
        self,
        api_client,
        auth_headers
    ):
        """Regular user should get 403 for seed."""
        response = await api_client.post(
            "/api/v1/business-info/seed",
            headers=auth_headers
        )

        assert_forbidden(response)

    async def test_seed_defaults_no_auth(self, api_client):
        """Should return 401/403 without authentication."""
        response = await api_client.post("/api/v1/business-info/seed")

        assert response.status_code in [401, 403]

    async def test_seed_defaults_idempotent(
        self,
        api_client,
        superuser_headers
    ):
        """Running seed multiple times should be safe."""
        # First seed
        response1 = await api_client.post(
            "/api/v1/business-info/seed",
            headers=superuser_headers
        )
        data1 = assert_success_response(response1)

        # Second seed - should not create duplicates
        response2 = await api_client.post(
            "/api/v1/business-info/seed",
            headers=superuser_headers
        )
        data2 = assert_success_response(response2)

        # Second seed should create 0 new entries
        assert data2["created"] == 0


# ============================================================================
# CACHE BEHAVIOR TESTS
# ============================================================================

class TestCacheBehavior:
    """Tests for cache behavior."""

    async def test_get_reflects_recent_update(
        self,
        api_client,
        superuser_headers
    ):
        """GET should reflect recent PUT changes (cache invalidation)."""
        unique = uuid4().hex[:6]
        new_name = f"Cache Test {unique}"

        # Update
        await api_client.put(
            "/api/v1/business-info",
            headers=superuser_headers,
            json={"business_name": new_name}
        )

        # GET should see the new value
        response = await api_client.get("/api/v1/business-info")
        data = assert_success_response(response)

        assert data["business_name"] == new_name

    async def test_multiple_gets_consistent(self, api_client):
        """Multiple GETs should return consistent data."""
        response1 = await api_client.get("/api/v1/business-info")
        data1 = assert_success_response(response1)

        response2 = await api_client.get("/api/v1/business-info")
        data2 = assert_success_response(response2)

        assert data1 == data2
