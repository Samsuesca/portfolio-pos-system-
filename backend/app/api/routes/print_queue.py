"""
Print Queue API Routes

Provides endpoints for:
- SSE subscription for real-time updates
- Listing pending queue items
- Marking items as printed/skipped
- Queue statistics
"""
import asyncio
import json
import logging
from uuid import UUID
from fastapi import APIRouter, HTTPException, status, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import (
    DatabaseSession, CurrentUser, require_any_school_admin, get_db, get_current_user
)
from app.services.print_queue import PrintQueueService
from app.services.sse_manager import sse_manager
from app.schemas.print_queue import PrintQueueItemResponse, PrintQueueStats

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/global/print-queue", tags=["Print Queue"])


@router.get(
    "/subscribe",
    summary="Subscribe to print queue events via SSE",
    response_class=StreamingResponse,
)
async def subscribe_sse(
    current_user: CurrentUser,
    db: DatabaseSession
):
    """
    Server-Sent Events endpoint for real-time print queue updates.

    Connect to this endpoint to receive events when new cash sales
    are created and need to be printed.

    Events:
    - connected - Connection established
    - print_queue:initial - Initial pending items on connect
    - print_queue:new_sale - New sale added to queue
    - print_queue:item_updated - Item status changed
    - print_queue:heartbeat - Keep-alive every 30 seconds

    Requires authentication. Only users with ADMIN role in at least
    one school can subscribe.
    """
    # Verify user has admin access somewhere
    await require_any_school_admin(current_user, db)

    async def event_generator():
        queue = await sse_manager.subscribe(current_user.id)

        try:
            # Send initial connection confirmation
            yield f"event: connected\ndata: {json.dumps({'user_id': str(current_user.id)})}\n\n"

            # Send current pending items on connect
            async with AsyncSession(db.get_bind()) as new_db:
                print_queue_service = PrintQueueService(new_db)
                pending = await print_queue_service.get_pending_items()

                if pending:
                    pending_data = [
                        {
                            "id": str(item.id),
                            "sale_id": str(item.sale_id),
                            "school_id": str(item.school_id),
                            "sale_code": item.sale_code,
                            "sale_total": float(item.sale_total),
                            "client_name": item.client_name,
                            "school_name": item.school_name,
                            "source_device": item.source_device,
                            "created_at": item.created_at.isoformat()
                        }
                        for item in pending
                    ]
                    yield f"event: print_queue:initial\ndata: {json.dumps(pending_data)}\n\n"

            # Heartbeat interval
            heartbeat_interval = 30  # seconds

            while True:
                try:
                    # Wait for event with timeout for heartbeat
                    event = await asyncio.wait_for(
                        queue.get(),
                        timeout=heartbeat_interval
                    )

                    event_type = event.get("event", "message")
                    event_data = event.get("data", {})

                    yield f"event: {event_type}\ndata: {json.dumps(event_data)}\n\n"

                except asyncio.TimeoutError:
                    # Send heartbeat
                    import time
                    yield f"event: print_queue:heartbeat\ndata: {json.dumps({'timestamp': time.time()})}\n\n"

        except asyncio.CancelledError:
            logger.info(f"SSE connection cancelled for user {current_user.id}")
        except GeneratorExit:
            logger.info(f"SSE generator exit for user {current_user.id}")
        finally:
            await sse_manager.unsubscribe(current_user.id, queue)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"  # Disable nginx buffering
        }
    )


@router.get(
    "/pending",
    response_model=list[PrintQueueItemResponse],
    summary="Get pending print queue items",
)
async def get_pending_items(
    db: DatabaseSession,
    current_user: CurrentUser,
    limit: int = Query(50, ge=1, le=200)
):
    """Get all items pending in the print queue"""
    # Verify user has admin access
    await require_any_school_admin(current_user, db)

    service = PrintQueueService(db)
    items = await service.get_pending_items(limit)
    return [PrintQueueItemResponse.model_validate(item) for item in items]


@router.get(
    "/stats",
    response_model=PrintQueueStats,
    summary="Get print queue statistics",
)
async def get_queue_stats(
    db: DatabaseSession,
    current_user: CurrentUser
):
    """Get statistics about the print queue"""
    await require_any_school_admin(current_user, db)

    service = PrintQueueService(db)
    stats = await service.get_stats()
    return PrintQueueStats(**stats)


