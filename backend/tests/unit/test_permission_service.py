"""
Tests for Permission Service.

Tests cover:
- Getting user permissions based on system roles
- Getting user permissions based on custom roles
- Permission caching
- Permission overrides (grant/revoke)
- Max discount percentages by role
- Helper functions
"""
import pytest
from uuid import uuid4
from unittest.mock import AsyncMock, MagicMock, patch
from decimal import Decimal

from app.services.permission import (
    PermissionService,
    SYSTEM_ROLE_PERMISSIONS,
    SYSTEM_ROLE_MAX_DISCOUNT,
    check_permission,
    get_user_max_discount,
)
from app.models.user import UserRole


pytestmark = pytest.mark.unit


class TestSystemRolePermissions:
    """Tests for system role permissions lookup."""

    def test_viewer_permissions_are_read_only(self):
        """Viewer should only have view permissions."""
        viewer_perms = SYSTEM_ROLE_PERMISSIONS[UserRole.VIEWER]

        # All viewer permissions should be view-only
        for perm in viewer_perms:
            assert "view" in perm or perm.endswith(".dashboard")

        # Should not have create/edit/delete
        assert "sales.create" not in viewer_perms
        assert "products.create" not in viewer_perms
        assert "clients.edit" not in viewer_perms

    def test_seller_permissions_include_sales(self):
        """Seller should have sales and client permissions."""
        seller_perms = SYSTEM_ROLE_PERMISSIONS[UserRole.SELLER]

        assert "sales.create" in seller_perms
        assert "sales.apply_discount" in seller_perms
        assert "clients.create" in seller_perms
        assert "orders.create" in seller_perms

    def test_admin_permissions_include_management(self):
        """Admin should have management permissions."""
        admin_perms = SYSTEM_ROLE_PERMISSIONS[UserRole.ADMIN]

        assert "products.create" in admin_perms
        assert "products.edit" in admin_perms
        assert "inventory.adjust" in admin_perms
        assert "accounting.view_cash" in admin_perms
        assert "changes.approve" in admin_perms

    def test_owner_has_none_permissions(self):
        """Owner has None - indicating all permissions."""
        assert SYSTEM_ROLE_PERMISSIONS[UserRole.OWNER] is None


class TestSystemRoleMaxDiscount:
    """Tests for system role max discount percentages."""

    def test_viewer_max_discount_is_zero(self):
        """Viewer should not be able to apply discounts."""
        assert SYSTEM_ROLE_MAX_DISCOUNT[UserRole.VIEWER] == 0

    def test_seller_max_discount_is_10(self):
        """Seller should have 10% max discount."""
        assert SYSTEM_ROLE_MAX_DISCOUNT[UserRole.SELLER] == 10

    def test_admin_max_discount_is_25(self):
        """Admin should have 25% max discount."""
        assert SYSTEM_ROLE_MAX_DISCOUNT[UserRole.ADMIN] == 25

    def test_owner_max_discount_is_100(self):
        """Owner should have 100% max discount."""
        assert SYSTEM_ROLE_MAX_DISCOUNT[UserRole.OWNER] == 100


