"""
Cash Drawer Access Control Endpoints
"""
import secrets
from datetime import datetime, timedelta

from fastapi import APIRouter, HTTPException, status

from app.utils.timezone import get_colombia_now_naive
from pydantic import BaseModel
from sqlalchemy import select, func

from app.api.dependencies import DatabaseSession, CurrentUser
from app.models.cash_drawer import DrawerAccessCode
from app.models.user import User
from app.services.email import send_drawer_access_code
from app.services.permission import PermissionService


router = APIRouter(prefix="/cash-drawer", tags=["Cash Drawer"])


DRAWER_PERMISSION = "cash_drawer.open"
CODE_EXPIRY_MINUTES = 5


class ValidateAccessRequest(BaseModel):
    code: str


@router.get("/can-open")
async def can_open_drawer(
    current_user: CurrentUser,
    db: DatabaseSession
):
    """
    Check if user can open drawer directly without authorization code.

    Returns true for superusers or users with cash_drawer.open permission.
    """
    if current_user.is_superuser:
        return {"can_open_directly": True, "reason": "superuser"}

    # Check if user has the permission in any of their schools
    permission_service = PermissionService(db)

    # Get user's school roles
    from app.services.user import UserService
    user_service = UserService(db)
    school_roles = await user_service.get_user_schools(current_user.id, include_school=False)

    for role in school_roles:
        permissions = await permission_service.get_user_permissions(
            current_user.id,
            role.school_id
        )
        if DRAWER_PERMISSION in permissions:
            return {"can_open_directly": True, "reason": "has_permission"}

    return {"can_open_directly": False, "reason": "no_permission"}


@router.post("/request-access")
async def request_drawer_access(
    current_user: CurrentUser,
    db: DatabaseSession
):
    """
    Request a code to open the cash drawer.

    Generates a 6-digit code and sends it to all active superusers.
    The code expires in 5 minutes.
    """
    # Generate 6-digit code
    code = "".join([str(secrets.randbelow(10)) for _ in range(6)])
    expires_at = get_colombia_now_naive() + timedelta(minutes=CODE_EXPIRY_MINUTES)

    # Save code to database
    access_code = DrawerAccessCode(
        code=code,
        requested_by_id=current_user.id,
        expires_at=expires_at
    )
    db.add(access_code)
    await db.commit()

    # Get all active superusers
    result = await db.execute(
        select(User).where(
            User.is_superuser == True,
            User.is_active == True
        )
    )
    superusers = result.scalars().all()

    if not superusers:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="No hay administradores disponibles para autorizar"
        )

    # Send code to all superusers
    requester_name = current_user.full_name or current_user.username
    emails_sent = 0
    for admin in superusers:
        if admin.email:
            if send_drawer_access_code(admin.email, code, requester_name):
                emails_sent += 1

    if emails_sent == 0:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="No se pudo enviar el codigo a los administradores"
        )

    return {
        "message": f"Codigo enviado a {emails_sent} administrador(es)",
        "expires_in": CODE_EXPIRY_MINUTES * 60,  # seconds
        "expires_at": expires_at.isoformat()
    }


@router.post("/validate-access")
async def validate_drawer_access(
    access_data: ValidateAccessRequest,
    current_user: CurrentUser,
    db: DatabaseSession
):
    """
    Validate access code and mark it as used.

    Returns success if the code is valid, not expired, and not already used.
    """
    # Find the code
    result = await db.execute(
        select(DrawerAccessCode).where(
            DrawerAccessCode.code == access_data.code,
            DrawerAccessCode.requested_by_id == current_user.id
        ).order_by(DrawerAccessCode.created_at.desc())
    )
    access_code = result.scalar_one_or_none()

    if not access_code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Codigo invalido"
        )

    # Check if already used
    if access_code.is_used:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Este codigo ya fue utilizado"
        )

    # Check if expired
    if access_code.is_expired:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Este codigo ha expirado"
        )

    # Mark as used
    access_code.used_at = get_colombia_now_naive()
    await db.commit()

    return {
        "valid": True,
        "message": "Acceso autorizado - puede abrir el cajon"
    }


@router.post("/open")
async def open_drawer_direct(
    current_user: CurrentUser,
    db: DatabaseSession
):
    """
    Direct drawer open endpoint for users with permission.

    Only superusers or users with cash_drawer.open permission can use this.
    Subject to max_daily_count constraint (Admin: 20/day, Owner: unlimited).
    This doesn't actually open the drawer - just validates permission.
    The frontend will call Tauri to open the drawer if this succeeds.
    """
    if current_user.is_superuser:
        return {"authorized": True, "reason": "superuser"}

    # Check permission and get constraints
    permission_service = PermissionService(db)
    from app.services.user import UserService
    user_service = UserService(db)
    school_roles = await user_service.get_user_schools(current_user.id, include_school=False)

    authorized = False
    max_daily_count = None

    for role in school_roles:
        permissions = await permission_service.get_user_permissions(
            current_user.id,
            role.school_id
        )
        if DRAWER_PERMISSION in permissions:
            authorized = True
            # Get max_daily_count constraint
            constraints = await permission_service.get_permission_constraints(
                current_user.id, role.school_id, DRAWER_PERMISSION
            )
            role_daily_count = constraints.get("max_daily_count")
            # Take the least restrictive (highest) limit
            if role_daily_count is None:
                max_daily_count = None
                break  # Unlimited
            elif max_daily_count is None or role_daily_count > max_daily_count:
                max_daily_count = role_daily_count

    if not authorized:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permiso para abrir el cajon directamente"
        )

    # Check daily count constraint
    if max_daily_count is not None:
        from app.utils.timezone import get_colombia_date, get_colombia_datetime_range_naive
        today = get_colombia_date()
        start_of_day, end_of_day = get_colombia_datetime_range_naive(today)
        today_opens = await db.execute(
            select(func.count(DrawerAccessCode.id)).where(
                DrawerAccessCode.requested_by_id == current_user.id,
                DrawerAccessCode.operation_type == "cash_drawer",
                DrawerAccessCode.created_at.between(start_of_day, end_of_day),
                DrawerAccessCode.used_at.isnot(None)  # Only count used codes
            )
        )
        count = today_opens.scalar() or 0

        if count >= max_daily_count:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Limite diario de aperturas alcanzado ({max_daily_count}). Contacte a un supervisor."
            )

    return {"authorized": True, "reason": "has_permission"}
