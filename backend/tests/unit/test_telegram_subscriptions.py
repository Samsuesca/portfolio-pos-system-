"""
Tests for TelegramSubscriptionService.

Uses mocked AsyncSession to verify CRUD operations, role-based
default subscriptions, and alert routing queries.
"""
import pytest
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch, PropertyMock
from uuid import uuid4, UUID

from app.models.telegram_subscription import (
    TelegramAlertSubscription,
    TelegramAlertType,
    DEFAULT_SUBSCRIPTIONS_BY_ROLE,
)
from app.models.user import User, UserRole
from app.services.telegram_subscriptions import TelegramSubscriptionService


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_user(
    *,
    user_id: UUID | None = None,
    username: str = "testuser",
    is_superuser: bool = False,
    telegram_chat_id: str | None = None,
) -> MagicMock:
    """Create a mock User with the given attributes."""
    user = MagicMock(spec=User)
    user.id = user_id or uuid4()
    user.username = username
    user.email = f"{username}@test.com"
    user.full_name = f"Test {username}"
    user.is_superuser = is_superuser
    user.is_active = True
    user.telegram_chat_id = telegram_chat_id
    user.telegram_subscriptions = []
    return user


def _make_subscription(
    *,
    user_id: UUID,
    alert_type: TelegramAlertType,
    is_active: bool = True,
) -> MagicMock:
    """Create a mock TelegramAlertSubscription."""
    sub = MagicMock(spec=TelegramAlertSubscription)
    sub.user_id = user_id
    sub.alert_type = alert_type
    sub.is_active = is_active
    return sub


def _mock_db_with_user(user: MagicMock) -> AsyncMock:
    """Create a mock db session that returns the given user on _get_user."""
    db = AsyncMock()
    db.flush = AsyncMock()
    db.add = MagicMock()

    # For _get_user: select(User).where(...)
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = user
    db.execute = AsyncMock(return_value=mock_result)

    return db


# ---------------------------------------------------------------------------
# link_telegram
# ---------------------------------------------------------------------------


class TestLinkTelegram:
    """Test TelegramSubscriptionService.link_telegram."""

    @pytest.mark.unit
    async def test_link_telegram_sets_chat_id(self):
        """link_telegram sets the user's telegram_chat_id."""
        user = _make_user()
        db = _mock_db_with_user(user)

        svc = TelegramSubscriptionService(db)
        # Patch internal methods to isolate link_telegram
        svc._get_user = AsyncMock(return_value=user)
        svc._create_default_subscriptions = AsyncMock()

        result = await svc.link_telegram(user.id, "CHAT_123")

        assert result.telegram_chat_id == "CHAT_123"
        db.flush.assert_called()

    @pytest.mark.unit
    async def test_link_telegram_creates_default_subscriptions(self):
        """link_telegram calls _create_default_subscriptions."""
        user = _make_user()
        db = _mock_db_with_user(user)

        svc = TelegramSubscriptionService(db)
        svc._get_user = AsyncMock(return_value=user)
        svc._create_default_subscriptions = AsyncMock()

        await svc.link_telegram(user.id, "CHAT_456")

        svc._create_default_subscriptions.assert_called_once_with(user)

    @pytest.mark.unit
    async def test_link_telegram_user_not_found_raises(self):
        """link_telegram raises ValueError when user does not exist."""
        db = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        db.execute = AsyncMock(return_value=mock_result)

        svc = TelegramSubscriptionService(db)

        with pytest.raises(ValueError, match="Usuario no encontrado"):
            await svc.link_telegram(uuid4(), "CHAT_789")


# ---------------------------------------------------------------------------
# unlink_telegram
# ---------------------------------------------------------------------------


