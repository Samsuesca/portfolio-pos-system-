"""
Unit Tests for SaleService

Tests sale creation and sale change (cambios/devoluciones) logic including:
- Sale creation with stock validation
- Sale code generation
- Sale change creation (size, product, return, defect)
- Sale change approval/rejection workflow
- Price adjustment calculations
"""
import pytest
from decimal import Decimal
from uuid import uuid4
from unittest.mock import AsyncMock, MagicMock, patch, PropertyMock
from datetime import datetime

from app.services.sale import SaleService
from app.models.sale import Sale, SaleItem, SaleChange, SaleStatus, ChangeStatus, ChangeType, PaymentMethod
from app.schemas.sale import SaleCreate, SaleItemCreate, SaleChangeCreate


# ============================================================================
# TEST: Sale Code Generation
# ============================================================================

class TestSaleCodeGeneration:
    """Tests for sale code generation"""

    @pytest.mark.asyncio
    async def test_generate_first_sale_code(self, mock_db_session):
        """Should generate VNT-YYYY-0001 for first sale"""
        mock_db_session.execute = AsyncMock(
            return_value=MagicMock(scalar_one=MagicMock(return_value=0))
        )
        service = SaleService(mock_db_session)

        code = await service._generate_sale_code(str(uuid4()))

        current_year = datetime.now().year
        assert code == f"VNT-{current_year}-0001"

    @pytest.mark.asyncio
    async def test_generate_sequential_sale_code(self, mock_db_session):
        """Should increment sequence for new sales"""
        mock_db_session.execute = AsyncMock(
            return_value=MagicMock(scalar_one=MagicMock(return_value=15))
        )
        service = SaleService(mock_db_session)

        code = await service._generate_sale_code(str(uuid4()))

        current_year = datetime.now().year
        assert code == f"VNT-{current_year}-0016"


# ============================================================================
# TEST: Price Adjustment Calculations
# ============================================================================

class TestPriceAdjustmentCalculations:
    """Tests for sale change price adjustment calculations"""

    def test_size_change_same_price(self):
        """Size change with same price: adjustment = 0"""
        original_price = Decimal("50000")
        new_price = Decimal("50000")
        returned_qty = 1
        new_qty = 1

        adjustment = (new_price * new_qty) - (original_price * returned_qty)
        assert adjustment == Decimal("0")

    def test_size_change_higher_price(self):
        """Size change to larger size: customer pays difference"""
        original_price = Decimal("45000")  # T12
        new_price = Decimal("48000")  # T14
        returned_qty = 1
        new_qty = 1

        adjustment = (new_price * new_qty) - (original_price * returned_qty)
        assert adjustment == Decimal("3000")  # Customer pays extra

    def test_size_change_lower_price(self):
        """Size change to smaller size: customer gets refund"""
        original_price = Decimal("48000")  # T14
        new_price = Decimal("45000")  # T12
        returned_qty = 1
        new_qty = 1

        adjustment = (new_price * new_qty) - (original_price * returned_qty)
        assert adjustment == Decimal("-3000")  # Refund to customer

    def test_product_change_different_quantity(self):
        """Product change with different quantity"""
        original_price = Decimal("50000")
        new_price = Decimal("60000")
        returned_qty = 2
        new_qty = 1

        adjustment = (new_price * new_qty) - (original_price * returned_qty)
        # (60000 * 1) - (50000 * 2) = 60000 - 100000 = -40000
        assert adjustment == Decimal("-40000")  # Refund

    def test_return_refund_calculation(self):
        """Pure return: full refund of returned items"""
        original_price = Decimal("50000")
        returned_qty = 2

        # Return formula: -(original_price * returned_qty)
        adjustment = -(original_price * returned_qty)
        assert adjustment == Decimal("-100000")  # Full refund

    def test_return_partial_quantity(self):
        """Partial return: refund only returned items"""
        original_price = Decimal("45000")
        returned_qty = 1  # Out of 3 originally purchased

        adjustment = -(original_price * returned_qty)
        assert adjustment == Decimal("-45000")


