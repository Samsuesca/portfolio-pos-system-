"""
Unit Tests for PrintQueueService

Tests print queue lifecycle: enqueue, status transitions,
stats aggregation, and cleanup of old items.
"""
import pytest
from datetime import datetime, timedelta
from decimal import Decimal
from uuid import uuid4
from unittest.mock import AsyncMock, MagicMock, patch

from app.services.print_queue import PrintQueueService
from app.models.print_queue import PrintQueueStatus


FAKE_NOW = datetime(2026, 4, 14, 10, 0, 0)


def _make_sale(code="V-001", total=Decimal("50000")):
    sale = MagicMock()
    sale.id = uuid4()
    sale.code = code
    sale.total = total
    return sale


def _make_queue_item(
    status=PrintQueueStatus.PENDING,
    sale_code="V-001",
    retry_count=0,
    error_message=None,
    processed_at=None,
):
    item = MagicMock()
    item.id = uuid4()
    item.sale_id = uuid4()
    item.sale_code = sale_code
    item.status = status
    item.retry_count = retry_count
    item.error_message = error_message
    item.processed_at = processed_at
    return item


# ============================================================================
# enqueue_sale
# ============================================================================

class TestEnqueueSale:

    @pytest.mark.asyncio
    @patch("app.services.print_queue.get_colombia_now_naive", return_value=FAKE_NOW)
    async def test_creates_item_with_correct_fields(self, _tz, mock_db_session):
        sale = _make_sale(code="V-100", total=Decimal("75000"))
        school_id = uuid4()

        captured = {}

        def capture_add(obj):
            captured["item"] = obj

        mock_db_session.add = capture_add
        svc = PrintQueueService(mock_db_session)

        result = await svc.enqueue_sale(
            sale=sale,
            school_id=school_id,
            source_device="desktop_app",
            client_name="Ana Garcia",
            school_name="Colegio Test",
        )

        item = captured["item"]
        assert item.sale_id == sale.id
        assert item.school_id == school_id
        assert item.sale_code == "V-100"
        assert item.sale_total == Decimal("75000")
        assert item.client_name == "Ana Garcia"
        assert item.source_device == "desktop_app"
        assert item.print_receipt is True
        assert item.open_drawer is True
        assert item.status == PrintQueueStatus.PENDING


# ============================================================================
# get_pending_items
# ============================================================================

class TestGetPendingItems:

    @pytest.mark.asyncio
    async def test_returns_pending_items(self, mock_db_session):
        items = [_make_queue_item(), _make_queue_item()]
        mock_db_session.execute = AsyncMock(
            return_value=MagicMock(scalars=MagicMock(return_value=MagicMock(all=MagicMock(return_value=items))))
        )
        svc = PrintQueueService(mock_db_session)

        result = await svc.get_pending_items()

        assert len(result) == 2

    @pytest.mark.asyncio
    async def test_returns_empty_when_no_pending(self, mock_db_session):
        mock_db_session.execute = AsyncMock(
            return_value=MagicMock(scalars=MagicMock(return_value=MagicMock(all=MagicMock(return_value=[]))))
        )
        svc = PrintQueueService(mock_db_session)

        result = await svc.get_pending_items()

        assert result == []


# ============================================================================
# get_item / get_item_by_sale
# ============================================================================

class TestGetItem:

    @pytest.mark.asyncio
    async def test_returns_item_when_found(self, mock_db_session):
        item = _make_queue_item()
        mock_db_session.execute = AsyncMock(
            return_value=MagicMock(scalar_one_or_none=MagicMock(return_value=item))
        )
        svc = PrintQueueService(mock_db_session)

        result = await svc.get_item(item.id)

        assert result is item

    @pytest.mark.asyncio
    async def test_returns_none_when_not_found(self, mock_db_session):
        mock_db_session.execute = AsyncMock(
            return_value=MagicMock(scalar_one_or_none=MagicMock(return_value=None))
        )
        svc = PrintQueueService(mock_db_session)

        result = await svc.get_item(uuid4())

        assert result is None