class TestPermissionServiceGetUserPermissions:
    """Tests for PermissionService.get_user_permissions()."""

    def test_returns_empty_set_when_user_has_no_role(self, mock_db_session):
        """Should return empty set when user has no role in school."""
        import asyncio

        async def run_test():
            service = PermissionService(mock_db_session)

            # Mock no role found
            mock_result = MagicMock()
            mock_result.scalar_one_or_none.return_value = None
            mock_db_session.execute.return_value = mock_result

            user_id = uuid4()
            school_id = uuid4()

            permissions = await service.get_user_permissions(user_id, school_id)
            assert permissions == set()

        asyncio.get_event_loop().run_until_complete(run_test())

    def test_returns_system_role_permissions(self, mock_db_session):
        """Should return permissions from system role."""
        import asyncio

        async def run_test():
            service = PermissionService(mock_db_session)

            # Mock user with SELLER role
            mock_role = MagicMock()
            mock_role.role = UserRole.SELLER
            mock_role.custom_role_id = None
            mock_role.custom_role = None
            mock_role.permission_overrides = None

            mock_result = MagicMock()
            mock_result.scalar_one_or_none.return_value = mock_role
            mock_db_session.execute.return_value = mock_result

            user_id = uuid4()
            school_id = uuid4()

            permissions = await service.get_user_permissions(user_id, school_id)

            # Should have seller permissions
            assert "sales.create" in permissions
            assert "clients.create" in permissions

        asyncio.get_event_loop().run_until_complete(run_test())

    def test_applies_grant_overrides(self, mock_db_session):
        """Should add granted permissions to base role."""
        import asyncio

        async def run_test():
            service = PermissionService(mock_db_session)

            # Mock user with VIEWER role and grant override
            mock_role = MagicMock()
            mock_role.role = UserRole.VIEWER
            mock_role.custom_role_id = None
            mock_role.custom_role = None
            mock_role.permission_overrides = {"grant": ["sales.create"], "revoke": []}

            mock_result = MagicMock()
            mock_result.scalar_one_or_none.return_value = mock_role
            mock_db_session.execute.return_value = mock_result

            user_id = uuid4()
            school_id = uuid4()

            permissions = await service.get_user_permissions(user_id, school_id)

            # Viewer base + granted permission
            assert "sales.view" in permissions  # Base
            assert "sales.create" in permissions  # Granted

        asyncio.get_event_loop().run_until_complete(run_test())

    def test_applies_revoke_overrides(self, mock_db_session):
        """Should remove revoked permissions from base role."""
        import asyncio

        async def run_test():
            service = PermissionService(mock_db_session)

            # Mock user with SELLER role and revoke override
            mock_role = MagicMock()
            mock_role.role = UserRole.SELLER
            mock_role.custom_role_id = None
            mock_role.custom_role = None
            mock_role.permission_overrides = {"grant": [], "revoke": ["sales.apply_discount"]}

            mock_result = MagicMock()
            mock_result.scalar_one_or_none.return_value = mock_role
            mock_db_session.execute.return_value = mock_result

            user_id = uuid4()
            school_id = uuid4()

            permissions = await service.get_user_permissions(user_id, school_id)

            # Seller base minus revoked permission
            assert "sales.create" in permissions  # Kept
            assert "sales.apply_discount" not in permissions  # Revoked

        asyncio.get_event_loop().run_until_complete(run_test())

    def test_caches_permissions(self, mock_db_session):
        """Should cache permissions and not query DB twice."""
        import asyncio

        async def run_test():
            service = PermissionService(mock_db_session)

            # Mock user with role
            mock_role = MagicMock()
            mock_role.role = UserRole.VIEWER
            mock_role.custom_role_id = None
            mock_role.custom_role = None
            mock_role.permission_overrides = None

            mock_result = MagicMock()
            mock_result.scalar_one_or_none.return_value = mock_role
            mock_db_session.execute.return_value = mock_result

            user_id = uuid4()
            school_id = uuid4()

            # First call - should query DB
            await service.get_user_permissions(user_id, school_id)
            assert mock_db_session.execute.call_count == 1

            # Second call - should use cache
            await service.get_user_permissions(user_id, school_id)
            assert mock_db_session.execute.call_count == 1  # Still 1, cache hit

        asyncio.get_event_loop().run_until_complete(run_test())


