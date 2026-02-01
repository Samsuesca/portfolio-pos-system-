"""
Tests for Inventory Logs API endpoints.

Tests cover:
- Getting product inventory logs
- Getting school-wide inventory logs with filters
- Getting global product inventory logs
- Pagination
"""
import pytest
from httpx import AsyncClient
from uuid import uuid4
from datetime import date, timedelta

from tests.fixtures.assertions import assert_success_response


pytestmark = pytest.mark.api

NEEDS_ISOLATION_FIX = pytest.mark.skip(reason="DB isolation issue")


class TestProductInventoryLogs:
    """Tests for GET /schools/{school_id}/inventory/{product_id}/logs"""

    async def test_get_product_logs_success(
        self,
        api_client: AsyncClient,
        superuser_headers: dict,
        test_school,
        test_product
    ):
        """Should return inventory logs for a product."""
        response = await api_client.get(
            f"/api/v1/schools/{test_school.id}/inventory/{test_product.id}/logs",
            headers=superuser_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

    async def test_get_product_logs_with_pagination(
        self,
        api_client: AsyncClient,
        superuser_headers: dict,
        test_school,
        test_product
    ):
        """Should support pagination parameters."""
        response = await api_client.get(
            f"/api/v1/schools/{test_school.id}/inventory/{test_product.id}/logs?skip=0&limit=10",
            headers=superuser_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) <= 10

    async def test_get_product_logs_unauthorized(
        self,
        api_client: AsyncClient,
        test_school,
        test_product
    ):
        """Should require authentication."""
        response = await api_client.get(
            f"/api/v1/schools/{test_school.id}/inventory/{test_product.id}/logs"
        )

        assert response.status_code in [401, 403]

    async def test_get_product_logs_nonexistent_product(
        self,
        api_client: AsyncClient,
        superuser_headers: dict,
        test_school
    ):
        """Should return empty list for non-existent product."""
        fake_product_id = uuid4()
        response = await api_client.get(
            f"/api/v1/schools/{test_school.id}/inventory/{fake_product_id}/logs",
            headers=superuser_headers
        )

        # Returns 200 with empty list or 404
        assert response.status_code in [200, 404]
        if response.status_code == 200:
            assert response.json() == []


class TestSchoolInventoryLogs:
    """Tests for GET /schools/{school_id}/inventory-logs"""

    async def test_get_school_logs_success(
        self,
        api_client: AsyncClient,
        superuser_headers: dict,
        test_school
    ):
        """Should return inventory logs for a school."""
        response = await api_client.get(
            f"/api/v1/schools/{test_school.id}/inventory-logs",
            headers=superuser_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert "items" in data or isinstance(data, list)

    async def test_get_school_logs_with_date_filter(
        self,
        api_client: AsyncClient,
        superuser_headers: dict,
        test_school
    ):
        """Should filter by date range."""
        today = date.today()
        start_date = (today - timedelta(days=7)).isoformat()
        end_date = today.isoformat()

        response = await api_client.get(
            f"/api/v1/schools/{test_school.id}/inventory-logs?start_date={start_date}&end_date={end_date}",
            headers=superuser_headers
        )

        assert response.status_code == 200

    async def test_get_school_logs_with_movement_type_filter(
        self,
        api_client: AsyncClient,
        superuser_headers: dict,
        test_school
    ):
        """Should filter by movement type."""
        response = await api_client.get(
            f"/api/v1/schools/{test_school.id}/inventory-logs?movement_type=sale",
            headers=superuser_headers
        )

        assert response.status_code == 200

    async def test_get_school_logs_with_sale_id_filter(
        self,
        api_client: AsyncClient,
        superuser_headers: dict,
        test_school
    ):
        """Should filter by sale ID."""
        fake_sale_id = uuid4()
        response = await api_client.get(
            f"/api/v1/schools/{test_school.id}/inventory-logs?sale_id={fake_sale_id}",
            headers=superuser_headers
        )

        assert response.status_code == 200

    async def test_get_school_logs_with_order_id_filter(
        self,
        api_client: AsyncClient,
        superuser_headers: dict,
        test_school
    ):
        """Should filter by order ID."""
        fake_order_id = uuid4()
        response = await api_client.get(
            f"/api/v1/schools/{test_school.id}/inventory-logs?order_id={fake_order_id}",
            headers=superuser_headers
        )

        assert response.status_code == 200

    async def test_get_school_logs_with_pagination(
        self,
        api_client: AsyncClient,
        superuser_headers: dict,
        test_school
    ):
        """Should support pagination."""
        response = await api_client.get(
            f"/api/v1/schools/{test_school.id}/inventory-logs?skip=0&limit=50",
            headers=superuser_headers
        )

        assert response.status_code == 200

    async def test_get_school_logs_unauthorized(
        self,
        api_client: AsyncClient,
        test_school
    ):
        """Should require authentication."""
        response = await api_client.get(
            f"/api/v1/schools/{test_school.id}/inventory-logs"
        )

        assert response.status_code in [401, 403]


class TestGlobalProductInventoryLogs:
    """Tests for GET /global/inventory/{product_id}/logs"""

    @NEEDS_ISOLATION_FIX
    async def test_get_global_product_logs_success(
        self,
        api_client: AsyncClient,
        superuser_headers: dict
    ):
        """Should return inventory logs for a global product."""
        fake_product_id = uuid4()
        response = await api_client.get(
            f"/api/v1/global/inventory/{fake_product_id}/logs",
            headers=superuser_headers
        )

        # May return 200 with empty list or 404
        assert response.status_code in [200, 404]

    @NEEDS_ISOLATION_FIX
    async def test_get_global_product_logs_with_pagination(
        self,
        api_client: AsyncClient,
        superuser_headers: dict
    ):
        """Should support pagination parameters."""
        fake_product_id = uuid4()
        response = await api_client.get(
            f"/api/v1/global/inventory/{fake_product_id}/logs?skip=0&limit=10",
            headers=superuser_headers
        )

        assert response.status_code in [200, 404]

    async def test_get_global_product_logs_unauthorized(
        self,
        api_client: AsyncClient
    ):
        """Should require authentication."""
        fake_product_id = uuid4()
        response = await api_client.get(
            f"/api/v1/global/inventory/{fake_product_id}/logs"
        )

        assert response.status_code in [401, 403]


class TestInventoryLogValidation:
    """Tests for inventory log validation."""

    async def test_pagination_limit_too_high(
        self,
        api_client: AsyncClient,
        superuser_headers: dict,
        test_school
    ):
        """Should reject limit higher than 500."""
        response = await api_client.get(
            f"/api/v1/schools/{test_school.id}/inventory-logs?limit=1000",
            headers=superuser_headers
        )

        # Should fail validation
        assert response.status_code in [400, 422]

    async def test_pagination_negative_skip(
        self,
        api_client: AsyncClient,
        superuser_headers: dict,
        test_school
    ):
        """Should reject negative skip value."""
        response = await api_client.get(
            f"/api/v1/schools/{test_school.id}/inventory-logs?skip=-1",
            headers=superuser_headers
        )

        # Should fail validation
        assert response.status_code in [400, 422]

    async def test_invalid_movement_type(
        self,
        api_client: AsyncClient,
        superuser_headers: dict,
        test_school
    ):
        """Should reject invalid movement type."""
        response = await api_client.get(
            f"/api/v1/schools/{test_school.id}/inventory-logs?movement_type=invalid_type",
            headers=superuser_headers
        )

        # Should fail validation
        assert response.status_code in [400, 422]
