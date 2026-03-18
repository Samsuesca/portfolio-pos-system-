"""
Unit tests for Patrimony Service.

Tests for business patrimony/net worth calculations:
- Inventory valuation (actual cost vs estimated)
- Cash and bank balances
- Accounts receivable/payable totals
- Fixed assets
- Patrimony summary (assets - liabilities)
- Global patrimony consolidation
"""
import pytest
from decimal import Decimal
from uuid import uuid4
from unittest.mock import AsyncMock, MagicMock, patch

pytestmark = pytest.mark.unit


# ============================================================================
# HELPERS
# ============================================================================

def make_product(price=50000, cost=None, is_active=True, school_id=None):
    """Create a mock product."""
    p = MagicMock()
    p.id = uuid4()
    p.code = f"P-{uuid4().hex[:4].upper()}"
    p.name = "Test Product"
    p.size = "M"
    p.price = Decimal(str(price))
    p.cost = Decimal(str(cost)) if cost is not None else None
    p.is_active = is_active
    p.school_id = school_id or uuid4()
    return p


def make_inventory(quantity=10):
    """Create a mock inventory."""
    inv = MagicMock()
    inv.quantity = quantity
    inv.product_id = uuid4()
    return inv


def make_balance_account(account_type, balance=0, name="Account", school_id=None):
    """Create a mock balance account."""
    acc = MagicMock()
    acc.id = uuid4()
    acc.name = name
    acc.account_type = account_type
    acc.balance = Decimal(str(balance))
    acc.school_id = school_id or uuid4()
    acc.is_active = True
    acc.original_value = Decimal(str(balance))
    acc.accumulated_depreciation = Decimal("0")
    acc.net_value = Decimal(str(balance))
    return acc


def make_receivable(amount=100000, amount_paid=0, is_paid=False, school_id=None):
    """Create a mock accounts receivable."""
    ar = MagicMock()
    ar.id = uuid4()
    ar.amount = Decimal(str(amount))
    ar.amount_paid = Decimal(str(amount_paid))
    ar.is_paid = is_paid
    ar.school_id = school_id or uuid4()
    return ar


# ============================================================================
# INVENTORY VALUATION
# ============================================================================

class TestInventoryValuation:
    """Tests for get_inventory_valuation."""

    async def test_empty_inventory_returns_zero(self, mock_db_session):
        """Empty inventory should return zero totals."""
        from app.services.patrimony import PatrimonyService

        mock_result_school = MagicMock()
        mock_result_school.all.return_value = []

        mock_result_global = MagicMock()
        mock_result_global.all.return_value = []

        mock_db_session.execute = AsyncMock(
            side_effect=[mock_result_school, mock_result_global]
        )
        service = PatrimonyService(mock_db_session)

        result = await service.get_inventory_valuation(uuid4())

        assert result["total_units"] == 0
        assert result["total_value"] == 0
        assert result["products_with_cost"] == 0
        assert result["products_estimated"] == 0
        assert result["breakdown"] == []

    async def test_valuation_with_actual_cost(self, mock_db_session):
        """Products with cost should use actual cost."""
        from app.services.patrimony import PatrimonyService

        product = make_product(price=50000, cost=30000)
        inventory = make_inventory(quantity=10)

        # First call returns school products, second returns global (empty)
        mock_result_school = MagicMock()
        mock_result_school.all.return_value = [(product, inventory)]

        mock_result_global = MagicMock()
        mock_result_global.all.return_value = []

        mock_db_session.execute = AsyncMock(
            side_effect=[mock_result_school, mock_result_global]
        )

        service = PatrimonyService(mock_db_session)
        result = await service.get_inventory_valuation(uuid4())

        assert result["total_units"] == 10
        assert result["total_value"] == 300000.0  # 30000 * 10
        assert result["products_with_cost"] == 1
        assert result["products_estimated"] == 0

    async def test_valuation_without_cost_uses_estimate(self, mock_db_session):
        """Products without cost should estimate at 80% of price."""
        from app.services.patrimony import PatrimonyService

        product = make_product(price=50000, cost=None)
        inventory = make_inventory(quantity=5)

        mock_result_school = MagicMock()
        mock_result_school.all.return_value = [(product, inventory)]

        mock_result_global = MagicMock()
        mock_result_global.all.return_value = []

        mock_db_session.execute = AsyncMock(
            side_effect=[mock_result_school, mock_result_global]
        )

        service = PatrimonyService(mock_db_session)
        result = await service.get_inventory_valuation(uuid4())

        # 50000 * 0.80 * 5 = 200000
        assert result["total_value"] == 200000.0
        assert result["products_estimated"] == 1
        assert result["products_with_cost"] == 0

    async def test_valuation_mixed_cost_and_estimated(self, mock_db_session):
        """Mix of products with and without cost."""
        from app.services.patrimony import PatrimonyService

        prod_with_cost = make_product(price=50000, cost=30000)
        inv_with_cost = make_inventory(quantity=10)

        prod_no_cost = make_product(price=40000, cost=None)
        inv_no_cost = make_inventory(quantity=5)

        mock_result_school = MagicMock()
        mock_result_school.all.return_value = [
            (prod_with_cost, inv_with_cost),
            (prod_no_cost, inv_no_cost),
        ]

        mock_result_global = MagicMock()
        mock_result_global.all.return_value = []

        mock_db_session.execute = AsyncMock(
            side_effect=[mock_result_school, mock_result_global]
        )

        service = PatrimonyService(mock_db_session)
        result = await service.get_inventory_valuation(uuid4())

        # 30000*10 + 40000*0.80*5 = 300000 + 160000 = 460000
        assert result["total_units"] == 15
        assert result["total_value"] == 460000.0
        assert result["products_with_cost"] == 1
        assert result["products_estimated"] == 1

    async def test_breakdown_sorted_by_value_descending(self, mock_db_session):
        """Breakdown should be sorted by total_value descending."""
        from app.services.patrimony import PatrimonyService

        prod_low = make_product(price=10000, cost=5000)
        inv_low = make_inventory(quantity=2)  # 10000

        prod_high = make_product(price=50000, cost=40000)
        inv_high = make_inventory(quantity=10)  # 400000

        mock_result_school = MagicMock()
        mock_result_school.all.return_value = [
            (prod_low, inv_low),
            (prod_high, inv_high),
        ]

        mock_result_global = MagicMock()
        mock_result_global.all.return_value = []

        mock_db_session.execute = AsyncMock(
            side_effect=[mock_result_school, mock_result_global]
        )

        service = PatrimonyService(mock_db_session)
        result = await service.get_inventory_valuation(uuid4())

        assert len(result["breakdown"]) == 2
        assert result["breakdown"][0]["total_value"] > result["breakdown"][1]["total_value"]


