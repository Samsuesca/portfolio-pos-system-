"""
Unit Tests for CostComponentService

Tests cost breakdown template management, per-product breakdown
CRUD, bulk application of components, and internal cost recalculation.
"""
import pytest
from decimal import Decimal
from uuid import uuid4
from unittest.mock import AsyncMock, MagicMock, patch

from app.services.cost_component import CostComponentService


FAKE_NOW = "2026-04-14T10:00:00"


def _make_template(
    garment_type_id=None,
    name="Tela",
    code="tela",
    is_variable=False,
    is_active=True,
    display_order=0,
    **kw,
):
    t = MagicMock()
    t.id = kw.get("id", uuid4())
    t.garment_type_id = garment_type_id or uuid4()
    t.name = name
    t.code = code
    t.is_variable = is_variable
    t.is_active = is_active
    t.display_order = display_order
    return t


def _make_product(price=Decimal("50000"), size="M", cost=Decimal("0"), **kw):
    p = MagicMock()
    p.id = kw.get("id", uuid4())
    p.code = kw.get("code", "PRD-001")
    p.name = kw.get("name", "Camisa")
    p.size = size
    p.price = price
    p.cost = cost
    p.is_active = kw.get("is_active", True)
    p.garment_type_id = kw.get("garment_type_id", uuid4())
    return p


def _make_component(template=None, amount=Decimal("5000"), notes=None, **kw):
    c = MagicMock()
    c.id = kw.get("id", uuid4())
    c.product_id = kw.get("product_id", uuid4())
    c.template_id = template.id if template else uuid4()
    c.template = template
    c.amount = amount
    c.notes = notes
    return c


# ============================================================================
# Templates
# ============================================================================

class TestGetTemplates:

    @pytest.mark.asyncio
    @patch("app.services.cost_component.get_colombia_now_naive")
    async def test_returns_active_templates_ordered(self, _tz, mock_db_session):
        t1 = _make_template(display_order=0, name="Tela")
        t2 = _make_template(display_order=1, name="Hilo")
        mock_db_session.execute = AsyncMock(
            return_value=MagicMock(scalars=MagicMock(return_value=MagicMock(all=MagicMock(return_value=[t1, t2]))))
        )
        svc = CostComponentService(mock_db_session)

        result = await svc.get_templates(uuid4())

        assert len(result) == 2
        assert result[0].name == "Tela"
        assert result[1].name == "Hilo"

    @pytest.mark.asyncio
    @patch("app.services.cost_component.get_colombia_now_naive")
    async def test_returns_empty_when_no_active_templates(self, _tz, mock_db_session):
        mock_db_session.execute = AsyncMock(
            return_value=MagicMock(scalars=MagicMock(return_value=MagicMock(all=MagicMock(return_value=[]))))
        )
        svc = CostComponentService(mock_db_session)

        result = await svc.get_templates(uuid4())

        assert result == []


class TestCreateTemplate:

    @pytest.mark.asyncio
    @patch("app.services.cost_component.get_colombia_now_naive")
    async def test_creates_template_with_correct_fields(self, mock_tz, mock_db_session):
        mock_tz.return_value = FAKE_NOW
        mock_db_session.add = MagicMock()
        mock_db_session.flush = AsyncMock()
        mock_db_session.refresh = AsyncMock()

        svc = CostComponentService(mock_db_session)
        gt_id = uuid4()

        result = await svc.create_template(
            garment_type_id=gt_id,
            name="Tela",
            code="tela",
            is_variable=True,
            display_order=5,
        )

        mock_db_session.add.assert_called_once()
        added = mock_db_session.add.call_args[0][0]
        assert added.garment_type_id == gt_id
        assert added.name == "Tela"
        assert added.code == "tela"
        assert added.is_variable is True
        assert added.display_order == 5
        assert added.created_at == FAKE_NOW


