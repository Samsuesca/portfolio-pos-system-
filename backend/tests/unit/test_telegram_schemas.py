"""
Tests for Telegram alert schemas and helpers.

Covers:
- TelegramAlertType enum completeness (17 values)
- ALERT_TYPE_DESCRIPTIONS coverage (one entry per enum member)
- get_alert_category classification (event / reminder / system)
- Schema validation (TelegramLinkRequest, TelegramUpdateSubscriptions, etc.)
"""
import pytest
from pydantic import ValidationError

from app.models.telegram_subscription import TelegramAlertType
from app.schemas.telegram_alert import (
    ALERT_TYPE_DESCRIPTIONS,
    AlertTypeInfo,
    MySubscriptionsResponse,
    SubscriptionResponse,
    TelegramAdminLinkRequest,
    TelegramLinkRequest,
    TelegramUpdateSubscriptions,
    UserTelegramInfo,
    get_alert_category,
)


# ---------------------------------------------------------------------------
# TelegramAlertType enum
# ---------------------------------------------------------------------------


class TestTelegramAlertTypeEnum:
    """Verify the TelegramAlertType enum structure."""

    @pytest.mark.unit
    def test_enum_has_17_members(self):
        """TelegramAlertType has exactly 17 members."""
        assert len(TelegramAlertType) == 17

    @pytest.mark.unit
    def test_all_values_are_strings(self):
        """All enum values are non-empty strings."""
        for member in TelegramAlertType:
            assert isinstance(member.value, str)
            assert len(member.value) > 0

    @pytest.mark.unit
    def test_reactive_event_types_present(self):
        """All 10 reactive event types exist."""
        expected = [
            "sale_created",
            "web_order_created",
            "order_status_changed",
            "low_stock",
            "expense_created",
            "expense_paid",
            "wompi_payment",
            "pqrs_received",
            "attendance_alert",
            "cash_drawer_access",
        ]
        values = [m.value for m in TelegramAlertType]
        for ev in expected:
            assert ev in values, f"Missing reactive event type: {ev}"

    @pytest.mark.unit
    def test_reminder_types_present(self):
        """All 5 reminder types exist."""
        expected = [
            "reminder_close_cash",
            "reminder_pending_expenses",
            "reminder_overdue_receivables",
            "reminder_orders_ready",
            "reminder_weekly_summary",
        ]
        values = [m.value for m in TelegramAlertType]
        for r in expected:
            assert r in values, f"Missing reminder type: {r}"

    @pytest.mark.unit
    def test_system_types_present(self):
        """System and digest types exist."""
        values = [m.value for m in TelegramAlertType]
        assert "system_health" in values
        assert "daily_digest" in values

    @pytest.mark.unit
    def test_enum_members_are_unique(self):
        """No duplicate values in the enum."""
        values = [m.value for m in TelegramAlertType]
        assert len(values) == len(set(values))

    @pytest.mark.unit
    def test_enum_inherits_from_str(self):
        """TelegramAlertType members are also str instances."""
        for member in TelegramAlertType:
            assert isinstance(member, str)


# ---------------------------------------------------------------------------
# ALERT_TYPE_DESCRIPTIONS
# ---------------------------------------------------------------------------


class TestAlertTypeDescriptions:
    """Verify ALERT_TYPE_DESCRIPTIONS coverage."""

    @pytest.mark.unit
    def test_has_entry_for_each_enum_member(self):
        """ALERT_TYPE_DESCRIPTIONS has a key for every TelegramAlertType."""
        for alert_type in TelegramAlertType:
            assert alert_type in ALERT_TYPE_DESCRIPTIONS, (
                f"Missing description for {alert_type.value}"
            )

    @pytest.mark.unit
    def test_descriptions_are_nonempty_strings(self):
        """Each description is a non-empty string."""
        for alert_type, desc in ALERT_TYPE_DESCRIPTIONS.items():
            assert isinstance(desc, str), f"Description for {alert_type} is not a string"
            assert len(desc) > 0, f"Description for {alert_type} is empty"

    @pytest.mark.unit
    def test_no_extra_keys(self):
        """ALERT_TYPE_DESCRIPTIONS has exactly 17 entries (no orphans)."""
        assert len(ALERT_TYPE_DESCRIPTIONS) == 17

    @pytest.mark.unit
    def test_descriptions_in_spanish(self):
        """Descriptions are in Spanish (spot-check a few)."""
        assert "venta" in ALERT_TYPE_DESCRIPTIONS[TelegramAlertType.sale_created].lower()
        assert "pedido" in ALERT_TYPE_DESCRIPTIONS[TelegramAlertType.web_order_created].lower()
        assert "inventario" in ALERT_TYPE_DESCRIPTIONS[TelegramAlertType.low_stock].lower()


