"""
Tests for permission dependency functions (require_permission, require_global_permission, etc.)

These are the core authorization gatekeepers — every endpoint depends on them.
Tests verify:
- require_permission grants/denies based on specific permission code
- require_global_permission checks across all user schools
- require_permission_with_constraints returns constraint values
- Superuser bypass in all dependency types
- Custom role users are properly checked (not the old hierarchy hack)
"""
import pytest
import asyncio
from uuid import uuid4, UUID
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi import HTTPException

from app.api.dependencies import (
    require_permission,
    require_any_permission,
    require_global_permission,
    require_permission_with_constraints,
    require_owner_or_superuser,
    get_current_user,
)
from app.models.user import UserRole, User, UserSchoolRole
from app.services.permission import PermissionService


pytestmark = pytest.mark.unit


def _make_user(*, is_superuser=False, is_active=True):
    user = MagicMock(spec=User)
    user.id = uuid4()
    user.username = "testuser"
    user.is_superuser = is_superuser
    user.is_active = is_active
    return user


def _make_school_role(*, role=None, custom_role_id=None, school_id=None):
    sr = MagicMock(spec=UserSchoolRole)
    sr.school_id = school_id or uuid4()
    sr.role = role
    sr.custom_role_id = custom_role_id
    return sr


def _mock_db_returning_school_roles(mock_db, roles):
    """Configure mock_db so UserService.get_user_schools() returns given roles."""
    mock_scalars = MagicMock()
    mock_scalars.all.return_value = roles
    mock_result = MagicMock()
    mock_result.scalars.return_value = mock_scalars
    mock_db.execute = AsyncMock(return_value=mock_result)


class TestRequirePermission:
    """Tests for require_permission() dependency factory."""

    def test_superuser_bypasses_all_permissions(self, mock_db_session):
        """Superuser should pass any permission check without querying DB."""
        async def run():
            verify = require_permission("sales.cancel")
            user = _make_user(is_superuser=True)
            school_id = uuid4()

            # Should NOT raise
            await verify(school_id=school_id, current_user=user, db=mock_db_session)

            # Should NOT have called PermissionService
            mock_db_session.execute.assert_not_called()

        asyncio.get_event_loop().run_until_complete(run())

    def test_denies_user_without_permission(self, mock_db_session):
        """User without the required permission should get 403."""
        async def run():
            verify = require_permission("sales.cancel")
            user = _make_user()
            school_id = uuid4()

            with patch.object(PermissionService, 'has_permission', new_callable=AsyncMock, return_value=False):
                with pytest.raises(HTTPException) as exc_info:
                    await verify(school_id=school_id, current_user=user, db=mock_db_session)

                assert exc_info.value.status_code == 403
                assert "sales.cancel" in exc_info.value.detail

        asyncio.get_event_loop().run_until_complete(run())

    def test_allows_user_with_permission(self, mock_db_session):
        """User with the required permission should pass."""
        async def run():
            verify = require_permission("sales.create")
            user = _make_user()
            school_id = uuid4()

            with patch.object(PermissionService, 'has_permission', new_callable=AsyncMock, return_value=True):
                await verify(school_id=school_id, current_user=user, db=mock_db_session)

        asyncio.get_event_loop().run_until_complete(run())

    def test_checks_correct_permission_code(self, mock_db_session):
        """Should pass the exact permission code to PermissionService."""
        async def run():
            verify = require_permission("inventory.adjust")
            user = _make_user()
            school_id = uuid4()

            with patch.object(PermissionService, 'has_permission', new_callable=AsyncMock, return_value=True) as mock_has:
                await verify(school_id=school_id, current_user=user, db=mock_db_session)

                mock_has.assert_called_once_with(user.id, school_id, "inventory.adjust")

        asyncio.get_event_loop().run_until_complete(run())

    def test_seller_with_create_permission_passes(self, mock_db_session):
        """A seller should pass require_permission('sales.create')."""
        async def run():
            verify = require_permission("sales.create")
            user = _make_user()
            school_id = uuid4()

            # Simulate PermissionService resolving SELLER role → has sales.create
            with patch.object(PermissionService, 'has_permission', new_callable=AsyncMock, return_value=True):
                await verify(school_id=school_id, current_user=user, db=mock_db_session)

        asyncio.get_event_loop().run_until_complete(run())

    def test_viewer_denied_create_permission(self, mock_db_session):
        """A viewer should be denied require_permission('sales.create')."""
        async def run():
            verify = require_permission("sales.create")
            user = _make_user()
            school_id = uuid4()

            with patch.object(PermissionService, 'has_permission', new_callable=AsyncMock, return_value=False):
                with pytest.raises(HTTPException) as exc_info:
                    await verify(school_id=school_id, current_user=user, db=mock_db_session)
                assert exc_info.value.status_code == 403

        asyncio.get_event_loop().run_until_complete(run())


