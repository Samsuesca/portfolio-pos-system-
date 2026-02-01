"""
Global Custom Roles Endpoints

This module provides global endpoints for managing custom roles.
Custom roles are now global (not tied to a specific school) and can be
assigned to users in any school.

System roles (viewer, seller, admin, owner) remain unchanged.
"""
from uuid import UUID
from fastapi import APIRouter, HTTPException, status, Query
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from app.api.dependencies import (
    CurrentUser,
    CurrentSuperuser,
    DatabaseSession,
)
from app.models.permission import Permission, CustomRole, RolePermission
from app.models.user import UserSchoolRole

# Import schemas from custom_roles module
from app.api.routes.custom_roles import (
    CustomRoleResponse,
    RolePermissionResponse,
    CreateCustomRoleRequest,
    UpdateCustomRoleRequest,
    PermissionWithConstraints,
    _update_role_permissions,
)


router = APIRouter(prefix="/global/roles", tags=["Global Roles"])


# ============================================
# Global Custom Roles Endpoints
# ============================================

@router.get(
    "",
    response_model=list[CustomRoleResponse],
    summary="List all custom roles (global)",
    description="Get all custom roles. These are global roles that can be assigned to users in any school."
)
async def list_global_custom_roles(
    db: DatabaseSession,
    current_user: CurrentUser,
    active_only: bool = Query(True, description="Only active roles"),
):
    """
    List all custom roles globally.

    These roles are not tied to any specific school and can be assigned
    to users across all schools.
    """
    query = (
        select(CustomRole)
        .options(selectinload(CustomRole.permissions).selectinload(RolePermission.permission))
        .where(CustomRole.is_system == False)  # Only custom roles, not system roles
    )

    if active_only:
        query = query.where(CustomRole.is_active == True)

    query = query.order_by(CustomRole.priority.desc(), CustomRole.name)

    result = await db.execute(query)
    roles = result.scalars().all()

    # Get user counts for each role (across all schools)
    role_ids = [r.id for r in roles]
    user_counts = {}

    if role_ids:
        count_result = await db.execute(
            select(UserSchoolRole.custom_role_id, func.count(UserSchoolRole.id))
            .where(UserSchoolRole.custom_role_id.in_(role_ids))
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

    return role_responses


@router.post(
    "",
    response_model=CustomRoleResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create global custom role",
    description="Create a new global custom role. Superuser only."
)
async def create_global_custom_role(
    request: CreateCustomRoleRequest,
    db: DatabaseSession,
    current_user: CurrentSuperuser,
):
    """
    Create a new global custom role.

    Global roles have school_id = NULL and can be assigned to users in any school.
    Only superusers can create global roles.
    """
    # Check if code already exists (globally)
    existing = await db.execute(
        select(CustomRole).where(
            CustomRole.code == request.code,
            CustomRole.school_id.is_(None),  # Global roles only
            CustomRole.is_system == False,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Global role with code '{request.code}' already exists"
        )

    # Create the global role (school_id = NULL)
    role = CustomRole(
        school_id=None,  # Global role
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
    summary="Get global role details",
    description="Get details of a specific global custom role."
)
async def get_global_role(
    role_id: UUID,
    db: DatabaseSession,
    current_user: CurrentUser,
):
    """Get details of a specific global custom role."""
    result = await db.execute(
        select(CustomRole)
        .options(selectinload(CustomRole.permissions).selectinload(RolePermission.permission))
        .where(
            CustomRole.id == role_id,
            CustomRole.is_system == False,
        )
    )
    role = result.scalar_one_or_none()

    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Role not found"
        )

    # Get user count (across all schools)
    count_result = await db.execute(
        select(func.count(UserSchoolRole.id))
        .where(UserSchoolRole.custom_role_id == role_id)
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
    summary="Update global custom role",
    description="Update a global custom role. Superuser only."
)
async def update_global_custom_role(
    role_id: UUID,
    request: UpdateCustomRoleRequest,
    db: DatabaseSession,
    current_user: CurrentSuperuser,
):
    """Update a global custom role. Superuser only."""
    result = await db.execute(
        select(CustomRole)
        .options(selectinload(CustomRole.permissions).selectinload(RolePermission.permission))
        .where(
            CustomRole.id == role_id,
            CustomRole.is_system == False,
        )
    )
    role = result.scalar_one_or_none()

    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Role not found"
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
        .where(UserSchoolRole.custom_role_id == role_id)
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
    summary="Delete global custom role",
    description="Delete a global custom role. Superuser only. Roles with assigned users cannot be deleted."
)
async def delete_global_custom_role(
    role_id: UUID,
    db: DatabaseSession,
    current_user: CurrentSuperuser,
):
    """Delete a global custom role. Superuser only."""
    result = await db.execute(
        select(CustomRole).where(
            CustomRole.id == role_id,
            CustomRole.is_system == False,
        )
    )
    role = result.scalar_one_or_none()

    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Role not found"
        )

    # Check if role has users (across all schools)
    count_result = await db.execute(
        select(func.count(UserSchoolRole.id))
        .where(UserSchoolRole.custom_role_id == role_id)
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
