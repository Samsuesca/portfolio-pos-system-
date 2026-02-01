"""
Authentication Endpoints
"""
import secrets
from datetime import datetime, timedelta

from fastapi import APIRouter, HTTPException, status, Request

from app.utils.timezone import get_colombia_now_naive
from pydantic import BaseModel, EmailStr
from sqlalchemy import select, delete

from app.api.dependencies import DatabaseSession, CurrentUser
from app.core.limiter import limiter
from app.schemas.user import (
    LoginRequest, LoginResponse, UserResponse, UserWithRoles,
    PasswordChange, UserSchoolRoleResponse
)
from app.services.user import UserService
from app.services.permission import PermissionService
from app.services.email import send_email_change_verification
from app.models.user import User, EmailVerificationToken


class EmailChangeRequest(BaseModel):
    new_email: EmailStr


class EmailVerifyRequest(BaseModel):
    token: str


router = APIRouter(prefix="/auth", tags=["Authentication"])


async def build_school_roles_with_permissions(
    db,
    user_id,
    user_service: UserService
) -> list[UserSchoolRoleResponse]:
    """
    Build school roles response with effective permissions for each role.
    This is used by both login and /me endpoints.
    """
    from uuid import UUID

    # Get user's school roles with custom_role relationship loaded
    school_roles = await user_service.get_user_schools(user_id, include_school=False)

    permission_service = PermissionService(db)
    school_roles_response = []

    # Permission codes that have constraints to include in login response
    CONSTRAINED_PERMISSIONS = [
        "accounting.liquidate_caja_menor",
        "accounting.adjust_balance",
        "cash_drawer.open",
    ]

    for role in school_roles:
        # Calculate effective permissions for this school
        permissions = await permission_service.get_user_permissions(user_id, role.school_id)
        max_discount = await permission_service.get_max_discount_percent(user_id, role.school_id)

        # Build constraints dict for permissions that have them
        constraints = {}
        for perm_code in CONSTRAINED_PERMISSIONS:
            if perm_code in permissions:
                perm_constraints = await permission_service.get_permission_constraints(
                    user_id, role.school_id, perm_code
                )
                if perm_constraints:
                    # Convert Decimal to float for JSON serialization
                    serializable = {}
                    for k, v in perm_constraints.items():
                        from decimal import Decimal as Dec
                        serializable[k] = float(v) if isinstance(v, Dec) else v
                    constraints[perm_code] = serializable

        # Build response with permissions included
        role_response = UserSchoolRoleResponse(
            id=role.id,
            user_id=role.user_id,
            school_id=role.school_id,
            role=role.role,
            custom_role_id=role.custom_role_id,
            custom_role_name=role.custom_role.name if role.custom_role else None,
            is_primary=role.is_primary,
            created_at=role.created_at,
            permissions=list(permissions),
            max_discount_percent=max_discount,
            constraints=constraints,
        )
        school_roles_response.append(role_response)

    return school_roles_response


@router.post("/login", response_model=LoginResponse)
@limiter.limit("5/minute")
async def login(
    request: Request,
    login_data: LoginRequest,
    db: DatabaseSession
):
    """
    Login with username/email and password

    Returns JWT access token and user information including school roles.
    Rate limited to 5 attempts per minute per IP.
    """
    user_service = UserService(db)

    # Authenticate user
    user = await user_service.authenticate(
        login_data.username,
        login_data.password
    )

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Create access token
    token = user_service.create_access_token(
        user_id=user.id,
        username=user.username
    )

    # Get user's school roles with permissions
    school_roles_response = await build_school_roles_with_permissions(
        db, user.id, user_service
    )

    # Build user response with roles
    user_data = UserResponse.model_validate(user).model_dump()
    user_with_roles = UserWithRoles(**user_data, school_roles=school_roles_response)

    return LoginResponse(
        token=token,
        user=user_with_roles
    )


@router.get("/me", response_model=UserWithRoles)
async def get_current_user_info(
    current_user: CurrentUser,
    db: DatabaseSession
):
    """
    Get current authenticated user information including school roles with permissions
    """
    user_service = UserService(db)

    # Get user's school roles with permissions
    school_roles_response = await build_school_roles_with_permissions(
        db, current_user.id, user_service
    )

    # Build response with roles
    user_data = UserResponse.model_validate(current_user).model_dump()
    return UserWithRoles(**user_data, school_roles=school_roles_response)


@router.post("/change-password")
async def change_password(
    password_data: PasswordChange,
    current_user: CurrentUser,
    db: DatabaseSession
):
    """
    Change current user's password
    """
    user_service = UserService(db)

    try:
        success = await user_service.change_password(
            current_user.id,
            password_data
        )

        if not success:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to change password"
            )

        await db.commit()

        return {"message": "Password changed successfully"}

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post("/request-email-change")
async def request_email_change(
    email_data: EmailChangeRequest,
    current_user: CurrentUser,
    db: DatabaseSession
):
    """
    Request email change - sends verification link to NEW email address.

    The email won't be changed until the user clicks the verification link.
    """
    new_email = email_data.new_email.lower()

    # Check if new email is same as current
    if new_email == current_user.email.lower():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El nuevo correo es igual al actual"
        )

    # Check if new email is already in use
    existing = await db.execute(
        select(User).where(User.email == new_email)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Este correo ya esta en uso por otro usuario"
        )

    # Delete any existing tokens for this user
    await db.execute(
        delete(EmailVerificationToken).where(
            EmailVerificationToken.user_id == current_user.id
        )
    )

    # Generate new token
    token = secrets.token_urlsafe(48)  # 64 chars base64
    expires_at = get_colombia_now_naive() + timedelta(hours=24)

    # Create verification token
    verification_token = EmailVerificationToken(
        user_id=current_user.id,
        new_email=new_email,
        token=token,
        expires_at=expires_at
    )
    db.add(verification_token)
    await db.commit()

    # Send verification email
    user_name = current_user.full_name or current_user.username
    send_email_change_verification(new_email, token, user_name)

    return {
        "message": f"Se envio un enlace de verificacion a {new_email}",
        "email": new_email
    }


@router.post("/verify-email/{token}")
async def verify_email(
    token: str,
    db: DatabaseSession
):
    """
    Verify email change token and update user's email.

    This endpoint is called when user clicks the verification link.
    """
    # Find token
    result = await db.execute(
        select(EmailVerificationToken).where(
            EmailVerificationToken.token == token
        )
    )
    verification = result.scalar_one_or_none()

    if not verification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Token invalido o expirado"
        )

    # Check expiration
    if get_colombia_now_naive() > verification.expires_at:
        # Delete expired token
        await db.delete(verification)
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El enlace de verificacion ha expirado"
        )

    # Check if new email is still available
    existing = await db.execute(
        select(User).where(User.email == verification.new_email)
    )
    if existing.scalar_one_or_none():
        await db.delete(verification)
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Este correo ya esta en uso por otro usuario"
        )

    # Update user's email
    user = await db.get(User, verification.user_id)
    if not user:
        await db.delete(verification)
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuario no encontrado"
        )

    old_email = user.email
    user.email = verification.new_email

    # Delete the used token
    await db.delete(verification)
    await db.commit()

    return {
        "message": "Correo actualizado exitosamente",
        "old_email": old_email,
        "new_email": user.email
    }
