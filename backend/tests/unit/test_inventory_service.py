"""
Unit Tests for InventoryService

Tests inventory management logic including:
- Stock availability checking
- Stock reservation and release
- Stock adjustments (add/remove)
- Low stock detection
"""
import pytest
from decimal import Decimal
from uuid import uuid4
from unittest.mock import AsyncMock, MagicMock, patch

from app.services.inventory import InventoryService
from app.schemas.product import InventoryAdjust


# ============================================================================
# TEST: check_availability
# ============================================================================

class TestCheckAvailability:
    """Tests for InventoryService.check_availability"""

    @pytest.mark.asyncio
    async def test_check_availability_sufficient_stock(
        self, mock_db_session, inventory_factory
    ):
        """Should return True when stock >= requested quantity"""
        # Arrange
        inventory = inventory_factory(quantity=50)
        mock_db_session.execute = AsyncMock(
            return_value=MagicMock(scalar_one_or_none=MagicMock(return_value=inventory))
        )
        service = InventoryService(mock_db_session)

        # Act
        result = await service.check_availability(
            product_id=inventory.product_id,
            school_id=inventory.school_id,
            quantity=30
        )

        # Assert
        assert result is True

    @pytest.mark.asyncio
    async def test_check_availability_exact_stock(
        self, mock_db_session, inventory_factory
    ):
        """Should return True when stock == requested quantity"""
        inventory = inventory_factory(quantity=50)
        mock_db_session.execute = AsyncMock(
            return_value=MagicMock(scalar_one_or_none=MagicMock(return_value=inventory))
        )
        service = InventoryService(mock_db_session)

        result = await service.check_availability(
            product_id=inventory.product_id,
            school_id=inventory.school_id,
            quantity=50
        )

        assert result is True

    @pytest.mark.asyncio
    async def test_check_availability_insufficient_stock(
        self, mock_db_session, inventory_factory
    ):
        """Should return False when stock < requested quantity"""
        inventory = inventory_factory(quantity=10)
        mock_db_session.execute = AsyncMock(
            return_value=MagicMock(scalar_one_or_none=MagicMock(return_value=inventory))
        )
        service = InventoryService(mock_db_session)

        result = await service.check_availability(
            product_id=inventory.product_id,
            school_id=inventory.school_id,
            quantity=20
        )

        assert result is False

    @pytest.mark.asyncio
    async def test_check_availability_product_not_found(self, mock_db_session):
        """Should return False when product has no inventory"""
        mock_db_session.execute = AsyncMock(
            return_value=MagicMock(scalar_one_or_none=MagicMock(return_value=None))
        )
        service = InventoryService(mock_db_session)

        result = await service.check_availability(
            product_id=str(uuid4()),
            school_id=str(uuid4()),
            quantity=1
        )

        assert result is False

    @pytest.mark.asyncio
    async def test_check_availability_zero_stock(
        self, mock_db_session, inventory_factory
    ):
        """Should return False when stock is zero"""
        inventory = inventory_factory(quantity=0)
        mock_db_session.execute = AsyncMock(
            return_value=MagicMock(scalar_one_or_none=MagicMock(return_value=inventory))
        )
        service = InventoryService(mock_db_session)

        result = await service.check_availability(
            product_id=inventory.product_id,
            school_id=inventory.school_id,
            quantity=1
        )

        assert result is False


# ============================================================================
# TEST: add_stock
# ============================================================================