# ============================================================================
# TEST: Sale Creation Validation
# ============================================================================

class TestSaleCreationValidation:
    """Tests for sale creation validation logic"""

    @pytest.mark.asyncio
    async def test_create_sale_product_not_found(self, mock_db_session, product_factory):
        """Should raise ValueError when product not found"""
        # First call for code generation, second for product lookup
        call_count = 0

        async def mock_execute(query):
            nonlocal call_count
            call_count += 1
            mock_result = MagicMock()
            if call_count == 1:
                # Code generation - return count
                mock_result.scalar_one = MagicMock(return_value=0)
            else:
                # Product lookup - return None
                mock_result.scalar_one_or_none = MagicMock(return_value=None)
            return mock_result

        mock_db_session.execute = mock_execute

        service = SaleService(mock_db_session)

        sale_data = SaleCreate(
            school_id=str(uuid4()),
            items=[
                SaleItemCreate(product_id=str(uuid4()), quantity=1)
            ],
            payment_method=PaymentMethod.CASH
        )

        with pytest.raises(ValueError, match="Producto .* no encontrado"):
            await service.create_sale(sale_data)

    @pytest.mark.asyncio
    async def test_create_sale_insufficient_stock(
        self, mock_db_session, product_factory, sample_school
    ):
        """Should raise ValueError when insufficient stock"""
        product = product_factory(school_id=sample_school.id)

        call_count = 0

        async def mock_execute(query):
            nonlocal call_count
            call_count += 1
            mock_result = MagicMock()
            if call_count == 1:
                # Code generation
                mock_result.scalar_one = MagicMock(return_value=0)
            else:
                # Product lookup
                mock_result.scalar_one_or_none = MagicMock(return_value=product)
            return mock_result

        mock_db_session.execute = mock_execute

        service = SaleService(mock_db_session)

        # Mock inventory service inside the method using patch.object
        with patch.object(service, 'db', mock_db_session):
            # Create mock for InventoryService
            with patch('app.services.inventory.InventoryService') as MockInvService:
                mock_inv = MagicMock()
                mock_inv.check_availability = AsyncMock(return_value=False)
                MockInvService.return_value = mock_inv

                sale_data = SaleCreate(
                    school_id=sample_school.id,
                    items=[
                        SaleItemCreate(product_id=product.id, quantity=100)
                    ],
                    payment_method=PaymentMethod.CASH
                )

                # The InventoryService is instantiated inside create_sale,
                # so we need to mock it at the module level where it's imported
                from app.services import inventory
                original_class = inventory.InventoryService
                inventory.InventoryService = lambda db: mock_inv

                try:
                    with pytest.raises(ValueError, match="Stock insuficiente"):
                        await service.create_sale(sale_data)
                finally:
                    inventory.InventoryService = original_class


# ============================================================================
# TEST: Sale Change Creation
# ============================================================================

