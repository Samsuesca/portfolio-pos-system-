"""
Tests for Payroll API endpoints.

Tests cover payroll runs management, approval workflow, and payment processing.

NOTE: Payroll is a GLOBAL module with prefix /global/payroll
"""
import pytest
from httpx import AsyncClient
from datetime import date, timedelta
from uuid import uuid4
from decimal import Decimal


# Base URL for payroll endpoints (GLOBAL module)
BASE_URL = "/api/v1/global/payroll"


@pytest.mark.asyncio
async def test_get_payroll_summary(
    api_client: AsyncClient,
    superuser_headers: dict,
    test_employee
):
    """Test getting payroll summary."""
    response = await api_client.get(
        f"{BASE_URL}/summary",
        headers=superuser_headers
    )

    assert response.status_code == 200
    data = response.json()
    assert "active_employees" in data or "total_employees" in data


@pytest.mark.asyncio
async def test_list_payroll_runs(
    api_client: AsyncClient,
    superuser_headers: dict,
    test_payroll_run
):
    """Test listing payroll runs."""
    response = await api_client.get(
        BASE_URL,
        headers=superuser_headers
    )

    assert response.status_code == 200
    data = response.json()
    # Returns a list directly
    assert isinstance(data, list)


@pytest.mark.asyncio
async def test_list_payroll_runs_by_status(
    api_client: AsyncClient,
    superuser_headers: dict,
    test_payroll_run
):
    """Test listing payroll runs filtered by status."""
    response = await api_client.get(
        f"{BASE_URL}?status=draft",
        headers=superuser_headers
    )

    assert response.status_code == 200
    data = response.json()
    for item in data:
        assert item["status"] == "draft"


@pytest.mark.asyncio
async def test_list_payroll_with_pagination(
    api_client: AsyncClient,
    superuser_headers: dict
):
    """Test payroll list pagination."""
    response = await api_client.get(
        f"{BASE_URL}?skip=0&limit=10",
        headers=superuser_headers
    )

    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) <= 10


@pytest.mark.asyncio
async def test_get_payroll_run_by_id(
    api_client: AsyncClient,
    superuser_headers: dict,
    test_payroll_run
):
    """Test getting a specific payroll run by ID."""
    response = await api_client.get(
        f"{BASE_URL}/{test_payroll_run.id}",
        headers=superuser_headers
    )

    assert response.status_code == 200
    data = response.json()
    assert data["id"] == str(test_payroll_run.id)
    assert "items" in data


@pytest.mark.asyncio
async def test_get_payroll_run_not_found(
    api_client: AsyncClient,
    superuser_headers: dict
):
    """Test getting a non-existent payroll run returns 404."""
    fake_id = uuid4()
    response = await api_client.get(
        f"{BASE_URL}/{fake_id}",
        headers=superuser_headers
    )

    assert response.status_code == 404


@pytest.mark.asyncio
async def test_create_payroll_run(
    api_client: AsyncClient,
    superuser_headers: dict,
    test_employee
):
    """Test creating a new payroll run."""
    today = date.today()
    payroll_data = {
        "period_start": (today - timedelta(days=15)).isoformat(),
        "period_end": today.isoformat(),
        "notes": "Quincena enero"
    }

    response = await api_client.post(
        BASE_URL,
        json=payroll_data,
        headers=superuser_headers
    )

    assert response.status_code == 201
    data = response.json()
    assert "id" in data
    assert data["status"] == "draft"


@pytest.mark.asyncio
async def test_create_payroll_run_validation_error(
    api_client: AsyncClient,
    superuser_headers: dict
):
    """Test creating a payroll run with invalid data returns 400."""
    payroll_data = {
        # Missing required fields or invalid dates
        "notes": "Test"
    }

    response = await api_client.post(
        BASE_URL,
        json=payroll_data,
        headers=superuser_headers
    )

    # Custom handler returns 400 for validation errors
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_update_payroll_run(
    api_client: AsyncClient,
    superuser_headers: dict,
    test_payroll_run
):
    """Test updating a payroll run."""
    update_data = {
        "notes": "Quincena actualizada con bono"
    }

    response = await api_client.patch(
        f"{BASE_URL}/{test_payroll_run.id}",
        json=update_data,
        headers=superuser_headers
    )

    assert response.status_code == 200
    data = response.json()
    assert "actualizada" in data.get("notes", "").lower() or "bono" in data.get("notes", "").lower()


@pytest.mark.asyncio
async def test_approve_payroll_run(
    api_client: AsyncClient,
    superuser_headers: dict,
    test_payroll_run
):
    """Test approving a payroll run."""
    response = await api_client.post(
        f"{BASE_URL}/{test_payroll_run.id}/approve",
        headers=superuser_headers
    )

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "approved"


@pytest.mark.asyncio
async def test_pay_payroll_run(
    api_client: AsyncClient,
    superuser_headers: dict,
    test_payroll_run
):
    """Test marking payroll run as paid."""
    # First approve it
    await api_client.post(
        f"{BASE_URL}/{test_payroll_run.id}/approve",
        headers=superuser_headers
    )

    # Then pay it
    response = await api_client.post(
        f"{BASE_URL}/{test_payroll_run.id}/pay",
        headers=superuser_headers
    )

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "paid"


@pytest.mark.asyncio
async def test_cancel_payroll_run(
    api_client: AsyncClient,
    superuser_headers: dict,
    test_payroll_run
):
    """Test cancelling a payroll run."""
    response = await api_client.post(
        f"{BASE_URL}/{test_payroll_run.id}/cancel",
        headers=superuser_headers
    )

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "cancelled"


@pytest.mark.asyncio
async def test_payroll_unauthorized(api_client: AsyncClient):
    """Test that payroll endpoints require authentication."""
    response = await api_client.get(BASE_URL)
    assert response.status_code in [401, 403]
