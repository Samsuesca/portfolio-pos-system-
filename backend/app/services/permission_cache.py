"""
Application-level Permission Cache

Shared TTL cache for permission lookups across all requests.
Replaces the per-instance cache in PermissionService.

Thread-safe for single-worker uvicorn. For multi-worker deployments,
replace with Redis-backed cache.
"""
import time
from uuid import UUID

_DEFAULT_TTL = 60  # seconds

_permission_cache: dict[str, tuple[set[str], float]] = {}
_constraint_cache: dict[str, tuple[dict, float]] = {}
_max_entries = 1000


def _cache_key(user_id: UUID, school_id: UUID) -> str:
    return f"{user_id}:{school_id}"


def _evict_expired(cache: dict[str, tuple]) -> None:
    now = time.monotonic()
    expired = [k for k, (_, ts) in cache.items() if now - ts > _DEFAULT_TTL]
    for k in expired:
        del cache[k]


def get_permissions(user_id: UUID, school_id: UUID) -> set[str] | None:
    key = _cache_key(user_id, school_id)
    entry = _permission_cache.get(key)
    if entry is None:
        return None
    value, timestamp = entry
    if time.monotonic() - timestamp > _DEFAULT_TTL:
        del _permission_cache[key]
        return None
    return value


def set_permissions(user_id: UUID, school_id: UUID, permissions: set[str]) -> None:
    if len(_permission_cache) >= _max_entries:
        _evict_expired(_permission_cache)
    key = _cache_key(user_id, school_id)
    _permission_cache[key] = (permissions, time.monotonic())


def get_constraints(user_id: UUID, school_id: UUID, permission_code: str) -> dict | None:
    key = f"{user_id}:{school_id}:{permission_code}"
    entry = _constraint_cache.get(key)
    if entry is None:
        return None
    value, timestamp = entry
    if time.monotonic() - timestamp > _DEFAULT_TTL:
        del _constraint_cache[key]
        return None
    return value


def set_constraints(
    user_id: UUID, school_id: UUID, permission_code: str, constraints: dict
) -> None:
    if len(_constraint_cache) >= _max_entries:
        _evict_expired(_constraint_cache)
    key = f"{user_id}:{school_id}:{permission_code}"
    _constraint_cache[key] = (constraints, time.monotonic())


def invalidate(user_id: UUID | None = None, school_id: UUID | None = None) -> None:
    """Invalidate cache entries matching the given user/school.

    - Both user_id and school_id: drops the exact key.
    - user_id only: drops all entries for that user (any school).
    - school_id only: drops all entries for that school (any user).
    - Neither: drops everything (use sparingly).
    """
    if user_id and school_id:
        key = _cache_key(user_id, school_id)
        _permission_cache.pop(key, None)
        prefix = f"{user_id}:{school_id}:"
        to_remove = [k for k in _constraint_cache if k.startswith(prefix)]
        for k in to_remove:
            del _constraint_cache[k]
    elif user_id:
        prefix = f"{user_id}:"
        to_remove = [k for k in _permission_cache if k.startswith(prefix)]
        for k in to_remove:
            del _permission_cache[k]
        to_remove = [k for k in _constraint_cache if k.startswith(prefix)]
        for k in to_remove:
            del _constraint_cache[k]
    elif school_id:
        suffix = f":{school_id}"
        sid_str = str(school_id)
        to_remove = [k for k in _permission_cache if k.endswith(suffix)]
        for k in to_remove:
            del _permission_cache[k]
        # constraint cache keys: <user>:<school>:<perm_code> — match middle segment.
        to_remove = [
            k for k in _constraint_cache
            if ":" in k and k.split(":")[1] == sid_str
        ]
        for k in to_remove:
            del _constraint_cache[k]
    else:
        _permission_cache.clear()
        _constraint_cache.clear()
