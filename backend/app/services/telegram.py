"""Telegram alerting service for Uniformes System.

Architecture:
    TelegramService (singleton) → send_alert / send_to_chat
    fire_and_forget_alert       → non-blocking wrapper for async/sync callers
    route_alert                 → fan-out to group chat + per-user subscribers
    fire_and_forget_routed_alert→ non-blocking wrapper for routed alerts

The service is designed for graceful degradation: if TELEGRAM_BOT_TOKEN or
TELEGRAM_CHAT_ID are missing, or ENV != "production", all operations no-op
silently. Business logic (sales, orders, inventory) is never blocked by
Telegram failures.

Connection pooling: a single httpx.AsyncClient is lazily created and reused
across all sends. Call close() during shutdown to release the connection pool.
"""

import asyncio
import logging
import time
from typing import TYPE_CHECKING

import httpx

from app.core.config import settings

if TYPE_CHECKING:
    from uuid import UUID

logger = logging.getLogger("telegram")

TELEGRAM_API = "https://api.telegram.org/bot{token}/sendMessage"
COOLDOWN_SECONDS = 300  # 5 minutes default

# Cooldown tracking: alert_type -> last_sent_monotonic
_cooldowns: dict[str, float] = {}


class TelegramService:
    """Telegram Bot API client with connection pooling and cooldown gating.

    Lifecycle:
        - Created lazily via get_telegram_service() singleton.
        - The httpx client is created on first send, not at init time.
        - Call close() during app shutdown to release the connection pool.

    Disabled mode:
        When ENV != "production" or credentials are missing, all methods
        return False / no-op without making any HTTP requests.
    """

    def __init__(self) -> None:
        self._enabled = (
            settings.ENV == "production"
            and bool(settings.TELEGRAM_BOT_TOKEN and settings.TELEGRAM_CHAT_ID)
        )
        self._token = settings.TELEGRAM_BOT_TOKEN or ""
        self._chat_id = settings.TELEGRAM_CHAT_ID or ""
        self._url = TELEGRAM_API.format(token=self._token) if self._enabled else ""
        self._client: httpx.AsyncClient | None = None

    @property
    def enabled(self) -> bool:
        return self._enabled

    def _get_client(self) -> httpx.AsyncClient:
        if self._client is None:
            self._client = httpx.AsyncClient(timeout=10.0)
        return self._client

    async def close(self) -> None:
        if self._client is not None:
            await self._client.aclose()
            self._client = None

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
            client = self._get_client()
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

        except httpx.HTTPStatusError as e:
            # str(e) embeds the full request URL — which carries the bot token.
            # Log only the status code so the token never reaches journald.
            logger.error(
                "Telegram alert failed (%s): HTTP %d",
                alert_type,
                e.response.status_code,
            )
            return False
        except httpx.HTTPError as e:
            logger.error("Telegram alert failed (%s): %s", alert_type, type(e).__name__)
            return False

    async def send_to_chat(
        self,
        chat_id: str,
        message: str,
        parse_mode: str = "HTML",
    ) -> bool:
        """Send a message to a specific Telegram chat_id."""
        if not self._enabled:
            return False
        try:
            client = self._get_client()
            resp = await client.post(
                self._url,
                json={
                    "chat_id": chat_id,
                    "text": message,
                    "parse_mode": parse_mode,
                    "disable_web_page_preview": True,
                },
            )
            resp.raise_for_status()
            return True
        except httpx.HTTPStatusError as e:
            logger.error(
                "Telegram send_to_chat(%s) failed: HTTP %d",
                chat_id,
                e.response.status_code,
            )
            return False
        except httpx.HTTPError as e:
            logger.error(
                "Telegram send_to_chat(%s) failed: %s", chat_id, type(e).__name__
            )
            return False

    def send_sync_fallback(self, message: str, alert_type: str) -> None:
        """Blocking send for callers without a running event loop.

        Used by fire_and_forget_* when invoked from a sync SQLAlchemy event
        listener thread. Updates the cooldown on a successful send. No-ops
        when the service is disabled.
        """
        if not self._enabled:
            return
        try:
            httpx.post(
                self._url,
                json={
                    "chat_id": self._chat_id,
                    "text": message,
                    "parse_mode": "HTML",
                    "disable_web_page_preview": True,
                },
                timeout=5.0,
            )
            _cooldowns[alert_type] = time.monotonic()
        except httpx.HTTPError as e:
            logger.error(
                "Telegram sync fallback failed (%s): %s", alert_type, type(e).__name__
            )


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
    get_telegram_service().send_sync_fallback(message, alert_type)


def _task_done_callback(task: asyncio.Task) -> None:
    """Log exceptions from fire-and-forget tasks instead of silencing them."""
    if task.cancelled():
        return
    exc = task.exception()
    if exc:
        logger.error("Telegram background task failed: %s", exc, exc_info=exc)


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
        task = loop.create_task(
            get_telegram_service().send_alert(
                message, alert_type=alert_type, cooldown=0
            )
        )
        task.add_done_callback(_task_done_callback)
    except RuntimeError:
        # No running event loop — sync fallback
        _send_sync(message, alert_type)


# ── Routed alerts (per-user subscriptions) ───────────────────────


async def _send_to_chat(chat_id: str, message: str) -> bool:
    """Module-level wrapper that delegates to the singleton's method."""
    return await get_telegram_service().send_to_chat(chat_id, message)


async def route_alert(
    alert_type: str,
    message: str,
    school_id: "UUID | None" = None,
) -> None:
    """Send alert to the group chat AND to subscribed users.

    When ``school_id`` is provided, per-user routing is restricted to users
    with a role in that school (superusers always receive). The group chat
    is unaffected — it always receives.

    Opens its own DB session to look up subscriptions (runs outside the
    request lifecycle as a fire-and-forget task). Fan-out to individual
    subscribers runs in parallel via ``asyncio.gather``.

    Args:
        alert_type: Must match a TelegramAlertType value for per-user routing.
            Unknown types still send to the group chat but skip individual routing.
        message: HTML-formatted message body.
        school_id: Optional school filter for per-user routing.
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
            chat_ids = await sub_service.get_chat_ids_for_alert(
                tg_alert_type, school_id=school_id
            )
    except Exception as e:
        logger.error("route_alert(%s) subscription lookup failed: %s", alert_type, e)
        return

    # Fan-out to subscribers in parallel (skip group to avoid duplicates)
    group_chat_id = svc._chat_id
    targets = [cid for cid in chat_ids if cid != group_chat_id]
    if targets:
        results = await asyncio.gather(
            *[_send_to_chat(cid, message) for cid in targets],
            return_exceptions=True,
        )
        for cid, result in zip(targets, results):
            if isinstance(result, Exception):
                logger.error("route_alert fan-out to %s failed: %s", cid, result)


def fire_and_forget_routed_alert(
    alert_type: str,
    message: str,
    school_id: "UUID | None" = None,
) -> None:
    """Schedule a routed alert without blocking the caller.

    Sends to group + subscribed users (filtered by ``school_id`` if given).
    """
    svc = get_telegram_service()
    if not svc.enabled:
        return

    try:
        loop = asyncio.get_running_loop()
        task = loop.create_task(route_alert(alert_type, message, school_id=school_id))
        task.add_done_callback(_task_done_callback)
    except RuntimeError:
        # No event loop — just send to group as fallback
        _send_sync(message, alert_type)
