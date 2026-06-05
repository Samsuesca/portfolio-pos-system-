"""
Tests for Vendor API endpoints.

Tests cover:
- GET    /api/v1/vendors           (list)
- GET    /api/v1/vendors/search    (search)
- GET    /api/v1/vendors/{id}      (detail)
- POST   /api/v1/vendors           (create)
- PATCH  /api/v1/vendors/{id}      (update)
- DELETE /api/v1/vendors/{id}      (deactivate)
- POST   /api/v1/vendors/merge     (merge)
"""
import pytest
from uuid import uuid4
from unittest.mock import patch, AsyncMock, MagicMock

from tests.fixtures.assertions import (
    assert_success_response,
    assert_created_response,
    assert_unauthorized,
)


pytestmark = pytest.mark.api

BASE = "/api/v1/vendors"


def _vendor_obj(**overrides):
    """Build a mock vendor object with from_attributes support."""
    defaults = {
        "id": uuid4(),
        "name": "Test Vendor",
        "normalized_name": "test vendor",
        "type": "person",
        "phone": "3001234567",
        "email": "vendor@test.com",
        "notes": None,
        "is_system": False,
        "is_active": True,
        "created_by": None,
        "created_at": "2026-01-01T00:00:00",
        "updated_at": "2026-01-01T00:00:00",
    }
    defaults.update(overrides)
    obj = MagicMock()
    for k, v in defaults.items():
        setattr(obj, k, v)
    return obj


class TestListVendors:
    """Tests for GET /vendors"""

    @patch("app.api.routes.vendors.VendorService")
    async def test_list_returns_paginated(
        self, MockService, api_client, superuser_headers
    ):
        mock_instance = MockService.return_value
        mock_instance.list_vendors = AsyncMock(return_value=[
            _vendor_obj(name="Vendor A"),
            _vendor_obj(name="Vendor B"),
        ])
        response = await api_client.get(BASE, headers=superuser_headers)
        data = assert_success_response(response)
        assert "items" in data
        assert "total" in data

    @patch("app.api.routes.vendors.VendorService")
    async def test_list_with_search_param(
        self, MockService, api_client, superuser_headers
    ):
        mock_instance = MockService.return_value
        mock_instance.list_vendors = AsyncMock(return_value=[])
        response = await api_client.get(
            f"{BASE}?search=hangar", headers=superuser_headers
        )
        assert_success_response(response)
        mock_instance.list_vendors.assert_awaited_once()
        call_kwargs = mock_instance.list_vendors.call_args.kwargs
        assert call_kwargs["search"] == "hangar"

    @patch("app.api.routes.vendors.VendorService")
    async def test_list_with_include_inactive(
        self, MockService, api_client, superuser_headers
    ):
        mock_instance = MockService.return_value
        mock_instance.list_vendors = AsyncMock(return_value=[])
        response = await api_client.get(
            f"{BASE}?include_inactive=true", headers=superuser_headers
        )
        assert_success_response(response)
        call_kwargs = mock_instance.list_vendors.call_args.kwargs
        assert call_kwargs["include_inactive"] is True

    async def test_list_unauthenticated(self, api_client):
        response = await api_client.get(BASE)
        assert_unauthorized(response)


class TestSearchVendors:
    """Tests for GET /vendors/search"""

    @patch("app.api.routes.vendors.VendorService")
    async def test_search_returns_list(
        self, MockService, api_client, superuser_headers
    ):
        mock_instance = MockService.return_value
        mock_instance.search_vendors = AsyncMock(return_value=[
            _vendor_obj(name="Hangar Textil"),
        ])
        response = await api_client.get(
            f"{BASE}/search?q=hangar", headers=superuser_headers
        )
        data = assert_success_response(response)
        assert isinstance(data, list)

    async def test_search_missing_q_returns_400(self, api_client, superuser_headers):
        # Handler global del proyecto convierte RequestValidationError a 400.
        response = await api_client.get(f"{BASE}/search", headers=superuser_headers)
        assert response.status_code == 400

    @patch("app.api.routes.vendors.VendorService")
    async def test_search_with_custom_limit(
        self, MockService, api_client, superuser_headers
    ):
        mock_instance = MockService.return_value
        mock_instance.search_vendors = AsyncMock(return_value=[])
        response = await api_client.get(
            f"{BASE}/search?q=test&limit=5", headers=superuser_headers
        )
        assert_success_response(response)
        call_kwargs = mock_instance.search_vendors.call_args
        assert call_kwargs.kwargs.get("limit") == 5 or call_kwargs[1].get("limit") == 5


class TestGetVendor:
    """Tests for GET /vendors/{vendor_id}"""

    @patch("app.api.routes.vendors.VendorService")
    async def test_get_existing_vendor(
        self, MockService, api_client, superuser_headers
    ):
        vendor = _vendor_obj()
        mock_instance = MockService.return_value
        mock_instance.get_by_id = AsyncMock(return_value=vendor)
        response = await api_client.get(
            f"{BASE}/{vendor.id}", headers=superuser_headers
        )
        assert_success_response(response)

    @patch("app.api.routes.vendors.VendorService")
    async def test_get_nonexistent_returns_404(
        self, MockService, api_client, superuser_headers
    ):
        mock_instance = MockService.return_value
        mock_instance.get_by_id = AsyncMock(return_value=None)
        response = await api_client.get(
            f"{BASE}/{uuid4()}", headers=superuser_headers
        )
        assert response.status_code == 404


