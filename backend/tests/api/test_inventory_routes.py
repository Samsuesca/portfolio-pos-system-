"""
Tests for Inventory API endpoints.

Tests cover:
- GET    /api/v1/schools/{school_id}/inventory           (list)
- POST   /api/v1/schools/{school_id}/inventory           (create)
- GET    /api/v1/schools/{school_id}/inventory/product/{product_id}
- POST   /api/v1/schools/{school_id}/inventory/product/{product_id}/adjust
- GET    /api/v1/schools/{school_id}/inventory/low-stock
- GET    /api/v1/schools/{school_id}/inventory/report
"""
import pytest
from decimal import Decimal
from uuid import uuid4
from unittest.mock import patch, AsyncMock, MagicMock

from tests.fixtures.assertions import (
    assert_success_response,
    assert_created_response,
    assert_unauthorized,
)


pytestmark = pytest.mark.api


def _inv_url(school_id: str) -> str:
    return f"/api/v1/schools/{school_id}/inventory"


class TestListInventory:
    """Tests for GET /schools/{school_id}/inventory"""

    @patch("app.api.routes.inventory.InventoryService")
    async def test_list_inventory(
        self, MockService, api_client, superuser_headers, test_school
    ):
        mock_instance = MockService.return_value
        mock_instance.list_by_school = AsyncMock(return_value=([], 0))
        response = await api_client.get(
            _inv_url(test_school.id), headers=superuser_headers
        )
        data = assert_success_response(response)
        assert "items" in data
        assert "total" in data

    @patch("app.api.routes.inventory.InventoryService")
    async def test_list_with_pagination(
        self, MockService, api_client, superuser_headers, test_school
    ):
        from uuid import UUID
        mock_instance = MockService.return_value
        mock_instance.list_by_school = AsyncMock(return_value=([], 0))
        response = await api_client.get(
            f"{_inv_url(test_school.id)}?skip=10&limit=20",
            headers=superuser_headers,
        )
        assert_success_response(response)
        # Route uses UUID path param; service receives a UUID instance.
        mock_instance.list_by_school.assert_awaited_once_with(
            UUID(str(test_school.id)), skip=10, limit=20
        )

    @patch("app.api.routes.inventory.InventoryService")
    async def test_list_low_stock_only(
        self, MockService, api_client, superuser_headers, test_school
    ):
        mock_instance = MockService.return_value
        mock_instance.get_low_stock_products = AsyncMock(return_value=[])
        response = await api_client.get(
            f"{_inv_url(test_school.id)}?low_stock_only=true",
            headers=superuser_headers,
        )
        assert_success_response(response)
        mock_instance.get_low_stock_products.assert_awaited_once()

    async def test_list_unauthenticated(self, api_client, test_school):
        response = await api_client.get(_inv_url(test_school.id))
        assert_unauthorized(response)


class TestCreateInventory:
    """Tests for POST /schools/{school_id}/inventory"""

    @patch("app.api.routes.inventory.InventoryService")
    async def test_create_inventory(
        self, MockService, api_client, superuser_headers, test_school, test_product
    ):
        from datetime import datetime as _dt
        inv_mock = MagicMock()
        inv_mock.id = uuid4()
        inv_mock.product_id = test_product.id
        inv_mock.school_id = test_school.id
        inv_mock.quantity = 50
        inv_mock.min_stock_alert = 5
        inv_mock.last_updated = _dt(2026, 1, 1)
        inv_mock.product = test_product

        mock_instance = MockService.return_value
        mock_instance.create_inventory = AsyncMock(return_value=inv_mock)

        # InventoryCreate inherits from SchoolIsolatedSchema, so school_id is
        # required in the body even though the route overrides it from path.
        response = await api_client.post(
            _inv_url(test_school.id),
            json={
                "school_id": str(test_school.id),
                "product_id": str(test_product.id),
                "quantity": 50,
                "min_stock_alert": 5,
            },
            headers=superuser_headers,
        )
        assert response.status_code == 201

    @patch("app.api.routes.inventory.InventoryService")
    async def test_create_duplicate_returns_400(
        self, MockService, api_client, superuser_headers, test_school
    ):
        mock_instance = MockService.return_value
        mock_instance.create_inventory = AsyncMock(
            side_effect=ValueError("Inventario ya existe para este producto")
        )
        response = await api_client.post(
            _inv_url(test_school.id),
            json={
                "school_id": str(test_school.id),
                "product_id": str(uuid4()),
                "quantity": 10,
            },
            headers=superuser_headers,
        )
        assert response.status_code == 400


