"""
Permission Schemas - Pydantic models for permission-related endpoints
"""
from datetime import datetime
from uuid import UUID
from decimal import Decimal
from pydantic import BaseModel, Field
from typing import Optional


# ============================================
# Permission Schemas
# ============================================

class PermissionBase(BaseModel):
    """Base schema for permissions"""
    code: str = Field(..., min_length=1, max_length=100)
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    category: str = Field(..., min_length=1, max_length=50)
    is_sensitive: bool = False


class PermissionResponse(PermissionBase):
    """Response schema for permissions"""
    id: UUID

    model_config = {"from_attributes": True}


class PermissionCatalogItem(BaseModel):
    """Permission item for catalog display"""
    code: str
    name: str
    description: Optional[str]
    category: str
    is_sensitive: bool

    model_config = {"from_attributes": True}


class PermissionCatalog(BaseModel):
    """Grouped permission catalog by category"""
    categories: dict[str, list[PermissionCatalogItem]]


# ============================================
# Custom Role Schemas
# ============================================

class CustomRoleBase(BaseModel):
    """Base schema for custom roles"""
    code: str = Field(..., min_length=1, max_length=50)
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None
    color: Optional[str] = Field(None, max_length=7, pattern=r'^#[0-9A-Fa-f]{6}$')
    icon: Optional[str] = Field(None, max_length=50)
    priority: int = 0


class CustomRoleCreate(CustomRoleBase):
    """Schema for creating a custom role"""
    permissions: list[str] = Field(default_factory=list, description="List of permission codes to assign")
    permission_constraints: Optional[dict[str, dict]] = Field(
        default=None,
        description="Optional constraints per permission, e.g. {'sales.apply_discount': {'max_discount_percent': 15}}"
    )


class CustomRoleUpdate(BaseModel):
    """Schema for updating a custom role"""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = None
    color: Optional[str] = Field(None, max_length=7, pattern=r'^#[0-9A-Fa-f]{6}$')
    icon: Optional[str] = Field(None, max_length=50)
    priority: Optional[int] = None
    permissions: Optional[list[str]] = None
    permission_constraints: Optional[dict[str, dict]] = None


class RolePermissionResponse(BaseModel):
    """Response schema for role permissions with constraints"""
    permission_code: str
    permission_name: str
    max_discount_percent: Optional[int] = None
    max_amount: Optional[Decimal] = None
    requires_approval: bool = False

    model_config = {"from_attributes": True}


class CustomRoleResponse(CustomRoleBase):
    """Response schema for custom roles"""
    id: UUID
    school_id: Optional[UUID] = None
    is_system: bool
    is_active: bool
    created_at: datetime
    permissions: list[str] = Field(default_factory=list, description="List of permission codes")

    model_config = {"from_attributes": True}


class CustomRoleDetailResponse(CustomRoleResponse):
    """Detailed response schema with full permission info"""
    permission_details: list[RolePermissionResponse] = Field(default_factory=list)


# ============================================
# User Permission Schemas
# ============================================

class UserEffectivePermissions(BaseModel):
    """Schema for user's effective permissions in a school"""
    user_id: UUID
    school_id: UUID
    role_type: str = Field(..., description="'system' or 'custom'")
    role_code: str
    role_name: str
    role_color: Optional[str] = None
    role_icon: Optional[str] = None
    permissions: list[str]
    max_discount_percent: int = 0
    permission_overrides: Optional[dict] = None


class PermissionOverride(BaseModel):
    """Schema for permission overrides"""
    grant: list[str] = Field(default_factory=list, description="Permission codes to grant")
    revoke: list[str] = Field(default_factory=list, description="Permission codes to revoke")


# ============================================
# School User Management Schemas
# ============================================

class SchoolUserResponse(BaseModel):
    """Response schema for a user in a school context"""
    user_id: UUID
    username: str
    email: str
    full_name: Optional[str] = None
    is_active: bool
    role_type: str = Field(..., description="'system' or 'custom'")
    role_code: str
    role_name: str
    role_color: Optional[str] = None
    is_primary: bool = False
    created_at: datetime


class InviteUserRequest(BaseModel):
    """Schema for inviting a user to a school"""
    user_id: Optional[UUID] = Field(None, description="Existing user ID (if inviting existing user)")
    email: Optional[str] = Field(None, description="Email for new user (if creating new)")
    username: Optional[str] = Field(None, description="Username for new user")
    full_name: Optional[str] = None
    password: Optional[str] = Field(None, min_length=8, description="Password for new user")
    role: Optional[str] = Field(None, description="System role: viewer, seller, admin")
    custom_role_id: Optional[UUID] = Field(None, description="Custom role ID (alternative to system role)")


class UpdateUserRoleRequest(BaseModel):
    """Schema for updating a user's role in a school"""
    role: Optional[str] = Field(None, description="System role: viewer, seller, admin, owner")
    custom_role_id: Optional[UUID] = Field(None, description="Custom role ID (alternative to system role)")
    permission_overrides: Optional[PermissionOverride] = None
    is_primary: Optional[bool] = None