class TestCreateVendor:
    """Tests for POST /vendors"""

    @patch("app.api.routes.vendors.VendorService")
    async def test_create_vendor_success(
        self, MockService, api_client, superuser_headers
    ):
        vendor = _vendor_obj()
        mock_instance = MockService.return_value
        mock_instance.create = AsyncMock(return_value=vendor)
        response = await api_client.post(
            BASE,
            json={"name": "New Vendor", "type": "person"},
            headers=superuser_headers,
        )
        assert response.status_code == 201

    @patch("app.api.routes.vendors.VendorService")
    async def test_create_duplicate_returns_400(
        self, MockService, api_client, superuser_headers
    ):
        mock_instance = MockService.return_value
        mock_instance.create = AsyncMock(side_effect=ValueError("Ya existe"))
        response = await api_client.post(
            BASE,
            json={"name": "Duplicate", "type": "person"},
            headers=superuser_headers,
        )
        assert response.status_code == 400

    async def test_create_missing_name_returns_400(
        self, api_client, superuser_headers
    ):
        # Handler global del proyecto convierte RequestValidationError a 400.
        response = await api_client.post(
            BASE, json={"type": "person"}, headers=superuser_headers
        )
        assert response.status_code == 400


class TestUpdateVendor:
    """Tests for PATCH /vendors/{vendor_id}"""

    @patch("app.api.routes.vendors.VendorService")
    async def test_update_vendor_success(
        self, MockService, api_client, superuser_headers
    ):
        vendor = _vendor_obj(name="Updated Name")
        mock_instance = MockService.return_value
        mock_instance.update_vendor = AsyncMock(return_value=vendor)
        response = await api_client.patch(
            f"{BASE}/{vendor.id}",
            json={"name": "Updated Name"},
            headers=superuser_headers,
        )
        assert_success_response(response)

    @patch("app.api.routes.vendors.VendorService")
    async def test_update_nonexistent_returns_404(
        self, MockService, api_client, superuser_headers
    ):
        mock_instance = MockService.return_value
        mock_instance.update_vendor = AsyncMock(return_value=None)
        response = await api_client.patch(
            f"{BASE}/{uuid4()}", json={"name": "X"}, headers=superuser_headers
        )
        assert response.status_code == 404


class TestDeactivateVendor:
    """Tests for DELETE /vendors/{vendor_id}"""

    @patch("app.api.routes.vendors.VendorService")
    async def test_deactivate_success(
        self, MockService, api_client, superuser_headers
    ):
        vendor = _vendor_obj(is_active=False)
        mock_instance = MockService.return_value
        mock_instance.deactivate = AsyncMock(return_value=vendor)
        response = await api_client.delete(
            f"{BASE}/{vendor.id}", headers=superuser_headers
        )
        assert_success_response(response)

    @patch("app.api.routes.vendors.VendorService")
    async def test_deactivate_nonexistent_returns_404(
        self, MockService, api_client, superuser_headers
    ):
        mock_instance = MockService.return_value
        mock_instance.deactivate = AsyncMock(return_value=None)
        response = await api_client.delete(
            f"{BASE}/{uuid4()}", headers=superuser_headers
        )
        assert response.status_code == 404

    @patch("app.api.routes.vendors.VendorService")
    async def test_deactivate_system_vendor_returns_400(
        self, MockService, api_client, superuser_headers
    ):
        mock_instance = MockService.return_value
        mock_instance.deactivate = AsyncMock(
            side_effect=ValueError("No se puede desactivar proveedor del sistema")
        )
        response = await api_client.delete(
            f"{BASE}/{uuid4()}", headers=superuser_headers
        )
        assert response.status_code == 400


class TestMergeVendors:
    """Tests for POST /vendors/merge"""

    @patch("app.api.routes.vendors.VendorService")
    async def test_merge_success(self, MockService, api_client, superuser_headers):
        mock_instance = MockService.return_value
        mock_instance.merge_vendors = AsyncMock(return_value=5)
        source_id = str(uuid4())
        target_id = str(uuid4())
        response = await api_client.post(
            f"{BASE}/merge",
            json={"source_ids": [source_id], "target_id": target_id},
            headers=superuser_headers,
        )
        data = assert_success_response(response)
        assert data["merged"] == 5

    @patch("app.api.routes.vendors.VendorService")
    async def test_merge_invalid_target_returns_400(
        self, MockService, api_client, superuser_headers
    ):
        mock_instance = MockService.return_value
        mock_instance.merge_vendors = AsyncMock(
            side_effect=ValueError("Target vendor no encontrado")
        )
        response = await api_client.post(
            f"{BASE}/merge",
            json={"source_ids": [str(uuid4())], "target_id": str(uuid4())},
            headers=superuser_headers,
        )
        assert response.status_code == 400
