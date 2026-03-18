"""
Tests for TelegramService, fire_and_forget helpers, and routed alerts.

Covers:
- TelegramService initialization (enabled/disabled based on ENV + token + chat_id)
- send_alert: message delivery, cooldown enforcement, disabled no-op
- fire_and_forget_alert: async task scheduling, cooldown gating
- route_alert: group + individual subscriber delivery
- fire_and_forget_routed_alert: async scheduling for routed alerts
- _send_to_chat: direct delivery to a specific chat_id
"""
import asyncio
import importlib
import time

import pytest
from unittest.mock import AsyncMock, MagicMock, patch, PropertyMock

import httpx


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_settings(**overrides) -> MagicMock:
    """Create a mock settings object with sensible defaults."""
    defaults = {
        "ENV": "production",
        "TELEGRAM_BOT_TOKEN": "123456:ABC-FAKE-TOKEN",
        "TELEGRAM_CHAT_ID": "-1001234567890",
    }
    defaults.update(overrides)
    mock = MagicMock()
    for k, v in defaults.items():
        setattr(mock, k, v)
    return mock


def _reset_telegram_module():
    """Reset module-level singleton and cooldown state."""
    import app.services.telegram as tg_mod

    tg_mod._service = None
    tg_mod._cooldowns.clear()


def _mock_httpx_client(mock_post: AsyncMock) -> MagicMock:
    """Create a mock httpx.AsyncClient that works as an async context manager.

    The source code uses `async with httpx.AsyncClient(...) as client:`
    so we need to mock both the constructor and the async context manager.
    """
    mock_client_instance = AsyncMock()
    mock_client_instance.post = mock_post
    mock_client_instance.__aenter__ = AsyncMock(return_value=mock_client_instance)
    mock_client_instance.__aexit__ = AsyncMock(return_value=False)

    mock_client_class = MagicMock(return_value=mock_client_instance)
    return mock_client_class


# ---------------------------------------------------------------------------
# TelegramService.__init__ / enabled property
# ---------------------------------------------------------------------------


class TestTelegramServiceInit:
    """Test TelegramService initialization logic."""

    @pytest.mark.unit
    def test_enabled_when_production_with_token_and_chat_id(self):
        """Service is enabled when ENV=production + token + chat_id are set."""
        with patch("app.services.telegram.settings", _make_settings()):
            _reset_telegram_module()
            from app.services.telegram import TelegramService

            svc = TelegramService()
            assert svc.enabled is True
            assert svc._url != ""

    @pytest.mark.unit
    def test_disabled_when_not_production(self):
        """Service is disabled when ENV != production."""
        with patch("app.services.telegram.settings", _make_settings(ENV="development")):
            _reset_telegram_module()
            from app.services.telegram import TelegramService

            svc = TelegramService()
            assert svc.enabled is False

    @pytest.mark.unit
    def test_disabled_when_token_missing(self):
        """Service is disabled when TELEGRAM_BOT_TOKEN is empty."""
        with patch(
            "app.services.telegram.settings",
            _make_settings(TELEGRAM_BOT_TOKEN=""),
        ):
            _reset_telegram_module()
            from app.services.telegram import TelegramService

            svc = TelegramService()
            assert svc.enabled is False

    @pytest.mark.unit
    def test_disabled_when_chat_id_missing(self):
        """Service is disabled when TELEGRAM_CHAT_ID is empty."""
        with patch(
            "app.services.telegram.settings",
            _make_settings(TELEGRAM_CHAT_ID=""),
        ):
            _reset_telegram_module()
            from app.services.telegram import TelegramService

            svc = TelegramService()
            assert svc.enabled is False

    @pytest.mark.unit
    def test_disabled_when_token_is_none(self):
        """Service is disabled when TELEGRAM_BOT_TOKEN is None."""
        with patch(
            "app.services.telegram.settings",
            _make_settings(TELEGRAM_BOT_TOKEN=None),
        ):
            _reset_telegram_module()
            from app.services.telegram import TelegramService

            svc = TelegramService()
            assert svc.enabled is False

    @pytest.mark.unit
    def test_disabled_when_chat_id_is_none(self):
        """Service is disabled when TELEGRAM_CHAT_ID is None."""
        with patch(
            "app.services.telegram.settings",
            _make_settings(TELEGRAM_CHAT_ID=None),
        ):
            _reset_telegram_module()
            from app.services.telegram import TelegramService

            svc = TelegramService()
            assert svc.enabled is False

    @pytest.mark.unit
    def test_url_contains_token_when_enabled(self):
        """The API URL is built with the bot token when enabled."""
        token = "111222:XYZ"
        with patch("app.services.telegram.settings", _make_settings(TELEGRAM_BOT_TOKEN=token)):
            _reset_telegram_module()
            from app.services.telegram import TelegramService

            svc = TelegramService()
            assert token in svc._url


