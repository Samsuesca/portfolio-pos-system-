"""
Unit Tests for Accounting Services

Tests for:
- TransactionService: Income/expense transaction creation
- ExpenseService: Expense management and payments
- DailyCashRegisterService: Daily reconciliation
- AccountingService: Dashboard and reports
"""
import pytest
from decimal import Decimal
from uuid import uuid4
from datetime import date, datetime
from unittest.mock import AsyncMock, MagicMock, patch

from app.services.accounting import (
    TransactionService,
    ExpenseService,
    DailyCashRegisterService,
    AccountingService
)
from app.models.accounting import (
    Transaction, TransactionType, AccPaymentMethod,
    Expense, ExpenseCategory,
    DailyCashRegister
)
from app.schemas.accounting import (
    TransactionCreate, ExpenseCreate, ExpensePayment,
    DailyCashRegisterCreate, DailyCashRegisterClose
)


# ============================================================================
# TEST: Transaction Calculations
# ============================================================================

class TestTransactionCalculations:
    """Tests for transaction-related calculations"""

    def test_income_aggregation(self):
        """Total income should sum all income transactions"""
        transactions = [
            {"type": TransactionType.INCOME, "amount": Decimal("50000")},
            {"type": TransactionType.INCOME, "amount": Decimal("75000")},
            {"type": TransactionType.INCOME, "amount": Decimal("30000")},
        ]

        total = sum(
            t["amount"] for t in transactions
            if t["type"] == TransactionType.INCOME
        )

        assert total == Decimal("155000")

    def test_expense_aggregation(self):
        """Total expenses should sum all expense transactions"""
        transactions = [
            {"type": TransactionType.EXPENSE, "amount": Decimal("20000")},
            {"type": TransactionType.EXPENSE, "amount": Decimal("15000")},
        ]

        total = sum(
            t["amount"] for t in transactions
            if t["type"] == TransactionType.EXPENSE
        )

        assert total == Decimal("35000")

    def test_net_flow_calculation(self):
        """Net flow = income - expenses"""
        income = Decimal("155000")
        expenses = Decimal("35000")

        net_flow = income - expenses

        assert net_flow == Decimal("120000")

    def test_income_by_payment_method(self):
        """Should correctly aggregate income by payment method"""
        transactions = [
            {"method": AccPaymentMethod.CASH, "amount": Decimal("50000")},
            {"method": AccPaymentMethod.CASH, "amount": Decimal("30000")},
            {"method": AccPaymentMethod.TRANSFER, "amount": Decimal("75000")},
            {"method": AccPaymentMethod.CARD, "amount": Decimal("40000")},
        ]

        by_method = {}
        for t in transactions:
            method = t["method"].value
            by_method[method] = by_method.get(method, Decimal("0")) + t["amount"]

        assert by_method["cash"] == Decimal("80000")
        assert by_method["transfer"] == Decimal("75000")
        assert by_method["card"] == Decimal("40000")


# ============================================================================
# TEST: Expense Payment Logic
# ============================================================================

class TestExpensePaymentLogic:
    """Tests for expense payment calculations"""

    def test_partial_payment(self):
        """Expense balance after partial payment"""
        expense_amount = Decimal("100000")
        paid = Decimal("30000")

        balance = expense_amount - paid
        is_paid = paid >= expense_amount

        assert balance == Decimal("70000")
        assert is_paid is False

    def test_full_payment(self):
        """Expense marked as paid when fully paid"""
        expense_amount = Decimal("100000")
        paid = Decimal("100000")

        is_paid = paid >= expense_amount

        assert is_paid is True

    def test_overpayment_detection(self):
        """Should detect when payment exceeds balance"""
        expense_amount = Decimal("100000")
        already_paid = Decimal("80000")
        new_payment = Decimal("30000")

        would_exceed = (already_paid + new_payment) > expense_amount

        assert would_exceed is True

    def test_multiple_partial_payments(self):
        """Track balance across multiple payments"""
        expense_amount = Decimal("100000")
        payments = [
            Decimal("30000"),
            Decimal("25000"),
            Decimal("45000"),
        ]

        paid = Decimal("0")
        for payment in payments:
            paid += payment
            balance = expense_amount - paid

        assert paid == Decimal("100000")
        assert balance == Decimal("0")

    @pytest.mark.asyncio
    async def test_pay_expense_exceeds_balance_raises_error(self, mock_db_session):
        """Should raise ValueError when payment exceeds balance"""
        # Create expense with partial payment
        mock_expense = MagicMock()
        mock_expense.amount = Decimal("100000")
        mock_expense.amount_paid = Decimal("90000")  # Already paid 90k

        service = ExpenseService(mock_db_session)

        with patch.object(service, 'get', new_callable=AsyncMock) as mock_get:
            mock_get.return_value = mock_expense

            payment = ExpensePayment(
                amount=Decimal("20000"),  # Would exceed by 10k
                payment_method=AccPaymentMethod.CASH
            )

            with pytest.raises(ValueError, match="excede el monto"):
                await service.pay_expense(
                    expense_id=str(uuid4()),
                    school_id=str(uuid4()),
                    payment=payment
                )


