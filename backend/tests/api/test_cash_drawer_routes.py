"""
Tests for Cash Drawer Access Control API endpoints.

Tests cover:
- GET /cash-drawer/can-open (check permission)
- POST /cash-drawer/request-access (generate code)
- POST /cash-drawer/validate-access (validate code)
- POST /cash-drawer/open (direct open with permission)
- Code expiration and single-use behavior
"""
import pytest
from datetime import datetime, timedelta
from uuid import uuid4
from unittest.mock import patch, MagicMock

from tests.fixtures.assertions import (
    assert_success_response,
    assert_forbidden,
    assert_bad_request,
)


pytestmark = pytest.mark.api


# ============================================================================
# CAN OPEN DRAWER TESTS
# ============================================================================

class TestCanOpenDrawer:
    """Tests for GET /api/v1/cash-drawer/can-open"""

    async def test_can_open_superuser(
        self,
        api_client,
        superuser_headers
    ):
        """Superuser should always be able to open directly."""
        response = await api_client.get(
            "/api/v1/cash-drawer/can-open",
            headers=superuser_headers
        )

        data = assert_success_response(response)
        assert data["can_open_directly"] is True
        assert data["reason"] == "superuser"

    async def test_can_open_regular_user_no_permission(
        self,
        api_client,
        auth_headers
    ):
        """Regular user without permission should not be able to open directly."""
        response = await api_client.get(
            "/api/v1/cash-drawer/can-open",
            headers=auth_headers
        )

        data = assert_success_response(response)
        assert data["can_open_directly"] is False
        assert data["reason"] == "no_permission"

    async def test_can_open_no_auth(self, api_client):
        """Should require authentication."""
        response = await api_client.get("/api/v1/cash-drawer/can-open")

        assert response.status_code in [401, 403]


# ============================================================================
# REQUEST ACCESS CODE TESTS
# ============================================================================

class TestRequestAccessCode:
    """Tests for POST /api/v1/cash-drawer/request-access"""

    @patch('app.api.routes.cash_drawer.send_drawer_access_code')
    async def test_request_access_creates_code(
        self,
        mock_send_email,
        api_client,
        auth_headers,
        test_superuser,
        db_session
    ):
        """Should create a 6-digit access code."""
        mock_send_email.return_value = True

        response = await api_client.post(
            "/api/v1/cash-drawer/request-access",
            headers=auth_headers
        )

        data = assert_success_response(response)
        assert "message" in data
        assert "expires_in" in data
        assert "expires_at" in data

        # Verify expiration is ~5 minutes
        assert data["expires_in"] == 300  # 5 * 60 seconds

    @patch('app.api.routes.cash_drawer.send_drawer_access_code')
    async def test_request_access_sends_email(
        self,
        mock_send_email,
        api_client,
        auth_headers,
        test_superuser
    ):
        """Should send email to superusers."""
        mock_send_email.return_value = True

        response = await api_client.post(
            "/api/v1/cash-drawer/request-access",
            headers=auth_headers
        )

        data = assert_success_response(response)

        # Verify email was sent
        assert mock_send_email.called
        # Should mention emails were sent
        assert "administrador" in data["message"].lower()

    async def test_request_access_no_auth(self, api_client):
        """Should require authentication."""
        response = await api_client.post("/api/v1/cash-drawer/request-access")

        assert response.status_code in [401, 403]


# ============================================================================
# VALIDATE ACCESS CODE TESTS
# ============================================================================

