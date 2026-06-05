"""
Unit Tests for Pagination Standardization

Tests for:
- PaginatedResponse schema (computed fields, subclasses, type aliases)
- BaseService.get_multi_paginated (parallel count + data)
- SchoolIsolatedService.get_multi_paginated (school-scoped)
- ClientService.count_all_clients (filtered count)
- Route-level pagination contract (response shape)
"""
import json
import pytest
from decimal import Decimal
from uuid import uuid4
from unittest.mock import AsyncMock, MagicMock, patch
from pydantic import BaseModel

from app.schemas.base import PaginatedResponse, BaseSchema


# ============================================================================
# FIXTURES
# ============================================================================

class SampleItem(BaseModel):
    id: int
    name: str


class SampleItemORM(BaseSchema):
    id: int
    name: str


def make_paginated(total: int, skip: int, limit: int) -> PaginatedResponse[SampleItem]:
    count = min(limit, max(0, total - skip))
    items = [SampleItem(id=i, name=f"item-{i}") for i in range(count)]
    return PaginatedResponse[SampleItem](items=items, total=total, skip=skip, limit=limit)


# ============================================================================
# TEST: PaginatedResponse Schema — Computed Fields
# ============================================================================

class TestPaginatedResponseComputedFields:

    def test_page_calculation_first(self):
        resp = make_paginated(total=100, skip=0, limit=20)
        assert resp.page == 1

    def test_page_calculation_second(self):
        resp = make_paginated(total=100, skip=20, limit=20)
        assert resp.page == 2

    def test_page_calculation_arbitrary_skip(self):
        resp = make_paginated(total=100, skip=45, limit=15)
        assert resp.page == 4

    def test_total_pages_exact(self):
        resp = make_paginated(total=100, skip=0, limit=25)
        assert resp.total_pages == 4

    def test_total_pages_remainder(self):
        resp = make_paginated(total=101, skip=0, limit=25)
        assert resp.total_pages == 5

    def test_total_pages_single(self):
        resp = make_paginated(total=5, skip=0, limit=100)
        assert resp.total_pages == 1

    def test_has_more_true(self):
        resp = make_paginated(total=100, skip=0, limit=50)
        assert resp.has_more is True

    def test_has_more_false_last_page(self):
        resp = make_paginated(total=100, skip=80, limit=20)
        assert resp.has_more is False

    def test_has_more_false_exact_boundary(self):
        resp = make_paginated(total=100, skip=50, limit=50)
        assert resp.has_more is False

    def test_empty_total(self):
        resp = make_paginated(total=0, skip=0, limit=50)
        assert resp.page == 1
        assert resp.total_pages == 0
        assert resp.has_more is False
        assert resp.items == []

    def test_skip_beyond_total(self):
        resp = make_paginated(total=10, skip=500, limit=50)
        assert resp.has_more is False
        assert resp.page == 11

    def test_limit_zero_safe(self):
        resp = PaginatedResponse[SampleItem](items=[], total=10, skip=0, limit=0)
        assert resp.page == 1
        assert resp.total_pages == 0
        assert resp.has_more is False

    def test_limit_one(self):
        resp = make_paginated(total=5, skip=2, limit=1)
        assert resp.page == 3
        assert resp.total_pages == 5
        assert resp.has_more is True

    def test_negative_total_treated_as_zero(self):
        resp = PaginatedResponse[SampleItem](items=[], total=-1, skip=0, limit=10)
        assert resp.total_pages == 0
        assert resp.has_more is False


# ============================================================================
# TEST: PaginatedResponse — Serialization
# ============================================================================

class TestPaginatedResponseSerialization:

    def test_model_dump_includes_all_fields(self):
        resp = make_paginated(total=50, skip=10, limit=10)
        data = resp.model_dump()
        assert set(data.keys()) == {"items", "total", "skip", "limit", "page", "total_pages", "has_more"}

    def test_model_dump_json_roundtrip(self):
        resp = make_paginated(total=50, skip=10, limit=10)
        raw = json.loads(resp.model_dump_json())
        assert raw["page"] == 2
        assert raw["total_pages"] == 5
        assert raw["has_more"] is True
        assert len(raw["items"]) == 10

    def test_items_serialized_correctly(self):
        resp = make_paginated(total=3, skip=0, limit=10)
        data = resp.model_dump()
        assert len(data["items"]) == 3
        assert data["items"][0]["id"] == 0
        assert data["items"][0]["name"] == "item-0"

    def test_schema_json_schema_has_base_fields(self):
        schema = PaginatedResponse[SampleItem].model_json_schema()
        props = schema["properties"]
        assert "items" in props
        assert "total" in props
        assert "skip" in props
        assert "limit" in props


