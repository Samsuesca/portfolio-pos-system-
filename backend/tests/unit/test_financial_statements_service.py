"""
Unit tests for FinancialStatementsService.

Tests for financial statement generation:
- Income Statement (Estado de Resultados)
- Balance Sheet (Balance General)
- Revenue calculations (completed sales only)
- COGS with fallback chain (unit_cost -> Product.cost -> estimate)
- Expense classification (operating, other, excluded production)
- Discounts and sale returns as revenue deductions
- Revenue breakdown by school + global products
- Period comparison with division-by-zero safety
- Inventory valuation (actual vs estimated cost)
- Equity breakdown (capital, retained, other)
- Available periods presets
"""
import pytest
from datetime import date, datetime, timedelta
from decimal import Decimal
from uuid import uuid4
from unittest.mock import AsyncMock, MagicMock, patch

from app.services.financial_statements import (
    FinancialStatementsService,
    DEFAULT_COST_MARGIN,
    OPERATING_EXPENSE_CODES,
    OTHER_EXPENSE_CODES,
    EXCLUDED_EXPENSE_CODES,
)

pytestmark = pytest.mark.unit


# ============================================================================
# HELPERS
# ============================================================================

def make_db_row(**kwargs):
    """Create a MagicMock that behaves like a SQLAlchemy row."""
    row = MagicMock()
    for k, v in kwargs.items():
        setattr(row, k, v)
    return row


def make_product(price=50000, cost=None, is_active=True, school_id=None):
    p = MagicMock()
    p.id = uuid4()
    p.price = Decimal(str(price))
    p.cost = Decimal(str(cost)) if cost is not None else None
    p.is_active = is_active
    p.school_id = school_id
    return p


def make_inventory(quantity=10):
    inv = MagicMock()
    inv.quantity = quantity
    inv.product_id = uuid4()
    return inv


def make_balance_account(account_type, balance=0, name="Account", code=None):
    acc = MagicMock()
    acc.id = uuid4()
    acc.name = name
    acc.code = code
    acc.account_type = account_type
    acc.balance = Decimal(str(balance))
    acc.net_value = Decimal(str(balance))
    acc.is_active = True
    return acc


def make_service(db=None) -> FinancialStatementsService:
    if db is None:
        db = AsyncMock()
    return FinancialStatementsService(db)


# ============================================================================
# CONSTANTS
# ============================================================================

class TestConstants:
    def test_default_cost_margin_is_080(self):
        assert DEFAULT_COST_MARGIN == Decimal("0.80")

    def test_operating_expense_codes_contains_expected(self):
        # payroll_in_kind added by Gap A fix (2026-05-03 session) for legacy
        # in-kind compensation that previously fell into "other".
        expected = {
            "rent", "utilities", "payroll", "supplies", "transport",
            "maintenance", "marketing", "payroll_in_kind",
        }
        assert OPERATING_EXPENSE_CODES == expected

    def test_other_expense_codes_contains_expected(self):
        expected = {"taxes", "bank_fees", "other"}
        assert OTHER_EXPENSE_CODES == expected

    def test_excluded_expense_codes_includes_production(self):
        for code in ["inventory", "prod_fabric", "prod_tailoring", "prod_embroidery", "prod_accessories", "prod_other"]:
            assert code in EXCLUDED_EXPENSE_CODES

    def test_excluded_expense_codes_includes_discounts_and_changes(self):
        assert "discounts" in EXCLUDED_EXPENSE_CODES
        assert "sale_changes" in EXCLUDED_EXPENSE_CODES
        assert "order_changes" in EXCLUDED_EXPENSE_CODES

    def test_no_overlap_between_operating_and_other(self):
        assert OPERATING_EXPENSE_CODES & OTHER_EXPENSE_CODES == set()

    def test_no_overlap_between_excluded_and_operating(self):
        assert EXCLUDED_EXPENSE_CODES & OPERATING_EXPENSE_CODES == set()


# ============================================================================
# _calculate_revenue
# ============================================================================

class TestCalculateRevenue:
    async def test_returns_total_and_count_from_completed_sales(self):
        db = AsyncMock()
        row = make_db_row(total=Decimal("500000"), count=5)
        result_mock = MagicMock()
        result_mock.one.return_value = row
        db.execute.return_value = result_mock

        service = make_service(db)
        start = datetime(2026, 1, 1)
        end = datetime(2026, 1, 31, 23, 59, 59)
        result = await service._calculate_revenue(start, end)

        assert result["total"] == 500000.0
        assert result["count"] == 5

    async def test_returns_zero_when_no_sales(self):
        db = AsyncMock()
        row = make_db_row(total=None, count=0)
        result_mock = MagicMock()
        result_mock.one.return_value = row
        db.execute.return_value = result_mock

        service = make_service(db)
        result = await service._calculate_revenue(
            datetime(2026, 1, 1), datetime(2026, 1, 31)
        )

        assert result["total"] == 0.0
        assert result["count"] == 0


