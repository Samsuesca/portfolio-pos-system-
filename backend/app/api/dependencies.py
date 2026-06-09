"""
FastAPI Dependencies for authentication, authorization, and database access

Role Hierarchy (highest to lowest):
- OWNER (4): Full access + user management + school settings
- ADMIN (3): Full business data (sales, inventory, accounting, reports)
- SELLER (2): Create/read sales, read inventory, manage clients/orders
- VIEWER (1): Read-only access

Superusers (is_superuser=True) bypass ALL role checks.
"""
from typing import Annotated
from uuid import UUID
from fastapi import Depends, HTTPException, Query, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

import jwt
from jwt.exceptions import PyJWTError

from app.core.config import settings
from app.db.session import get_db
from app.models.user import User, UserRole
from app.models.client import Client
from app.schemas.user import TokenData
from app.services.user import UserService
from app.services.permission import PermissionService


# Role hierarchy levels for permission checking
ROLE_HIERARCHY = {
    UserRole.VIEWER: 1,
    UserRole.SELLER: 2,
    UserRole.ADMIN: 3,
    UserRole.OWNER: 4
}

# Security scheme for JWT Bearer tokens
security = HTTPBearer()


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(security)],
    db: Annotated[AsyncSession, Depends(get_db)]
) -> User:
    """
    Dependency to get current authenticated user from JWT token

    Args:
        credentials: Bearer token from Authorization header
        db: Database session

    Returns:
        Current authenticated user

    Raises:
        HTTPException: 401 if token invalid or user not found
    """
    # Extract token
    token = credentials.credentials

    # Decode token
    user_service = UserService(db)
    token_data: TokenData | None = user_service.decode_token(token)

    if not token_data:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Get user from database
    user = await user_service.get(token_data.user_id)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive user"
        )

    # Token version mismatch → JWT invalidado (password/email change desde
    # que se emitió). Se rechazan los tokens viejos inmediatamente.
    # `token_version is None` se permite por compatibilidad con tokens
    # emitidos antes de la migración usr_token_ver_001 (válidos hasta
    # su `exp` natural; el primer bump post-deploy los invalida).
    if (
        token_data.token_version is not None
        and token_data.token_version != user.token_version
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token invalidado. Inicia sesion nuevamente.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user


async def get_current_active_user(
    current_user: Annotated[User, Depends(get_current_user)]
) -> User:
    """
    Dependency to ensure user is active

    Args:
        current_user: Current user from get_current_user

    Returns:
        Active user

    Raises:
        HTTPException: 403 if user is inactive
    """
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive user"
        )
    return current_user


async def get_current_superuser(
    current_user: Annotated[User, Depends(get_current_user)]
) -> User:
    """
    Dependency to ensure user is superuser

    Args:
        current_user: Current user from get_current_user

    Returns:
        Superuser

    Raises:
        HTTPException: 403 if user is not superuser
    """
    if not current_user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    return current_user


async def get_user_school_role(
    school_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)]
) -> UserRole | None:
    """
    Get the user's role for a specific school.

    Returns:
        UserRole if user has access, None otherwise.
        For superusers, returns OWNER (highest level).
    """
    if current_user.is_superuser:
        return UserRole.OWNER

    from app.services.user import UserService
    user_service = UserService(db)

    user_roles = await user_service.get_user_schools(current_user.id)
    school_role = next(
        (r for r in user_roles if r.school_id == school_id),
        None
    )

    return school_role.role if school_role else None


class PaginatedParams:
    """Standard pagination query parameters."""
    def __init__(
        self,
        skip: int = Query(0, ge=0, description="Items a saltar"),
        limit: int = Query(100, ge=1, le=500, description="Items por pagina (max 500)"),
    ):
        self.skip = skip
        self.limit = limit


# Type aliases for common dependencies
Pagination = Annotated[PaginatedParams, Depends()]
CurrentUser = Annotated[User, Depends(get_current_user)]
CurrentActiveUser = Annotated[User, Depends(get_current_active_user)]
CurrentSuperuser = Annotated[User, Depends(get_current_superuser)]
DatabaseSession = Annotated[AsyncSession, Depends(get_db)]


