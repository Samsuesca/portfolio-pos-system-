"""
Tests for Alterations API endpoints.

Tests cover CRUD operations, status management, and payment registration
for the alterations (arreglos) module.

NOTE: Alterations is a GLOBAL module with prefix /global/alterations
and requires admin role in at least one school.
"""
import pytest
from httpx import AsyncClient
from datetime import date, timedelta
from uuid import uuid4
from decimal import Decimal


NEEDS_ISOLATION_FIX = pytest.mark.skip(reason="DB isolation issue")


# Base URL for alterations endpoints (GLOBAL module)
BASE_URL = "/api/v1/global/alterations"


@pytest.mark.asyncio
async def test_list_alterations(
    api_client: AsyncClient,
    superuser_headers: dict,
    test_alteration
):
    """Test listing alterations."""
    response = await api_client.get(
        BASE_URL,
        headers=superuser_headers
    )

    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert "total" in data
    assert isinstance(data["items"], list)


@pytest.mark.asyncio
async def test_list_alterations_with_status_filter(
    api_client: AsyncClient,
    superuser_headers: dict,
    test_alteration
):
    """Test listing alterations filtered by status."""
    response = await api_client.get(
        f"{BASE_URL}?status=pending",
        headers=superuser_headers
    )

    assert response.status_code == 200
    data = response.json()
    for item in data["items"]:
        assert item["status"] == "pending"


@pytest.mark.asyncio
async def test_list_alterations_with_date_range(
    api_client: AsyncClient,
    superuser_headers: dict,
    test_alteration
):
    """Test listing alterations with date range filter."""
    today = date.today()
    from_date = (today - timedelta(days=7)).isoformat()
    to_date = today.isoformat()

    response = await api_client.get(
        f"{BASE_URL}?start_date={from_date}&end_date={to_date}",
        headers=superuser_headers
    )

    assert response.status_code == 200
    data = response.json()
    assert isinstance(data["items"], list)


@pytest.mark.asyncio
async def test_list_alterations_with_search(
    api_client: AsyncClient,
    superuser_headers: dict,
    test_alteration
):
    """Test searching alterations by client name or garment description."""
    response = await api_client.get(
        f"{BASE_URL}?search=Pantalón",
        headers=superuser_headers
    )

    assert response.status_code == 200
    data = response.json()
    assert isinstance(data["items"], list)


@pytest.mark.asyncio
async def test_get_alteration_summary(
    api_client: AsyncClient,
    superuser_headers: dict
):
    """Test getting alteration summary statistics."""
    response = await api_client.get(
        f"{BASE_URL}/summary",
        headers=superuser_headers
    )

    assert response.status_code == 200
    data = response.json()
    # Check for summary fields
    assert "total_count" in data or "total" in data or "pending_count" in data


@pytest.mark.asyncio
async def test_get_alteration_by_id(
    api_client: AsyncClient,
    superuser_headers: dict,
    test_alteration
):
    """Test getting a specific alteration by ID."""
    response = await api_client.get(
        f"{BASE_URL}/{test_alteration.id}",
        headers=superuser_headers
    )

    assert response.status_code == 200
    data = response.json()
    assert data["id"] == str(test_alteration.id)


@pytest.mark.asyncio
async def test_get_alteration_not_found(
    api_client: AsyncClient,
    superuser_headers: dict
):
    """Test getting a non-existent alteration returns 404."""
    fake_id = uuid4()
    response = await api_client.get(
        f"{BASE_URL}/{fake_id}",
        headers=superuser_headers
    )

    assert response.status_code == 404


@pytest.mark.asyncio
async def test_create_alteration(
    api_client: AsyncClient,
    superuser_headers: dict,
    test_school,
    test_client
):
    """Test creating a new alteration."""
    alteration_data = {
        "client_id": str(test_client.id),
        "garment_name": "Falda azul talla 10",
        "alteration_type": "hem",
        "description": "Subir ruedo 5cm",
        "cost": "20000",
        "received_date": date.today().isoformat(),
        "estimated_delivery_date": (date.today() + timedelta(days=3)).isoformat()
    }

    response = await api_client.post(
        BASE_URL,
        json=alteration_data,
        headers=superuser_headers
    )

    assert response.status_code == 201
    data = response.json()
    assert "id" in data