class TestAddStock:
    """Tests for InventoryService.add_stock"""

    @pytest.mark.asyncio
    async def test_add_stock_success(self, mock_db_session, inventory_factory):
        """Should increase stock by specified quantity"""
        inventory = inventory_factory(quantity=50)
        mock_db_session.execute = AsyncMock(
            return_value=MagicMock(scalar_one_or_none=MagicMock(return_value=inventory))
        )
        mock_db_session.flush = AsyncMock()
        mock_db_session.refresh = AsyncMock()

        service = InventoryService(mock_db_session)

        result = await service.add_stock(
            product_id=inventory.product_id,
            school_id=inventory.school_id,
            quantity=10,
            reason="Stock receipt"
        )

        # Verify quantity was updated
        assert inventory.quantity == 60  # 50 + 10

    @pytest.mark.asyncio
    async def test_add_stock_zero_quantity_raises_error(self, mock_db_session):
        """Should raise ValueError for zero quantity"""
        service = InventoryService(mock_db_session)

        with pytest.raises(ValueError, match="Quantity must be positive"):
            await service.add_stock(
                product_id=str(uuid4()),
                school_id=str(uuid4()),
                quantity=0,
                reason="Invalid"
            )

    @pytest.mark.asyncio
    async def test_add_stock_negative_quantity_raises_error(self, mock_db_session):
        """Should raise ValueError for negative quantity"""
        service = InventoryService(mock_db_session)

        with pytest.raises(ValueError, match="Quantity must be positive"):
            await service.add_stock(
                product_id=str(uuid4()),
                school_id=str(uuid4()),
                quantity=-10,
                reason="Invalid"
            )

    @pytest.mark.asyncio
    async def test_add_stock_inventory_not_found(self, mock_db_session):
        """Should raise ValueError when inventory doesn't exist"""
        mock_db_session.execute = AsyncMock(
            return_value=MagicMock(scalar_one_or_none=MagicMock(return_value=None))
        )
        service = InventoryService(mock_db_session)

        with pytest.raises(ValueError, match="Inventory not found"):
            await service.add_stock(
                product_id=str(uuid4()),
                school_id=str(uuid4()),
                quantity=10,
                reason="Stock receipt"
            )


# ============================================================================
# TEST: remove_stock
# ============================================================================

class TestRemoveStock:
    """Tests for InventoryService.remove_stock"""

    @pytest.mark.asyncio
    async def test_remove_stock_success(self, mock_db_session, inventory_factory):
        """Should decrease stock by specified quantity"""
        inventory = inventory_factory(quantity=50)
        mock_db_session.execute = AsyncMock(
            return_value=MagicMock(scalar_one_or_none=MagicMock(return_value=inventory))
        )
        mock_db_session.flush = AsyncMock()
        mock_db_session.refresh = AsyncMock()

        service = InventoryService(mock_db_session)

        result = await service.remove_stock(
            product_id=inventory.product_id,
            school_id=inventory.school_id,
            quantity=10,
            reason="Sale"
        )

        # Verify quantity was updated
        assert inventory.quantity == 40  # 50 - 10

    @pytest.mark.asyncio
    async def test_remove_stock_insufficient_raises_error(
        self, mock_db_session, inventory_factory
    ):
        """Should raise ValueError when removing more than available"""
        inventory = inventory_factory(quantity=10)

        mock_db_session.execute = AsyncMock(
            return_value=MagicMock(scalar_one_or_none=MagicMock(return_value=inventory))
        )

        service = InventoryService(mock_db_session)

        with pytest.raises(ValueError, match="Insufficient inventory"):
            await service.remove_stock(
                product_id=inventory.product_id,
                school_id=inventory.school_id,
                quantity=20,
                reason="Sale"
            )

    @pytest.mark.asyncio
    async def test_remove_stock_exact_quantity(
        self, mock_db_session, inventory_factory
    ):
        """Should allow removing exact available quantity"""
        inventory = inventory_factory(quantity=10)
        mock_db_session.execute = AsyncMock(
            return_value=MagicMock(scalar_one_or_none=MagicMock(return_value=inventory))
        )
        mock_db_session.flush = AsyncMock()
        mock_db_session.refresh = AsyncMock()

        service = InventoryService(mock_db_session)

        result = await service.remove_stock(
            product_id=inventory.product_id,
            school_id=inventory.school_id,
            quantity=10,
            reason="Sale"
        )

        # Verify quantity is now 0
        assert inventory.quantity == 0

    @pytest.mark.asyncio
    async def test_remove_stock_zero_quantity_raises_error(self, mock_db_session):
        """Should raise ValueError for zero quantity"""
        service = InventoryService(mock_db_session)

        with pytest.raises(ValueError, match="Quantity must be positive"):
            await service.remove_stock(
                product_id=str(uuid4()),
                school_id=str(uuid4()),
                quantity=0,
                reason="Invalid"
            )


# ============================================================================
# TEST: reserve_stock (wrapper for remove_stock)
# ============================================================================