# ============================================================================
# ACCOUNTS RECEIVABLE
# ============================================================================

class TestAccountsReceivable:
    """Tests for get_accounts_receivable_total."""

    async def test_no_receivables_returns_zero(self, mock_db_session):
        """No receivables should return zero totals."""
        from app.services.patrimony import PatrimonyService

        mock_result = MagicMock()
        mock_result.one.return_value = (None, 0)

        mock_db_session.execute = AsyncMock(return_value=mock_result)

        service = PatrimonyService(mock_db_session)
        result = await service.get_accounts_receivable_total(uuid4())

        assert result["total"] == 0
        assert result["count"] == 0

    async def test_receivables_with_amounts(self, mock_db_session):
        """Should return correct totals."""
        from app.services.patrimony import PatrimonyService

        mock_total = MagicMock()
        mock_total.one.return_value = (Decimal("250000"), 3)

        mock_overdue = MagicMock()
        mock_overdue.one.return_value = (Decimal("100000"), 1)

        mock_db_session.execute = AsyncMock(
            side_effect=[mock_total, mock_overdue]
        )

        service = PatrimonyService(mock_db_session)
        result = await service.get_accounts_receivable_total(uuid4())

        assert result["total"] == 250000.0
        assert result["count"] == 3
        assert result["overdue_total"] == 100000.0
        assert result["overdue_count"] == 1


# ============================================================================
# ACCOUNTS PAYABLE
# ============================================================================

class TestAccountsPayable:
    """Tests for get_accounts_payable_total."""

    async def test_no_payables_returns_zero(self, mock_db_session):
        """No payables should return zero totals."""
        from app.services.patrimony import PatrimonyService

        mock_result = MagicMock()
        mock_result.one.return_value = (None, 0)

        mock_db_session.execute = AsyncMock(return_value=mock_result)

        service = PatrimonyService(mock_db_session)
        result = await service.get_accounts_payable_total(uuid4())

        assert result["total"] == 0
        assert result["count"] == 0

    async def test_payables_with_overdue(self, mock_db_session):
        """Should calculate overdue payables."""
        from app.services.patrimony import PatrimonyService

        mock_total = MagicMock()
        mock_total.one.return_value = (Decimal("500000"), 5)

        mock_overdue = MagicMock()
        mock_overdue.one.return_value = (Decimal("200000"), 2)

        mock_db_session.execute = AsyncMock(
            side_effect=[mock_total, mock_overdue]
        )

        service = PatrimonyService(mock_db_session)
        result = await service.get_accounts_payable_total(uuid4())

        assert result["total"] == 500000.0
        assert result["count"] == 5
        assert result["overdue_total"] == 200000.0
        assert result["overdue_count"] == 2


# ============================================================================
# FIXED ASSETS
# ============================================================================