# ============================================================================
# _calculate_cogs
# ============================================================================

class TestCalculateCogs:
    async def test_returns_actual_cost_breakdown(self):
        db = AsyncMock()
        row = make_db_row(
            total_cogs=Decimal("200000"),
            actual_cogs=Decimal("200000"),
            estimated_cogs=Decimal("0"),
            items_with_cost=10,
            items_estimated=0,
        )
        result_mock = MagicMock()
        result_mock.one.return_value = row
        db.execute.return_value = result_mock

        service = make_service(db)
        result = await service._calculate_cogs(
            datetime(2026, 1, 1), datetime(2026, 1, 31)
        )

        assert result["total"] == 200000.0
        assert result["from_actual_cost"] == 200000.0
        assert result["from_estimated_cost"] == 0.0
        assert result["items_with_actual_cost"] == 10
        assert result["items_with_estimated_cost"] == 0

    async def test_returns_estimated_cost_when_no_actual(self):
        db = AsyncMock()
        row = make_db_row(
            total_cogs=Decimal("160000"),
            actual_cogs=Decimal("0"),
            estimated_cogs=Decimal("160000"),
            items_with_cost=0,
            items_estimated=8,
        )
        result_mock = MagicMock()
        result_mock.one.return_value = row
        db.execute.return_value = result_mock

        service = make_service(db)
        result = await service._calculate_cogs(
            datetime(2026, 1, 1), datetime(2026, 1, 31)
        )

        assert result["from_actual_cost"] == 0.0
        assert result["from_estimated_cost"] == 160000.0
        assert result["items_with_estimated_cost"] == 8

    async def test_returns_mixed_actual_and_estimated(self):
        db = AsyncMock()
        row = make_db_row(
            total_cogs=Decimal("300000"),
            actual_cogs=Decimal("180000"),
            estimated_cogs=Decimal("120000"),
            items_with_cost=6,
            items_estimated=4,
        )
        result_mock = MagicMock()
        result_mock.one.return_value = row
        db.execute.return_value = result_mock

        service = make_service(db)
        result = await service._calculate_cogs(
            datetime(2026, 1, 1), datetime(2026, 1, 31)
        )

        assert result["total"] == 300000.0
        assert result["items_with_actual_cost"] == 6
        assert result["items_with_estimated_cost"] == 4

    async def test_handles_null_values_gracefully(self):
        db = AsyncMock()
        row = make_db_row(
            total_cogs=None,
            actual_cogs=None,
            estimated_cogs=None,
            items_with_cost=None,
            items_estimated=None,
        )
        result_mock = MagicMock()
        result_mock.one.return_value = row
        db.execute.return_value = result_mock

        service = make_service(db)
        result = await service._calculate_cogs(
            datetime(2026, 1, 1), datetime(2026, 1, 31)
        )

        assert result["total"] == 0.0
        assert result["items_with_actual_cost"] == 0
        assert result["items_with_estimated_cost"] == 0


# ============================================================================
# _get_expenses_by_period
# ============================================================================

