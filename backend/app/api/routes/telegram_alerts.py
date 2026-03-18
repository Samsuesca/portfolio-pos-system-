"""
Telegram Alerts API

Self-service linking + subscription management + admin endpoints.
"""
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_user, get_db, require_superuser
from app.models.telegram_subscription import TelegramAlertType
from app.models.user import User
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
from app.services.telegram_subscriptions import TelegramSubscriptionService

router = APIRouter(
    prefix="/telegram-alerts",
    tags=["Telegram Alerts"],
)


# ── Public: alert type info ───────────────────────────────────────


@router.get("/alert-types", response_model=list[AlertTypeInfo])
async def list_alert_types(
    _current_user: User = Depends(get_current_user),
):
    """List all available alert types with descriptions."""
    return [
        AlertTypeInfo(
            alert_type=at,
            description=ALERT_TYPE_DESCRIPTIONS.get(at, at.value),
            category=get_alert_category(at),
        )
        for at in TelegramAlertType
    ]


# ── Self-service ──────────────────────────────────────────────────


@router.get("/my-subscriptions", response_model=MySubscriptionsResponse)
async def get_my_subscriptions(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get current user's Telegram link status and subscriptions."""
    svc = TelegramSubscriptionService(db)
    subs = await svc.get_user_subscriptions(current_user.id)

    sub_map = {s.alert_type: s for s in subs}
    subscriptions = [
        SubscriptionResponse(
            alert_type=at,
            description=ALERT_TYPE_DESCRIPTIONS.get(at, at.value),
            is_active=at in sub_map and sub_map[at].is_active,
        )
        for at in TelegramAlertType
    ]

    return MySubscriptionsResponse(
        is_linked=current_user.telegram_chat_id is not None,
        telegram_chat_id=current_user.telegram_chat_id,
        subscriptions=subscriptions,
    )


@router.put("/my-subscriptions", response_model=MySubscriptionsResponse)
async def update_my_subscriptions(
    body: TelegramUpdateSubscriptions,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update current user's alert subscriptions."""
    if not current_user.telegram_chat_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Debes vincular tu Telegram primero (POST /telegram-alerts/link)",
        )

    svc = TelegramSubscriptionService(db)
    subs = await svc.update_subscriptions(current_user.id, body.alert_types)

    sub_map = {s.alert_type: s for s in subs}
    subscriptions = [
        SubscriptionResponse(
            alert_type=at,
            description=ALERT_TYPE_DESCRIPTIONS.get(at, at.value),
            is_active=at in sub_map and sub_map[at].is_active,
        )
        for at in TelegramAlertType
    ]

    return MySubscriptionsResponse(
        is_linked=True,
        telegram_chat_id=current_user.telegram_chat_id,
        subscriptions=subscriptions,
    )


@router.post("/link", response_model=MySubscriptionsResponse)
async def link_telegram(
    body: TelegramLinkRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Link Telegram chat_id to current user. Creates default subscriptions by role."""
    svc = TelegramSubscriptionService(db)
    user = await svc.link_telegram(current_user.id, body.chat_id)

    subs = await svc.get_user_subscriptions(user.id)
    sub_map = {s.alert_type: s for s in subs}
    subscriptions = [
        SubscriptionResponse(
            alert_type=at,
            description=ALERT_TYPE_DESCRIPTIONS.get(at, at.value),
            is_active=at in sub_map and sub_map[at].is_active,
        )
        for at in TelegramAlertType
    ]

    return MySubscriptionsResponse(
        is_linked=True,
        telegram_chat_id=user.telegram_chat_id,
        subscriptions=subscriptions,
    )


@router.delete("/unlink", status_code=status.HTTP_204_NO_CONTENT)
async def unlink_telegram(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Unlink Telegram from current user and remove all subscriptions."""
    svc = TelegramSubscriptionService(db)
    await svc.unlink_telegram(current_user.id)


# ── Admin endpoints (superuser only) ─────────────────────────────


@router.get(
    "/users",
    response_model=list[UserTelegramInfo],
    dependencies=[Depends(require_superuser)],
)
async def list_users_telegram(
    db: AsyncSession = Depends(get_db),
):
    """List all users with their Telegram status and subscriptions."""
    svc = TelegramSubscriptionService(db)
    users = await svc.get_all_users_with_telegram()

    result = []
    for user in users:
        sub_map = {s.alert_type: s for s in user.telegram_subscriptions}
        subscriptions = [
            SubscriptionResponse(
                alert_type=at,
                description=ALERT_TYPE_DESCRIPTIONS.get(at, at.value),
                is_active=at in sub_map and sub_map[at].is_active,
            )
            for at in TelegramAlertType
        ]
        result.append(
            UserTelegramInfo(
                user_id=user.id,
                username=user.username,
                full_name=user.full_name,
                is_linked=user.telegram_chat_id is not None,
                telegram_chat_id=user.telegram_chat_id,
                subscriptions=subscriptions,
            )
        )
    return result


@router.put(
    "/users/{user_id}/subscriptions",
    response_model=UserTelegramInfo,
    dependencies=[Depends(require_superuser)],
)
async def admin_update_subscriptions(
    user_id: UUID,
    body: TelegramUpdateSubscriptions,
    db: AsyncSession = Depends(get_db),
):
    """Admin: update a user's alert subscriptions."""
    svc = TelegramSubscriptionService(db)

    try:
        subs = await svc.update_subscriptions(user_id, body.alert_types)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    user = await svc._get_user(user_id)
    sub_map = {s.alert_type: s for s in subs}
    subscriptions = [
        SubscriptionResponse(
            alert_type=at,
            description=ALERT_TYPE_DESCRIPTIONS.get(at, at.value),
            is_active=at in sub_map and sub_map[at].is_active,
        )
        for at in TelegramAlertType
    ]

    return UserTelegramInfo(
        user_id=user.id,
        username=user.username,
        full_name=user.full_name,
        is_linked=user.telegram_chat_id is not None,
        telegram_chat_id=user.telegram_chat_id,
        subscriptions=subscriptions,
    )


@router.put(
    "/users/{user_id}/link",
    response_model=UserTelegramInfo,
    dependencies=[Depends(require_superuser)],
)
async def admin_link_telegram(
    user_id: UUID,
    body: TelegramAdminLinkRequest,
    db: AsyncSession = Depends(get_db),
):
    """Admin: link Telegram for a user."""
    svc = TelegramSubscriptionService(db)

    try:
        user = await svc.link_telegram(user_id, body.chat_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    subs = await svc.get_user_subscriptions(user.id)
    sub_map = {s.alert_type: s for s in subs}
    subscriptions = [
        SubscriptionResponse(
            alert_type=at,
            description=ALERT_TYPE_DESCRIPTIONS.get(at, at.value),
            is_active=at in sub_map and sub_map[at].is_active,
        )
        for at in TelegramAlertType
    ]

    return UserTelegramInfo(
        user_id=user.id,
        username=user.username,
        full_name=user.full_name,
        is_linked=True,
        telegram_chat_id=user.telegram_chat_id,
        subscriptions=subscriptions,
    )


@router.delete(
    "/users/{user_id}/unlink",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_superuser)],
)
async def admin_unlink_telegram(
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Admin: unlink Telegram for a user."""
    svc = TelegramSubscriptionService(db)
    try:
        await svc.unlink_telegram(user_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
