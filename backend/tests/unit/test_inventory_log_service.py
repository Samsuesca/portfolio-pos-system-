"""
Unit Tests for InventoryLogService

Tests for inventory log (audit trail) creation and querying.
Similar to balance_entries for accounting audit.
"""
import pytest
from datetime import date
from uuid import uuid4
from unittest.mock import AsyncMock, MagicMock, patch

from app.services.inventory_log import InventoryLogService
from app.models.inventory_log import InventoryLog, InventoryMovementType
from app.schemas.inventory_log import InventoryLogFilter


# ============================================================================
# TEST FIXTURES
# ============================================================================

@pytest.fixture
def inventory_log_factory():
    """Factory for creating InventoryLog instances."""
    def _create(
        id: str = None,
        inventory_id: str = None,
        global_inventory_id: str = None,
        school_id: str = None,
        movement_type: InventoryMovementType = InventoryMovementType.SALE,
        movement_date: date = None,
        quantity_delta: int = -1,
        quantity_after: int = 49,
        description: str = "Sale of product",
        reference: str = None,
        sale_id: str = None,
        order_id: str = None,
        **kwargs
    ) -> InventoryLog:
        return InventoryLog(
            id=id or str(uuid4()),
            inventory_id=inventory_id,
            global_inventory_id=global_inventory_id,
            school_id=school_id or str(uuid4()),
            movement_type=movement_type,
            movement_date=movement_date or date.today(),
            quantity_delta=quantity_delta,
            quantity_after=quantity_after,
            description=description,
            reference=reference or f"VNT-2025-{uuid4().hex[:4].upper()}",
            sale_id=sale_id,
            order_id=order_id,
            **kwargs
        )
    return _create


# ============================================================================
# TEST: create_log
# ============================================================================

class TestCreateLog:
    """Tests for InventoryLogService.create_log"""

    @pytest.mark.asyncio
    async def test_create_log_for_sale(self, mock_db_session):
        """Should create log entry for a sale"""
        # Arrange
        mock_db_session.add = MagicMock()
        mock_db_session.flush = AsyncMock()
        mock_db_session.refresh = AsyncMock()

        service = InventoryLogService(mock_db_session)

        inventory_id = str(uuid4())
        school_id = str(uuid4())
        sale_id = str(uuid4())

        # Act
        result = await service.create_log(
            inventory_id=inventory_id,
            school_id=school_id,
            movement_type=InventoryMovementType.SALE,
            quantity_delta=-5,
            quantity_after=45,
            description="Sale: 5 units",
            reference="VNT-2025-0001",
            sale_id=sale_id
        )

        # Assert
        mock_db_session.add.assert_called_once()
        mock_db_session.flush.assert_called_once()
        assert result.inventory_id == inventory_id
        assert result.school_id == school_id
        assert result.movement_type == InventoryMovementType.SALE
        assert result.quantity_delta == -5
        assert result.quantity_after == 45
        assert result.sale_id == sale_id

    @pytest.mark.asyncio
    async def test_create_log_for_order_reserve(self, mock_db_session):
        """Should create log entry for order stock reservation"""
        mock_db_session.add = MagicMock()
        mock_db_session.flush = AsyncMock()
        mock_db_session.refresh = AsyncMock()

        service = InventoryLogService(mock_db_session)

        inventory_id = str(uuid4())
        school_id = str(uuid4())
        order_id = str(uuid4())

        result = await service.create_log(
            inventory_id=inventory_id,
            school_id=school_id,
            movement_type=InventoryMovementType.ORDER_RESERVE,
            quantity_delta=-3,
            quantity_after=47,
            description="Reserved for order",
            reference="ENC-2025-0001",
            order_id=order_id
        )

        assert result.movement_type == InventoryMovementType.ORDER_RESERVE
        assert result.order_id == order_id
        assert result.quantity_delta == -3

    @pytest.mark.asyncio
    async def test_create_log_for_adjustment_in(self, mock_db_session):
        """Should create log entry for positive stock adjustment"""
        mock_db_session.add = MagicMock()
        mock_db_session.flush = AsyncMock()
        mock_db_session.refresh = AsyncMock()

        service = InventoryLogService(mock_db_session)

        result = await service.create_log(
            inventory_id=str(uuid4()),
            school_id=str(uuid4()),
            movement_type=InventoryMovementType.ADJUSTMENT_IN,
            quantity_delta=10,
            quantity_after=60,
            description="Stock received from supplier"
        )

        assert result.movement_type == InventoryMovementType.ADJUSTMENT_IN
        assert result.quantity_delta == 10

    @pytest.mark.asyncio
    async def test_create_log_for_sale_cancel(self, mock_db_session):
        """Should create log entry for sale cancellation (stock return)"""
        mock_db_session.add = MagicMock()
        mock_db_session.flush = AsyncMock()
        mock_db_session.refresh = AsyncMock()

        service = InventoryLogService(mock_db_session)

        sale_id = str(uuid4())

        result = await service.create_log(
            inventory_id=str(uuid4()),
            school_id=str(uuid4()),
            movement_type=InventoryMovementType.SALE_CANCEL,
            quantity_delta=5,  # Positive - stock returned
            quantity_after=55,
            description="Sale cancelled - stock restored",
            reference="VNT-2025-0001",
            sale_id=sale_id
        )

        assert result.movement_type == InventoryMovementType.SALE_CANCEL
        assert result.quantity_delta == 5  # Positive for return
        assert result.sale_id == sale_id

    @pytest.mark.asyncio
    async def test_create_log_for_global_inventory(self, mock_db_session):
        """Should create log entry for global inventory"""
        mock_db_session.add = MagicMock()
        mock_db_session.flush = AsyncMock()
        mock_db_session.refresh = AsyncMock()

        service = InventoryLogService(mock_db_session)

        global_inventory_id = str(uuid4())
        school_id = str(uuid4())

        result = await service.create_log(
            global_inventory_id=global_inventory_id,  # Global inventory
            school_id=school_id,
            movement_type=InventoryMovementType.SALE,
            quantity_delta=-2,
            quantity_after=98,
            description="Global product sale"
        )

        assert result.global_inventory_id == global_inventory_id
        assert result.inventory_id is None


