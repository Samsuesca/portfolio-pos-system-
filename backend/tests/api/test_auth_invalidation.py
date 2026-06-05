"""
Tests for JWT invalidation via User.token_version.

Cubre los hallazgos cerrados en PR B fix #4:
- ``change_password`` y ``verify_email`` bumpean ``User.token_version``,
  invalidando JWTs vivos.
- ``get_current_user`` rechaza JWTs cuyo ``token_version`` no coincide
  con el campo en DB (HTTP 401).
- Tokens emitidos antes de la migración (sin claim ``token_version``)
  se aceptan por compatibilidad hasta su ``exp`` natural.
"""
from uuid import UUID, uuid4
from datetime import datetime, timedelta
from unittest.mock import MagicMock

import jwt as pyjwt
import pytest

from app.core.config import settings
from app.services.user import UserService


pytestmark = [pytest.mark.api, pytest.mark.asyncio]


def _craft_jwt(
    user_id: UUID,
    username: str,
    *,
    token_version: int | None = 0,
    expires_in_minutes: int = 30,
) -> str:
    """Build a JWT with explicit control over claims (incluido token_version)."""
    payload = {
        "sub": str(user_id),
        "username": username,
        "exp": datetime.utcnow() + timedelta(minutes=expires_in_minutes),
    }
    if token_version is not None:
        payload["token_version"] = token_version
    return pyjwt.encode(
        payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM
    )


def _headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


# ============================================================================
# /auth/me como canario para validar token_version
# ============================================================================


class TestTokenVersionEnforcement:
    """``get_current_user`` rechaza tokens cuyo ``token_version`` quedó stale."""

    async def test_matching_token_version_is_accepted(
        self, api_client, test_user
    ):
        """Token con token_version igual al de DB → 200."""
        token = _craft_jwt(
            UUID(test_user.id), test_user.username,
            token_version=test_user.token_version,
        )
        response = await api_client.get("/api/v1/auth/me", headers=_headers(token))
        assert response.status_code == 200

    async def test_stale_token_version_is_rejected(
        self, api_client, test_user, db_session
    ):
        """Token con token_version inferior → 401 'Token invalidado'.

        Usa el ``TokenInvalidator`` real para bumpear, lo que asegura que
        el flujo end-to-end (sin trucos sobre el identity map de SQLAlchemy)
        produce el rechazo esperado en el siguiente request.
        """
        from app.services.auth_invalidation import TokenInvalidator

        # Snapshot de la version antes del bump para crear el token viejo.
        old_version = test_user.token_version
        user_uuid = UUID(str(test_user.id))
        username = test_user.username

        await TokenInvalidator(db_session).bump_user(user_uuid)
        await db_session.flush()
        await db_session.refresh(test_user)
        assert test_user.token_version == old_version + 1

        # Token emitido con la version vieja.
        old_token = _craft_jwt(
            user_uuid, username,
            token_version=old_version,
        )
        response = await api_client.get(
            "/api/v1/auth/me", headers=_headers(old_token)
        )

        assert response.status_code == 401
        assert "invalidado" in response.json()["detail"].lower()

    async def test_legacy_token_without_version_is_accepted(
        self, api_client, test_user
    ):
        """Tokens emitidos antes de la migración (sin claim) se aceptan.

        Backwards-compat: durante el deploy gradual, JWTs en circulación
        no llevan el claim. El endpoint devuelve 200 hasta que el
        primer bump local (cambio de password) los invalide.
        """
        token = _craft_jwt(
            UUID(test_user.id), test_user.username,
            token_version=None,  # claim ausente
        )
        response = await api_client.get(
            "/api/v1/auth/me", headers=_headers(token)
        )
        assert response.status_code == 200


# ============================================================================
# change_password bumpea token_version
# ============================================================================


class TestChangePasswordInvalidatesJWT:
    """``POST /auth/change-password`` invalida el token actual + tokens vivos."""

    async def test_change_password_bumps_token_version(
        self, api_client, test_user, db_session
    ):
        """Tras cambiar password, token_version del usuario aumenta."""
        # Crear token con la version actual (0)
        original_version = test_user.token_version

        # Set a known password so change_password validates correctly.
        test_user.hashed_password = UserService.hash_password("OldPass2026!")
        await db_session.flush()

        token = _craft_jwt(
            UUID(test_user.id), test_user.username,
            token_version=original_version,
        )

        response = await api_client.post(
            "/api/v1/auth/change-password",
            json={
                "old_password": "OldPass2026!",
                "new_password": "NewPass2026!",
            },
            headers=_headers(token),
        )
        assert response.status_code == 200

        # token_version debió incrementarse en DB.
        await db_session.refresh(test_user)
        assert test_user.token_version == original_version + 1

    async def test_old_token_rejected_after_password_change(
        self, api_client, test_user, db_session
    ):
        """JWT pre-cambio queda inutilizable post-bump."""
        original_version = test_user.token_version
        test_user.hashed_password = UserService.hash_password("OldPass2026!")
        await db_session.flush()

        old_token = _craft_jwt(
            UUID(test_user.id), test_user.username,
            token_version=original_version,
        )

        # Cambia password
        change_resp = await api_client.post(
            "/api/v1/auth/change-password",
            json={
                "old_password": "OldPass2026!",
                "new_password": "NewPass2026!",
            },
            headers=_headers(old_token),
        )
        assert change_resp.status_code == 200

        # Reintenta /me con el MISMO token viejo → 401
        me_resp = await api_client.get(
            "/api/v1/auth/me", headers=_headers(old_token)
        )
        assert me_resp.status_code == 401
        assert "invalidado" in me_resp.json()["detail"].lower()


# ============================================================================
# Service-level: TokenInvalidator
# ============================================================================


class TestTokenInvalidator:
    """El service ``TokenInvalidator`` bumpea atómicamente."""

    async def test_bump_user_increments_token_version(
        self, db_session, test_user
    ):
        from app.services.auth_invalidation import TokenInvalidator

        before = test_user.token_version
        await TokenInvalidator(db_session).bump_user(UUID(test_user.id))
        await db_session.flush()
        await db_session.refresh(test_user)
        assert test_user.token_version == before + 1

    async def test_bump_twice_increments_twice(
        self, db_session, test_user
    ):
        from app.services.auth_invalidation import TokenInvalidator

        before = test_user.token_version
        invalidator = TokenInvalidator(db_session)
        await invalidator.bump_user(UUID(test_user.id))
        await invalidator.bump_user(UUID(test_user.id))
        await db_session.flush()
        await db_session.refresh(test_user)
        assert test_user.token_version == before + 2


# ============================================================================
# create_access_token incluye el claim
# ============================================================================


class TestTokenCreationIncludesVersion:
    """``UserService.create_access_token`` debe codificar ``token_version``."""

    def test_token_payload_includes_token_version(self, db_session):
        service = UserService(db_session)
        user_id = uuid4()
        token = service.create_access_token(
            user_id=user_id,
            username="testing",
            token_version=7,
        )
        payload = pyjwt.decode(
            token.access_token, settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM],
        )
        assert payload["token_version"] == 7

    def test_default_token_version_is_zero(self, db_session):
        """Sin override, ``token_version`` defaultea a 0 (mismo valor que User al crear)."""
        service = UserService(db_session)
        token = service.create_access_token(
            user_id=uuid4(), username="testing"
        )
        payload = pyjwt.decode(
            token.access_token, settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM],
        )
        assert payload["token_version"] == 0
