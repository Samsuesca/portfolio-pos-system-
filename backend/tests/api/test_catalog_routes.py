"""
Tests for Catalog API endpoints (Positions).

Tests cover:
- GET    /api/v1/global/catalog/positions
- GET    /api/v1/global/catalog/positions/{id}
- POST   /api/v1/global/catalog/positions
- PATCH  /api/v1/global/catalog/positions/{id}
- DELETE /api/v1/global/catalog/positions/{id}
"""
import pytest
from uuid import uuid4
from unittest.mock import patch, AsyncMock, MagicMock
from datetime import datetime

from tests.fixtures.assertions import (
    assert_success_response,
    assert_created_response,
    assert_no_content_response,
    assert_unauthorized,
)


pytestmark = pytest.mark.api

BASE = "/api/v1/global/catalog"


def _position_obj(**overrides):
    defaults = {
        "id": uuid4(),
        "code": "costurera",
        "name": "Costurera",
        "description": None,
        "is_active": True,
        "sort_order": 0,
        "created_at": datetime(2026, 1, 1),
        "updated_at": datetime(2026, 1, 1),
    }
    defaults.update(overrides)
    obj = MagicMock()
    for k, v in defaults.items():
        setattr(obj, k, v)
    return obj


class TestListPositions:
    """Tests for GET /positions"""

    @patch("app.api.routes.catalog.PositionService")
    async def test_list_positions(
        self, MockService, api_client, superuser_headers
    ):
        mock_instance = MockService.return_value
        mock_instance.list_positions = AsyncMock(return_value=[
            _position_obj(code="costurera", name="Costurera"),
            _position_obj(code="vendedora", name="Vendedora"),
        ])
        response = await api_client.get(
            f"{BASE}/positions", headers=superuser_headers
        )
        data = assert_success_response(response)
        assert isinstance(data, list)
        assert len(data) == 2

    @patch("app.api.routes.catalog.PositionService")
    async def test_list_with_inactive(
        self, MockService, api_client, superuser_headers
    ):
        mock_instance = MockService.return_value
        mock_instance.list_positions = AsyncMock(return_value=[])
        response = await api_client.get(
            f"{BASE}/positions?include_inactive=true", headers=superuser_headers
        )
        assert_success_response(response)
        mock_instance.list_positions.assert_awaited_once_with(include_inactive=True)

    async def test_unauthenticated(self, api_client):
        response = await api_client.get(f"{BASE}/positions")
        assert_unauthorized(response)


class TestGetPosition:
    """Tests for GET /positions/{position_id}"""

    @patch("app.api.routes.catalog.PositionService")
    async def test_get_existing(self, MockService, api_client, superuser_headers):
        pos = _position_obj()
        mock_instance = MockService.return_value
        mock_instance.get_position = AsyncMock(return_value=pos)
        response = await api_client.get(
            f"{BASE}/positions/{pos.id}", headers=superuser_headers
        )
        assert_success_response(response)

    @patch("app.api.routes.catalog.PositionService")
    async def test_get_nonexistent_returns_404(
        self, MockService, api_client, superuser_headers
    ):
        mock_instance = MockService.return_value
        mock_instance.get_position = AsyncMock(return_value=None)
        response = await api_client.get(
            f"{BASE}/positions/{uuid4()}", headers=superuser_headers
        )
        assert response.status_code == 404


class TestCreatePosition:
    """Tests for POST /positions"""

    @patch("app.api.routes.catalog.PositionService")
    async def test_create_success(self, MockService, api_client, superuser_headers):
        pos = _position_obj(code="bordadora", name="Bordadora")
        mock_instance = MockService.return_value
        mock_instance.create_position = AsyncMock(return_value=pos)
        response = await api_client.post(
            f"{BASE}/positions",
            json={"code": "bordadora", "name": "Bordadora"},
            headers=superuser_headers,
        )
        assert response.status_code == 201

    @patch("app.api.routes.catalog.PositionService")
    async def test_create_duplicate_returns_400(
        self, MockService, api_client, superuser_headers
    ):
        mock_instance = MockService.return_value
        mock_instance.create_position = AsyncMock(
            side_effect=ValueError("Ya existe una posicion con ese codigo")
        )
        response = await api_client.post(
            f"{BASE}/positions",
            json={"code": "costurera", "name": "Costurera"},
            headers=superuser_headers,
        )
        assert response.status_code == 400

    async def test_create_missing_fields_returns_400(
        self, api_client, superuser_headers
    ):
        # El proyecto tiene un handler global que convierte
        # RequestValidationError (422) a 400 Bad Request.
        response = await api_client.post(
            f"{BASE}/positions",
            json={"description": "no code or name"},
            headers=superuser_headers,
        )
        assert response.status_code == 400


