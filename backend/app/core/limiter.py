"""
Rate Limiter Configuration
Usa Redis en producción para rate limiting distribuido.

Default limits (applied to all endpoints unless overridden):
- 120/minute for all endpoints (general)
- Specific endpoints can override with @limiter.limit()
  e.g. auth login uses "5/minute"
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
        return ""
    return get_remote_address(request)


# Default rate limits applied to all endpoints
_default_limits = ["120/minute"]

# Rate limiter global
# En producción usa Redis como backend para rate limiting distribuido
# En desarrollo usa memoria in-memory
# Durante tests (TESTING=True), rate limiting está deshabilitado
if settings.ENV == "production":
    limiter = Limiter(
        key_func=get_rate_limit_key,
        default_limits=_default_limits,
        storage_uri=settings.REDIS_URL,
        enabled=not settings.TESTING
    )
else:
    limiter = Limiter(
        key_func=get_rate_limit_key,
        default_limits=_default_limits,
        enabled=not settings.TESTING
    )
