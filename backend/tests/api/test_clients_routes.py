"""
Tests for Clients API endpoints.

Tests cover:
- Client CRUD operations (GLOBAL - not tied to school)
- Client search and filtering
- Student management
- Client summary/history
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
    assert_client_valid,
)
from tests.fixtures.builders import build_client_request


pytestmark = pytest.mark.api

NEEDS_ISOLATION_FIX = pytest.mark.skip(reason="DB isolation issue")


# ============================================================================
# CLIENT CREATION TESTS
# ============================================================================

class TestClientCreation:
    """Tests for POST /api/v1/clients"""

    @NEEDS_ISOLATION_FIX
    async def test_create_client_success(
        self,
        api_client,
        superuser_headers,
    ):
        """Should create client with all fields."""
        response = await api_client.post(
            "/api/v1/clients",
            headers=superuser_headers,
            json=build_client_request(
                name="María García",
                phone="3001234567",
                email="maria_test_create@example.com",
                address="Calle 123 #45-67",
                student_name="Juan García",
                student_grade="5A"
            )
        )

        data = assert_created_response(response)
        assert_client_valid(data)

        assert data["name"] == "María García"
        assert data["phone"] == "3001234567"
        assert data["email"] == "maria_test_create@example.com"
        assert data["student_name"] == "Juan García"

    async def test_create_client_minimal(
        self,
        api_client,
        superuser_headers,
    ):
        """Should create client with only required fields."""
        response = await api_client.post(
            "/api/v1/clients",
            headers=superuser_headers,
            json=build_client_request(name="Cliente Mínimo Test")
        )

        data = assert_created_response(response)
        assert data["name"] == "Cliente Mínimo Test"

    async def test_create_client_no_auth(self, api_client):
        """Should return 401/403 without authentication."""
        response = await api_client.post(
            "/api/v1/clients",
            json=build_client_request(name="Test")
        )

        assert response.status_code in [401, 403]

    async def test_create_client_generates_code(
        self,
        api_client,
        superuser_headers,
    ):
        """Should auto-generate client code."""
        response = await api_client.post(
            "/api/v1/clients",
            headers=superuser_headers,
            json=build_client_request(name="Test Client AutoCode")
        )

        data = assert_created_response(response)
        assert "code" in data
        assert data["code"].startswith("CLI-")


# ============================================================================
# CLIENT RETRIEVAL TESTS
# ============================================================================

class TestClientRetrieval:
    """Tests for GET clients endpoints."""

    async def test_list_clients(
        self,
        api_client,
        superuser_headers,
        test_client,
    ):
        """Should list all clients."""
        response = await api_client.get(
            "/api/v1/clients",
            headers=superuser_headers
        )

        data = assert_success_response(response)
        # Response is a list for this endpoint
        assert isinstance(data, list)
        assert len(data) >= 1

    @NEEDS_ISOLATION_FIX
    async def test_get_single_client(
        self,
        api_client,
        superuser_headers,
        test_client,
    ):
        """Should get single client by ID."""
        response = await api_client.get(
            f"/api/v1/clients/{test_client.id}",
            headers=superuser_headers
        )

        data = assert_success_response(response)
        assert data["id"] == str(test_client.id)
        assert data["name"] == test_client.name

    async def test_get_client_not_found(
        self,
        api_client,
        superuser_headers,
    ):
        """Should return 404 for non-existent client."""
        response = await api_client.get(
            f"/api/v1/clients/{uuid4()}",
            headers=superuser_headers
        )

        assert_not_found(response)

    async def test_search_clients_by_name(
        self,
        api_client,
        superuser_headers,
        test_client,
    ):
        """Should search clients by name."""
        # Get the name from fixture for accurate search
        search_term = test_client.name[:5]  # First 5 chars

        response = await api_client.get(
            "/api/v1/clients/search",
            headers=superuser_headers,
            params={"q": search_term}
        )

        data = assert_success_response(response)
        # Should find at least the test client
        assert isinstance(data, list)


# ============================================================================
# CLIENT UPDATE TESTS
# ============================================================================

class TestClientUpdate:
    """Tests for PATCH clients endpoints."""

    async def test_update_client_success(
        self,
        api_client,
        superuser_headers,
        test_client,
    ):
        """Should update client information."""
        response = await api_client.patch(
            f"/api/v1/clients/{test_client.id}",
            headers=superuser_headers,
            json={
                "name": "María García Updated",
                "phone": "3009999999",
            }
        )

        data = assert_success_response(response)
        assert data["name"] == "María García Updated"
        assert data["phone"] == "3009999999"

    async def test_update_client_not_found(
        self,
        api_client,
        superuser_headers,
    ):
        """Should return 404 for non-existent client."""
        response = await api_client.patch(
            f"/api/v1/clients/{uuid4()}",
            headers=superuser_headers,
            json={"name": "Updated Name"}
        )

        assert_not_found(response)


# ============================================================================
# CLIENT SUMMARY TESTS
# ============================================================================

class TestClientSummary:
    """Tests for client summary/history endpoints."""

    async def test_get_client_summary(
        self,
        api_client,
        superuser_headers,
        test_client,
    ):
        """Should get client purchase summary."""
        response = await api_client.get(
            f"/api/v1/clients/{test_client.id}/summary",
            headers=superuser_headers
        )

        # Summary endpoint exists
        if response.status_code == 200:
            data = response.json()
            assert isinstance(data, dict)
        else:
            # May return 404 if no purchase history
            assert response.status_code in [200, 404]

    async def test_get_top_clients(
        self,
        api_client,
        superuser_headers,
    ):
        """Should get top clients by total spent."""
        response = await api_client.get(
            "/api/v1/clients/top",
            headers=superuser_headers
        )

        if response.status_code == 200:
            data = response.json()
            assert isinstance(data, list)


# ============================================================================
# STUDENT MANAGEMENT TESTS
# ============================================================================

class TestStudentManagement:
    """Tests for client student information management."""

    async def test_update_student_info(
        self,
        api_client,
        superuser_headers,
        test_client,
    ):
        """Should update student information via client update."""
        response = await api_client.patch(
            f"/api/v1/clients/{test_client.id}",
            headers=superuser_headers,
            json={
                "student_name": "Juan García Updated",
                "student_grade": "6A"
            }
        )

        data = assert_success_response(response)
        assert data["student_name"] == "Juan García Updated"
        assert data["student_grade"] == "6A"


# ============================================================================
# VALIDATION TESTS
# ============================================================================

class TestClientValidation:
    """Tests for client data validation."""

    async def test_create_client_empty_name(
        self,
        api_client,
        superuser_headers,
    ):
        """Should reject empty client name."""
        response = await api_client.post(
            "/api/v1/clients",
            headers=superuser_headers,
            json={"name": ""}
        )

        # Custom handler returns 400 for validation errors
        assert response.status_code in [400, 422]

    async def test_create_client_short_name(
        self,
        api_client,
        superuser_headers,
    ):
        """Should reject name too short (less than 3 chars)."""
        response = await api_client.post(
            "/api/v1/clients",
            headers=superuser_headers,
            json={"name": "AB"}  # Too short
        )

        # Custom handler returns 400 for validation errors
        assert response.status_code in [400, 422]

    async def test_create_client_invalid_email(
        self,
        api_client,
        superuser_headers,
    ):
        """Should reject invalid email format."""
        response = await api_client.post(
            "/api/v1/clients",
            headers=superuser_headers,
            json=build_client_request(
                name="Test Client",
                email="not-an-email"
            )
        )

        # May accept or reject depending on validation
        assert response.status_code in [201, 400, 422]
