"""
Email Log Schemas

Schemas for email log - audit trail for all email sends.
"""
from uuid import UUID
from datetime import datetime, date
from pydantic import Field

from app.schemas.base import BaseSchema, IDModelSchema
from app.models.email_log import EmailType, EmailStatus


# ============================================
# Filter Schemas
# ============================================

class EmailLogFilter(BaseSchema):
    """Filter schema for querying email logs"""
    start_date: date | None = None
    end_date: date | None = None
    email_type: EmailType | None = None
    status: EmailStatus | None = None
    recipient_email: str | None = None
    client_id: UUID | None = None
    skip: int = Field(default=0, ge=0)
    limit: int = Field(default=100, ge=1, le=500)


# ============================================
# Response Schemas
# ============================================

class EmailLogResponse(IDModelSchema):
    """Email log for API responses"""
    email_type: EmailType
    recipient_email: str
    recipient_name: str | None = None
    subject: str
    status: EmailStatus
    error_message: str | None = None
    reference_code: str | None = None
    client_id: UUID | None = None
    order_id: UUID | None = None
    sale_id: UUID | None = None
    user_id: UUID | None = None
    triggered_by: UUID | None = None
    sent_at: datetime


class EmailLogWithDetails(EmailLogResponse):
    """Email log with enriched details for UI"""
    client_name: str | None = None
    triggered_by_name: str | None = None
    email_type_label: str


# ============================================
# Create Schema (internal use)
# ============================================

class EmailLogCreate(BaseSchema):
    """Schema for creating email log (internal use by email service)"""
    email_type: EmailType
    recipient_email: str = Field(..., max_length=255)
    recipient_name: str | None = Field(None, max_length=255)
    subject: str = Field(..., max_length=500)
    status: EmailStatus
    error_message: str | None = None
    reference_code: str | None = Field(None, max_length=100)
    client_id: UUID | None = None
    order_id: UUID | None = None
    sale_id: UUID | None = None
    user_id: UUID | None = None
    triggered_by: UUID | None = None


# ============================================
# Statistics Schemas
# ============================================

class EmailDaySummary(BaseSchema):
    """Summary for a single day"""
    date: date
    total: int
    success: int
    failed: int
    success_rate: float


class EmailTypeSummary(BaseSchema):
    """Summary by email type"""
    email_type: EmailType
    email_type_label: str
    total: int
    success: int
    failed: int
    success_rate: float


class EmailStatsResponse(BaseSchema):
    """Complete email statistics"""
    period_start: date
    period_end: date
    total_sent: int
    total_success: int
    total_failed: int
    total_dev_skipped: int
    overall_success_rate: float
    by_type: list[EmailTypeSummary]
    by_day: list[EmailDaySummary]
    avg_per_day: float


# ============================================
# List Response
# ============================================

class EmailLogListResponse(BaseSchema):
    """Paginated list of email logs"""
    items: list[EmailLogWithDetails]
    total: int
    skip: int
    limit: int
