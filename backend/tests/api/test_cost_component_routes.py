"""
Tests for Cost Component API endpoints.

Tests cover:
- GET/POST/PUT/DELETE cost templates (school + global garment types)
- GET/PUT cost breakdowns (school + global products)
- PUT bulk cost component application
"""
import pytest
from uuid import uuid4
from decimal import Decimal
from unittest.mock import patch, AsyncMock, MagicMock

from tests.fixtures.assertions import (
    assert_success_response,
    assert_created_response,
    assert_no_content_response,
    assert_unauthorized,
)


pytestmark = pytest.mark.api

BASE = "/api/v1"


def _template_obj(**overrides):
    defaults = {
        "id": uuid4(),
        "garment_type_id": uuid4(),
        "name": "Tela",
        "code": "tela",
        "is_variable": False,
        "display_order": 0,
        "is_active": True,
    }
    defaults.update(overrides)
    obj = MagicMock()
    for k, v in defaults.items():
        setattr(obj, k, v)
    return obj


class TestSchoolCostTemplates:
    """Tests for school garment type cost templates."""

    @patch("app.api.routes.cost_components.CostComponentService")
    async def test_get_templates(
        self, MockService, api_client, superuser_headers
    ):
        mock_instance = MockService.return_value
        mock_instance.get_templates = AsyncMock(return_value=[
            _template_obj(name="Tela"),
            _template_obj(name="Hilo"),
        ])
        school_id = uuid4()
        gt_id = uuid4()
        response = await api_client.get(
            f"{BASE}/schools/{school_id}/garment-types/{gt_id}/cost-templates",
            headers=superuser_headers,
        )
        data = assert_success_response(response)
        assert isinstance(data, list)

    @patch("app.api.routes.cost_components.CostComponentService")
    async def test_create_template(
        self, MockService, api_client, superuser_headers
    ):
        template = _template_obj()
        mock_instance = MockService.return_value
        mock_instance.create_template = AsyncMock(return_value=template)
        school_id = uuid4()
        gt_id = uuid4()
        response = await api_client.post(
            f"{BASE}/schools/{school_id}/garment-types/{gt_id}/cost-templates",
            json={"name": "Tela", "code": "tela"},
            headers=superuser_headers,
        )
        assert response.status_code == 201

    @patch("app.api.routes.cost_components.CostComponentService")
    async def test_update_template(
        self, MockService, api_client, superuser_headers
    ):
        template = _template_obj(name="Updated Tela")
        mock_instance = MockService.return_value
        mock_instance.update_template = AsyncMock(return_value=template)
        school_id = uuid4()
        gt_id = uuid4()
        tid = uuid4()
        response = await api_client.put(
            f"{BASE}/schools/{school_id}/garment-types/{gt_id}/cost-templates/{tid}",
            json={"name": "Updated Tela"},
            headers=superuser_headers,
        )
        assert_success_response(response)

    @patch("app.api.routes.cost_components.CostComponentService")
    async def test_update_template_not_found(
        self, MockService, api_client, superuser_headers
    ):
        mock_instance = MockService.return_value
        mock_instance.update_template = AsyncMock(return_value=None)
        response = await api_client.put(
            f"{BASE}/schools/{uuid4()}/garment-types/{uuid4()}/cost-templates/{uuid4()}",
            json={"name": "X"},
            headers=superuser_headers,
        )
        assert response.status_code == 404

    @patch("app.api.routes.cost_components.CostComponentService")
    async def test_delete_template(
        self, MockService, api_client, superuser_headers
    ):
        mock_instance = MockService.return_value
        mock_instance.deactivate_template = AsyncMock(return_value=True)
        response = await api_client.delete(
            f"{BASE}/schools/{uuid4()}/garment-types/{uuid4()}/cost-templates/{uuid4()}",
            headers=superuser_headers,
        )
        assert_no_content_response(response)

    @patch("app.api.routes.cost_components.CostComponentService")
    async def test_delete_template_not_found(
        self, MockService, api_client, superuser_headers
    ):
        mock_instance = MockService.return_value
        mock_instance.deactivate_template = AsyncMock(return_value=False)
        response = await api_client.delete(
            f"{BASE}/schools/{uuid4()}/garment-types/{uuid4()}/cost-templates/{uuid4()}",
            headers=superuser_headers,
        )
        assert response.status_code == 404


class TestGlobalCostTemplates:
    """Tests for global garment type cost templates."""

    @patch("app.api.routes.cost_components.CostComponentService")
    async def test_get_global_templates(
        self, MockService, api_client, superuser_headers
    ):
        mock_instance = MockService.return_value
        mock_instance.get_templates = AsyncMock(return_value=[])
        gt_id = uuid4()
        response = await api_client.get(
            f"{BASE}/global-garment-types/{gt_id}/cost-templates",
            headers=superuser_headers,
        )
        data = assert_success_response(response)
        assert isinstance(data, list)

    @patch("app.api.routes.cost_components.CostComponentService")
    async def test_create_global_template(
        self, MockService, api_client, superuser_headers
    ):
        template = _template_obj()
        mock_instance = MockService.return_value
        mock_instance.create_template = AsyncMock(return_value=template)
        gt_id = uuid4()
        response = await api_client.post(
            f"{BASE}/global-garment-types/{gt_id}/cost-templates",
            json={"name": "Bordado", "code": "bordado"},
            headers=superuser_headers,
        )
        assert response.status_code == 201