# ---------------------------------------------------------------------------
# send_alert
# ---------------------------------------------------------------------------


class TestSendAlert:
    """Test TelegramService.send_alert method."""

    @pytest.mark.unit
    async def test_send_alert_success_returns_true(self):
        """send_alert returns True and posts to Telegram API on success."""
        _reset_telegram_module()

        mock_response = MagicMock()
        mock_response.raise_for_status = MagicMock()
        mock_post = AsyncMock(return_value=mock_response)
        mock_client_class = _mock_httpx_client(mock_post)

        with (
            patch("app.services.telegram.settings", _make_settings()),
            patch("app.services.telegram.httpx.AsyncClient", mock_client_class),
        ):
            from app.services.telegram import TelegramService

            svc = TelegramService()
            result = await svc.send_alert("Test message", alert_type="test_ok")

            assert result is True
            mock_post.assert_called_once()

    @pytest.mark.unit
    async def test_send_alert_disabled_returns_false(self):
        """send_alert returns False immediately when service is disabled."""
        with patch(
            "app.services.telegram.settings",
            _make_settings(ENV="development"),
        ):
            _reset_telegram_module()
            from app.services.telegram import TelegramService

            svc = TelegramService()
            result = await svc.send_alert("Should not send")
            assert result is False

    @pytest.mark.unit
    async def test_send_alert_cooldown_prevents_resend(self):
        """Same alert_type within cooldown window returns False."""
        import app.services.telegram as tg_mod

        _reset_telegram_module()

        mock_response = MagicMock()
        mock_response.raise_for_status = MagicMock()
        mock_post = AsyncMock(return_value=mock_response)
        mock_client_class = _mock_httpx_client(mock_post)

        with (
            patch("app.services.telegram.settings", _make_settings()),
            patch("app.services.telegram.httpx.AsyncClient", mock_client_class),
        ):
            svc = tg_mod.TelegramService()

            # First call succeeds
            result1 = await svc.send_alert("msg1", alert_type="cd_test", cooldown=300)
            assert result1 is True

            # Second call within cooldown is blocked
            result2 = await svc.send_alert("msg2", alert_type="cd_test", cooldown=300)
            assert result2 is False

    @pytest.mark.unit
    async def test_send_alert_different_types_bypass_cooldown(self):
        """Different alert_type values have independent cooldowns."""
        import app.services.telegram as tg_mod

        _reset_telegram_module()

        mock_response = MagicMock()
        mock_response.raise_for_status = MagicMock()
        mock_post = AsyncMock(return_value=mock_response)
        mock_client_class = _mock_httpx_client(mock_post)

        with (
            patch("app.services.telegram.settings", _make_settings()),
            patch("app.services.telegram.httpx.AsyncClient", mock_client_class),
        ):
            svc = tg_mod.TelegramService()

            r1 = await svc.send_alert("msg1", alert_type="type_a", cooldown=300)
            r2 = await svc.send_alert("msg2", alert_type="type_b", cooldown=300)
            assert r1 is True
            assert r2 is True

    @pytest.mark.unit
    async def test_send_alert_zero_cooldown_always_sends(self):
        """cooldown=0 effectively disables cooldown gating."""
        import app.services.telegram as tg_mod

        _reset_telegram_module()

        mock_response = MagicMock()
        mock_response.raise_for_status = MagicMock()
        mock_post = AsyncMock(return_value=mock_response)
        mock_client_class = _mock_httpx_client(mock_post)

        with (
            patch("app.services.telegram.settings", _make_settings()),
            patch("app.services.telegram.httpx.AsyncClient", mock_client_class),
        ):
            svc = tg_mod.TelegramService()

            r1 = await svc.send_alert("msg1", alert_type="zero_cd", cooldown=0)
            r2 = await svc.send_alert("msg2", alert_type="zero_cd", cooldown=0)
            assert r1 is True
            assert r2 is True

    @pytest.mark.unit
    async def test_send_alert_http_error_returns_false(self):
        """send_alert returns False when Telegram API returns an HTTP error."""
        _reset_telegram_module()

        mock_post = AsyncMock(
            side_effect=httpx.HTTPStatusError(
                "Bad Request",
                request=MagicMock(),
                response=MagicMock(status_code=400),
            )
        )
        mock_client_class = _mock_httpx_client(mock_post)

        with (
            patch("app.services.telegram.settings", _make_settings()),
            patch("app.services.telegram.httpx.AsyncClient", mock_client_class),
        ):
            from app.services.telegram import TelegramService

            svc = TelegramService()
            result = await svc.send_alert("fail", alert_type="http_err")
            assert result is False

    @pytest.mark.unit
    async def test_send_alert_network_error_returns_false(self):
        """send_alert returns False on network connectivity issues."""
        _reset_telegram_module()

        mock_post = AsyncMock(
            side_effect=httpx.ConnectError("Connection refused")
        )
        mock_client_class = _mock_httpx_client(mock_post)

        with (
            patch("app.services.telegram.settings", _make_settings()),
            patch("app.services.telegram.httpx.AsyncClient", mock_client_class),
        ):
            from app.services.telegram import TelegramService

            svc = TelegramService()
            result = await svc.send_alert("fail", alert_type="net_err")
            assert result is False

    @pytest.mark.unit
    async def test_send_alert_passes_correct_payload(self):
        """send_alert sends the correct JSON payload to Telegram."""
        _reset_telegram_module()

        mock_response = MagicMock()
        mock_response.raise_for_status = MagicMock()
        mock_post = AsyncMock(return_value=mock_response)
        mock_client_class = _mock_httpx_client(mock_post)

        with (
            patch("app.services.telegram.settings", _make_settings()),
            patch("app.services.telegram.httpx.AsyncClient", mock_client_class),
        ):
            from app.services.telegram import TelegramService

            svc = TelegramService()
            await svc.send_alert("<b>Hello</b>", alert_type="payload_test")

            mock_post.assert_called_once()
            call_kwargs = mock_post.call_args
            payload = call_kwargs.kwargs.get("json") or call_kwargs[1].get("json")
            assert payload["chat_id"] == "-1001234567890"
            assert payload["text"] == "<b>Hello</b>"
            assert payload["parse_mode"] == "HTML"
            assert payload["disable_web_page_preview"] is True


