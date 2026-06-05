"""
Integration tests for InventoryLogService retry + DLQ.

Hits the real test postgres to verify:
- create_log_with_retry succeeds normally.
- When the log insert fails (FK violation), all 3 retries fire and the
  event lands in failed_inventory_logs.
- reprocess_failed_logs picks up unresolved rows and re-inserts them.
- The main transaction (stock mutation) is never aborted by log failure.
"""
import asyncio
import pytest
from uuid import uuid4
from datetime import date
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.inventory_log import InventoryLog, FailedInventoryLog, InventoryMovementType
from app.models.product import Inventory, Product, GarmentType
from app.services.inventory import InventoryService
from app.services.inventory_log import InventoryLogService


pytestmark = pytest.mark.asyncio


@pytest.fixture
async def fresh_inventory(db_session: AsyncSession):
    """Product + Inventory pair with quantity=10."""
    garment = GarmentType(
        id=uuid4(),
        name=f"dlq_garment_{uuid4().hex[:6]}",
        cost_type="manufactured",
    )
    db_session.add(garment)
    await db_session.flush()

    product = Product(
        id=uuid4(),
        garment_type_id=garment.id,
        code=f"DLQ-{uuid4().hex[:8]}",
        size="M",
        price=10000,
    )
    db_session.add(product)
    await db_session.flush()

    inv = Inventory(
        id=uuid4(),
        product_id=product.id,
        quantity=10,
        reserved_quantity=0,
        min_stock_alert=5,
    )
    db_session.add(inv)
    await db_session.commit()
    await db_session.refresh(inv)
    return inv


class TestCreateLogWithRetry:
    """Happy path + retry path of create_log_with_retry."""

    async def test_create_log_succeeds_first_try(self, db_session, fresh_inventory):
        svc = InventoryLogService(db_session)
        log = await svc.create_log_with_retry(
            inventory_id=fresh_inventory.id,
            school_id=fresh_inventory.school_id,
            movement_type=InventoryMovementType.SALE,
            quantity_delta=-1,
            quantity_after=9,
            description="test sale",
            reference="TEST-001",
        )
        await db_session.commit()
        assert log is not None
        assert log.movement_type == InventoryMovementType.SALE
        assert log.quantity_delta == -1

        result = await db_session.execute(
            select(FailedInventoryLog).where(FailedInventoryLog.reference == "TEST-001")
        )
        assert result.scalar_one_or_none() is None, "DLQ should be empty on success"

    async def test_failed_log_lands_in_dlq(self, db_session, fresh_inventory):
        """FK violation on order_id triggers retry exhaustion + DLQ insert.

        Uses a non-existent order_id which the FK constraint rejects.
        """
        bogus_order = uuid4()
        svc = InventoryLogService(db_session)

        log = await svc.create_log_with_retry(
            inventory_id=fresh_inventory.id,
            school_id=fresh_inventory.school_id,
            movement_type=InventoryMovementType.ORDER_RESERVE,
            quantity_delta=-2,
            quantity_after=8,
            description="test reserve with bogus order_id",
            reference="DLQ-TEST",
            order_id=bogus_order,
        )

        assert log is None, "Should have given up after 3 retries"

        # DLQ row written via separate session, so commit our test session
        # to make the change visible across sessions.
        await db_session.commit()

        # Query DLQ via a fresh session to mirror reality
        from sqlalchemy.ext.asyncio import async_sessionmaker, AsyncSession
        fresh_factory = async_sessionmaker(db_session.bind, class_=AsyncSession, expire_on_commit=False)
        async with fresh_factory() as fresh:
            result = await fresh.execute(
                select(FailedInventoryLog).where(FailedInventoryLog.reference == "DLQ-TEST")
            )
            failed = result.scalar_one_or_none()
            assert failed is not None
            assert failed.movement_type == "order_reserve"
            assert failed.quantity_delta == -2
            assert failed.retry_count == 3
            assert failed.resolved is False
            assert "order_id" in failed.error_message.lower() or "foreign" in failed.error_message.lower()


