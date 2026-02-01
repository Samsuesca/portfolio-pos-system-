"""
Custom Roles Management Endpoints

This module provides endpoints for managing custom roles within a school.
OWNERs can create, edit, and delete custom roles with specific permissions.

System roles (viewer, seller, admin, owner) cannot be modified.
"""
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy import select, func, delete as sql_delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.dependencies import (
    get_current_user,
    get_db,
    require_owner_or_superuser,
    require_permission,
    CurrentUser,
    DatabaseSession,
)
from app.models.permission import Permission, CustomRole, RolePermission
from app.models.user import UserSchoolRole
from app.schemas.base import BaseSchema
from pydantic import Field


router = APIRouter(prefix="/schools/{school_id}/roles", tags=["custom-roles"])


# ============================================
# Schemas
# ============================================

class PermissionResponse(BaseSchema):
    """Permission info"""
    id: UUID
    code: str
    name: str
    description: str | None
    category: str
    is_sensitive: bool


class PermissionWithConstraints(BaseSchema):
    """Permission with role-specific constraints"""
    code: str
    max_discount_percent: int | None = None
    max_amount: float | None = None
    requires_approval: bool = False


class RolePermissionResponse(BaseSchema):
    """Role permission with constraints"""
    permission_code: str
    permission_name: str
    max_discount_percent: int | None
    max_amount: float | None
    requires_approval: bool


class CustomRoleResponse(BaseSchema):
    """Custom role info"""
    id: UUID
    code: str
    name: str
    description: str | None
    color: str | None
    icon: str | None
    priority: int
    is_system: bool
    is_active: bool
    permissions: list[RolePermissionResponse] = []
    user_count: int = 0


class CustomRoleListResponse(BaseSchema):
    """List of roles"""
    roles: list[CustomRoleResponse]
    total: int


class CreateCustomRoleRequest(BaseSchema):
    """Request to create a custom role"""
    code: str = Field(..., min_length=2, max_length=50, pattern=r'^[a-z][a-z0-9_]*$')
    name: str = Field(..., min_length=2, max_length=100)
    description: str | None = None
    color: str | None = Field(None, pattern=r'^#[0-9A-Fa-f]{6}$')
    icon: str | None = Field(None, max_length=50)
    priority: int = 0
    permissions: list[PermissionWithConstraints] = []


class UpdateCustomRoleRequest(BaseSchema):
    """Request to update a custom role"""
    name: str | None = Field(None, min_length=2, max_length=100)
    description: str | None = None
    color: str | None = Field(None, pattern=r'^#[0-9A-Fa-f]{6}$')
    icon: str | None = Field(None, max_length=50)
    priority: int | None = None
    is_active: bool | None = None
    permissions: list[PermissionWithConstraints] | None = None


class PermissionCatalogResponse(BaseSchema):
    """Catalog of available permissions grouped by category"""
    categories: dict[str, list[PermissionResponse]]
    total: int


# ============================================
# Endpoints
# ============================================

@router.get(
    "/permissions",
    response_model=PermissionCatalogResponse,
    summary="Get permission catalog",
    description="Get all available permissions grouped by category."
)
async def get_permission_catalog(
    school_id: UUID,
    db: DatabaseSession,
    current_user: CurrentUser,
    _: None = Depends(require_permission("users.view")),
):
    """Get the catalog of all available permissions."""

    result = await db.execute(
        select(Permission).order_by(Permission.category, Permission.code)
    )
    permissions = result.scalars().all()

    # Group by category
    categories: dict[str, list[PermissionResponse]] = {}
    for perm in permissions:
        if perm.category not in categories:
            categories[perm.category] = []
        categories[perm.category].append(PermissionResponse(
            id=perm.id,
            code=perm.code,
            name=perm.name,
            description=perm.description,
            category=perm.category,
            is_sensitive=perm.is_sensitive,
        ))

    return PermissionCatalogResponse(
        categories=categories,
        total=len(permissions)
    )


