"""
User Management Endpoints
"""
from uuid import UUID
from fastapi import APIRouter, HTTPException, status, Query, Depends
from pydantic import BaseModel, EmailStr
from sqlalchemy import select, exists

from app.api.dependencies import DatabaseSession, CurrentUser, CurrentSuperuser
from app.models.user import UserRole, User
from app.models.sale import Sale
from app.schemas.user import (
    UserCreate, UserUpdate, UserResponse,
    UserSchoolRoleCreate, UserSchoolRoleUpdate, UserSchoolRoleResponse,
    UserSchoolRoleWithSchool
)
from app.services.user import UserService


class AdminResetPassword(BaseModel):
    new_password: str


class AdminChangeEmail(BaseModel):
    new_email: EmailStr


class AdminSetSuperuser(BaseModel):
    is_superuser: bool


router = APIRouter(prefix="/users", tags=["Users"])


# ==========================================
# User CRUD (Superuser only)
# ==========================================

@router.post(
    "",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED
)
async def create_user(
    user_data: UserCreate,
    db: DatabaseSession,
    _: CurrentSuperuser
):
    """Create a new user (superuser only)"""
    user_service = UserService(db)

    try:
        user = await user_service.create_user(user_data)
        await db.commit()
        return UserResponse.model_validate(user)

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get(
    "",
    response_model=list[UserResponse]
)
async def list_users(
    db: DatabaseSession,
    _: CurrentSuperuser,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100)
):
    """List all users (superuser only)"""
    user_service = UserService(db)
    users = await user_service.get_multi(skip=skip, limit=limit)

    return [UserResponse.model_validate(u) for u in users]


@router.get(
    "/{user_id}",
    response_model=UserResponse
)
async def get_user(
    user_id: UUID,
    db: DatabaseSession,
    current_user: CurrentUser
):
    """
    Get user by ID

    Users can see their own profile, superusers can see any user
    """
    # Check if user is requesting their own info or is superuser
    if current_user.id != user_id and not current_user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )

    user_service = UserService(db)
    user = await user_service.get(user_id)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    return UserResponse.model_validate(user)


@router.put(
    "/{user_id}",
    response_model=UserResponse
)
async def update_user(
    user_id: UUID,
    user_data: UserUpdate,
    db: DatabaseSession,
    current_user: CurrentUser
):
    """
    Update user information

    Users can update their own profile, superusers can update any user
    """
    # Check permissions
    if current_user.id != user_id and not current_user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )

    user_service = UserService(db)
    user = await user_service.update_user(user_id, user_data)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    await db.commit()
    return UserResponse.model_validate(user)


@router.delete(
    "/{user_id}",
    status_code=status.HTTP_200_OK
)
async def delete_user(
    user_id: UUID,
    db: DatabaseSession,
    current_user: CurrentSuperuser
):
    """
    Delete a user (superuser only)

    If user has associated sales, they will be deactivated instead of deleted.
    Note: Cannot delete yourself
    """
    # Prevent self-deletion
    if current_user.id == user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete your own account"
        )

    user_service = UserService(db)
    user = await user_service.get(user_id)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    # Check if user has associated sales
    has_sales = await db.scalar(
        select(exists().where(Sale.user_id == user_id))
    )

    if has_sales:
        # Soft delete: deactivate user instead of deleting
        user.is_active = False
        await db.commit()
        return {
            "action": "deactivated",
            "message": "Usuario desactivado (tiene ventas asociadas)"
        }
    else:
        # Hard delete: no associated data
        await user_service.delete(user_id)
        await db.commit()
        return {
            "action": "deleted",
            "message": "Usuario eliminado permanentemente"
        }


# ==========================================
# User-School Roles
# ==========================================

@router.post(
    "/{user_id}/schools/{school_id}/role",
    response_model=UserSchoolRoleResponse,
    status_code=status.HTTP_201_CREATED
)
async def add_user_school_role(
    user_id: UUID,
    school_id: UUID,
    role: UserRole,
    db: DatabaseSession,
    _: CurrentSuperuser,
    custom_role_id: UUID | None = Query(None, description="Optional custom role ID (global)"),
):
    """Add user role for a school (superuser only)"""
    user_service = UserService(db)

    try:
        school_role = await user_service.add_school_role(
            user_id, school_id, role, custom_role_id=custom_role_id
        )
        await db.commit()
        return UserSchoolRoleResponse.model_validate(school_role)

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.put(
    "/{user_id}/schools/{school_id}/role",
    response_model=UserSchoolRoleResponse
)
async def update_user_school_role(
    user_id: UUID,
    school_id: UUID,
    role: UserRole,
    db: DatabaseSession,
    _: CurrentSuperuser,
    custom_role_id: UUID | None = Query(None, description="Optional custom role ID (global)"),
):
    """Update user role for a school (superuser only)"""
    user_service = UserService(db)

    school_role = await user_service.update_school_role(
        user_id, school_id, role, custom_role_id=custom_role_id
    )

    if not school_role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User role not found for this school"
        )

    await db.commit()
    return UserSchoolRoleResponse.model_validate(school_role)


