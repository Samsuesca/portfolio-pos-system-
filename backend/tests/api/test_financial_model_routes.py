"""
Tests for Financial Model API endpoints.

Tests cover:
- GET  /api/v1/global/accounting/financial-model/kpis
- GET  /api/v1/global/accounting/financial-model/profitability/by-school
- GET  /api/v1/global/accounting/financial-model/trends
- GET  /api/v1/global/accounting/financial-model/budgets
- POST /api/v1/global/accounting/financial-model/budgets
- DELETE /api/v1/global/accounting/financial-model/budgets/{budget_id}
- GET  /api/v1/global/accounting/financial-model/budget-vs-actual
- GET  /api/v1/global/accounting/financial-model/cash-forecast
- GET  /api/v1/global/accounting/financial-model/health-alerts
- GET  /api/v1/global/accounting/financial-model/executive-summary
"""
import pytest
from datetime import date, datetime
from decimal import Decimal
from uuid import uuid4
from unittest.mock import patch, AsyncMock

from tests.fixtures.assertions import (
    assert_success_response,
    assert_no_content_response,
    assert_unauthorized,
)


pytestmark = pytest.mark.api

BASE = "/api/v1/global/accounting/financial-model"


# ---------- Builders for valid response payloads ----------

def _kpi_dashboard_payload() -> dict:
    return {
        "period": "monthly",
        "generated_at": datetime(2026, 4, 14, 10, 0).isoformat(),
        "kpis": [],
    }


def _profitability_payload() -> dict:
    return {
        "start_date": "2026-01-01",
        "end_date": "2026-03-31",
        "total_revenue": "0",
        "schools": [],
    }


def _trend_payload() -> dict:
    return {
        "start_date": "2026-01-01",
        "end_date": "2026-03-31",
        "period": "monthly",
        "series": [],
        "anomalies": [],
    }


def _budget_payload() -> dict:
    return {
        "id": str(uuid4()),
        "period_type": "monthly",
        "period_start": "2026-01-01",
        "period_end": "2026-01-31",
        "category": "revenue",
        "school_id": None,
        "budgeted_amount": "5000000",
        "notes": None,
        "created_by": None,
        "created_at": datetime(2026, 1, 1).isoformat(),
        "updated_at": datetime(2026, 1, 1).isoformat(),
    }


def _budget_vs_actual_payload() -> dict:
    return {
        "period_type": "monthly",
        "period_start": "2026-01-01",
        "period_end": "2026-01-31",
        "items": [],
        "total_budgeted": "0",
        "total_actual": "0",
        "total_variance": "0",
    }


def _cash_forecast_payload() -> dict:
    return {
        "current_balance": "1000000",
        "min_threshold": "500000",
        "runway_months": "6",
        "scenarios": [],
    }


def _health_alerts_payload() -> dict:
    return {
        "generated_at": datetime(2026, 4, 14, 10, 0).isoformat(),
        "alerts": [],
        "critical_count": 0,
        "warning_count": 0,
        "info_count": 0,
    }


def _executive_summary_payload() -> dict:
    return {
        "period": "2026-03",
        "period_label": "Marzo 2026",
        "generated_at": datetime(2026, 4, 1, 0, 0).isoformat(),
        "revenue": "10000000",
        "expenses": "5000000",
        "net_profit": "5000000",
        "cash_position": "8000000",
        "revenue_vs_previous": None,
        "expenses_vs_previous": None,
        "profit_vs_previous": None,
        "top_schools": [],
        "top_expense_categories": [],
        "kpi_snapshot": [],
        "active_alerts": [],
        "forecast_summary": "",
    }


