"""
Email Logs Endpoints

Global endpoints for email audit trail and statistics.
Following the globalAccountingService pattern - no school_id required.
"""
from datetime import date
from fastapi import APIRouter, Depends, Query, BackgroundTasks

from app.api.dependencies import (
    DatabaseSession,
    CurrentUser,
    require_any_school_admin,
)
from app.models.email_log import EmailType, EmailStatus
from app.schemas.email_log import (
    EmailLogFilter,
    EmailLogListResponse,
    EmailLogWithDetails,
    EmailStatsResponse,
)
from app.services.email_log import EmailLogService
from app.services.email import process_email_log_queue, get_email_log_queue_size


router = APIRouter(prefix="/global/email-logs", tags=["Email Logs"])


@router.get(
    "",
    response_model=EmailLogListResponse,
    dependencies=[Depends(require_any_school_admin)]
)
async def get_email_logs(
    db: DatabaseSession,
    current_user: CurrentUser,
    start_date: date | None = Query(default=None, description="Filter by start date"),
    end_date: date | None = Query(default=None, description="Filter by end date"),
    email_type: EmailType | None = Query(default=None, description="Filter by email type"),
    status: EmailStatus | None = Query(default=None, description="Filter by status"),
    recipient_email: str | None = Query(default=None, description="Search by recipient email"),
    skip: int = Query(default=0, ge=0, description="Number of records to skip"),
    limit: int = Query(default=100, ge=1, le=500, description="Max records to return"),
):
    """
    Get email logs with optional filters.

    Global endpoint - requires ADMIN role in any school.
    Returns paginated list of email logs with client and user details.
    """
    log_service = EmailLogService(db)

    filters = EmailLogFilter(
        start_date=start_date,
        end_date=end_date,
        email_type=email_type,
        status=status,
        recipient_email=recipient_email,
        skip=skip,
        limit=limit,
    )

    return await log_service.get_logs(filters)


@router.get(
    "/statistics",
    response_model=EmailStatsResponse,
    dependencies=[Depends(require_any_school_admin)]
)
async def get_email_statistics(
    db: DatabaseSession,
    current_user: CurrentUser,
    start_date: date | None = Query(default=None, description="Period start date"),
    end_date: date | None = Query(default=None, description="Period end date"),
):
    """
    Get email statistics for a period.

    Includes:
    - Total counts by status
    - Breakdown by email type
    - Daily trends
    - Success rate

    Defaults to last 30 days if no dates provided.
    """
    log_service = EmailLogService(db)
    return await log_service.get_statistics(start_date, end_date)


@router.get(
    "/failures",
    response_model=list[EmailLogWithDetails],
    dependencies=[Depends(require_any_school_admin)]
)
async def get_recent_failures(
    db: DatabaseSession,
    current_user: CurrentUser,
    limit: int = Query(default=10, ge=1, le=50, description="Max failures to return"),
):
    """
    Get recent failed emails for quick debugging.

    Returns the most recent failed email attempts with error messages.
    """
    log_service = EmailLogService(db)
    return await log_service.get_recent_failures(limit)


@router.post(
    "/process-queue",
    dependencies=[Depends(require_any_school_admin)]
)
async def process_pending_logs(
    db: DatabaseSession,
    current_user: CurrentUser,
    background_tasks: BackgroundTasks,
):
    """
    Process pending email logs in the queue.

    This endpoint manually triggers processing of any queued email logs.
    Normally this happens automatically, but can be useful for debugging.
    """
    queue_size = get_email_log_queue_size()

    if queue_size == 0:
        return {"message": "No pending logs to process", "processed": 0}

    processed = await process_email_log_queue(db)

    return {
        "message": f"Processed {processed} email logs",
        "processed": processed,
        "remaining": get_email_log_queue_size(),
    }


@router.get(
    "/queue-status",
    dependencies=[Depends(require_any_school_admin)]
)
async def get_queue_status(
    current_user: CurrentUser,
):
    """
    Get the current status of the email log queue.

    Returns the number of pending logs waiting to be processed.
    """
    return {
        "pending_logs": get_email_log_queue_size(),
    }