@router.patch(
    "/{item_id}/printed",
    response_model=PrintQueueItemResponse,
    summary="Mark item as printed",
)
async def mark_as_printed(
    item_id: UUID,
    db: DatabaseSession,
    current_user: CurrentUser
):
    """Mark a queue item as successfully printed"""
    await require_any_school_admin(current_user, db)

    service = PrintQueueService(db)
    item = await service.mark_as_printed(item_id)

    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Queue item not found"
        )

    await db.commit()

    # Broadcast update
    await sse_manager.broadcast_print_queue_event(
        "item_updated",
        {"id": str(item_id), "status": "printed"}
    )

    return PrintQueueItemResponse.model_validate(item)


@router.patch(
    "/{item_id}/skipped",
    response_model=PrintQueueItemResponse,
    summary="Mark item as skipped",
)
async def mark_as_skipped(
    item_id: UUID,
    db: DatabaseSession,
    current_user: CurrentUser
):
    """Mark a queue item as skipped (will not print)"""
    await require_any_school_admin(current_user, db)

    service = PrintQueueService(db)
    item = await service.mark_as_skipped(item_id)

    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Queue item not found"
        )

    await db.commit()

    # Broadcast update
    await sse_manager.broadcast_print_queue_event(
        "item_updated",
        {"id": str(item_id), "status": "skipped"}
    )

    return PrintQueueItemResponse.model_validate(item)


@router.patch(
    "/{item_id}/failed",
    response_model=PrintQueueItemResponse,
    summary="Mark item as failed",
)
async def mark_as_failed(
    item_id: UUID,
    db: DatabaseSession,
    current_user: CurrentUser,
    error_message: str = Query(..., description="Error message describing the failure")
):
    """Mark a queue item as failed with error message"""
    await require_any_school_admin(current_user, db)

    service = PrintQueueService(db)
    item = await service.mark_as_failed(item_id, error_message)

    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Queue item not found"
        )

    await db.commit()

    # Broadcast update
    await sse_manager.broadcast_print_queue_event(
        "item_updated",
        {"id": str(item_id), "status": "failed", "error": error_message}
    )

    return PrintQueueItemResponse.model_validate(item)


@router.patch(
    "/{item_id}/retry",
    response_model=PrintQueueItemResponse,
    summary="Retry a failed item",
)
async def retry_failed_item(
    item_id: UUID,
    db: DatabaseSession,
    current_user: CurrentUser
):
    """Reset a failed item back to pending for retry"""
    await require_any_school_admin(current_user, db)

    service = PrintQueueService(db)
    item = await service.retry_failed(item_id)

    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Queue item not found or not in failed status"
        )

    await db.commit()

    # Broadcast as new pending item
    await sse_manager.broadcast_print_queue_event(
        "new_sale",
        {
            "id": str(item.id),
            "sale_id": str(item.sale_id),
            "school_id": str(item.school_id),
            "sale_code": item.sale_code,
            "sale_total": float(item.sale_total),
            "client_name": item.client_name,
            "school_name": item.school_name,
            "source_device": item.source_device,
            "created_at": item.created_at.isoformat(),
            "retry_count": item.retry_count
        }
    )

    return PrintQueueItemResponse.model_validate(item)


@router.delete(
    "/cleanup",
    summary="Clean up old processed items",
)
async def cleanup_old_items(
    db: DatabaseSession,
    current_user: CurrentUser,
    days: int = Query(7, ge=1, le=90, description="Delete items older than this many days")
):
    """
    Delete processed (printed/skipped) items older than specified days.
    Failed items are NOT deleted to allow investigation.
    """
    await require_any_school_admin(current_user, db)

    service = PrintQueueService(db)
    deleted_count = await service.cleanup_old_items(days)
    await db.commit()

    return {"deleted_count": deleted_count, "days": days}


@router.get(
    "/connection-info",
    summary="Get SSE connection info",
)
async def get_connection_info(
    current_user: CurrentUser,
    db: DatabaseSession
):
    """Get information about current SSE connections"""
    await require_any_school_admin(current_user, db)

    return {
        "total_connections": sse_manager.get_connection_count(),
        "unique_users": sse_manager.get_user_count()
    }
