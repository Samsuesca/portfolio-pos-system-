"""
Tests for Global Reports API endpoints.

Tests cover:
- GET /api/v1/global/reports/sales/summary
- GET /api/v1/global/reports/sales/top-products
- GET /api/v1/global/reports/sales/top-clients
- GET /api/v1/global/reports/sales/monthly
- GET /api/v1/global/reports/profitability/by-school
"""
import pytest
from decimal import Decimal
from uuid import uuid4
from datetime import date

from app.models.sale import SaleStatus, PaymentMethod

from tests.fixtures.assertions import (
    assert_success_response,
    assert_unauthorized,
)


pytestmark = pytest.mark.api

BASE = "/api/v1/global/reports"


class TestGlobalSalesSummary:
    """Tests for GET /sales/summary"""

    async def test_returns_summary_structure(
        self, api_client, superuser_headers, test_sale
    ):
        response = await api_client.get(
            f"{BASE}/sales/summary", headers=superuser_headers
        )
        data = assert_success_response(response)
        assert "total_sales" in data
        assert "total_revenue" in data
        assert "average_ticket" in data
        assert "sales_by_payment" in data
        assert "sales_by_school" in data

    async def test_summary_with_date_filters(
        self, api_client, superuser_headers, test_sale
    ):
        today = date.today().isoformat()
        response = await api_client.get(
            f"{BASE}/sales/summary?start_date={today}&end_date={today}",
            headers=superuser_headers,
        )
        data = assert_success_response(response)
        assert data["start_date"] == today
        assert data["end_date"] == today

    async def test_summary_with_school_filter(
        self, api_client, superuser_headers, test_sale, test_school
    ):
        response = await api_client.get(
            f"{BASE}/sales/summary?school_id={test_school.id}",
            headers=superuser_headers,
        )
        data = assert_success_response(response)
        assert data["school_id"] == str(test_school.id)
        assert data["sales_by_school"] == []

    async def test_summary_counts_completed_sales(
        self, api_client, superuser_headers, test_sale
    ):
        response = await api_client.get(
            f"{BASE}/sales/summary", headers=superuser_headers
        )
        data = assert_success_response(response)
        assert data["total_sales"] >= 1
        assert data["total_revenue"] > 0

    async def test_unauthenticated(self, api_client):
        response = await api_client.get(f"{BASE}/sales/summary")
        assert_unauthorized(response)


class TestGlobalTopProducts:
    """Tests for GET /sales/top-products"""

    async def test_returns_list(self, api_client, superuser_headers, test_sale):
        response = await api_client.get(
            f"{BASE}/sales/top-products", headers=superuser_headers
        )
        data = assert_success_response(response)
        assert isinstance(data, list)

    async def test_with_limit(self, api_client, superuser_headers, test_sale):
        response = await api_client.get(
            f"{BASE}/sales/top-products?limit=5", headers=superuser_headers
        )
        data = assert_success_response(response)
        assert len(data) <= 5

    async def test_product_item_structure(
        self, api_client, superuser_headers, test_sale
    ):
        response = await api_client.get(
            f"{BASE}/sales/top-products", headers=superuser_headers
        )
        data = assert_success_response(response)
        if data:
            item = data[0]
            assert "product_id" in item
            assert "product_code" in item
            assert "product_name" in item
            assert "units_sold" in item
            assert "total_revenue" in item

    async def test_unauthenticated(self, api_client):
        response = await api_client.get(f"{BASE}/sales/top-products")
        assert_unauthorized(response)


class TestGlobalTopClients:
    """Tests for GET /sales/top-clients"""

    async def test_returns_list(self, api_client, superuser_headers, test_sale):
        response = await api_client.get(
            f"{BASE}/sales/top-clients", headers=superuser_headers
        )
        data = assert_success_response(response)
        assert isinstance(data, list)

    async def test_client_item_structure(
        self, api_client, superuser_headers, test_sale
    ):
        response = await api_client.get(
            f"{BASE}/sales/top-clients", headers=superuser_headers
        )
        data = assert_success_response(response)
        if data:
            item = data[0]
            assert "client_id" in item
            assert "client_name" in item
            assert "total_purchases" in item
            assert "total_spent" in item

    async def test_with_school_filter(
        self, api_client, superuser_headers, test_sale, test_school
    ):
        response = await api_client.get(
            f"{BASE}/sales/top-clients?school_id={test_school.id}",
            headers=superuser_headers,
        )
        assert_success_response(response)


class TestMonthlySalesBreakdown:
    """Tests for GET /sales/monthly"""

    async def test_returns_monthly_structure(
        self, api_client, superuser_headers, test_sale
    ):
        response = await api_client.get(
            f"{BASE}/sales/monthly", headers=superuser_headers
        )
        data = assert_success_response(response)
        assert "months" in data
        assert "totals" in data
        assert "start_date" in data
        assert "end_date" in data
        assert isinstance(data["months"], list)

    async def test_month_item_structure(
        self, api_client, superuser_headers, test_sale
    ):
        response = await api_client.get(
            f"{BASE}/sales/monthly", headers=superuser_headers
        )
        data = assert_success_response(response)
        if data["months"]:
            month = data["months"][0]
            assert "period" in month
            assert "period_label" in month
            assert "sales_count" in month
            assert "total_revenue" in month
            assert "average_ticket" in month

    async def test_with_explicit_date_range(
        self, api_client, superuser_headers, test_sale
    ):
        response = await api_client.get(
            f"{BASE}/sales/monthly?start_date=2026-01-01&end_date=2026-12-31",
            headers=superuser_headers,
        )
        data = assert_success_response(response)
        assert data["start_date"] == "2026-01-01"
        assert data["end_date"] == "2026-12-31"

    async def test_unauthenticated(self, api_client):
        response = await api_client.get(f"{BASE}/sales/monthly")
        assert_unauthorized(response)


class TestProfitabilityBySchool:
    """Tests for GET /profitability/by-school"""

    async def test_returns_profitability_structure(
        self, api_client, superuser_headers, test_sale
    ):
        response = await api_client.get(
            f"{BASE}/profitability/by-school", headers=superuser_headers
        )
        data = assert_success_response(response)
        assert "schools" in data
        assert "totals" in data
        assert isinstance(data["schools"], list)

    async def test_school_profitability_fields(
        self, api_client, superuser_headers, test_sale
    ):
        response = await api_client.get(
            f"{BASE}/profitability/by-school", headers=superuser_headers
        )
        data = assert_success_response(response)
        if data["schools"]:
            school = data["schools"][0]
            assert "school_id" in school
            assert "school_name" in school
            assert "revenue" in school
            assert "cogs" in school
            assert "gross_profit" in school
            assert "gross_margin" in school

    async def test_totals_structure(
        self, api_client, superuser_headers, test_sale
    ):
        response = await api_client.get(
            f"{BASE}/profitability/by-school", headers=superuser_headers
        )
        data = assert_success_response(response)
        totals = data["totals"]
        assert "revenue" in totals
        assert "cogs" in totals
        assert "gross_profit" in totals
        assert "gross_margin" in totals
