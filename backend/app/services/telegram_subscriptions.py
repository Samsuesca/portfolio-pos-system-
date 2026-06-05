"""Telegram subscription management — linking, CRUD, and routing queries.

Used by the self-service API (users link their own Telegram) and by
route_alert() to resolve which chat_ids should receive each alert type.
Default subscriptions are auto-created based on the user's highest role.
"""
import logging
from uuid import UUID

from sqlalchemy import delete, distinct, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.telegram_subscription import (
    DEFAULT_SUBSCRIPTIONS_BY_ROLE,
    RESTRICTED_TO_ADMIN_ALERTS,
    TelegramAlertSubscription,
    TelegramAlertType,
)
from app.models.user import User, UserRole, UserSchoolRole

logger = logging.getLogger(__name__)

# Roles considered "admin-level" for hard-restriction filtering.
_ADMIN_ROLES: frozenset[UserRole] = frozenset({UserRole.OWNER, UserRole.ADMIN})


class TelegramSubscriptionService:
    """Manages Telegram chat linking and per-user alert subscriptions.

    Provides the subscription store for the routing layer (route_alert).
    When a user links Telegram, default subscriptions are created based
    on their highest system role (owner gets all 18 types, viewer gets
    only daily_digest_seller).
    """

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
        self,
        alert_type: TelegramAlertType,
        school_id: UUID | None = None,
    ) -> list[str]:
        """Return chat_ids subscribed to ``alert_type``.

        Two optional filters layered on top of the base subscription query:

        - ``school_id``: only users with any role in that school (or superusers)
          receive school-scoped events. Sales/orders/inventory pass this.

        - Admin-restricted alerts (``RESTRICTED_TO_ADMIN_ALERTS``): only
          superusers and users with OWNER/ADMIN role in any school receive,
          regardless of their subscription state. Defense-in-depth against
          accidental subscription of low-privilege users to financial alerts.
        """
        stmt = (
            select(distinct(User.telegram_chat_id))
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

        if alert_type in RESTRICTED_TO_ADMIN_ALERTS:
            stmt = stmt.where(
                or_(
                    User.is_superuser == True,
                    User.id.in_(
                        select(UserSchoolRole.user_id).where(
                            UserSchoolRole.role.in_(_ADMIN_ROLES)
                        )
                    ),
                )
            )

        if school_id is not None:
            stmt = stmt.where(
                or_(
                    User.is_superuser == True,
                    User.id.in_(
                        select(UserSchoolRole.user_id).where(
                            UserSchoolRole.school_id == school_id
                        )
                    ),
                )
            )

        result = await self.db.execute(stmt)
        return [row[0] for row in result.all() if row[0]]

    async def is_admin_level(self, user: User) -> bool:
        """Whether ``user`` is eligible for ``RESTRICTED_TO_ADMIN_ALERTS``.

        Mirrors the recipient filter in ``get_chat_ids_for_alert``: a superuser,
        or a user with an OWNER/ADMIN role in any school. Used by the
        self-service endpoint to reject subscriptions to admin-only alerts
        up-front, so the stored state matches what the user can actually
        receive.
        """
        if user.is_superuser:
            return True
        result = await self.db.execute(
            select(UserSchoolRole.user_id)
            .where(
                UserSchoolRole.user_id == user.id,
                UserSchoolRole.role.in_(_ADMIN_ROLES),
            )
            .limit(1)
        )
        return result.first() is not None

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
