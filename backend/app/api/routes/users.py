"""
User Management Endpoints
"""
from uuid import UUID
from fastapi import APIRouter, HTTPException, status, Query, Depends, Request
from pydantic import BaseModel, EmailStr
from sqlalchemy import select, exists

from app.api.dependencies import DatabaseSession, CurrentUser, CurrentSuperuser
from app.api.error_responses import responses, AUTHENTICATED
from app.schemas.base import PaginatedResponse, paginate
from app.models.user import UserRole, User, UserSchoolRole
from app.models.sale import Sale
from app.models.audit_log import AuditAction
from app.schemas.user import (
    UserCreate, UserUpdate, UserResponse,
    UserSchoolRoleCreate, UserSchoolRoleUpdate, UserSchoolRoleResponse,
    UserSchoolRoleWithSchool
)
from app.services.user import UserService
from app.services.audit import audit_service
from app.services.permission_invalidation import PermissionInvalidator
from app.services.auth_invalidation import TokenInvalidator


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
    status_code=status.HTTP_201_CREATED,
    responses=responses(400),
    operation_id="createUser",
)
async def create_user(
    user_data: UserCreate,
    db: DatabaseSession,
    _: CurrentSuperuser
):
    """
    Create a new user.

    **Auth:** Bearer JWT (superuser)
    """
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
    response_model=PaginatedResponse[UserResponse],
    responses=AUTHENTICATED,
    operation_id="listUsers",
)
async def list_users(
    db: DatabaseSession,
    _: CurrentSuperuser,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    is_active: bool | None = Query(None, description="Filter by active status"),
):
    """
    List all users.

    **Auth:** Bearer JWT (superuser)
    """
    user_service = UserService(db)
    filters = {"is_active": is_active} if is_active is not None else None
    total = await user_service.count(filters=filters)
    users = await user_service.get_multi(skip=skip, limit=limit, filters=filters)

    return paginate([UserResponse.model_validate(u) for u in users], total, skip, limit)