class TestGetItemBySale:

    @pytest.mark.asyncio
    async def test_returns_item_when_found(self, mock_db_session):
        item = _make_queue_item()
        mock_db_session.execute = AsyncMock(
            return_value=MagicMock(scalar_one_or_none=MagicMock(return_value=item))
        )
        svc = PrintQueueService(mock_db_session)

        result = await svc.get_item_by_sale(item.sale_id)

        assert result is item

    @pytest.mark.asyncio
    async def test_returns_none_when_not_found(self, mock_db_session):
        mock_db_session.execute = AsyncMock(
            return_value=MagicMock(scalar_one_or_none=MagicMock(return_value=None))
        )
        svc = PrintQueueService(mock_db_session)

        result = await svc.get_item_by_sale(uuid4())

        assert result is None


# ============================================================================
# mark_as_printed
# ============================================================================

class TestMarkAsPrinted:

    @pytest.mark.asyncio
    @patch("app.services.print_queue.get_colombia_now_naive", return_value=FAKE_NOW)
    async def test_updates_status_and_processed_at(self, _tz, mock_db_session):
        item = _make_queue_item(status=PrintQueueStatus.PENDING)
        mock_db_session.execute = AsyncMock(
            return_value=MagicMock(scalar_one_or_none=MagicMock(return_value=item))
        )
        svc = PrintQueueService(mock_db_session)

        result = await svc.mark_as_printed(item.id)

        assert item.status == PrintQueueStatus.PRINTED
        assert item.processed_at == FAKE_NOW

    @pytest.mark.asyncio
    async def test_returns_none_when_not_found(self, mock_db_session):
        mock_db_session.execute = AsyncMock(
            return_value=MagicMock(scalar_one_or_none=MagicMock(return_value=None))
        )
        svc = PrintQueueService(mock_db_session)

        result = await svc.mark_as_printed(uuid4())

        assert result is None


# ============================================================================
# mark_as_skipped
# ============================================================================

class TestMarkAsSkipped:

    @pytest.mark.asyncio
    @patch("app.services.print_queue.get_colombia_now_naive", return_value=FAKE_NOW)
    async def test_updates_status(self, _tz, mock_db_session):
        item = _make_queue_item(status=PrintQueueStatus.PENDING)
        mock_db_session.execute = AsyncMock(
            return_value=MagicMock(scalar_one_or_none=MagicMock(return_value=item))
        )
        svc = PrintQueueService(mock_db_session)

        result = await svc.mark_as_skipped(item.id)

        assert item.status == PrintQueueStatus.SKIPPED
        assert item.processed_at == FAKE_NOW


# ============================================================================
# mark_as_failed
# ============================================================================

class TestMarkAsFailed:

    @pytest.mark.asyncio
    @patch("app.services.print_queue.get_colombia_now_naive", return_value=FAKE_NOW)
    async def test_sets_error_and_increments_retry(self, _tz, mock_db_session):
        item = _make_queue_item(status=PrintQueueStatus.PENDING, retry_count=0)
        mock_db_session.execute = AsyncMock(
            return_value=MagicMock(scalar_one_or_none=MagicMock(return_value=item))
        )
        svc = PrintQueueService(mock_db_session)

        result = await svc.mark_as_failed(item.id, "Printer offline")

        assert item.status == PrintQueueStatus.FAILED
        assert item.error_message == "Printer offline"
        assert item.retry_count == 1

    @pytest.mark.asyncio
    async def test_returns_none_when_not_found(self, mock_db_session):
        mock_db_session.execute = AsyncMock(
            return_value=MagicMock(scalar_one_or_none=MagicMock(return_value=None))
        )
        svc = PrintQueueService(mock_db_session)

        result = await svc.mark_as_failed(uuid4(), "error")

        assert result is None


