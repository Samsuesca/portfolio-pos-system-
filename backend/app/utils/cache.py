"""
Redis Cache Utilities

Simple get/set caching with JSON serialization and TTL-based expiry.
All operations are wrapped in try/except so cache failures never break the app.
"""
import json
import logging
from typing import Any

from app.core.redis_client import get_redis

logger = logging.getLogger(__name__)

# TTL constants (seconds)
TTL_SHORT = 120    # 2 minutes - for frequently changing data (dashboard)
TTL_MEDIUM = 300   # 5 minutes - for moderately changing data (schools, statements)
TTL_LONG = 600     # 10 minutes - for rarely changing data

# Key prefixes
PREFIX = "cache:"


async def cache_get(key: str) -> Any | None:
    """Get a cached value. Returns None on miss or error."""
    try:
        client = await get_redis()
        raw = await client.get(f"{PREFIX}{key}")
        if raw is None:
            return None
        return json.loads(raw)
    except Exception as e:
        logger.warning(f"Cache get failed for {key}: {e}")
        return None


async def cache_set(key: str, value: Any, ttl: int = TTL_MEDIUM) -> None:
    """Set a cached value with TTL. Silently fails on error."""
    try:
        client = await get_redis()
        await client.setex(f"{PREFIX}{key}", ttl, json.dumps(value, default=str))
    except Exception as e:
        logger.warning(f"Cache set failed for {key}: {e}")


async def cache_delete(key: str) -> None:
    """Delete a specific cache key."""
    try:
        client = await get_redis()
        await client.delete(f"{PREFIX}{key}")
    except Exception as e:
        logger.warning(f"Cache delete failed for {key}: {e}")


async def cache_delete_pattern(pattern: str) -> None:
    """Delete all keys matching a pattern (e.g. 'schools:*')."""
    try:
        client = await get_redis()
        keys = []
        async for key in client.scan_iter(match=f"{PREFIX}{pattern}"):
            keys.append(key)
        if keys:
            await client.delete(*keys)
    except Exception as e:
        logger.warning(f"Cache delete pattern failed for {pattern}: {e}")


# --- Invalidation helpers ---

async def invalidate_school_cache() -> None:
    """Invalidate all school-related caches."""
    await cache_delete_pattern("schools:*")


async def invalidate_accounting_caches() -> None:
    """Invalidate dashboard and financial statement caches."""
    await cache_delete_pattern("dashboard:*")
    await cache_delete_pattern("financial:*")
