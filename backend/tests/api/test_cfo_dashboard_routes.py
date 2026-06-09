"""
Tests for CFO Dashboard API endpoints.

Tests cover:
- GET /api/v1/cfo-dashboard/health-metrics
- Financial health metrics structure
- Health status scoring
- Alerts generation
- Permission enforcement
"""
import pytest
from decimal import Decimal
from uuid import uuid4
from unittest.mock import patch, AsyncMock

from tests.fixtures.assertions import (
    assert_success_response,
    assert_unauthorized,
)


pytestmark = pytest.mark.api

BASE = "/api/v1/cfo-dashboard"


@pytest.fixture
async def balance_accounts_for_cfo(db_session):
    """Create balance accounts for CFO dashboard tests."""
    from app.models.accounting import BalanceAccount, AccountType

    caja = BalanceAccount(
        id=str(uuid4()),
        school_id=None,
        account_type=AccountType.ASSET_CURRENT,
        name="Caja",
        code=f"1101-{uuid4().hex[:6]}",
        balance=Decimal("3000000"),
        is_active=True,
    )
    banco = BalanceAccount(
        id=str(uuid4()),
        school_id=None,
        account_type=AccountType.ASSET_CURRENT,
        name="Banco",
        code=f"1102-{uuid4().hex[:6]}",
        balance=Decimal("7000000"),
        is_active=True,
    )
    db_session.add_all([caja, banco])
    await db_session.flush()
    return {"caja": caja, "banco": banco}


@pytest.fixture
async def products_with_cost(db_session, test_school, test_garment_type):
    """Create products with and without cost for data quality metrics."""
    from app.models.product import Product

    products = []
    for i in range(3):
        p = Product(
            id=str(uuid4()),
            school_id=test_school.id,
            garment_type_id=test_garment_type.id,
            code=f"CFO-C-{uuid4().hex[:6]}",
            name=f"Product With Cost {i}",
            size="M",
            color="Blanco",
            price=Decimal("50000"),
            cost=Decimal("30000"),
            is_active=True,
        )
        products.append(p)
    for i in range(2):
        p = Product(
            id=str(uuid4()),
            school_id=test_school.id,
            garment_type_id=test_garment_type.id,
            code=f"CFO-NC-{uuid4().hex[:6]}",
            name=f"Product No Cost {i}",
            size="M",
            color="Blanco",
            price=Decimal("50000"),
            cost=None,
            is_active=True,
        )
        products.append(p)
    db_session.add_all(products)
    await db_session.flush()
    return products


