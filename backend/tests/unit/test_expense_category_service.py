"""
Unit Tests for Expense Category Service

Tests for:
- ExpenseCategoryService: CRUD operations for expense categories
"""
import pytest
from decimal import Decimal
from uuid import uuid4
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch

from app.services.expense_category import ExpenseCategoryService
from app.models.accounting import ExpenseCategoryModel
from app.schemas.accounting import (
    ExpenseCategoryCreate,
    ExpenseCategoryUpdate,
    ExpenseCategoryResponse,
    ExpenseCategoryListResponse
)

pytestmark = pytest.mark.unit


# ============================================================================
# FIXTURES
# ============================================================================

@pytest.fixture
def mock_db_session():
    """Create a mock async database session."""
    session = AsyncMock()
    session.execute = AsyncMock()
    session.add = MagicMock()
    session.flush = AsyncMock()
    session.refresh = AsyncMock()
    session.delete = AsyncMock()
    session.commit = AsyncMock()
    return session


@pytest.fixture
def sample_system_category():
    """Create a sample system category for testing."""
    category = MagicMock(spec=['id', 'code', 'name', 'description', 'color', 'icon',
                               'is_system', 'is_active', 'display_order', 'created_at', 'updated_at'])
    category.id = uuid4()
    category.code = "rent"
    category.name = "Arriendo"
    category.description = "Pagos de arriendo y alquiler de locales"
    category.color = "#EF4444"
    category.icon = "home"
    category.is_system = True
    category.is_active = True
    category.display_order = 1
    category.created_at = datetime.utcnow()
    category.updated_at = datetime.utcnow()
    return category


@pytest.fixture
def sample_custom_category():
    """Create a sample custom (non-system) category for testing."""
    category = MagicMock(spec=['id', 'code', 'name', 'description', 'color', 'icon',
                               'is_system', 'is_active', 'display_order', 'created_at', 'updated_at'])
    category.id = uuid4()
    category.code = "marketing_digital"
    category.name = "Marketing Digital"
    category.description = "Gastos de publicidad en redes sociales"
    category.color = "#14B8A6"
    category.icon = "megaphone"
    category.is_system = False
    category.is_active = True
    category.display_order = 12
    category.created_at = datetime.utcnow()
    category.updated_at = datetime.utcnow()
    return category


@pytest.fixture
def sample_inactive_category():
    """Create a sample inactive category for testing."""
    category = MagicMock(spec=['id', 'code', 'name', 'description', 'color', 'icon',
                               'is_system', 'is_active', 'display_order', 'created_at', 'updated_at'])
    category.id = uuid4()
    category.code = "deprecated"
    category.name = "Categoría Obsoleta"
    category.description = None
    category.color = "#9CA3AF"
    category.icon = None
    category.is_system = False
    category.is_active = False
    category.display_order = 99
    category.created_at = datetime.utcnow()
    category.updated_at = datetime.utcnow()
    return category


# ============================================================================
# TEST: list_categories
# ============================================================================

class TestListCategories:
    """Tests for ExpenseCategoryService.list_categories"""

    @pytest.mark.asyncio
    async def test_list_active_categories_only(
        self,
        mock_db_session,
        sample_system_category,
        sample_custom_category
    ):
        """Should return only active categories by default."""
        # Setup mock
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = [
            sample_system_category,
            sample_custom_category
        ]
        mock_db_session.execute.return_value = mock_result

        service = ExpenseCategoryService(mock_db_session)
        categories = await service.list_categories(include_inactive=False)

        assert len(categories) == 2
        assert categories[0].code == sample_system_category.code
        assert categories[1].code == sample_custom_category.code
        mock_db_session.execute.assert_called_once()

    @pytest.mark.asyncio
    async def test_list_all_categories_including_inactive(
        self,
        mock_db_session,
        sample_system_category,
        sample_custom_category,
        sample_inactive_category
    ):
        """Should return all categories when include_inactive=True."""
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = [
            sample_system_category,
            sample_custom_category,
            sample_inactive_category
        ]
        mock_db_session.execute.return_value = mock_result

        service = ExpenseCategoryService(mock_db_session)
        categories = await service.list_categories(include_inactive=True)

        assert len(categories) == 3

    @pytest.mark.asyncio
    async def test_list_empty_categories(self, mock_db_session):
        """Should return empty list when no categories exist."""
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = []
        mock_db_session.execute.return_value = mock_result

        service = ExpenseCategoryService(mock_db_session)
        categories = await service.list_categories()

        assert len(categories) == 0


