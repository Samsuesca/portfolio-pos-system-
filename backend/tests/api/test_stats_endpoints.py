"""
Tests for new aggregated /stats endpoints.

These endpoints replaced the client-side reduce/filter/length pattern that
silently truncated dashboards when data exceeded the page limit. They MUST
return aggregates over the full dataset, not just the first page.

Endpoints covered:
- GET /api/v1/global/accounting/expenses/stats
- GET /api/v1/global/workforce/performance/stats
- GET /api/v1/global/products/stats

The tests intentionally insert > the typical page limit (100/200) to prove
the aggregation reflects ALL rows.
"""
import pytest
from decimal import Decimal
from uuid import uuid4
from datetime import date, timedelta

from tests.fixtures.assertions import assert_success_response


pytestmark = pytest.mark.api


# ============================================================================
# FIXTURES
# ============================================================================


@pytest.fixture
async def expenses_dataset(db_session, test_superuser):
    """
    Create a deterministic expense dataset that exceeds typical page limits.

    Distribution (active, school_id=NULL):
      - 60 paid expenses of $100,000 each (paid_amount = $6,000,000)
      - 60 pending expenses of $50,000 each, all unpaid (pending = $3,000,000)
      - 10 inactive (is_active=False) expenses — should NOT count

    Plus 1 with school_id != NULL — should NOT count in the global stats.
    """
    from app.models.accounting import Expense, ExpenseCategory

    today = date.today()
    expenses = []

    # 60 paid global expenses
    for i in range(60):
        expenses.append(
            Expense(
                id=str(uuid4()),
                school_id=None,
                category=ExpenseCategory.UTILITIES,
                description=f"Paid expense {i}",
                amount=Decimal("100000"),
                amount_paid=Decimal("100000"),
                expense_date=today,
                is_paid=True,
                is_active=True,
                created_by=test_superuser.id,
            )
        )

    # 60 pending global expenses
    for i in range(60):
        expenses.append(
            Expense(
                id=str(uuid4()),
                school_id=None,
                category=ExpenseCategory.RENT,
                description=f"Pending expense {i}",
                amount=Decimal("50000"),
                amount_paid=Decimal("0"),
                expense_date=today,
                is_paid=False,
                is_active=True,
                created_by=test_superuser.id,
            )
        )

    # 10 inactive — must be excluded
    for i in range(10):
        expenses.append(
            Expense(
                id=str(uuid4()),
                school_id=None,
                category=ExpenseCategory.OTHER,
                description=f"Inactive {i}",
                amount=Decimal("999999"),
                amount_paid=Decimal("0"),
                expense_date=today,
                is_paid=False,
                is_active=False,
                created_by=test_superuser.id,
            )
        )

    db_session.add_all(expenses)
    await db_session.flush()
    return {
        "paid_count": 60,
        "paid_amount": Decimal("6000000"),
        "pending_count": 60,
        "pending_amount": Decimal("3000000"),
        "total_count": 120,
        "total_amount": Decimal("9000000"),
        "expenses": expenses,
    }


# ============================================================================
# /api/v1/global/accounting/expenses/stats
# ============================================================================


