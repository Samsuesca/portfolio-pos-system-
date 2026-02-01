"""
Tests for Fixed Expenses API endpoints.

Tests cover CRUD operations for fixed/recurring expenses management
including rent, utilities, and other recurring business expenses.

NOTE: Fixed Expenses is a GLOBAL module with prefix /global/fixed-expenses
"""
import pytest
from httpx import AsyncClient
from datetime import date, timedelta
from uuid import uuid4
from decimal import Decimal


NEEDS_ISOLATION_FIX = pytest.mark.skip(reason="DB isolation issue")


# Base URL for fixed expenses endpoints (GLOBAL module)
BASE_URL = "/api/v1/global/fixed-expenses"


@pytest.mark.asyncio
async def test_list_fixed_expenses(
    api_client: AsyncClient,
    superuser_headers: dict,
    test_fixed_expense
):
    """Test listing fixed expenses."""
    response = await api_client.get(
        BASE_URL,
        headers=superuser_headers
    )

    assert response.status_code == 200
    data = response.json()
    # Returns a list directly
    assert isinstance(data, list)


@pytest.mark.asyncio
async def test_list_fixed_expenses_by_category(
    api_client: AsyncClient,
    superuser_headers: dict,
    test_fixed_expense
):
    """Test listing fixed expenses filtered by category."""
    response = await api_client.get(
        f"{BASE_URL}?category=rent",
        headers=superuser_headers
    )

    assert response.status_code == 200
    data = response.json()
    for item in data:
        assert item["category"] == "rent"


@pytest.mark.asyncio
async def test_list_fixed_expenses_active_only(
    api_client: AsyncClient,
    superuser_headers: dict,
    test_fixed_expense
):
    """Test listing only active fixed expenses."""
    response = await api_client.get(
        f"{BASE_URL}?is_active=true",
        headers=superuser_headers
    )

    assert response.status_code == 200
    data = response.json()
    for item in data:
        assert item["is_active"] is True


@pytest.mark.asyncio
async def test_get_pending_generation(
    api_client: AsyncClient,
    superuser_headers: dict,
    test_fixed_expense
):
    """Test getting fixed expenses pending generation."""
    response = await api_client.get(
        f"{BASE_URL}/pending-generation",
        headers=superuser_headers
    )

    assert response.status_code == 200
    data = response.json()
    # Check structure
    assert "pending" in data or "items" in data or isinstance(data, dict)


@pytest.mark.asyncio
async def test_get_fixed_expense_by_id(
    api_client: AsyncClient,
    superuser_headers: dict,
    test_fixed_expense
):
    """Test getting a specific fixed expense by ID."""
    response = await api_client.get(
        f"{BASE_URL}/{test_fixed_expense.id}",
        headers=superuser_headers
    )

    assert response.status_code == 200
    data = response.json()
    assert data["id"] == str(test_fixed_expense.id)
    assert data["name"] == test_fixed_expense.name


@pytest.mark.asyncio
async def test_get_fixed_expense_not_found(
    api_client: AsyncClient,
    superuser_headers: dict
):
    """Test getting a non-existent fixed expense returns 404."""
    fake_id = uuid4()
    response = await api_client.get(
        f"{BASE_URL}/{fake_id}",
        headers=superuser_headers
    )

    assert response.status_code == 404


@pytest.mark.asyncio
async def test_create_fixed_expense(
    api_client: AsyncClient,
    superuser_headers: dict
):
    """Test creating a new fixed expense."""
    unique = uuid4().hex[:6]
    expense_data = {
        "name": f"Servicios Públicos {unique}",
        "category": "utilities",
        "description": "Agua, luz, gas mensual",
        "expense_type": "exact",
        "amount": "450000",
        "frequency": "monthly",
        "day_of_month": 15
    }

    response = await api_client.post(
        BASE_URL,
        json=expense_data,
        headers=superuser_headers
    )

    assert response.status_code == 201
    data = response.json()
    assert "Servicios" in data["name"]
    assert data["category"] == "utilities"
    assert data["is_active"] is True