# ============================================================================
# TEST: get_by_id
# ============================================================================

class TestGetById:
    """Tests for ExpenseCategoryService.get_by_id"""

    @pytest.mark.asyncio
    async def test_get_existing_category(
        self,
        mock_db_session,
        sample_system_category
    ):
        """Should return category when found."""
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = sample_system_category
        mock_db_session.execute.return_value = mock_result

        service = ExpenseCategoryService(mock_db_session)
        category = await service.get_by_id(sample_system_category.id)

        assert category is not None
        assert category.id == sample_system_category.id
        assert category.code == sample_system_category.code

    @pytest.mark.asyncio
    async def test_get_nonexistent_category(self, mock_db_session):
        """Should return None when category not found."""
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_db_session.execute.return_value = mock_result

        service = ExpenseCategoryService(mock_db_session)
        category = await service.get_by_id(uuid4())

        assert category is None


# ============================================================================
# TEST: get_by_code
# ============================================================================

class TestGetByCode:
    """Tests for ExpenseCategoryService.get_by_code"""

    @pytest.mark.asyncio
    async def test_get_existing_category_by_code(
        self,
        mock_db_session,
        sample_system_category
    ):
        """Should return category when found by code."""
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = sample_system_category
        mock_db_session.execute.return_value = mock_result

        service = ExpenseCategoryService(mock_db_session)
        category = await service.get_by_code("rent")

        assert category is not None
        assert category.code == "rent"

    @pytest.mark.asyncio
    async def test_get_by_code_case_insensitive(
        self,
        mock_db_session,
        sample_system_category
    ):
        """Should normalize code to lowercase."""
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = sample_system_category
        mock_db_session.execute.return_value = mock_result

        service = ExpenseCategoryService(mock_db_session)
        category = await service.get_by_code("RENT")

        assert category is not None


# ============================================================================
# TEST: create
# ============================================================================

class TestCreateCategory:
    """Tests for ExpenseCategoryService.create"""

    @pytest.mark.asyncio
    async def test_create_new_category(self, mock_db_session):
        """Should create a new category successfully."""
        # Mock get_by_code to return None (no existing category)
        mock_result_code = MagicMock()
        mock_result_code.scalar_one_or_none.return_value = None

        # Mock max display_order
        mock_result_max = MagicMock()
        mock_result_max.scalar.return_value = 11

        mock_db_session.execute.side_effect = [mock_result_code, mock_result_max]

        # Mock the created category
        async def mock_refresh(obj):
            obj.id = uuid4()
            obj.is_system = False
            obj.is_active = True
            obj.display_order = 12
            obj.created_at = datetime.utcnow()
            obj.updated_at = datetime.utcnow()

        mock_db_session.refresh.side_effect = mock_refresh

        service = ExpenseCategoryService(mock_db_session)
        data = ExpenseCategoryCreate(
            code="new_category",
            name="Nueva Categoría",
            description="Descripción de prueba",
            color="#FF5733",
            icon="star"
        )

        category = await service.create(data)

        assert category is not None
        assert category.is_system == False
        mock_db_session.add.assert_called_once()
        mock_db_session.flush.assert_called_once()

    @pytest.mark.asyncio
    async def test_create_duplicate_code_fails(
        self,
        mock_db_session,
        sample_custom_category
    ):
        """Should raise ValueError when code already exists."""
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = sample_custom_category
        mock_db_session.execute.return_value = mock_result

        service = ExpenseCategoryService(mock_db_session)
        data = ExpenseCategoryCreate(
            code="marketing_digital",
            name="Otra categoría",
            color="#000000"
        )

        with pytest.raises(ValueError) as exc_info:
            await service.create(data)

        assert "Ya existe una categoría" in str(exc_info.value)


# ============================================================================
# TEST: update
# ============================================================================

