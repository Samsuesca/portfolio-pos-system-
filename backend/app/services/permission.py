"""
Permission Service - Handles permission checks and role management

This service provides:
- Checking if a user has specific permissions
- Getting effective permissions for a user in a school
- Getting permission constraints (e.g., max discount percentage, max amount)
- Checking amount constraints for micro-permissions
- Caching for performance
"""
from decimal import Decimal
from typing import Any
from uuid import UUID
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.user import User, UserSchoolRole, UserRole
from app.models.permission import Permission, CustomRole, RolePermission


# Default permissions for system roles (used when custom_roles table has no data or as fallback)
SYSTEM_ROLE_PERMISSIONS = {
    UserRole.VIEWER: {
        "sales.view", "products.view", "clients.view", "orders.view",
        "inventory.view", "changes.view", "alterations.view", "reports.dashboard"
    },
    UserRole.SELLER: {
        "sales.view", "products.view", "clients.view", "orders.view",
        "inventory.view", "changes.view", "alterations.view", "reports.dashboard",
        "sales.create", "sales.apply_discount", "sales.add_payment",
        "clients.create", "clients.edit",
        "orders.create", "orders.edit", "orders.add_payment",
        "changes.create", "reports.sales",
        # Cash micro-permissions for sellers
        "accounting.view_caja_menor", "accounting.open_register",
        # Workforce micro-permissions for sellers
        "workforce.view_shifts", "workforce.self_checklist"
    },
    UserRole.ADMIN: {
        "sales.view", "products.view", "clients.view", "orders.view",
        "inventory.view", "changes.view", "alterations.view", "reports.dashboard",
        "sales.create", "sales.apply_discount", "sales.add_payment",
        "clients.create", "clients.edit",
        "orders.create", "orders.edit", "orders.add_payment",
        "changes.create", "reports.sales",
        "sales.edit", "sales.cancel", "sales.view_cost", "sales.view_all_sellers",
        "changes.approve", "changes.reject",
        "products.create", "products.edit", "products.delete", "products.set_price", "products.set_cost",
        "inventory.view_cost", "inventory.adjust", "inventory.report",
        "global_inventory.adjust",  # Adjust global products inventory
        "clients.delete", "clients.view_balance",
        "orders.cancel", "orders.change_status", "orders.view_all_sellers", "orders.deliver",
        "accounting.view_cash", "accounting.view_expenses", "accounting.create_expense",
        "accounting.pay_expense", "accounting.view_receivables", "accounting.manage_receivables",
        "accounting.view_payables", "accounting.manage_payables", "accounting.view_transactions",
        "accounting.view_balance",
        "alterations.create", "alterations.edit", "alterations.change_status", "alterations.add_payment",
        "reports.inventory", "reports.financial", "reports.export",
        "cash_drawer.open",  # Can open cash drawer directly
        "settings.edit_business_info",  # Can edit business info (name, contacts, etc.)
        # Cash micro-permissions for admins
        "accounting.open_register", "accounting.close_register",
        "accounting.view_caja_menor", "accounting.liquidate_caja_menor",
        "accounting.view_liquidation_history", "accounting.adjust_balance",
        "accounting.view_daily_flow", "accounting.view_global_balances",
        # Caja Menor config & inter-account transfers
        "accounting.edit_caja_menor_config",
        "accounting.transfer_between_accounts", "accounting.view_transfers",
        # Workforce micro-permissions for admins
        "workforce.view_shifts", "workforce.manage_shifts",
        "workforce.view_attendance", "workforce.manage_attendance",
        "workforce.view_absences", "workforce.manage_absences",
        "workforce.view_checklists", "workforce.manage_checklists",
        "workforce.view_performance", "workforce.manage_performance",
        "workforce.view_deductions"
    },
    UserRole.OWNER: None  # Owner gets all permissions - handled specially
}

# Default max discount percentages by role
SYSTEM_ROLE_MAX_DISCOUNT = {
    UserRole.VIEWER: 0,
    UserRole.SELLER: 10,
    UserRole.ADMIN: 25,
    UserRole.OWNER: 100
}

# Default constraints for system roles on specific permissions
# Structure: { permission_code: { role: { constraint_name: value } } }
# None value means unlimited (no constraint)
SYSTEM_ROLE_CONSTRAINTS: dict[str, dict[UserRole, dict[str, Any]]] = {
    "sales.apply_discount": {
        UserRole.VIEWER: {"max_discount_percent": 0},
        UserRole.SELLER: {"max_discount_percent": 10},
        UserRole.ADMIN: {"max_discount_percent": 25},
        UserRole.OWNER: {"max_discount_percent": 100},
    },
    "accounting.liquidate_caja_menor": {
        UserRole.ADMIN: {"max_amount": Decimal("5000000"), "requires_approval": False},
        UserRole.OWNER: {"max_amount": None, "requires_approval": False},
    },
    "accounting.adjust_balance": {
        UserRole.ADMIN: {"max_amount": Decimal("1000000"), "requires_approval": True},
        UserRole.OWNER: {"max_amount": None, "requires_approval": False},
    },
    "cash_drawer.open": {
        UserRole.ADMIN: {"max_daily_count": 20},
        UserRole.OWNER: {"max_daily_count": None},
    },
    "accounting.edit_caja_menor_config": {
        UserRole.ADMIN: {"max_amount": Decimal("2000000"), "requires_approval": False},
        UserRole.OWNER: {"max_amount": None, "requires_approval": False},
    },
    "accounting.transfer_between_accounts": {
        UserRole.ADMIN: {"max_amount": Decimal("5000000"), "requires_approval": False},
        UserRole.OWNER: {"max_amount": None, "requires_approval": False},
    },
}