async def get_current_portal_client(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(security)],
    db: Annotated[AsyncSession, Depends(get_db)]
) -> Client:
    token = credentials.credentials

    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM]
        )
    except PyJWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token invalido o expirado",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if payload.get("client_type") != "web_client":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token no es de cliente del portal",
            headers={"WWW-Authenticate": "Bearer"},
        )

    client_id_str = payload.get("sub")
    if not client_id_str:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token invalido",
            headers={"WWW-Authenticate": "Bearer"},
        )

    from sqlalchemy import select
    result = await db.execute(
        select(Client).where(Client.id == UUID(client_id_str))
    )
    client = result.scalar_one_or_none()

    if not client:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Cliente no encontrado",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not client.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cuenta de cliente inactiva"
        )

    return client


CurrentPortalClient = Annotated[Client, Depends(get_current_portal_client)]


async def get_user_school_ids(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)]
) -> list[UUID]:
    """
    Get all school IDs the user has access to.

    For superusers, returns all schools in the system.
    For regular users, returns schools where they have a role.

    Returns:
        List of school UUIDs the user can access
    """
    from app.services.user import UserService
    from app.models.school import School
    from sqlalchemy import select

    if current_user.is_superuser:
        # Superusers can access all schools
        result = await db.execute(select(School.id))
        return list(result.scalars().all())

    user_service = UserService(db)
    user_roles = await user_service.get_user_schools(current_user.id)
    return [r.school_id for r in user_roles]


# Type alias for user's school IDs
UserSchoolIds = Annotated[list[UUID], Depends(get_user_school_ids)]


async def get_user_branch_ids(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[UUID] | None:
    """Branches (sucursales físicas) accesibles por el usuario.

    Semántica deliberadamente distinta a get_user_school_ids: aquí ``None``
    significa "acceso a TODAS las sucursales" (admin central), NO lista vacía.
    Esto preserva el backward-compat absoluto: hoy ningún UserSchoolRole tiene
    ``branch_id`` poblado, así que todos los usuarios son centrales y el caller
    NO debe filtrar por branch (= comportamiento previo al retrofit).

    - Superuser ⇒ None (acceso total, sin filtro).
    - Usuario sin roles ⇒ None (no se restringe; mismo trato que hoy).
    - Usuario con ≥1 rol de branch_id NULL ⇒ None (al menos un rol central).
    - Usuario con todos sus roles restringidos a sucursales ⇒ lista de esos
      UUIDs (sin duplicados).

    El filtrado real por sucursal solo aplica cuando el negocio empiece a crear
    roles con ``branch_id`` poblado; en esta fase nadie los crea.

    NOTA: el factory análogo ``get_user_branch_ids_with_permission(code)`` (que
    espejaría get_user_school_ids_with_permission) se difiere a una fase
    posterior — no hay consumidor todavía y agregar superficie sin uso es deuda.
    """
    from app.models.user import UserSchoolRole

    if current_user.is_superuser:
        return None  # acceso total = sin filtro

    rows = list((await db.execute(
        select(UserSchoolRole.branch_id).where(
            UserSchoolRole.user_id == current_user.id
        )
    )).scalars().all())

    if not rows:
        return None  # sin roles ⇒ no restringir (mismo trato que hoy)
    if any(b is None for b in rows):
        return None  # al menos un rol central ⇒ acceso a todas
    return list({b for b in rows if b is not None})


# Type alias for user's branch IDs (None = acceso central a todas)
UserBranchIds = Annotated[list[UUID] | None, Depends(get_user_branch_ids)]


def get_user_school_ids_with_permission(permission_code: str):
    """
    Dependency factory que retorna los school IDs donde el user tiene
    el permiso `permission_code`.

    Para superusuarios: retorna todos los school IDs del sistema.
    Para usuarios regulares: filtra a los schools donde tienen sea un
    system role con el permiso, sea un custom role con el permiso, sea
    un permission_override grant.

    Si el resultado es lista vacia, el endpoint deberia retornar 200 con
    una respuesta vacia (consistente con el patron de cross-school endpoints).

    Args:
        permission_code: codigo de permiso (e.g., "sales.view")

    Returns:
        Lista de UUIDs de schools donde el user puede hacer la accion.
    """
    async def _dep(
        current_user: Annotated[User, Depends(get_current_user)],
        db: Annotated[AsyncSession, Depends(get_db)],
    ) -> list[UUID]:
        from app.services.user import UserService
        from app.models.school import School

        if current_user.is_superuser:
            result = await db.execute(select(School.id))
            return list(result.scalars().all())

        user_service = UserService(db)
        permission_service = PermissionService(db)
        user_roles = await user_service.get_user_schools(current_user.id)

        # Siempre delegamos a get_user_permissions: respeta system roles,
        # custom roles, y permission_overrides (incluyendo revoke). El cache
        # con TTL 60s amortiza la query post-warmup.
        allowed: list[UUID] = []
        for school_role in user_roles:
            user_perms = await permission_service.get_user_permissions(
                current_user.id, school_role.school_id
            )
            if permission_code in user_perms:
                allowed.append(school_role.school_id)

        return allowed

    return _dep


async def require_superuser(
    current_user: Annotated[User, Depends(get_current_user)]
) -> User:
    """
    Dependency to require superuser access.
    Use as: dependencies=[Depends(require_superuser)]
    """
    if not current_user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Superuser access required"
        )
    return current_user