class TestGetKPIs:
    """Tests for GET /kpis"""

    @patch("app.api.routes.financial_model.KPIService")
    async def test_returns_kpis_default_params(
        self, MockKPIService, api_client, superuser_headers
    ):
        mock_instance = MockKPIService.return_value
        mock_instance.compute_kpis = AsyncMock(return_value=_kpi_dashboard_payload())
        response = await api_client.get(f"{BASE}/kpis", headers=superuser_headers)
        assert_success_response(response)
        mock_instance.compute_kpis.assert_awaited_once()

    @patch("app.api.routes.financial_model.KPIService")
    async def test_kpis_with_custom_months(
        self, MockKPIService, api_client, superuser_headers
    ):
        mock_instance = MockKPIService.return_value
        mock_instance.compute_kpis = AsyncMock(return_value=_kpi_dashboard_payload())
        response = await api_client.get(
            f"{BASE}/kpis?months=12", headers=superuser_headers
        )
        assert_success_response(response)
        mock_instance.compute_kpis.assert_awaited_once_with(months=12, school_id=None)

    async def test_kpis_unauthenticated(self, api_client):
        response = await api_client.get(f"{BASE}/kpis")
        assert_unauthorized(response)


class TestProfitabilityBySchool:
    """Tests for GET /profitability/by-school"""

    @patch("app.api.routes.financial_model.ProfitabilityService")
    async def test_returns_profitability(
        self, MockService, api_client, superuser_headers
    ):
        mock_instance = MockService.return_value
        mock_instance.get_profitability_by_school = AsyncMock(
            return_value=_profitability_payload()
        )
        response = await api_client.get(
            f"{BASE}/profitability/by-school", headers=superuser_headers
        )
        assert_success_response(response)

    @patch("app.api.routes.financial_model.ProfitabilityService")
    async def test_invalid_school_ids_returns_400(
        self, MockService, api_client, superuser_headers
    ):
        response = await api_client.get(
            f"{BASE}/profitability/by-school?school_ids=not-a-uuid",
            headers=superuser_headers,
        )
        assert response.status_code == 400

    @patch("app.api.routes.financial_model.ProfitabilityService")
    async def test_with_valid_school_ids(
        self, MockService, api_client, superuser_headers
    ):
        mock_instance = MockService.return_value
        mock_instance.get_profitability_by_school = AsyncMock(
            return_value=_profitability_payload()
        )
        sid = str(uuid4())
        response = await api_client.get(
            f"{BASE}/profitability/by-school?school_ids={sid}",
            headers=superuser_headers,
        )
        assert_success_response(response)


class TestTrends:
    """Tests for GET /trends"""

    @patch("app.api.routes.financial_model.TrendAnalysisService")
    async def test_returns_trends(self, MockService, api_client, superuser_headers):
        mock_instance = MockService.return_value
        mock_instance.get_trends = AsyncMock(return_value=_trend_payload())
        response = await api_client.get(f"{BASE}/trends", headers=superuser_headers)
        assert_success_response(response)

    @patch("app.api.routes.financial_model.TrendAnalysisService")
    async def test_custom_metrics(self, MockService, api_client, superuser_headers):
        mock_instance = MockService.return_value
        mock_instance.get_trends = AsyncMock(return_value=_trend_payload())
        response = await api_client.get(
            f"{BASE}/trends?metrics=revenue", headers=superuser_headers
        )
        assert_success_response(response)
        call_kwargs = mock_instance.get_trends.call_args.kwargs
        assert call_kwargs["metrics"] == ["revenue"]


class TestBudgets:
    """Tests for GET/POST/DELETE /budgets"""

    @patch("app.api.routes.financial_model.BudgetService")
    async def test_list_budgets(self, MockService, api_client, superuser_headers):
        mock_instance = MockService.return_value
        mock_instance.get_budgets = AsyncMock(return_value=[])
        response = await api_client.get(f"{BASE}/budgets", headers=superuser_headers)
        assert_success_response(response)

    @patch("app.api.routes.financial_model.BudgetService")
    async def test_create_budget(self, MockService, api_client, superuser_headers):
        mock_instance = MockService.return_value
        mock_instance.create_budget = AsyncMock(return_value=_budget_payload())
        response = await api_client.post(
            f"{BASE}/budgets",
            json={
                "period_type": "monthly",
                "period_start": "2026-01-01",
                "period_end": "2026-01-31",
                "category": "revenue",
                "budgeted_amount": "5000000",
            },
            headers=superuser_headers,
        )
        assert response.status_code == 201

    @patch("app.api.routes.financial_model.BudgetService")
    async def test_delete_budget_success(
        self, MockService, api_client, superuser_headers
    ):
        mock_instance = MockService.return_value
        mock_instance.delete_budget = AsyncMock(return_value=True)
        bid = str(uuid4())
        response = await api_client.delete(
            f"{BASE}/budgets/{bid}", headers=superuser_headers
        )
        assert_no_content_response(response)

    @patch("app.api.routes.financial_model.BudgetService")
    async def test_delete_budget_not_found(
        self, MockService, api_client, superuser_headers
    ):
        mock_instance = MockService.return_value
        mock_instance.delete_budget = AsyncMock(return_value=False)
        bid = str(uuid4())
        response = await api_client.delete(
            f"{BASE}/budgets/{bid}", headers=superuser_headers
        )
        assert response.status_code == 404