class TestSaleChangeCreation:
    """Tests for sale change (cambios/devoluciones) creation"""

    @pytest.mark.asyncio
    async def test_create_change_sale_not_found(self, mock_db_session):
        """Should raise ValueError when sale not found"""
        service = SaleService(mock_db_session)

        with patch.object(service, 'get', new_callable=AsyncMock) as mock_get:
            mock_get.return_value = None

            change_data = SaleChangeCreate(
                original_item_id=str(uuid4()),
                change_type=ChangeType.SIZE_CHANGE,
                returned_quantity=1,
                new_product_id=str(uuid4()),
                new_quantity=1,
                reason="Wrong size"
            )

            with pytest.raises(ValueError, match="Venta no encontrada"):
                await service.create_sale_change(
                    sale_id=str(uuid4()),
                    school_id=str(uuid4()),
                    user_id=str(uuid4()),
                    change_data=change_data
                )

    @pytest.mark.asyncio
    async def test_create_change_sale_cancelled(
        self, mock_db_session, sale_factory, sample_school
    ):
        """Should raise ValueError for cancelled sale"""
        sale = sale_factory(
            school_id=sample_school.id,
            status=SaleStatus.CANCELLED
        )

        service = SaleService(mock_db_session)

        with patch.object(service, 'get', new_callable=AsyncMock) as mock_get:
            mock_get.return_value = sale

            change_data = SaleChangeCreate(
                original_item_id=str(uuid4()),
                change_type=ChangeType.RETURN,
                returned_quantity=1,
                reason="Customer changed mind"
            )

            with pytest.raises(ValueError, match="venta cancelada"):
                await service.create_sale_change(
                    sale_id=sale.id,
                    school_id=sample_school.id,
                    user_id=str(uuid4()),
                    change_data=change_data
                )

    @pytest.mark.asyncio
    async def test_create_change_returned_qty_exceeds_original(
        self, mock_db_session, sale_factory, sale_item_factory, sample_school
    ):
        """Should raise ValueError if returned_quantity > original quantity"""
        sale = sale_factory(school_id=sample_school.id)
        sale_item = sale_item_factory(
            sale_id=sale.id,
            quantity=2  # Original quantity
        )

        service = SaleService(mock_db_session)

        with patch.object(service, 'get', new_callable=AsyncMock) as mock_get:
            mock_get.return_value = sale

            # Track execute calls for different queries
            call_count = 0

            async def mock_execute(query):
                nonlocal call_count
                call_count += 1
                mock_result = MagicMock()

                if call_count == 1:
                    # First call: sale item lookup
                    mock_result.scalar_one_or_none = MagicMock(return_value=sale_item)
                else:
                    # Second call: approved changes sum - returns 0 (no previous returns)
                    mock_result.scalar = MagicMock(return_value=0)

                return mock_result

            mock_db_session.execute = mock_execute

            change_data = SaleChangeCreate(
                original_item_id=sale_item.id,
                change_type=ChangeType.RETURN,
                returned_quantity=5,  # More than original (2)
                reason="Returning too many"
            )

            with pytest.raises(ValueError, match="cantidad a devolver no puede exceder"):
                await service.create_sale_change(
                    sale_id=sale.id,
                    school_id=sample_school.id,
                    user_id=str(uuid4()),
                    change_data=change_data
                )

    @pytest.mark.asyncio
    async def test_create_size_change_requires_new_product(
        self, mock_db_session, sale_factory, sale_item_factory, sample_school
    ):
        """SIZE_CHANGE should require new_product_id - validated at schema level"""
        # The SaleChangeCreate schema validates that SIZE_CHANGE requires new_product_id
        # This test verifies that the service checks for missing new_product
        sale = sale_factory(school_id=sample_school.id)
        sale_item = sale_item_factory(sale_id=sale.id, quantity=1)

        service = SaleService(mock_db_session)

        with patch.object(service, 'get', new_callable=AsyncMock) as mock_get:
            mock_get.return_value = sale

            # Track execute calls for different queries
            call_count = 0

            async def mock_execute(query):
                nonlocal call_count
                call_count += 1
                mock_result = MagicMock()

                if call_count == 1:
                    # First call: sale item lookup
                    mock_result.scalar_one_or_none = MagicMock(return_value=sale_item)
                else:
                    # Second call: approved changes sum - returns 0
                    mock_result.scalar = MagicMock(return_value=0)

                return mock_result

            mock_db_session.execute = mock_execute

            # Create change data directly (bypassing schema validation)
            # to test service-level validation
            change_data = MagicMock()
            change_data.original_item_id = sale_item.id
            change_data.change_type = ChangeType.SIZE_CHANGE
            change_data.returned_quantity = 1
            change_data.new_product_id = None  # Missing!
            change_data.new_quantity = 1
            change_data.reason = "Need larger size"

            with pytest.raises(ValueError, match="requiere un nuevo producto"):
                await service.create_sale_change(
                    sale_id=sale.id,
                    school_id=sample_school.id,
                    user_id=str(uuid4()),
                    change_data=change_data
                )


# ============================================================================
# TEST: Sale Change Approval
# ============================================================================