class TestUpdateTemplate:

    @pytest.mark.asyncio
    async def test_updates_existing_template(self, mock_db_session):
        template = _make_template(name="Tela")
        mock_db_session.execute = AsyncMock(
            return_value=MagicMock(scalar_one_or_none=MagicMock(return_value=template))
        )
        svc = CostComponentService(mock_db_session)

        result = await svc.update_template(template.id, name="Hilo")

        assert result is not None
        assert template.name == "Hilo"
        mock_db_session.flush.assert_awaited()

    @pytest.mark.asyncio
    async def test_returns_none_when_not_found(self, mock_db_session):
        mock_db_session.execute = AsyncMock(
            return_value=MagicMock(scalar_one_or_none=MagicMock(return_value=None))
        )
        svc = CostComponentService(mock_db_session)

        result = await svc.update_template(uuid4(), name="X")

        assert result is None

    @pytest.mark.asyncio
    async def test_skips_none_values(self, mock_db_session):
        template = _make_template(name="Tela", code="tela")
        mock_db_session.execute = AsyncMock(
            return_value=MagicMock(scalar_one_or_none=MagicMock(return_value=template))
        )
        svc = CostComponentService(mock_db_session)

        await svc.update_template(template.id, name=None, code="hilo")

        assert template.name == "Tela"
        assert template.code == "hilo"


class TestDeactivateTemplate:

    @pytest.mark.asyncio
    async def test_deactivates_existing_template(self, mock_db_session):
        template = _make_template(is_active=True)
        mock_db_session.execute = AsyncMock(
            return_value=MagicMock(scalar_one_or_none=MagicMock(return_value=template))
        )
        svc = CostComponentService(mock_db_session)

        result = await svc.deactivate_template(template.id)

        assert result is True
        assert template.is_active is False

    @pytest.mark.asyncio
    async def test_returns_false_when_not_found(self, mock_db_session):
        mock_db_session.execute = AsyncMock(
            return_value=MagicMock(scalar_one_or_none=MagicMock(return_value=None))
        )
        svc = CostComponentService(mock_db_session)

        result = await svc.deactivate_template(uuid4())

        assert result is False


# ============================================================================
# Breakdown
# ============================================================================

class TestGetBreakdown:

    @pytest.mark.asyncio
    async def test_raises_when_product_not_found(self, mock_db_session):
        mock_db_session.execute = AsyncMock(
            return_value=MagicMock(scalar_one_or_none=MagicMock(return_value=None))
        )
        svc = CostComponentService(mock_db_session)

        with pytest.raises(ValueError, match="no encontrado"):
            await svc.get_breakdown(uuid4())

    @pytest.mark.asyncio
    async def test_returns_breakdown_with_components(self, mock_db_session):
        product = _make_product(price=Decimal("50000"))
        tpl = _make_template(is_variable=False)
        comp = _make_component(template=tpl, amount=Decimal("15000"))

        call_count = 0

        async def fake_execute(stmt):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                return MagicMock(scalar_one_or_none=MagicMock(return_value=product))
            return MagicMock(scalars=MagicMock(return_value=MagicMock(all=MagicMock(return_value=[comp]))))

        mock_db_session.execute = fake_execute
        svc = CostComponentService(mock_db_session)

        result = await svc.get_breakdown(product.id)

        assert result["product_name"] == "Camisa"
        assert result["total_cost"] == 15000.0
        assert result["margin_percent"] == pytest.approx(70.0)
        assert len(result["components"]) == 1

    @pytest.mark.asyncio
    async def test_returns_empty_components_when_none_exist(self, mock_db_session):
        product = _make_product(price=Decimal("50000"))
        call_count = 0

        async def fake_execute(stmt):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                return MagicMock(scalar_one_or_none=MagicMock(return_value=product))
            return MagicMock(scalars=MagicMock(return_value=MagicMock(all=MagicMock(return_value=[]))))

        mock_db_session.execute = fake_execute
        svc = CostComponentService(mock_db_session)

        result = await svc.get_breakdown(product.id)

        assert result["total_cost"] == 0.0
        assert result["components"] == []

    @pytest.mark.asyncio
    async def test_margin_is_zero_when_price_is_zero(self, mock_db_session):
        product = _make_product(price=Decimal("0"))
        call_count = 0

        async def fake_execute(stmt):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                return MagicMock(scalar_one_or_none=MagicMock(return_value=product))
            return MagicMock(scalars=MagicMock(return_value=MagicMock(all=MagicMock(return_value=[]))))

        mock_db_session.execute = fake_execute
        svc = CostComponentService(mock_db_session)

        result = await svc.get_breakdown(product.id)

        assert result["margin_percent"] == 0

    @pytest.mark.asyncio
    async def test_has_estimates_flag_with_variable_component(self, mock_db_session):
        product = _make_product(price=Decimal("50000"))
        tpl = _make_template(is_variable=True)
        comp = _make_component(template=tpl, amount=Decimal("10000"))
        call_count = 0

        async def fake_execute(stmt):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                return MagicMock(scalar_one_or_none=MagicMock(return_value=product))
            return MagicMock(scalars=MagicMock(return_value=MagicMock(all=MagicMock(return_value=[comp]))))

        mock_db_session.execute = fake_execute
        svc = CostComponentService(mock_db_session)

        result = await svc.get_breakdown(product.id)

        assert result["has_estimates"] is True