class TestUpdateCategory:
    """Tests for ExpenseCategoryService.update"""

    @pytest.mark.asyncio
    async def test_update_category_name(
        self,
        mock_db_session,
        sample_custom_category
    ):
        """Should update category name successfully."""
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = sample_custom_category
        mock_db_session.execute.return_value = mock_result

        service = ExpenseCategoryService(mock_db_session)
        data = ExpenseCategoryUpdate(name="Marketing Digital Actualizado")

        category = await service.update(sample_custom_category.id, data)

        assert category is not None
        assert sample_custom_category.name == "Marketing Digital Actualizado"

    @pytest.mark.asyncio
    async def test_update_category_color(
        self,
        mock_db_session,
        sample_custom_category
    ):
        """Should update category color successfully."""
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = sample_custom_category
        mock_db_session.execute.return_value = mock_result

        service = ExpenseCategoryService(mock_db_session)
        data = ExpenseCategoryUpdate(color="#FF0000")

        category = await service.update(sample_custom_category.id, data)

        assert category is not None
        assert sample_custom_category.color == "#FF0000"

    @pytest.mark.asyncio
    async def test_update_system_category_allowed(
        self,
        mock_db_session,
        sample_system_category
    ):
        """Should allow updating system category name/color."""
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = sample_system_category
        mock_db_session.execute.return_value = mock_result

        service = ExpenseCategoryService(mock_db_session)
        data = ExpenseCategoryUpdate(name="Arriendo Local")

        category = await service.update(sample_system_category.id, data)

        assert category is not None
        assert sample_system_category.name == "Arriendo Local"

    @pytest.mark.asyncio
    async def test_update_nonexistent_category(self, mock_db_session):
        """Should return None when category not found."""
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_db_session.execute.return_value = mock_result

        service = ExpenseCategoryService(mock_db_session)
        data = ExpenseCategoryUpdate(name="Test")

        category = await service.update(uuid4(), data)

        assert category is None


# ============================================================================
# TEST: delete
# ============================================================================

class TestDeleteCategory:
    """Tests for ExpenseCategoryService.delete"""

    @pytest.mark.asyncio
    async def test_delete_custom_category(
        self,
        mock_db_session,
        sample_custom_category
    ):
        """Should soft-delete custom category successfully."""
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = sample_custom_category
        mock_db_session.execute.return_value = mock_result

        service = ExpenseCategoryService(mock_db_session)
        result = await service.delete(sample_custom_category.id)

        assert result == True
        assert sample_custom_category.is_active == False

    @pytest.mark.asyncio
    async def test_delete_system_category_fails(
        self,
        mock_db_session,
        sample_system_category
    ):
        """Should raise ValueError when trying to delete system category."""
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = sample_system_category
        mock_db_session.execute.return_value = mock_result

        service = ExpenseCategoryService(mock_db_session)

        with pytest.raises(ValueError) as exc_info:
            await service.delete(sample_system_category.id)

        assert "categoría del sistema" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_delete_nonexistent_category(self, mock_db_session):
        """Should return False when category not found."""
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_db_session.execute.return_value = mock_result

        service = ExpenseCategoryService(mock_db_session)
        result = await service.delete(uuid4())

        assert result == False


# ============================================================================
# TEST: count
# ============================================================================

class TestCountCategories:
    """Tests for ExpenseCategoryService.count"""

    @pytest.mark.asyncio
    async def test_count_active_categories(self, mock_db_session):
        """Should return count of active categories."""
        mock_result = MagicMock()
        mock_result.scalar.return_value = 11
        mock_db_session.execute.return_value = mock_result

        service = ExpenseCategoryService(mock_db_session)
        count = await service.count(include_inactive=False)

        assert count == 11

    @pytest.mark.asyncio
    async def test_count_all_categories(self, mock_db_session):
        """Should return count of all categories including inactive."""
        mock_result = MagicMock()
        mock_result.scalar.return_value = 15
        mock_db_session.execute.return_value = mock_result

        service = ExpenseCategoryService(mock_db_session)
        count = await service.count(include_inactive=True)

        assert count == 15


# ============================================================================
# TEST: reorder
# ============================================================================

class TestReorderCategories:
    """Tests for ExpenseCategoryService.reorder"""

    @pytest.mark.asyncio
    async def test_reorder_categories(
        self,
        mock_db_session,
        sample_system_category,
        sample_custom_category
    ):
        """Should update display_order for multiple categories."""
        def create_mock_result(category):
            result = MagicMock()
            result.scalar_one_or_none.return_value = category
            return result

        mock_db_session.execute.side_effect = [
            create_mock_result(sample_system_category),
            create_mock_result(sample_custom_category)
        ]

        service = ExpenseCategoryService(mock_db_session)
        orders = [
            {"id": str(sample_system_category.id), "display_order": 2},
            {"id": str(sample_custom_category.id), "display_order": 1}
        ]

        result = await service.reorder(orders)

        assert result == True
        assert sample_system_category.display_order == 2
        assert sample_custom_category.display_order == 1