def require_global_permission(permission_code: str):
    """
    Dependency factory to require a specific permission for GLOBAL operations.

    Unlike require_permission() which is school-scoped, this checks if the user
    has the permission in ANY of their schools (via system role or custom role).

    Superusers bypass all permission checks.

    Args:
        permission_code: The permission code to check (e.g., "global_inventory.adjust")

    Usage:
        @router.post("/products/{product_id}/inventory/adjust")
        async def adjust_global_inventory(
            product_id: UUID,
            data: GlobalInventoryAdjust,
            db: DatabaseSession,
            current_user: CurrentUser,
            _: None = Depends(require_global_permission("global_inventory.adjust"))
        ):
            ...
    """
    async def verify_global_permission(
        current_user: Annotated[User, Depends(get_current_user)],
        db: Annotated[AsyncSession, Depends(get_db)]
    ) -> None:
        # Superusers bypass all checks
        if current_user.is_superuser:
            return

        from app.services.user import UserService
        from app.services.permission import SYSTEM_ROLE_PERMISSIONS

        user_service = UserService(db)
        permission_service = PermissionService(db)

        # Get all schools user has access to
        user_roles = await user_service.get_user_schools(current_user.id)

        if not user_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission required: {permission_code}"
            )

        # Check if user has the permission in ANY school
        for school_role in user_roles:
            # Check system role permissions
            if school_role.role:
                system_perms = SYSTEM_ROLE_PERMISSIONS.get(school_role.role)
                if system_perms is None:  # OWNER - has all permissions
                    return
                if permission_code in system_perms:
                    return

            # Check custom role permissions
            if school_role.custom_role_id:
                user_permissions = await permission_service.get_user_permissions(
                    current_user.id, school_role.school_id
                )
                if permission_code in user_permissions:
                    return

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Permission required: {permission_code}"
        )

    # Tag para introspection (startup validator).
    verify_global_permission.__permission_code__ = permission_code  # type: ignore[attr-defined]
    return verify_global_permission


# ============================================
# GRANULAR PERMISSION DEPENDENCIES
# ============================================

def require_permission(permission_code: str):
    """
    Dependency factory to require a specific permission.

    This is the preferred way to protect endpoints with granular permissions.
    Superusers bypass all permission checks.

    Args:
        permission_code: The permission code to check (e.g., "sales.cancel")

    Usage:
        @router.post("/sales/{sale_id}/cancel")
        async def cancel_sale(
            school_id: UUID,
            sale_id: UUID,
            db: DatabaseSession,
            current_user: CurrentUser,
            _: None = Depends(require_permission("sales.cancel"))
        ):
            ...
    """
    async def verify_permission(
        school_id: UUID | None = None,
        current_user: Annotated[User, Depends(get_current_user)] = None,
        db: Annotated[AsyncSession, Depends(get_db)] = None
    ) -> None:
        # Superusers bypass all checks
        if current_user.is_superuser:
            return

        if school_id is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission required: {permission_code} (school_id needed)"
            )

        permission_service = PermissionService(db)
        has_perm = await permission_service.has_permission(
            current_user.id, school_id, permission_code
        )

        if not has_perm:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission required: {permission_code}"
            )

    # Tag para introspection (startup validator).
    verify_permission.__permission_code__ = permission_code  # type: ignore[attr-defined]
    return verify_permission


