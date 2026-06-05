"""
Phase 0A integration tests: GET /api/v1/permissions/registry.

Verifica el contrato HTTP del endpoint:
  1. Responde 200 con shape correcto (requiere auth).
  2. Setea ETag header con el version actual.
  3. Setea Cache-Control con max-age=3600.
"""
import pytest


pytestmark = pytest.mark.api


class TestPermissionRegistryEndpoint:
    """Tests for GET /api/v1/permissions/registry"""

    async def test_returns_200_with_required_keys(self, api_client, auth_headers):
        """El registry expone permissions, system_roles, version."""
        response = await api_client.get(
            "/api/v1/permissions/registry", headers=auth_headers
        )

        assert response.status_code == 200
        body = response.json()
        assert "permissions" in body
        assert "system_roles" in body
        assert "version" in body
        assert isinstance(body["permissions"], list)
        assert isinstance(body["system_roles"], dict)

    async def test_sets_etag_header(self, api_client, auth_headers):
        """Backend emite ETag para que clients puedan implementar 304 round-trip."""
        response = await api_client.get(
            "/api/v1/permissions/registry", headers=auth_headers
        )

        assert response.status_code == 200
        assert "etag" in {k.lower() for k in response.headers}

    async def test_sets_cache_control_max_age(self, api_client, auth_headers):
        """Cache-Control public con max-age para HTTP layer cache."""
        response = await api_client.get(
            "/api/v1/permissions/registry", headers=auth_headers
        )

        assert response.status_code == 200
        cache_control = response.headers.get("cache-control", "")
        assert "max-age" in cache_control

    async def test_requires_authentication(self, api_client):
        """Sin token: 403 (FastAPI HTTPBearer default)."""
        response = await api_client.get("/api/v1/permissions/registry")
        assert response.status_code == 403
