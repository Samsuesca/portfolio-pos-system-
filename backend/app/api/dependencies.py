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
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.user import User, UserRole
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


def require_school_access(required_role: UserRole | None = None):
    """
    Dependency factory to verify user has access to a school with required role.

    Args:
        required_role: Minimum required role. If None, only checks school access.
                      For users with custom roles, this checks equivalent permissions.

    Returns:
        Dependency function that validates access

    Usage:
        @router.get("/products")
        async def get_products(
            school_id: UUID,
            current_user: User = Depends(get_current_user),
            _: None = Depends(require_school_access(UserRole.VIEWER))
        ):
            ...

    Role requirements by operation type:
        - Read operations: VIEWER or higher
        - Create sales/orders: SELLER or higher
        - Update inventory/prices: ADMIN or higher
        - Delete/cancel operations: ADMIN or higher
        - User management: OWNER or higher
        - School settings: OWNER or higher

    Note:
        Users with custom roles (custom_role_id) are checked via permissions.
        The mapping from system roles to permissions is:
        - VIEWER: basic view permissions
        - SELLER: sales.create, orders.create, clients.create
        - ADMIN: most permissions except user management
        - OWNER: all permissions
    """
    # Map system roles to key permissions for equivalence checking
    ROLE_KEY_PERMISSIONS = {
        UserRole.VIEWER: ["sales.view", "products.view"],
        UserRole.SELLER: ["sales.create", "orders.create"],
        UserRole.ADMIN: ["inventory.adjust", "sales.cancel", "products.edit"],
        UserRole.OWNER: ["users.manage"],  # Special - handled separately
    }

    async def verify_school_access(
        school_id: UUID,
        current_user: Annotated[User, Depends(get_current_user)],
        db: Annotated[AsyncSession, Depends(get_db)]
    ) -> None:
        """Verify user has access to school with required role"""
        # Superusers bypass ALL role checks
        if current_user.is_superuser:
            return

        # Check user has role in this school
        from app.services.user import UserService
        user_service = UserService(db)

        user_roles = await user_service.get_user_schools(current_user.id)
        school_role = next(
            (r for r in user_roles if r.school_id == school_id),
            None
        )

        if not school_role:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No access to this school"
            )

        # No role requirement - just having access is enough
        if not required_role:
            return

        # If user has system role, use hierarchy check
        if school_role.role:
            user_level = ROLE_HIERARCHY.get(school_role.role, 0)
            required_level = ROLE_HIERARCHY.get(required_role, 0)

            if user_level < required_level:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Requires {required_role.value} role or higher"
                )
            return

        # User has custom role - check via permissions
        if school_role.custom_role_id:
            permission_service = PermissionService(db)
            user_permissions = await permission_service.get_user_permissions(
                current_user.id, school_id
            )

            # For custom roles, check if they have equivalent permissions
            # based on what the required system role would have
            key_permissions = ROLE_KEY_PERMISSIONS.get(required_role, [])

            # For SELLER and above, check if they have at least one key permission
            if required_role in [UserRole.SELLER, UserRole.ADMIN]:
                has_equivalent = any(p in user_permissions for p in key_permissions)
                if not has_equivalent:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail=f"Requires {required_role.value} role or equivalent permissions"
                    )
                return

            # For OWNER, must be actual owner (custom roles can't be owner equivalent)
            if required_role == UserRole.OWNER:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Requires OWNER role"
                )

            # For VIEWER, having any permissions means they have access
            return

        # No role and no custom_role - deny access
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Requires {required_role.value} role or higher"
        )

    return verify_school_access


def require_any_role(*roles: UserRole):
    """
    Dependency factory to verify user has ANY of the specified roles.

    Useful when multiple roles can perform an action but not in hierarchy order.

    Args:
        *roles: Roles that can access this resource

    Usage:
        @router.post("/changes/approve")
        async def approve_change(
            school_id: UUID,
            _: None = Depends(require_any_role(UserRole.ADMIN, UserRole.OWNER))
        ):
            ...
    """
    async def verify_role(
        school_id: UUID,
        current_user: Annotated[User, Depends(get_current_user)],
        db: Annotated[AsyncSession, Depends(get_db)]
    ) -> None:
        """Verify user has one of the specified roles"""
        # Superusers bypass ALL role checks
        if current_user.is_superuser:
            return

        from app.services.user import UserService
        user_service = UserService(db)

        user_roles = await user_service.get_user_schools(current_user.id)
        school_role = next(
            (r for r in user_roles if r.school_id == school_id),
            None
        )

        if not school_role:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No access to this school"
            )

        if school_role.role not in roles:
            role_names = ", ".join(r.value for r in roles)
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires one of: {role_names}"
            )

    return verify_role


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