class TestBudgetVsActual:
    """Tests for GET /budget-vs-actual"""

    @patch("app.api.routes.financial_model.BudgetService")
    async def test_budget_vs_actual(self, MockService, api_client, superuser_headers):
        mock_instance = MockService.return_value
        mock_instance.get_budget_vs_actual = AsyncMock(
            return_value=_budget_vs_actual_payload()
        )
        response = await api_client.get(
            f"{BASE}/budget-vs-actual?period_type=monthly&period_start=2026-01-01",
            headers=superuser_headers,
        )
        assert_success_response(response)

    async def test_missing_required_params_returns_400(
        self, api_client, superuser_headers
    ):
        # Handler global del proyecto convierte RequestValidationError a 400.
        response = await api_client.get(
            f"{BASE}/budget-vs-actual", headers=superuser_headers
        )
        assert response.status_code == 400


class TestCashForecast:
    """Tests for GET /cash-forecast"""

    @patch("app.api.routes.financial_model.CashForecastService")
    async def test_returns_forecast(self, MockService, api_client, superuser_headers):
        mock_instance = MockService.return_value
        mock_instance.get_forecast = AsyncMock(return_value=_cash_forecast_payload())
        response = await api_client.get(
            f"{BASE}/cash-forecast", headers=superuser_headers
        )
        assert_success_response(response)


class TestHealthAlerts:
    """Tests for GET /health-alerts"""

    @patch("app.api.routes.financial_model.HealthAlertService")
    async def test_returns_alerts(self, MockService, api_client, superuser_headers):
        mock_instance = MockService.return_value
        mock_instance.get_alerts = AsyncMock(return_value=_health_alerts_payload())
        response = await api_client.get(
            f"{BASE}/health-alerts", headers=superuser_headers
        )
        assert_success_response(response)


class TestExecutiveSummary:
    """Tests for GET /executive-summary"""

    @patch("app.api.routes.financial_model.ExecutiveSummaryService")
    async def test_returns_summary(self, MockService, api_client, superuser_headers):
        mock_instance = MockService.return_value
        mock_instance.get_summary = AsyncMock(return_value=_executive_summary_payload())
        response = await api_client.get(
            f"{BASE}/executive-summary", headers=superuser_headers
        )
        assert_success_response(response)

    @patch("app.api.routes.financial_model.ExecutiveSummaryService")
    async def test_with_period_param(self, MockService, api_client, superuser_headers):
        mock_instance = MockService.return_value
        mock_instance.get_summary = AsyncMock(return_value=_executive_summary_payload())
        response = await api_client.get(
            f"{BASE}/executive-summary?period=2026-03", headers=superuser_headers
        )
        assert_success_response(response)

    @patch("app.api.routes.financial_model.ExecutiveSummaryService")
    async def test_invalid_period_returns_400(
        self, MockService, api_client, superuser_headers
    ):
        mock_instance = MockService.return_value
        mock_instance.get_summary = AsyncMock(side_effect=ValueError("Invalid period"))
        response = await api_client.get(
            f"{BASE}/executive-summary?period=bad-format",
            headers=superuser_headers,
        )
        assert response.status_code == 400

    async def test_unauthenticated(self, api_client):
        response = await api_client.get(f"{BASE}/executive-summary")
        assert_unauthorized(response)