class TestFixedAssets:
    """Tests for get_fixed_assets."""

    async def test_no_fixed_assets(self, mock_db_session):
        """No fixed assets should return zero."""
        from app.services.patrimony import PatrimonyService

        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = []

        mock_db_session.execute = AsyncMock(return_value=mock_result)

        service = PatrimonyService(mock_db_session)
        result = await service.get_fixed_assets(uuid4())

        assert result["total_value"] == 0
        assert result["count"] == 0
        assert result["breakdown"] == []

    async def test_fixed_assets_with_values(self, mock_db_session):
        """Should sum fixed asset values."""
        from app.services.patrimony import PatrimonyService
        from app.models.accounting import AccountType

        asset1 = make_balance_account(AccountType.ASSET_FIXED, balance=2000000, name="Máquina Coser")
        asset1.net_value = Decimal("1800000")
        asset1.accumulated_depreciation = Decimal("200000")

        asset2 = make_balance_account(AccountType.ASSET_FIXED, balance=500000, name="Mesa de Corte")
        asset2.net_value = Decimal("500000")
        asset2.accumulated_depreciation = Decimal("0")

        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = [asset1, asset2]

        mock_db_session.execute = AsyncMock(return_value=mock_result)

        service = PatrimonyService(mock_db_session)
        result = await service.get_fixed_assets(uuid4())

        assert result["total_value"] == 2300000.0
        assert result["count"] == 2
        assert len(result["breakdown"]) == 2


# ============================================================================
# PATRIMONY SUMMARY
# ============================================================================

class TestPatrimonySummary:
    """Tests for get_patrimony_summary (integration of all parts)."""

    async def test_patrimony_structure(self, mock_db_session):
        """Summary should have correct structure."""
        from app.services.patrimony import PatrimonyService

        service = PatrimonyService(mock_db_session)

        with patch.object(service, 'get_inventory_valuation', return_value={
            "total_units": 0, "total_value": 0,
            "products_with_cost": 0, "products_estimated": 0,
            "cost_margin_used": 0.80, "breakdown": []
        }):
            with patch.object(service, 'get_cash_and_bank', return_value={
                "total_liquid": 0
            }):
                with patch.object(service, 'get_accounts_receivable_total', return_value={
                    "total": 0, "count": 0, "overdue_total": 0, "overdue_count": 0
                }):
                    with patch.object(service, 'get_accounts_payable_total', return_value={
                        "total": 0, "count": 0, "overdue_total": 0, "overdue_count": 0
                    }):
                        with patch.object(service, 'get_fixed_assets', return_value={
                            "total_value": 0, "count": 0, "breakdown": []
                        }):
                            with patch.object(service, 'get_intangible_assets', return_value={
                                "total_value": 0, "count": 0, "breakdown": []
                            }):
                                with patch.object(service, 'get_debts', return_value={
                                    "short_term": 0, "long_term": 0,
                                    "total": 0, "breakdown": []
                                }):
                                    result = await service.get_patrimony_summary(uuid4())

        assert "assets" in result
        assert "liabilities" in result
        assert "summary" in result
        assert "generated_at" in result

    async def test_patrimony_calculation(self, mock_db_session):
        """Patrimony = Assets - Liabilities."""
        from app.services.patrimony import PatrimonyService

        service = PatrimonyService(mock_db_session)

        with patch.object(service, 'get_inventory_valuation', return_value={
            "total_units": 100, "total_value": 5000000,
            "products_with_cost": 50, "products_estimated": 50,
            "cost_margin_used": 0.80, "breakdown": []
        }):
            with patch.object(service, 'get_cash_and_bank', return_value={
                "caja_menor": {"balance": 1000000},
                "caja_mayor": {"balance": 1000000},
                "nequi": {"balance": 1500000},
                "banco": {"balance": 1500000},
                "total_liquid": 5000000
            }):
                with patch.object(service, 'get_accounts_receivable_total', return_value={
                    "total": 1000000, "count": 5, "overdue_total": 200000, "overdue_count": 1
                }):
                    with patch.object(service, 'get_accounts_payable_total', return_value={
                        "total": 500000, "count": 3, "overdue_total": 100000, "overdue_count": 1
                    }):
                        with patch.object(service, 'get_fixed_assets', return_value={
                            "total_value": 2000000, "count": 2, "breakdown": []
                        }):
                            with patch.object(service, 'get_intangible_assets', return_value={
                                "total_value": 0, "count": 0, "breakdown": []
                            }):
                                with patch.object(service, 'get_debts', return_value={
                                    "short_term": {"total": 300000, "count": 1, "breakdown": []},
                                    "long_term": {"total": 700000, "count": 1, "breakdown": []},
                                    "total": 1000000
                                }):
                                    result = await service.get_patrimony_summary(uuid4())

        # Assets = liquid (5M) + inventory (5M) + receivable (1M) + fixed (2M) = 13M
        # Liabilities = payable (500K) + debt (1M) = 1.5M
        # Patrimony = 13M - 1.5M = 11.5M
        assert result["assets"]["total"] == 13000000
        assert result["liabilities"]["total"] == 1500000
        assert result["summary"]["net_patrimony"] == 11500000
