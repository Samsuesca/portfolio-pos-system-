"""
Print Queue Service

Manages the print queue for synchronizing cash sales across devices.
Provides methods for enqueueing, processing, and status management.
"""
import logging
from datetime import datetime, timedelta
from decimal import Decimal
from uuid import UUID
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.utils.timezone import get_colombia_now_naive
from app.models.print_queue import PrintQueueItem, PrintQueueStatus
from app.models.sale import Sale

logger = logging.getLogger(__name__)


class PrintQueueService:
    """Service for managing the print queue"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def enqueue_sale(
        self,
        sale: Sale,
        school_id: UUID,
        source_device: str | None = None,
        client_name: str | None = None,
        school_name: str | None = None
    ) -> PrintQueueItem:
        """
        Add a cash sale to the print queue.

        Only call this for sales with cash payment method.
        """
        item = PrintQueueItem(
            sale_id=sale.id,
            school_id=school_id,
            sale_code=sale.code,
            sale_total=Decimal(str(sale.total)),
            client_name=client_name,
            school_name=school_name,
            source_device=source_device,
            print_receipt=True,
            open_drawer=True,
            status=PrintQueueStatus.PENDING
        )
        self.db.add(item)
        await self.db.flush()
        await self.db.refresh(item)

        logger.info(f"Print queue: Enqueued sale {sale.code} from {source_device}")
        return item

    async def get_pending_items(self, limit: int = 50) -> list[PrintQueueItem]:
        """Get all pending items in the queue, ordered by creation time"""
        result = await self.db.execute(
            select(PrintQueueItem)
            .where(PrintQueueItem.status == PrintQueueStatus.PENDING)
            .order_by(PrintQueueItem.created_at.asc())
            .limit(limit)
        )
        return list(result.scalars().all())

    async def get_item(self, item_id: UUID) -> PrintQueueItem | None:
        """Get a specific queue item"""
        result = await self.db.execute(
            select(PrintQueueItem).where(PrintQueueItem.id == item_id)
        )
        return result.scalar_one_or_none()

    async def get_item_by_sale(self, sale_id: UUID) -> PrintQueueItem | None:
        """Get queue item by sale ID (most recent)"""
        result = await self.db.execute(
            select(PrintQueueItem)
            .where(PrintQueueItem.sale_id == sale_id)
            .order_by(PrintQueueItem.created_at.desc())
            .limit(1)
        )
        return result.scalar_one_or_none()

    async def mark_as_printed(self, item_id: UUID) -> PrintQueueItem | None:
        """Mark an item as successfully printed"""
        item = await self.get_item(item_id)
        if item:
            item.status = PrintQueueStatus.PRINTED
            item.processed_at = get_colombia_now_naive()
            await self.db.flush()
            await self.db.refresh(item)
            logger.info(f"Print queue: Marked {item.sale_code} as printed")
        return item

    async def mark_as_skipped(self, item_id: UUID) -> PrintQueueItem | None:
        """Mark an item as skipped (user chose not to print)"""
        item = await self.get_item(item_id)
        if item:
            item.status = PrintQueueStatus.SKIPPED
            item.processed_at = get_colombia_now_naive()
            await self.db.flush()
            await self.db.refresh(item)
            logger.info(f"Print queue: Marked {item.sale_code} as skipped")
        return item

    async def mark_as_failed(
        self,
        item_id: UUID,
        error_message: str
    ) -> PrintQueueItem | None:
        """Mark an item as failed with error message"""
        item = await self.get_item(item_id)
        if item:
            item.status = PrintQueueStatus.FAILED
            item.error_message = error_message
            item.retry_count += 1
            item.processed_at = get_colombia_now_naive()
            await self.db.flush()
            await self.db.refresh(item)
            logger.warning(f"Print queue: Marked {item.sale_code} as failed: {error_message}")
        return item

    async def retry_failed(self, item_id: UUID) -> PrintQueueItem | None:
        """Reset a failed item back to pending for retry"""
        item = await self.get_item(item_id)
        if item and item.status == PrintQueueStatus.FAILED:
            item.status = PrintQueueStatus.PENDING
            item.error_message = None
            item.processed_at = None
            await self.db.flush()
            await self.db.refresh(item)
            logger.info(f"Print queue: Reset {item.sale_code} to pending for retry")
        return item

    async def get_stats(self) -> dict:
        """Get queue statistics for today"""
        today_start = get_colombia_now_naive().replace(hour=0, minute=0, second=0, microsecond=0)

        # Pending count (all time)
        pending_result = await self.db.execute(
            select(func.count(PrintQueueItem.id))
            .where(PrintQueueItem.status == PrintQueueStatus.PENDING)
        )
        pending_count = pending_result.scalar() or 0

        # Today's stats - based on processed_at
        today_filter = PrintQueueItem.processed_at >= today_start

        printed_result = await self.db.execute(
            select(func.count(PrintQueueItem.id))
            .where(and_(
                PrintQueueItem.status == PrintQueueStatus.PRINTED,
                today_filter
            ))
        )
        printed_today = printed_result.scalar() or 0

        skipped_result = await self.db.execute(
            select(func.count(PrintQueueItem.id))
            .where(and_(
                PrintQueueItem.status == PrintQueueStatus.SKIPPED,
                today_filter
            ))
        )
        skipped_today = skipped_result.scalar() or 0

        failed_result = await self.db.execute(
            select(func.count(PrintQueueItem.id))
            .where(and_(
                PrintQueueItem.status == PrintQueueStatus.FAILED,
                today_filter
            ))
        )
        failed_today = failed_result.scalar() or 0

        return {
            "pending_count": pending_count,
            "printed_today": printed_today,
            "skipped_today": skipped_today,
            "failed_today": failed_today
        }

    async def cleanup_old_items(self, days: int = 7) -> int:
        """
        Delete processed items older than specified days.
        Returns count of deleted items.
        """
        cutoff = get_colombia_now_naive() - timedelta(days=days)

        result = await self.db.execute(
            select(PrintQueueItem)
            .where(and_(
                PrintQueueItem.status.in_([
                    PrintQueueStatus.PRINTED,
                    PrintQueueStatus.SKIPPED
                ]),
                PrintQueueItem.processed_at < cutoff
            ))
        )
        old_items = result.scalars().all()

        count = len(old_items)
        for item in old_items:
            await self.db.delete(item)

        await self.db.flush()
        logger.info(f"Print queue: Cleaned up {count} old items (>{days} days)")
        return count