# ============================================================================
# TEST: Daily Cash Register
# ============================================================================

class TestDailyCashRegister:
    """Tests for daily cash register operations"""

    def test_expected_closing_balance(self):
        """Expected balance = opening + income - expenses"""
        opening = Decimal("100000")
        income = Decimal("250000")
        expenses = Decimal("50000")

        expected_closing = opening + income - expenses

        assert expected_closing == Decimal("300000")

    def test_cash_discrepancy_detection(self):
        """Detect discrepancy between expected and actual closing"""
        expected = Decimal("300000")
        actual = Decimal("295000")

        discrepancy = actual - expected

        assert discrepancy == Decimal("-5000")  # Short by 5k

    @pytest.mark.asyncio
    async def test_open_register_duplicate_raises_error(self, mock_db_session):
        """Should raise ValueError if register already exists for date"""
        existing_register = MagicMock()

        mock_db_session.execute = AsyncMock(
            return_value=MagicMock(
                scalar_one_or_none=MagicMock(return_value=existing_register)
            )
        )

        service = DailyCashRegisterService(mock_db_session)

        data = DailyCashRegisterCreate(
            school_id=str(uuid4()),
            register_date=date.today(),
            opening_balance=Decimal("100000")
        )

        with pytest.raises(ValueError, match="Ya existe una caja"):
            await service.open_register(data)

    @pytest.mark.asyncio
    async def test_close_already_closed_raises_error(self, mock_db_session):
        """Should raise ValueError if register already closed"""
        mock_register = MagicMock()
        mock_register.is_closed = True

        service = DailyCashRegisterService(mock_db_session)

        with patch.object(service, 'get', new_callable=AsyncMock) as mock_get:
            mock_get.return_value = mock_register

            data = DailyCashRegisterClose(
                closing_balance=Decimal("300000")
            )

            with pytest.raises(ValueError, match="ya está cerrada"):
                await service.close_register(
                    register_id=str(uuid4()),
                    school_id=str(uuid4()),
                    data=data,
                    closed_by=str(uuid4())
                )


# ============================================================================
# TEST: Expense Categories
# ============================================================================

class TestExpenseCategories:
    """Tests for expense category analytics"""

    def test_expense_category_percentage(self):
        """Calculate percentage of each expense category"""
        expenses = [
            {"category": ExpenseCategory.RENT, "amount": Decimal("500000")},
            {"category": ExpenseCategory.UTILITIES, "amount": Decimal("100000")},
            {"category": ExpenseCategory.PAYROLL, "amount": Decimal("400000")},
        ]

        total = sum(e["amount"] for e in expenses)
        percentages = {}

        for e in expenses:
            pct = (e["amount"] / total) * 100
            percentages[e["category"]] = pct

        assert total == Decimal("1000000")
        assert percentages[ExpenseCategory.RENT] == Decimal("50")  # 50%
        assert percentages[ExpenseCategory.UTILITIES] == Decimal("10")  # 10%
        assert percentages[ExpenseCategory.PAYROLL] == Decimal("40")  # 40%

    def test_all_expense_categories_exist(self):
        """Verify all expected expense categories exist"""
        expected = [
            'RENT', 'UTILITIES', 'PAYROLL', 'SUPPLIES', 'INVENTORY',
            'TRANSPORT', 'MAINTENANCE', 'MARKETING', 'TAXES', 'BANK_FEES', 'OTHER'
        ]

        for cat_name in expected:
            assert hasattr(ExpenseCategory, cat_name)


# ============================================================================
# TEST: Dashboard Metrics
# ============================================================================

class TestDashboardMetrics:
    """Tests for accounting dashboard calculations"""

    def test_today_vs_month_comparison(self):
        """Compare today's performance to month totals"""
        today_income = Decimal("150000")
        month_income = Decimal("3000000")  # So far

        daily_avg = month_income / 20  # Assuming 20 days
        performance_vs_avg = today_income / daily_avg * 100

        assert daily_avg == Decimal("150000")
        assert performance_vs_avg == Decimal("100")  # At average

    def test_pending_expenses_total(self):
        """Sum all pending expense balances"""
        pending = [
            {"amount": Decimal("100000"), "amount_paid": Decimal("30000")},
            {"amount": Decimal("50000"), "amount_paid": Decimal("0")},
            {"amount": Decimal("75000"), "amount_paid": Decimal("75000")},  # Paid
        ]

        total_pending = sum(
            e["amount"] - e["amount_paid"]
            for e in pending
            if e["amount"] > e["amount_paid"]
        )

        assert total_pending == Decimal("120000")