class TestProductCostBreakdown:
    """Tests for product cost breakdown endpoints."""

    @patch("app.api.routes.cost_components.CostComponentService")
    async def test_get_breakdown(
        self, MockService, api_client, superuser_headers
    ):
        mock_instance = MockService.return_value
        mock_instance.get_breakdown = AsyncMock(return_value={
            "product_id": str(uuid4()),
            "components": [],
            "total_cost": 0,
        })
        response = await api_client.get(
            f"{BASE}/schools/{uuid4()}/products/{uuid4()}/cost-breakdown",
            headers=superuser_headers,
        )
        assert_success_response(response)

    @patch("app.api.routes.cost_components.CostComponentService")
    async def test_get_breakdown_not_found(
        self, MockService, api_client, superuser_headers
    ):
        mock_instance = MockService.return_value
        mock_instance.get_breakdown = AsyncMock(
            side_effect=ValueError("Producto no encontrado")
        )
        response = await api_client.get(
            f"{BASE}/schools/{uuid4()}/products/{uuid4()}/cost-breakdown",
            headers=superuser_headers,
        )
        assert response.status_code == 404

    @patch("app.api.routes.cost_components.CostComponentService")
    async def test_upsert_breakdown(
        self, MockService, api_client, superuser_headers
    ):
        mock_instance = MockService.return_value
        mock_instance.upsert_breakdown = AsyncMock(return_value={
            "product_id": str(uuid4()),
            "components": [],
            "total_cost": 15000,
        })
        tid = str(uuid4())
        response = await api_client.put(
            f"{BASE}/schools/{uuid4()}/products/{uuid4()}/cost-breakdown",
            json={"components": [{"template_id": tid, "amount": 15000}]},
            headers=superuser_headers,
        )
        assert_success_response(response)


class TestGlobalProductCostBreakdown:
    """Tests for global product cost breakdown."""

    @patch("app.api.routes.cost_components.CostComponentService")
    async def test_get_global_breakdown(
        self, MockService, api_client, superuser_headers
    ):
        mock_instance = MockService.return_value
        mock_instance.get_breakdown = AsyncMock(return_value={
            "product_id": str(uuid4()), "components": [], "total_cost": 0
        })
        response = await api_client.get(
            f"{BASE}/global-products/{uuid4()}/cost-breakdown",
            headers=superuser_headers,
        )
        assert_success_response(response)

    @patch("app.api.routes.cost_components.CostComponentService")
    async def test_upsert_global_breakdown(
        self, MockService, api_client, superuser_headers
    ):
        mock_instance = MockService.return_value
        mock_instance.upsert_breakdown = AsyncMock(return_value={
            "product_id": str(uuid4()), "components": [], "total_cost": 0
        })
        tid = str(uuid4())
        response = await api_client.put(
            f"{BASE}/global-products/{uuid4()}/cost-breakdown",
            json={"components": [{"template_id": tid, "amount": 5000}]},
            headers=superuser_headers,
        )
        assert_success_response(response)


class TestBulkApplyCostComponent:
    """Tests for bulk cost component application."""

    @patch("app.api.routes.cost_components.CostComponentService")
    async def test_bulk_apply_school(
        self, MockService, api_client, superuser_headers
    ):
        mock_instance = MockService.return_value
        mock_instance.bulk_apply_component = AsyncMock(return_value={
            "updated": 10, "total_cost_recalculated": 10
        })
        response = await api_client.put(
            f"{BASE}/schools/{uuid4()}/garment-types/{uuid4()}/bulk-cost-component",
            json={"code": "tela", "amount": 12000},
            headers=superuser_headers,
        )
        data = assert_success_response(response)
        assert data["updated"] == 10

    @patch("app.api.routes.cost_components.CostComponentService")
    async def test_bulk_apply_global(
        self, MockService, api_client, superuser_headers
    ):
        mock_instance = MockService.return_value
        mock_instance.bulk_apply_component = AsyncMock(return_value={
            "updated": 5, "total_cost_recalculated": 5
        })
        response = await api_client.put(
            f"{BASE}/global-garment-types/{uuid4()}/bulk-cost-component",
            json={"code": "bordado", "amount": 8000},
            headers=superuser_headers,
        )
        data = assert_success_response(response)
        assert data["updated"] == 5

    @patch("app.api.routes.cost_components.CostComponentService")
    async def test_bulk_apply_not_found(
        self, MockService, api_client, superuser_headers
    ):
        mock_instance = MockService.return_value
        mock_instance.bulk_apply_component = AsyncMock(
            side_effect=ValueError("Template no encontrado")
        )
        response = await api_client.put(
            f"{BASE}/schools/{uuid4()}/garment-types/{uuid4()}/bulk-cost-component",
            json={"code": "missing", "amount": 1000},
            headers=superuser_headers,
        )
        assert response.status_code == 404
