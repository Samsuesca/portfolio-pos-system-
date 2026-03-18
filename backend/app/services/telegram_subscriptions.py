"""
Telegram Subscription Service

CRUD for user Telegram linking and alert subscriptions.
"""
import logging
from uuid import UUID

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.telegram_subscription import (
    TelegramAlertSubscription,
    TelegramAlertType,
    DEFAULT_SUBSCRIPTIONS_BY_ROLE,
)
from app.models.user import User, UserRole

logger = logging.getLogger(__name__)


class TelegramSubscriptionService:
    """Manage Telegram linking and alert subscriptions."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    # ── Linking ───────────────────────────────────────────────────

    async def link_telegram(self, user_id: UUID, chat_id: str) -> User:
        """Link a Telegram chat_id to a user and create default subscriptions."""
        user = await self._get_user(user_id)
        user.telegram_chat_id = chat_id
        await self.db.flush()

        # Create default subscriptions based on role
        await self._create_default_subscriptions(user)
        await self.db.flush()
        return user

    async def unlink_telegram(self, user_id: UUID) -> User:
        """Remove Telegram chat_id and all subscriptions."""
        user = await self._get_user(user_id)
        user.telegram_chat_id = None

        # Delete all subscriptions
        await self.db.execute(
            delete(TelegramAlertSubscription).where(
                TelegramAlertSubscription.user_id == user_id
            )
        )
        await self.db.flush()
        return user

    # ── Subscriptions ─────────────────────────────────────────────

    async def get_user_subscriptions(
        self, user_id: UUID
    ) -> list[TelegramAlertSubscription]:
        """Get all active subscriptions for a user."""
        result = await self.db.execute(
            select(TelegramAlertSubscription).where(
                TelegramAlertSubscription.user_id == user_id,
                TelegramAlertSubscription.is_active == True,
            )
        )
        return list(result.scalars().all())

    async def update_subscriptions(
        self, user_id: UUID, alert_types: list[TelegramAlertType]
    ) -> list[TelegramAlertSubscription]:
        """Replace all user subscriptions with the given list."""
        # Delete existing
        await self.db.execute(
            delete(TelegramAlertSubscription).where(
                TelegramAlertSubscription.user_id == user_id
            )
        )

        # Create new
        for alert_type in alert_types:
            sub = TelegramAlertSubscription(
                user_id=user_id,
                alert_type=alert_type,
                is_active=True,
            )
            self.db.add(sub)

        await self.db.flush()
        return await self.get_user_subscriptions(user_id)

    # ── Routing queries ───────────────────────────────────────────

    async def get_chat_ids_for_alert(
        self, alert_type: TelegramAlertType
    ) -> list[str]:
        """Return all chat_ids subscribed to a specific alert type."""
        result = await self.db.execute(
            select(User.telegram_chat_id)
            .join(
                TelegramAlertSubscription,
                TelegramAlertSubscription.user_id == User.id,
            )
            .where(
                TelegramAlertSubscription.alert_type == alert_type,
                TelegramAlertSubscription.is_active == True,
                User.telegram_chat_id.isnot(None),
                User.is_active == True,
            )
        )
        return [row[0] for row in result.all() if row[0]]

    # ── Admin ─────────────────────────────────────────────────────

    async def get_all_users_with_telegram(self) -> list[User]:
        """List all users with their Telegram status and subscriptions."""
        result = await self.db.execute(
            select(User)
            .options(selectinload(User.telegram_subscriptions))
            .where(User.is_active == True)
            .order_by(User.username)
        )
        return list(result.scalars().all())

    # ── Internal ──────────────────────────────────────────────────

    async def _get_user(self, user_id: UUID) -> User:
        result = await self.db.execute(
            select(User).where(User.id == user_id)
        )
        user = result.scalar_one_or_none()
        if not user:
            raise ValueError(f"Usuario no encontrado: {user_id}")
        return user

    async def _create_default_subscriptions(self, user: User) -> None:
        """Auto-subscribe user based on their highest role."""
        role_key = await self._get_highest_role_key(user)
        default_types = DEFAULT_SUBSCRIPTIONS_BY_ROLE.get(role_key, [])

        # Get existing subscriptions to avoid duplicates
        existing = await self.db.execute(
            select(TelegramAlertSubscription.alert_type).where(
                TelegramAlertSubscription.user_id == user.id
            )
        )
        existing_types = {row[0] for row in existing.all()}

        for alert_type in default_types:
            if alert_type not in existing_types:
                sub = TelegramAlertSubscription(
                    user_id=user.id,
                    alert_type=alert_type,
                    is_active=True,
                )
                self.db.add(sub)

    async def _get_highest_role_key(self, user: User) -> str:
        """Determine the highest role for default subscription selection."""
        if user.is_superuser:
            return "superuser"

        # Query school roles from DB (avoid lazy-load in async context)
        from app.models.user import UserSchoolRole

        result = await self.db.execute(
            select(UserSchoolRole.role).where(
                UserSchoolRole.user_id == user.id,
                UserSchoolRole.role.isnot(None),
            )
        )
        roles = [row[0] for row in result.all()]

        priority_order = [
            (UserRole.OWNER, "owner"),
            (UserRole.ADMIN, "admin"),
            (UserRole.SELLER, "seller"),
            (UserRole.VIEWER, "viewer"),
        ]

        for role_enum, role_key in priority_order:
            if role_enum in roles:
                return role_key

        return "viewer"
