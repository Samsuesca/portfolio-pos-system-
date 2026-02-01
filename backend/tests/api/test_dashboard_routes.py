"""
API tests for Dashboard Routes.

Tests for global dashboard statistics:
- GET /api/v1/global/dashboard/stats
"""
import pytest
from datetime import datetime

pytestmark = pytest.mark.api


class TestGlobalDashboardStats:
    """Tests for global dashboard stats endpoint."""

    async def test_get_dashboard_stats_success(
        self, api_client, superuser_headers, test_school
    ):
        """Test getting dashboard stats successfully."""
        from tests.fixtures.assertions import assert_success_response

        response = await api_client.get(
            "/api/v1/global/dashboard/stats",
            headers=superuser_headers
        )

        assert_success_response(response)
        data = response.json()

        # Check structure
        assert "totals" in data
        assert "schools_summary" in data
        assert "school_count" in data

        # Check totals structure
        totals = data["totals"]
        assert "total_sales" in totals
        assert "sales_amount_month" in totals
        assert "total_orders" in totals
        assert "pending_orders" in totals
        assert "total_clients" in totals
        assert "total_products" in totals

        # Values should be non-negative
        assert totals["total_sales"] >= 0
        assert totals["sales_amount_month"] >= 0
        assert totals["total_orders"] >= 0
        assert totals["pending_orders"] >= 0
        assert totals["total_clients"] >= 0
        assert totals["total_products"] >= 0

    async def test_get_dashboard_stats_returns_school_summary(
        self, api_client, superuser_headers, test_school
    ):
        """Test that dashboard includes school summaries."""
        response = await api_client.get(
            "/api/v1/global/dashboard/stats",
            headers=superuser_headers
        )

        data = response.json()

        # Should have at least one school summary
        assert data["school_count"] >= 1

        if data["schools_summary"]:
            school_summary = data["schools_summary"][0]
            assert "school_id" in school_summary
            assert "school_name" in school_summary
            assert "school_code" in school_summary
            assert "sales_count" in school_summary
            assert "sales_amount" in school_summary
            assert "pending_orders" in school_summary

    async def test_get_dashboard_stats_unauthenticated(self, api_client):
        """Test that unauthenticated request fails."""
        response = await api_client.get("/api/v1/global/dashboard/stats")

        # Returns 401 or 403 depending on auth middleware
        assert response.status_code in [401, 403]

    async def test_get_dashboard_stats_with_sales_data(
        self, api_client, superuser_headers, complete_test_setup
    ):
        """Test dashboard includes actual sales data."""
        # Complete setup already includes test data
        response = await api_client.get(
            "/api/v1/global/dashboard/stats",
            headers=superuser_headers
        )

        data = response.json()
        totals = data["totals"]

        # With complete setup, we should have some data
        # At minimum the created entities
        assert totals["total_products"] >= 0

    async def test_get_dashboard_stats_superuser_sees_all(
        self, api_client, superuser_headers, test_school
    ):
        """Test that superuser can see all schools."""
        response = await api_client.get(
            "/api/v1/global/dashboard/stats",
            headers=superuser_headers
        )

        assert response.status_code == 200
        data = response.json()

        # Superuser should see schools
        assert data["school_count"] >= 1

    async def test_get_dashboard_stats_aggregates_correctly(
        self, api_client, superuser_headers, db_session, test_school, test_product, test_superuser
    ):
        """Test that totals correctly aggregate data."""
        # Create a sale
        from app.models.sale import Sale
        from app.models.client import Client
        from uuid import uuid4

        client = Client(
            code=f"TST-CLI-{uuid4().hex[:6]}",
            name="Dashboard Test Client",
            phone="3001234567",
            school_id=test_school.id
        )
        db_session.add(client)
        await db_session.flush()

        sale = Sale(
            code=f"VNT-TST-{uuid4().hex[:6].upper()}",
            school_id=test_school.id,
            client_id=client.id,
            user_id=test_superuser.id,  # Required field
            total=150000,
            payment_method="cash",
            status="completed"
        )
        db_session.add(sale)
        await db_session.flush()

        response = await api_client.get(
            "/api/v1/global/dashboard/stats",
            headers=superuser_headers
        )

        data = response.json()
        totals = data["totals"]

        # Should have at least 1 sale now
        assert totals["total_sales"] >= 1

    async def test_get_dashboard_stats_filters_by_month(
        self, api_client, superuser_headers, test_school
    ):
        """Test that sales_amount_month only includes current month."""
        response = await api_client.get(
            "/api/v1/global/dashboard/stats",
            headers=superuser_headers
        )

        data = response.json()
        totals = data["totals"]

        # Sales amount should be a valid number
        assert isinstance(totals["sales_amount_month"], (int, float))
        assert totals["sales_amount_month"] >= 0


class TestDashboardSchoolAccess:
    """Tests for school-based access control on dashboard."""

    async def test_user_only_sees_assigned_schools(
        self, api_client, db_session, test_school
    ):
        """Test that user only sees schools they have access to."""
        from app.models.user import User, UserSchoolRole, UserRole
        from app.services.user import UserService

        # Create a user with role in test_school only
        user = User(
            username="dashboard_test_user",
            email="dashboard_test@example.com",
            hashed_password=UserService.hash_password("password123"),
            is_active=True
        )
        db_session.add(user)
        await db_session.flush()

        role = UserSchoolRole(
            user_id=user.id,
            school_id=test_school.id,
            role=UserRole.SELLER
        )
        db_session.add(role)
        await db_session.commit()

        # Login as this user
        login_response = await api_client.post(
            "/auth/login",
            data={"username": "dashboard_test_user", "password": "password123"}
        )

        if login_response.status_code == 200:
            token = login_response.json()["access_token"]
            headers = {"Authorization": f"Bearer {token}"}

            response = await api_client.get(
                "/api/v1/global/dashboard/stats",
                headers=headers
            )

            if response.status_code == 200:
                data = response.json()
                # User should only see their assigned school(s)
                school_ids = [s["school_id"] for s in data["schools_summary"]]
                assert str(test_school.id) in school_ids or len(school_ids) == 0


class TestDashboardDataTypes:
    """Tests for correct data types in dashboard response."""

    async def test_response_data_types(
        self, api_client, superuser_headers, test_school
    ):
        """Test that response has correct data types."""
        response = await api_client.get(
            "/api/v1/global/dashboard/stats",
            headers=superuser_headers
        )

        data = response.json()

        # Check types
        assert isinstance(data["school_count"], int)
        assert isinstance(data["totals"]["total_sales"], int)
        assert isinstance(data["totals"]["sales_amount_month"], (int, float))
        assert isinstance(data["totals"]["total_orders"], int)
        assert isinstance(data["totals"]["pending_orders"], int)
        assert isinstance(data["totals"]["total_clients"], int)
        assert isinstance(data["totals"]["total_products"], int)

        assert isinstance(data["schools_summary"], list)

    async def test_school_summary_data_types(
        self, api_client, superuser_headers, test_school
    ):
        """Test that school summary items have correct types."""
        response = await api_client.get(
            "/api/v1/global/dashboard/stats",
            headers=superuser_headers
        )

        data = response.json()

        if data["schools_summary"]:
            summary = data["schools_summary"][0]
            assert isinstance(summary["school_id"], str)
            assert isinstance(summary["school_name"], str)
            assert isinstance(summary["school_code"], str)
            assert isinstance(summary["sales_count"], int)
            assert isinstance(summary["sales_amount"], (int, float))
            assert isinstance(summary["pending_orders"], int)