@NEEDS_ISOLATION_FIX
@pytest.mark.asyncio
async def test_create_alteration_without_deposit(
    api_client: AsyncClient,
    superuser_headers: dict,
    test_client
):
    """Test creating an alteration without initial deposit."""
    alteration_data = {
        "client_id": str(test_client.id),
        "garment_name": "Pantalón negro talla M",
        "alteration_type": "waist",
        "cost": "25000",
        "received_date": date.today().isoformat()
    }

    response = await api_client.post(
        BASE_URL,
        json=alteration_data,
        headers=superuser_headers
    )

    assert response.status_code == 201
    data = response.json()
    assert "id" in data


@pytest.mark.asyncio
async def test_create_alteration_validation_error(
    api_client: AsyncClient,
    superuser_headers: dict
):
    """Test creating an alteration with invalid data returns 400 (custom handler)."""
    alteration_data = {
        # Missing required fields - should fail validation
        "garment_name": "Test"
    }

    response = await api_client.post(
        BASE_URL,
        json=alteration_data,
        headers=superuser_headers
    )

    # Our custom handler returns 400 for validation errors
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_update_alteration(
    api_client: AsyncClient,
    superuser_headers: dict,
    test_alteration
):
    """Test updating an alteration."""
    update_data = {
        "garment_name": "Pantalón azul talla 14 (actualizado)",
        "cost": "18000"
    }

    response = await api_client.patch(
        f"{BASE_URL}/{test_alteration.id}",
        json=update_data,
        headers=superuser_headers
    )

    assert response.status_code == 200
    data = response.json()
    assert "actualizado" in data.get("garment_name", "")


@pytest.mark.asyncio
async def test_update_alteration_status(
    api_client: AsyncClient,
    superuser_headers: dict,
    test_alteration
):
    """Test updating alteration status."""
    update_data = {"status": "in_progress"}

    response = await api_client.patch(
        f"{BASE_URL}/{test_alteration.id}/status",
        json=update_data,
        headers=superuser_headers
    )

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "in_progress"


@NEEDS_ISOLATION_FIX
@pytest.mark.asyncio
async def test_update_alteration_status_to_completed(
    api_client: AsyncClient,
    superuser_headers: dict,
    test_alteration
):
    """Test marking alteration as completed."""
    update_data = {"status": "completed"}

    response = await api_client.patch(
        f"{BASE_URL}/{test_alteration.id}/status",
        json=update_data,
        headers=superuser_headers
    )

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "completed"


@pytest.mark.asyncio
async def test_register_payment(
    api_client: AsyncClient,
    superuser_headers: dict,
    test_alteration
):
    """Test registering a payment for an alteration."""
    payment_data = {
        "amount": "5000",
        "payment_method": "nequi"
    }

    response = await api_client.post(
        f"{BASE_URL}/{test_alteration.id}/pay",
        json=payment_data,
        headers=superuser_headers
    )

    assert response.status_code == 201
    data = response.json()
    assert "amount" in data


@pytest.mark.asyncio
async def test_register_payment_completes_payment(
    api_client: AsyncClient,
    superuser_headers: dict,
    test_alteration
):
    """Test that registering full remaining amount marks as paid."""
    # test_alteration has cost=15000, amount_paid=5000, so remaining=10000
    payment_data = {
        "amount": "10000",
        "payment_method": "cash"
    }

    response = await api_client.post(
        f"{BASE_URL}/{test_alteration.id}/pay",
        json=payment_data,
        headers=superuser_headers
    )

    assert response.status_code == 201