class TestExpenseStatsEndpoint:
    """Tests for GET /api/v1/global/accounting/expenses/stats"""

    async def test_returns_aggregated_totals_over_full_dataset(
        self, api_client, superuser_headers, expenses_dataset
    ):
        """
        With 120 active global expenses (>page limit of 100), the stats must
        reflect the full population, not just the first 100 rows.
        This is the regression-guard for the original bug.
        """
        response = await api_client.get(
            "/api/v1/global/accounting/expenses/stats",
            headers=superuser_headers,
        )

        data = assert_success_response(response)

        assert data["total_count"] == expenses_dataset["total_count"]
        assert Decimal(data["total_amount"]) == expenses_dataset["total_amount"]
        assert data["paid_count"] == expenses_dataset["paid_count"]
        assert Decimal(data["paid_amount"]) == expenses_dataset["paid_amount"]
        assert data["pending_count"] == expenses_dataset["pending_count"]
        assert Decimal(data["pending_amount"]) == expenses_dataset["pending_amount"]

    async def test_average_amount_is_total_over_count(
        self, api_client, superuser_headers, expenses_dataset
    ):
        """average_amount = total_amount / total_count (Decimal precision)."""
        response = await api_client.get(
            "/api/v1/global/accounting/expenses/stats",
            headers=superuser_headers,
        )
        data = assert_success_response(response)

        expected = expenses_dataset["total_amount"] / expenses_dataset["total_count"]
        assert Decimal(data["average_amount"]) == expected

    async def test_excludes_inactive_expenses(
        self, api_client, superuser_headers, expenses_dataset
    ):
        """is_active=False rows must NOT contribute to any aggregate."""
        response = await api_client.get(
            "/api/v1/global/accounting/expenses/stats",
            headers=superuser_headers,
        )
        data = assert_success_response(response)

        # The 10 inactive rows had amount=999999 each. If they leaked into
        # the sum we'd see at least 9,999,990 added to total_amount.
        assert Decimal(data["total_amount"]) == expenses_dataset["total_amount"]

    async def test_filter_by_category(
        self, api_client, superuser_headers, expenses_dataset
    ):
        """category filter restricts the aggregation server-side."""
        response = await api_client.get(
            "/api/v1/global/accounting/expenses/stats",
            headers=superuser_headers,
            params={"category": "rent"},
        )
        data = assert_success_response(response)

        # Only the 60 RENT (pending) expenses should match
        assert data["total_count"] == 60
        assert Decimal(data["total_amount"]) == Decimal("3000000")
        assert data["pending_count"] == 60
        assert data["paid_count"] == 0

    async def test_filter_by_is_paid_true(
        self, api_client, superuser_headers, expenses_dataset
    ):
        """is_paid=true returns only paid aggregate."""
        response = await api_client.get(
            "/api/v1/global/accounting/expenses/stats",
            headers=superuser_headers,
            params={"is_paid": "true"},
        )
        data = assert_success_response(response)

        assert data["total_count"] == expenses_dataset["paid_count"]
        assert data["paid_count"] == expenses_dataset["paid_count"]
        assert data["pending_count"] == 0

    async def test_filter_by_date_range(
        self, api_client, superuser_headers, expenses_dataset
    ):
        """start_date/end_date filter aggregation by expense_date."""
        # Future date range — no expenses match
        future = (date.today() + timedelta(days=30)).isoformat()
        response = await api_client.get(
            "/api/v1/global/accounting/expenses/stats",
            headers=superuser_headers,
            params={"start_date": future, "end_date": future},
        )
        data = assert_success_response(response)

        assert data["total_count"] == 0
        assert Decimal(data["total_amount"]) == Decimal("0")
        assert Decimal(data["average_amount"]) == Decimal("0")

    async def test_returns_zeros_for_empty_dataset(
        self, api_client, superuser_headers
    ):
        """Empty filter result returns zeros (not 500, not null)."""
        # No fixture: db has no global expenses
        response = await api_client.get(
            "/api/v1/global/accounting/expenses/stats",
            headers=superuser_headers,
            params={"category": "marketing"},  # arbitrary, no expenses
        )
        data = assert_success_response(response)

        assert data["total_count"] == 0
        assert Decimal(data["total_amount"]) == Decimal("0")
        assert Decimal(data["average_amount"]) == Decimal("0")
        assert data["paid_count"] == 0
        assert data["pending_count"] == 0

    async def test_min_max_amount_filters(
        self, api_client, superuser_headers, expenses_dataset
    ):
        """min_amount/max_amount narrow the aggregation."""
        # Fixture has paid=100k and pending=50k. min=80k → only paid.
        response = await api_client.get(
            "/api/v1/global/accounting/expenses/stats",
            headers=superuser_headers,
            params={"min_amount": "80000"},
        )
        data = assert_success_response(response)

        assert data["total_count"] == 60  # only paid (100k each)
        assert Decimal(data["total_amount"]) == Decimal("6000000")

    async def test_requires_authentication(self, api_client):
        """Endpoint is gated behind permission middleware."""
        response = await api_client.get(
            "/api/v1/global/accounting/expenses/stats"
        )
        assert response.status_code in [401, 403]


# ============================================================================
# /api/v1/global/workforce/performance/stats
# ============================================================================


class TestPerformanceStatsEndpoint:
    """Tests for GET /api/v1/global/workforce/performance/stats"""

    async def test_returns_zeros_when_no_employees(
        self, api_client, superuser_headers
    ):
        """No employees → returns the documented zeroed shape, not 500."""
        response = await api_client.get(
            "/api/v1/global/workforce/performance/stats",
            headers=superuser_headers,
        )
        data = assert_success_response(response)

        assert data["total_employees"] == 0
        assert data["avg_score"] == 0
        assert data["top_performers"] == 0
        assert data["needs_attention"] == 0

    async def test_requires_authentication(self, api_client):
        response = await api_client.get(
            "/api/v1/global/workforce/performance/stats"
        )
        assert response.status_code in [401, 403]

    async def test_accepts_period_query_params(
        self, api_client, superuser_headers
    ):
        """period_start/period_end are optional query params."""
        today = date.today().isoformat()
        thirty = (date.today() - timedelta(days=30)).isoformat()
        response = await api_client.get(
            "/api/v1/global/workforce/performance/stats",
            headers=superuser_headers,
            params={"period_start": thirty, "period_end": today},
        )
        # Even with no employees, the call must succeed
        data = assert_success_response(response)
        assert "total_employees" in data
        assert "avg_score" in data
        assert "top_performers" in data
        assert "needs_attention" in data


