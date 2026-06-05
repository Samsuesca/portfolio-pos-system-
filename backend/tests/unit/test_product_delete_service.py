"""
Unit tests for product and garment type delete functionality.

Tests cover:
- ProductService.delete_product: hard delete, soft delete, blocked by pending orders
- GarmentTypeService.delete_garment_type: hard delete, soft delete, blocked by active products
- GlobalProductService.delete_product: hard delete, soft delete, blocked by pending orders
- GlobalGarmentTypeService.delete_garment_type: hard delete, soft delete, blocked by active products
"""
import pytest
from uuid import uuid4
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch

pytestmark = pytest.mark.unit


def make_scalar_result(value):
    """Helper to mock db.execute() returning a scalar count."""
    result = MagicMock()
    result.scalar.return_value = value
    return result


def make_scalar_one_or_none(value):
    """Helper to mock db.execute() returning scalar_one_or_none."""
    result = MagicMock()
    result.scalar_one_or_none.return_value = value
    return result


class TestProductServiceDelete:
    """Tests for ProductService.delete_product."""

    @pytest.fixture
    def mock_db(self):
        session = AsyncMock()
        session.flush = AsyncMock()
        session.refresh = AsyncMock()
        session.execute = AsyncMock()
        session.add = MagicMock()
        return session

    @pytest.fixture
    def product(self):
        p = MagicMock()
        p.id = uuid4()
        p.school_id = uuid4()
        p.code = "PRD-0001"
        p.name = "Camisa T12"
        p.is_active = True
        return p

    async def test_delete_product_not_found_raises(self, mock_db):
        from app.services.product import ProductService

        mock_db.execute.return_value = make_scalar_one_or_none(None)
        service = ProductService(mock_db)

        with pytest.raises(ValueError, match="Producto no encontrado"):
            await service.delete_product(uuid4(), uuid4())

    async def test_delete_product_blocked_by_pending_orders(self, mock_db, product):
        from app.services.product import ProductService

        school_id = product.school_id
        results = [
            make_scalar_one_or_none(product),  # get() -> product found
            make_scalar_result(2),              # pending orders count = 2
        ]
        mock_db.execute.side_effect = results
        service = ProductService(mock_db)

        with pytest.raises(ValueError, match="encargo.*pendiente"):
            await service.delete_product(product.id, school_id)

    async def test_delete_product_soft_delete_when_has_sales(self, mock_db, product):
        from app.services.product import ProductService

        school_id = product.school_id
        results = [
            make_scalar_one_or_none(product),  # get()
            make_scalar_result(0),              # pending orders = 0
            make_scalar_result(3),              # sale items = 3 (has sales)
            make_scalar_result(0),              # sale changes = 0
            make_scalar_result(0),              # order changes = 0
            # soft_delete -> update -> get + setattr + flush
            make_scalar_one_or_none(product),   # update -> get existing
        ]
        mock_db.execute.side_effect = results
        service = ProductService(mock_db)

        result = await service.delete_product(product.id, school_id)

        assert result["mode"] == "deactivated"
        assert "historial" in result["message"]

    async def test_delete_product_soft_delete_when_has_order_changes(self, mock_db, product):
        from app.services.product import ProductService

        school_id = product.school_id
        results = [
            make_scalar_one_or_none(product),  # get()
            make_scalar_result(0),              # pending orders = 0
            make_scalar_result(0),              # sale items = 0
            make_scalar_result(0),              # sale changes = 0
            make_scalar_result(1),              # order changes = 1 (has refs)
            make_scalar_one_or_none(product),   # soft_delete -> update -> get
        ]
        mock_db.execute.side_effect = results
        service = ProductService(mock_db)

        result = await service.delete_product(product.id, school_id)

        assert result["mode"] == "deactivated"

    async def test_delete_product_hard_delete_when_no_history(self, mock_db, product):
        from app.services.product import ProductService

        school_id = product.school_id
        delete_result = MagicMock()
        delete_result.rowcount = 1

        results = [
            make_scalar_one_or_none(product),  # get()
            make_scalar_result(0),              # pending orders = 0
            make_scalar_result(0),              # sale items = 0
            make_scalar_result(0),              # sale changes = 0
            make_scalar_result(0),              # order changes = 0
            delete_result,                      # hard delete
        ]
        mock_db.execute.side_effect = results
        service = ProductService(mock_db)

        result = await service.delete_product(product.id, school_id)

        assert result["mode"] == "deleted"
        assert "permanentemente" in result["message"]