class TestGetExpensesByPeriod:
    async def test_classifies_operating_expenses(self):
        db = AsyncMock()
        rows = [
            make_db_row(category="rent", total=Decimal("1000000")),
            make_db_row(category="payroll", total=Decimal("3000000")),
        ]
        result_mock = MagicMock()
        result_mock.all.return_value = rows
        db.execute.return_value = result_mock

        service = make_service(db)
        result = await service._get_expenses_by_period(date(2026, 1, 1), date(2026, 1, 31))

        assert result["operating"]["rent"] == 1000000.0
        assert result["operating"]["payroll"] == 3000000.0
        assert result["other"] == {}

    async def test_classifies_other_and_financial_expenses(self):
        # bank_fees was reclassified from "other" to "financial" by the Gap A
        # fix (2026-05-03), since financial-system bank fees belong below the
        # operating line in the P&L. taxes stays under "other".
        db = AsyncMock()
        rows = [
            make_db_row(category="taxes", total=Decimal("500000")),
            make_db_row(category="bank_fees", total=Decimal("50000")),
        ]
        result_mock = MagicMock()
        result_mock.all.return_value = rows
        db.execute.return_value = result_mock

        service = make_service(db)
        result = await service._get_expenses_by_period(date(2026, 1, 1), date(2026, 1, 31))

        assert result["other"]["taxes"] == 500000.0
        assert "bank_fees" not in result["other"]
        assert result["financial"]["bank_fees"] == 50000.0
        assert result["operating"] == {}

    async def test_excludes_production_categories(self):
        db = AsyncMock()
        rows = [
            make_db_row(category="inventory", total=Decimal("2000000")),
            make_db_row(category="prod_fabric", total=Decimal("800000")),
            make_db_row(category="rent", total=Decimal("1000000")),
        ]
        result_mock = MagicMock()
        result_mock.all.return_value = rows
        db.execute.return_value = result_mock

        service = make_service(db)
        result = await service._get_expenses_by_period(date(2026, 1, 1), date(2026, 1, 31))

        assert "inventory" not in result["operating"]
        assert "inventory" not in result["other"]
        assert "prod_fabric" not in result["operating"]
        assert result["operating"]["rent"] == 1000000.0

    async def test_excludes_discounts_and_changes(self):
        db = AsyncMock()
        rows = [
            make_db_row(category="discounts", total=Decimal("100000")),
            make_db_row(category="sale_changes", total=Decimal("50000")),
            make_db_row(category="order_changes", total=Decimal("30000")),
        ]
        result_mock = MagicMock()
        result_mock.all.return_value = rows
        db.execute.return_value = result_mock

        service = make_service(db)
        result = await service._get_expenses_by_period(date(2026, 1, 1), date(2026, 1, 31))

        assert result["operating"] == {}
        assert result["other"] == {}

    async def test_custom_categories_classified_as_operating(self):
        db = AsyncMock()
        rows = [
            make_db_row(category="custom_category_xyz", total=Decimal("250000")),
        ]
        result_mock = MagicMock()
        result_mock.all.return_value = rows
        db.execute.return_value = result_mock

        service = make_service(db)
        result = await service._get_expenses_by_period(date(2026, 1, 1), date(2026, 1, 31))

        assert result["operating"]["custom_category_xyz"] == 250000.0

    async def test_excludes_custom_prod_prefixed_categories(self):
        db = AsyncMock()
        rows = [
            make_db_row(category="prod_custom_new", total=Decimal("100000")),
        ]
        result_mock = MagicMock()
        result_mock.all.return_value = rows
        db.execute.return_value = result_mock

        service = make_service(db)
        result = await service._get_expenses_by_period(date(2026, 1, 1), date(2026, 1, 31))

        assert "prod_custom_new" not in result["operating"]
        assert "prod_custom_new" not in result["other"]

    async def test_handles_enum_category_value(self):
        db = AsyncMock()
        cat_enum = MagicMock()
        cat_enum.value = "rent"
        rows = [make_db_row(category=cat_enum, total=Decimal("1000000"))]
        result_mock = MagicMock()
        result_mock.all.return_value = rows
        db.execute.return_value = result_mock

        service = make_service(db)
        result = await service._get_expenses_by_period(date(2026, 1, 1), date(2026, 1, 31))

        assert result["operating"]["rent"] == 1000000.0


# ============================================================================
# _calculate_discounts
# ============================================================================

class TestCalculateDiscounts:
    async def test_returns_total_and_count(self):
        db = AsyncMock()
        row = make_db_row(total=Decimal("150000"), count=3)
        result_mock = MagicMock()
        result_mock.one.return_value = row
        db.execute.return_value = result_mock

        service = make_service(db)
        result = await service._calculate_discounts(date(2026, 1, 1), date(2026, 1, 31))

        assert result["total"] == 150000.0
        assert result["count"] == 3

    async def test_returns_zero_when_no_discounts(self):
        db = AsyncMock()
        row = make_db_row(total=None, count=0)
        result_mock = MagicMock()
        result_mock.one.return_value = row
        db.execute.return_value = result_mock

        service = make_service(db)
        result = await service._calculate_discounts(date(2026, 1, 1), date(2026, 1, 31))

        assert result["total"] == 0.0
        assert result["count"] == 0


# ============================================================================
# _calculate_sale_returns
# ============================================================================

class TestCalculateSaleReturns:
    async def test_returns_total_and_count(self):
        db = AsyncMock()
        row = make_db_row(total=Decimal("80000"), count=2)
        result_mock = MagicMock()
        result_mock.one.return_value = row
        db.execute.return_value = result_mock

        service = make_service(db)
        result = await service._calculate_sale_returns(date(2026, 1, 1), date(2026, 1, 31))

        assert result["total"] == 80000.0
        assert result["count"] == 2

    async def test_returns_zero_when_no_returns(self):
        db = AsyncMock()
        row = make_db_row(total=None, count=0)
        result_mock = MagicMock()
        result_mock.one.return_value = row
        db.execute.return_value = result_mock

        service = make_service(db)
        result = await service._calculate_sale_returns(date(2026, 1, 1), date(2026, 1, 31))

        assert result["total"] == 0.0
        assert result["count"] == 0


# ============================================================================
# _calculate_revenue_breakdown
# ============================================================================