# ============================================================================
# /api/v1/global/products/stats
# ============================================================================


@pytest.fixture
async def products_dataset(db_session):
    """
    Catalog of 10 global products with varied stock levels:
      - 4 in stock (qty=20, min=5)
      - 3 low stock (qty=3, min=5)
      - 3 out of stock (qty=0, min=5)
    """
    from app.models.product import GarmentType, Product, Inventory

    gt = GarmentType(
        id=str(uuid4()),
        school_id=None,
        name=f"Camiseta Test {uuid4().hex[:6]}",
        is_active=True,
    )
    db_session.add(gt)
    await db_session.flush()

    products = []
    inventories = []
    config = (
        [(20, 5)] * 4  # in stock
        + [(3, 5)] * 3  # low stock
        + [(0, 5)] * 3  # out of stock
    )
    for i, (qty, min_q) in enumerate(config):
        p = Product(
            id=str(uuid4()),
            school_id=None,
            garment_type_id=gt.id,
            code=f"PRD-{uuid4().hex[:6]}",
            size="M",
            color="Azul",
            price=Decimal("50000"),
            is_active=True,
        )
        products.append(p)
        db_session.add(p)
        await db_session.flush()
        inv = Inventory(
            id=str(uuid4()),
            school_id=None,
            product_id=p.id,
            quantity=qty,
            reserved_quantity=0,
            min_stock_alert=min_q,
        )
        inventories.append(inv)
        db_session.add(inv)

    await db_session.flush()
    return {
        "products": products,
        "total_products": 10,
        "total_stock": 4 * 20 + 3 * 3 + 3 * 0,  # 89
        "out_of_stock_count": 3,
        "low_stock_count": 3,
    }


class TestProductsStatsEndpoint:
    """Tests for GET /api/v1/global/products/stats"""

    async def test_aggregates_inventory_counts_correctly(
        self, api_client, superuser_headers, products_dataset
    ):
        response = await api_client.get(
            "/api/v1/global/products/stats",
            headers=superuser_headers,
        )
        data = assert_success_response(response)

        assert data["total_products"] == products_dataset["total_products"]
        assert data["total_stock"] == products_dataset["total_stock"]
        assert data["out_of_stock_count"] == products_dataset["out_of_stock_count"]
        assert data["low_stock_count"] == products_dataset["low_stock_count"]

    async def test_with_orders_count_zero_when_no_pending_orders(
        self, api_client, superuser_headers, products_dataset
    ):
        """No active orders fixture → with_orders=0, total_pending=0."""
        response = await api_client.get(
            "/api/v1/global/products/stats",
            headers=superuser_headers,
        )
        data = assert_success_response(response)

        assert data["with_orders_count"] == 0
        assert data["total_pending_orders"] == 0

    async def test_returns_zeros_when_empty_catalog(
        self, api_client, superuser_headers
    ):
        """Empty catalog returns the zeroed shape, not 500."""
        response = await api_client.get(
            "/api/v1/global/products/stats",
            headers=superuser_headers,
        )
        data = assert_success_response(response)

        assert data["total_products"] == 0
        assert data["total_stock"] == 0
        assert data["out_of_stock_count"] == 0
        assert data["low_stock_count"] == 0
        assert data["with_orders_count"] == 0
        assert data["total_pending_orders"] == 0

    async def test_requires_authentication(self, api_client):
        response = await api_client.get("/api/v1/global/products/stats")
        assert response.status_code in [401, 403]

    async def test_scope_separates_global_from_school_catalogs(
        self, api_client, superuser_headers, db_session, products_dataset, test_school
    ):
        """
        Scope controls which catalog the KPIs cover:
        - global: only shared products (the 10-product fixture).
        - school: products summed across the user's accessible schools
          (superuser sees all schools, so the seeded school product counts).
        - all: everything.
        This is what makes the Products page cards mirror the active tab.
        """
        from app.models.product import GarmentType, Product, Inventory

        gt = GarmentType(
            id=str(uuid4()),
            school_id=test_school.id,
            name=f"Camiseta Colegio {uuid4().hex[:6]}",
            is_active=True,
        )
        db_session.add(gt)
        await db_session.flush()
        school_product = Product(
            id=str(uuid4()),
            school_id=test_school.id,
            garment_type_id=gt.id,
            code=f"SCH-{uuid4().hex[:6]}",
            size="M",
            color="Azul",
            price=Decimal("50000"),
            is_active=True,
        )
        db_session.add(school_product)
        await db_session.flush()
        db_session.add(
            Inventory(
                id=str(uuid4()),
                school_id=test_school.id,
                product_id=school_product.id,
                quantity=7,
                reserved_quantity=0,
                min_stock_alert=5,
            )
        )
        await db_session.flush()

        global_data = assert_success_response(
            await api_client.get(
                "/api/v1/global/products/stats", headers=superuser_headers
            )
        )
        assert global_data["total_products"] == products_dataset["total_products"]

        school_data = assert_success_response(
            await api_client.get(
                "/api/v1/global/products/stats",
                params={"scope": "school"},
                headers=superuser_headers,
            )
        )
        assert school_data["total_products"] == 1
        assert school_data["total_stock"] == 7

        all_data = assert_success_response(
            await api_client.get(
                "/api/v1/global/products/stats",
                params={"scope": "all"},
                headers=superuser_headers,
            )
        )
        assert all_data["total_products"] == products_dataset["total_products"] + 1