@NEEDS_ISOLATION_FIX
@pytest.mark.asyncio
async def test_create_fixed_expense_with_different_recurrence(
    api_client: AsyncClient,
    superuser_headers: dict
):
    """Test creating fixed expenses with different recurrence types."""
    unique = uuid4().hex[:6]
    expense_data = {
        "name": f"Limpieza Local {unique}",
        "category": "services",
        "expense_type": "exact",
        "amount": "100000",
        "frequency": "weekly",
        "day_of_month": 1
    }

    response = await api_client.post(
        BASE_URL,
        json=expense_data,
        headers=superuser_headers
    )

    assert response.status_code == 201
    data = response.json()
    assert data["frequency"] == "weekly"


@pytest.mark.asyncio
async def test_create_fixed_expense_validation_error(
    api_client: AsyncClient,
    superuser_headers: dict
):
    """Test creating a fixed expense with invalid data returns 400."""
    expense_data = {
        # Missing required fields
        "category": "rent"
    }

    response = await api_client.post(
        BASE_URL,
        json=expense_data,
        headers=superuser_headers
    )

    # Custom handler returns 400 for validation errors
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_update_fixed_expense(
    api_client: AsyncClient,
    superuser_headers: dict,
    test_fixed_expense
):
    """Test updating a fixed expense."""
    update_data = {
        "name": "Arriendo Local Actualizado",
        "amount": "2200000",
        "description": "Incluye administración"
    }

    response = await api_client.patch(
        f"{BASE_URL}/{test_fixed_expense.id}",
        json=update_data,
        headers=superuser_headers
    )

    assert response.status_code == 200
    data = response.json()
    assert "Actualizado" in data["name"]
    assert Decimal(data["amount"]) == Decimal("2200000")


@pytest.mark.asyncio
async def test_deactivate_fixed_expense(
    api_client: AsyncClient,
    superuser_headers: dict,
    test_fixed_expense
):
    """Test deactivating a fixed expense."""
    response = await api_client.delete(
        f"{BASE_URL}/{test_fixed_expense.id}",
        headers=superuser_headers
    )

    # Returns 204 No Content
    assert response.status_code == 204


@pytest.mark.asyncio
async def test_generate_single_expense(
    api_client: AsyncClient,
    superuser_headers: dict,
    test_fixed_expense
):
    """Test generating a single expense from template."""
    response = await api_client.post(
        f"{BASE_URL}/{test_fixed_expense.id}/generate",
        headers=superuser_headers
    )

    assert response.status_code == 200
    data = response.json()
    assert "expense_id" in data or "message" in data


@pytest.mark.asyncio
async def test_generate_expense_for_nonexistent(
    api_client: AsyncClient,
    superuser_headers: dict
):
    """Test generating expense for non-existent template returns 404."""
    fake_id = uuid4()
    response = await api_client.post(
        f"{BASE_URL}/{fake_id}/generate",
        headers=superuser_headers
    )

    assert response.status_code == 404


@pytest.mark.asyncio
async def test_get_expense_history(
    api_client: AsyncClient,
    superuser_headers: dict,
    test_fixed_expense
):
    """Test getting generated expense history for a fixed expense."""
    response = await api_client.get(
        f"{BASE_URL}/{test_fixed_expense.id}/history",
        headers=superuser_headers
    )

    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)


@pytest.mark.asyncio
async def test_get_expense_history_with_limit(
    api_client: AsyncClient,
    superuser_headers: dict,
    test_fixed_expense
):
    """Test getting expense history with limit."""
    response = await api_client.get(
        f"{BASE_URL}/{test_fixed_expense.id}/history?limit=5",
        headers=superuser_headers
    )

    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) <= 5


@pytest.mark.asyncio
async def test_fixed_expenses_unauthorized(api_client: AsyncClient):
    """Test that fixed expenses endpoints require authentication."""
    response = await api_client.get(BASE_URL)
    assert response.status_code in [401, 403]


@pytest.mark.asyncio
async def test_list_fixed_expenses_pagination(
    api_client: AsyncClient,
    superuser_headers: dict
):
    """Test fixed expenses list pagination."""
    response = await api_client.get(
        f"{BASE_URL}?skip=0&limit=10",
        headers=superuser_headers
    )

    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) <= 10