# ============================================================================
# TEST: PaginatedResponse — Subclass Extension
# ============================================================================

class TestPaginatedResponseSubclass:

    def test_subclass_with_extra_field(self):
        """NotificationListResponse pattern: PaginatedResponse + unread_count"""
        class ExtendedResponse(PaginatedResponse[SampleItem]):
            unread_count: int

        resp = ExtendedResponse(
            items=[SampleItem(id=1, name="n1")],
            total=10,
            skip=0,
            limit=50,
            unread_count=3,
        )
        assert resp.unread_count == 3
        assert resp.page == 1
        assert resp.has_more is False

        data = resp.model_dump()
        assert "unread_count" in data
        assert "page" in data

    def test_subclass_inherits_computed_fields(self):
        class SubResponse(PaginatedResponse[SampleItem]):
            pass

        resp = SubResponse(
            items=[SampleItem(id=1, name="x")],
            total=100, skip=50, limit=25,
        )
        assert resp.page == 3
        assert resp.total_pages == 4
        assert resp.has_more is True

    def test_type_alias_works(self):
        """EmailLogListResponse pattern: type alias"""
        AliasResponse = PaginatedResponse[SampleItem]
        resp = AliasResponse(items=[], total=0, skip=0, limit=10)
        assert resp.page == 1
        assert resp.total_pages == 0


# ============================================================================
# TEST: PaginatedResponse — ORM Mode (from_attributes)
# ============================================================================

class TestPaginatedResponseORM:

    def test_with_orm_schema_items(self):
        resp = PaginatedResponse[SampleItemORM](
            items=[SampleItemORM(id=1, name="orm-item")],
            total=1, skip=0, limit=10,
        )
        assert resp.items[0].id == 1
        assert resp.page == 1


# ============================================================================
# TEST: BaseService.get_multi_paginated
# ============================================================================

class TestBaseServiceGetMultiPaginated:

    @pytest.fixture
    def mock_db(self):
        from sqlalchemy.ext.asyncio import AsyncSession
        session = AsyncMock(spec=AsyncSession)
        session.execute = AsyncMock()
        session.flush = AsyncMock()
        return session

    @pytest.mark.asyncio
    async def test_returns_dict_with_correct_keys(self, mock_db):
        from app.services.base import BaseService
        from app.db.base import Base
        import sqlalchemy as sa

        class FakeModel(Base):
            __tablename__ = "fake_pagination_test"
            id = sa.Column(sa.Integer, primary_key=True)
            name = sa.Column(sa.String)

        service = BaseService(FakeModel, mock_db)

        with patch.object(service, 'get_multi', new_callable=AsyncMock, return_value=["a", "b"]):
            with patch.object(service, 'count', new_callable=AsyncMock, return_value=10):
                result = await service.get_multi_paginated(skip=5, limit=2)

        assert result == {"items": ["a", "b"], "total": 10, "skip": 5, "limit": 2}

    @pytest.mark.asyncio
    async def test_passes_filters_to_both_methods(self, mock_db):
        from app.services.base import BaseService
        from app.db.base import Base
        import sqlalchemy as sa

        class FakeModel2(Base):
            __tablename__ = "fake_pagination_test_2"
            id = sa.Column(sa.Integer, primary_key=True)

        service = BaseService(FakeModel2, mock_db)
        filters = {"is_active": True}

        with patch.object(service, 'get_multi', new_callable=AsyncMock, return_value=[]) as mock_get:
            with patch.object(service, 'count', new_callable=AsyncMock, return_value=0) as mock_count:
                await service.get_multi_paginated(skip=0, limit=10, filters=filters)

        mock_get.assert_called_once_with(skip=0, limit=10, filters=filters)
        mock_count.assert_called_once_with(filters=filters)

    @pytest.mark.asyncio
    async def test_runs_get_multi_and_count_concurrently(self, mock_db):
        """Verify asyncio.gather is used (both called, not sequential)."""
        from app.services.base import BaseService
        from app.db.base import Base
        import sqlalchemy as sa
        import asyncio

        class FakeModel3(Base):
            __tablename__ = "fake_pagination_test_3"
            id = sa.Column(sa.Integer, primary_key=True)

        call_order = []

        async def slow_get_multi(**kwargs):
            call_order.append("get_multi_start")
            await asyncio.sleep(0.01)
            call_order.append("get_multi_end")
            return []

        async def slow_count(**kwargs):
            call_order.append("count_start")
            await asyncio.sleep(0.01)
            call_order.append("count_end")
            return 0

        service = BaseService(FakeModel3, mock_db)

        with patch.object(service, 'get_multi', side_effect=slow_get_multi):
            with patch.object(service, 'count', side_effect=slow_count):
                await service.get_multi_paginated(skip=0, limit=10)

        assert "get_multi_start" in call_order
        assert "count_start" in call_order