class PermissionService:
    """Service for checking and managing permissions"""

    def __init__(self, db: AsyncSession):
        self.db = db
        self._permission_cache: dict[str, set[str]] = {}
        self._all_permissions_cache: set[str] | None = None

    async def get_all_permission_codes(self) -> set[str]:
        """Get all available permission codes from the database"""
        if self._all_permissions_cache is not None:
            return self._all_permissions_cache

        result = await self.db.execute(select(Permission.code))
        self._all_permissions_cache = {row[0] for row in result.fetchall()}
        return self._all_permissions_cache

    async def get_user_school_role(
        self,
        user_id: UUID,
        school_id: UUID
    ) -> UserSchoolRole | None:
        """Get the user's role in a specific school"""
        result = await self.db.execute(
            select(UserSchoolRole)
            .options(selectinload(UserSchoolRole.custom_role).selectinload(CustomRole.permissions).selectinload(RolePermission.permission))
            .where(
                UserSchoolRole.user_id == user_id,
                UserSchoolRole.school_id == school_id
            )
        )
        return result.scalar_one_or_none()

    async def get_user_permissions(
        self,
        user_id: UUID,
        school_id: UUID
    ) -> set[str]:
        """
        Get all effective permissions for a user in a school.

        Returns a set of permission codes the user has access to.
        Handles:
        - System roles (viewer, seller, admin, owner)
        - Custom roles
        - Permission overrides (grant/revoke)
        """
        # Check cache first
        cache_key = f"{user_id}:{school_id}"
        if cache_key in self._permission_cache:
            return self._permission_cache[cache_key]

        # Get user's role in school
        user_school_role = await self.get_user_school_role(user_id, school_id)
        if not user_school_role:
            return set()

        permissions = set()

        # Get permissions from system role or custom role
        if user_school_role.role:
            # System role - use hardcoded defaults (faster, no DB query)
            # These are the canonical permissions for system roles
            system_perms = SYSTEM_ROLE_PERMISSIONS.get(user_school_role.role)
            if system_perms is None:
                # Owner gets all permissions
                permissions = await self.get_all_permission_codes()
            else:
                permissions = set(system_perms)
        elif user_school_role.custom_role_id and user_school_role.custom_role:
            # Custom role - get permissions from role_permissions relationship
            # The relationship was eagerly loaded in get_user_school_role()
            for role_perm in user_school_role.custom_role.permissions:
                if role_perm.permission:
                    permissions.add(role_perm.permission.code)

        # Apply overrides
        if user_school_role.permission_overrides:
            granted = user_school_role.permission_overrides.get("grant", [])
            revoked = user_school_role.permission_overrides.get("revoke", [])
            permissions = permissions.union(set(granted)) - set(revoked)

        # Cache result
        self._permission_cache[cache_key] = permissions
        return permissions

    async def has_permission(
        self,
        user_id: UUID,
        school_id: UUID,
        permission_code: str
    ) -> bool:
        """Check if user has a specific permission"""
        permissions = await self.get_user_permissions(user_id, school_id)
        return permission_code in permissions

    async def has_any_permission(
        self,
        user_id: UUID,
        school_id: UUID,
        *permission_codes: str
    ) -> bool:
        """Check if user has any of the specified permissions"""
        permissions = await self.get_user_permissions(user_id, school_id)
        return any(p in permissions for p in permission_codes)

    async def has_all_permissions(
        self,
        user_id: UUID,
        school_id: UUID,
        *permission_codes: str
    ) -> bool:
        """Check if user has all of the specified permissions"""
        permissions = await self.get_user_permissions(user_id, school_id)
        return all(p in permissions for p in permission_codes)

    async def get_max_discount_percent(
        self,
        user_id: UUID,
        school_id: UUID
    ) -> int:
        """Get maximum discount percentage user can apply"""
        user_school_role = await self.get_user_school_role(user_id, school_id)
        if not user_school_role:
            return 0

        # Check system role first
        if user_school_role.role:
            return SYSTEM_ROLE_MAX_DISCOUNT.get(user_school_role.role, 0)

        # Check custom role
        if user_school_role.custom_role_id and user_school_role.custom_role:
            for role_perm in user_school_role.custom_role.permissions:
                if role_perm.permission and role_perm.permission.code == "sales.apply_discount":
                    return role_perm.max_discount_percent or 0

        return 0

    async def get_permission_constraint(
        self,
        user_id: UUID,
        school_id: UUID,
        permission_code: str,
        constraint_name: str
    ) -> Any:
        """
        Get a constraint value for a permission.

        Works for both system roles (via SYSTEM_ROLE_CONSTRAINTS map)
        and custom roles (via role_permissions table).

        Example: get max_amount for accounting.liquidate_caja_menor
        """
        user_school_role = await self.get_user_school_role(user_id, school_id)
        if not user_school_role:
            return None

        if user_school_role.role:
            # System role - look up in SYSTEM_ROLE_CONSTRAINTS
            perm_constraints = SYSTEM_ROLE_CONSTRAINTS.get(permission_code)
            if perm_constraints:
                role_constraints = perm_constraints.get(user_school_role.role)
                if role_constraints:
                    return role_constraints.get(constraint_name)
            return None

        if user_school_role.custom_role_id and user_school_role.custom_role:
            # Custom role - query role_permissions
            for role_perm in user_school_role.custom_role.permissions:
                if role_perm.permission and role_perm.permission.code == permission_code:
                    return getattr(role_perm, constraint_name, None)

        return None

    async def get_permission_constraints(
        self,
        user_id: UUID,
        school_id: UUID,
        permission_code: str
    ) -> dict[str, Any]:
        """
        Get all constraints for a permission as a dict.

        Returns: {"max_amount": Decimal|None, "requires_approval": bool, "max_daily_count": int|None}
        """
        user_school_role = await self.get_user_school_role(user_id, school_id)
        if not user_school_role:
            return {}

        if user_school_role.role:
            # System role
            perm_constraints = SYSTEM_ROLE_CONSTRAINTS.get(permission_code)
            if perm_constraints:
                role_constraints = perm_constraints.get(user_school_role.role)
                if role_constraints:
                    return dict(role_constraints)
            return {}

        if user_school_role.custom_role_id and user_school_role.custom_role:
            # Custom role
            for role_perm in user_school_role.custom_role.permissions:
                if role_perm.permission and role_perm.permission.code == permission_code:
                    return {
                        "max_amount": role_perm.max_amount,
                        "requires_approval": role_perm.requires_approval,
                        "max_discount_percent": role_perm.max_discount_percent,
                        "max_daily_count": role_perm.max_daily_count,
                    }

        return {}

    async def check_amount_constraint(
        self,
        user_id: UUID,
        school_id: UUID,
        permission_code: str,
        amount: Decimal
    ) -> tuple[bool, bool, str | None]:
        """
        Check if an amount operation is allowed under permission constraints.

        Returns: (allowed, needs_approval, rejection_reason)
        - allowed=True, needs_approval=False: proceed normally
        - allowed=True, needs_approval=True: requires approval code
        - allowed=False: operation denied with reason
        """
        constraints = await self.get_permission_constraints(
            user_id, school_id, permission_code
        )

        if not constraints:
            # No constraints defined = allowed without limits
            return (True, False, None)

        max_amount = constraints.get("max_amount")
        requires_approval = constraints.get("requires_approval", False)

        if max_amount is not None and amount > max_amount:
            if requires_approval:
                return (
                    True,
                    True,
                    f"Monto ${amount:,.0f} excede limite de ${max_amount:,.0f}. Requiere aprobacion."
                )
            return (
                False,
                False,
                f"Monto maximo permitido: ${max_amount:,.0f}"
            )

        if requires_approval:
            return (True, True, "Esta operacion requiere aprobacion.")

        return (True, False, None)

    def clear_cache(self, user_id: UUID | None = None, school_id: UUID | None = None):
        """Clear permission cache for a user/school or all"""
        if user_id and school_id:
            cache_key = f"{user_id}:{school_id}"
            self._permission_cache.pop(cache_key, None)
        elif user_id:
            # Clear all entries for this user
            keys_to_remove = [k for k in self._permission_cache if k.startswith(f"{user_id}:")]
            for key in keys_to_remove:
                del self._permission_cache[key]
        else:
            # Clear all
            self._permission_cache.clear()


# Helper functions for quick permission checks
async def check_permission(
    db: AsyncSession,
    user: User,
    school_id: UUID,
    permission_code: str
) -> bool:
    """Quick helper to check a single permission"""
    if user.is_superuser:
        return True
    service = PermissionService(db)
    return await service.has_permission(user.id, school_id, permission_code)


async def get_user_max_discount(
    db: AsyncSession,
    user: User,
    school_id: UUID
) -> int:
    """Quick helper to get max discount for a user"""
    if user.is_superuser:
        return 100
    service = PermissionService(db)
    return await service.get_max_discount_percent(user.id, school_id)