# ============================================================================
# TEST: get_logs_by_inventory
# ============================================================================

class TestGetLogsByInventory:
    """Tests for InventoryLogService.get_logs_by_inventory"""

    @pytest.mark.asyncio
    async def test_get_logs_returns_list(
        self, mock_db_session, inventory_log_factory
    ):
        """Should return list of logs for inventory"""
        logs = [
            inventory_log_factory(quantity_delta=-1, quantity_after=49),
            inventory_log_factory(quantity_delta=-2, quantity_after=47),
        ]

        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = logs
        mock_db_session.execute = AsyncMock(return_value=mock_result)

        service = InventoryLogService(mock_db_session)

        result = await service.get_logs_by_inventory(str(uuid4()))

        assert len(result) == 2

    @pytest.mark.asyncio
    async def test_get_logs_empty_when_no_logs(self, mock_db_session):
        """Should return empty list when no logs exist"""
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = []
        mock_db_session.execute = AsyncMock(return_value=mock_result)

        service = InventoryLogService(mock_db_session)

        result = await service.get_logs_by_inventory(str(uuid4()))

        assert result == []

    @pytest.mark.asyncio
    async def test_get_logs_respects_pagination(self, mock_db_session):
        """Should apply skip and limit for pagination"""
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = []
        mock_db_session.execute = AsyncMock(return_value=mock_result)

        service = InventoryLogService(mock_db_session)

        await service.get_logs_by_inventory(
            str(uuid4()),
            skip=10,
            limit=50
        )

        # Verify execute was called
        mock_db_session.execute.assert_called_once()


# ============================================================================
# TEST: get_logs_by_sale
# ============================================================================

class TestGetLogsBySale:
    """Tests for InventoryLogService.get_logs_by_sale"""

    @pytest.mark.asyncio
    async def test_get_logs_by_sale_returns_all_related(
        self, mock_db_session, inventory_log_factory
    ):
        """Should return all logs for a sale"""
        sale_id = str(uuid4())
        logs = [
            inventory_log_factory(sale_id=sale_id, quantity_delta=-1),
            inventory_log_factory(sale_id=sale_id, quantity_delta=-2),
        ]

        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = logs
        mock_db_session.execute = AsyncMock(return_value=mock_result)

        service = InventoryLogService(mock_db_session)

        result = await service.get_logs_by_sale(sale_id)

        assert len(result) == 2
        for log in result:
            assert log.sale_id == sale_id


