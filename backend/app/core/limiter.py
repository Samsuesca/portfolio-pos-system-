"""
Rate Limiter Configuration
"""
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.core.config import settings


def get_rate_limit_key(request) -> str:
    """
    Get the rate limit key for a request.
    Returns empty string during testing to effectively disable rate limiting.
    """
    if settings.TESTING:
        # Return a unique key per request to bypass rate limiting in tests
        return ""
    return get_remote_address(request)


# Rate limiter global - usa memoria en desarrollo
# En produccion se puede configurar Redis como backend
# During testing (TESTING=True), rate limiting is effectively disabled
limiter = Limiter(
    key_func=get_rate_limit_key,
    enabled=not settings.TESTING  # Disable limiter completely during tests
)