class TestRequireAnyPermission:
    """Tests for require_any_permission() dependency factory."""

    def test_superuser_bypasses(self, mock_db_session):
        async def run():
            verify = require_any_permission("reports.sales", "reports.inventory")
            user = _make_user(is_superuser=True)
            await verify(school_id=uuid4(), current_user=user, db=mock_db_session)

        asyncio.get_event_loop().run_until_complete(run())

    def test_passes_when_user_has_one_of_permissions(self, mock_db_session):
        async def run():
            verify = require_any_permission("reports.sales", "reports.inventory")
            user = _make_user()
            school_id = uuid4()

            with patch.object(PermissionService, 'has_any_permission', new_callable=AsyncMock, return_value=True):
                await verify(school_id=school_id, current_user=user, db=mock_db_session)

        asyncio.get_event_loop().run_until_complete(run())

    def test_denies_when_user_has_none(self, mock_db_session):
        async def run():
            verify = require_any_permission("reports.sales", "reports.inventory")
            user = _make_user()
            school_id = uuid4()

            with patch.object(PermissionService, 'has_any_permission', new_callable=AsyncMock, return_value=False):
                with pytest.raises(HTTPException) as exc_info:
                    await verify(school_id=school_id, current_user=user, db=mock_db_session)
                assert exc_info.value.status_code == 403

        asyncio.get_event_loop().run_until_complete(run())


class TestRequireGlobalPermission:
    """Tests for require_global_permission() — cross-school permission check."""

    def test_superuser_bypasses(self, mock_db_session):
        async def run():
            verify = require_global_permission("accounting.view_cash")
            user = _make_user(is_superuser=True)
            await verify(current_user=user, db=mock_db_session)

        asyncio.get_event_loop().run_until_complete(run())

    def test_denies_user_with_no_schools(self, mock_db_session):
        async def run():
            verify = require_global_permission("accounting.view_cash")
            user = _make_user()
            _mock_db_returning_school_roles(mock_db_session, [])

            with pytest.raises(HTTPException) as exc_info:
                await verify(current_user=user, db=mock_db_session)
            assert exc_info.value.status_code == 403

        asyncio.get_event_loop().run_until_complete(run())

    def test_allows_owner_in_any_school(self, mock_db_session):
        """Owner has all permissions — global check should pass."""
        async def run():
            verify = require_global_permission("accounting.view_cash")
            user = _make_user()
            school_role = _make_school_role(role=UserRole.OWNER)
            _mock_db_returning_school_roles(mock_db_session, [school_role])

            await verify(current_user=user, db=mock_db_session)

        asyncio.get_event_loop().run_until_complete(run())

    def test_allows_admin_with_matching_permission(self, mock_db_session):
        """Admin with the permission in any school should pass."""
        async def run():
            verify = require_global_permission("accounting.view_cash")
            user = _make_user()
            school_role = _make_school_role(role=UserRole.ADMIN)
            _mock_db_returning_school_roles(mock_db_session, [school_role])

            await verify(current_user=user, db=mock_db_session)

        asyncio.get_event_loop().run_until_complete(run())

    def test_denies_seller_without_permission(self, mock_db_session):
        """Seller doesn't have accounting.view_cash — should be denied."""
        async def run():
            verify = require_global_permission("accounting.view_cash")
            user = _make_user()
            school_role = _make_school_role(role=UserRole.SELLER)
            _mock_db_returning_school_roles(mock_db_session, [school_role])

            with pytest.raises(HTTPException) as exc_info:
                await verify(current_user=user, db=mock_db_session)
            assert exc_info.value.status_code == 403

        asyncio.get_event_loop().run_until_complete(run())

    def test_custom_role_with_permission_passes(self, mock_db_session):
        """Custom role that has the permission should pass global check."""
        async def run():
            verify = require_global_permission("accounting.view_cash")
            user = _make_user()
            school_role = _make_school_role(role=None, custom_role_id=uuid4())
            _mock_db_returning_school_roles(mock_db_session, [school_role])

            with patch.object(PermissionService, 'get_user_permissions', new_callable=AsyncMock,
                              return_value={"accounting.view_cash", "accounting.view_expenses"}):
                await verify(current_user=user, db=mock_db_session)

        asyncio.get_event_loop().run_until_complete(run())

    def test_custom_role_without_permission_denied(self, mock_db_session):
        """Custom role without the permission should be denied."""
        async def run():
            verify = require_global_permission("accounting.view_cash")
            user = _make_user()
            school_role = _make_school_role(role=None, custom_role_id=uuid4())
            _mock_db_returning_school_roles(mock_db_session, [school_role])

            with patch.object(PermissionService, 'get_user_permissions', new_callable=AsyncMock,
                              return_value={"sales.view", "sales.create"}):
                with pytest.raises(HTTPException) as exc_info:
                    await verify(current_user=user, db=mock_db_session)
                assert exc_info.value.status_code == 403

        asyncio.get_event_loop().run_until_complete(run())