class TestUnlinkTelegram:
    """Test TelegramSubscriptionService.unlink_telegram."""

    @pytest.mark.unit
    async def test_unlink_clears_chat_id(self):
        """unlink_telegram sets telegram_chat_id to None."""
        user = _make_user(telegram_chat_id="CHAT_OLD")
        db = _mock_db_with_user(user)

        svc = TelegramSubscriptionService(db)
        svc._get_user = AsyncMock(return_value=user)

        result = await svc.unlink_telegram(user.id)

        assert result.telegram_chat_id is None

    @pytest.mark.unit
    async def test_unlink_deletes_all_subscriptions(self):
        """unlink_telegram executes a delete query for all user subscriptions."""
        user = _make_user(telegram_chat_id="CHAT_OLD")
        db = AsyncMock()
        db.flush = AsyncMock()
        db.execute = AsyncMock()

        svc = TelegramSubscriptionService(db)
        svc._get_user = AsyncMock(return_value=user)

        await svc.unlink_telegram(user.id)

        # At least two execute calls: one for delete subscriptions, one for flush
        assert db.execute.call_count >= 1

    @pytest.mark.unit
    async def test_unlink_user_not_found_raises(self):
        """unlink_telegram raises ValueError when user does not exist."""
        db = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        db.execute = AsyncMock(return_value=mock_result)

        svc = TelegramSubscriptionService(db)

        with pytest.raises(ValueError, match="Usuario no encontrado"):
            await svc.unlink_telegram(uuid4())


# ---------------------------------------------------------------------------
# get_user_subscriptions
# ---------------------------------------------------------------------------


class TestGetUserSubscriptions:
    """Test TelegramSubscriptionService.get_user_subscriptions."""

    @pytest.mark.unit
    async def test_returns_active_subscriptions(self):
        """get_user_subscriptions returns list of active subscriptions."""
        user_id = uuid4()
        subs = [
            _make_subscription(
                user_id=user_id,
                alert_type=TelegramAlertType.sale_created,
            ),
            _make_subscription(
                user_id=user_id,
                alert_type=TelegramAlertType.low_stock,
            ),
        ]

        db = AsyncMock()
        mock_result = MagicMock()
        mock_scalars = MagicMock()
        mock_scalars.all.return_value = subs
        mock_result.scalars.return_value = mock_scalars
        db.execute = AsyncMock(return_value=mock_result)

        svc = TelegramSubscriptionService(db)
        result = await svc.get_user_subscriptions(user_id)

        assert len(result) == 2
        assert result[0].alert_type == TelegramAlertType.sale_created
        assert result[1].alert_type == TelegramAlertType.low_stock

    @pytest.mark.unit
    async def test_returns_empty_list_when_no_subscriptions(self):
        """get_user_subscriptions returns empty list when user has none."""
        db = AsyncMock()
        mock_result = MagicMock()
        mock_scalars = MagicMock()
        mock_scalars.all.return_value = []
        mock_result.scalars.return_value = mock_scalars
        db.execute = AsyncMock(return_value=mock_result)

        svc = TelegramSubscriptionService(db)
        result = await svc.get_user_subscriptions(uuid4())

        assert result == []


# ---------------------------------------------------------------------------
# update_subscriptions
# ---------------------------------------------------------------------------


class TestUpdateSubscriptions:
    """Test TelegramSubscriptionService.update_subscriptions."""

    @pytest.mark.unit
    async def test_update_deletes_existing_and_creates_new(self):
        """update_subscriptions replaces all subscriptions."""
        user_id = uuid4()
        new_types = [
            TelegramAlertType.sale_created,
            TelegramAlertType.daily_digest,
        ]

        db = AsyncMock()
        db.flush = AsyncMock()
        db.add = MagicMock()

        # Mock get_user_subscriptions to return new subs
        new_subs = [
            _make_subscription(user_id=user_id, alert_type=t) for t in new_types
        ]
        mock_result_subs = MagicMock()
        mock_scalars = MagicMock()
        mock_scalars.all.return_value = new_subs
        mock_result_subs.scalars.return_value = mock_scalars

        # First call is delete, subsequent is get_user_subscriptions
        db.execute = AsyncMock(side_effect=[MagicMock(), mock_result_subs])

        svc = TelegramSubscriptionService(db)
        result = await svc.update_subscriptions(user_id, new_types)

        # Should add one subscription per alert_type
        assert db.add.call_count == 2
        assert len(result) == 2

    @pytest.mark.unit
    async def test_update_with_empty_list_clears_all(self):
        """update_subscriptions with empty list removes all subscriptions."""
        user_id = uuid4()

        db = AsyncMock()
        db.flush = AsyncMock()
        db.add = MagicMock()

        mock_result_subs = MagicMock()
        mock_scalars = MagicMock()
        mock_scalars.all.return_value = []
        mock_result_subs.scalars.return_value = mock_scalars

        db.execute = AsyncMock(side_effect=[MagicMock(), mock_result_subs])

        svc = TelegramSubscriptionService(db)
        result = await svc.update_subscriptions(user_id, [])

        db.add.assert_not_called()
        assert result == []


