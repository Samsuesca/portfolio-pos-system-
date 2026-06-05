"""
Permission Registry — Single Source of Truth

Public, cacheable endpoint that exposes the complete permission catalog,
system role mappings, and constraint definitions. Frontends consume this
instead of maintaining hardcoded copies of SYSTEM_ROLE_PERMISSIONS.
"""
import hashlib
import json
from decimal import Decimal
from typing import Any

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse

from app.api.dependencies import get_current_user

from app.schemas.permission_registry import (
    PermissionRegistryItem,
    PermissionRegistryResponse,
)
from app.services.permission import (
    SYSTEM_ROLE_PERMISSIONS,
    SYSTEM_ROLE_MAX_DISCOUNT,
    SYSTEM_ROLE_CONSTRAINTS,
    EXTRA_REGISTRY_PERMISSIONS,
    SENSITIVE_PERMISSION_CODES,
)
from app.models.user import UserRole

router = APIRouter(prefix="/permissions", tags=["Permission Registry"])

_cached_response: dict | None = None
_cached_version: str | None = None


def _decimal_serializer(obj: Any) -> Any:
    if isinstance(obj, Decimal):
        return float(obj)
    raise TypeError(f"Object of type {type(obj)} is not JSON serializable")


def _build_registry() -> tuple[dict, str]:
    """Build the registry payload and its version hash."""
    global _cached_response, _cached_version
    if _cached_response is not None and _cached_version is not None:
        return _cached_response, _cached_version

    permissions = []
    for role_enum in UserRole:
        perms = SYSTEM_ROLE_PERMISSIONS.get(role_enum)
        if perms is None:
            continue
        for code in perms:
            if not any(p["code"] == code for p in permissions):
                parts = code.split(".", 1)
                category = parts[0] if len(parts) > 1 else "general"
                permissions.append({
                    "code": code,
                    "category": category,
                    "name": code.replace(".", " ").replace("_", " ").title(),
                    "description": None,
                    "is_sensitive": code in SENSITIVE_PERMISSION_CODES,
                })

    # Expose permissions present in the catalog but not assigned to any system
    # role (only reachable via OWNER or explicit custom-role assignment).
    for extra in EXTRA_REGISTRY_PERMISSIONS:
        if any(p["code"] == extra["code"] for p in permissions):
            continue
        permissions.append({
            "code": extra["code"],
            "category": extra["category"],
            "name": extra["name"],
            "description": extra.get("description"),
            "is_sensitive": bool(extra.get("is_sensitive", False)),
        })

    system_roles: dict[str, list[str] | None] = {}
    for role_enum in UserRole:
        perms = SYSTEM_ROLE_PERMISSIONS.get(role_enum)
        if perms is None:
            system_roles[role_enum.value] = None
        else:
            system_roles[role_enum.value] = sorted(perms)

    role_constraints: dict[str, dict[str, dict[str, Any]]] = {}
    for perm_code, role_map in SYSTEM_ROLE_CONSTRAINTS.items():
        role_constraints[perm_code] = {}
        for role_enum, constraints in role_map.items():
            serializable = {}
            for k, v in constraints.items():
                serializable[k] = float(v) if isinstance(v, Decimal) else v
            role_constraints[perm_code][role_enum.value] = serializable

    role_max_discount = {
        role.value: pct for role, pct in SYSTEM_ROLE_MAX_DISCOUNT.items()
    }

    payload = {
        "permissions": permissions,
        "system_roles": system_roles,
        "role_constraints": role_constraints,
        "role_max_discount": role_max_discount,
    }

    version_str = json.dumps(payload, sort_keys=True, default=_decimal_serializer)
    version = hashlib.sha256(version_str.encode()).hexdigest()[:16]

    payload["version"] = version

    _cached_response = payload
    _cached_version = version
    return payload, version


@router.get(
    "/registry",
    response_model=PermissionRegistryResponse,
    summary="Permission registry (authenticated, cacheable)",
    description=(
        "Returns the complete permission catalog, system role mappings, "
        "and constraint definitions. Requires authentication. "
        "Frontends should cache this response "
        "and use the `version` field to detect changes."
    ),
    dependencies=[Depends(get_current_user)],
    operation_id="getPermissionRegistry",
)
async def get_permission_registry():
    payload, version = _build_registry()
    response = JSONResponse(content=payload)
    response.headers["Cache-Control"] = "public, max-age=3600"
    response.headers["ETag"] = f'"{version}"'
    return response