class TestRequirePermissionWithConstraints:
    """Tests for require_permission_with_constraints() — returns constraint dict."""

    def test_superuser_gets_no_constraints(self, mock_db_session):
        async def run():
            verify = require_permission_with_constraints("accounting.liquidate_caja_menor")
            user = _make_user(is_superuser=True)
            school_id = uuid4()

            result = await verify(school_id=school_id, current_user=user, db=mock_db_session)

            assert result["max_amount"] is None
            assert result["requires_approval"] is False
            assert result["max_daily_count"] is None

        asyncio.get_event_loop().run_until_complete(run())

    def test_denies_user_without_permission(self, mock_db_session):
        async def run():
            verify = require_permission_with_constraints("accounting.liquidate_caja_menor")
            user = _make_user()
            school_id = uuid4()

            with patch.object(PermissionService, 'has_permission', new_callable=AsyncMock, return_value=False):
                with pytest.raises(HTTPException) as exc_info:
                    await verify(school_id=school_id, current_user=user, db=mock_db_session)
                assert exc_info.value.status_code == 403

        asyncio.get_event_loop().run_until_complete(run())

    def test_returns_constraints_for_authorized_user(self, mock_db_session):
        from decimal import Decimal

        async def run():
            verify = require_permission_with_constraints("accounting.liquidate_caja_menor")
            user = _make_user()
            school_id = uuid4()

            constraints = {"max_amount": Decimal("5000000"), "requires_approval": False, "max_daily_count": None}

            with patch.object(PermissionService, 'has_permission', new_callable=AsyncMock, return_value=True):
                with patch.object(PermissionService, 'get_permission_constraints', new_callable=AsyncMock, return_value=constraints):
                    result = await verify(school_id=school_id, current_user=user, db=mock_db_session)

                    assert result["max_amount"] == Decimal("5000000")
                    assert result["requires_approval"] is False

        asyncio.get_event_loop().run_until_complete(run())


class TestPermissionCacheTTL:
    """Tests for the shared permission cache TTL behavior."""

    def test_cache_stores_and_retrieves(self):
        from app.services.permission_cache import get_permissions, set_permissions, invalidate

        user_id = uuid4()
        school_id = uuid4()
        perms = {"sales.view", "sales.create"}

        set_permissions(user_id, school_id, perms)
        cached = get_permissions(user_id, school_id)

        assert cached == perms
        invalidate()

    def test_cache_returns_none_for_unknown(self):
        from app.services.permission_cache import get_permissions, invalidate

        invalidate()
        assert get_permissions(uuid4(), uuid4()) is None

    def test_cache_invalidate_specific(self):
        from app.services.permission_cache import get_permissions, set_permissions, invalidate

        u1, s1 = uuid4(), uuid4()
        u2, s2 = uuid4(), uuid4()

        set_permissions(u1, s1, {"a"})
        set_permissions(u2, s2, {"b"})

        invalidate(user_id=u1, school_id=s1)

        assert get_permissions(u1, s1) is None
        assert get_permissions(u2, s2) == {"b"}

        invalidate()

    def test_cache_invalidate_all_for_user(self):
        from app.services.permission_cache import get_permissions, set_permissions, invalidate

        user = uuid4()
        s1, s2 = uuid4(), uuid4()
        other = uuid4()

        set_permissions(user, s1, {"a"})
        set_permissions(user, s2, {"b"})
        set_permissions(other, s1, {"c"})

        invalidate(user_id=user)

        assert get_permissions(user, s1) is None
        assert get_permissions(user, s2) is None
        assert get_permissions(other, s1) == {"c"}

        invalidate()

    def test_cache_expired_entry_returns_none(self):
        """Entries older than TTL should return None."""
        import time
        from app.services import permission_cache

        user_id = uuid4()
        school_id = uuid4()
        key = permission_cache._cache_key(user_id, school_id)

        # Insert with timestamp in the past (beyond TTL)
        permission_cache._permission_cache[key] = ({"sales.view"}, time.monotonic() - 120)

        result = permission_cache.get_permissions(user_id, school_id)
        assert result is None

        permission_cache.invalidate()

    def test_constraint_cache_stores_and_retrieves(self):
        from app.services.permission_cache import get_constraints, set_constraints, invalidate

        user_id = uuid4()
        school_id = uuid4()
        constraints = {"max_amount": 5000000, "requires_approval": False}

        set_constraints(user_id, school_id, "accounting.liquidate", constraints)
        cached = get_constraints(user_id, school_id, "accounting.liquidate")

        assert cached == constraints
        invalidate()