@router.get(
    "/{user_id}",
    response_model=UserResponse,
    responses=responses(404),
    operation_id="getUser",
)
async def get_user(
    user_id: UUID,
    db: DatabaseSession,
    current_user: CurrentUser
):
    """
    Get user by ID.

    **Auth:** Bearer JWT (self OR superuser)

    Users can see their own profile, superusers can see any user.
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
    response_model=UserResponse,
    responses=responses(404),
    operation_id="updateUser",
)
async def update_user(
    user_id: UUID,
    user_data: UserUpdate,
    db: DatabaseSession,
    current_user: CurrentUser
):
    """
    Update user information.

    **Auth:** Bearer JWT (self OR superuser)

    Users can update their own profile, superusers can update any user.
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
    status_code=status.HTTP_200_OK,
    responses=responses(404),
    operation_id="deleteUser",
)
async def delete_user(
    user_id: UUID,
    db: DatabaseSession,
    current_user: CurrentSuperuser
):
    """
    Delete a user.

    **Auth:** Bearer JWT (superuser)

    If user has associated sales, they will be deactivated instead of deleted.
    Note: Cannot delete yourself.
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
    status_code=status.HTTP_201_CREATED,
    responses=responses(400, 409),
    operation_id="createUserSchoolRole",
)
async def add_user_school_role(
    user_id: UUID,
    school_id: UUID,
    db: DatabaseSession,
    current_user: CurrentSuperuser,
    request: Request,
    role: UserRole | None = Query(None, description="System role (query param or JSON body)"),
    custom_role_id: UUID | None = Query(None, description="Optional custom role ID"),
    body: UserSchoolRoleCreate | None = None,
):
    """
    Add user role for a school. Accepts query params or JSON body.

    **Auth:** Bearer JWT (superuser)
    """
    effective_role = (body.role if body and body.role else role)
    effective_custom = (body.custom_role_id if body and body.custom_role_id else custom_role_id)

    if not effective_role and not effective_custom:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="role or custom_role_id is required")

    user_service = UserService(db)
    invalidator = PermissionInvalidator(db)

    try:
        school_role = await user_service.add_school_role(
            user_id, school_id, effective_role, custom_role_id=effective_custom
        )
        await audit_service.log(
            db=db,
            actor_id=current_user.id,
            action=AuditAction.ROLE_CHANGE,
            resource_type="user_school_role",
            resource_id=str(user_id),
            school_id=school_id,
            description=f"Superuser added role for user in school",
            data_after={
                "role": effective_role.value if effective_role else None,
                "custom_role_id": str(effective_custom) if effective_custom else None,
            },
            request=request,
        )
        await invalidator.bump_user(user_id, school_id)
        await db.commit()
        invalidator.flush_cache_after_commit()
        return UserSchoolRoleResponse.model_validate(school_role)

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.put(
    "/{user_id}/schools/{school_id}/role",
    response_model=UserSchoolRoleResponse,
    responses=responses(404),
    operation_id="updateUserSchoolRole",
)
async def update_user_school_role(
    user_id: UUID,
    school_id: UUID,
    db: DatabaseSession,
    current_user: CurrentSuperuser,
    request: Request,
    role: UserRole | None = Query(None, description="System role (query param or JSON body)"),
    custom_role_id: UUID | None = Query(None, description="Optional custom role ID"),
    body: UserSchoolRoleUpdate | None = None,
):
    """
    Update user role for a school. Accepts query params or JSON body.

    **Auth:** Bearer JWT (superuser)
    """
    effective_role = (body.role if body and body.role else role)
    effective_custom = (body.custom_role_id if body and body.custom_role_id else custom_role_id)

    # A school role must carry either a system role or a custom role. Writing
    # both NULL violates the ck_user_school_role_has_role CHECK constraint and
    # would surface as a 500 instead of a clean validation error.
    if effective_role is None and effective_custom is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Se requiere un rol de sistema o un rol personalizado"
        )

    # Roles are mutually exclusive. Sending both is ambiguous, so reject it
    # instead of silently letting the custom role win (which would drop the
    # system role without telling the caller).
    if effective_role is not None and effective_custom is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Especifica un rol de sistema o un rol personalizado, no ambos"
        )

    user_service = UserService(db)
    invalidator = PermissionInvalidator(db)

    # Capture before state for audit diff.
    old_role_result = await db.execute(
        select(UserSchoolRole).where(
            UserSchoolRole.user_id == user_id,
            UserSchoolRole.school_id == school_id,
        )
    )
    old_school_role = old_role_result.scalar_one_or_none()
    old_data = (
        {
            "role": old_school_role.role.value if old_school_role and old_school_role.role else None,
            "custom_role_id": str(old_school_role.custom_role_id) if old_school_role and old_school_role.custom_role_id else None,
        }
        if old_school_role
        else None
    )

    school_role = await user_service.update_school_role(
        user_id, school_id, effective_role, custom_role_id=effective_custom
    )

    if not school_role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User role not found for this school"
        )

    await audit_service.log(
        db=db,
        actor_id=current_user.id,
        action=AuditAction.ROLE_CHANGE,
        resource_type="user_school_role",
        resource_id=str(user_id),
        school_id=school_id,
        description=f"Superuser updated role for user in school",
        data_before=old_data,
        data_after={
            "role": (getattr(effective_role, "value", effective_role)) if effective_role else None,
            "custom_role_id": str(effective_custom) if effective_custom else None,
        },
        request=request,
    )
    await invalidator.bump_user(user_id, school_id)
    await db.commit()
    invalidator.flush_cache_after_commit()
    return UserSchoolRoleResponse.model_validate(school_role)


@router.delete(
    "/{user_id}/schools/{school_id}/role",
    status_code=status.HTTP_204_NO_CONTENT,
    responses=responses(404),
    operation_id="deleteUserSchoolRole",
)
async def remove_user_school_role(
    user_id: UUID,
    school_id: UUID,
    db: DatabaseSession,
    current_user: CurrentSuperuser,
    request: Request,
):
    """
    Remove user access from a school.

    **Auth:** Bearer JWT (superuser)
    """
    user_service = UserService(db)
    invalidator = PermissionInvalidator(db)

    # Capture before state for audit
    old_role_result = await db.execute(
        select(UserSchoolRole).where(
            UserSchoolRole.user_id == user_id,
            UserSchoolRole.school_id == school_id,
        )
    )
    old_school_role = old_role_result.scalar_one_or_none()
    old_data = (
        {
            "role": old_school_role.role.value if old_school_role and old_school_role.role else None,
            "custom_role_id": str(old_school_role.custom_role_id) if old_school_role and old_school_role.custom_role_id else None,
        }
        if old_school_role
        else None
    )

    success = await user_service.remove_school_role(user_id, school_id)

    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User role not found for this school"
        )

    await audit_service.log(
        db=db,
        actor_id=current_user.id,
        action=AuditAction.ROLE_CHANGE,
        resource_type="user_school_role",
        resource_id=str(user_id),
        school_id=school_id,
        description=f"Superuser removed user from school",
        data_before=old_data,
        request=request,
    )
    await invalidator.bump_user(user_id, school_id)
    await db.commit()
    invalidator.flush_cache_after_commit()


@router.get(
    "/{user_id}/schools",
    response_model=list[UserSchoolRoleWithSchool],
    responses=responses(404),
    operation_id="listUserSchools",
)
async def get_user_schools(
    user_id: UUID,
    db: DatabaseSession,
    current_user: CurrentUser
):
    """
    Get all schools where user has access with school details.

    **Auth:** Bearer JWT (self OR superuser)

    Users can see their own schools, superusers can see any user's schools.
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
    status_code=status.HTTP_200_OK,
    responses=responses(400, 404),
    operation_id="adminResetPassword",
)
async def admin_reset_password(
    user_id: UUID,
    password_data: AdminResetPassword,
    db: DatabaseSession,
    current_user: CurrentSuperuser,
    request: Request,
):
    """
    Reset user's password.

    **Auth:** Bearer JWT (superuser)

    Allows admin to set a new password for any user without knowing
    the current password.
    """
    # Validate password length (match self-service minimum in PasswordChange)
    if len(password_data.new_password) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La contraseña debe tener al menos 8 caracteres"
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

    # IMPORTANT: never log the plaintext password nor the hash.
    await audit_service.log(
        db=db,
        actor_id=current_user.id,
        action=AuditAction.PASSWORD_RESET,
        resource_type="user",
        resource_id=str(user_id),
        description=f"Password reset by admin for user '{user.username}'",
        request=request,
    )

    # An admin reset is a remediation action (e.g. compromised account), so
    # invalidate the target user's live JWTs — otherwise a stolen token keeps
    # working after the reset.
    await TokenInvalidator(db).bump_user(user_id)

    await db.commit()

    return {"message": "Contrasena actualizada exitosamente"}