# ---------------------------------------------------------------------------
# fire_and_forget_alert
# ---------------------------------------------------------------------------


class TestFireAndForgetAlert:
    """Test the fire_and_forget_alert helper."""

    @pytest.mark.unit
    async def test_fire_and_forget_creates_task_in_running_loop(self):
        """Schedules an async task when an event loop is running."""
        import app.services.telegram as tg_mod

        _reset_telegram_module()

        mock_svc = MagicMock()
        mock_svc.enabled = True
        mock_svc.send_alert = AsyncMock(return_value=True)

        with patch.object(tg_mod, "get_telegram_service", return_value=mock_svc):
            tg_mod.fire_and_forget_alert("test msg", alert_type="ff_test", cooldown=0)
            # Let the event loop process the created task
            await asyncio.sleep(0.05)

            mock_svc.send_alert.assert_called_once_with(
                "test msg", alert_type="ff_test", cooldown=0
            )

    @pytest.mark.unit
    async def test_fire_and_forget_respects_cooldown(self):
        """fire_and_forget_alert skips when cooldown is active."""
        import app.services.telegram as tg_mod

        _reset_telegram_module()

        # Simulate a recent send
        tg_mod._cooldowns["cd_ff"] = time.monotonic()

        mock_svc = MagicMock()
        mock_svc.enabled = True
        mock_svc.send_alert = AsyncMock()

        with patch.object(tg_mod, "get_telegram_service", return_value=mock_svc):
            tg_mod.fire_and_forget_alert("msg", alert_type="cd_ff", cooldown=300)
            await asyncio.sleep(0.05)

            mock_svc.send_alert.assert_not_called()