class TestPermissionServiceHasPermission:
    """Tests for PermissionService.has_permission()."""

    def test_returns_true_when_has_permission(self, mock_db_session):
        """Should return True when user has the permission."""
        import asyncio

        async def run_test():
            service = PermissionService(mock_db_session)

            mock_role = MagicMock()
            mock_role.role = UserRole.SELLER
            mock_role.custom_role_id = None
            mock_role.custom_role = None
            mock_role.permission_overrides = None

            mock_result = MagicMock()
            mock_result.scalar_one_or_none.return_value = mock_role
            mock_db_session.execute.return_value = mock_result

            result = await service.has_permission(uuid4(), uuid4(), "sales.create")

            assert result is True

        asyncio.get_event_loop().run_until_complete(run_test())

    def test_returns_false_when_missing_permission(self, mock_db_session):
        """Should return False when user doesn't have the permission."""
        import asyncio

        async def run_test():
            service = PermissionService(mock_db_session)

            mock_role = MagicMock()
            mock_role.role = UserRole.VIEWER  # Viewer cannot create products
            mock_role.custom_role_id = None
            mock_role.custom_role = None
            mock_role.permission_overrides = None

            mock_result = MagicMock()
            mock_result.scalar_one_or_none.return_value = mock_role
            mock_db_session.execute.return_value = mock_result

            result = await service.has_permission(uuid4(), uuid4(), "products.create")

            assert result is False

        asyncio.get_event_loop().run_until_complete(run_test())


class TestPermissionServiceHasAnyPermission:
    """Tests for PermissionService.has_any_permission()."""

    def test_returns_true_when_has_any(self, mock_db_session):
        """Should return True when user has at least one permission."""
        import asyncio

        async def run_test():
            service = PermissionService(mock_db_session)

            mock_role = MagicMock()
            mock_role.role = UserRole.VIEWER
            mock_role.custom_role_id = None
            mock_role.custom_role = None
            mock_role.permission_overrides = None

            mock_result = MagicMock()
            mock_result.scalar_one_or_none.return_value = mock_role
            mock_db_session.execute.return_value = mock_result

            result = await service.has_any_permission(
                uuid4(), uuid4(),
                "products.create",  # Viewer doesn't have
                "sales.view"  # Viewer has
            )

            assert result is True

        asyncio.get_event_loop().run_until_complete(run_test())

    def test_returns_false_when_has_none(self, mock_db_session):
        """Should return False when user has none of the permissions."""
        import asyncio

        async def run_test():
            service = PermissionService(mock_db_session)

            mock_role = MagicMock()
            mock_role.role = UserRole.VIEWER
            mock_role.custom_role_id = None
            mock_role.custom_role = None
            mock_role.permission_overrides = None

            mock_result = MagicMock()
            mock_result.scalar_one_or_none.return_value = mock_role
            mock_db_session.execute.return_value = mock_result

            result = await service.has_any_permission(
                uuid4(), uuid4(),
                "products.create",
                "inventory.adjust"
            )

            assert result is False

        asyncio.get_event_loop().run_until_complete(run_test())


class TestPermissionServiceHasAllPermissions:
    """Tests for PermissionService.has_all_permissions()."""

    def test_returns_true_when_has_all(self, mock_db_session):
        """Should return True when user has all permissions."""
        import asyncio

        async def run_test():
            service = PermissionService(mock_db_session)

            mock_role = MagicMock()
            mock_role.role = UserRole.SELLER
            mock_role.custom_role_id = None
            mock_role.custom_role = None
            mock_role.permission_overrides = None

            mock_result = MagicMock()
            mock_result.scalar_one_or_none.return_value = mock_role
            mock_db_session.execute.return_value = mock_result

            result = await service.has_all_permissions(
                uuid4(), uuid4(),
                "sales.create",
                "sales.view"
            )

            assert result is True

        asyncio.get_event_loop().run_until_complete(run_test())

    def test_returns_false_when_missing_one(self, mock_db_session):
        """Should return False when user is missing one permission."""
        import asyncio

        async def run_test():
            service = PermissionService(mock_db_session)

            mock_role = MagicMock()
            mock_role.role = UserRole.SELLER  # Seller cannot edit sales
            mock_role.custom_role_id = None
            mock_role.custom_role = None
            mock_role.permission_overrides = None

            mock_result = MagicMock()
            mock_result.scalar_one_or_none.return_value = mock_role
            mock_db_session.execute.return_value = mock_result

            result = await service.has_all_permissions(
                uuid4(), uuid4(),
                "sales.create",  # Has
                "sales.edit"  # Doesn't have
            )

            assert result is False

        asyncio.get_event_loop().run_until_complete(run_test())


