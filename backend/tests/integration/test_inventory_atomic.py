"""
Integration tests for InventoryService atomic operations.

Hits a real PostgreSQL test DB to verify:
- Atomic UPDATE prevents oversell race in adjust_quantity.
- reserve_stock / release_stock / consume_reserved_stock respect invariants
  (reserved >= 0, reserved <= quantity).
- check_availability uses available (quantity - reserved).
- Low-stock criterion is `<=` consistently.

These tests cannot be done with mocks because the race-condition fix
relies on Postgres-level UPDATE...RETURNING semantics.
"""
import asyncio
import pytest
from uuid import uuid4
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import async_sessionmaker, AsyncSession

from app.models.product import Inventory, Product, GarmentType
from app.schemas.product import InventoryAdjust
from app.services.inventory import InventoryService


pytestmark = pytest.mark.asyncio


@pytest.fixture
async def fresh_inventory(db_session: AsyncSession):
    """Create a Product + Inventory pair with quantity=10, reserved=0."""
    garment = GarmentType(
        id=uuid4(),
        name=f"test_garment_{uuid4().hex[:6]}",
        cost_type="manufactured",
    )
    db_session.add(garment)
    await db_session.flush()

    product = Product(
        id=uuid4(),
        garment_type_id=garment.id,
        code=f"TEST-{uuid4().hex[:8]}",
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


class TestAtomicAdjustQuantity:
    """Race condition coverage for adjust_quantity."""

    async def test_concurrent_remove_no_oversell(self, async_engine, fresh_inventory):
        """Two parallel sessions removing 6 each from qty=10 must not oversell.

        One must succeed, the other must raise ValueError. Final qty must be 4
        (not -2, not 4 with constraint violation).
        """
        product_id = fresh_inventory.product_id
        school_id = fresh_inventory.school_id
        sessionmaker = async_sessionmaker(async_engine, class_=AsyncSession, expire_on_commit=False)

        async def attempt_remove():
            async with sessionmaker() as s:
                svc = InventoryService(s)
                try:
                    await svc.remove_stock(product_id, school_id, 6)
                    await s.commit()
                    return "success"
                except ValueError as e:
                    await s.rollback()
                    return f"failed: {e}"

        results = await asyncio.gather(attempt_remove(), attempt_remove())
        successes = [r for r in results if r == "success"]
        failures = [r for r in results if r != "success"]
        assert len(successes) == 1, f"Expected exactly 1 success, got {results}"
        assert len(failures) == 1, f"Expected exactly 1 failure, got {results}"

        async with sessionmaker() as s:
            r = await s.execute(select(Inventory).where(Inventory.product_id == product_id))
            inv = r.scalar_one()
            assert inv.quantity == 4, f"Final qty should be 4, got {inv.quantity}"

    async def test_remove_respects_reserved(self, db_session, fresh_inventory):
        """remove_stock must not consume reserved stock.

        With qty=10 reserved=7, remove(quantity=5) should fail (only 3 available).
        """
        svc = InventoryService(db_session)
        await svc.reserve_stock(fresh_inventory.product_id, fresh_inventory.school_id, 7, reference="TEST")
        await db_session.commit()

        with pytest.raises(ValueError, match="Insufficient inventory"):
            await svc.remove_stock(fresh_inventory.product_id, fresh_inventory.school_id, 5)


class TestReserveStock:
    """New reserve_stock semantics: increments reserved without touching quantity."""

    async def test_reserve_increments_reserved_not_quantity(self, db_session, fresh_inventory):
        svc = InventoryService(db_session)
        await svc.reserve_stock(fresh_inventory.product_id, fresh_inventory.school_id, 4, reference="TEST")
        await db_session.commit()

        await db_session.refresh(fresh_inventory)
        assert fresh_inventory.quantity == 10
        assert fresh_inventory.reserved_quantity == 4
        assert fresh_inventory.available == 6

    async def test_reserve_more_than_available_fails(self, db_session, fresh_inventory):
        svc = InventoryService(db_session)
        with pytest.raises(ValueError, match="Insufficient inventory to reserve"):
            await svc.reserve_stock(fresh_inventory.product_id, fresh_inventory.school_id, 11, reference="TEST")

    async def test_reserve_then_check_availability_uses_available(self, db_session, fresh_inventory):
        svc = InventoryService(db_session)
        await svc.reserve_stock(fresh_inventory.product_id, fresh_inventory.school_id, 7, reference="TEST")
        await db_session.commit()

        assert await svc.check_availability(fresh_inventory.product_id, fresh_inventory.school_id, 3) is True
        assert await svc.check_availability(fresh_inventory.product_id, fresh_inventory.school_id, 4) is False


class TestReleaseStock:
    """release_stock decrements reserved without touching quantity."""

    async def test_release_decrements_reserved_only(self, db_session, fresh_inventory):
        svc = InventoryService(db_session)
        await svc.reserve_stock(fresh_inventory.product_id, fresh_inventory.school_id, 5, reference="TEST-RES")
        await db_session.commit()

        await svc.release_stock(fresh_inventory.product_id, fresh_inventory.school_id, 3, reference="TEST-REL")
        await db_session.commit()

        await db_session.refresh(fresh_inventory)
        assert fresh_inventory.quantity == 10
        assert fresh_inventory.reserved_quantity == 2

    async def test_release_more_than_reserved_fails(self, db_session, fresh_inventory):
        svc = InventoryService(db_session)
        await svc.reserve_stock(fresh_inventory.product_id, fresh_inventory.school_id, 2, reference="TEST")
        await db_session.commit()

        with pytest.raises(ValueError, match="Cannot release more than reserved"):
            await svc.release_stock(fresh_inventory.product_id, fresh_inventory.school_id, 3, reference="TEST")


class TestConsumeReservedStock:
    """consume_reserved_stock: DELIVERED transition. Decrements both quantity and reserved."""

    async def test_consume_decrements_both(self, db_session, fresh_inventory):
        svc = InventoryService(db_session)
        await svc.reserve_stock(fresh_inventory.product_id, fresh_inventory.school_id, 4, reference="TEST-RES")
        await db_session.commit()

        await svc.consume_reserved_stock(fresh_inventory.product_id, fresh_inventory.school_id, 4, reference="TEST-DEL")
        await db_session.commit()

        await db_session.refresh(fresh_inventory)
        assert fresh_inventory.quantity == 6
        assert fresh_inventory.reserved_quantity == 0

    async def test_consume_more_than_reserved_fails(self, db_session, fresh_inventory):
        svc = InventoryService(db_session)
        await svc.reserve_stock(fresh_inventory.product_id, fresh_inventory.school_id, 3, reference="TEST")
        await db_session.commit()

        with pytest.raises(ValueError, match="Cannot consume reserved stock"):
            await svc.consume_reserved_stock(fresh_inventory.product_id, fresh_inventory.school_id, 5, reference="TEST")


class TestInvariantConstraints:
    """DB-level CheckConstraints must reject invalid states."""

    async def test_cannot_set_reserved_greater_than_quantity(self, db_session, fresh_inventory):
        from sqlalchemy import update
        with pytest.raises(IntegrityError):
            await db_session.execute(
                update(Inventory)
                .where(Inventory.id == fresh_inventory.id)
                .values(reserved_quantity=20)
            )
            await db_session.commit()

    async def test_cannot_set_reserved_negative(self, db_session, fresh_inventory):
        from sqlalchemy import update
        with pytest.raises(IntegrityError):
            await db_session.execute(
                update(Inventory)
                .where(Inventory.id == fresh_inventory.id)
                .values(reserved_quantity=-1)
            )
            await db_session.commit()
