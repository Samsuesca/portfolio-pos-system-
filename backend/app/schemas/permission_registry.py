"""
Permission Registry Schemas

Response models for the public permission registry endpoint.
Frontends consume this to eliminate hardcoded permission maps.
"""
from pydantic import BaseModel, Field
from typing import Any


class PermissionRegistryItem(BaseModel):
    code: str
    category: str
    name: str
    description: str | None = None
    is_sensitive: bool = False


class PermissionRegistryResponse(BaseModel):
    permissions: list[PermissionRegistryItem]
    system_roles: dict[str, list[str] | None] = Field(
        description="Permission codes per system role. null = all permissions (owner)"
    )
    role_constraints: dict[str, dict[str, dict[str, Any]]] = Field(
        description="Constraints per permission per role. e.g. {'sales.apply_discount': {'seller': {'max_discount_percent': 10}}}"
    )
    role_max_discount: dict[str, int] = Field(
        description="Default max discount percent per system role"
    )
    version: str = Field(
        description="SHA256 hash of the payload for cache invalidation"
    )