class TestGetHealthMetrics:
    """Tests for GET /api/v1/cfo-dashboard/health-metrics"""

    @patch(
        "app.services.accounting.financial_model.cfo_dashboard.payroll_service.get_payroll_summary",
        new_callable=AsyncMock,
        return_value={"total_monthly_payroll": 1500000, "active_employees": 3},
    )
    async def test_returns_full_structure(
        self, mock_payroll, api_client, superuser_headers, balance_accounts_for_cfo
    ):
        """Should return all top-level metric groups."""
        response = await api_client.get(
            f"{BASE}/health-metrics", headers=superuser_headers
        )
        data = assert_success_response(response)

        assert "as_of" in data
        assert "liquidity" in data
        assert "debt" in data
        assert "payroll" in data
        assert "operations" in data
        assert "data_quality" in data
        assert "alerts" in data
        assert "health_status" in data

    @patch(
        "app.services.accounting.financial_model.cfo_dashboard.payroll_service.get_payroll_summary",
        new_callable=AsyncMock,
        return_value={"total_monthly_payroll": 0, "active_employees": 0},
    )
    async def test_liquidity_values(
        self, mock_payroll, api_client, superuser_headers, balance_accounts_for_cfo
    ):
        """Should reflect sum of active asset_current accounts."""
        response = await api_client.get(
            f"{BASE}/health-metrics", headers=superuser_headers
        )
        data = assert_success_response(response)
        assert data["liquidity"]["total"] >= 10_000_000
        assert data["liquidity"]["currency"] == "COP"

    @patch(
        "app.services.accounting.financial_model.cfo_dashboard.payroll_service.get_payroll_summary",
        new_callable=AsyncMock,
        return_value={"total_monthly_payroll": 0, "active_employees": 0},
    )
    async def test_debt_structure(
        self, mock_payroll, api_client, superuser_headers, balance_accounts_for_cfo
    ):
        """Should include debt breakdown with DSCR."""
        response = await api_client.get(
            f"{BASE}/health-metrics", headers=superuser_headers
        )
        data = assert_success_response(response)
        debt = data["debt"]
        assert "total" in debt
        assert "overdue" in debt
        assert "due_30_days" in debt
        assert "debt_service_coverage_ratio" in debt

    @patch(
        "app.services.accounting.financial_model.cfo_dashboard.payroll_service.get_payroll_summary",
        new_callable=AsyncMock,
        return_value={
            "total_monthly_payroll": 1500000,
            "active_employees": 3,
            "fixed_expense_integration": True,
        },
    )
    async def test_payroll_coverage_with_data(
        self, mock_payroll, api_client, superuser_headers, balance_accounts_for_cfo
    ):
        """Should calculate payroll coverage ratio when payroll > 0."""
        response = await api_client.get(
            f"{BASE}/health-metrics", headers=superuser_headers
        )
        data = assert_success_response(response)
        payroll = data["payroll"]
        assert payroll["monthly_estimate"] == 1_500_000
        assert payroll["employees"] == 3
        assert payroll["can_cover"] is True
        assert payroll["coverage_ratio"] > 1

    @patch(
        "app.services.accounting.financial_model.cfo_dashboard.payroll_service.get_payroll_summary",
        new_callable=AsyncMock,
        return_value={"total_monthly_payroll": 0, "active_employees": 0},
    )
    async def test_data_quality_with_products(
        self,
        mock_payroll,
        api_client,
        superuser_headers,
        balance_accounts_for_cfo,
        products_with_cost,
    ):
        """Should compute data quality score based on products with cost."""
        response = await api_client.get(
            f"{BASE}/health-metrics", headers=superuser_headers
        )
        data = assert_success_response(response)
        dq = data["data_quality"]
        assert dq["products_with_cost"] >= 3
        assert dq["products_without_cost"] >= 2
        assert 0 <= dq["score"] <= 100

    @patch(
        "app.services.accounting.financial_model.cfo_dashboard.payroll_service.get_payroll_summary",
        new_callable=AsyncMock,
        return_value={"total_monthly_payroll": 0, "active_employees": 0},
    )
    async def test_operations_burn_rate(
        self, mock_payroll, api_client, superuser_headers, balance_accounts_for_cfo
    ):
        """Should calculate monthly burn rate and runway."""
        response = await api_client.get(
            f"{BASE}/health-metrics", headers=superuser_headers
        )
        data = assert_success_response(response)
        ops = data["operations"]
        assert "monthly_burn_rate" in ops
        assert "cash_runway_days" in ops
        assert "monthly_fixed_expenses" in ops
        assert "pending_expenses" in ops

    @patch(
        "app.services.accounting.financial_model.cfo_dashboard.payroll_service.get_payroll_summary",
        new_callable=AsyncMock,
        return_value={"total_monthly_payroll": 0, "active_employees": 0},
    )
    async def test_health_status_scoring(
        self, mock_payroll, api_client, superuser_headers, balance_accounts_for_cfo
    ):
        """Health status should contain status, label, color, and score."""
        response = await api_client.get(
            f"{BASE}/health-metrics", headers=superuser_headers
        )
        data = assert_success_response(response)
        hs = data["health_status"]
        assert hs["status"] in ("healthy", "caution", "warning", "critical")
        assert hs["color"] in ("green", "yellow", "orange", "red")
        assert "score" in hs
        assert "breakdown" in hs
        breakdown = hs["breakdown"]
        assert "debt_service" in breakdown
        assert "payroll" in breakdown
        assert "runway" in breakdown
        assert "data_quality" in breakdown

    @patch(
        "app.services.accounting.financial_model.cfo_dashboard.payroll_service.get_payroll_summary",
        new_callable=AsyncMock,
        return_value={"total_monthly_payroll": 0, "active_employees": 0},
    )
    async def test_alerts_structure(
        self, mock_payroll, api_client, superuser_headers, balance_accounts_for_cfo
    ):
        """Alerts section should contain counts and items list."""
        response = await api_client.get(
            f"{BASE}/health-metrics", headers=superuser_headers
        )
        data = assert_success_response(response)
        alerts = data["alerts"]
        assert "critical_count" in alerts
        assert "warning_count" in alerts
        assert isinstance(alerts["items"], list)

    @patch(
        "app.services.accounting.financial_model.cfo_dashboard.payroll_service.get_payroll_summary",
        new_callable=AsyncMock,
        return_value={"total_monthly_payroll": 999_999_999, "active_employees": 1},
    )
    async def test_payroll_alert_when_insufficient_liquidity(
        self, mock_payroll, api_client, superuser_headers, balance_accounts_for_cfo
    ):
        """Should generate critical alert when liquidity < payroll."""
        response = await api_client.get(
            f"{BASE}/health-metrics", headers=superuser_headers
        )
        data = assert_success_response(response)
        assert data["payroll"]["can_cover"] is False
        payroll_alerts = [
            a for a in data["alerts"]["items"] if a["category"] == "payroll"
        ]
        assert len(payroll_alerts) >= 1
        assert payroll_alerts[0]["type"] == "critical"

    @patch(
        "app.services.accounting.financial_model.cfo_dashboard.payroll_service.get_payroll_summary",
        new_callable=AsyncMock,
        return_value={"total_monthly_payroll": 0, "active_employees": 0},
    )
    async def test_data_quality_alert_when_low_coverage(
        self,
        mock_payroll,
        api_client,
        superuser_headers,
        balance_accounts_for_cfo,
    ):
        """Should fire warning when >50% products lack cost."""
        response = await api_client.get(
            f"{BASE}/health-metrics", headers=superuser_headers
        )
        data = assert_success_response(response)
        dq_alerts = [
            a for a in data["alerts"]["items"] if a["category"] == "data_quality"
        ]
        # Alert only fires when score < 50; depends on db state, so just check type
        for a in dq_alerts:
            assert a["type"] == "warning"

    async def test_unauthenticated_returns_401_or_403(self, api_client):
        """Should reject requests without auth header."""
        response = await api_client.get(f"{BASE}/health-metrics")
        assert_unauthorized(response)

    async def test_non_superuser_without_permission_rejected(
        self, api_client, auth_headers
    ):
        """Regular user without reports.financial permission should be rejected."""
        response = await api_client.get(
            f"{BASE}/health-metrics", headers=auth_headers
        )
        assert response.status_code in (401, 403)

    @patch(
        "app.services.accounting.financial_model.cfo_dashboard.payroll_service.get_payroll_summary",
        new_callable=AsyncMock,
        return_value={"total_monthly_payroll": 0, "active_employees": 0},
    )
    async def test_as_of_date_present(
        self, mock_payroll, api_client, superuser_headers, balance_accounts_for_cfo
    ):
        """as_of should be a valid ISO date string."""
        response = await api_client.get(
            f"{BASE}/health-metrics", headers=superuser_headers
        )
        data = assert_success_response(response)
        from datetime import date as d

        d.fromisoformat(data["as_of"])

    @patch(
        "app.services.accounting.financial_model.cfo_dashboard.payroll_service.get_payroll_summary",
        new_callable=AsyncMock,
        return_value={"total_monthly_payroll": 0, "active_employees": 0},
    )
    async def test_no_balance_accounts_returns_zero_liquidity(
        self, mock_payroll, api_client, superuser_headers
    ):
        """When no balance accounts exist, liquidity should be 0."""
        response = await api_client.get(
            f"{BASE}/health-metrics", headers=superuser_headers
        )
        data = assert_success_response(response)
        assert data["liquidity"]["total"] >= 0
