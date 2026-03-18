"""
Tests for Payment Accounts API endpoints.

Tests cover:
- Public payment account listing (no auth, for web portal)
- Admin CRUD (auth required)
- Account detail, update, delete
"""
import pytest
from uuid import uuid4

from tests.fixtures.assertions import (
    assert_success_response,
    assert_created_response,
    assert_no_content_response,
    assert_unauthorized,
    assert_not_found,
)
from tests.fixtures.builders import build_payment_account_request

pytestmark = pytest.mark.api

NEEDS_ISOLATION_FIX = pytest.mark.skip(reason="DB isolation issue")


# ============================================================================
# PUBLIC ENDPOINTS
# ============================================================================

class TestPublicPaymentAccounts:
    """Tests for GET /api/v1/payment-accounts/public"""

    async def test_list_public_accounts_no_auth(self, api_client):
        """Public endpoint should work without auth."""
        response = await api_client.get("/api/v1/payment-accounts/public")
        data = assert_success_response(response)
        assert isinstance(data, list)

    async def test_public_accounts_only_active(self, api_client):
        """Public endpoint should only return active accounts."""
        response = await api_client.get("/api/v1/payment-accounts/public")
        data = assert_success_response(response)
        for account in data:
            assert account.get("is_active", True) is True


# ============================================================================
# ADMIN LISTING
# ============================================================================

class TestAdminAccountListing:
    """Tests for GET /api/v1/payment-accounts"""

    async def test_list_accounts_requires_auth(self, api_client):
        """Non-authenticated users cannot list admin accounts."""
        response = await api_client.get("/api/v1/payment-accounts")
        assert_unauthorized(response)

    async def test_list_accounts_success(
        self, api_client, auth_headers
    ):
        """Authenticated users can list accounts."""
        response = await api_client.get(
            "/api/v1/payment-accounts",
            headers=auth_headers,
        )
        data = assert_success_response(response)
        assert isinstance(data, list)


# ============================================================================
# ACCOUNT CREATION (ADMIN)
# ============================================================================

class TestAccountCreation:
    """Tests for POST /api/v1/payment-accounts"""

    async def test_create_account_requires_auth(self, api_client):
        """Non-authenticated users cannot create accounts."""
        response = await api_client.post(
            "/api/v1/payment-accounts",
            json={
                "method_type": "nequi",
                "account_name": "Nequi Test",
                "account_number": "3001234567",
            },
        )
        assert_unauthorized(response)

    @NEEDS_ISOLATION_FIX
    async def test_create_nequi_account(
        self, api_client, superuser_headers
    ):
        """Should create a Nequi payment account."""
        response = await api_client.post(
            "/api/v1/payment-accounts",
            headers=superuser_headers,
            json={
                "method_type": "nequi",
                "account_name": "Nequi Consuelo",
                "account_number": "3001234567",
                "account_holder": "Consuelo Ríos",
                "is_active": True,
                "display_order": 1,
            },
        )
        data = assert_created_response(response)
        assert data["method_type"] == "nequi"
        assert data["account_name"] == "Nequi Consuelo"
        assert "id" in data

    @NEEDS_ISOLATION_FIX
    async def test_create_bank_account(
        self, api_client, superuser_headers
    ):
        """Should create a bank payment account."""
        response = await api_client.post(
            "/api/v1/payment-accounts",
            headers=superuser_headers,
            json={
                "method_type": "bank_transfer",
                "account_name": "Bancolombia Ahorros",
                "account_number": "12345678901",
                "account_holder": "Uniformes Consuelo Ríos",
                "bank_name": "Bancolombia",
                "account_type": "savings",
                "is_active": True,
                "display_order": 0,
            },
        )
        data = assert_created_response(response)
        assert data["method_type"] == "bank_transfer"
        assert "id" in data


# ============================================================================
# ACCOUNT DETAIL
# ============================================================================

class TestAccountDetail:
    """Tests for GET /api/v1/payment-accounts/{id}"""

    async def test_get_account_requires_auth(self, api_client):
        """Non-authenticated users cannot get account details."""
        response = await api_client.get(
            f"/api/v1/payment-accounts/{uuid4()}"
        )
        assert_unauthorized(response)

    async def test_get_account_not_found(
        self, api_client, auth_headers
    ):
        """Non-existent account returns 404."""
        response = await api_client.get(
            f"/api/v1/payment-accounts/{uuid4()}",
            headers=auth_headers,
        )
        assert_not_found(response)


# ============================================================================
# ACCOUNT UPDATE
# ============================================================================

class TestAccountUpdate:
    """Tests for PUT /api/v1/payment-accounts/{id}"""

    async def test_update_account_requires_auth(self, api_client):
        """Non-authenticated users cannot update accounts."""
        response = await api_client.put(
            f"/api/v1/payment-accounts/{uuid4()}",
            json={"account_name": "Hacked"},
        )
        assert_unauthorized(response)

    async def test_update_account_not_found(
        self, api_client, auth_headers
    ):
        """Updating non-existent account returns 404."""
        response = await api_client.put(
            f"/api/v1/payment-accounts/{uuid4()}",
            headers=auth_headers,
            json={"account_name": "Ghost Account"},
        )
        assert_not_found(response)


# ============================================================================
# ACCOUNT DELETION
# ============================================================================

class TestAccountDeletion:
    """Tests for DELETE /api/v1/payment-accounts/{id}"""

    async def test_delete_account_requires_auth(self, api_client):
        """Non-authenticated users cannot delete accounts."""
        response = await api_client.delete(
            f"/api/v1/payment-accounts/{uuid4()}"
        )
        assert_unauthorized(response)

    async def test_delete_account_not_found(
        self, api_client, auth_headers
    ):
        """Deleting non-existent account returns 404."""
        response = await api_client.delete(
            f"/api/v1/payment-accounts/{uuid4()}",
            headers=auth_headers,
        )
        assert_not_found(response)