# ---------------------------------------------------------------------------
# get_chat_ids_for_alert
# ---------------------------------------------------------------------------


class TestGetChatIdsForAlert:
    """Test TelegramSubscriptionService.get_chat_ids_for_alert."""

    @pytest.mark.unit
    async def test_returns_chat_ids_for_subscribed_users(self):
        """get_chat_ids_for_alert returns chat_ids of active subscribed users."""
        db = AsyncMock()
        mock_result = MagicMock()
        mock_result.all.return_value = [("CHAT_A",), ("CHAT_B",), ("CHAT_C",)]
        db.execute = AsyncMock(return_value=mock_result)

        svc = TelegramSubscriptionService(db)
        result = await svc.get_chat_ids_for_alert(TelegramAlertType.sale_created)

        assert result == ["CHAT_A", "CHAT_B", "CHAT_C"]

    @pytest.mark.unit
    async def test_returns_empty_when_no_subscribers(self):
        """get_chat_ids_for_alert returns empty list if nobody is subscribed."""
        db = AsyncMock()
        mock_result = MagicMock()
        mock_result.all.return_value = []
        db.execute = AsyncMock(return_value=mock_result)

        svc = TelegramSubscriptionService(db)
        result = await svc.get_chat_ids_for_alert(TelegramAlertType.system_health)

        assert result == []

    @pytest.mark.unit
    async def test_filters_out_none_chat_ids(self):
        """get_chat_ids_for_alert skips rows where chat_id is None."""
        db = AsyncMock()
        mock_result = MagicMock()
        mock_result.all.return_value = [("CHAT_A",), (None,), ("CHAT_B",)]
        db.execute = AsyncMock(return_value=mock_result)

        svc = TelegramSubscriptionService(db)
        result = await svc.get_chat_ids_for_alert(TelegramAlertType.daily_digest)

        assert result == ["CHAT_A", "CHAT_B"]


# ---------------------------------------------------------------------------
# _get_highest_role_key
# ---------------------------------------------------------------------------