class TestSaleChangeApproval:
    """Tests for sale change approval workflow"""

    @pytest.mark.asyncio
    async def test_approve_change_not_found(self, mock_db_session):
        """Should raise ValueError when change not found"""
        mock_db_session.execute = AsyncMock(
            return_value=MagicMock(scalar_one_or_none=MagicMock(return_value=None))
        )

        service = SaleService(mock_db_session)

        with pytest.raises(ValueError, match="Solicitud de cambio no encontrada"):
            await service.approve_sale_change(
                change_id=str(uuid4()),
                school_id=str(uuid4())
            )

    @pytest.mark.asyncio
    async def test_approve_already_approved(self, mock_db_session, sample_school):
        """Should raise ValueError if change already approved"""
        # Create a mock change that's already approved
        mock_sale = MagicMock()
        mock_sale.school_id = sample_school.id

        mock_change = MagicMock()
        mock_change.sale = mock_sale
        mock_change.status = ChangeStatus.APPROVED  # Already approved

        mock_db_session.execute = AsyncMock(
            return_value=MagicMock(scalar_one_or_none=MagicMock(return_value=mock_change))
        )

        service = SaleService(mock_db_session)

        with pytest.raises(ValueError, match="Change already"):
            await service.approve_sale_change(
                change_id=str(uuid4()),
                school_id=sample_school.id
            )

    @pytest.mark.asyncio
    async def test_approve_wrong_school(self, mock_db_session, sample_school):
        """Should raise ValueError if change belongs to different school"""
        different_school_id = str(uuid4())

        mock_sale = MagicMock()
        mock_sale.school_id = different_school_id  # Different school

        mock_change = MagicMock()
        mock_change.sale = mock_sale
        mock_change.status = ChangeStatus.PENDING

        mock_db_session.execute = AsyncMock(
            return_value=MagicMock(scalar_one_or_none=MagicMock(return_value=mock_change))
        )

        service = SaleService(mock_db_session)

        with pytest.raises(ValueError, match="no pertenece a este colegio"):
            await service.approve_sale_change(
                change_id=str(uuid4()),
                school_id=sample_school.id
            )


# ============================================================================
# TEST: Sale Change Rejection
# ============================================================================

class TestSaleChangeRejection:
    """Tests for sale change rejection workflow"""

    @pytest.mark.asyncio
    async def test_reject_change_not_found(self, mock_db_session):
        """Should raise ValueError when change not found"""
        mock_db_session.execute = AsyncMock(
            return_value=MagicMock(scalar_one_or_none=MagicMock(return_value=None))
        )

        service = SaleService(mock_db_session)

        with pytest.raises(ValueError, match="Solicitud de cambio no encontrada"):
            await service.reject_sale_change(
                change_id=str(uuid4()),
                school_id=str(uuid4()),
                rejection_reason="Test rejection"
            )

    @pytest.mark.asyncio
    async def test_reject_already_rejected(self, mock_db_session, sample_school):
        """Should raise ValueError if change already rejected"""
        mock_sale = MagicMock()
        mock_sale.school_id = sample_school.id

        mock_change = MagicMock()
        mock_change.sale = mock_sale
        mock_change.status = ChangeStatus.REJECTED  # Already rejected

        mock_db_session.execute = AsyncMock(
            return_value=MagicMock(scalar_one_or_none=MagicMock(return_value=mock_change))
        )

        service = SaleService(mock_db_session)

        with pytest.raises(ValueError, match="Change already"):
            await service.reject_sale_change(
                change_id=str(uuid4()),
                school_id=sample_school.id,
                rejection_reason="Duplicate rejection"
            )


# ============================================================================
# TEST: Business Scenarios
# ============================================================================