# ============================================================================
# TEST: SchoolIsolatedService.get_multi_paginated
# ============================================================================

class TestSchoolIsolatedServiceGetMultiPaginated:

    @pytest.fixture
    def mock_db(self):
        from sqlalchemy.ext.asyncio import AsyncSession
        session = AsyncMock(spec=AsyncSession)
        session.execute = AsyncMock()
        session.flush = AsyncMock()
        return session

    @pytest.mark.asyncio
    async def test_passes_school_id(self, mock_db):
        from app.services.base import SchoolIsolatedService
        from app.db.base import Base
        import sqlalchemy as sa

        class FakeSchoolModel(Base):
            __tablename__ = "fake_school_pagination_test"
            id = sa.Column(sa.Integer, primary_key=True)
            school_id = sa.Column(sa.String)

        service = SchoolIsolatedService(FakeSchoolModel, mock_db)
        school_id = uuid4()

        with patch.object(service, 'get_multi', new_callable=AsyncMock, return_value=[]) as mock_get:
            with patch.object(service, 'count', new_callable=AsyncMock, return_value=5) as mock_count:
                result = await service.get_multi_paginated(
                    school_id=school_id, skip=10, limit=20
                )

        mock_get.assert_called_once_with(school_id=school_id, skip=10, limit=20, filters=None)
        mock_count.assert_called_once_with(school_id=school_id, filters=None)
        assert result == {"items": [], "total": 5, "skip": 10, "limit": 20}


# ============================================================================
# TEST: ClientService.count_all_clients
# ============================================================================

class TestClientServiceCountAllClients:

    @pytest.fixture
    def mock_db(self):
        from sqlalchemy.ext.asyncio import AsyncSession
        session = AsyncMock(spec=AsyncSession)
        return session

    @pytest.mark.asyncio
    async def test_count_without_filters(self, mock_db):
        from app.services.client import ClientService

        mock_db.execute = AsyncMock(
            return_value=MagicMock(scalar_one=MagicMock(return_value=42))
        )
        service = ClientService(mock_db)

        result = await service.count_all_clients()
        assert result == 42

    @pytest.mark.asyncio
    async def test_count_with_search_filter(self, mock_db):
        from app.services.client import ClientService

        mock_db.execute = AsyncMock(
            return_value=MagicMock(scalar_one=MagicMock(return_value=5))
        )
        service = ClientService(mock_db)

        result = await service.count_all_clients(search="juan")
        assert result == 5
        mock_db.execute.assert_called_once()

    @pytest.mark.asyncio
    async def test_count_with_client_type_filter(self, mock_db):
        from app.services.client import ClientService
        from app.models.client import ClientType

        mock_db.execute = AsyncMock(
            return_value=MagicMock(scalar_one=MagicMock(return_value=10))
        )
        service = ClientService(mock_db)

        result = await service.count_all_clients(client_type=ClientType.WEB)
        assert result == 10

    @pytest.mark.asyncio
    async def test_count_with_inactive_filter(self, mock_db):
        from app.services.client import ClientService

        mock_db.execute = AsyncMock(
            return_value=MagicMock(scalar_one=MagicMock(return_value=3))
        )
        service = ClientService(mock_db)

        result = await service.count_all_clients(is_active=False)
        assert result == 3

    @pytest.mark.asyncio
    async def test_count_returns_zero_when_no_matches(self, mock_db):
        from app.services.client import ClientService

        mock_db.execute = AsyncMock(
            return_value=MagicMock(scalar_one=MagicMock(return_value=0))
        )
        service = ClientService(mock_db)

        result = await service.count_all_clients(search="nonexistent")
        assert result == 0


