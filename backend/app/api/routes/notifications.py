"""
Notification Endpoints

API routes for managing user notifications.
Notifications are filtered by user access (school_id and user_id).
"""
from fastapi import APIRouter, HTTPException, status, Query
from uuid import UUID
from typing import Optional

from app.api.dependencies import DatabaseSession, CurrentUser, UserSchoolIds
from app.api.error_responses import responses, AUTHENTICATED
from app.services.notification import NotificationService
from app.schemas.notification import (
    NotificationResponse,
    NotificationListResponse,
    UnreadCountResponse,
    MarkReadRequest
)


router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.get(
    "",
    response_model=NotificationListResponse,
    summary="Get notifications for current user",
    responses=AUTHENTICATED,
    operation_id="listNotifications",
)
async def get_notifications(
    db: DatabaseSession,
    current_user: CurrentUser,
    user_school_ids: UserSchoolIds,
    unread_only: bool = Query(False, description="Only return unread notifications"),
    limit: int = Query(50, ge=1, le=100, description="Max notifications to return"),
    skip: int = Query(0, ge=0, description="Items a saltar")
):
    """
    Get notifications for the current authenticated user.
    """
    service = NotificationService(db)

    notifications, total, unread_count = await service.get_for_user(
        user_id=current_user.id,
        school_ids=user_school_ids,
        is_superuser=current_user.is_superuser,
        unread_only=unread_only,
        limit=limit,
        offset=skip
    )

    return NotificationListResponse(
        items=[NotificationResponse.model_validate(n) for n in notifications],
        total=total,
        skip=skip,
        limit=limit,
        unread_count=unread_count
    )


@router.get(
    "/unread-count",
    response_model=UnreadCountResponse,
    summary="Get unread notification count",
    responses=AUTHENTICATED,
    operation_id="getUnreadNotificationCount",
)
async def get_unread_count(
    db: DatabaseSession,
    current_user: CurrentUser,
    user_school_ids: UserSchoolIds
):
    """
    Get count of unread notifications for polling.

    Lightweight endpoint optimized for frequent polling (every 30-60 seconds).
    Only returns count and last notification timestamp.
    """
    service = NotificationService(db)

    count, last_at = await service.get_unread_count(
        user_id=current_user.id,
        school_ids=user_school_ids,
        is_superuser=current_user.is_superuser
    )

    return UnreadCountResponse(
        unread_count=count,
        last_notification_at=last_at
    )


@router.patch(
    "/{notification_id}/read",
    response_model=dict,
    summary="Mark single notification as read",
    responses=responses(404),
    operation_id="markNotificationRead",
)
async def mark_notification_read(
    notification_id: UUID,
    db: DatabaseSession,
    current_user: CurrentUser,
    user_school_ids: UserSchoolIds
):
    """
    Mark a specific notification as read.

    **Tenant isolation:** Service layer filters by authenticated user's accessible schools.
    """
    service = NotificationService(db)

    count = await service.mark_as_read(
        notification_ids=[notification_id],
        user_id=current_user.id,
        school_ids=user_school_ids,
        is_superuser=current_user.is_superuser
    )

    await db.commit()

    if count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found or already read"
        )

    return {"success": True, "marked_count": count}


@router.patch(
    "/mark-all-read",
    response_model=dict,
    summary="Mark all notifications as read",
    responses=AUTHENTICATED,
    operation_id="markAllNotificationsRead",
)
async def mark_all_read(
    db: DatabaseSession,
    current_user: CurrentUser,
    user_school_ids: UserSchoolIds,
    request: Optional[MarkReadRequest] = None
):
    """
    Mark notifications as read.

    If notification_ids provided in request body, marks only those.
    Otherwise, marks ALL unread notifications for the user.
    """
    service = NotificationService(db)

    notification_ids = request.notification_ids if request else None

    count = await service.mark_as_read(
        notification_ids=notification_ids,
        user_id=current_user.id,
        school_ids=user_school_ids,
        is_superuser=current_user.is_superuser
    )

    await db.commit()

    return {"success": True, "marked_count": count}