# ---------------------------------------------------------------------------
# get_alert_category
# ---------------------------------------------------------------------------


class TestGetAlertCategory:
    """Test get_alert_category classification."""

    @pytest.mark.unit
    @pytest.mark.parametrize(
        "alert_type",
        [
            TelegramAlertType.sale_created,
            TelegramAlertType.web_order_created,
            TelegramAlertType.order_status_changed,
            TelegramAlertType.low_stock,
            TelegramAlertType.expense_created,
            TelegramAlertType.expense_paid,
            TelegramAlertType.wompi_payment,
            TelegramAlertType.pqrs_received,
            TelegramAlertType.attendance_alert,
            TelegramAlertType.cash_drawer_access,
        ],
    )
    def test_event_types_classified_as_event(self, alert_type):
        """Reactive business events are classified as 'event'."""
        assert get_alert_category(alert_type) == "event"

    @pytest.mark.unit
    @pytest.mark.parametrize(
        "alert_type",
        [
            TelegramAlertType.reminder_close_cash,
            TelegramAlertType.reminder_pending_expenses,
            TelegramAlertType.reminder_overdue_receivables,
            TelegramAlertType.reminder_orders_ready,
            TelegramAlertType.reminder_weekly_summary,
        ],
    )
    def test_reminder_types_classified_as_reminder(self, alert_type):
        """Scheduled reminders are classified as 'reminder'."""
        assert get_alert_category(alert_type) == "reminder"

    @pytest.mark.unit
    @pytest.mark.parametrize(
        "alert_type",
        [
            TelegramAlertType.system_health,
            TelegramAlertType.daily_digest,
        ],
    )
    def test_system_types_classified_as_system(self, alert_type):
        """System health and digest are classified as 'system'."""
        assert get_alert_category(alert_type) == "system"

    @pytest.mark.unit
    def test_all_types_have_valid_category(self):
        """Every alert type is classified into one of three categories."""
        valid_categories = {"event", "reminder", "system"}
        for alert_type in TelegramAlertType:
            category = get_alert_category(alert_type)
            assert category in valid_categories, (
                f"Alert type {alert_type.value} has invalid category: {category}"
            )


# ---------------------------------------------------------------------------
# TelegramLinkRequest schema
# ---------------------------------------------------------------------------


class TestTelegramLinkRequest:
    """Test TelegramLinkRequest validation."""

    @pytest.mark.unit
    def test_valid_chat_id(self):
        """Accepts a valid chat_id string."""
        req = TelegramLinkRequest(chat_id="123456789")
        assert req.chat_id == "123456789"

    @pytest.mark.unit
    def test_empty_chat_id_rejected(self):
        """Rejects empty chat_id."""
        with pytest.raises(ValidationError):
            TelegramLinkRequest(chat_id="")

    @pytest.mark.unit
    def test_whitespace_only_chat_id_rejected(self):
        """Rejects whitespace-only chat_id (stripped to empty)."""
        with pytest.raises(ValidationError):
            TelegramLinkRequest(chat_id="   ")

    @pytest.mark.unit
    def test_chat_id_max_length_50(self):
        """Rejects chat_id exceeding 50 characters."""
        with pytest.raises(ValidationError):
            TelegramLinkRequest(chat_id="x" * 51)

    @pytest.mark.unit
    def test_chat_id_exactly_50_characters_accepted(self):
        """Accepts chat_id of exactly 50 characters."""
        req = TelegramLinkRequest(chat_id="x" * 50)
        assert len(req.chat_id) == 50

    @pytest.mark.unit
    def test_missing_chat_id_rejected(self):
        """Rejects request with missing chat_id field."""
        with pytest.raises(ValidationError):
            TelegramLinkRequest()

    @pytest.mark.unit
    def test_negative_chat_id_string_accepted(self):
        """Negative chat_id strings (common for groups) are accepted."""
        req = TelegramLinkRequest(chat_id="-1001234567890")
        assert req.chat_id == "-1001234567890"


# ---------------------------------------------------------------------------
# TelegramUpdateSubscriptions schema
# ---------------------------------------------------------------------------


