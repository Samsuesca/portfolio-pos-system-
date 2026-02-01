"""
School Users Management - OWNER Self-Management Endpoints

This module provides endpoints for school OWNERs to manage users within their school
without requiring superuser access. This enables self-service user management.

Restrictions:
- OWNERs can only assign roles up to ADMIN (cannot create other OWNERs)
- Only SUPERUSERS can assign OWNER role
- Users cannot change their own role
- Users cannot remove themselves from a school
"""
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy import select, func
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
from app.models.user import User, UserSchoolRole, UserRole
from app.models.permission import CustomRole
from app.services.user import UserService
from app.schemas.base import BaseSchema
from pydantic import EmailStr, Field


router = APIRouter(prefix="/schools/{school_id}/users", tags=["school-users"])


# ============================================
# Schemas
# ============================================

class SchoolUserResponse(BaseSchema):
    """User info for school user list"""
    id: UUID
    username: str
    email: str
    full_name: str | None
    is_active: bool
    is_superuser: bool
    role: UserRole | None
    custom_role_id: UUID | None
    custom_role_name: str | None = None
    is_primary: bool
    joined_at: str  # ISO format datetime


class SchoolUserListResponse(BaseSchema):
    """List of users in a school"""
    users: list[SchoolUserResponse]
    total: int


class InviteUserRequest(BaseSchema):
    """Request to invite a user to a school"""
    email: EmailStr
    role: UserRole = UserRole.VIEWER
    custom_role_id: UUID | None = None
    is_primary: bool = False


class InviteUserResponse(BaseSchema):
    """Response after inviting a user"""
    user_id: UUID
    email: str
    role: UserRole | None
    custom_role_id: UUID | None
    message: str


class UpdateUserRoleRequest(BaseSchema):
    """Request to update a user's role"""
    role: UserRole | None = None
    custom_role_id: UUID | None = None
    is_primary: bool | None = None


class RemoveUserResponse(BaseSchema):
    """Response after removing a user from a school"""
    user_id: UUID
    message: str


class AvailableUserResponse(BaseSchema):
    """User available to add to a school"""
    id: UUID
    username: str
    email: str
    full_name: str | None
    is_active: bool
    is_superuser: bool


class AvailableUsersListResponse(BaseSchema):
    """List of users available to add to a school"""
    users: list[AvailableUserResponse]
    total: int


# ============================================
# Endpoints
# ============================================

@router.get(
    "",
    response_model=SchoolUserListResponse,
    summary="List users in school",
    description="Get all users with access to this school. Requires users.view permission."
)
async def list_school_users(
    school_id: UUID,
    db: DatabaseSession,
    current_user: CurrentUser,
    _: None = Depends(require_permission("users.view")),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    search: str | None = Query(None, description="Search by username, email, or full name"),
    role_filter: UserRole | None = Query(None, description="Filter by role"),
):
    """List all users in a school with their roles."""

    # Base query: get UserSchoolRole with user eagerly loaded
    query = (
        select(UserSchoolRole)
        .options(
            selectinload(UserSchoolRole.user),
            selectinload(UserSchoolRole.custom_role)
        )
        .where(UserSchoolRole.school_id == school_id)
    )

    # Apply role filter
    if role_filter:
        query = query.where(UserSchoolRole.role == role_filter)

    # Get total count (before pagination)
    count_query = select(func.count()).select_from(
        select(UserSchoolRole.id)
        .where(UserSchoolRole.school_id == school_id)
        .subquery()
    )
    if role_filter:
        count_query = select(func.count()).select_from(
            select(UserSchoolRole.id)
            .where(
                UserSchoolRole.school_id == school_id,
                UserSchoolRole.role == role_filter
            )
            .subquery()
        )

    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Apply pagination and ordering
    query = query.order_by(UserSchoolRole.role.desc(), UserSchoolRole.created_at)
    query = query.offset(skip).limit(limit)

    result = await db.execute(query)
    school_roles = result.scalars().all()

    # Build response, filtering by search if provided
    users = []
    for sr in school_roles:
        user = sr.user
        if not user:
            continue

        # Apply search filter in Python (for simplicity)
        if search:
            search_lower = search.lower()
            if not (
                search_lower in user.username.lower() or
                search_lower in user.email.lower() or
                (user.full_name and search_lower in user.full_name.lower())
            ):
                continue

        users.append(SchoolUserResponse(
            id=user.id,
            username=user.username,
            email=user.email,
            full_name=user.full_name,
            is_active=user.is_active,
            is_superuser=user.is_superuser,
            role=sr.role,
            custom_role_id=sr.custom_role_id,
            custom_role_name=sr.custom_role.name if sr.custom_role else None,
            is_primary=sr.is_primary,
            joined_at=sr.created_at.isoformat(),
        ))

    return SchoolUserListResponse(users=users, total=total)