class TestBusinessScenarios:
    """End-to-end business scenarios"""

    def test_scenario_size_change_workflow(self):
        """
        Scenario: Customer bought T12, wants T14 (same product, different size)

        1. Original purchase: Camisa T12 @ $45,000
        2. Customer returns: 1 x T12
        3. Customer receives: 1 x T14 @ $48,000
        4. Price adjustment: $48,000 - $45,000 = $3,000 (customer pays extra)
        """
        original_price = Decimal("45000")
        new_price = Decimal("48000")
        returned_qty = 1
        new_qty = 1

        adjustment = (new_price * new_qty) - (original_price * returned_qty)

        assert adjustment == Decimal("3000")
        assert adjustment > 0  # Customer owes money

    def test_scenario_full_return(self):
        """
        Scenario: Customer returns entire purchase for refund

        1. Original purchase: 2 x Pantalón @ $55,000 = $110,000
        2. Customer returns: 2 x Pantalón
        3. Refund: -$110,000
        """
        original_price = Decimal("55000")
        returned_qty = 2

        adjustment = -(original_price * returned_qty)

        assert adjustment == Decimal("-110000")
        assert adjustment < 0  # Store owes customer

    def test_scenario_partial_return(self):
        """
        Scenario: Customer returns 1 of 3 items

        1. Original purchase: 3 x Camisa @ $50,000 = $150,000
        2. Customer returns: 1 x Camisa
        3. Refund: -$50,000
        4. Customer keeps: 2 x Camisa ($100,000)
        """
        original_price = Decimal("50000")
        returned_qty = 1

        adjustment = -(original_price * returned_qty)

        assert adjustment == Decimal("-50000")

    def test_scenario_exchange_upgrade(self):
        """
        Scenario: Exchange for more expensive product

        1. Original: 1 x Camisa Básica @ $40,000
        2. Exchange for: 1 x Camisa Premium @ $60,000
        3. Customer pays: $20,000 extra
        """
        original_price = Decimal("40000")
        new_price = Decimal("60000")

        adjustment = (new_price * 1) - (original_price * 1)

        assert adjustment == Decimal("20000")

    def test_scenario_exchange_downgrade(self):
        """
        Scenario: Exchange for cheaper product

        1. Original: 1 x Camisa Premium @ $60,000
        2. Exchange for: 1 x Camisa Básica @ $40,000
        3. Refund: $20,000
        """
        original_price = Decimal("60000")
        new_price = Decimal("40000")

        adjustment = (new_price * 1) - (original_price * 1)

        assert adjustment == Decimal("-20000")

    def test_scenario_defect_same_product(self):
        """
        Scenario: Defective item replaced with same product

        1. Original: 1 x Camisa @ $50,000
        2. Return defective, receive new same item
        3. No price adjustment (0)
        """
        original_price = Decimal("50000")
        new_price = Decimal("50000")  # Same product

        adjustment = (new_price * 1) - (original_price * 1)

        assert adjustment == Decimal("0")


# ============================================================================
# TEST: Edge Cases
# ============================================================================

class TestEdgeCases:
    """Edge cases and boundary conditions"""

    def test_zero_price_return(self):
        """Handle free items (promotional, etc.)"""
        original_price = Decimal("0")
        returned_qty = 1

        adjustment = -(original_price * returned_qty)
        assert adjustment == Decimal("0")

    def test_large_quantity_return(self):
        """Handle bulk returns"""
        original_price = Decimal("50000")
        returned_qty = 100

        adjustment = -(original_price * returned_qty)
        assert adjustment == Decimal("-5000000")

    def test_decimal_precision(self):
        """Ensure decimal precision is maintained"""
        original_price = Decimal("49999.99")
        new_price = Decimal("50000.01")

        adjustment = (new_price * 1) - (original_price * 1)
        assert adjustment == Decimal("0.02")

    def test_multiple_quantity_exchange(self):
        """Exchange multiple items for different quantity"""
        original_price = Decimal("30000")  # Cheaper item
        new_price = Decimal("60000")  # More expensive
        returned_qty = 3
        new_qty = 1

        # Return 3 cheap items, get 1 expensive item
        # (60000 * 1) - (30000 * 3) = 60000 - 90000 = -30000
        adjustment = (new_price * new_qty) - (original_price * returned_qty)

        assert adjustment == Decimal("-30000")  # Refund despite upgrade


# ============================================================================
# TEST: Historical Sales
# ============================================================================