class TestTelegramUpdateSubscriptions:
    """Test TelegramUpdateSubscriptions validation."""

    @pytest.mark.unit
    def test_valid_alert_types_list(self):
        """Accepts a list of valid alert type values."""
        req = TelegramUpdateSubscriptions(
            alert_types=["sale_created", "daily_digest"]
        )
        assert len(req.alert_types) == 2

    @pytest.mark.unit
    def test_empty_list_accepted(self):
        """Accepts an empty list (unsubscribe from everything)."""
        req = TelegramUpdateSubscriptions(alert_types=[])
        assert req.alert_types == []

    @pytest.mark.unit
    def test_invalid_alert_type_rejected(self):
        """Rejects unknown alert type values."""
        with pytest.raises(ValidationError):
            TelegramUpdateSubscriptions(
                alert_types=["sale_created", "nonexistent_type"]
            )

    @pytest.mark.unit
    def test_all_17_types_accepted(self):
        """Accepts a list with all 17 alert types."""
        all_types = [t.value for t in TelegramAlertType]
        req = TelegramUpdateSubscriptions(alert_types=all_types)
        assert len(req.alert_types) == 17

    @pytest.mark.unit
    def test_missing_alert_types_rejected(self):
        """Rejects request with missing alert_types field."""
        with pytest.raises(ValidationError):
            TelegramUpdateSubscriptions()


# ---------------------------------------------------------------------------
# TelegramAdminLinkRequest schema
# ---------------------------------------------------------------------------


class TestTelegramAdminLinkRequest:
    """Test TelegramAdminLinkRequest validation."""

    @pytest.mark.unit
    def test_valid_chat_id(self):
        """Accepts a valid chat_id."""
        req = TelegramAdminLinkRequest(chat_id="987654321")
        assert req.chat_id == "987654321"

    @pytest.mark.unit
    def test_empty_chat_id_rejected(self):
        """Rejects empty chat_id."""
        with pytest.raises(ValidationError):
            TelegramAdminLinkRequest(chat_id="")

    @pytest.mark.unit
    def test_max_length_enforced(self):
        """Rejects chat_id exceeding 50 characters."""
        with pytest.raises(ValidationError):
            TelegramAdminLinkRequest(chat_id="a" * 51)


# ---------------------------------------------------------------------------
# Response schemas (structural validation)
# ---------------------------------------------------------------------------


class TestResponseSchemas:
    """Test response schema construction."""

    @pytest.mark.unit
    def test_subscription_response(self):
        """SubscriptionResponse accepts valid data."""
        resp = SubscriptionResponse(
            alert_type="sale_created",
            description="Nueva venta registrada",
            is_active=True,
        )
        assert resp.alert_type == "sale_created"
        assert resp.is_active is True

    @pytest.mark.unit
    def test_alert_type_info(self):
        """AlertTypeInfo accepts valid data."""
        info = AlertTypeInfo(
            alert_type="low_stock",
            description="Alerta de inventario bajo",
            category="event",
        )
        assert info.category == "event"

    @pytest.mark.unit
    def test_my_subscriptions_response_linked(self):
        """MySubscriptionsResponse for a linked user."""
        resp = MySubscriptionsResponse(
            is_linked=True,
            telegram_chat_id="12345",
            subscriptions=[
                SubscriptionResponse(
                    alert_type="sale_created",
                    description="desc",
                    is_active=True,
                ),
            ],
        )
        assert resp.is_linked is True
        assert resp.telegram_chat_id == "12345"
        assert len(resp.subscriptions) == 1

    @pytest.mark.unit
    def test_my_subscriptions_response_unlinked(self):
        """MySubscriptionsResponse for an unlinked user."""
        resp = MySubscriptionsResponse(
            is_linked=False,
            telegram_chat_id=None,
            subscriptions=[],
        )
        assert resp.is_linked is False
        assert resp.telegram_chat_id is None

    @pytest.mark.unit
    def test_user_telegram_info(self):
        """UserTelegramInfo accepts valid admin-view data."""
        from uuid import uuid4

        uid = uuid4()
        info = UserTelegramInfo(
            user_id=uid,
            username="admin",
            full_name="Admin User",
            is_linked=True,
            telegram_chat_id="99999",
            subscriptions=[],
        )
        assert info.user_id == uid
        assert info.username == "admin"
        assert info.is_linked is True
