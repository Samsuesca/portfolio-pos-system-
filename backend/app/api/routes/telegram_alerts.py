"""
Telegram Alerts API

Self-service linking + subscription management + admin endpoints.
"""
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_user, get_db, require_superuser
from app.api.error_responses import responses, AUTHENTICATED
from app.models.telegram_subscription import (
    RESTRICTED_TO_ADMIN_ALERTS,
    TelegramAlertType,
)
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


@router.get("/alert-types", response_model=list[AlertTypeInfo], responses=AUTHENTICATED, operation_id="listAlertTypes")
async def list_alert_types(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List the alert types the current user can subscribe to.

    Admin-only alerts (``RESTRICTED_TO_ADMIN_ALERTS``) are omitted for users
    who are not admin-level, so the subscription UI never offers an alert the
    user would be rejected from on save (and would never receive anyway).
    """
    svc = TelegramSubscriptionService(db)
    is_admin = await svc.is_admin_level(current_user)
    return [
        AlertTypeInfo(
            alert_type=at,
            description=ALERT_TYPE_DESCRIPTIONS.get(at, at.value),
            category=get_alert_category(at),
        )
        for at in TelegramAlertType
        if is_admin or at not in RESTRICTED_TO_ADMIN_ALERTS
    ]


# ── Self-service ──────────────────────────────────────────────────


@router.get("/my-subscriptions", response_model=MySubscriptionsResponse, responses=AUTHENTICATED, operation_id="getMySubscriptions")
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


@router.put("/my-subscriptions", response_model=MySubscriptionsResponse, responses=responses(400), operation_id="updateMySubscriptions")
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

    # Las alertas administrativas (gastos, caja, resumenes financieros) solo
    # las reciben superusuarios y roles OWNER/ADMIN. El routing ya filtra la
    # entrega, pero rechazamos aqui para que el estado guardado coincida con lo
    # que el usuario realmente recibira (evita suscripciones muertas).
    requested_restricted = [
        at for at in body.alert_types if at in RESTRICTED_TO_ADMIN_ALERTS
    ]
    if requested_restricted and not await svc.is_admin_level(current_user):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "No tienes permiso para suscribirte a alertas administrativas "
                "(gastos, caja, resumenes financieros)."
            ),
        )

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


@router.post("/link", response_model=MySubscriptionsResponse, responses=AUTHENTICATED, operation_id="linkTelegram")
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


@router.delete("/unlink", status_code=status.HTTP_204_NO_CONTENT, responses=AUTHENTICATED, operation_id="unlinkTelegram")
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
    responses=AUTHENTICATED,
    operation_id="listUsersTelegram",
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
    responses=responses(404),
    operation_id="adminUpdateSubscriptions",
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
    responses=responses(404),
    operation_id="adminLinkTelegram",
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
    responses=responses(404),
    operation_id="adminUnlinkTelegram",
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
