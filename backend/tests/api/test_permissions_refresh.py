"""
Phase 2B integration tests: GET /api/v1/auth/permissions-refresh.

Verifica:
  1. Status `current` cuando version coincide con DB.
  2. Status `stale` con payload completo cuando version diverge.
  3. bump_user incrementa permissions_version en DB.
"""
import pytest
from sqlalchemy import update

from app.models.user import User
from app.services.permission_invalidation import PermissionInvalidator


pytestmark = pytest.mark.api


class TestPermissionsRefresh:
    """Tests for GET /api/v1/auth/permissions-refresh"""

    async def test_returns_current_when_versions_match(
        self, api_client, test_user, db_session, auth_headers
    ):
        """Si el frontend envia la misma version que la DB → status='current'."""
        version = test_user.permissions_version or 0
        response = await api_client.get(
            f"/api/v1/auth/permissions-refresh?version={version}",
            headers=auth_headers,
        )

        assert response.status_code == 200
        body = response.json()
        assert body["status"] == "current"

    async def test_returns_stale_with_payload_when_versions_diverge(
        self, api_client, test_user_with_school_role, db_session, auth_headers
    ):
        """Si la version del cliente es menor → status='stale' + school_roles."""
        user, school = test_user_with_school_role
        original_version = user.permissions_version or 0

        # Bump in DB to simulate role change after frontend last polled.
        await db_session.execute(
            update(User)
            .where(User.id == user.id)
            .values(permissions_version=original_version + 1)
        )
        await db_session.commit()

        response = await api_client.get(
            f"/api/v1/auth/permissions-refresh?version={original_version}",
            headers=auth_headers,
        )

        assert response.status_code == 200
        body = response.json()
        assert body["status"] == "stale"
        assert body["permissions_version"] == original_version + 1
        assert "school_roles" in body
        assert isinstance(body["school_roles"], list)

    async def test_requires_authentication(self, api_client):
        """Sin token: 403 (FastAPI HTTPBearer default)."""
        response = await api_client.get("/api/v1/auth/permissions-refresh?version=0")
        assert response.status_code == 403


class TestPermissionInvalidatorIntegration:
    """End-to-end tests del PermissionInvalidator contra DB real."""

    async def test_bump_user_increments_version_in_db(
        self, db_session, test_user
    ):
        """bump_user emite UPDATE que incrementa permissions_version."""
        original = test_user.permissions_version or 0
        invalidator = PermissionInvalidator(db_session)

        await invalidator.bump_user(test_user.id)
        await db_session.commit()

        refreshed = await db_session.get(User, test_user.id)
        assert refreshed.permissions_version == original + 1