@router.delete(
    "/{user_id}/schools/{school_id}/role",
    status_code=status.HTTP_204_NO_CONTENT
)
async def remove_user_school_role(
    user_id: UUID,
    school_id: UUID,
    db: DatabaseSession,
    _: CurrentSuperuser
):
    """Remove user access from a school (superuser only)"""
    user_service = UserService(db)

    success = await user_service.remove_school_role(user_id, school_id)

    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User role not found for this school"
        )

    await db.commit()


@router.get(
    "/{user_id}/schools",
    response_model=list[UserSchoolRoleWithSchool]
)
async def get_user_schools(
    user_id: UUID,
    db: DatabaseSession,
    current_user: CurrentUser
):
    """
    Get all schools where user has access with school details

    Users can see their own schools, superusers can see any user's schools
    """
    if current_user.id != user_id and not current_user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )

    user_service = UserService(db)
    school_roles = await user_service.get_user_schools(user_id, include_school=True)

    # Map custom_role_name from the relationship
    result = []
    for sr in school_roles:
        data = {
            "id": sr.id,
            "user_id": sr.user_id,
            "school_id": sr.school_id,
            "role": sr.role,
            "custom_role_id": sr.custom_role_id,
            "is_primary": sr.is_primary,
            "created_at": sr.created_at,
            "school": sr.school,
            "custom_role_name": sr.custom_role.name if sr.custom_role else None,
        }
        result.append(UserSchoolRoleWithSchool.model_validate(data))
    return result


# NOTE: The GET /schools/{school_id}/users endpoint has been moved to
# school_users.py which provides a more complete implementation with
# filtering, pagination, and proper permission checks.


# ==========================================
# Admin User Management
# ==========================================

@router.post(
    "/{user_id}/reset-password",
    status_code=status.HTTP_200_OK
)
async def admin_reset_password(
    user_id: UUID,
    password_data: AdminResetPassword,
    db: DatabaseSession,
    _: CurrentSuperuser
):
    """
    Reset user's password (superuser only)

    Allows admin to set a new password for any user without knowing
    the current password.
    """
    # Validate password length
    if len(password_data.new_password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La contrasena debe tener al menos 6 caracteres"
        )

    user_service = UserService(db)
    user = await user_service.get(user_id)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuario no encontrado"
        )

    # Update password using the service's hash method
    hashed = user_service.hash_password(password_data.new_password)
    user.hashed_password = hashed

    await db.commit()

    return {"message": "Contrasena actualizada exitosamente"}


@router.put(
    "/{user_id}/email",
    response_model=UserResponse
)
async def admin_change_email(
    user_id: UUID,
    email_data: AdminChangeEmail,
    db: DatabaseSession,
    _: CurrentSuperuser
):
    """
    Change user's email directly (superuser only)

    This bypasses email verification - use with caution.
    """
    new_email = email_data.new_email.lower()

    user_service = UserService(db)
    user = await user_service.get(user_id)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuario no encontrado"
        )

    # Check if email is same as current
    if new_email == user.email.lower():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El nuevo correo es igual al actual"
        )

    # Check if email is already in use
    existing = await db.execute(
        select(User).where(User.email == new_email)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Este correo ya esta en uso por otro usuario"
        )

    user.email = new_email
    await db.commit()

    return UserResponse.model_validate(user)


@router.put(
    "/{user_id}/superuser",
    response_model=UserResponse
)
async def admin_set_superuser(
    user_id: UUID,
    data: AdminSetSuperuser,
    db: DatabaseSession,
    current_user: CurrentSuperuser
):
    """
    Set or remove superuser status (superuser only)

    A superuser can promote/demote other users to/from superuser status.
    Cannot modify your own superuser status.
    """
    # Prevent self-modification
    if current_user.id == user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No puedes modificar tu propio estado de superusuario"
        )

    user_service = UserService(db)
    user = await user_service.get(user_id)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuario no encontrado"
        )

    user.is_superuser = data.is_superuser
    await db.commit()

    return UserResponse.model_validate(user)