@router.get(
    "/available",
    response_model=AvailableUsersListResponse,
    summary="List users available to add to school",
    description="Search for users not already in this school. OWNER or superuser required."
)
async def list_available_users(
    school_id: UUID,
    db: DatabaseSession,
    current_user: CurrentUser,
    _: None = Depends(require_owner_or_superuser()),
    search: str = Query(None, min_length=2, description="Search by username, email, or full name (min 2 chars)"),
    limit: int = Query(20, ge=1, le=50, description="Max results to return"),
):
    """
    Get users available to add to this school.

    Returns users who:
    - Are active
    - Are NOT already in this school
    - Match the search query (if provided)

    Requires OWNER role or superuser.
    """
    # Get IDs of users already in this school
    existing_query = select(UserSchoolRole.user_id).where(
        UserSchoolRole.school_id == school_id
    )
    existing_result = await db.execute(existing_query)
    existing_user_ids = {row[0] for row in existing_result.fetchall()}

    # Query for available users
    query = select(User).where(
        User.is_active == True,
        ~User.id.in_(existing_user_ids) if existing_user_ids else True
    )

    # Apply search filter
    if search:
        search_lower = f"%{search.lower()}%"
        query = query.where(
            (func.lower(User.username).like(search_lower)) |
            (func.lower(User.email).like(search_lower)) |
            (func.lower(User.full_name).like(search_lower))
        )

    # Order by username and limit results
    query = query.order_by(User.username).limit(limit)

    result = await db.execute(query)
    users = result.scalars().all()

    return AvailableUsersListResponse(
        users=[
            AvailableUserResponse(
                id=u.id,
                username=u.username,
                email=u.email,
                full_name=u.full_name,
                is_active=u.is_active,
                is_superuser=u.is_superuser,
            )
            for u in users
        ],
        total=len(users)
    )


@router.post(
    "/invite",
    response_model=InviteUserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Invite user to school",
    description="Add an existing user to this school with a role. OWNER or superuser required."
)
async def invite_user_to_school(
    school_id: UUID,
    request: InviteUserRequest,
    db: DatabaseSession,
    current_user: CurrentUser,
    _: None = Depends(require_owner_or_superuser()),
):
    """
    Invite/add an existing user to a school.

    Restrictions:
    - OWNERs can only assign VIEWER, SELLER, or ADMIN roles
    - Only SUPERUSERS can assign OWNER role
    """
    user_service = UserService(db)

    # Check if requesting OWNER role
    if request.role == UserRole.OWNER and not current_user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only superusers can assign OWNER role"
        )

    # Find the user by email
    target_user = await user_service.get_by_email(request.email)
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with email '{request.email}' not found"
        )

    # Check if user already has access to this school
    existing_roles = await user_service.get_user_schools(target_user.id)
    if any(r.school_id == school_id for r in existing_roles):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User already has access to this school"
        )

    # Validate custom role if provided
    if request.custom_role_id:
        custom_role_result = await db.execute(
            select(CustomRole).where(
                CustomRole.id == request.custom_role_id,
                CustomRole.school_id == school_id,
                CustomRole.is_active == True
            )
        )
        if not custom_role_result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid custom role for this school"
            )

    # Add the user to the school
    try:
        # Create the school role with custom_role support
        school_role = UserSchoolRole(
            user_id=target_user.id,
            school_id=school_id,
            role=request.role if not request.custom_role_id else None,
            custom_role_id=request.custom_role_id,
            is_primary=request.is_primary,
        )
        db.add(school_role)
        await db.commit()

        return InviteUserResponse(
            user_id=target_user.id,
            email=target_user.email,
            role=request.role if not request.custom_role_id else None,
            custom_role_id=request.custom_role_id,
            message=f"User '{target_user.username}' added to school successfully"
        )
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to add user to school: {str(e)}"
        )