class TestValidateAccessCode:
    """Tests for POST /api/v1/cash-drawer/validate-access"""

    @patch('app.api.routes.cash_drawer.send_drawer_access_code')
    async def test_validate_valid_code(
        self,
        mock_send_email,
        api_client,
        auth_headers,
        test_user,
        test_superuser,
        db_session
    ):
        """Should validate a correct, non-expired, unused code."""
        mock_send_email.return_value = True

        # First request a code
        from app.models.cash_drawer import DrawerAccessCode
        from datetime import datetime, timedelta

        code = "123456"
        access_code = DrawerAccessCode(
            code=code,
            requested_by_id=test_user.id,
            expires_at=datetime.utcnow() + timedelta(minutes=5)
        )
        db_session.add(access_code)
        await db_session.flush()

        # Validate the code
        response = await api_client.post(
            "/api/v1/cash-drawer/validate-access",
            headers=auth_headers,
            json={"code": code}
        )

        data = assert_success_response(response)
        assert data["valid"] is True
        assert "autorizado" in data["message"].lower()

    async def test_validate_invalid_code(
        self,
        api_client,
        auth_headers
    ):
        """Should reject invalid code."""
        response = await api_client.post(
            "/api/v1/cash-drawer/validate-access",
            headers=auth_headers,
            json={"code": "000000"}
        )

        assert_bad_request(response, detail_contains="invalido")

    async def test_validate_expired_code(
        self,
        api_client,
        auth_headers,
        test_user,
        db_session
    ):
        """Should reject expired code."""
        from app.models.cash_drawer import DrawerAccessCode
        from app.utils.timezone import get_colombia_now_naive
        from datetime import timedelta

        code = "654321"
        access_code = DrawerAccessCode(
            code=code,
            requested_by_id=test_user.id,
            expires_at=get_colombia_now_naive() - timedelta(minutes=1)  # Already expired
        )
        db_session.add(access_code)
        await db_session.flush()

        response = await api_client.post(
            "/api/v1/cash-drawer/validate-access",
            headers=auth_headers,
            json={"code": code}
        )

        assert_bad_request(response, detail_contains="expirado")

    async def test_validate_already_used_code(
        self,
        api_client,
        auth_headers,
        test_user,
        db_session
    ):
        """Should reject already used code."""
        from app.models.cash_drawer import DrawerAccessCode
        from datetime import datetime, timedelta

        code = "111222"
        access_code = DrawerAccessCode(
            code=code,
            requested_by_id=test_user.id,
            expires_at=datetime.utcnow() + timedelta(minutes=5),
            used_at=datetime.utcnow()  # Already used
        )
        db_session.add(access_code)
        await db_session.flush()

        response = await api_client.post(
            "/api/v1/cash-drawer/validate-access",
            headers=auth_headers,
            json={"code": code}
        )

        assert_bad_request(response, detail_contains="utilizado")

    async def test_validate_code_marks_as_used(
        self,
        api_client,
        auth_headers,
        test_user,
        db_session
    ):
        """Code should be marked as used after validation."""
        from app.models.cash_drawer import DrawerAccessCode
        from datetime import datetime, timedelta
        from sqlalchemy import select

        code = "333444"
        access_code = DrawerAccessCode(
            code=code,
            requested_by_id=test_user.id,
            expires_at=datetime.utcnow() + timedelta(minutes=5)
        )
        db_session.add(access_code)
        await db_session.flush()
        code_id = access_code.id

        # Validate
        response = await api_client.post(
            "/api/v1/cash-drawer/validate-access",
            headers=auth_headers,
            json={"code": code}
        )
        assert_success_response(response)

        # Check code was marked as used
        result = await db_session.execute(
            select(DrawerAccessCode).where(DrawerAccessCode.id == code_id)
        )
        updated_code = result.scalar_one()
        assert updated_code.used_at is not None

    async def test_validate_code_single_use(
        self,
        api_client,
        auth_headers,
        test_user,
        db_session
    ):
        """Code can only be used once."""
        from app.models.cash_drawer import DrawerAccessCode
        from datetime import datetime, timedelta

        code = "555666"
        access_code = DrawerAccessCode(
            code=code,
            requested_by_id=test_user.id,
            expires_at=datetime.utcnow() + timedelta(minutes=5)
        )
        db_session.add(access_code)
        await db_session.flush()

        # First validation - should succeed
        response1 = await api_client.post(
            "/api/v1/cash-drawer/validate-access",
            headers=auth_headers,
            json={"code": code}
        )
        assert_success_response(response1)

        # Second validation - should fail
        response2 = await api_client.post(
            "/api/v1/cash-drawer/validate-access",
            headers=auth_headers,
            json={"code": code}
        )
        assert_bad_request(response2, detail_contains="utilizado")


# ============================================================================
# DIRECT OPEN DRAWER TESTS
# ============================================================================

class TestOpenDrawerDirect:
    """Tests for POST /api/v1/cash-drawer/open"""

    async def test_open_direct_superuser(
        self,
        api_client,
        superuser_headers
    ):
        """Superuser should be able to open directly."""
        response = await api_client.post(
            "/api/v1/cash-drawer/open",
            headers=superuser_headers
        )

        data = assert_success_response(response)
        assert data["authorized"] is True
        assert data["reason"] == "superuser"

    async def test_open_direct_regular_user_forbidden(
        self,
        api_client,
        auth_headers
    ):
        """Regular user without permission should get 403."""
        response = await api_client.post(
            "/api/v1/cash-drawer/open",
            headers=auth_headers
        )

        assert_forbidden(response)

    async def test_open_direct_no_auth(self, api_client):
        """Should require authentication."""
        response = await api_client.post("/api/v1/cash-drawer/open")

        assert response.status_code in [401, 403]