# Type aliases for common dependencies
CurrentUser = Annotated[User, Depends(get_current_user)]
CurrentActiveUser = Annotated[User, Depends(get_current_active_user)]
CurrentSuperuser = Annotated[User, Depends(get_current_superuser)]
DatabaseSession = Annotated[AsyncSession, Depends(get_db)]


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

    return verify_global_permission


# Permission check helpers
def can_manage_users(role: UserRole | None) -> bool:
    """Check if role can manage users (OWNER only)"""
    return role == UserRole.OWNER


def can_access_accounting(role: UserRole | None) -> bool:
    """Check if role can access accounting (ADMIN or higher)"""
    if role is None:
        return False
    return ROLE_HIERARCHY.get(role, 0) >= ROLE_HIERARCHY[UserRole.ADMIN]


def can_modify_inventory(role: UserRole | None) -> bool:
    """Check if role can modify inventory (ADMIN or higher)"""
    if role is None:
        return False
    return ROLE_HIERARCHY.get(role, 0) >= ROLE_HIERARCHY[UserRole.ADMIN]


def can_create_sales(role: UserRole | None) -> bool:
    """Check if role can create sales (SELLER or higher)"""
    if role is None:
        return False
    return ROLE_HIERARCHY.get(role, 0) >= ROLE_HIERARCHY[UserRole.SELLER]


def can_delete_records(role: UserRole | None) -> bool:
    """Check if role can delete records (ADMIN or higher)"""
    if role is None:
        return False
    return ROLE_HIERARCHY.get(role, 0) >= ROLE_HIERARCHY[UserRole.ADMIN]


async def require_any_school_admin(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)]
) -> User:
    """
    Dependency to verify user is ADMIN in at least one school.

    Used for global accounting operations that affect the entire business.
    Superusers always pass this check.

    For users with custom roles, checks if they have admin-equivalent permissions
    (like inventory.adjust, sales.cancel, etc.) in at least one school.

    Returns:
        Current user if authorized

    Raises:
        HTTPException: 403 if user is not admin in any school
    """
    # Superusers bypass all role checks
    if current_user.is_superuser:
        return current_user

    from app.services.user import UserService
    user_service = UserService(db)

    user_roles = await user_service.get_user_schools(current_user.id)

    # Check if user has ADMIN or higher in any school (system role)
    has_admin = any(
        ROLE_HIERARCHY.get(r.role, 0) >= ROLE_HIERARCHY[UserRole.ADMIN]
        for r in user_roles
        if r.role is not None
    )

    if has_admin:
        return current_user

    # Check custom roles for admin-equivalent permissions
    # Admin-equivalent means having at least one of these permissions
    ADMIN_EQUIVALENT_PERMISSIONS = [
        "inventory.adjust", "sales.cancel", "products.edit",
        "accounting.create_expense", "alterations.view"
    ]

    permission_service = PermissionService(db)

    for school_role in user_roles:
        if school_role.custom_role_id:
            user_permissions = await permission_service.get_user_permissions(
                current_user.id, school_role.school_id
            )
            if any(p in user_permissions for p in ADMIN_EQUIVALENT_PERMISSIONS):
                return current_user

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Requires ADMIN role or equivalent permissions in at least one school"
    )


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
        school_id: UUID,
        current_user: Annotated[User, Depends(get_current_user)],
        db: Annotated[AsyncSession, Depends(get_db)]
    ) -> None:
        # Superusers bypass all checks
        if current_user.is_superuser:
            return

        permission_service = PermissionService(db)
        has_perm = await permission_service.has_permission(
            current_user.id, school_id, permission_code
        )

        if not has_perm:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission required: {permission_code}"
            )

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
        school_id: UUID,
        current_user: Annotated[User, Depends(get_current_user)],
        db: Annotated[AsyncSession, Depends(get_db)]
    ) -> None:
        if current_user.is_superuser:
            return

        permission_service = PermissionService(db)
        has_any = await permission_service.has_any_permission(
            current_user.id, school_id, *permission_codes
        )

        if not has_any:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"One of these permissions required: {', '.join(permission_codes)}"
            )

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