class TestReserveStock:
    """Tests for InventoryService.reserve_stock"""

    @pytest.mark.asyncio
    async def test_reserve_stock_success(self, mock_db_session, inventory_factory):
        """Should reserve stock for sale/order"""
        inventory = inventory_factory(quantity=50)
        mock_db_session.execute = AsyncMock(
            return_value=MagicMock(scalar_one_or_none=MagicMock(return_value=inventory))
        )
        mock_db_session.flush = AsyncMock()
        mock_db_session.refresh = AsyncMock()

        service = InventoryService(mock_db_session)

        result = await service.reserve_stock(
            product_id=inventory.product_id,
            school_id=inventory.school_id,
            quantity=5
        )

        # Verify quantity was reduced
        assert inventory.quantity == 45  # 50 - 5

    @pytest.mark.asyncio
    async def test_reserve_stock_insufficient_raises_error(
        self, mock_db_session, inventory_factory
    ):
        """Should raise ValueError when insufficient stock for reservation"""
        inventory = inventory_factory(quantity=5)

        mock_db_session.execute = AsyncMock(
            return_value=MagicMock(scalar_one_or_none=MagicMock(return_value=inventory))
        )

        service = InventoryService(mock_db_session)

        with pytest.raises(ValueError, match="Insufficient inventory"):
            await service.reserve_stock(
                product_id=inventory.product_id,
                school_id=inventory.school_id,
                quantity=10
            )


# ============================================================================
# TEST: release_stock (wrapper for add_stock)
# ============================================================================

class TestReleaseStock:
    """Tests for InventoryService.release_stock"""

    @pytest.mark.asyncio
    async def test_release_stock_success(self, mock_db_session, inventory_factory):
        """Should release reserved stock (add back to inventory)"""
        inventory = inventory_factory(quantity=45)
        mock_db_session.execute = AsyncMock(
            return_value=MagicMock(scalar_one_or_none=MagicMock(return_value=inventory))
        )
        mock_db_session.flush = AsyncMock()
        mock_db_session.refresh = AsyncMock()

        service = InventoryService(mock_db_session)

        result = await service.release_stock(
            product_id=inventory.product_id,
            school_id=inventory.school_id,
            quantity=5
        )

        # Verify quantity was increased
        assert inventory.quantity == 50  # 45 + 5


# ============================================================================
# TEST: adjust_quantity
# ============================================================================

class TestAdjustQuantity:
    """Tests for InventoryService.adjust_quantity"""

    @pytest.mark.asyncio
    async def test_adjust_positive(self, mock_db_session, inventory_factory):
        """Should handle positive adjustment"""
        inventory = inventory_factory(quantity=50)
        mock_db_session.execute = AsyncMock(
            return_value=MagicMock(scalar_one_or_none=MagicMock(return_value=inventory))
        )
        mock_db_session.flush = AsyncMock()
        mock_db_session.refresh = AsyncMock()

        service = InventoryService(mock_db_session)

        result = await service.adjust_quantity(
            product_id=inventory.product_id,
            school_id=inventory.school_id,
            adjust_data=InventoryAdjust(adjustment=10, reason="Adjustment")
        )

        # Verify quantity was updated
        assert inventory.quantity == 60  # 50 + 10

    @pytest.mark.asyncio
    async def test_adjust_negative(self, mock_db_session, inventory_factory):
        """Should handle negative adjustment"""
        inventory = inventory_factory(quantity=50)
        mock_db_session.execute = AsyncMock(
            return_value=MagicMock(scalar_one_or_none=MagicMock(return_value=inventory))
        )
        mock_db_session.flush = AsyncMock()
        mock_db_session.refresh = AsyncMock()

        service = InventoryService(mock_db_session)

        result = await service.adjust_quantity(
            product_id=inventory.product_id,
            school_id=inventory.school_id,
            adjust_data=InventoryAdjust(adjustment=-10, reason="Adjustment")
        )

        # Verify quantity was updated
        assert inventory.quantity == 40  # 50 - 10

    @pytest.mark.asyncio
    async def test_adjust_would_go_negative_raises_error(
        self, mock_db_session, inventory_factory
    ):
        """Should raise ValueError if adjustment would result in negative stock"""
        inventory = inventory_factory(quantity=10)

        mock_db_session.execute = AsyncMock(
            return_value=MagicMock(scalar_one_or_none=MagicMock(return_value=inventory))
        )

        service = InventoryService(mock_db_session)

        with pytest.raises(ValueError, match="Insufficient inventory"):
            await service.adjust_quantity(
                product_id=inventory.product_id,
                school_id=inventory.school_id,
                adjust_data=InventoryAdjust(adjustment=-20, reason="Bad adjustment")
            )


# ============================================================================
# TEST: Business scenarios
# ============================================================================