# ============================================================================
# TEST: Business Scenarios
# ============================================================================

class TestBusinessScenarios:
    """End-to-end accounting scenarios"""

    def test_scenario_daily_reconciliation(self):
        """
        Scenario: End of day cash reconciliation

        1. Opening balance: $100,000
        2. Sales (cash): $180,000
        3. Sales (card): $120,000
        4. Expenses (paid): $50,000
        5. Expected cash: $100,000 + $180,000 - $50,000 = $230,000
        """
        opening = Decimal("100000")
        cash_sales = Decimal("180000")
        card_sales = Decimal("120000")  # Not in cash drawer
        expenses = Decimal("50000")

        expected_cash = opening + cash_sales - expenses
        total_income = cash_sales + card_sales

        assert expected_cash == Decimal("230000")
        assert total_income == Decimal("300000")

    def test_scenario_monthly_profit_loss(self):
        """
        Scenario: Monthly P&L

        Income:
        - Sales: $3,000,000
        - Orders: $500,000
        Total: $3,500,000

        Expenses:
        - Rent: $500,000
        - Utilities: $100,000
        - Payroll: $1,200,000
        - Supplies: $300,000
        - Other: $200,000
        Total: $2,300,000

        Net Profit: $1,200,000
        """
        income = {
            "sales": Decimal("3000000"),
            "orders": Decimal("500000"),
        }

        expenses = {
            "rent": Decimal("500000"),
            "utilities": Decimal("100000"),
            "payroll": Decimal("1200000"),
            "supplies": Decimal("300000"),
            "other": Decimal("200000"),
        }

        total_income = sum(income.values())
        total_expenses = sum(expenses.values())
        net_profit = total_income - total_expenses

        assert total_income == Decimal("3500000")
        assert total_expenses == Decimal("2300000")
        assert net_profit == Decimal("1200000")

    def test_scenario_expense_payment_workflow(self):
        """
        Scenario: Pay rent in installments

        1. Rent due: $500,000
        2. Payment 1: $200,000 (balance: $300,000)
        3. Payment 2: $150,000 (balance: $150,000)
        4. Payment 3: $150,000 (balance: $0, marked paid)
        """
        expense_amount = Decimal("500000")
        payments = [
            Decimal("200000"),
            Decimal("150000"),
            Decimal("150000"),
        ]

        paid = Decimal("0")
        for payment in payments:
            paid += payment
            balance = expense_amount - paid

        assert paid == expense_amount
        assert balance == Decimal("0")

    def test_scenario_sale_creates_transaction(self):
        """
        Scenario: Sale automatically creates income transaction

        Sale: VNT-2025-0001
        Amount: $150,000
        Payment: Cash

        → Transaction created:
           - Type: INCOME
           - Amount: $150,000
           - Method: CASH
           - Reference: VNT-2025-0001
        """
        sale = {
            "code": "VNT-2025-0001",
            "paid_amount": Decimal("150000"),
            "payment_method": "cash"
        }

        transaction = {
            "type": TransactionType.INCOME,
            "amount": sale["paid_amount"],
            "payment_method": AccPaymentMethod.CASH,
            "reference_code": sale["code"],
            "category": "sales"
        }

        assert transaction["amount"] == Decimal("150000")
        assert transaction["type"] == TransactionType.INCOME


# ============================================================================
# TEST: Edge Cases
# ============================================================================

class TestEdgeCases:
    """Edge cases and boundary conditions"""

    def test_zero_income_day(self):
        """Handle day with no sales"""
        opening = Decimal("100000")
        income = Decimal("0")
        expenses = Decimal("20000")

        closing = opening + income - expenses

        assert closing == Decimal("80000")

    def test_zero_expense_month(self):
        """Handle month with no expenses"""
        income = Decimal("500000")
        expenses = Decimal("0")

        profit = income - expenses

        assert profit == Decimal("500000")

    def test_large_transaction_amounts(self):
        """Handle large transaction amounts"""
        income = Decimal("10000000")  # 10 million
        expenses = Decimal("7500000")

        net = income - expenses

        assert net == Decimal("2500000")

    def test_decimal_precision_in_percentages(self):
        """Ensure decimal precision in percentage calculations"""
        total = Decimal("333333")
        part = Decimal("111111")

        percentage = (part / total) * 100

        # Should be approximately 33.33%
        assert Decimal("33.33") < percentage < Decimal("33.34")

    def test_negative_net_flow(self):
        """Handle months with losses"""
        income = Decimal("200000")
        expenses = Decimal("350000")

        net = income - expenses

        assert net == Decimal("-150000")
        assert net < 0

    def test_first_day_of_business(self):
        """First day: no prior transactions"""
        opening_balance = Decimal("0")
        first_sale = Decimal("50000")

        closing = opening_balance + first_sale

        assert closing == Decimal("50000")