class TestGetHighestRoleKey:
    """Test TelegramSubscriptionService._get_highest_role_key."""

    @pytest.mark.unit
    async def test_superuser_returns_superuser(self):
        """Superuser flag takes precedence over any school roles."""
        user = _make_user(is_superuser=True)
        db = AsyncMock()

        svc = TelegramSubscriptionService(db)
        result = await svc._get_highest_role_key(user)

        assert result == "superuser"

    @pytest.mark.unit
    async def test_owner_role_returns_owner(self):
        """User with OWNER school role returns 'owner'."""
        user = _make_user(is_superuser=False)
        db = AsyncMock()

        mock_result = MagicMock()
        mock_result.all.return_value = [(UserRole.OWNER,), (UserRole.SELLER,)]
        db.execute = AsyncMock(return_value=mock_result)

        svc = TelegramSubscriptionService(db)
        result = await svc._get_highest_role_key(user)

        assert result == "owner"

    @pytest.mark.unit
    async def test_admin_role_returns_admin(self):
        """User with ADMIN (but not OWNER) role returns 'admin'."""
        user = _make_user(is_superuser=False)
        db = AsyncMock()

        mock_result = MagicMock()
        mock_result.all.return_value = [(UserRole.ADMIN,), (UserRole.VIEWER,)]
        db.execute = AsyncMock(return_value=mock_result)

        svc = TelegramSubscriptionService(db)
        result = await svc._get_highest_role_key(user)

        assert result == "admin"

    @pytest.mark.unit
    async def test_seller_role_returns_seller(self):
        """User with SELLER role (no higher) returns 'seller'."""
        user = _make_user(is_superuser=False)
        db = AsyncMock()

        mock_result = MagicMock()
        mock_result.all.return_value = [(UserRole.SELLER,)]
        db.execute = AsyncMock(return_value=mock_result)

        svc = TelegramSubscriptionService(db)
        result = await svc._get_highest_role_key(user)

        assert result == "seller"

    @pytest.mark.unit
    async def test_viewer_role_returns_viewer(self):
        """User with VIEWER role returns 'viewer'."""
        user = _make_user(is_superuser=False)
        db = AsyncMock()

        mock_result = MagicMock()
        mock_result.all.return_value = [(UserRole.VIEWER,)]
        db.execute = AsyncMock(return_value=mock_result)

        svc = TelegramSubscriptionService(db)
        result = await svc._get_highest_role_key(user)

        assert result == "viewer"

    @pytest.mark.unit
    async def test_no_roles_defaults_to_viewer(self):
        """User with no school roles defaults to 'viewer'."""
        user = _make_user(is_superuser=False)
        db = AsyncMock()

        mock_result = MagicMock()
        mock_result.all.return_value = []
        db.execute = AsyncMock(return_value=mock_result)

        svc = TelegramSubscriptionService(db)
        result = await svc._get_highest_role_key(user)

        assert result == "viewer"


# ---------------------------------------------------------------------------
# DEFAULT_SUBSCRIPTIONS_BY_ROLE counts
# ---------------------------------------------------------------------------


class TestDefaultSubscriptionsByRole:
    """Verify the DEFAULT_SUBSCRIPTIONS_BY_ROLE mapping."""

    @pytest.mark.unit
    def test_owner_has_all_17_types(self):
        """Owner role subscribes to all 17 alert types."""
        assert len(DEFAULT_SUBSCRIPTIONS_BY_ROLE["owner"]) == 17

    @pytest.mark.unit
    def test_superuser_has_all_17_types(self):
        """Superuser role subscribes to all 17 alert types."""
        assert len(DEFAULT_SUBSCRIPTIONS_BY_ROLE["superuser"]) == 17

    @pytest.mark.unit
    def test_admin_has_15_types(self):
        """Admin role subscribes to 15 alert types."""
        assert len(DEFAULT_SUBSCRIPTIONS_BY_ROLE["admin"]) == 15

    @pytest.mark.unit
    def test_seller_has_6_types(self):
        """Seller role subscribes to 6 alert types."""
        assert len(DEFAULT_SUBSCRIPTIONS_BY_ROLE["seller"]) == 6

    @pytest.mark.unit
    def test_viewer_has_1_type(self):
        """Viewer role subscribes to 1 alert type (daily_digest)."""
        assert len(DEFAULT_SUBSCRIPTIONS_BY_ROLE["viewer"]) == 1
        assert TelegramAlertType.daily_digest in DEFAULT_SUBSCRIPTIONS_BY_ROLE["viewer"]

    @pytest.mark.unit
    def test_owner_is_superset_of_admin(self):
        """Owner subscriptions include all admin subscriptions."""
        owner_set = set(DEFAULT_SUBSCRIPTIONS_BY_ROLE["owner"])
        admin_set = set(DEFAULT_SUBSCRIPTIONS_BY_ROLE["admin"])
        assert admin_set.issubset(owner_set)

    @pytest.mark.unit
    def test_admin_is_superset_of_seller(self):
        """Admin subscriptions include all seller subscriptions."""
        admin_set = set(DEFAULT_SUBSCRIPTIONS_BY_ROLE["admin"])
        seller_set = set(DEFAULT_SUBSCRIPTIONS_BY_ROLE["seller"])
        assert seller_set.issubset(admin_set)

    @pytest.mark.unit
    def test_seller_is_superset_of_viewer(self):
        """Seller subscriptions include all viewer subscriptions."""
        seller_set = set(DEFAULT_SUBSCRIPTIONS_BY_ROLE["seller"])
        viewer_set = set(DEFAULT_SUBSCRIPTIONS_BY_ROLE["viewer"])
        assert viewer_set.issubset(seller_set)

    @pytest.mark.unit
    def test_all_values_are_telegram_alert_type(self):
        """All subscription entries are valid TelegramAlertType members."""
        for role, types in DEFAULT_SUBSCRIPTIONS_BY_ROLE.items():
            for t in types:
                assert isinstance(t, TelegramAlertType), (
                    f"Role '{role}' has invalid type: {t}"
                )

    @pytest.mark.unit
    def test_admin_excludes_system_health_and_weekly(self):
        """Admin role does not include system_health or reminder_weekly_summary."""
        admin_types = DEFAULT_SUBSCRIPTIONS_BY_ROLE["admin"]
        assert TelegramAlertType.system_health not in admin_types
        assert TelegramAlertType.reminder_weekly_summary not in admin_types