class TestCalculateRevenueBreakdown:
    async def test_returns_by_school_and_global(self):
        db = AsyncMock()
        school_id = uuid4()

        school_rows = [
            make_db_row(school_id=school_id, school_name="Colegio A", total=Decimal("300000"), count=3)
        ]
        global_row = make_db_row(total=Decimal("50000"), count=2)

        school_result = MagicMock()
        school_result.all.return_value = school_rows
        global_result = MagicMock()
        global_result.one.return_value = global_row

        db.execute.side_effect = [school_result, global_result]

        service = make_service(db)
        result = await service._calculate_revenue_breakdown(
            datetime(2026, 1, 1), datetime(2026, 1, 31)
        )

        assert len(result["by_school"]) == 1
        assert result["by_school"][0]["school_name"] == "Colegio A"
        assert result["by_school"][0]["total"] == 300000.0
        assert result["global_products"]["total"] == 50000.0
        assert result["global_products"]["count"] == 2

    async def test_handles_no_schools_no_global(self):
        db = AsyncMock()
        school_result = MagicMock()
        school_result.all.return_value = []
        global_result = MagicMock()
        global_result.one.return_value = make_db_row(total=None, count=0)

        db.execute.side_effect = [school_result, global_result]

        service = make_service(db)
        result = await service._calculate_revenue_breakdown(
            datetime(2026, 1, 1), datetime(2026, 1, 31)
        )

        assert result["by_school"] == []
        assert result["global_products"]["total"] == 0.0
        assert result["global_products"]["count"] == 0


# ============================================================================
# _calculate_period_comparison
# ============================================================================

class TestCalculatePeriodComparison:
    def test_calculates_growth_percentages(self):
        service = make_service()
        current = {
            "gross_revenue": 1000000,
            "gross_profit": 600000,
            "operating_income": 400000,
            "net_income": 350000,
        }
        previous = {
            "gross_revenue": 800000,
            "gross_profit": 500000,
            "operating_income": 300000,
            "net_income": 250000,
        }

        result = service._calculate_period_comparison(current, previous)

        assert result["revenue_change_percent"] == pytest.approx(25.0)
        assert result["gross_profit_change_percent"] == pytest.approx(20.0)
        assert result["operating_income_change_percent"] == pytest.approx(33.333, rel=1e-2)
        assert result["net_income_change_percent"] == pytest.approx(40.0)

    def test_returns_none_when_previous_is_zero(self):
        service = make_service()
        current = {
            "gross_revenue": 500000,
            "gross_profit": 300000,
            "operating_income": 200000,
            "net_income": 150000,
        }
        previous = {
            "gross_revenue": 0,
            "gross_profit": 0,
            "operating_income": 0,
            "net_income": 0,
        }

        result = service._calculate_period_comparison(current, previous)

        assert result["revenue_change_percent"] is None
        assert result["gross_profit_change_percent"] is None
        assert result["operating_income_change_percent"] is None
        assert result["net_income_change_percent"] is None

    def test_handles_negative_growth(self):
        service = make_service()
        current = {
            "gross_revenue": 400000,
            "gross_profit": 200000,
            "operating_income": 100000,
            "net_income": 50000,
        }
        previous = {
            "gross_revenue": 800000,
            "gross_profit": 500000,
            "operating_income": 300000,
            "net_income": 250000,
        }

        result = service._calculate_period_comparison(current, previous)

        assert result["revenue_change_percent"] == pytest.approx(-50.0)
        assert result["net_income_change_percent"] == pytest.approx(-80.0)

    def test_handles_mixed_zero_and_nonzero(self):
        service = make_service()
        current = {
            "gross_revenue": 100000,
            "gross_profit": 0,
            "operating_income": 50000,
            "net_income": 0,
        }
        previous = {
            "gross_revenue": 0,
            "gross_profit": 50000,
            "operating_income": 50000,
            "net_income": 0,
        }

        result = service._calculate_period_comparison(current, previous)

        assert result["revenue_change_percent"] is None
        assert result["gross_profit_change_percent"] == pytest.approx(-100.0)
        assert result["operating_income_change_percent"] == pytest.approx(0.0)
        assert result["net_income_change_percent"] is None


# ============================================================================
# _get_inventory_valuation
# ============================================================================