class TestPermissionServiceMaxDiscount:
    """Tests for PermissionService.get_max_discount_percent()."""

    def test_returns_system_role_discount(self, mock_db_session):
        """Should return max discount based on system role."""
        import asyncio

        async def run_test():
            service = PermissionService(mock_db_session)

            mock_role = MagicMock()
            mock_role.role = UserRole.ADMIN
            mock_role.custom_role_id = None
            mock_role.custom_role = None

            mock_result = MagicMock()
            mock_result.scalar_one_or_none.return_value = mock_role
            mock_db_session.execute.return_value = mock_result

            result = await service.get_max_discount_percent(uuid4(), uuid4())

            assert result == 25

        asyncio.get_event_loop().run_until_complete(run_test())

    def test_returns_zero_when_no_role(self, mock_db_session):
        """Should return 0 when user has no role."""
        import asyncio

        async def run_test():
            service = PermissionService(mock_db_session)

            mock_result = MagicMock()
            mock_result.scalar_one_or_none.return_value = None
            mock_db_session.execute.return_value = mock_result

            result = await service.get_max_discount_percent(uuid4(), uuid4())

            assert result == 0

        asyncio.get_event_loop().run_until_complete(run_test())


class TestPermissionServiceCacheClear:
    """Tests for PermissionService.clear_cache()."""

    def test_clear_specific_user_school(self, mock_db_session):
        """Should clear cache for specific user/school."""
        service = PermissionService(mock_db_session)

        user_id = uuid4()
        school_id = uuid4()
        cache_key = f"{user_id}:{school_id}"

        # Populate cache
        service._permission_cache[cache_key] = {"sales.view"}
        service._permission_cache["other:key"] = {"products.view"}

        # Clear specific
        service.clear_cache(user_id, school_id)

        assert cache_key not in service._permission_cache
        assert "other:key" in service._permission_cache

    def test_clear_all_for_user(self, mock_db_session):
        """Should clear all cache entries for a user."""
        service = PermissionService(mock_db_session)

        user_id = uuid4()
        school1 = uuid4()
        school2 = uuid4()
        other_user = uuid4()

        # Populate cache
        service._permission_cache[f"{user_id}:{school1}"] = {"a"}
        service._permission_cache[f"{user_id}:{school2}"] = {"b"}
        service._permission_cache[f"{other_user}:{school1}"] = {"c"}

        # Clear for user
        service.clear_cache(user_id=user_id)

        assert f"{user_id}:{school1}" not in service._permission_cache
        assert f"{user_id}:{school2}" not in service._permission_cache
        assert f"{other_user}:{school1}" in service._permission_cache

    def test_clear_all(self, mock_db_session):
        """Should clear entire cache."""
        service = PermissionService(mock_db_session)

        # Populate cache
        service._permission_cache["a:b"] = {"x"}
        service._permission_cache["c:d"] = {"y"}

        # Clear all
        service.clear_cache()

        assert len(service._permission_cache) == 0


class TestHelperFunctions:
    """Tests for helper functions."""

    def test_check_permission_superuser_always_true(self, mock_db_session):
        """Superuser should always have permission."""
        import asyncio

        async def run_test():
            mock_user = MagicMock()
            mock_user.is_superuser = True

            result = await check_permission(
                mock_db_session,
                mock_user,
                uuid4(),
                "any.permission"
            )

            assert result is True

        asyncio.get_event_loop().run_until_complete(run_test())

    def test_get_user_max_discount_superuser_100(self, mock_db_session):
        """Superuser should have 100% max discount."""
        import asyncio

        async def run_test():
            mock_user = MagicMock()
            mock_user.is_superuser = True

            result = await get_user_max_discount(mock_db_session, mock_user, uuid4())

            assert result == 100

        asyncio.get_event_loop().run_until_complete(run_test())