# ============================================================================
# TEST: get_logs_by_order
# ============================================================================

class TestGetLogsByOrder:
    """Tests for InventoryLogService.get_logs_by_order"""

    @pytest.mark.asyncio
    async def test_get_logs_by_order_returns_all_related(
        self, mock_db_session, inventory_log_factory
    ):
        """Should return all logs for an order"""
        order_id = str(uuid4())
        logs = [
            inventory_log_factory(order_id=order_id, movement_type=InventoryMovementType.ORDER_RESERVE),
            inventory_log_factory(order_id=order_id, movement_type=InventoryMovementType.ORDER_DELIVER),
        ]

        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = logs
        mock_db_session.execute = AsyncMock(return_value=mock_result)

        service = InventoryLogService(mock_db_session)

        result = await service.get_logs_by_order(order_id)

        assert len(result) == 2


# ============================================================================
# TEST: Movement type scenarios
# ============================================================================

class TestMovementTypeScenarios:
    """Tests for different movement type scenarios"""

    @pytest.mark.asyncio
    async def test_sale_creates_negative_delta(self, mock_db_session):
        """Sale should create negative quantity delta (stock out)"""
        mock_db_session.add = MagicMock()
        mock_db_session.flush = AsyncMock()
        mock_db_session.refresh = AsyncMock()

        service = InventoryLogService(mock_db_session)

        result = await service.create_log(
            inventory_id=str(uuid4()),
            movement_type=InventoryMovementType.SALE,
            quantity_delta=-3,
            quantity_after=47,
            description="Venta"
        )

        assert result.quantity_delta < 0

    @pytest.mark.asyncio
    async def test_sale_cancel_creates_positive_delta(self, mock_db_session):
        """Sale cancellation should create positive quantity delta (stock in)"""
        mock_db_session.add = MagicMock()
        mock_db_session.flush = AsyncMock()
        mock_db_session.refresh = AsyncMock()

        service = InventoryLogService(mock_db_session)

        result = await service.create_log(
            inventory_id=str(uuid4()),
            movement_type=InventoryMovementType.SALE_CANCEL,
            quantity_delta=3,
            quantity_after=53,
            description="Cancelación de venta"
        )

        assert result.quantity_delta > 0

    @pytest.mark.asyncio
    async def test_order_cancel_creates_positive_delta(self, mock_db_session):
        """Order cancellation should create positive quantity delta (stock in)"""
        mock_db_session.add = MagicMock()
        mock_db_session.flush = AsyncMock()
        mock_db_session.refresh = AsyncMock()

        service = InventoryLogService(mock_db_session)

        result = await service.create_log(
            inventory_id=str(uuid4()),
            movement_type=InventoryMovementType.ORDER_CANCEL,
            quantity_delta=5,
            quantity_after=55,
            description="Cancelación de encargo"
        )

        assert result.quantity_delta > 0
        assert result.movement_type == InventoryMovementType.ORDER_CANCEL

    @pytest.mark.asyncio
    async def test_change_return_creates_positive_delta(self, mock_db_session):
        """Change return should create positive quantity delta (stock in)"""
        mock_db_session.add = MagicMock()
        mock_db_session.flush = AsyncMock()
        mock_db_session.refresh = AsyncMock()

        service = InventoryLogService(mock_db_session)

        result = await service.create_log(
            inventory_id=str(uuid4()),
            movement_type=InventoryMovementType.CHANGE_RETURN,
            quantity_delta=1,
            quantity_after=51,
            description="Devolución por cambio"
        )

        assert result.quantity_delta > 0

    @pytest.mark.asyncio
    async def test_change_out_creates_negative_delta(self, mock_db_session):
        """Change out should create negative quantity delta (stock out)"""
        mock_db_session.add = MagicMock()
        mock_db_session.flush = AsyncMock()
        mock_db_session.refresh = AsyncMock()

        service = InventoryLogService(mock_db_session)

        result = await service.create_log(
            inventory_id=str(uuid4()),
            movement_type=InventoryMovementType.CHANGE_OUT,
            quantity_delta=-1,
            quantity_after=49,
            description="Salida por cambio"
        )

        assert result.quantity_delta < 0