# ---------------------------------------------------------------------------
# _send_to_chat
# ---------------------------------------------------------------------------


class TestSendToChat:
    """Test the _send_to_chat helper."""

    @pytest.mark.unit
    async def test_send_to_chat_success(self):
        """_send_to_chat returns True on successful delivery."""
        import app.services.telegram as tg_mod

        _reset_telegram_module()

        mock_svc = MagicMock()
        mock_svc.enabled = True
        mock_svc._url = "https://api.telegram.org/bot123/sendMessage"

        mock_resp = MagicMock()
        mock_resp.raise_for_status = MagicMock()
        mock_post = AsyncMock(return_value=mock_resp)
        mock_client_class = _mock_httpx_client(mock_post)

        with (
            patch.object(tg_mod, "get_telegram_service", return_value=mock_svc),
            patch("app.services.telegram.httpx.AsyncClient", mock_client_class),
        ):
            result = await tg_mod._send_to_chat("99999", "<b>Hi</b>")
            assert result is True

    @pytest.mark.unit
    async def test_send_to_chat_disabled_returns_false(self):
        """_send_to_chat returns False when service is disabled."""
        import app.services.telegram as tg_mod

        _reset_telegram_module()

        mock_svc = MagicMock()
        mock_svc.enabled = False

        with patch.object(tg_mod, "get_telegram_service", return_value=mock_svc):
            result = await tg_mod._send_to_chat("99999", "msg")
            assert result is False

    @pytest.mark.unit
    async def test_send_to_chat_error_returns_false(self):
        """_send_to_chat returns False on HTTP exception."""
        import app.services.telegram as tg_mod

        _reset_telegram_module()

        mock_svc = MagicMock()
        mock_svc.enabled = True
        mock_svc._url = "https://api.telegram.org/bot123/sendMessage"

        mock_post = AsyncMock(
            side_effect=httpx.HTTPStatusError(
                "Forbidden", request=MagicMock(), response=MagicMock(status_code=403)
            )
        )
        mock_client_class = _mock_httpx_client(mock_post)

        with (
            patch.object(tg_mod, "get_telegram_service", return_value=mock_svc),
            patch("app.services.telegram.httpx.AsyncClient", mock_client_class),
        ):
            result = await tg_mod._send_to_chat("99999", "msg")
            assert result is False

    @pytest.mark.unit
    async def test_send_to_chat_sends_to_correct_chat_id(self):
        """_send_to_chat posts to the specified chat_id, not the group."""
        import app.services.telegram as tg_mod

        _reset_telegram_module()

        mock_svc = MagicMock()
        mock_svc.enabled = True
        mock_svc._url = "https://api.telegram.org/bot123/sendMessage"

        mock_resp = MagicMock()
        mock_resp.raise_for_status = MagicMock()
        mock_post = AsyncMock(return_value=mock_resp)
        mock_client_class = _mock_httpx_client(mock_post)

        with (
            patch.object(tg_mod, "get_telegram_service", return_value=mock_svc),
            patch("app.services.telegram.httpx.AsyncClient", mock_client_class),
        ):
            await tg_mod._send_to_chat("PRIVATE_123", "<b>DM</b>")

            payload = mock_post.call_args.kwargs.get("json") or mock_post.call_args[1].get("json")
            assert payload["chat_id"] == "PRIVATE_123"
            assert payload["text"] == "<b>DM</b>"


