"""Telegram alerting service for Uniformes System monitoring."""

import asyncio
import logging
import time

import httpx

from app.core.config import settings

logger = logging.getLogger("telegram")

TELEGRAM_API = "https://api.telegram.org/bot{token}/sendMessage"
COOLDOWN_SECONDS = 300  # 5 minutes default

# Cooldown tracking: alert_type -> last_sent_monotonic
_cooldowns: dict[str, float] = {}


class TelegramService:
    """Send alerts to a Telegram group. No-ops if bot token or chat ID is empty."""

    def __init__(self) -> None:
        self._enabled = (
            settings.ENV == "production"
            and bool(settings.TELEGRAM_BOT_TOKEN and settings.TELEGRAM_CHAT_ID)
        )
        self._token = settings.TELEGRAM_BOT_TOKEN or ""
        self._chat_id = settings.TELEGRAM_CHAT_ID or ""
        self._url = TELEGRAM_API.format(token=self._token) if self._enabled else ""

    @property
    def enabled(self) -> bool:
        return self._enabled

    async def send_alert(
        self,
        message: str,
        *,
        alert_type: str = "general",
        cooldown: int = COOLDOWN_SECONDS,
        parse_mode: str = "HTML",
    ) -> bool:
        """Send a message to the configured Telegram chat.

        Uses cooldown to prevent spam: same alert_type won't fire
        again within ``cooldown`` seconds.
        """
        if not self._enabled:
            logger.debug("Telegram skipped: not configured")
            return False

        now = time.monotonic()
        if now - _cooldowns.get(alert_type, 0) < cooldown:
            logger.debug("Telegram cooldown active for %s", alert_type)
            return False

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(
                    self._url,
                    json={
                        "chat_id": self._chat_id,
                        "text": message,
                        "parse_mode": parse_mode,
                        "disable_web_page_preview": True,
                    },
                )
                resp.raise_for_status()

            _cooldowns[alert_type] = now
            logger.info("Telegram alert sent: %s", alert_type)
            return True

        except Exception as e:
            logger.error("Telegram alert failed (%s): %s", alert_type, e)
            return False


# ── Singleton ────────────────────────────────────────────────────
_service: TelegramService | None = None


def get_telegram_service() -> TelegramService:
    global _service
    if _service is None:
        _service = TelegramService()
    return _service


# ── Fire-and-forget helpers ──────────────────────────────────────


def _send_sync(message: str, alert_type: str) -> None:
    """Synchronous fallback for threads without an event loop."""
    svc = get_telegram_service()
    if not svc.enabled:
        return
    try:
        httpx.post(
            svc._url,
            json={
                "chat_id": svc._chat_id,
                "text": message,
                "parse_mode": "HTML",
                "disable_web_page_preview": True,
            },
            timeout=5.0,
        )
        _cooldowns[alert_type] = time.monotonic()
    except Exception as e:
        logger.error("Telegram sync fallback failed (%s): %s", alert_type, e)


def fire_and_forget_alert(
    message: str,
    *,
    alert_type: str = "general",
    cooldown: int = COOLDOWN_SECONDS,
) -> None:
    """Schedule a Telegram alert without blocking the caller.

    Works from both async (FastAPI handlers) and sync (SQLAlchemy event
    listener threads) contexts.
    """
    now = time.monotonic()
    if now - _cooldowns.get(alert_type, 0) < cooldown:
        return

    try:
        loop = asyncio.get_running_loop()
        loop.create_task(
            get_telegram_service().send_alert(
                message, alert_type=alert_type, cooldown=0
            )
        )
    except RuntimeError:
        # No running event loop — sync fallback
        _send_sync(message, alert_type)


# ── Routed alerts (per-user subscriptions) ───────────────────────


async def _send_to_chat(chat_id: str, message: str) -> bool:
    """Send a message to a specific Telegram chat_id."""
    svc = get_telegram_service()
    if not svc.enabled:
        return False
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                svc._url,
                json={
                    "chat_id": chat_id,
                    "text": message,
                    "parse_mode": "HTML",
                    "disable_web_page_preview": True,
                },
            )
            resp.raise_for_status()
        return True
    except Exception as e:
        logger.error("Telegram send_to_chat(%s) failed: %s", chat_id, e)
        return False


async def route_alert(
    alert_type: str,
    message: str,
) -> None:
    """Send alert to the group chat AND to all users subscribed to alert_type.

    Requires a DB session to look up subscriptions, so it opens its own.
    """
    from app.db.session import AsyncSessionLocal
    from app.models.telegram_subscription import TelegramAlertType
    from app.services.telegram_subscriptions import TelegramSubscriptionService

    svc = get_telegram_service()

    # Always send to group chat (existing behavior)
    if svc.enabled:
        await svc.send_alert(message, alert_type=f"routed_{alert_type}", cooldown=0)

    # Route to individual subscribers
    try:
        tg_alert_type = TelegramAlertType(alert_type)
    except ValueError:
        logger.debug("Unknown alert type for routing: %s", alert_type)
        return

    try:
        async with AsyncSessionLocal() as db:
            sub_service = TelegramSubscriptionService(db)
            chat_ids = await sub_service.get_chat_ids_for_alert(tg_alert_type)

        # Send to each subscriber (skip group chat_id to avoid duplicates)
        group_chat_id = svc._chat_id
        for cid in chat_ids:
            if cid != group_chat_id:
                await _send_to_chat(cid, message)

    except Exception as e:
        logger.error("route_alert(%s) failed: %s", alert_type, e)


def fire_and_forget_routed_alert(
    alert_type: str,
    message: str,
) -> None:
    """Schedule a routed alert without blocking the caller.

    Sends to group + all subscribed users' private chats.
    """
    svc = get_telegram_service()
    if not svc.enabled:
        return

    try:
        loop = asyncio.get_running_loop()
        loop.create_task(route_alert(alert_type, message))
    except RuntimeError:
        # No event loop — just send to group as fallback
        _send_sync(message, alert_type)