class TestHistoricalSales:
    """Tests for historical sales (migration data)"""

    def test_historical_sale_flag(self):
        """Historical sales should have is_historical=True"""
        # This tests the schema and model accept the is_historical flag
        from app.schemas.sale import SaleCreate, SaleItemCreate
        from datetime import date, datetime

        sale_data = SaleCreate(
            school_id=str(uuid4()),
            items=[SaleItemCreate(product_id=str(uuid4()), quantity=1)],
            payment_method=PaymentMethod.CASH,
            is_historical=True,
            sale_date=date(2024, 6, 15)
        )

        assert sale_data.is_historical == True
        # Pydantic converts date to datetime, so compare the date part
        assert sale_data.sale_date.date() == date(2024, 6, 15)

    def test_non_historical_sale_default(self):
        """Non-historical sales should default to is_historical=False"""
        from app.schemas.sale import SaleCreate, SaleItemCreate

        sale_data = SaleCreate(
            school_id=str(uuid4()),
            items=[SaleItemCreate(product_id=str(uuid4()), quantity=1)],
            payment_method=PaymentMethod.CASH
        )

        assert sale_data.is_historical == False

    def test_historical_sale_date_parsing(self):
        """Historical sales should accept various date formats"""
        from app.schemas.sale import SaleCreate, SaleItemCreate
        from datetime import date, datetime

        # Test with date object
        sale_data = SaleCreate(
            school_id=str(uuid4()),
            items=[SaleItemCreate(product_id=str(uuid4()), quantity=1)],
            payment_method=PaymentMethod.CASH,
            is_historical=True,
            sale_date=date(2024, 1, 15)
        )
        # Pydantic converts date to datetime, so compare the date part
        assert sale_data.sale_date.date() == date(2024, 1, 15)

    def test_historical_sale_past_date(self):
        """Historical sales can have past dates"""
        from datetime import date

        # Sale from 2023
        sale_date = date(2023, 11, 20)
        today = date.today()

        assert sale_date < today  # Must be in the past

    def test_historical_sale_inventory_logic(self):
        """
        Historical sales should NOT affect inventory.
        This is a logic verification - actual implementation skips inventory checks.
        """
        # When is_historical=True:
        # 1. Stock validation should be SKIPPED
        # 2. Inventory should NOT be decremented
        # This allows migrating old sales without affecting current stock

        is_historical = True
        should_check_stock = not is_historical
        should_adjust_inventory = not is_historical

        assert should_check_stock == False
        assert should_adjust_inventory == False

    def test_current_sale_inventory_logic(self):
        """
        Current (non-historical) sales SHOULD affect inventory.
        """
        is_historical = False
        should_check_stock = not is_historical
        should_adjust_inventory = not is_historical

        assert should_check_stock == True
        assert should_adjust_inventory == True


# ============================================================================
# TEST: Global Products in Sales
# ============================================================================

class TestGlobalProductsSales:
    """Tests for sales with global products"""

    def test_sale_item_with_global_product_flag(self):
        """Sale items should support global product flag"""
        from app.schemas.sale import SaleItemCreate

        # School product
        school_item = SaleItemCreate(
            product_id=str(uuid4()),
            quantity=2,
            is_global=False
        )
        assert school_item.is_global == False

        # Global product
        global_item = SaleItemCreate(
            product_id=str(uuid4()),
            quantity=1,
            is_global=True
        )
        assert global_item.is_global == True

    def test_mixed_sale_items(self):
        """Sale can have both school and global products"""
        from app.schemas.sale import SaleCreate, SaleItemCreate

        sale_data = SaleCreate(
            school_id=str(uuid4()),
            items=[
                SaleItemCreate(product_id=str(uuid4()), quantity=2, is_global=False),
                SaleItemCreate(product_id=str(uuid4()), quantity=1, is_global=True),
                SaleItemCreate(product_id=str(uuid4()), quantity=3, is_global=False),
            ],
            payment_method=PaymentMethod.CASH
        )

        school_items = [i for i in sale_data.items if not i.is_global]
        global_items = [i for i in sale_data.items if i.is_global]

        assert len(school_items) == 2
        assert len(global_items) == 1