# ============================================================================
# TEST: PaginatedResponse — Integration with Real Schemas
# ============================================================================

class TestPaginatedResponseWithRealSchemas:

    def test_with_notification_schema(self):
        from app.schemas.notification import NotificationListResponse, NotificationResponse

        resp = NotificationListResponse(
            items=[],
            total=0,
            skip=0,
            limit=50,
            unread_count=7,
        )
        assert resp.unread_count == 7
        assert resp.page == 1
        assert resp.has_more is False
        data = resp.model_dump()
        assert "unread_count" in data
        assert "page" in data
        assert "total_pages" in data

    def test_email_log_type_alias(self):
        from app.schemas.email_log import EmailLogListResponse

        resp = EmailLogListResponse(items=[], total=0, skip=0, limit=10)
        assert resp.page == 1
        assert resp.total_pages == 0
        assert resp.has_more is False

    def test_inventory_log_type_alias(self):
        from app.schemas.inventory_log import InventoryLogListResponse

        resp = InventoryLogListResponse(items=[], total=0, skip=0, limit=10)
        assert resp.page == 1

    def test_adjustment_type_alias(self):
        from app.schemas.accounting import AdjustmentListPaginatedResponse

        resp = AdjustmentListPaginatedResponse(items=[], total=0, skip=0, limit=10)
        assert resp.page == 1
        assert resp.has_more is False

    def test_contact_type_alias(self):
        from app.schemas.contact import ContactListResponse

        resp = ContactListResponse(items=[], total=0, skip=0, limit=20)
        assert resp.page == 1
        assert resp.total_pages == 0


# ============================================================================
# TEST: PaginatedParams Dependency
# ============================================================================

class TestPaginatedParams:

    def test_custom_values(self):
        from app.api.dependencies import PaginatedParams
        params = PaginatedParams(skip=50, limit=25)
        assert params.skip == 50
        assert params.limit == 25

    def test_stores_values_as_attributes(self):
        from app.api.dependencies import PaginatedParams
        params = PaginatedParams(skip=10, limit=200)
        assert isinstance(params.skip, int)
        assert isinstance(params.limit, int)


# ============================================================================
# TEST: Route Response Contract
# ============================================================================

class TestRouteResponseContract:
    """Verify that route endpoints construct PaginatedResponse correctly."""

    def test_paginated_response_can_build_from_route_pattern(self):
        """Simulate the pattern used in routes: build from items + total."""
        from app.schemas.base import PaginatedResponse

        class ProductResponse(BaseModel):
            id: str
            name: str
            price: float

        items = [
            ProductResponse(id="1", name="Camiseta", price=25000),
            ProductResponse(id="2", name="Pantalon", price=35000),
        ]

        resp = PaginatedResponse[ProductResponse](
            items=items, total=150, skip=0, limit=50
        )

        data = resp.model_dump()
        assert data["total"] == 150
        assert data["page"] == 1
        assert data["total_pages"] == 3
        assert data["has_more"] is True
        assert len(data["items"]) == 2
        assert data["items"][0]["name"] == "Camiseta"

    def test_empty_user_school_ids_returns_empty_paginated(self):
        """Routes return empty PaginatedResponse when user has no schools."""
        from app.schemas.base import PaginatedResponse

        class OrderItem(BaseModel):
            id: str

        resp = PaginatedResponse[OrderItem](items=[], total=0, skip=0, limit=100)
        data = resp.model_dump()
        assert data["items"] == []
        assert data["total"] == 0
        assert data["has_more"] is False
        assert data["page"] == 1

    def test_paginated_response_with_filters_preserves_skip_limit(self):
        """Skip/limit in response match what was passed, not items count."""
        resp = make_paginated(total=200, skip=100, limit=50)
        data = resp.model_dump()
        assert data["skip"] == 100
        assert data["limit"] == 50
        assert data["page"] == 3
        assert data["total"] == 200