class TestGarmentTypeServiceDelete:
    """Tests for GarmentTypeService.delete_garment_type."""

    @pytest.fixture
    def mock_db(self):
        session = AsyncMock()
        session.flush = AsyncMock()
        session.refresh = AsyncMock()
        session.execute = AsyncMock()
        session.add = MagicMock()
        return session

    @pytest.fixture
    def garment_type(self):
        gt = MagicMock()
        gt.id = uuid4()
        gt.school_id = uuid4()
        gt.name = "Camisa"
        gt.is_active = True
        return gt

    async def test_delete_garment_type_not_found(self, mock_db):
        from app.services.product import GarmentTypeService

        mock_db.execute.return_value = make_scalar_one_or_none(None)
        service = GarmentTypeService(mock_db)

        with pytest.raises(ValueError, match="no encontrado"):
            await service.delete_garment_type(uuid4(), uuid4())

    async def test_delete_garment_type_blocked_by_active_products(self, mock_db, garment_type):
        from app.services.product import GarmentTypeService

        results = [
            make_scalar_one_or_none(garment_type),  # get()
            make_scalar_result(5),                    # active products = 5
        ]
        mock_db.execute.side_effect = results
        service = GarmentTypeService(mock_db)

        with pytest.raises(ValueError, match="producto.*activo"):
            await service.delete_garment_type(garment_type.id, garment_type.school_id)

    async def test_delete_garment_type_soft_delete_with_inactive_products(self, mock_db, garment_type):
        from app.services.product import GarmentTypeService

        results = [
            make_scalar_one_or_none(garment_type),  # get()
            make_scalar_result(0),                    # active products = 0
            make_scalar_result(2),                    # any products = 2 (inactive)
            make_scalar_result(0),                    # order items (still checked)
            make_scalar_one_or_none(garment_type),    # soft_delete -> update -> get
        ]
        mock_db.execute.side_effect = results
        service = GarmentTypeService(mock_db)

        result = await service.delete_garment_type(garment_type.id, garment_type.school_id)

        assert result["mode"] == "deactivated"

    async def test_delete_garment_type_hard_delete_no_refs(self, mock_db, garment_type):
        from app.services.product import GarmentTypeService

        delete_result = MagicMock()
        delete_result.rowcount = 1

        results = [
            make_scalar_one_or_none(garment_type),  # get()
            make_scalar_result(0),                    # active products = 0
            make_scalar_result(0),                    # any products = 0
            make_scalar_result(0),                    # order items = 0
            delete_result,                            # hard delete
        ]
        mock_db.execute.side_effect = results
        service = GarmentTypeService(mock_db)

        result = await service.delete_garment_type(garment_type.id, garment_type.school_id)

        assert result["mode"] == "deleted"
        assert "permanentemente" in result["message"]