# ---------------------------------------------------------------------------
# route_alert
# ---------------------------------------------------------------------------


class TestRouteAlert:
    """Test the route_alert function."""

    @pytest.mark.unit
    async def test_route_alert_sends_to_group_and_subscribers(self):
        """route_alert sends to group chat and each subscriber's private chat."""
        import app.services.telegram as tg_mod

        _reset_telegram_module()

        mock_svc = MagicMock()
        mock_svc.enabled = True
        mock_svc._chat_id = "-100GROUP"
        mock_svc.send_alert = AsyncMock(return_value=True)

        mock_sub_service = AsyncMock()
        mock_sub_service.get_chat_ids_for_alert = AsyncMock(
            return_value=["-100GROUP", "USER_A", "USER_B"]
        )

        mock_session = AsyncMock()
        mock_session.__aenter__ = AsyncMock(return_value=mock_session)
        mock_session.__aexit__ = AsyncMock(return_value=False)

        with (
            patch.object(tg_mod, "get_telegram_service", return_value=mock_svc),
            patch("app.db.session.AsyncSessionLocal", return_value=mock_session),
            patch(
                "app.services.telegram_subscriptions.TelegramSubscriptionService",
                return_value=mock_sub_service,
            ),
            patch.object(tg_mod, "_send_to_chat", new_callable=AsyncMock) as mock_send,
        ):
            await tg_mod.route_alert("sale_created", "<b>Sale!</b>")

            # Group message via send_alert
            mock_svc.send_alert.assert_called_once()

            # Individual messages: skip group chat_id, send to USER_A and USER_B
            assert mock_send.call_count == 2
            sent_chat_ids = [call.args[0] for call in mock_send.call_args_list]
            assert "USER_A" in sent_chat_ids
            assert "USER_B" in sent_chat_ids
            assert "-100GROUP" not in sent_chat_ids

    @pytest.mark.unit
    async def test_route_alert_skips_individual_for_unknown_alert_type(self):
        """route_alert only sends to group if alert_type is not in TelegramAlertType."""
        import app.services.telegram as tg_mod

        _reset_telegram_module()

        mock_svc = MagicMock()
        mock_svc.enabled = True
        mock_svc._chat_id = "-100GROUP"
        mock_svc.send_alert = AsyncMock(return_value=True)

        with (
            patch.object(tg_mod, "get_telegram_service", return_value=mock_svc),
            patch.object(tg_mod, "_send_to_chat", new_callable=AsyncMock) as mock_send,
        ):
            await tg_mod.route_alert("nonexistent_type", "msg")

            # Group send still happens
            mock_svc.send_alert.assert_called_once()
            # No individual sends since type is unknown
            mock_send.assert_not_called()

    @pytest.mark.unit
    async def test_route_alert_disabled_service_does_not_send_group(self):
        """route_alert skips group send when service is disabled."""
        import app.services.telegram as tg_mod

        _reset_telegram_module()

        mock_svc = MagicMock()
        mock_svc.enabled = False
        mock_svc._chat_id = "-100GROUP"
        mock_svc.send_alert = AsyncMock()

        mock_sub_service = AsyncMock()
        mock_sub_service.get_chat_ids_for_alert = AsyncMock(return_value=[])

        mock_session = AsyncMock()
        mock_session.__aenter__ = AsyncMock(return_value=mock_session)
        mock_session.__aexit__ = AsyncMock(return_value=False)

        with (
            patch.object(tg_mod, "get_telegram_service", return_value=mock_svc),
            patch("app.db.session.AsyncSessionLocal", return_value=mock_session),
            patch(
                "app.services.telegram_subscriptions.TelegramSubscriptionService",
                return_value=mock_sub_service,
            ),
        ):
            await tg_mod.route_alert("sale_created", "msg")
            mock_svc.send_alert.assert_not_called()

    @pytest.mark.unit
    async def test_route_alert_no_subscribers_only_sends_to_group(self):
        """route_alert only sends to group when no individual subscribers exist."""
        import app.services.telegram as tg_mod

        _reset_telegram_module()

        mock_svc = MagicMock()
        mock_svc.enabled = True
        mock_svc._chat_id = "-100GROUP"
        mock_svc.send_alert = AsyncMock(return_value=True)

        mock_sub_service = AsyncMock()
        mock_sub_service.get_chat_ids_for_alert = AsyncMock(return_value=[])

        mock_session = AsyncMock()
        mock_session.__aenter__ = AsyncMock(return_value=mock_session)
        mock_session.__aexit__ = AsyncMock(return_value=False)

        with (
            patch.object(tg_mod, "get_telegram_service", return_value=mock_svc),
            patch("app.db.session.AsyncSessionLocal", return_value=mock_session),
            patch(
                "app.services.telegram_subscriptions.TelegramSubscriptionService",
                return_value=mock_sub_service,
            ),
            patch.object(tg_mod, "_send_to_chat", new_callable=AsyncMock) as mock_send,
        ):
            await tg_mod.route_alert("sale_created", "msg")
            mock_svc.send_alert.assert_called_once()
            mock_send.assert_not_called()


