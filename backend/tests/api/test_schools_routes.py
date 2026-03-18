"""
Tests for Schools API endpoints.

Tests cover:
- School CRUD (superuser only for create/update/delete)
- School listing (public)
- School search and by-slug lookup
- School summary
- School activation/deactivation
- School reordering
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
from tests.fixtures.builders import build_school_request

pytestmark = pytest.mark.api

NEEDS_ISOLATION_FIX = pytest.mark.skip(reason="DB isolation issue")


# ============================================================================
# SCHOOL LISTING (PUBLIC)
# ============================================================================

class TestSchoolListing:
    """Tests for GET /api/v1/schools"""

    async def test_list_schools_no_auth_required(self, api_client):
        """Listing schools should work without auth."""
        response = await api_client.get("/api/v1/schools")
        data = assert_success_response(response)
        assert isinstance(data, list)

    async def test_list_schools_with_pagination(self, api_client):
        """Should support skip and limit params."""
        response = await api_client.get(
            "/api/v1/schools?skip=0&limit=10"
        )
        data = assert_success_response(response)
        assert isinstance(data, list)
        assert len(data) <= 10

    async def test_list_schools_active_only_default(self, api_client):
        """By default only active schools are returned."""
        response = await api_client.get("/api/v1/schools?active_only=true")
        data = assert_success_response(response)
        assert isinstance(data, list)


# ============================================================================
# SCHOOL DETAIL (PUBLIC)
# ============================================================================

class TestSchoolDetail:
    """Tests for GET /api/v1/schools/{id}"""

    async def test_get_school_not_found(self, api_client):
        """Non-existent school returns 404."""
        response = await api_client.get(f"/api/v1/schools/{uuid4()}")
        assert_not_found(response)

    async def test_get_school_by_id(self, api_client, test_school):
        """Should return school by ID."""
        response = await api_client.get(f"/api/v1/schools/{test_school.id}")
        data = assert_success_response(response)
        assert data["id"] == str(test_school.id)
        assert data["name"] == test_school.name


# ============================================================================
# SCHOOL BY SLUG
# ============================================================================

class TestSchoolBySlug:
    """Tests for GET /api/v1/schools/slug/{slug}"""

    async def test_get_school_by_slug_not_found(self, api_client):
        """Non-existent slug returns 404."""
        response = await api_client.get(
            "/api/v1/schools/slug/non-existent-school"
        )
        assert_not_found(response)

    async def test_get_school_by_slug_success(self, api_client, test_school):
        """Should return school by slug."""
        if not test_school.slug:
            pytest.skip("Test school has no slug")
        response = await api_client.get(
            f"/api/v1/schools/slug/{test_school.slug}"
        )
        data = assert_success_response(response)
        assert data["id"] == str(test_school.id)


# ============================================================================
# SCHOOL SUMMARY
# ============================================================================

class TestSchoolSummary:
    """Tests for GET /api/v1/schools/{id}/summary"""

    async def test_summary_not_found(self, api_client):
        """Non-existent school returns 404."""
        response = await api_client.get(
            f"/api/v1/schools/{uuid4()}/summary"
        )
        assert_not_found(response)

    async def test_summary_success(self, api_client, test_school):
        """Should return school summary."""
        response = await api_client.get(
            f"/api/v1/schools/{test_school.id}/summary"
        )
        data = assert_success_response(response)
        assert isinstance(data, dict)


# ============================================================================
# SCHOOL SEARCH
# ============================================================================

class TestSchoolSearch:
    """Tests for GET /api/v1/schools/search/by-name"""

    async def test_search_schools_empty_query(self, api_client):
        """Search with no/empty name should return 422 (min_length=1)."""
        response = await api_client.get("/api/v1/schools/search/by-name?name=")
        # Empty string fails min_length=1 validation
        assert response.status_code in (400, 422)

    async def test_search_schools_with_term(self, api_client, test_school):
        """Should find schools matching name."""
        # Use first 3 chars of school name
        term = test_school.name[:3]
        response = await api_client.get(
            f"/api/v1/schools/search/by-name?name={term}"
        )
        data = assert_success_response(response)
        assert isinstance(data, list)


# ============================================================================
# SCHOOL CREATION (SUPERUSER)
# ============================================================================

class TestSchoolCreation:
    """Tests for POST /api/v1/schools"""

    async def test_create_school_requires_auth(self, api_client):
        """Non-authenticated users cannot create schools."""
        response = await api_client.post(
            "/api/v1/schools",
            json=build_school_request(name="Unauthorized School"),
        )
        assert_unauthorized(response)

    async def test_create_school_regular_user_forbidden(
        self, api_client, auth_headers
    ):
        """Regular users cannot create schools."""
        response = await api_client.post(
            "/api/v1/schools",
            headers=auth_headers,
            json=build_school_request(name="Forbidden School"),
        )
        assert_forbidden(response)

    @NEEDS_ISOLATION_FIX
    async def test_create_school_success(
        self, api_client, superuser_headers
    ):
        """Superuser can create a school."""
        payload = build_school_request(
            name="New School Test",
            slug="new-school-test",
            address="Calle 1 # 2-3",
            phone="3001234567",
        )
        response = await api_client.post(
            "/api/v1/schools",
            headers=superuser_headers,
            json=payload,
        )
        data = assert_created_response(response)
        assert data["name"] == "New School Test"
        assert "id" in data


# ============================================================================
# SCHOOL UPDATE (SUPERUSER)
# ============================================================================

class TestSchoolUpdate:
    """Tests for PUT /api/v1/schools/{id}"""

    async def test_update_school_requires_superuser(
        self, api_client, auth_headers, test_school
    ):
        """Regular users cannot update schools."""
        response = await api_client.put(
            f"/api/v1/schools/{test_school.id}",
            headers=auth_headers,
            json={"name": "Updated Name"},
        )
        assert_forbidden(response)

    async def test_update_school_not_found(
        self, api_client, superuser_headers
    ):
        """Updating non-existent school returns 404."""
        response = await api_client.put(
            f"/api/v1/schools/{uuid4()}",
            headers=superuser_headers,
            json={"name": "Ghost School"},
        )
        assert_not_found(response)

    @NEEDS_ISOLATION_FIX
    async def test_update_school_success(
        self, api_client, superuser_headers, test_school
    ):
        """Superuser can update a school."""
        response = await api_client.put(
            f"/api/v1/schools/{test_school.id}",
            headers=superuser_headers,
            json={"name": "Updated School Name"},
        )
        data = assert_success_response(response)
        assert data["name"] == "Updated School Name"


# ============================================================================
# SCHOOL DELETE (SUPERUSER)
# ============================================================================

class TestSchoolDeletion:
    """Tests for DELETE /api/v1/schools/{id}"""

    async def test_delete_school_requires_superuser(
        self, api_client, auth_headers, test_school
    ):
        """Regular users cannot delete schools."""
        response = await api_client.delete(
            f"/api/v1/schools/{test_school.id}",
            headers=auth_headers,
        )
        assert_forbidden(response)

    async def test_delete_school_not_found(
        self, api_client, superuser_headers
    ):
        """Deleting non-existent school returns 404."""
        response = await api_client.delete(
            f"/api/v1/schools/{uuid4()}",
            headers=superuser_headers,
        )
        assert_not_found(response)


# ============================================================================
# SCHOOL ACTIVATION (SUPERUSER)
# ============================================================================

class TestSchoolActivation:
    """Tests for POST /api/v1/schools/{id}/activate"""

    async def test_activate_requires_superuser(
        self, api_client, auth_headers, test_school
    ):
        """Regular users cannot activate schools."""
        response = await api_client.post(
            f"/api/v1/schools/{test_school.id}/activate",
            headers=auth_headers,
        )
        assert_forbidden(response)

    async def test_activate_not_found(
        self, api_client, superuser_headers
    ):
        """Activating non-existent school returns 404."""
        response = await api_client.post(
            f"/api/v1/schools/{uuid4()}/activate",
            headers=superuser_headers,
        )
        assert_not_found(response)


# ============================================================================
# SCHOOL REORDER (SUPERUSER)
# ============================================================================

class TestSchoolReorder:
    """Tests for PUT /api/v1/schools/reorder"""

    async def test_reorder_requires_superuser(
        self, api_client, auth_headers
    ):
        """Regular users cannot reorder schools."""
        response = await api_client.put(
            "/api/v1/schools/reorder",
            headers=auth_headers,
            json={"school_ids": []},
        )
        assert_forbidden(response)