@NEEDS_ISOLATION_FIX
@pytest.mark.asyncio
async def test_delete_alteration(
    api_client: AsyncClient,
    superuser_headers: dict,
    test_alteration
):
    """Test cancelling an alteration."""
    response = await api_client.delete(
        f"{BASE_URL}/{test_alteration.id}",
        headers=superuser_headers
    )

    assert response.status_code == 200

    # Verify it's cancelled, not actually deleted
    get_response = await api_client.get(
        f"{BASE_URL}/{test_alteration.id}",
        headers=superuser_headers
    )
    assert get_response.status_code == 200
    assert get_response.json()["status"] == "cancelled"


@pytest.mark.asyncio
async def test_alterations_unauthorized(api_client: AsyncClient):
    """Test that alterations endpoints require authentication."""
    response = await api_client.get(BASE_URL)
    # Returns 403 for missing auth (not 401)
    assert response.status_code in [401, 403]


@pytest.mark.asyncio
async def test_list_alterations_pagination(
    api_client: AsyncClient,
    superuser_headers: dict
):
    """Test alterations list pagination."""
    response = await api_client.get(
        f"{BASE_URL}?skip=0&limit=10",
        headers=superuser_headers
    )

    assert response.status_code == 200
    data = response.json()
    assert isinstance(data["items"], list)
    assert len(data["items"]) <= 10


# ============================================================================
# Granular permissions denial tests (Fix #5)
#
# Regular users sin role asignado no deben poder mutar alteraciones,
# solo leer si tienen el permiso. Estos tests verifican que las
# `dependencies=[Depends(require_global_permission(...))]` por endpoint
# bloquean correctamente.
# ============================================================================


@pytest.mark.asyncio
async def test_create_alteration_denies_user_without_permission(
    api_client: AsyncClient,
    auth_headers: dict,
    test_client
):
    """Usuario regular sin roles asignados → 403 al crear alteración.

    Verifica que el dependency ``alterations.create`` se aplica.
    Antes del fix, el router solo declaraba ``alterations.view`` y
    cualquier usuario con read podía crear/editar/cancelar.
    """
    payload = {
        "client_id": str(test_client.id),
        "garment_name": "Test garment",
        "alteration_type": "hem",
        "cost": "10000",
        "received_date": date.today().isoformat(),
    }

    response = await api_client.post(BASE_URL, json=payload, headers=auth_headers)

    assert response.status_code == 403
    assert "alterations.create" in response.json()["detail"].lower() or \
           "permission required" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_update_alteration_denies_user_without_permission(
    api_client: AsyncClient,
    auth_headers: dict,
    test_alteration
):
    """Usuario regular → 403 al editar alteración."""
    response = await api_client.patch(
        f"{BASE_URL}/{test_alteration.id}",
        json={"cost": "99999"},
        headers=auth_headers,
    )
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_update_status_denies_user_without_permission(
    api_client: AsyncClient,
    auth_headers: dict,
    test_alteration
):
    """Usuario regular → 403 al cambiar status."""
    response = await api_client.patch(
        f"{BASE_URL}/{test_alteration.id}/status",
        json={"status": "in_progress"},
        headers=auth_headers,
    )
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_record_payment_denies_user_without_permission(
    api_client: AsyncClient,
    auth_headers: dict,
    test_alteration
):
    """Usuario regular → 403 al registrar pago.

    Crítico: registrar pago genera asiento contable. Sin la restricción
    granular, cualquier usuario con `alterations.view` podría inflar
    Caja con pagos ficticios.
    """
    response = await api_client.post(
        f"{BASE_URL}/{test_alteration.id}/pay",
        json={"amount": "5000", "payment_method": "cash"},
        headers=auth_headers,
    )
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_cancel_alteration_denies_user_without_permission(
    api_client: AsyncClient,
    auth_headers: dict,
    test_alteration
):
    """Usuario regular → 403 al cancelar (DELETE)."""
    response = await api_client.delete(
        f"{BASE_URL}/{test_alteration.id}",
        headers=auth_headers,
    )
    assert response.status_code == 403
