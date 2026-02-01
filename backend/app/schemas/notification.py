"""
Notification Schemas

Pydantic schemas for notification API requests and responses.
"""
from pydantic import BaseModel, Field, ConfigDict
from uuid import UUID
from datetime import datetime
from typing import Optional

from app.models.notification import NotificationType, ReferenceType


class NotificationBase(BaseModel):
    """Base schema for Notification"""
    model_config = ConfigDict(use_enum_values=True)

    type: NotificationType
    title: str = Field(..., min_length=1, max_length=200)
    message: str = Field(..., min_length=1)
    reference_type: Optional[ReferenceType] = None
    reference_id: Optional[UUID] = None
    school_id: Optional[UUID] = None


class NotificationCreate(NotificationBase):
    """Schema for creating a notification (internal use only)"""
    user_id: Optional[UUID] = None  # None = broadcast to all users with school access


class NotificationResponse(BaseModel):
    """Schema for notification response"""
    model_config = ConfigDict(from_attributes=True, use_enum_values=True)

    id: UUID
    user_id: Optional[UUID]
    type: NotificationType
    title: str
    message: str
    reference_type: Optional[ReferenceType]
    reference_id: Optional[UUID]
    school_id: Optional[UUID]
    is_read: bool
    read_at: Optional[datetime]
    created_at: datetime


class NotificationListResponse(BaseModel):
    """Schema for paginated notification list"""
    items: list[NotificationResponse]
    total: int
    unread_count: int


class UnreadCountResponse(BaseModel):
    """Schema for unread count response (optimized for polling)"""
    unread_count: int
    last_notification_at: Optional[datetime] = None


class MarkReadRequest(BaseModel):
    """Schema for marking notifications as read"""
    notification_ids: Optional[list[UUID]] = None  # None = mark all unread