@router.put(
    "/{user_id}/role",
    response_model=SchoolUserResponse,
    summary="Update user role",
    description="Change a user's role in this school. OWNER or superuser required."
)
async def update_user_role(
    school_id: UUID,
    user_id: UUID,
    request: UpdateUserRoleRequest,
    db: DatabaseSession,
    current_user: CurrentUser,
    _: None = Depends(require_owner_or_superuser()),
):
    """
    Update a user's role in the school.

    Restrictions:
    - Cannot change your own role
    - OWNERs cannot assign OWNER role to others
    - Cannot demote another OWNER (unless superuser)
    """
    # Prevent self-modification
    if user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot change your own role"
        )

    # Check if requesting OWNER role
    if request.role == UserRole.OWNER and not current_user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only superusers can assign OWNER role"
        )

    # Get the current school role
    result = await db.execute(
        select(UserSchoolRole)
        .options(selectinload(UserSchoolRole.user))
        .where(
            UserSchoolRole.user_id == user_id,
            UserSchoolRole.school_id == school_id
        )
    )
    school_role = result.scalar_one_or_none()

    if not school_role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found in this school"
        )

    # Check if trying to demote an OWNER
    if school_role.role == UserRole.OWNER and not current_user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only superusers can modify OWNER roles"
        )

    # Validate custom role if provided
    if request.custom_role_id:
        custom_role_result = await db.execute(
            select(CustomRole).where(
                CustomRole.id == request.custom_role_id,
                CustomRole.school_id == school_id,
                CustomRole.is_active == True
            )
        )
        custom_role = custom_role_result.scalar_one_or_none()
        if not custom_role:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid custom role for this school"
            )

    # Update the role
    if request.role is not None:
        school_role.role = request.role
        school_role.custom_role_id = None  # Clear custom role when setting system role

    if request.custom_role_id is not None:
        school_role.custom_role_id = request.custom_role_id
        school_role.role = None  # Clear system role when setting custom role

    if request.is_primary is not None:
        school_role.is_primary = request.is_primary

    await db.commit()
    await db.refresh(school_role)

    # Load custom role for response
    if school_role.custom_role_id:
        await db.refresh(school_role, ["custom_role"])

    user = school_role.user
    return SchoolUserResponse(
        id=user.id,
        username=user.username,
        email=user.email,
        full_name=user.full_name,
        is_active=user.is_active,
        is_superuser=user.is_superuser,
        role=school_role.role,
        custom_role_id=school_role.custom_role_id,
        custom_role_name=school_role.custom_role.name if school_role.custom_role else None,
        is_primary=school_role.is_primary,
        joined_at=school_role.created_at.isoformat(),
    )


@router.delete(
    "/{user_id}",
    response_model=RemoveUserResponse,
    summary="Remove user from school",
    description="Remove a user's access to this school. OWNER or superuser required."
)
async def remove_user_from_school(
    school_id: UUID,
    user_id: UUID,
    db: DatabaseSession,
    current_user: CurrentUser,
    _: None = Depends(require_owner_or_superuser()),
):
    """
    Remove a user from the school.

    Restrictions:
    - Cannot remove yourself
    - Only superusers can remove OWNERs
    """
    # Prevent self-removal
    if user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot remove yourself from school"
        )

    # Get the current school role
    result = await db.execute(
        select(UserSchoolRole)
        .options(selectinload(UserSchoolRole.user))
        .where(
            UserSchoolRole.user_id == user_id,
            UserSchoolRole.school_id == school_id
        )
    )
    school_role = result.scalar_one_or_none()

    if not school_role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found in this school"
        )

    # Check if trying to remove an OWNER
    if school_role.role == UserRole.OWNER and not current_user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only superusers can remove OWNER roles"
        )

    username = school_role.user.username if school_role.user else "Unknown"

    # Remove the role
    await db.delete(school_role)
    await db.commit()

    return RemoveUserResponse(
        user_id=user_id,
        message=f"User '{username}' removed from school successfully"
    )


@router.get(
    "/{user_id}",
    response_model=SchoolUserResponse,
    summary="Get user details",
    description="Get details of a specific user in this school."
)
async def get_school_user(
    school_id: UUID,
    user_id: UUID,
    db: DatabaseSession,
    current_user: CurrentUser,
    _: None = Depends(require_permission("users.view")),
):
    """Get details of a specific user in the school."""

    result = await db.execute(
        select(UserSchoolRole)
        .options(
            selectinload(UserSchoolRole.user),
            selectinload(UserSchoolRole.custom_role)
        )
        .where(
            UserSchoolRole.user_id == user_id,
            UserSchoolRole.school_id == school_id
        )
    )
    school_role = result.scalar_one_or_none()

    if not school_role or not school_role.user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found in this school"
        )

    user = school_role.user
    return SchoolUserResponse(
        id=user.id,
        username=user.username,
        email=user.email,
        full_name=user.full_name,
        is_active=user.is_active,
        is_superuser=user.is_superuser,
        role=school_role.role,
        custom_role_id=school_role.custom_role_id,
        custom_role_name=school_role.custom_role.name if school_role.custom_role else None,
        is_primary=school_role.is_primary,
        joined_at=school_role.created_at.isoformat(),
    )