class TestGetInventoryValuation:
    async def test_with_actual_cost(self):
        db = AsyncMock()
        product = make_product(price=50000, cost=35000)
        inventory = make_inventory(quantity=10)

        result_mock = MagicMock()
        result_mock.all.return_value = [(product, inventory)]
        db.execute.return_value = result_mock

        service = make_service(db)
        result = await service._get_inventory_valuation()

        assert result["total_value"] == 350000.0
        assert result["from_actual_cost"] == 350000.0
        assert result["from_estimated_cost"] == 0.0
        assert result["total_units"] == 10
        assert result["coverage_percent"] == 100.0

    async def test_with_estimated_cost(self):
        db = AsyncMock()
        product = make_product(price=50000, cost=None)
        inventory = make_inventory(quantity=10)

        result_mock = MagicMock()
        result_mock.all.return_value = [(product, inventory)]
        db.execute.return_value = result_mock

        service = make_service(db)
        result = await service._get_inventory_valuation()

        expected_cost = float(Decimal("50000") * DEFAULT_COST_MARGIN * 10)
        assert result["total_value"] == expected_cost
        assert result["from_actual_cost"] == 0.0
        assert result["from_estimated_cost"] == expected_cost
        assert result["coverage_percent"] == 0.0

    async def test_mixed_actual_and_estimated(self):
        db = AsyncMock()
        p1 = make_product(price=50000, cost=35000)
        i1 = make_inventory(quantity=5)
        p2 = make_product(price=80000, cost=None)
        i2 = make_inventory(quantity=3)

        result_mock = MagicMock()
        result_mock.all.return_value = [(p1, i1), (p2, i2)]
        db.execute.return_value = result_mock

        service = make_service(db)
        result = await service._get_inventory_valuation()

        actual = float(Decimal("35000") * 5)
        estimated = float(Decimal("80000") * DEFAULT_COST_MARGIN * 3)
        assert result["total_value"] == actual + estimated
        assert result["from_actual_cost"] == actual
        assert result["from_estimated_cost"] == estimated
        assert result["total_units"] == 8
        assert result["coverage_percent"] == pytest.approx(62.5)

    async def test_empty_inventory(self):
        db = AsyncMock()
        result_mock = MagicMock()
        result_mock.all.return_value = []
        db.execute.return_value = result_mock

        service = make_service(db)
        result = await service._get_inventory_valuation()

        assert result["total_value"] == 0.0
        assert result["total_units"] == 0
        assert result["coverage_percent"] == 100.0


# ============================================================================
# _get_equity
# ============================================================================

class TestGetEquity:
    async def test_breakdown_by_equity_type(self):
        from app.models.accounting import AccountType

        db = AsyncMock()
        capital_acc = make_balance_account(AccountType.EQUITY_CAPITAL, balance=10000000, name="Capital Social")
        retained_acc = make_balance_account(AccountType.EQUITY_RETAINED, balance=5000000, name="Utilidades Retenidas")
        other_acc = make_balance_account(AccountType.EQUITY_OTHER, balance=2000000, name="Reserva Legal")

        result_mock = MagicMock()
        result_mock.scalars.return_value.all.return_value = [capital_acc, retained_acc, other_acc]
        db.execute.return_value = result_mock

        service = make_service(db)
        result = await service._get_equity()

        assert result["capital"] == 10000000.0
        assert result["retained_earnings"] == 5000000.0
        assert result["other"] == 2000000.0
        assert result["total"] == 17000000.0
        assert len(result["accounts"]) == 3

    async def test_empty_equity(self):
        db = AsyncMock()
        result_mock = MagicMock()
        result_mock.scalars.return_value.all.return_value = []
        db.execute.return_value = result_mock

        service = make_service(db)
        result = await service._get_equity()

        assert result["capital"] == 0.0
        assert result["retained_earnings"] == 0.0
        assert result["other"] == 0.0
        assert result["total"] == 0.0
        assert result["accounts"] == []

    async def test_multiple_accounts_same_type_are_summed(self):
        from app.models.accounting import AccountType

        db = AsyncMock()
        c1 = make_balance_account(AccountType.EQUITY_CAPITAL, balance=5000000)
        c2 = make_balance_account(AccountType.EQUITY_CAPITAL, balance=3000000)

        result_mock = MagicMock()
        result_mock.scalars.return_value.all.return_value = [c1, c2]
        db.execute.return_value = result_mock

        service = make_service(db)
        result = await service._get_equity()

        assert result["capital"] == 8000000.0
        assert result["total"] == 8000000.0


# ============================================================================
# get_income_statement
# ============================================================================