class TestPermissionRegistry:
    """Tests for the permission registry endpoint builder."""

    def test_builds_registry_with_all_system_roles(self):
        from app.api.routes.permission_registry import _build_registry

        # Clear cached response for clean test
        import app.api.routes.permission_registry as reg
        reg._cached_response = None
        reg._cached_version = None

        payload, version = _build_registry()

        assert "permissions" in payload
        assert "system_roles" in payload
        assert "role_constraints" in payload
        assert "version" in payload

        roles = payload["system_roles"]
        assert "viewer" in roles
        assert "seller" in roles
        assert "admin" in roles
        assert "owner" in roles

        # Owner should have null (all permissions)
        assert roles["owner"] is None

        # Viewer should have permissions
        assert isinstance(roles["viewer"], list)
        assert len(roles["viewer"]) > 0

        # Version should be a hex string
        assert len(version) == 16

        # Cleanup
        reg._cached_response = None
        reg._cached_version = None

    def test_registry_permissions_are_sorted(self):
        from app.api.routes.permission_registry import _build_registry
        import app.api.routes.permission_registry as reg
        reg._cached_response = None
        reg._cached_version = None

        payload, _ = _build_registry()

        for role_name, perms in payload["system_roles"].items():
            if perms is not None:
                assert perms == sorted(perms), f"Permissions for {role_name} should be sorted"

        reg._cached_response = None
        reg._cached_version = None

    def test_registry_includes_role_constraints(self):
        from app.api.routes.permission_registry import _build_registry
        import app.api.routes.permission_registry as reg
        reg._cached_response = None
        reg._cached_version = None

        payload, _ = _build_registry()

        constraints = payload["role_constraints"]
        assert "sales.apply_discount" in constraints
        assert "seller" in constraints["sales.apply_discount"]
        assert constraints["sales.apply_discount"]["seller"]["max_discount_percent"] == 10

        reg._cached_response = None
        reg._cached_version = None

    def test_registry_caches_on_second_call(self):
        from app.api.routes.permission_registry import _build_registry
        import app.api.routes.permission_registry as reg
        reg._cached_response = None
        reg._cached_version = None

        payload1, v1 = _build_registry()
        payload2, v2 = _build_registry()

        assert payload1 is payload2
        assert v1 == v2

        reg._cached_response = None
        reg._cached_version = None

    def test_registry_includes_max_discount(self):
        from app.api.routes.permission_registry import _build_registry
        import app.api.routes.permission_registry as reg
        reg._cached_response = None
        reg._cached_version = None

        payload, _ = _build_registry()

        assert "role_max_discount" in payload
        assert payload["role_max_discount"]["viewer"] == 0
        assert payload["role_max_discount"]["seller"] == 10
        assert payload["role_max_discount"]["admin"] == 25
        assert payload["role_max_discount"]["owner"] == 100

        reg._cached_response = None
        reg._cached_version = None


class TestOwnerOrSuperuser:
    """Tests for require_owner_or_superuser() dependency."""

    def test_superuser_passes(self, mock_db_session):
        async def run():
            verify = require_owner_or_superuser()
            user = _make_user(is_superuser=True)
            await verify(school_id=uuid4(), current_user=user, db=mock_db_session)

        asyncio.get_event_loop().run_until_complete(run())

    def test_non_owner_non_superuser_denied(self, mock_db_session):
        async def run():
            verify = require_owner_or_superuser()
            user = _make_user()
            school_id = uuid4()

            admin_role = _make_school_role(role=UserRole.ADMIN, school_id=school_id)
            _mock_db_returning_school_roles(mock_db_session, [admin_role])

            with pytest.raises(HTTPException) as exc_info:
                await verify(school_id=school_id, current_user=user, db=mock_db_session)
            assert exc_info.value.status_code == 403

        asyncio.get_event_loop().run_until_complete(run())

    def test_owner_of_school_passes(self, mock_db_session):
        async def run():
            verify = require_owner_or_superuser()
            user = _make_user()
            school_id = uuid4()

            owner_role = _make_school_role(role=UserRole.OWNER, school_id=school_id)
            _mock_db_returning_school_roles(mock_db_session, [owner_role])

            await verify(school_id=school_id, current_user=user, db=mock_db_session)

        asyncio.get_event_loop().run_until_complete(run())