@router.put(
    "/{user_id}/email",
    response_model=UserResponse,
    responses=responses(400, 404),
    operation_id="adminChangeEmail",
)
async def admin_change_email(
    user_id: UUID,
    email_data: AdminChangeEmail,
    db: DatabaseSession,
    current_user: CurrentSuperuser,
    request: Request,
):
    """
    Change user's email directly.

    **Auth:** Bearer JWT (superuser)

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

    old_email = user.email
    user.email = new_email
    await audit_service.log(
        db=db,
        actor_id=current_user.id,
        action=AuditAction.EMAIL_CHANGE,
        resource_type="user",
        resource_id=str(user_id),
        description=f"Email changed by admin (bypassing verification)",
        data_before={"email": old_email},
        data_after={"email": new_email},
        request=request,
    )
    await db.commit()

    return UserResponse.model_validate(user)


@router.put(
    "/{user_id}/superuser",
    response_model=UserResponse,
    responses=responses(400, 404),
    operation_id="adminSetSuperuser",
)
async def admin_set_superuser(
    user_id: UUID,
    data: AdminSetSuperuser,
    db: DatabaseSession,
    current_user: CurrentSuperuser,
    request: Request,
):
    """
    Set or remove superuser status.

    **Auth:** Bearer JWT (superuser)

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

    old_is_superuser = user.is_superuser
    user.is_superuser = data.is_superuser

    # MAXIMUM-IMPACT privilege change: log explicitly with before/after.
    await audit_service.log(
        db=db,
        actor_id=current_user.id,
        action=AuditAction.SUPERUSER_CHANGE,
        resource_type="user",
        resource_id=str(user_id),
        description=f"Superuser status {'granted' if data.is_superuser else 'revoked'} for user '{user.username}'",
        data_before={"is_superuser": old_is_superuser},
        data_after={"is_superuser": data.is_superuser},
        request=request,
    )
    await db.commit()

    return UserResponse.model_validate(user)