class TestGetProductInventory:
    """Tests for GET /schools/{school_id}/inventory/product/{product_id}"""

    @patch("app.api.routes.inventory.InventoryService")
    async def test_get_existing(
        self, MockService, api_client, superuser_headers, test_school
    ):
        inv_mock = MagicMock()
        inv_mock.id = uuid4()
        inv_mock.product_id = uuid4()
        inv_mock.school_id = test_school.id
        inv_mock.quantity = 100
        inv_mock.min_stock_alert = 10
        inv_mock.product = MagicMock()

        mock_instance = MockService.return_value
        mock_instance.get_by_product = AsyncMock(return_value=inv_mock)

        pid = uuid4()
        response = await api_client.get(
            f"{_inv_url(test_school.id)}/product/{pid}",
            headers=superuser_headers,
        )
        assert_success_response(response)

    @patch("app.api.routes.inventory.InventoryService")
    async def test_get_nonexistent_returns_404(
        self, MockService, api_client, superuser_headers, test_school
    ):
        mock_instance = MockService.return_value
        mock_instance.get_by_product = AsyncMock(return_value=None)
        response = await api_client.get(
            f"{_inv_url(test_school.id)}/product/{uuid4()}",
            headers=superuser_headers,
        )
        assert response.status_code == 404


class TestAdjustInventory:
    """Tests for POST /schools/{school_id}/inventory/product/{product_id}/adjust"""

    @patch("app.api.routes.inventory.InventoryService")
    async def test_adjust_positive(
        self, MockService, api_client, superuser_headers, test_school
    ):
        from datetime import datetime as _dt
        inv_mock = MagicMock()
        inv_mock.id = uuid4()
        inv_mock.product_id = uuid4()
        inv_mock.school_id = test_school.id
        inv_mock.quantity = 110
        inv_mock.min_stock_alert = 10
        inv_mock.last_updated = _dt(2026, 1, 1)
        inv_mock.product = MagicMock()

        mock_instance = MockService.return_value
        mock_instance.adjust_quantity = AsyncMock(return_value=inv_mock)

        pid = uuid4()
        response = await api_client.post(
            f"{_inv_url(test_school.id)}/product/{pid}/adjust",
            json={"adjustment": 10, "reason": "Reposicion"},
            headers=superuser_headers,
        )
        assert_success_response(response)

    @patch("app.api.routes.inventory.InventoryService")
    async def test_adjust_not_found(
        self, MockService, api_client, superuser_headers, test_school
    ):
        mock_instance = MockService.return_value
        mock_instance.adjust_quantity = AsyncMock(return_value=None)
        response = await api_client.post(
            f"{_inv_url(test_school.id)}/product/{uuid4()}/adjust",
            json={"adjustment": 5, "reason": "Test"},
            headers=superuser_headers,
        )
        assert response.status_code == 404

    @patch("app.api.routes.inventory.InventoryService")
    async def test_adjust_negative_insufficient_returns_400(
        self, MockService, api_client, superuser_headers, test_school
    ):
        mock_instance = MockService.return_value
        mock_instance.adjust_quantity = AsyncMock(
            side_effect=ValueError("Stock insuficiente")
        )
        response = await api_client.post(
            f"{_inv_url(test_school.id)}/product/{uuid4()}/adjust",
            json={"adjustment": -999, "reason": "Over removal"},
            headers=superuser_headers,
        )
        assert response.status_code == 400


class TestLowStock:
    """Tests for GET /schools/{school_id}/inventory/low-stock"""

    @patch("app.api.routes.inventory.InventoryService")
    async def test_returns_list(
        self, MockService, api_client, superuser_headers, test_school
    ):
        mock_instance = MockService.return_value
        mock_instance.get_low_stock_products = AsyncMock(return_value=[])
        response = await api_client.get(
            f"{_inv_url(test_school.id)}/low-stock", headers=superuser_headers
        )
        data = assert_success_response(response)
        assert isinstance(data, list)


class TestInventoryReport:
    """Tests for GET /schools/{school_id}/inventory/report"""

    @patch("app.api.routes.inventory.InventoryService")
    async def test_returns_report(
        self, MockService, api_client, superuser_headers, test_school
    ):
        mock_instance = MockService.return_value
        mock_instance.get_inventory_report = AsyncMock(return_value={
            "total_products": 50,
            "total_stock_value": Decimal("25000000"),
            "low_stock_count": 3,
            "out_of_stock_count": 1,
            "low_stock_products": [],
        })
        response = await api_client.get(
            f"{_inv_url(test_school.id)}/report", headers=superuser_headers
        )
        assert_success_response(response)