@router.get(
    "",
    response_model=CustomRoleListResponse,
    summary="List roles",
    description="Get all roles available for this school (system + custom)."
)
async def list_roles(
    school_id: UUID,
    db: DatabaseSession,
    current_user: CurrentUser,
    _: None = Depends(require_permission("users.view")),
    include_system: bool = Query(True, description="Include system roles"),
    active_only: bool = Query(True, description="Only active roles"),
):
    """List all roles available for this school."""

    # Query for roles (system roles have school_id=NULL, custom have school_id=school_id)
    query = (
        select(CustomRole)
        .options(selectinload(CustomRole.permissions).selectinload(RolePermission.permission))
    )

    if include_system:
        query = query.where(
            (CustomRole.school_id == school_id) | (CustomRole.is_system == True)
        )
    else:
        query = query.where(CustomRole.school_id == school_id)

    if active_only:
        query = query.where(CustomRole.is_active == True)

    query = query.order_by(CustomRole.is_system.desc(), CustomRole.priority.desc(), CustomRole.name)

    result = await db.execute(query)
    roles = result.scalars().all()

    # Get user counts for each role
    role_ids = [r.id for r in roles]
    user_counts = {}

    if role_ids:
        # Count users with custom_role_id
        count_result = await db.execute(
            select(UserSchoolRole.custom_role_id, func.count(UserSchoolRole.id))
            .where(
                UserSchoolRole.school_id == school_id,
                UserSchoolRole.custom_role_id.in_(role_ids)
            )
            .group_by(UserSchoolRole.custom_role_id)
        )
        for row in count_result.fetchall():
            if row[0]:
                user_counts[row[0]] = row[1]

    # Build response
    role_responses = []
    for role in roles:
        permissions = []
        for rp in role.permissions:
            if rp.permission:
                permissions.append(RolePermissionResponse(
                    permission_code=rp.permission.code,
                    permission_name=rp.permission.name,
                    max_discount_percent=rp.max_discount_percent,
                    max_amount=float(rp.max_amount) if rp.max_amount else None,
                    requires_approval=rp.requires_approval,
                ))

        role_responses.append(CustomRoleResponse(
            id=role.id,
            code=role.code,
            name=role.name,
            description=role.description,
            color=role.color,
            icon=role.icon,
            priority=role.priority,
            is_system=role.is_system,
            is_active=role.is_active,
            permissions=permissions,
            user_count=user_counts.get(role.id, 0),
        ))

    return CustomRoleListResponse(roles=role_responses, total=len(role_responses))


@router.post(
    "",
    response_model=CustomRoleResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create custom role",
    description="Create a new custom role for this school. OWNER or superuser required."
)
async def create_custom_role(
    school_id: UUID,
    request: CreateCustomRoleRequest,
    db: DatabaseSession,
    current_user: CurrentUser,
    _: None = Depends(require_owner_or_superuser()),
):
    """Create a new custom role."""

    # Check if code already exists for this school
    existing = await db.execute(
        select(CustomRole).where(
            CustomRole.school_id == school_id,
            CustomRole.code == request.code
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Role with code '{request.code}' already exists"
        )

    # Create the role
    role = CustomRole(
        school_id=school_id,
        code=request.code,
        name=request.name,
        description=request.description,
        color=request.color,
        icon=request.icon,
        priority=request.priority,
        is_system=False,
        is_active=True,
        created_by=current_user.id,
    )
    db.add(role)
    await db.flush()

    # Add permissions
    if request.permissions:
        await _update_role_permissions(db, role.id, request.permissions)

    await db.commit()
    await db.refresh(role, ["permissions"])

    # Build response
    permissions = []
    for rp in role.permissions:
        await db.refresh(rp, ["permission"])
        if rp.permission:
            permissions.append(RolePermissionResponse(
                permission_code=rp.permission.code,
                permission_name=rp.permission.name,
                max_discount_percent=rp.max_discount_percent,
                max_amount=float(rp.max_amount) if rp.max_amount else None,
                requires_approval=rp.requires_approval,
            ))

    return CustomRoleResponse(
        id=role.id,
        code=role.code,
        name=role.name,
        description=role.description,
        color=role.color,
        icon=role.icon,
        priority=role.priority,
        is_system=role.is_system,
        is_active=role.is_active,
        permissions=permissions,
        user_count=0,
    )


@router.get(
    "/{role_id}",
    response_model=CustomRoleResponse,
    summary="Get role details",
    description="Get details of a specific role."
)
async def get_role(
    school_id: UUID,
    role_id: UUID,
    db: DatabaseSession,
    current_user: CurrentUser,
    _: None = Depends(require_permission("users.view")),
):
    """Get details of a specific role."""

    result = await db.execute(
        select(CustomRole)
        .options(selectinload(CustomRole.permissions).selectinload(RolePermission.permission))
        .where(
            CustomRole.id == role_id,
            (CustomRole.school_id == school_id) | (CustomRole.is_system == True)
        )
    )
    role = result.scalar_one_or_none()

    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Role not found"
        )

    # Get user count
    count_result = await db.execute(
        select(func.count(UserSchoolRole.id))
        .where(
            UserSchoolRole.school_id == school_id,
            UserSchoolRole.custom_role_id == role_id
        )
    )
    user_count = count_result.scalar() or 0

    permissions = []
    for rp in role.permissions:
        if rp.permission:
            permissions.append(RolePermissionResponse(
                permission_code=rp.permission.code,
                permission_name=rp.permission.name,
                max_discount_percent=rp.max_discount_percent,
                max_amount=float(rp.max_amount) if rp.max_amount else None,
                requires_approval=rp.requires_approval,
            ))

    return CustomRoleResponse(
        id=role.id,
        code=role.code,
        name=role.name,
        description=role.description,
        color=role.color,
        icon=role.icon,
        priority=role.priority,
        is_system=role.is_system,
        is_active=role.is_active,
        permissions=permissions,
        user_count=user_count,
    )