class TestGetIncomeStatement:
    def _mock_service_internals(self, service):
        service._calculate_revenue = AsyncMock(return_value={"total": 1000000.0, "count": 10})
        service._calculate_cogs = AsyncMock(return_value={
            "total": 400000.0, "from_actual_cost": 300000.0,
            "from_estimated_cost": 100000.0,
            "items_with_actual_cost": 7, "items_with_estimated_cost": 3,
        })
        service._get_expenses_by_period = AsyncMock(return_value={
            "operating": {"rent": 100000.0, "payroll": 200000.0},
            "other": {"taxes": 50000.0},
        })
        service._get_category_labels = AsyncMock(return_value={
            "rent": "Arriendo", "payroll": "Nomina", "taxes": "Impuestos",
        })
        service._calculate_discounts = AsyncMock(return_value={"total": 20000.0, "count": 2})
        service._calculate_sale_returns = AsyncMock(return_value={"total": 10000.0, "count": 1})
        service._calculate_revenue_breakdown = AsyncMock(return_value={
            "by_school": [], "global_products": {"total": 0, "count": 0}
        })
        service._get_other_expenses_details = AsyncMock(return_value=[])

    async def test_happy_path_calculates_all_metrics(self):
        service = make_service()
        self._mock_service_internals(service)

        result = await service.get_income_statement(date(2026, 1, 1), date(2026, 1, 31))

        assert result["gross_revenue"] == 1000000.0
        assert result["returns_discounts"] == 30000.0
        net_revenue = 1000000.0 - 30000.0
        assert result["net_revenue"] == net_revenue
        assert result["cost_of_goods_sold"] == 400000.0
        gross_profit = net_revenue - 400000.0
        assert result["gross_profit"] == gross_profit
        assert result["total_operating_expenses"] == 300000.0
        operating_income = gross_profit - 300000.0
        assert result["operating_income"] == operating_income
        net_income = operating_income - 50000.0
        assert result["net_income"] == net_income
        assert result["period_start"] == "2026-01-01"
        assert result["period_end"] == "2026-01-31"
        assert result["sales_count"] == 10

    async def test_zero_revenue_sets_margins_to_zero(self):
        service = make_service()
        self._mock_service_internals(service)
        service._calculate_revenue = AsyncMock(return_value={"total": 0.0, "count": 0})
        service._calculate_discounts = AsyncMock(return_value={"total": 0.0, "count": 0})
        service._calculate_sale_returns = AsyncMock(return_value={"total": 0.0, "count": 0})

        result = await service.get_income_statement(date(2026, 1, 1), date(2026, 1, 31))

        assert result["gross_margin_percent"] == 0.0
        assert result["operating_margin_percent"] == 0.0
        assert result["net_margin_percent"] == 0.0

    async def test_returns_discounts_deduction_breakdown(self):
        service = make_service()
        self._mock_service_internals(service)

        result = await service.get_income_statement(date(2026, 1, 1), date(2026, 1, 31))

        breakdown = result["returns_discounts_breakdown"]
        assert breakdown["discounts"] == 20000.0
        assert breakdown["discounts_count"] == 2
        assert breakdown["sale_returns"] == 10000.0
        assert breakdown["sale_returns_count"] == 1

    async def test_cogs_coverage_100_no_disclaimer(self):
        service = make_service()
        self._mock_service_internals(service)
        service._calculate_cogs = AsyncMock(return_value={
            "total": 400000.0, "from_actual_cost": 400000.0,
            "from_estimated_cost": 0.0,
            "items_with_actual_cost": 10, "items_with_estimated_cost": 0,
        })

        result = await service.get_income_statement(date(2026, 1, 1), date(2026, 1, 31))

        assert result["cogs_coverage_percent"] == 100.0
        assert result["disclaimer"] is None

    async def test_partial_cogs_coverage_generates_disclaimer(self):
        service = make_service()
        self._mock_service_internals(service)

        result = await service.get_income_statement(date(2026, 1, 1), date(2026, 1, 31))

        assert result["cogs_coverage_percent"] == 70.0
        assert "30.0%" in result["disclaimer"]
        assert "80%" in result["disclaimer"]

    async def test_compare_previous_triggers_recursive_call(self):
        service = make_service()
        call_count = 0

        async def mock_income_statement(start, end, compare=False):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                self._mock_service_internals(service)
                return await FinancialStatementsService.get_income_statement(service, start, end, compare)
            else:
                self._mock_service_internals(service)
                service._calculate_revenue = AsyncMock(return_value={"total": 800000.0, "count": 8})
                return await FinancialStatementsService.get_income_statement(service, start, end, False)

        service.get_income_statement = mock_income_statement
        result = await service.get_income_statement(date(2026, 1, 1), date(2026, 1, 31), True)

        assert result["previous_period"] is not None
        assert result["period_comparison"] is not None

    async def test_operating_expenses_by_category_only_nonzero(self):
        service = make_service()
        self._mock_service_internals(service)
        service._get_expenses_by_period = AsyncMock(return_value={
            "operating": {"rent": 100000.0, "payroll": 0.0, "marketing": 50000.0},
            "other": {},
        })

        result = await service.get_income_statement(date(2026, 1, 1), date(2026, 1, 31))

        categories = [c["category"] for c in result["operating_expenses_by_category"]]
        assert "rent" in categories
        assert "marketing" in categories
        assert "payroll" not in categories


# ============================================================================
# get_balance_sheet
# ============================================================================