# ============================================================================
# retry_failed
# ============================================================================

class TestRetryFailed:

    @pytest.mark.asyncio
    async def test_resets_failed_item_to_pending(self, mock_db_session):
        item = _make_queue_item(
            status=PrintQueueStatus.FAILED,
            error_message="Printer offline",
            processed_at=FAKE_NOW,
        )
        mock_db_session.execute = AsyncMock(
            return_value=MagicMock(scalar_one_or_none=MagicMock(return_value=item))
        )
        svc = PrintQueueService(mock_db_session)

        result = await svc.retry_failed(item.id)

        assert item.status == PrintQueueStatus.PENDING
        assert item.error_message is None
        assert item.processed_at is None

    @pytest.mark.asyncio
    async def test_does_not_reset_non_failed_item(self, mock_db_session):
        item = _make_queue_item(status=PrintQueueStatus.PRINTED)
        mock_db_session.execute = AsyncMock(
            return_value=MagicMock(scalar_one_or_none=MagicMock(return_value=item))
        )
        svc = PrintQueueService(mock_db_session)

        result = await svc.retry_failed(item.id)

        assert item.status == PrintQueueStatus.PRINTED


# ============================================================================
# get_stats
# ============================================================================

class TestGetStats:

    @pytest.mark.asyncio
    @patch("app.services.print_queue.get_colombia_now_naive", return_value=FAKE_NOW)
    async def test_returns_counts(self, _tz, mock_db_session):
        scalars = [5, 10, 2, 1]
        call_idx = 0

        async def fake_execute(stmt):
            nonlocal call_idx
            val = scalars[call_idx]
            call_idx += 1
            return MagicMock(scalar=MagicMock(return_value=val))

        mock_db_session.execute = fake_execute
        svc = PrintQueueService(mock_db_session)

        result = await svc.get_stats()

        assert result["pending_count"] == 5
        assert result["printed_today"] == 10
        assert result["skipped_today"] == 2
        assert result["failed_today"] == 1

    @pytest.mark.asyncio
    @patch("app.services.print_queue.get_colombia_now_naive", return_value=FAKE_NOW)
    async def test_returns_zeros_when_empty(self, _tz, mock_db_session):
        async def fake_execute(stmt):
            return MagicMock(scalar=MagicMock(return_value=0))

        mock_db_session.execute = fake_execute
        svc = PrintQueueService(mock_db_session)

        result = await svc.get_stats()

        assert result["pending_count"] == 0
        assert result["printed_today"] == 0


# ============================================================================
# cleanup_old_items
# ============================================================================

class TestCleanupOldItems:

    @pytest.mark.asyncio
    @patch("app.services.print_queue.get_colombia_now_naive", return_value=FAKE_NOW)
    async def test_deletes_old_printed_and_skipped(self, _tz, mock_db_session):
        old_items = [_make_queue_item(status=PrintQueueStatus.PRINTED) for _ in range(3)]
        mock_db_session.execute = AsyncMock(
            return_value=MagicMock(scalars=MagicMock(return_value=MagicMock(all=MagicMock(return_value=old_items))))
        )
        svc = PrintQueueService(mock_db_session)

        count = await svc.cleanup_old_items(days=7)

        assert count == 3
        assert mock_db_session.delete.await_count == 3

    @pytest.mark.asyncio
    @patch("app.services.print_queue.get_colombia_now_naive", return_value=FAKE_NOW)
    async def test_returns_zero_when_nothing_to_clean(self, _tz, mock_db_session):
        mock_db_session.execute = AsyncMock(
            return_value=MagicMock(scalars=MagicMock(return_value=MagicMock(all=MagicMock(return_value=[]))))
        )
        svc = PrintQueueService(mock_db_session)

        count = await svc.cleanup_old_items()

        assert count == 0
        mock_db_session.delete.assert_not_awaited()