@router.put(
    "/{role_id}",
    response_model=CustomRoleResponse,
    summary="Update custom role",
    description="Update a custom role. System roles cannot be modified."
)
async def update_custom_role(
    school_id: UUID,
    role_id: UUID,
    request: UpdateCustomRoleRequest,
    db: DatabaseSession,
    current_user: CurrentUser,
    _: None = Depends(require_owner_or_superuser()),
):
    """Update a custom role."""

    result = await db.execute(
        select(CustomRole)
        .options(selectinload(CustomRole.permissions).selectinload(RolePermission.permission))
        .where(
            CustomRole.id == role_id,
            CustomRole.school_id == school_id
        )
    )
    role = result.scalar_one_or_none()

    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Role not found"
        )

    if role.is_system:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="System roles cannot be modified"
        )

    # Update fields
    if request.name is not None:
        role.name = request.name
    if request.description is not None:
        role.description = request.description
    if request.color is not None:
        role.color = request.color
    if request.icon is not None:
        role.icon = request.icon
    if request.priority is not None:
        role.priority = request.priority
    if request.is_active is not None:
        role.is_active = request.is_active

    # Update permissions if provided
    if request.permissions is not None:
        await _update_role_permissions(db, role.id, request.permissions)

    await db.commit()
    await db.refresh(role, ["permissions"])

    # Get user count
    count_result = await db.execute(
        select(func.count(UserSchoolRole.id))
        .where(
            UserSchoolRole.school_id == school_id,
            UserSchoolRole.custom_role_id == role_id
        )
    )
    user_count = count_result.scalar() or 0

    permissions = []
    for rp in role.permissions:
        await db.refresh(rp, ["permission"])
        if rp.permission:
            permissions.append(RolePermissionResponse(
                permission_code=rp.permission.code,
                permission_name=rp.permission.name,
                max_discount_percent=rp.max_discount_percent,
                max_amount=float(rp.max_amount) if rp.max_amount else None,
                requires_approval=rp.requires_approval,
            ))

    return CustomRoleResponse(
        id=role.id,
        code=role.code,
        name=role.name,
        description=role.description,
        color=role.color,
        icon=role.icon,
        priority=role.priority,
        is_system=role.is_system,
        is_active=role.is_active,
        permissions=permissions,
        user_count=user_count,
    )


@router.delete(
    "/{role_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete custom role",
    description="Delete a custom role. System roles and roles with users cannot be deleted."
)
async def delete_custom_role(
    school_id: UUID,
    role_id: UUID,
    db: DatabaseSession,
    current_user: CurrentUser,
    _: None = Depends(require_owner_or_superuser()),
):
    """Delete a custom role."""

    result = await db.execute(
        select(CustomRole).where(
            CustomRole.id == role_id,
            CustomRole.school_id == school_id
        )
    )
    role = result.scalar_one_or_none()

    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Role not found"
        )

    if role.is_system:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="System roles cannot be deleted"
        )

    # Check if role has users
    count_result = await db.execute(
        select(func.count(UserSchoolRole.id))
        .where(
            UserSchoolRole.school_id == school_id,
            UserSchoolRole.custom_role_id == role_id
        )
    )
    user_count = count_result.scalar() or 0

    if user_count > 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot delete role with {user_count} assigned user(s). Reassign users first."
        )

    # Delete role (permissions cascade)
    await db.delete(role)
    await db.commit()


# ============================================
# Helper Functions
# ============================================

async def _update_role_permissions(
    db: AsyncSession,
    role_id: UUID,
    permissions: list[PermissionWithConstraints]
) -> None:
    """Update role permissions (replace all)."""
    from decimal import Decimal

    # Delete existing permissions
    await db.execute(
        sql_delete(RolePermission).where(RolePermission.role_id == role_id)
    )

    # Get permission IDs by code
    perm_codes = [p.code for p in permissions]
    if not perm_codes:
        return

    result = await db.execute(
        select(Permission).where(Permission.code.in_(perm_codes))
    )
    perm_map = {p.code: p.id for p in result.scalars().all()}

    # Create new permissions
    for perm in permissions:
        if perm.code not in perm_map:
            continue  # Skip invalid permission codes

        rp = RolePermission(
            role_id=role_id,
            permission_id=perm_map[perm.code],
            max_discount_percent=perm.max_discount_percent,
            max_amount=Decimal(str(perm.max_amount)) if perm.max_amount else None,
            requires_approval=perm.requires_approval,
        )
        db.add(rp)

    await db.flush()