# ============================================================================
# TEST: get_logs_by_date_range
# ============================================================================

class TestGetLogsByDateRange:
    """Tests for InventoryLogService.get_logs_by_date_range"""

    @pytest.mark.asyncio
    async def test_get_logs_by_date_range_filters_correctly(
        self, mock_db_session, inventory_log_factory
    ):
        """Should return logs within date range"""
        school_id = str(uuid4())
        logs = [inventory_log_factory(school_id=school_id)]

        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = logs
        mock_db_session.execute = AsyncMock(return_value=mock_result)

        service = InventoryLogService(mock_db_session)

        result = await service.get_logs_by_date_range(
            school_id=school_id,
            start_date=date(2025, 1, 1),
            end_date=date(2025, 12, 31)
        )

        assert len(result) == 1

    @pytest.mark.asyncio
    async def test_get_logs_by_date_range_with_movement_type_filter(
        self, mock_db_session, inventory_log_factory
    ):
        """Should filter by movement type when specified"""
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = []
        mock_db_session.execute = AsyncMock(return_value=mock_result)

        service = InventoryLogService(mock_db_session)

        await service.get_logs_by_date_range(
            school_id=str(uuid4()),
            start_date=date(2025, 1, 1),
            end_date=date(2025, 12, 31),
            movement_type=InventoryMovementType.SALE
        )

        mock_db_session.execute.assert_called_once()


# ============================================================================
# TEST: Audit trail integrity
# ============================================================================

class TestAuditTrailIntegrity:
    """Tests for audit trail integrity"""

    @pytest.mark.asyncio
    async def test_log_includes_created_by_user(self, mock_db_session):
        """Should track which user created the log"""
        mock_db_session.add = MagicMock()
        mock_db_session.flush = AsyncMock()
        mock_db_session.refresh = AsyncMock()

        service = InventoryLogService(mock_db_session)
        user_id = str(uuid4())

        result = await service.create_log(
            inventory_id=str(uuid4()),
            movement_type=InventoryMovementType.ADJUSTMENT_IN,
            quantity_delta=10,
            quantity_after=110,
            description="Manual adjustment",
            created_by=user_id
        )

        assert result.created_by == user_id

    @pytest.mark.asyncio
    async def test_log_includes_reference_code(self, mock_db_session):
        """Should include reference code for traceability"""
        mock_db_session.add = MagicMock()
        mock_db_session.flush = AsyncMock()
        mock_db_session.refresh = AsyncMock()

        service = InventoryLogService(mock_db_session)

        result = await service.create_log(
            inventory_id=str(uuid4()),
            movement_type=InventoryMovementType.SALE,
            quantity_delta=-2,
            quantity_after=48,
            description="Sale",
            reference="VNT-2025-0042"
        )

        assert result.reference == "VNT-2025-0042"

    @pytest.mark.asyncio
    async def test_log_includes_movement_date(self, mock_db_session):
        """Should record movement date"""
        mock_db_session.add = MagicMock()
        mock_db_session.flush = AsyncMock()
        mock_db_session.refresh = AsyncMock()

        service = InventoryLogService(mock_db_session)
        specific_date = date(2025, 6, 15)

        result = await service.create_log(
            inventory_id=str(uuid4()),
            movement_type=InventoryMovementType.PURCHASE,
            quantity_delta=100,
            quantity_after=200,
            description="Stock purchase",
            movement_date=specific_date
        )

        assert result.movement_date == specific_date

    @pytest.mark.asyncio
    async def test_log_defaults_to_today_if_no_date(self, mock_db_session):
        """Should default to today if no movement_date provided"""
        mock_db_session.add = MagicMock()
        mock_db_session.flush = AsyncMock()
        mock_db_session.refresh = AsyncMock()

        service = InventoryLogService(mock_db_session)

        result = await service.create_log(
            inventory_id=str(uuid4()),
            movement_type=InventoryMovementType.ADJUSTMENT_IN,
            quantity_delta=5,
            quantity_after=55,
            description="Adjustment"
        )

        assert result.movement_date == date.today()