def require_any_permission(*permission_codes: str):
    """
    Dependency factory to require at least one of the specified permissions.

    Args:
        *permission_codes: Permission codes, user needs at least one

    Usage:
        @router.get("/reports")
        async def get_reports(
            school_id: UUID,
            _: None = Depends(require_any_permission("reports.sales", "reports.inventory"))
        ):
            ...
    """
    async def verify_any_permission(
        school_id: UUID | None = None,
        current_user: Annotated[User, Depends(get_current_user)] = None,
        db: Annotated[AsyncSession, Depends(get_db)] = None
    ) -> None:
        if current_user.is_superuser:
            return

        if school_id is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"One of these permissions required: {', '.join(permission_codes)} (school_id needed)"
            )

        permission_service = PermissionService(db)
        has_any = await permission_service.has_any_permission(
            current_user.id, school_id, *permission_codes
        )
        # Tag set en el factory abajo (require_any_permission)

        if not has_any:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"One of these permissions required: {', '.join(permission_codes)}"
            )

    # Tag con la tupla de codes para introspection.
    verify_any_permission.__permission_codes__ = tuple(permission_codes)  # type: ignore[attr-defined]
    return verify_any_permission


async def get_max_discount_percent(
    school_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)]
) -> int:
    """
    Get maximum discount percentage user can apply.

    Returns:
        Maximum discount percentage (0-100)
    """
    if current_user.is_superuser:
        return 100

    permission_service = PermissionService(db)
    return await permission_service.get_max_discount_percent(current_user.id, school_id)


# Type alias for max discount
MaxDiscountPercent = Annotated[int, Depends(get_max_discount_percent)]


async def get_user_effective_permissions(
    school_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)]
) -> set[str]:
    """
    Get all effective permissions for the current user in a school.

    Returns:
        Set of permission codes the user has
    """
    if current_user.is_superuser:
        permission_service = PermissionService(db)
        return await permission_service.get_all_permission_codes()

    permission_service = PermissionService(db)
    return await permission_service.get_user_permissions(current_user.id, school_id)


# Type alias for effective permissions
UserPermissions = Annotated[set[str], Depends(get_user_effective_permissions)]


def require_owner_or_superuser():
    """
    Dependency to require OWNER role or superuser status.

    Used for school-level user management where OWNERs can manage
    their school's users without being superusers.

    Usage:
        @router.post("/schools/{school_id}/users/invite")
        async def invite_user(
            school_id: UUID,
            _: None = Depends(require_owner_or_superuser())
        ):
            ...
    """
    async def verify_owner_or_superuser(
        school_id: UUID,
        current_user: Annotated[User, Depends(get_current_user)],
        db: Annotated[AsyncSession, Depends(get_db)]
    ) -> None:
        if current_user.is_superuser:
            return

        from app.services.user import UserService
        user_service = UserService(db)

        user_roles = await user_service.get_user_schools(current_user.id)
        school_role = next(
            (r for r in user_roles if r.school_id == school_id),
            None
        )

        if not school_role or school_role.role != UserRole.OWNER:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Requires OWNER role or superuser access"
            )

    return verify_owner_or_superuser


# ============================================
# CONSTRAINT-AWARE PERMISSION DEPENDENCIES
# ============================================

def require_permission_with_constraints(permission_code: str):
    """
    Dependency factory that checks permission AND returns constraints.

    Returns a dict with the user's constraints for this permission:
    {
        "max_amount": Decimal | None,
        "requires_approval": bool,
        "max_daily_count": int | None
    }

    Superusers get no constraints (all None/False).

    Usage:
        @router.post("/caja-menor/liquidate")
        async def liquidate(
            school_id: UUID,
            constraints: dict = Depends(require_permission_with_constraints("accounting.liquidate_caja_menor"))
        ):
            if constraints["max_amount"] and amount > constraints["max_amount"]:
                raise HTTPException(403, "Monto excede limite")
    """
    async def verify_and_get_constraints(
        school_id: UUID,
        current_user: Annotated[User, Depends(get_current_user)],
        db: Annotated[AsyncSession, Depends(get_db)]
    ) -> dict:
        # Superusers bypass all checks - no constraints
        if current_user.is_superuser:
            return {
                "max_amount": None,
                "requires_approval": False,
                "max_daily_count": None,
            }

        permission_service = PermissionService(db)

        # Check permission first
        has_perm = await permission_service.has_permission(
            current_user.id, school_id, permission_code
        )
        if not has_perm:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission required: {permission_code}"
            )

        # Get constraints
        constraints = await permission_service.get_permission_constraints(
            current_user.id, school_id, permission_code
        )

        return {
            "max_amount": constraints.get("max_amount"),
            "requires_approval": constraints.get("requires_approval", False),
            "max_daily_count": constraints.get("max_daily_count"),
        }

    return verify_and_get_constraints