class TestUpsertBreakdown:

    @pytest.mark.asyncio
    @patch("app.services.cost_component.get_colombia_now_naive")
    async def test_creates_new_component(self, mock_tz, mock_db_session):
        mock_tz.return_value = FAKE_NOW
        product_id = uuid4()
        template_id = uuid4()

        # Service now loads the Product first (for school_id denormalization on the
        # audit log) and rejects with ValueError if it doesn't exist; then queries
        # the existing component. Sequence the two lookups.
        product = _make_product(id=product_id)
        call_count = 0

        async def fake_execute(stmt):
            nonlocal call_count
            call_count += 1
            if call_count == 1:  # Product lookup
                return MagicMock(scalar_one_or_none=MagicMock(return_value=product))
            return MagicMock(scalar_one_or_none=MagicMock(return_value=None))

        mock_db_session.execute = fake_execute

        svc = CostComponentService(mock_db_session)
        svc.get_breakdown = AsyncMock(return_value={"components": []})
        svc._recalculate_product_cost = AsyncMock()

        await svc.upsert_breakdown(product_id, [
            {"template_id": str(template_id), "amount": "5000", "notes": "test"}
        ])

        # A new ProductCostComponent is added (plus a CostChangeLog audit row).
        added_components = [
            c.args[0] for c in mock_db_session.add.call_args_list
            if type(c.args[0]).__name__ == "ProductCostComponent"
        ]
        assert len(added_components) == 1
        assert added_components[0].amount == Decimal("5000")
        svc._recalculate_product_cost.assert_awaited_once_with(product_id)

    @pytest.mark.asyncio
    @patch("app.services.cost_component.get_colombia_now_naive")
    async def test_updates_existing_component(self, mock_tz, mock_db_session):
        mock_tz.return_value = FAKE_NOW
        product_id = uuid4()
        template_id = uuid4()

        product = _make_product(id=product_id)
        existing = MagicMock()
        existing.amount = Decimal("3000")
        existing.notes = None
        call_count = 0

        async def fake_execute(stmt):
            nonlocal call_count
            call_count += 1
            if call_count == 1:  # Product lookup
                return MagicMock(scalar_one_or_none=MagicMock(return_value=product))
            return MagicMock(scalar_one_or_none=MagicMock(return_value=existing))

        mock_db_session.execute = fake_execute

        svc = CostComponentService(mock_db_session)
        svc.get_breakdown = AsyncMock(return_value={"components": []})
        svc._recalculate_product_cost = AsyncMock()

        await svc.upsert_breakdown(product_id, [
            {"template_id": str(template_id), "amount": "7000"}
        ])

        # Existing row is mutated in place (not re-added); only an audit
        # CostChangeLog is added, never a ProductCostComponent.
        assert existing.amount == Decimal("7000")
        added_components = [
            c.args[0] for c in mock_db_session.add.call_args_list
            if type(c.args[0]).__name__ == "ProductCostComponent"
        ]
        assert added_components == []


# ============================================================================
# Bulk
# ============================================================================