class TestGlobalProductServiceDelete:
    """Tests for ProductService.delete_global_product (unified model, school_id=None)."""

    @pytest.fixture
    def mock_db(self):
        session = AsyncMock()
        session.flush = AsyncMock()
        session.refresh = AsyncMock()
        session.execute = AsyncMock()
        session.add = MagicMock()
        return session

    @pytest.fixture
    def global_product(self):
        p = MagicMock()
        p.id = uuid4()
        p.school_id = None
        p.code = "GLB-ZAP-001"
        p.name = "Zapato Negro 38"
        p.is_active = True
        return p

    async def test_delete_not_found(self, mock_db):
        from app.services.product import ProductService

        mock_db.execute.return_value = make_scalar_one_or_none(None)
        service = ProductService(mock_db)

        with pytest.raises(ValueError, match="no encontrado"):
            await service.delete_global_product(uuid4())

    async def test_delete_blocked_by_pending_orders(self, mock_db, global_product):
        from app.services.product import ProductService

        results = [
            make_scalar_one_or_none(global_product),  # get()
            make_scalar_result(3),                      # pending orders = 3
        ]
        mock_db.execute.side_effect = results
        service = ProductService(mock_db)

        with pytest.raises(ValueError, match="encargo.*pendiente"):
            await service.delete_global_product(global_product.id)

    async def test_delete_soft_when_has_sales(self, mock_db, global_product):
        from app.services.product import ProductService

        results = [
            make_scalar_one_or_none(global_product),  # get()
            make_scalar_result(0),                      # pending orders = 0
            make_scalar_result(1),                      # sale items = 1
            make_scalar_result(0),                      # sale changes = 0
            make_scalar_result(0),                      # order changes = 0
        ]
        mock_db.execute.side_effect = results
        service = ProductService(mock_db)

        result = await service.delete_global_product(global_product.id)

        assert result["mode"] == "deactivated"
        assert global_product.is_active is False

    async def test_delete_hard_when_no_history(self, mock_db, global_product):
        from app.services.product import ProductService

        results = [
            make_scalar_one_or_none(global_product),  # get()
            make_scalar_result(0),                      # pending orders = 0
            make_scalar_result(0),                      # sale items = 0
            make_scalar_result(0),                      # sale changes = 0
            make_scalar_result(0),                      # order changes = 0
            MagicMock(),                                # delete Inventory
            MagicMock(),                                # delete Product
        ]
        mock_db.execute.side_effect = results
        service = ProductService(mock_db)

        result = await service.delete_global_product(global_product.id)

        assert result["mode"] == "deleted"
        assert "permanentemente" in result["message"]


class TestGlobalGarmentTypeServiceDelete:
    """Tests for GarmentTypeService.delete_global_garment_type (unified model, school_id=None)."""

    @pytest.fixture
    def mock_db(self):
        session = AsyncMock()
        session.flush = AsyncMock()
        session.refresh = AsyncMock()
        session.execute = AsyncMock()
        session.add = MagicMock()
        return session

    @pytest.fixture
    def global_garment_type(self):
        gt = MagicMock()
        gt.id = uuid4()
        gt.school_id = None
        gt.name = "Zapatos"
        gt.is_active = True
        return gt

    async def test_delete_not_found(self, mock_db):
        from app.services.product import GarmentTypeService

        mock_db.execute.return_value = make_scalar_one_or_none(None)
        service = GarmentTypeService(mock_db)

        with pytest.raises(ValueError, match="no encontrado"):
            await service.delete_global_garment_type(uuid4())

    async def test_delete_blocked_by_active_products(self, mock_db, global_garment_type):
        from app.services.product import GarmentTypeService

        results = [
            make_scalar_one_or_none(global_garment_type),  # get()
            make_scalar_result(2),                           # active products = 2
        ]
        mock_db.execute.side_effect = results
        service = GarmentTypeService(mock_db)

        with pytest.raises(ValueError, match="producto.*activo"):
            await service.delete_global_garment_type(global_garment_type.id)

    async def test_delete_soft_with_inactive_products(self, mock_db, global_garment_type):
        from app.services.product import GarmentTypeService

        results = [
            make_scalar_one_or_none(global_garment_type),  # get()
            make_scalar_result(0),                           # active products = 0
            make_scalar_result(1),                           # any products = 1 (inactive)
            make_scalar_result(0),                           # order items (still checked)
        ]
        mock_db.execute.side_effect = results
        service = GarmentTypeService(mock_db)

        result = await service.delete_global_garment_type(global_garment_type.id)

        assert result["mode"] == "deactivated"
        assert global_garment_type.is_active is False

    async def test_delete_hard_no_refs(self, mock_db, global_garment_type):
        from app.services.product import GarmentTypeService

        results = [
            make_scalar_one_or_none(global_garment_type),  # get()
            make_scalar_result(0),                           # active products = 0
            make_scalar_result(0),                           # any products = 0
            make_scalar_result(0),                           # order items = 0
            MagicMock(),                                     # delete images
            MagicMock(),                                     # delete garment type
        ]
        mock_db.execute.side_effect = results
        service = GarmentTypeService(mock_db)

        result = await service.delete_global_garment_type(global_garment_type.id)

        assert result["mode"] == "deleted"
        assert "permanentemente" in result["message"]
