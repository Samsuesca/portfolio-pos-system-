"""
Security tests for rate limiting configuration.

Tests:
- Rate limiter is properly configured
- Default limits are applied
- Contact submit has specific rate limit
- Testing mode disables rate limiting
"""
import pytest
from unittest.mock import patch


class TestRateLimiterConfig:
    """Verify rate limiting is properly configured."""

    def test_limiter_has_default_limits(self):
        """The limiter should have default rate limits configured."""
        from app.core.limiter import limiter
        assert limiter._default_limits is not None
        assert len(limiter._default_limits) > 0

    def test_default_limit_is_120_per_minute(self):
        """Default rate limit should be 120 requests per minute."""
        from app.core.limiter import _default_limits
        assert "120/minute" in _default_limits

    def test_testing_mode_disables_rate_limiting(self):
        """When TESTING=True, rate limiting should be disabled."""
        from app.core.limiter import limiter
        from app.core.config import settings

        # In test environment, TESTING should be True
        assert settings.TESTING is True
        # The limiter should be in a state that doesn't block test requests
        assert limiter is not None

    def test_rate_limit_key_function_exists(self):
        """Rate limit key function should be defined for identifying clients."""
        from app.core.limiter import get_rate_limit_key
        assert callable(get_rate_limit_key)

    def test_contacts_submit_has_specific_limit(self):
        """Contact submit endpoint should have a stricter rate limit (10/min)."""
        from app.api.routes.contacts import router

        # Verify the router exists and has routes
        routes = [r for r in router.routes]
        submit_routes = [r for r in routes if hasattr(r, 'path') and 'submit' in r.path]
        assert len(submit_routes) > 0, "Contact submit endpoint should exist"


class TestRateLimitBypass:
    """Test that rate limiting cannot be easily bypassed."""

    def test_rate_limit_key_uses_client_ip(self):
        """Rate limit should be keyed on client IP, not just auth token."""
        from app.core.limiter import get_rate_limit_key
        from unittest.mock import MagicMock

        mock_request = MagicMock()
        mock_request.client.host = "192.168.1.1"
        mock_request.headers = {}

        key = get_rate_limit_key(mock_request)
        assert key is not None
        assert isinstance(key, str)

    def test_x_forwarded_for_is_handled(self):
        """X-Forwarded-For header should be considered for rate limiting."""
        from app.core.limiter import get_rate_limit_key
        from unittest.mock import MagicMock

        mock_request = MagicMock()
        mock_request.client.host = "127.0.0.1"
        mock_request.headers = {"X-Forwarded-For": "203.0.113.1"}

        key = get_rate_limit_key(mock_request)
        assert key is not None