class TestBulkApplyComponent:

    @pytest.mark.asyncio
    @patch("app.services.cost_component.get_colombia_now_naive")
    async def test_raises_when_template_not_found(self, mock_tz, mock_db_session):
        mock_tz.return_value = FAKE_NOW
        mock_db_session.execute = AsyncMock(
            return_value=MagicMock(scalar_one_or_none=MagicMock(return_value=None))
        )
        svc = CostComponentService(mock_db_session)

        with pytest.raises(ValueError, match="no encontrado"):
            await svc.bulk_apply_component(uuid4(), "tela", Decimal("5000"))

    @pytest.mark.asyncio
    @patch("app.services.cost_component.get_colombia_now_naive")
    async def test_applies_to_all_products(self, mock_tz, mock_db_session):
        mock_tz.return_value = FAKE_NOW
        gt_id = uuid4()
        template = _make_template(garment_type_id=gt_id, code="tela")
        p1 = _make_product(size="S", id=uuid4())
        p2 = _make_product(size="M", id=uuid4())

        call_count = 0

        async def fake_execute(stmt):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                return MagicMock(scalar_one_or_none=MagicMock(return_value=template))
            if call_count == 2:
                return MagicMock(scalars=MagicMock(return_value=MagicMock(all=MagicMock(return_value=[p1, p2]))))
            return MagicMock(scalar_one_or_none=MagicMock(return_value=None))

        mock_db_session.execute = fake_execute
        svc = CostComponentService(mock_db_session)
        svc._recalculate_product_cost = AsyncMock()

        result = await svc.bulk_apply_component(gt_id, "tela", Decimal("5000"))

        assert result["updated"] == 2
        assert result["total_cost_recalculated"] == 2
        # One ProductCostComponent per product (CostChangeLog audit rows are
        # added separately and not counted here).
        added_components = [
            c.args[0] for c in mock_db_session.add.call_args_list
            if type(c.args[0]).__name__ == "ProductCostComponent"
        ]
        assert len(added_components) == 2

    @pytest.mark.asyncio
    @patch("app.services.cost_component.get_colombia_now_naive")
    async def test_applies_size_deltas(self, mock_tz, mock_db_session):
        mock_tz.return_value = FAKE_NOW
        gt_id = uuid4()
        template = _make_template(garment_type_id=gt_id, code="tela")
        p_s = _make_product(size="S", id=uuid4())
        p_xl = _make_product(size="XL", id=uuid4())

        call_count = 0

        async def fake_execute(stmt):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                return MagicMock(scalar_one_or_none=MagicMock(return_value=template))
            if call_count == 2:
                return MagicMock(scalars=MagicMock(return_value=MagicMock(all=MagicMock(return_value=[p_s, p_xl]))))
            return MagicMock(scalar_one_or_none=MagicMock(return_value=None))

        mock_db_session.execute = fake_execute
        svc = CostComponentService(mock_db_session)
        svc._recalculate_product_cost = AsyncMock()

        await svc.bulk_apply_component(
            gt_id, "tela", Decimal("5000"),
            size_deltas=[{"sizes": ["XL"], "delta": "1000"}],
        )

        # Only inspect the ProductCostComponent rows (skip CostChangeLog audit rows,
        # which have no `amount` attribute).
        amounts = {
            c.args[0].amount for c in mock_db_session.add.call_args_list
            if type(c.args[0]).__name__ == "ProductCostComponent"
        }
        assert Decimal("5000") in amounts
        assert Decimal("6000") in amounts


# ============================================================================
# Internal
# ============================================================================

class TestRecalculateProductCost:

    @pytest.mark.asyncio
    async def test_sums_components_and_sets_cost(self, mock_db_session):
        product = _make_product(cost=Decimal("0"))
        call_count = 0

        async def fake_execute(stmt):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                return MagicMock(scalar=MagicMock(return_value=Decimal("25000")))
            return MagicMock(scalar_one_or_none=MagicMock(return_value=product))

        mock_db_session.execute = fake_execute
        svc = CostComponentService(mock_db_session)

        await svc._recalculate_product_cost(product.id)

        assert product.cost == Decimal("25000")

    @pytest.mark.asyncio
    async def test_sets_zero_when_no_components(self, mock_db_session):
        product = _make_product(cost=Decimal("10000"))
        call_count = 0

        async def fake_execute(stmt):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                return MagicMock(scalar=MagicMock(return_value=None))
            return MagicMock(scalar_one_or_none=MagicMock(return_value=product))

        mock_db_session.execute = fake_execute
        svc = CostComponentService(mock_db_session)

        await svc._recalculate_product_cost(product.id)

        assert product.cost == Decimal("0")

    @pytest.mark.asyncio
    async def test_safe_when_product_not_found(self, mock_db_session):
        call_count = 0

        async def fake_execute(stmt):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                return MagicMock(scalar=MagicMock(return_value=Decimal("5000")))
            return MagicMock(scalar_one_or_none=MagicMock(return_value=None))

        mock_db_session.execute = fake_execute
        svc = CostComponentService(mock_db_session)

        await svc._recalculate_product_cost(uuid4())