class TestBusinessScenarios:
    """Integration-like tests for common business scenarios"""

    @pytest.mark.asyncio
    async def test_sale_flow_reserve_stock(self, mock_db_session, inventory_factory):
        """
        Simulate sale creation: check availability, then reserve stock
        """
        initial_qty = 50
        sale_qty = 3
        inventory = inventory_factory(quantity=initial_qty)

        mock_db_session.execute = AsyncMock(
            return_value=MagicMock(scalar_one_or_none=MagicMock(return_value=inventory))
        )
        mock_db_session.flush = AsyncMock()
        mock_db_session.refresh = AsyncMock()

        service = InventoryService(mock_db_session)

        # Step 1: Check availability
        available = await service.check_availability(
            product_id=inventory.product_id,
            school_id=inventory.school_id,
            quantity=sale_qty
        )
        assert available is True

        # Reset quantity for reserve test (since check doesn't modify)
        inventory.quantity = initial_qty

        # Step 2: Reserve stock
        result = await service.reserve_stock(
            product_id=inventory.product_id,
            school_id=inventory.school_id,
            quantity=sale_qty
        )

        assert inventory.quantity == initial_qty - sale_qty

    @pytest.mark.asyncio
    async def test_cancelled_sale_release_stock(
        self, mock_db_session, inventory_factory
    ):
        """
        Simulate cancelled sale: release reserved stock
        """
        current_qty = 47  # After reservation
        released_qty = 3
        inventory = inventory_factory(quantity=current_qty)

        mock_db_session.execute = AsyncMock(
            return_value=MagicMock(scalar_one_or_none=MagicMock(return_value=inventory))
        )
        mock_db_session.flush = AsyncMock()
        mock_db_session.refresh = AsyncMock()

        service = InventoryService(mock_db_session)

        result = await service.release_stock(
            product_id=inventory.product_id,
            school_id=inventory.school_id,
            quantity=released_qty
        )

        # Back to original quantity
        assert inventory.quantity == 50

    @pytest.mark.asyncio
    async def test_return_flow_add_stock_back(self, mock_db_session, inventory_factory):
        """
        Simulate return: add returned item back to stock
        """
        current_qty = 47
        returned_qty = 1
        inventory = inventory_factory(quantity=current_qty)

        mock_db_session.execute = AsyncMock(
            return_value=MagicMock(scalar_one_or_none=MagicMock(return_value=inventory))
        )
        mock_db_session.flush = AsyncMock()
        mock_db_session.refresh = AsyncMock()

        service = InventoryService(mock_db_session)

        result = await service.add_stock(
            product_id=inventory.product_id,
            school_id=inventory.school_id,
            quantity=returned_qty,
            reason="Customer return"
        )

        assert inventory.quantity == 48


# ============================================================================
# TEST: Edge cases
# ============================================================================

class TestEdgeCases:
    """Tests for edge cases and boundary conditions"""

    @pytest.mark.asyncio
    async def test_large_quantity_adjustment(
        self, mock_db_session, inventory_factory
    ):
        """Should handle large quantity adjustments"""
        inventory = inventory_factory(quantity=1000000)
        mock_db_session.execute = AsyncMock(
            return_value=MagicMock(scalar_one_or_none=MagicMock(return_value=inventory))
        )
        mock_db_session.flush = AsyncMock()
        mock_db_session.refresh = AsyncMock()

        service = InventoryService(mock_db_session)

        result = await service.add_stock(
            product_id=inventory.product_id,
            school_id=inventory.school_id,
            quantity=100,
            reason="Large batch receipt"
        )

        assert inventory.quantity == 1000100

    @pytest.mark.asyncio
    async def test_single_unit_operations(self, mock_db_session, inventory_factory):
        """Should handle single unit operations correctly"""
        inventory = inventory_factory(quantity=1)

        mock_db_session.execute = AsyncMock(
            return_value=MagicMock(scalar_one_or_none=MagicMock(return_value=inventory))
        )

        service = InventoryService(mock_db_session)

        # Check availability for 1 unit
        available = await service.check_availability(
            product_id=inventory.product_id,
            school_id=inventory.school_id,
            quantity=1
        )
        assert available is True

        # Check availability for 2 units (should fail)
        available = await service.check_availability(
            product_id=inventory.product_id,
            school_id=inventory.school_id,
            quantity=2
        )
        assert available is False