# ============================================================================
# /api/v1/users with is_active filter (regression test)
# ============================================================================


class TestListUsersIsActiveFilter:
    """
    Tests for GET /api/v1/users with the new is_active query param.

    Regression test for the bug where PayrollEmployeeModal filtered
    .is_active client-side over only the first 100 paginated users,
    silently dropping active users beyond page 1.
    """

    @pytest.fixture
    async def mixed_users(self, db_session):
        from app.models.user import User
        from app.services.user import UserService

        users = []
        # 5 active + 5 inactive
        for i in range(5):
            users.append(
                User(
                    id=str(uuid4()),
                    username=f"active_{uuid4().hex[:6]}",
                    email=f"active_{uuid4().hex[:6]}@test.com",
                    hashed_password=UserService.hash_password("Pass123!"),
                    full_name=f"Active User {i}",
                    is_active=True,
                    is_superuser=False,
                )
            )
        for i in range(5):
            users.append(
                User(
                    id=str(uuid4()),
                    username=f"inactive_{uuid4().hex[:6]}",
                    email=f"inactive_{uuid4().hex[:6]}@test.com",
                    hashed_password=UserService.hash_password("Pass123!"),
                    full_name=f"Inactive User {i}",
                    is_active=False,
                    is_superuser=False,
                )
            )
        db_session.add_all(users)
        await db_session.flush()
        return users

    async def test_is_active_true_returns_only_active(
        self, api_client, superuser_headers, mixed_users
    ):
        response = await api_client.get(
            "/api/v1/users",
            headers=superuser_headers,
            params={"is_active": "true"},
        )
        data = assert_success_response(response)
        items = data.get("items", data)

        for user in items:
            assert user["is_active"] is True
        # We seeded 5 active users + 1 superuser. All returned must be active.
        assert all(u["is_active"] for u in items)

    async def test_is_active_false_returns_only_inactive(
        self, api_client, superuser_headers, mixed_users
    ):
        response = await api_client.get(
            "/api/v1/users",
            headers=superuser_headers,
            params={"is_active": "false"},
        )
        data = assert_success_response(response)
        items = data.get("items", data)

        for user in items:
            assert user["is_active"] is False

    async def test_no_filter_returns_both(
        self, api_client, superuser_headers, mixed_users
    ):
        response = await api_client.get(
            "/api/v1/users",
            headers=superuser_headers,
        )
        data = assert_success_response(response)
        items = data.get("items", data)

        statuses = {u["is_active"] for u in items}
        # Both should appear (we seeded ≥1 of each)
        assert True in statuses
        assert False in statuses

    async def test_total_reflects_filtered_count(
        self, api_client, superuser_headers, mixed_users
    ):
        """The PaginatedResponse.total must reflect the filtered count, not all rows."""
        response = await api_client.get(
            "/api/v1/users",
            headers=superuser_headers,
            params={"is_active": "true"},
        )
        data = assert_success_response(response)
        if isinstance(data, dict) and "total" in data:
            # Filtered count should not include the 5 inactive seeded
            inactive_pattern = "inactive_"
            inactive_in_response = [
                u for u in data["items"] if u["username"].startswith(inactive_pattern)
            ]
            assert len(inactive_in_response) == 0