# ---------------------------------------------------------------------------
# _create_default_subscriptions
# ---------------------------------------------------------------------------


class TestCreateDefaultSubscriptions:
    """Test TelegramSubscriptionService._create_default_subscriptions."""

    @pytest.mark.unit
    async def test_creates_subscriptions_based_on_role(self):
        """_create_default_subscriptions adds entries per the role defaults."""
        user = _make_user(is_superuser=False)
        db = AsyncMock()
        db.add = MagicMock()

        # _get_highest_role_key returns "seller" (6 types)
        # existing subscriptions query returns empty
        mock_existing = MagicMock()
        mock_existing.all.return_value = []
        db.execute = AsyncMock(return_value=mock_existing)

        svc = TelegramSubscriptionService(db)
        svc._get_highest_role_key = AsyncMock(return_value="seller")

        await svc._create_default_subscriptions(user)

        # Should add 6 subscriptions for seller
        assert db.add.call_count == 6

    @pytest.mark.unit
    async def test_skips_already_existing_subscriptions(self):
        """_create_default_subscriptions does not duplicate existing entries."""
        user = _make_user(is_superuser=False)
        db = AsyncMock()
        db.add = MagicMock()

        # Simulate 2 existing subscriptions out of 6 seller defaults
        mock_existing = MagicMock()
        mock_existing.all.return_value = [
            (TelegramAlertType.sale_created,),
            (TelegramAlertType.low_stock,),
        ]
        db.execute = AsyncMock(return_value=mock_existing)

        svc = TelegramSubscriptionService(db)
        svc._get_highest_role_key = AsyncMock(return_value="seller")

        await svc._create_default_subscriptions(user)

        # Should only add 4 new subscriptions (6 seller - 2 existing)
        assert db.add.call_count == 4


# ---------------------------------------------------------------------------
# _get_user
# ---------------------------------------------------------------------------


class TestGetUser:
    """Test TelegramSubscriptionService._get_user."""

    @pytest.mark.unit
    async def test_get_user_returns_user(self):
        """_get_user returns the user when found."""
        user = _make_user()
        db = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = user
        db.execute = AsyncMock(return_value=mock_result)

        svc = TelegramSubscriptionService(db)
        result = await svc._get_user(user.id)

        assert result is user

    @pytest.mark.unit
    async def test_get_user_not_found_raises_value_error(self):
        """_get_user raises ValueError when user is not found."""
        db = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        db.execute = AsyncMock(return_value=mock_result)

        svc = TelegramSubscriptionService(db)

        with pytest.raises(ValueError, match="Usuario no encontrado"):
            await svc._get_user(uuid4())