class TestStockMutationSurvivesLogFailure:
    """The whole point of retry+DLQ: stock changes commit even if log fails."""

    async def test_reserve_stock_succeeds_when_log_fails(self, db_session, fresh_inventory):
        """Even with a bogus order_id, the reserve must persist."""
        svc = InventoryService(db_session)
        bogus_order = uuid4()

        await svc.reserve_stock(
            product_id=fresh_inventory.product_id,
            school_id=fresh_inventory.school_id,
            quantity=3,
            order_id=bogus_order,
            reference="DLQ-RESERVE",
        )
        await db_session.commit()

        await db_session.refresh(fresh_inventory)
        assert fresh_inventory.reserved_quantity == 3, (
            "Stock reserve must persist even when audit log fails"
        )
        assert fresh_inventory.quantity == 10

        from sqlalchemy.ext.asyncio import async_sessionmaker, AsyncSession
        fresh_factory = async_sessionmaker(db_session.bind, class_=AsyncSession, expire_on_commit=False)
        async with fresh_factory() as fresh:
            r = await fresh.execute(
                select(FailedInventoryLog).where(FailedInventoryLog.reference == "DLQ-RESERVE")
            )
            assert r.scalar_one_or_none() is not None, "Failed log should be in DLQ"


class TestReprocessFailedLogs:
    """Cron worker reprocessing path."""

    async def test_reprocess_resolves_when_fk_now_valid(self, db_session, fresh_inventory):
        """Insert a synthetic failed log without FK errors, then reprocess.

        Simulates the case where the original failure was transient (e.g.
        DB hiccup) and the reprocess attempt now succeeds.
        """
        from app.utils.timezone import get_colombia_now_naive
        failed = FailedInventoryLog(
            inventory_id=fresh_inventory.id,
            school_id=fresh_inventory.school_id,
            movement_type=InventoryMovementType.SALE.value,
            movement_date=date.today(),
            quantity_delta=-1,
            quantity_after=9,
            description="reprocess test",
            reference="REPROC-001",
            original_created_at=get_colombia_now_naive(),
            error_message="simulated transient DB hiccup",
            retry_count=3,
        )
        db_session.add(failed)
        await db_session.commit()

        svc = InventoryLogService(db_session)
        result = await svc.reprocess_failed_logs()

        assert result["processed"] >= 1
        assert result["resolved"] >= 1

        await db_session.refresh(failed)
        assert failed.resolved is True
        assert failed.resolved_log_id is not None
        assert failed.resolved_at is not None

        # The reprocessed log exists in inventory_logs
        log_result = await db_session.execute(
            select(InventoryLog).where(InventoryLog.id == failed.resolved_log_id)
        )
        assert log_result.scalar_one() is not None

    async def test_reprocess_increments_retry_when_still_failing(self, db_session, fresh_inventory):
        """If the FK still doesn't exist, reprocess marks retry but keeps unresolved."""
        from app.utils.timezone import get_colombia_now_naive
        failed = FailedInventoryLog(
            inventory_id=fresh_inventory.id,
            school_id=fresh_inventory.school_id,
            movement_type=InventoryMovementType.ORDER_RESERVE.value,
            movement_date=date.today(),
            quantity_delta=-1,
            quantity_after=9,
            description="still-failing test",
            reference="STILL-FAIL",
            order_id=uuid4(),  # Bogus, FK will reject again
            original_created_at=get_colombia_now_naive(),
            error_message="initial fk error",
            retry_count=3,
        )
        db_session.add(failed)
        await db_session.commit()

        original_retry_count = failed.retry_count
        svc = InventoryLogService(db_session)
        result = await svc.reprocess_failed_logs()

        await db_session.refresh(failed)
        assert failed.resolved is False
        assert failed.retry_count > original_retry_count
        assert failed.last_retry_at is not None
        assert result["still_failing"] >= 1