# ---------------------------------------------------------------------------
# fire_and_forget_routed_alert
# ---------------------------------------------------------------------------


class TestFireAndForgetRoutedAlert:
    """Test the fire_and_forget_routed_alert helper."""

    @pytest.mark.unit
    async def test_fire_and_forget_routed_creates_task(self):
        """fire_and_forget_routed_alert schedules route_alert as async task."""
        import app.services.telegram as tg_mod

        _reset_telegram_module()

        mock_svc = MagicMock()
        mock_svc.enabled = True

        with (
            patch.object(tg_mod, "get_telegram_service", return_value=mock_svc),
            patch.object(tg_mod, "route_alert", new_callable=AsyncMock) as mock_route,
        ):
            tg_mod.fire_and_forget_routed_alert("sale_created", "msg")
            await asyncio.sleep(0.05)

            mock_route.assert_called_once_with("sale_created", "msg")

    @pytest.mark.unit
    async def test_fire_and_forget_routed_disabled_is_noop(self):
        """fire_and_forget_routed_alert does nothing when service is disabled."""
        import app.services.telegram as tg_mod

        _reset_telegram_module()

        mock_svc = MagicMock()
        mock_svc.enabled = False

        with (
            patch.object(tg_mod, "get_telegram_service", return_value=mock_svc),
            patch.object(tg_mod, "route_alert", new_callable=AsyncMock) as mock_route,
        ):
            tg_mod.fire_and_forget_routed_alert("sale_created", "msg")
            await asyncio.sleep(0.05)

            mock_route.assert_not_called()


# ---------------------------------------------------------------------------
# get_telegram_service singleton
# ---------------------------------------------------------------------------


class TestGetTelegramServiceSingleton:
    """Test singleton behavior of get_telegram_service."""

    @pytest.mark.unit
    def test_returns_same_instance_on_repeated_calls(self):
        """get_telegram_service returns the same TelegramService instance."""
        import app.services.telegram as tg_mod

        _reset_telegram_module()

        with patch("app.services.telegram.settings", _make_settings(ENV="development")):
            svc1 = tg_mod.get_telegram_service()
            svc2 = tg_mod.get_telegram_service()
            assert svc1 is svc2
