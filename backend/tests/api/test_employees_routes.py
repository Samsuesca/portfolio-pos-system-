"""
Tests for Employees API endpoints.

Tests cover CRUD operations for employee management in the payroll system.

NOTE: Employees is a GLOBAL module with prefix /global/employees
"""
import pytest
from httpx import AsyncClient
from datetime import date
from uuid import uuid4
from decimal import Decimal


# Base URL for employees endpoints (GLOBAL module)
BASE_URL = "/api/v1/global/employees"


@pytest.mark.asyncio
async def test_list_employees(
    api_client: AsyncClient,
    superuser_headers: dict,
    test_employee
):
    """Test listing employees."""
    response = await api_client.get(
        BASE_URL,
        headers=superuser_headers
    )

    assert response.status_code == 200
    data = response.json()
    # Returns a list directly
    assert isinstance(data, list)


@pytest.mark.asyncio
async def test_list_employees_by_status(
    api_client: AsyncClient,
    superuser_headers: dict,
    test_employee
):
    """Test listing employees filtered by active status."""
    response = await api_client.get(
        f"{BASE_URL}?is_active=true",
        headers=superuser_headers
    )

    assert response.status_code == 200
    data = response.json()
    for item in data:
        assert item["is_active"] is True


@pytest.mark.asyncio
async def test_list_employees_with_search(
    api_client: AsyncClient,
    superuser_headers: dict,
    test_employee
):
    """Test searching employees (pagination params)."""
    response = await api_client.get(
        f"{BASE_URL}?skip=0&limit=10",
        headers=superuser_headers
    )

    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)


@pytest.mark.asyncio
async def test_get_employee_by_id(
    api_client: AsyncClient,
    superuser_headers: dict,
    test_employee
):
    """Test getting a specific employee by ID."""
    response = await api_client.get(
        f"{BASE_URL}/{test_employee.id}",
        headers=superuser_headers
    )

    assert response.status_code == 200
    data = response.json()
    assert data["id"] == str(test_employee.id)
    assert data["full_name"] == test_employee.full_name
    assert data["position"] == test_employee.position


@pytest.mark.asyncio
async def test_get_employee_not_found(
    api_client: AsyncClient,
    superuser_headers: dict
):
    """Test getting a non-existent employee returns 404."""
    fake_id = uuid4()
    response = await api_client.get(
        f"{BASE_URL}/{fake_id}",
        headers=superuser_headers
    )

    assert response.status_code == 404


@pytest.mark.asyncio
async def test_create_employee(
    api_client: AsyncClient,
    superuser_headers: dict
):
    """Test creating a new employee."""
    unique = uuid4().hex[:6]
    employee_data = {
        "full_name": f"Carlos Rodríguez {unique}",
        "document_type": "CC",
        "document_id": f"987654{unique}",
        "phone": "3109876543",
        "email": f"carlos_{unique}@test.com",
        "address": "Carrera 50 #30-20",
        "position": "Vendedor",
        "hire_date": date.today().isoformat(),
        "base_salary": "1400000",
        "payment_frequency": "biweekly"
    }

    response = await api_client.post(
        BASE_URL,
        json=employee_data,
        headers=superuser_headers
    )

    assert response.status_code == 201
    data = response.json()
    assert "Carlos" in data["full_name"]
    assert data["position"] == "Vendedor"
    assert Decimal(data["base_salary"]) == Decimal("1400000")
    assert data["is_active"] is True


@pytest.mark.asyncio
async def test_create_employee_minimal_data(
    api_client: AsyncClient,
    superuser_headers: dict
):
    """Test creating an employee with minimal required data."""
    unique = uuid4().hex[:6]
    employee_data = {
        "full_name": f"Ana Martínez {unique}",
        "document_id": f"111222{unique}",
        "position": "Auxiliar",
        "hire_date": date.today().isoformat(),
        "base_salary": "1300000",
        "payment_frequency": "biweekly"
    }

    response = await api_client.post(
        BASE_URL,
        json=employee_data,
        headers=superuser_headers
    )

    assert response.status_code == 201
    data = response.json()
    assert "Ana" in data["full_name"]


@pytest.mark.asyncio
async def test_create_employee_duplicate_document(
    api_client: AsyncClient,
    superuser_headers: dict,
    test_employee
):
    """Test creating an employee with duplicate document number fails."""
    employee_data = {
        "full_name": "Duplicate Employee",
        "document_id": test_employee.document_id,  # Same as existing
        "position": "Test",
        "hire_date": date.today().isoformat(),
        "base_salary": "1000000",
        "payment_frequency": "biweekly"
    }

    response = await api_client.post(
        BASE_URL,
        json=employee_data,
        headers=superuser_headers
    )

    # Should fail due to unique constraint
    assert response.status_code in [400, 409, 422, 500]


@pytest.mark.asyncio
async def test_create_employee_validation_error(
    api_client: AsyncClient,
    superuser_headers: dict
):
    """Test creating an employee with invalid data returns 400 (custom handler)."""
    employee_data = {
        # Missing required fields
        "position": "Test"
    }

    response = await api_client.post(
        BASE_URL,
        json=employee_data,
        headers=superuser_headers
    )

    # Custom handler returns 400 for validation errors
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_update_employee(
    api_client: AsyncClient,
    superuser_headers: dict,
    test_employee
):
    """Test updating an employee."""
    update_data = {
        "phone": "3201112222",
        "position": "Jefe de Costura",
        "base_salary": "1800000"
    }

    response = await api_client.patch(
        f"{BASE_URL}/{test_employee.id}",
        json=update_data,
        headers=superuser_headers
    )

    assert response.status_code == 200
    data = response.json()
    assert data["phone"] == "3201112222"
    assert data["position"] == "Jefe de Costura"
    assert Decimal(data["base_salary"]) == Decimal("1800000")


@pytest.mark.asyncio
async def test_update_employee_status(
    api_client: AsyncClient,
    superuser_headers: dict,
    test_employee
):
    """Test updating employee active status."""
    update_data = {
        "is_active": False
    }

    response = await api_client.patch(
        f"{BASE_URL}/{test_employee.id}",
        json=update_data,
        headers=superuser_headers
    )

    assert response.status_code == 200
    data = response.json()
    assert data["is_active"] is False


@pytest.mark.asyncio
async def test_deactivate_employee(
    api_client: AsyncClient,
    superuser_headers: dict,
    test_employee
):
    """Test deactivating an employee (soft delete)."""
    response = await api_client.delete(
        f"{BASE_URL}/{test_employee.id}",
        headers=superuser_headers
    )

    # Returns 204 No Content
    assert response.status_code == 204


@pytest.mark.asyncio
async def test_employees_unauthorized(api_client: AsyncClient):
    """Test that employees endpoints require authentication."""
    response = await api_client.get(BASE_URL)
    assert response.status_code in [401, 403]


@pytest.mark.asyncio
async def test_list_employees_pagination(
    api_client: AsyncClient,
    superuser_headers: dict
):
    """Test employees list pagination."""
    response = await api_client.get(
        f"{BASE_URL}?skip=0&limit=5",
        headers=superuser_headers
    )

    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) <= 5