def require_global_permission_with_constraints(permission_code: str):
    """
    Like require_global_permission but also returns constraint values.

    Checks if user has the permission in ANY school and returns the
    least restrictive constraints found across all schools.

    Usage:
        @router.post("/global/accounting/set-balance")
        async def set_balance(
            constraints: dict = Depends(require_global_permission_with_constraints("accounting.adjust_balance"))
        ):
            ...
    """
    async def verify_and_get_constraints(
        current_user: Annotated[User, Depends(get_current_user)],
        db: Annotated[AsyncSession, Depends(get_db)]
    ) -> dict:
        # Superusers bypass all checks
        if current_user.is_superuser:
            return {
                "max_amount": None,
                "requires_approval": False,
                "max_daily_count": None,
            }

        from app.services.user import UserService
        from app.services.permission import SYSTEM_ROLE_PERMISSIONS

        user_service = UserService(db)
        permission_service = PermissionService(db)

        user_roles = await user_service.get_user_schools(current_user.id)

        if not user_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission required: {permission_code}"
            )

        # Find the school where user has this permission with least restrictive constraints
        best_constraints: dict | None = None

        for school_role in user_roles:
            has_perm = False

            if school_role.role:
                system_perms = SYSTEM_ROLE_PERMISSIONS.get(school_role.role)
                if system_perms is None:  # OWNER
                    has_perm = True
                elif permission_code in system_perms:
                    has_perm = True

            if not has_perm and school_role.custom_role_id:
                user_permissions = await permission_service.get_user_permissions(
                    current_user.id, school_role.school_id
                )
                if permission_code in user_permissions:
                    has_perm = True

            if has_perm:
                constraints = await permission_service.get_permission_constraints(
                    current_user.id, school_role.school_id, permission_code
                )

                if best_constraints is None:
                    best_constraints = constraints
                else:
                    # Take the least restrictive: higher max_amount, lower requires_approval
                    cur_max = best_constraints.get("max_amount")
                    new_max = constraints.get("max_amount")
                    if new_max is None:
                        best_constraints["max_amount"] = None
                    elif cur_max is not None and new_max > cur_max:
                        best_constraints["max_amount"] = new_max

                    if not constraints.get("requires_approval", True):
                        best_constraints["requires_approval"] = False

                    cur_daily = best_constraints.get("max_daily_count")
                    new_daily = constraints.get("max_daily_count")
                    if new_daily is None:
                        best_constraints["max_daily_count"] = None
                    elif cur_daily is not None and new_daily > cur_daily:
                        best_constraints["max_daily_count"] = new_daily

        if best_constraints is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission required: {permission_code}"
            )

        return {
            "max_amount": best_constraints.get("max_amount"),
            "requires_approval": best_constraints.get("requires_approval", False),
            "max_daily_count": best_constraints.get("max_daily_count"),
        }

    return verify_and_get_constraints


# ============================================================================
# Date range validation helper — Reports Coverage Expansion (P2 fix)
# ============================================================================

def validate_date_range(
    start_date: 'date | None' = None,
    end_date: 'date | None' = None,
) -> None:
    """Validate that start_date <= end_date when both are provided.

    Reports endpoints accept independent ?start_date and ?end_date query
    params. Without this check, an inverted range (e.g. preset bug,
    typo) silently returns an empty payload instead of an actionable
    error — caught by the QA pass on 2026-05-24.

    Raises 400 with a Spanish message (per CLAUDE.md i18n rule).
    """
    if start_date is not None and end_date is not None and start_date > end_date:
        from fastapi import HTTPException, status
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Rango de fechas invalido: start_date ({start_date}) "
                f"no puede ser posterior a end_date ({end_date})."
            ),
        )