class TestGetBalanceSheet:
    def _mock_balance_internals(self, service):
        service._get_cash_accounts = AsyncMock(return_value={
            "accounts": [{"id": str(uuid4()), "name": "Caja", "code": "1101", "balance": 500000.0}],
            "total": 500000.0,
        })
        service._get_accounts_receivable = AsyncMock(return_value={"total": 200000.0, "count": 5})
        service._get_inventory_valuation = AsyncMock(return_value={
            "total_value": 1000000.0, "total_units": 50,
            "from_actual_cost": 800000.0, "from_estimated_cost": 200000.0,
            "coverage_percent": 80.0,
        })
        service._get_balance_accounts_by_type = AsyncMock(return_value=[])
        service._get_accounts_payable = AsyncMock(return_value={"total": 100000.0, "count": 3})
        service._get_pending_expenses = AsyncMock(return_value={"total": 50000.0, "count": 2})
        service._get_equity = AsyncMock(return_value={
            "capital": 1000000.0, "retained_earnings": 500000.0,
            "other": 0.0, "total": 1500000.0, "accounts": [],
        })
        service._calculate_current_period_earnings = AsyncMock(return_value=50000.0)

    @patch("app.services.financial_statements.get_colombia_date")
    async def test_happy_path_returns_complete_structure(self, mock_date):
        mock_date.return_value = date(2026, 4, 14)
        service = make_service()
        self._mock_balance_internals(service)

        result = await service.get_balance_sheet(date(2026, 4, 14))

        assert result["as_of_date"] == "2026-04-14"
        assert result["total_current_assets"] == 1700000.0
        assert result["current_assets"]["total_cash"] == 500000.0
        assert result["current_assets"]["accounts_receivable"] == 200000.0
        assert result["current_assets"]["total_inventory"] == 1000000.0

    @patch("app.services.financial_statements.get_colombia_date")
    async def test_historical_date_adds_note(self, mock_date):
        mock_date.return_value = date(2026, 4, 14)
        service = make_service()
        self._mock_balance_internals(service)

        result = await service.get_balance_sheet(date(2026, 3, 1))

        assert result["historical_note"] is not None
        assert "actuales, no historicos" in result["historical_note"].lower() or \
               "actuales, no históricos" in result["historical_note"].lower()

    @patch("app.services.financial_statements.get_colombia_date")
    async def test_current_date_no_historical_note(self, mock_date):
        mock_date.return_value = date(2026, 4, 14)
        service = make_service()
        self._mock_balance_internals(service)

        result = await service.get_balance_sheet(date(2026, 4, 14))

        assert result["historical_note"] is None

    @patch("app.services.financial_statements.get_colombia_date")
    async def test_none_date_defaults_to_today(self, mock_date):
        mock_date.return_value = date(2026, 4, 14)
        service = make_service()
        self._mock_balance_internals(service)

        result = await service.get_balance_sheet(None)

        assert result["as_of_date"] == "2026-04-14"

    @patch("app.services.financial_statements.get_colombia_date")
    async def test_inventory_coverage_disclaimer(self, mock_date):
        mock_date.return_value = date(2026, 4, 14)
        service = make_service()
        self._mock_balance_internals(service)

        result = await service.get_balance_sheet()

        assert result["inventory_coverage_percent"] == 80.0
        assert result["disclaimer"] is not None
        assert "20.0%" in result["disclaimer"]

    @patch("app.services.financial_statements.get_colombia_date")
    async def test_equity_includes_current_period_earnings(self, mock_date):
        mock_date.return_value = date(2026, 4, 14)
        service = make_service()
        self._mock_balance_internals(service)

        result = await service.get_balance_sheet()

        assert result["equity"]["current_period_earnings"] == 50000.0
        assert result["total_equity"] == 1550000.0


# ============================================================================
# Gap A — equity opening balance reconstruction / accounting-equation consistency
# ============================================================================

