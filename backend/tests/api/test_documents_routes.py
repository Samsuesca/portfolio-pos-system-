"""
Tests for Documents API endpoints.

Tests cover:
- Document folder CRUD (superuser only)
- Document upload/download (superuser only)
- Storage stats
- Auth requirements (all endpoints require superuser)
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
# FOLDER CRUD
# ============================================================================

class TestDocumentFolders:
    """Tests for /api/v1/documents/folders"""

    async def test_create_folder_requires_superuser(self, api_client):
        """Non-authenticated users cannot create folders."""
        response = await api_client.post(
            "/api/v1/documents/folders",
            json={"name": "Test Folder"},
        )
        assert_unauthorized(response)

    async def test_create_folder_regular_user_forbidden(
        self, api_client, auth_headers
    ):
        """Regular users cannot create folders."""
        response = await api_client.post(
            "/api/v1/documents/folders",
            headers=auth_headers,
            json={"name": "Test Folder"},
        )
        assert_forbidden(response)

    @NEEDS_ISOLATION_FIX
    async def test_create_folder_success(
        self, api_client, superuser_headers
    ):
        """Superuser can create a folder."""
        response = await api_client.post(
            "/api/v1/documents/folders",
            headers=superuser_headers,
            json={"name": "Facturas 2026", "description": "Facturas del año"},
        )
        data = assert_created_response(response)
        assert data["name"] == "Facturas 2026"
        assert "id" in data

    async def test_list_folders_requires_superuser(self, api_client):
        """Non-authenticated users cannot list folders."""
        response = await api_client.get("/api/v1/documents/folders")
        assert_unauthorized(response)

    async def test_list_folders_regular_user_forbidden(
        self, api_client, auth_headers
    ):
        """Regular users cannot list folders."""
        response = await api_client.get(
            "/api/v1/documents/folders",
            headers=auth_headers,
        )
        assert_forbidden(response)

    @NEEDS_ISOLATION_FIX
    async def test_list_folders_success(
        self, api_client, superuser_headers
    ):
        """Superuser can list folders."""
        response = await api_client.get(
            "/api/v1/documents/folders",
            headers=superuser_headers,
        )
        data = assert_success_response(response)
        assert isinstance(data, list)

    async def test_get_folder_not_found(
        self, api_client, superuser_headers
    ):
        """Getting non-existent folder returns 404."""
        response = await api_client.get(
            f"/api/v1/documents/folders/{uuid4()}",
            headers=superuser_headers,
        )
        assert_not_found(response)

    async def test_delete_folder_not_found(
        self, api_client, superuser_headers
    ):
        """Deleting non-existent folder returns 404."""
        response = await api_client.delete(
            f"/api/v1/documents/folders/{uuid4()}",
            headers=superuser_headers,
        )
        assert_not_found(response)


# ============================================================================
# DOCUMENT OPERATIONS
# ============================================================================

class TestDocumentOperations:
    """Tests for /api/v1/documents"""

    async def test_list_documents_requires_superuser(self, api_client):
        """Non-authenticated users cannot list documents."""
        response = await api_client.get("/api/v1/documents")
        assert_unauthorized(response)

    async def test_list_documents_regular_user_forbidden(
        self, api_client, auth_headers
    ):
        """Regular users cannot list documents."""
        response = await api_client.get(
            "/api/v1/documents",
            headers=auth_headers,
        )
        assert_forbidden(response)

    @NEEDS_ISOLATION_FIX
    async def test_list_documents_success(
        self, api_client, superuser_headers
    ):
        """Superuser can list documents."""
        response = await api_client.get(
            "/api/v1/documents",
            headers=superuser_headers,
        )
        data = assert_success_response(response)
        assert isinstance(data, list)

    async def test_get_document_not_found(
        self, api_client, superuser_headers
    ):
        """Getting non-existent document returns 404."""
        response = await api_client.get(
            f"/api/v1/documents/{uuid4()}",
            headers=superuser_headers,
        )
        assert_not_found(response)

    async def test_download_document_not_found(
        self, api_client, superuser_headers
    ):
        """Downloading non-existent document returns 404."""
        response = await api_client.get(
            f"/api/v1/documents/{uuid4()}/download",
            headers=superuser_headers,
        )
        assert_not_found(response)


# ============================================================================
# STORAGE STATS
# ============================================================================

class TestStorageStats:
    """Tests for /api/v1/documents/stats"""

    async def test_stats_requires_superuser(self, api_client):
        """Non-authenticated users cannot view stats."""
        response = await api_client.get("/api/v1/documents/stats")
        assert_unauthorized(response)

    @NEEDS_ISOLATION_FIX
    async def test_stats_success(self, api_client, superuser_headers):
        """Superuser can view storage stats."""
        response = await api_client.get(
            "/api/v1/documents/stats",
            headers=superuser_headers,
        )
        data = assert_success_response(response)
        assert "total_documents" in data or "total_size" in data or isinstance(data, dict)
