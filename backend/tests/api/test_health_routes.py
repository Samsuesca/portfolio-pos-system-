"""
Tests for Health API endpoints.

Tests cover:
- GET /ping            (public liveness probe)
- GET /health          (authenticated detailed health check)
"""
import pytest
from unittest.mock import patch, AsyncMock, MagicMock

from tests.fixtures.assertions import (
    assert_success_response,
    assert_unauthorized,
)


pytestmark = pytest.mark.api


class TestPing:
    """Tests for GET /ping"""

    async def test_ping_returns_ok(self, api_client):
        response = await api_client.get("/ping")
        data = assert_success_response(response)
        assert data["status"] == "ok"

    async def test_ping_no_auth_required(self, api_client):
        response = await api_client.get("/ping")
        assert response.status_code == 200


class TestHealthCheck:
    """Tests for GET /health"""

    @patch("app.api.routes.health.collect_health_sample")
    async def test_health_check_ok(
        self, mock_collect, api_client, superuser_headers
    ):
        sample = MagicMock()
        sample.db_ok = True
        sample.db_latency_ms = 2.5
        sample.disk_usage_pct = 45.0
        sample.memory_usage_pct = 60.0
        mock_collect.return_value = sample

        response = await api_client.get("/health", headers=superuser_headers)
        data = assert_success_response(response)

        assert data["status"] == "ok"
        assert "version" in data
        assert "service" in data
        assert "environment" in data
        assert "timestamp" in data
        assert "uptime_seconds" in data

    @patch("app.api.routes.health.collect_health_sample")
    async def test_health_check_degraded_when_db_down(
        self, mock_collect, api_client, superuser_headers
    ):
        sample = MagicMock()
        sample.db_ok = False
        sample.db_latency_ms = None
        sample.disk_usage_pct = 30.0
        sample.memory_usage_pct = 50.0
        mock_collect.return_value = sample

        response = await api_client.get("/health", headers=superuser_headers)
        data = assert_success_response(response)
        assert data["status"] == "degraded"
        assert data["checks"]["database"]["status"] == "error"

    @patch("app.api.routes.health.collect_health_sample")
    async def test_health_checks_structure(
        self, mock_collect, api_client, superuser_headers
    ):
        sample = MagicMock()
        sample.db_ok = True
        sample.db_latency_ms = 1.0
        sample.disk_usage_pct = 20.0
        sample.memory_usage_pct = 40.0
        mock_collect.return_value = sample

        response = await api_client.get("/health", headers=superuser_headers)
        data = assert_success_response(response)
        checks = data["checks"]
        assert "database" in checks
        assert "disk" in checks
        assert "memory" in checks
        assert checks["database"]["status"] == "ok"
        assert checks["disk"]["status"] == "ok"
        assert checks["memory"]["status"] == "ok"

    @patch("app.api.routes.health.collect_health_sample")
    async def test_disk_warning_when_high(
        self, mock_collect, api_client, superuser_headers
    ):
        sample = MagicMock()
        sample.db_ok = True
        sample.db_latency_ms = 1.0
        sample.disk_usage_pct = 95.0
        sample.memory_usage_pct = 40.0
        mock_collect.return_value = sample

        response = await api_client.get("/health", headers=superuser_headers)
        data = assert_success_response(response)
        assert data["checks"]["disk"]["status"] == "warning"

    @patch("app.api.routes.health.collect_health_sample")
    async def test_memory_warning_when_high(
        self, mock_collect, api_client, superuser_headers
    ):
        sample = MagicMock()
        sample.db_ok = True
        sample.db_latency_ms = 1.0
        sample.disk_usage_pct = 30.0
        sample.memory_usage_pct = 90.0
        mock_collect.return_value = sample

        response = await api_client.get("/health", headers=superuser_headers)
        data = assert_success_response(response)
        assert data["checks"]["memory"]["status"] == "warning"

    async def test_unauthenticated_returns_401_or_403(self, api_client):
        response = await api_client.get("/health")
        assert_unauthorized(response)

    async def test_non_superuser_rejected(self, api_client, auth_headers):
        response = await api_client.get("/health", headers=auth_headers)
        assert response.status_code in (401, 403)

    @patch("app.api.routes.health.collect_health_sample")
    async def test_uptime_metrics_present(
        self, mock_collect, api_client, superuser_headers
    ):
        sample = MagicMock()
        sample.db_ok = True
        sample.db_latency_ms = 1.0
        sample.disk_usage_pct = 30.0
        sample.memory_usage_pct = 40.0
        mock_collect.return_value = sample

        response = await api_client.get("/health", headers=superuser_headers)
        data = assert_success_response(response)
        assert "uptime_seconds" in data
        assert "uptime_pct" in data
        assert "total_errors_5xx" in data