class TestGapAEquityReconstruction:
    """
    Gap A (stabilization sprint): opening equity was reconstructed from legacy
    data so the balance sheet satisfies Assets = Liabilities + Equity. These
    tests pin that the reconstructed opening capital is what closes the gap.

    Scenario totals: assets 1,700,000; liabilities 150,000. The sheet balances
    only when equity (incl. reconstructed opening capital) totals 1,550,000.
    """

    def _mock_balanced_internals(self, service, capital=1000000.0):
        service._get_cash_accounts = AsyncMock(return_value={
            "accounts": [{"id": str(uuid4()), "name": "Caja", "code": "1101", "balance": 500000.0}],
            "total": 500000.0,
        })
        service._get_accounts_receivable = AsyncMock(return_value={"total": 200000.0, "count": 5})
        service._get_inventory_valuation = AsyncMock(return_value={
            "total_value": 1000000.0, "total_units": 50,
            "from_actual_cost": 1000000.0, "from_estimated_cost": 0.0,
            "coverage_percent": 100.0,
        })
        service._get_balance_accounts_by_type = AsyncMock(return_value=[])
        service._get_accounts_payable = AsyncMock(return_value={"total": 100000.0, "count": 3})
        service._get_pending_expenses = AsyncMock(return_value={"total": 50000.0, "count": 2})
        service._get_equity = AsyncMock(return_value={
            "capital": capital, "retained_earnings": 500000.0,
            "other": 0.0, "total": capital + 500000.0, "accounts": [],
        })
        service._calculate_current_period_earnings = AsyncMock(return_value=50000.0)

    @patch("app.services.financial_statements.get_colombia_date")
    async def test_balance_sheet_balances_with_reconstructed_opening_equity(self, mock_date):
        mock_date.return_value = date(2026, 4, 14)
        service = make_service()
        self._mock_balanced_internals(service, capital=1000000.0)

        result = await service.get_balance_sheet(date(2026, 4, 14))

        assert result["equity"]["capital"] == 1000000.0
        assert result["total_equity"] == 1550000.0
        assert result["net_worth"] == 1550000.0
        assert result["is_balanced"] is True
        assert result["balance_difference"] == 0.0

    @patch("app.services.financial_statements.get_colombia_date")
    async def test_missing_opening_equity_unbalances_by_that_amount(self, mock_date):
        mock_date.return_value = date(2026, 4, 14)
        service = make_service()
        # Without the reconstructed opening capital, equity is short by 1,000,000.
        self._mock_balanced_internals(service, capital=0.0)

        result = await service.get_balance_sheet(date(2026, 4, 14))

        assert result["is_balanced"] is False
        assert result["balance_difference"] == 1000000.0


# ============================================================================
# get_available_periods
# ============================================================================

class TestGetAvailablePeriods:
    @patch("app.services.financial_statements.get_colombia_date")
    async def test_returns_six_presets(self, mock_date):
        mock_date.return_value = date(2026, 4, 14)
        db = AsyncMock()
        result_mock = MagicMock()
        result_mock.scalar.return_value = datetime(2025, 6, 15, 10, 0, 0)
        db.execute.return_value = result_mock

        service = make_service(db)
        result = await service.get_available_periods()

        assert len(result["presets"]) == 6
        keys = [p["key"] for p in result["presets"]]
        assert "this_month" in keys
        assert "last_month" in keys
        assert "this_quarter" in keys
        assert "last_quarter" in keys
        assert "this_year" in keys
        assert "last_year" in keys

    @patch("app.services.financial_statements.get_colombia_date")
    async def test_this_month_dates(self, mock_date):
        mock_date.return_value = date(2026, 4, 14)
        db = AsyncMock()
        result_mock = MagicMock()
        result_mock.scalar.return_value = datetime(2025, 1, 1)
        db.execute.return_value = result_mock

        service = make_service(db)
        result = await service.get_available_periods()

        this_month = next(p for p in result["presets"] if p["key"] == "this_month")
        assert this_month["start_date"] == "2026-04-01"
        assert this_month["end_date"] == "2026-04-14"

    @patch("app.services.financial_statements.get_colombia_date")
    async def test_earliest_date_detection(self, mock_date):
        mock_date.return_value = date(2026, 4, 14)
        db = AsyncMock()
        earliest = datetime(2025, 3, 10, 14, 30, 0)
        result_mock = MagicMock()
        result_mock.scalar.return_value = earliest
        db.execute.return_value = result_mock

        service = make_service(db)
        result = await service.get_available_periods()

        assert result["earliest_data_date"] == "2025-03-10"

    @patch("app.services.financial_statements.get_colombia_date")
    async def test_no_earliest_date_when_no_sales(self, mock_date):
        mock_date.return_value = date(2026, 4, 14)
        db = AsyncMock()
        result_mock = MagicMock()
        result_mock.scalar.return_value = None
        db.execute.return_value = result_mock

        service = make_service(db)
        result = await service.get_available_periods()

        assert result["earliest_data_date"] is None

    @patch("app.services.financial_statements.get_colombia_date")
    async def test_december_this_month_end(self, mock_date):
        mock_date.return_value = date(2026, 12, 15)
        db = AsyncMock()
        result_mock = MagicMock()
        result_mock.scalar.return_value = None
        db.execute.return_value = result_mock

        service = make_service(db)
        result = await service.get_available_periods()

        this_month = next(p for p in result["presets"] if p["key"] == "this_month")
        assert this_month["start_date"] == "2026-12-01"
        assert this_month["end_date"] == "2026-12-15"

    @patch("app.services.financial_statements.get_colombia_date")
    async def test_last_year_dates(self, mock_date):
        mock_date.return_value = date(2026, 4, 14)
        db = AsyncMock()
        result_mock = MagicMock()
        result_mock.scalar.return_value = None
        db.execute.return_value = result_mock

        service = make_service(db)
        result = await service.get_available_periods()

        last_year = next(p for p in result["presets"] if p["key"] == "last_year")
        assert last_year["start_date"] == "2025-01-01"
        assert last_year["end_date"] == "2025-12-31"