class TestUpdatePosition:
    """Tests for PATCH /positions/{position_id}"""

    @patch("app.api.routes.catalog.PositionService")
    async def test_update_success(self, MockService, api_client, superuser_headers):
        pos = _position_obj(name="Updated")
        mock_instance = MockService.return_value
        mock_instance.update_position = AsyncMock(return_value=pos)
        response = await api_client.patch(
            f"{BASE}/positions/{pos.id}",
            json={"name": "Updated"},
            headers=superuser_headers,
        )
        assert_success_response(response)

    @patch("app.api.routes.catalog.PositionService")
    async def test_update_nonexistent_returns_404(
        self, MockService, api_client, superuser_headers
    ):
        mock_instance = MockService.return_value
        mock_instance.update_position = AsyncMock(return_value=None)
        response = await api_client.patch(
            f"{BASE}/positions/{uuid4()}",
            json={"name": "X"},
            headers=superuser_headers,
        )
        assert response.status_code == 404

    @patch("app.api.routes.catalog.PositionService")
    async def test_update_duplicate_code_returns_400(
        self, MockService, api_client, superuser_headers
    ):
        mock_instance = MockService.return_value
        mock_instance.update_position = AsyncMock(
            side_effect=ValueError("Codigo duplicado")
        )
        response = await api_client.patch(
            f"{BASE}/positions/{uuid4()}",
            json={"code": "existing"},
            headers=superuser_headers,
        )
        assert response.status_code == 400


class TestDeletePosition:
    """Tests for DELETE /positions/{position_id}"""

    @patch("app.api.routes.catalog.PositionService")
    async def test_delete_success(self, MockService, api_client, superuser_headers):
        mock_instance = MockService.return_value
        mock_instance.delete_position = AsyncMock(return_value=True)
        response = await api_client.delete(
            f"{BASE}/positions/{uuid4()}", headers=superuser_headers
        )
        assert_no_content_response(response)

    @patch("app.api.routes.catalog.PositionService")
    async def test_delete_nonexistent_returns_404(
        self, MockService, api_client, superuser_headers
    ):
        mock_instance = MockService.return_value
        mock_instance.delete_position = AsyncMock(return_value=False)
        response = await api_client.delete(
            f"{BASE}/positions/{uuid4()}", headers=superuser_headers
        )
        assert response.status_code == 404


# =============================================================================
# Per-school catalog order (garment-type card order, issue #8)
# =============================================================================

from app.schemas.product import CatalogOrderEntry  # noqa: E402


def _catalog_order(*garment_type_ids):
    return [
        CatalogOrderEntry(garment_type_id=gt, display_order=i)
        for i, gt in enumerate(garment_type_ids)
    ]


class TestReorderCatalog:
    """PUT /api/v1/schools/{school_id}/catalog/garment-types/reorder"""

    def _url(self, school_id):
        return f"/api/v1/schools/{school_id}/catalog/garment-types/reorder"

    async def test_unauthenticated(self, api_client, test_school):
        response = await api_client.put(
            self._url(test_school.id), json={"garment_type_ids": [str(uuid4())]}
        )
        assert_unauthorized(response)

    async def test_requires_catalog_reorder_permission(
        self, api_client, auth_headers, test_school
    ):
        # auth_headers belongs to a user with no role in this school → 403.
        response = await api_client.put(
            self._url(test_school.id),
            json={"garment_type_ids": [str(uuid4())]},
            headers=auth_headers,
        )
        assert response.status_code == 403

    @patch("app.api.routes.products.GarmentTypeService")
    async def test_reorder_success(
        self, MockService, api_client, superuser_headers, test_school
    ):
        gt1, gt2 = str(uuid4()), str(uuid4())
        mock_instance = MockService.return_value
        mock_instance.reorder_school_catalog = AsyncMock(
            return_value=_catalog_order(gt1, gt2)
        )
        response = await api_client.put(
            self._url(test_school.id),
            json={"garment_type_ids": [gt1, gt2]},
            headers=superuser_headers,
        )
        data = assert_success_response(response)
        assert [e["garment_type_id"] for e in data] == [gt1, gt2]
        assert [e["display_order"] for e in data] == [0, 1]
        mock_instance.reorder_school_catalog.assert_awaited_once()

    @patch("app.api.routes.products.GarmentTypeService")
    async def test_reorder_invalid_garment_type_returns_400(
        self, MockService, api_client, superuser_headers, test_school
    ):
        mock_instance = MockService.return_value
        mock_instance.reorder_school_catalog = AsyncMock(
            side_effect=ValueError("Tipo de prenda no visible para este colegio")
        )
        response = await api_client.put(
            self._url(test_school.id),
            json={"garment_type_ids": [str(uuid4())]},
            headers=superuser_headers,
        )
        assert response.status_code == 400


class TestGetCatalogOrder:
    """GET /api/v1/schools/{school_id}/catalog/garment-types/order"""

    def _url(self, school_id):
        return f"/api/v1/schools/{school_id}/catalog/garment-types/order"

    async def test_unauthenticated(self, api_client, test_school):
        response = await api_client.get(self._url(test_school.id))
        assert_unauthorized(response)

    @patch("app.api.routes.products.GarmentTypeService")
    async def test_get_order_returns_persisted_sequence(
        self, MockService, api_client, auth_headers, test_school
    ):
        gt1, gt2 = str(uuid4()), str(uuid4())
        mock_instance = MockService.return_value
        mock_instance.get_school_catalog_order = AsyncMock(
            return_value=_catalog_order(gt1, gt2)
        )
        response = await api_client.get(self._url(test_school.id), headers=auth_headers)
        data = assert_success_response(response)
        assert [e["garment_type_id"] for e in data] == [gt1, gt2]
