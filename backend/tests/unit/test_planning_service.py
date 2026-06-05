"""
Unit tests for PlanningService.

Tests for financial planning and projections:
- Debt payment CRUD (create, read, update, delete, mark paid, overdue detection)
- Interest payment generation (bullet loan model)
- Sales seasonality analysis
- Cash flow projection
- Planning dashboard
- Formatting helpers
"""
import pytest
from decimal import Decimal
from uuid import uuid4
from datetime import date, datetime
from unittest.mock import AsyncMock, MagicMock, patch, PropertyMock

from app.services.planning import PlanningService, SEASONALITY_PATTERNS, MONTH_NAMES_ES
from app.models.accounting import (
    DebtPaymentStatus,
    AccountType,
    BalanceEntry,
    Expense,
    ExpenseCategory,
)

pytestmark = pytest.mark.unit

TIMEZONE_MODULE = "app.services.planning"
FIXED_TODAY = date(2026, 4, 14)
FIXED_NOW = datetime(2026, 4, 14, 10, 0, 0)


# ============================================================================
# HELPERS
# ============================================================================

def make_debt_payment(
    status=DebtPaymentStatus.PENDING,
    amount=Decimal("500000"),
    due_date=None,
    description="Test payment",
    creditor="Banco Test",
    is_recurring=False,
    recurrence_day=None,
    paid_date=None,
    paid_amount=None,
    payment_method=None,
    payment_account_id=None,
    balance_account_id=None,
    accounts_payable_id=None,
    category=None,
    notes=None,
    created_by=None,
):
    p = MagicMock()
    p.id = uuid4()
    p.description = description
    p.creditor = creditor
    p.amount = amount
    p.due_date = due_date or FIXED_TODAY
    p.is_recurring = is_recurring
    p.recurrence_day = recurrence_day
    p.status = status
    p.paid_date = paid_date
    p.paid_amount = paid_amount
    p.payment_method = payment_method
    p.payment_account_id = payment_account_id
    p.balance_account_id = balance_account_id
    p.accounts_payable_id = accounts_payable_id
    p.category = category
    p.notes = notes
    p.created_by = created_by
    p.created_at = FIXED_NOW
    p.updated_at = FIXED_NOW
    return p


def make_liability(
    balance=Decimal("10000000"),
    interest_rate=Decimal("2.0"),
    due_date=None,
    creditor="Prestamista",
    name="Prestamo Test",
):
    acc = MagicMock()
    acc.id = uuid4()
    acc.name = name
    acc.account_type = AccountType.LIABILITY_LONG
    acc.balance = balance
    acc.interest_rate = interest_rate
    acc.due_date = due_date or date(2027, 1, 15)
    acc.creditor = creditor
    acc.is_active = True
    return acc


def make_db_mock():
    db = AsyncMock()
    db.add = MagicMock()
    db.delete = AsyncMock()
    db.flush = AsyncMock()
    return db


def setup_execute_returns(db, *return_values):
    """Configure db.execute to return different results on sequential calls."""
    results = []
    for rv in return_values:
        mock_result = MagicMock()
        if isinstance(rv, list):
            mock_result.scalars.return_value.all.return_value = rv
            mock_result.all.return_value = rv
        elif rv is None:
            mock_result.scalar_one_or_none.return_value = None
            mock_result.scalar.return_value = None
        else:
            mock_result.scalar_one_or_none.return_value = rv
            mock_result.scalar.return_value = rv
        results.append(mock_result)
    db.execute = AsyncMock(side_effect=results)


# ============================================================================
# DEBT PAYMENT CRUD
# ============================================================================

class TestGetDebtPayments:

    @patch(f"{TIMEZONE_MODULE}.get_colombia_date", return_value=FIXED_TODAY)
    async def test_returns_items_with_totals(self, _mock_date):
        db = make_db_mock()
        payment = make_debt_payment()

        count_result = MagicMock()
        count_result.scalar.return_value = 1

        items_result = MagicMock()
        items_result.scalars.return_value.all.return_value = [payment]

        pending_result = MagicMock()
        pending_result.scalar.return_value = Decimal("500000")

        overdue_result = MagicMock()
        overdue_result.scalar.return_value = Decimal("100000")

        next_due_result = MagicMock()
        next_due_result.scalar_one_or_none.return_value = payment

        db.execute = AsyncMock(side_effect=[
            count_result, items_result, pending_result, overdue_result, next_due_result
        ])

        svc = PlanningService(db)
        result = await svc.get_debt_payments()

        assert result["total"] == 1
        assert len(result["items"]) == 1
        assert result["pending_total"] == Decimal("500000")
        assert result["overdue_total"] == Decimal("100000")
        assert result["next_due"] is not None

    @patch(f"{TIMEZONE_MODULE}.get_colombia_date", return_value=FIXED_TODAY)
    async def test_empty_results(self, _mock_date):
        db = make_db_mock()

        count_result = MagicMock()
        count_result.scalar.return_value = 0

        items_result = MagicMock()
        items_result.scalars.return_value.all.return_value = []

        pending_result = MagicMock()
        pending_result.scalar.return_value = None

        overdue_result = MagicMock()
        overdue_result.scalar.return_value = None

        next_due_result = MagicMock()
        next_due_result.scalar_one_or_none.return_value = None

        db.execute = AsyncMock(side_effect=[
            count_result, items_result, pending_result, overdue_result, next_due_result
        ])

        svc = PlanningService(db)
        result = await svc.get_debt_payments()

        assert result["total"] == 0
        assert result["items"] == []
        assert result["pending_total"] == Decimal("0")
        assert result["overdue_total"] == Decimal("0")
        assert result["next_due"] is None

    @patch(f"{TIMEZONE_MODULE}.get_colombia_date", return_value=FIXED_TODAY)
    async def test_filters_by_status(self, _mock_date):
        db = make_db_mock()
        count_result = MagicMock()
        count_result.scalar.return_value = 0
        items_result = MagicMock()
        items_result.scalars.return_value.all.return_value = []
        pending_result = MagicMock()
        pending_result.scalar.return_value = None
        overdue_result = MagicMock()
        overdue_result.scalar.return_value = None
        next_due_result = MagicMock()
        next_due_result.scalar_one_or_none.return_value = None

        db.execute = AsyncMock(side_effect=[
            count_result, items_result, pending_result, overdue_result, next_due_result
        ])

        svc = PlanningService(db)
        await svc.get_debt_payments(status="pending")

        assert db.execute.call_count == 5

    @patch(f"{TIMEZONE_MODULE}.get_colombia_date", return_value=FIXED_TODAY)
    async def test_filters_by_date_range(self, _mock_date):
        db = make_db_mock()
        count_result = MagicMock()
        count_result.scalar.return_value = 0
        items_result = MagicMock()
        items_result.scalars.return_value.all.return_value = []
        pending_result = MagicMock()
        pending_result.scalar.return_value = None
        overdue_result = MagicMock()
        overdue_result.scalar.return_value = None
        next_due_result = MagicMock()
        next_due_result.scalar_one_or_none.return_value = None

        db.execute = AsyncMock(side_effect=[
            count_result, items_result, pending_result, overdue_result, next_due_result
        ])

        svc = PlanningService(db)
        await svc.get_debt_payments(
            start_date=date(2026, 1, 1),
            end_date=date(2026, 12, 31)
        )

        assert db.execute.call_count == 5


class TestCreateDebtPayment:

    async def test_happy_path(self):
        db = make_db_mock()
        svc = PlanningService(db)

        data = {
            "description": "Cuota prestamo",
            "amount": Decimal("1000000"),
            "due_date": date(2026, 5, 15),
        }

        result = await svc.create_debt_payment(data)

        assert db.add.called
        assert db.flush.called
        assert result.description == "Cuota prestamo"
        assert result.amount == Decimal("1000000")
        assert result.status == DebtPaymentStatus.PENDING

    async def test_with_optional_fields(self):
        db = make_db_mock()
        svc = PlanningService(db)
        account_id = uuid4()

        data = {
            "description": "Proveedor telas",
            "amount": Decimal("2500000"),
            "due_date": date(2026, 6, 1),
            "creditor": "Telas S.A.",
            "is_recurring": True,
            "recurrence_day": 15,
            "category": "supplier",
            "notes": "Pago mensual telas",
            "balance_account_id": account_id,
        }

        result = await svc.create_debt_payment(data)

        assert result.creditor == "Telas S.A."
        assert result.is_recurring is True
        assert result.recurrence_day == 15
        assert result.category == "supplier"
        assert result.balance_account_id == account_id

    async def test_with_created_by(self):
        db = make_db_mock()
        svc = PlanningService(db)
        user_id = uuid4()

        data = {
            "description": "Test",
            "amount": Decimal("100000"),
            "due_date": date(2026, 5, 1),
        }

        result = await svc.create_debt_payment(data, created_by=user_id)

        assert result.created_by == user_id


class TestUpdateDebtPayment:

    @patch(f"{TIMEZONE_MODULE}.get_colombia_now_naive", return_value=FIXED_NOW)
    async def test_found_and_updated(self, _mock_now):
        db = make_db_mock()
        payment = make_debt_payment(description="Original")

        result_mock = MagicMock()
        result_mock.scalar_one_or_none.return_value = payment
        db.execute = AsyncMock(return_value=result_mock)

        svc = PlanningService(db)
        result = await svc.update_debt_payment(
            payment.id, {"description": "Updated"}
        )

        assert result is not None
        assert payment.description == "Updated"
        assert payment.updated_at == FIXED_NOW
        assert db.flush.called

    async def test_not_found_returns_none(self):
        db = make_db_mock()
        result_mock = MagicMock()
        result_mock.scalar_one_or_none.return_value = None
        db.execute = AsyncMock(return_value=result_mock)

        svc = PlanningService(db)
        result = await svc.update_debt_payment(uuid4(), {"description": "X"})

        assert result is None

    @patch(f"{TIMEZONE_MODULE}.get_colombia_now_naive", return_value=FIXED_NOW)
    async def test_partial_update_skips_none_values(self, _mock_now):
        db = make_db_mock()
        payment = make_debt_payment(description="Keep", creditor="Keep")

        result_mock = MagicMock()
        result_mock.scalar_one_or_none.return_value = payment
        db.execute = AsyncMock(return_value=result_mock)

        svc = PlanningService(db)
        await svc.update_debt_payment(
            payment.id, {"description": "Changed", "creditor": None}
        )

        assert payment.description == "Changed"


class TestMarkDebtAsPaid:

    @patch(f"{TIMEZONE_MODULE}.get_colombia_now_naive", return_value=FIXED_NOW)
    async def test_happy_path_all_capital(self, _mock_now):
        """Default behavior: full paid_amount counted as capital, no interest expense."""
        db = make_db_mock()
        payment = make_debt_payment()
        pay_account = make_liability(balance=Decimal("2000000"))  # cash account stand-in

        setup_execute_returns(db, payment, pay_account)

        svc = PlanningService(db)
        result = await svc.mark_debt_as_paid(
            payment.id,
            paid_date=FIXED_TODAY,
            paid_amount=Decimal("500000"),
            payment_method="nequi",
            payment_account_id=pay_account.id,
        )

        assert result is not None
        assert payment.status == DebtPaymentStatus.PAID
        assert payment.paid_amount == Decimal("500000")

        # Cash account reduced and BalanceEntry emitted with -paid_amount
        assert pay_account.balance == Decimal("1500000")
        added_entries = [c.args[0] for c in db.add.call_args_list if isinstance(c.args[0], BalanceEntry)]
        assert len(added_entries) == 1
        assert added_entries[0].amount == Decimal("-500000")
        assert added_entries[0].balance_after == Decimal("1500000")

        # No interest expense was created
        added_expenses = [c.args[0] for c in db.add.call_args_list if isinstance(c.args[0], Expense)]
        assert added_expenses == []

    @patch(f"{TIMEZONE_MODULE}.get_colombia_now_naive", return_value=FIXED_NOW)
    async def test_split_capital_and_interest(self, _mock_now):
        """When split is given, emits 3 entries: cash reduction + capital reduction on liability + interest expense."""
        db = make_db_mock()
        liability_id = uuid4()
        payment = make_debt_payment(balance_account_id=liability_id)
        pay_account = make_liability(balance=Decimal("3000000"))
        liability_account = make_liability(balance=Decimal("10000000"))
        liability_account.id = liability_id

        # First execute returns payment, second the cash account, third the liability account
        setup_execute_returns(db, payment, pay_account, liability_account)

        svc = PlanningService(db)
        result = await svc.mark_debt_as_paid(
            payment.id,
            paid_date=FIXED_TODAY,
            paid_amount=Decimal("500000"),
            payment_method="nequi",
            payment_account_id=pay_account.id,
            capital_amount=Decimal("400000"),
            interest_amount=Decimal("100000"),
        )

        assert result is not None

        # Cash account reduced by 500_000 (full paid_amount)
        assert pay_account.balance == Decimal("2500000")

        # Liability reduced by 400_000 (capital portion only)
        assert liability_account.balance == Decimal("9600000")

        # Two BalanceEntry: pay account (-500_000), liability (-400_000)
        added_entries = [c.args[0] for c in db.add.call_args_list if isinstance(c.args[0], BalanceEntry)]
        assert len(added_entries) == 2
        amounts = sorted([e.amount for e in added_entries])
        assert amounts == [Decimal("-500000"), Decimal("-400000")]

        # One Expense for interest
        added_expenses = [c.args[0] for c in db.add.call_args_list if isinstance(c.args[0], Expense)]
        assert len(added_expenses) == 1
        assert added_expenses[0].amount == Decimal("100000")
        assert added_expenses[0].category == ExpenseCategory.INTERESES_FINANCIEROS.value
        assert added_expenses[0].is_paid is True

    @patch(f"{TIMEZONE_MODULE}.get_colombia_now_naive", return_value=FIXED_NOW)
    async def test_one_side_derives_the_other(self, _mock_now):
        """Providing only interest_amount derives capital = paid - interest."""
        db = make_db_mock()
        liability_id = uuid4()
        payment = make_debt_payment(balance_account_id=liability_id)
        pay_account = make_liability(balance=Decimal("3000000"))
        liability_account = make_liability(balance=Decimal("10000000"))
        liability_account.id = liability_id

        setup_execute_returns(db, payment, pay_account, liability_account)

        svc = PlanningService(db)
        await svc.mark_debt_as_paid(
            payment.id,
            paid_date=FIXED_TODAY,
            paid_amount=Decimal("500000"),
            payment_method="nequi",
            payment_account_id=pay_account.id,
            interest_amount=Decimal("70000"),  # capital should be derived as 430_000
        )

        # Liability reduced by 430_000
        assert liability_account.balance == Decimal("9570000")
        added_expenses = [c.args[0] for c in db.add.call_args_list if isinstance(c.args[0], Expense)]
        assert added_expenses[0].amount == Decimal("70000")

    @patch(f"{TIMEZONE_MODULE}.get_colombia_now_naive", return_value=FIXED_NOW)
    async def test_split_must_sum_to_paid(self, _mock_now):
        """capital + interest must equal paid_amount, otherwise ValueError."""
        db = make_db_mock()
        payment = make_debt_payment()
        pay_account = make_liability(balance=Decimal("3000000"))
        setup_execute_returns(db, payment, pay_account)

        svc = PlanningService(db)
        with pytest.raises(ValueError, match="igualar paid_amount"):
            await svc.mark_debt_as_paid(
                payment.id,
                paid_date=FIXED_TODAY,
                paid_amount=Decimal("500000"),
                payment_method="nequi",
                payment_account_id=pay_account.id,
                capital_amount=Decimal("400000"),
                interest_amount=Decimal("50000"),  # 400k + 50k != 500k
            )

    @patch(f"{TIMEZONE_MODULE}.get_colombia_now_naive", return_value=FIXED_NOW)
    async def test_negative_amounts_rejected(self, _mock_now):
        db = make_db_mock()
        payment = make_debt_payment()
        pay_account = make_liability(balance=Decimal("3000000"))
        setup_execute_returns(db, payment, pay_account)

        svc = PlanningService(db)
        with pytest.raises(ValueError, match=">= 0"):
            await svc.mark_debt_as_paid(
                payment.id,
                paid_date=FIXED_TODAY,
                paid_amount=Decimal("500000"),
                payment_method="nequi",
                payment_account_id=pay_account.id,
                capital_amount=Decimal("-100000"),
                interest_amount=Decimal("600000"),
            )

    async def test_not_found_returns_none(self):
        db = make_db_mock()
        setup_execute_returns(db, None)

        svc = PlanningService(db)
        result = await svc.mark_debt_as_paid(
            uuid4(), FIXED_TODAY, Decimal("100"), "cash", uuid4()
        )

        assert result is None


class TestDeleteDebtPayment:

    async def test_pending_payment_deleted(self):
        db = make_db_mock()
        payment = make_debt_payment(status=DebtPaymentStatus.PENDING)

        result_mock = MagicMock()
        result_mock.scalar_one_or_none.return_value = payment
        db.execute = AsyncMock(return_value=result_mock)

        svc = PlanningService(db)
        result = await svc.delete_debt_payment(payment.id)

        assert result is True
        db.delete.assert_called_once_with(payment)
        assert db.flush.called

    async def test_non_pending_payment_not_deleted(self):
        db = make_db_mock()
        payment = make_debt_payment(status=DebtPaymentStatus.PAID)

        result_mock = MagicMock()
        result_mock.scalar_one_or_none.return_value = payment
        db.execute = AsyncMock(return_value=result_mock)

        svc = PlanningService(db)
        result = await svc.delete_debt_payment(payment.id)

        assert result is False
        db.delete.assert_not_called()

    async def test_overdue_payment_not_deleted(self):
        db = make_db_mock()
        payment = make_debt_payment(status=DebtPaymentStatus.OVERDUE)

        result_mock = MagicMock()
        result_mock.scalar_one_or_none.return_value = payment
        db.execute = AsyncMock(return_value=result_mock)

        svc = PlanningService(db)
        result = await svc.delete_debt_payment(payment.id)

        assert result is False

    async def test_not_found_returns_false(self):
        db = make_db_mock()
        result_mock = MagicMock()
        result_mock.scalar_one_or_none.return_value = None
        db.execute = AsyncMock(return_value=result_mock)

        svc = PlanningService(db)
        result = await svc.delete_debt_payment(uuid4())

        assert result is False


class TestUpdateOverduePayments:

    @patch(f"{TIMEZONE_MODULE}.get_colombia_now_naive", return_value=FIXED_NOW)
    @patch(f"{TIMEZONE_MODULE}.get_colombia_date", return_value=FIXED_TODAY)
    async def test_marks_overdue_items(self, _mock_date, _mock_now):
        db = make_db_mock()
        p1 = make_debt_payment(due_date=date(2026, 3, 1))
        p2 = make_debt_payment(due_date=date(2026, 4, 1))

        result_mock = MagicMock()
        result_mock.scalars.return_value.all.return_value = [p1, p2]
        db.execute = AsyncMock(return_value=result_mock)

        svc = PlanningService(db)
        count = await svc.update_overdue_payments()

        assert count == 2
        assert p1.status == DebtPaymentStatus.OVERDUE
        assert p2.status == DebtPaymentStatus.OVERDUE
        assert p1.updated_at == FIXED_NOW

    @patch(f"{TIMEZONE_MODULE}.get_colombia_date", return_value=FIXED_TODAY)
    async def test_no_overdue_items(self, _mock_date):
        db = make_db_mock()
        result_mock = MagicMock()
        result_mock.scalars.return_value.all.return_value = []
        db.execute = AsyncMock(return_value=result_mock)

        svc = PlanningService(db)
        count = await svc.update_overdue_payments()

        assert count == 0


# ============================================================================
# INTEREST PAYMENT GENERATION
# ============================================================================

class TestGenerateInterestPayments:

    async def test_happy_path_generates_payments(self):
        db = make_db_mock()
        liability = make_liability(
            balance=Decimal("10000000"),
            interest_rate=Decimal("2.0"),
            due_date=date(2027, 1, 15),
        )

        existing_result = MagicMock()
        existing_result.all.return_value = []
        db.execute = AsyncMock(return_value=existing_result)

        svc = PlanningService(db)
        payments = await svc.generate_interest_payments(
            liability=liability,
            from_date=date(2026, 4, 1),
            to_date=date(2026, 6, 1),
        )

        assert len(payments) == 3
        assert db.add.call_count == 3
        assert db.flush.called

        for p in payments:
            assert p.amount == 200000.0
            assert p.category == "interest"
            assert p.status == DebtPaymentStatus.PENDING
            assert p.balance_account_id == liability.id
            assert p.is_recurring is True

    async def test_zero_rate_returns_empty(self):
        db = make_db_mock()
        liability = make_liability(interest_rate=Decimal("0"))

        svc = PlanningService(db)
        payments = await svc.generate_interest_payments(
            liability=liability,
            from_date=date(2026, 4, 1),
            to_date=date(2026, 6, 1),
        )

        assert payments == []
        db.execute.assert_not_called()

    async def test_none_rate_returns_empty(self):
        db = make_db_mock()
        liability = make_liability(interest_rate=None)

        svc = PlanningService(db)
        payments = await svc.generate_interest_payments(
            liability=liability,
            from_date=date(2026, 4, 1),
            to_date=date(2026, 6, 1),
        )

        assert payments == []

    async def test_skips_existing_months(self):
        db = make_db_mock()
        liability = make_liability()

        existing_result = MagicMock()
        existing_result.all.return_value = [(2026, 4), (2026, 5)]
        db.execute = AsyncMock(return_value=existing_result)

        svc = PlanningService(db)
        payments = await svc.generate_interest_payments(
            liability=liability,
            from_date=date(2026, 4, 1),
            to_date=date(2026, 6, 1),
        )

        assert len(payments) == 1
        assert payments[0].due_date.month == 6

    async def test_single_month_range(self):
        db = make_db_mock()
        liability = make_liability()

        existing_result = MagicMock()
        existing_result.all.return_value = []
        db.execute = AsyncMock(return_value=existing_result)

        svc = PlanningService(db)
        payments = await svc.generate_interest_payments(
            liability=liability,
            from_date=date(2026, 7, 1),
            to_date=date(2026, 7, 31),
        )

        assert len(payments) == 1

    async def test_description_contains_spanish_month(self):
        db = make_db_mock()
        liability = make_liability(name="Prestamo ABC")

        existing_result = MagicMock()
        existing_result.all.return_value = []
        db.execute = AsyncMock(return_value=existing_result)

        svc = PlanningService(db)
        payments = await svc.generate_interest_payments(
            liability=liability,
            from_date=date(2026, 1, 1),
            to_date=date(2026, 1, 31),
        )

        assert "Enero" in payments[0].description
        assert "Prestamo ABC" in payments[0].description

    async def test_passes_created_by(self):
        db = make_db_mock()
        liability = make_liability()
        user_id = uuid4()

        existing_result = MagicMock()
        existing_result.all.return_value = []
        db.execute = AsyncMock(return_value=existing_result)

        svc = PlanningService(db)
        payments = await svc.generate_interest_payments(
            liability=liability,
            from_date=date(2026, 5, 1),
            to_date=date(2026, 5, 31),
            created_by=user_id,
        )

        assert payments[0].created_by == user_id

    async def test_no_flush_when_nothing_generated(self):
        db = make_db_mock()
        liability = make_liability()

        existing_result = MagicMock()
        existing_result.all.return_value = [(2026, 5)]
        db.execute = AsyncMock(return_value=existing_result)

        svc = PlanningService(db)
        payments = await svc.generate_interest_payments(
            liability=liability,
            from_date=date(2026, 5, 1),
            to_date=date(2026, 5, 31),
        )

        assert payments == []
        db.flush.assert_not_called()


class TestGenerateAllPendingInterest:

    @patch(f"{TIMEZONE_MODULE}.get_colombia_date", return_value=FIXED_TODAY)
    async def test_active_liabilities_generate_payments(self, _mock_date):
        db = make_db_mock()
        liability = make_liability(due_date=date(2026, 8, 15))

        liabilities_result = MagicMock()
        liabilities_result.scalars.return_value.all.return_value = [liability]

        existing_result = MagicMock()
        existing_result.all.return_value = []

        db.execute = AsyncMock(side_effect=[liabilities_result, existing_result])

        svc = PlanningService(db)
        result = await svc.generate_all_pending_interest()

        assert len(result) > 0
        assert result[0]["liability_name"] == liability.name
        assert "amount" in result[0]
        assert "due_date" in result[0]

    @patch(f"{TIMEZONE_MODULE}.get_colombia_date", return_value=FIXED_TODAY)
    async def test_past_due_liability_generates_one_month_ahead(self, _mock_date):
        db = make_db_mock()
        liability = make_liability(due_date=date(2026, 3, 1))

        liabilities_result = MagicMock()
        liabilities_result.scalars.return_value.all.return_value = [liability]

        existing_result = MagicMock()
        existing_result.all.return_value = []

        db.execute = AsyncMock(side_effect=[liabilities_result, existing_result])

        svc = PlanningService(db)
        result = await svc.generate_all_pending_interest()

        assert len(result) >= 1

    @patch(f"{TIMEZONE_MODULE}.get_colombia_date", return_value=FIXED_TODAY)
    async def test_no_liabilities_returns_empty(self, _mock_date):
        db = make_db_mock()

        liabilities_result = MagicMock()
        liabilities_result.scalars.return_value.all.return_value = []
        db.execute = AsyncMock(return_value=liabilities_result)

        svc = PlanningService(db)
        result = await svc.generate_all_pending_interest()

        assert result == []

    @patch(f"{TIMEZONE_MODULE}.get_colombia_date", return_value=FIXED_TODAY)
    async def test_passes_created_by_to_generator(self, _mock_date):
        db = make_db_mock()
        user_id = uuid4()
        liability = make_liability(due_date=date(2026, 6, 15))

        liabilities_result = MagicMock()
        liabilities_result.scalars.return_value.all.return_value = [liability]

        existing_result = MagicMock()
        existing_result.all.return_value = []

        db.execute = AsyncMock(side_effect=[liabilities_result, existing_result])

        svc = PlanningService(db)
        result = await svc.generate_all_pending_interest(created_by=user_id)

        for entry in result:
            assert "liability_name" in entry


# ============================================================================
# SALES SEASONALITY
# ============================================================================

class TestGetSalesSeasonality:

    @patch(f"{TIMEZONE_MODULE}.get_colombia_date", return_value=FIXED_TODAY)
    async def test_with_data(self, _mock_date):
        db = make_db_mock()
        row1 = MagicMock(year=2025, month=1, total_sales=Decimal("5000000"), sales_count=50)
        row2 = MagicMock(year=2025, month=7, total_sales=Decimal("1000000"), sales_count=10)
        row3 = MagicMock(year=2026, month=1, total_sales=Decimal("6000000"), sales_count=55)

        result_mock = MagicMock()
        result_mock.all.return_value = [row1, row2, row3]
        db.execute = AsyncMock(return_value=result_mock)

        svc = PlanningService(db)
        result = await svc.get_sales_seasonality()

        assert len(result["monthly_data"]) == 3
        assert result["monthly_data"][0]["month_name"] == "Enero"
        assert "2025" in result["yearly_totals"]
        assert "2026" in result["yearly_totals"]
        assert len(result["patterns"]) == len(SEASONALITY_PATTERNS)
        assert "disclaimer" in result

    @patch(f"{TIMEZONE_MODULE}.get_colombia_date", return_value=FIXED_TODAY)
    async def test_default_year_range(self, _mock_date):
        db = make_db_mock()
        result_mock = MagicMock()
        result_mock.all.return_value = []
        db.execute = AsyncMock(return_value=result_mock)

        svc = PlanningService(db)
        result = await svc.get_sales_seasonality()

        assert result["monthly_data"] == []
        assert result["yearly_totals"] == {}
        assert result["growth_rates"] == {}

    @patch(f"{TIMEZONE_MODULE}.get_colombia_date", return_value=FIXED_TODAY)
    async def test_growth_rate_calculation(self, _mock_date):
        db = make_db_mock()
        row1 = MagicMock(year=2024, month=1, total_sales=Decimal("1000000"), sales_count=10)
        row2 = MagicMock(year=2025, month=1, total_sales=Decimal("1500000"), sales_count=15)

        result_mock = MagicMock()
        result_mock.all.return_value = [row1, row2]
        db.execute = AsyncMock(return_value=result_mock)

        svc = PlanningService(db)
        result = await svc.get_sales_seasonality()

        assert "2024-2025" in result["growth_rates"]
        assert result["growth_rates"]["2024-2025"] == 50.0

    @patch(f"{TIMEZONE_MODULE}.get_colombia_date", return_value=FIXED_TODAY)
    async def test_empty_data(self, _mock_date):
        db = make_db_mock()
        result_mock = MagicMock()
        result_mock.all.return_value = []
        db.execute = AsyncMock(return_value=result_mock)

        svc = PlanningService(db)
        result = await svc.get_sales_seasonality(start_year=2020, end_year=2025)

        assert result["monthly_data"] == []
        assert result["growth_rates"] == {}

    @patch(f"{TIMEZONE_MODULE}.get_colombia_date", return_value=FIXED_TODAY)
    async def test_average_sale_calculation(self, _mock_date):
        db = make_db_mock()
        row = MagicMock(year=2025, month=3, total_sales=Decimal("3000000"), sales_count=30)

        result_mock = MagicMock()
        result_mock.all.return_value = [row]
        db.execute = AsyncMock(return_value=result_mock)

        svc = PlanningService(db)
        result = await svc.get_sales_seasonality()

        assert result["monthly_data"][0]["average_sale"] == Decimal("100000")

    @patch(f"{TIMEZONE_MODULE}.get_colombia_date", return_value=FIXED_TODAY)
    async def test_zero_sales_count_yields_zero_average(self, _mock_date):
        db = make_db_mock()
        row = MagicMock(year=2025, month=3, total_sales=Decimal("0"), sales_count=0)

        result_mock = MagicMock()
        result_mock.all.return_value = [row]
        db.execute = AsyncMock(return_value=result_mock)

        svc = PlanningService(db)
        result = await svc.get_sales_seasonality()

        assert result["monthly_data"][0]["average_sale"] == Decimal("0")


# ============================================================================
# CASH FLOW PROJECTION
# ============================================================================

class TestGetCashProjection:

    @patch(f"{TIMEZONE_MODULE}.get_colombia_date", return_value=FIXED_TODAY)
    async def test_happy_path(self, _mock_date):
        db = make_db_mock()
        svc = PlanningService(db)

        with patch.object(svc, "_get_current_liquidity", return_value=Decimal("20000000")), \
             patch.object(svc, "_get_fixed_expenses_monthly", return_value=Decimal("3000000")), \
             patch.object(svc, "_get_historical_monthly_sales", return_value={4: Decimal("5000000")}), \
             patch.object(svc, "_get_upcoming_debt_payments", return_value=[]):

            result = await svc.get_cash_projection(months=3)

        assert len(result["projections"]) == 3
        assert result["current_liquidity"] == Decimal("20000000")
        assert "projected_end_balance" in result
        assert "total_projected_income" in result
        assert "total_projected_expenses" in result
        assert "disclaimer" in result

    @patch(f"{TIMEZONE_MODULE}.get_colombia_date", return_value=FIXED_TODAY)
    async def test_below_threshold_alerts(self, _mock_date):
        db = make_db_mock()
        svc = PlanningService(db)

        with patch.object(svc, "_get_current_liquidity", return_value=Decimal("1000000")), \
             patch.object(svc, "_get_fixed_expenses_monthly", return_value=Decimal("5000000")), \
             patch.object(svc, "_get_historical_monthly_sales", return_value={}), \
             patch.object(svc, "_get_upcoming_debt_payments", return_value=[]):

            result = await svc.get_cash_projection(
                months=2,
                liquidity_threshold=Decimal("5000000")
            )

        assert len(result["months_below_threshold"]) > 0
        below_month = next(
            p for p in result["projections"] if p["is_below_threshold"]
        )
        assert below_month["alert_message"] is not None

    @patch(f"{TIMEZONE_MODULE}.get_colombia_date", return_value=FIXED_TODAY)
    async def test_debt_payments_in_projection(self, _mock_date):
        db = make_db_mock()
        svc = PlanningService(db)

        debt = {
            "id": str(uuid4()),
            "description": "Cuota prestamo",
            "amount": Decimal("2000000"),
            "due_date": date(2026, 5, 15),
            "status": "pending",
        }

        with patch.object(svc, "_get_current_liquidity", return_value=Decimal("20000000")), \
             patch.object(svc, "_get_fixed_expenses_monthly", return_value=Decimal("1000000")), \
             patch.object(svc, "_get_historical_monthly_sales", return_value={}), \
             patch.object(svc, "_get_upcoming_debt_payments", return_value=[debt]):

            result = await svc.get_cash_projection(months=3)

        may_projection = next(
            (p for p in result["projections"] if p["month"] == 5), None
        )
        assert may_projection is not None
        assert may_projection["debt_payments"] == Decimal("2000000")
        assert may_projection["has_debt_due"] is True

    @patch(f"{TIMEZONE_MODULE}.get_colombia_date", return_value=FIXED_TODAY)
    async def test_running_balance_accumulates(self, _mock_date):
        db = make_db_mock()
        svc = PlanningService(db)

        with patch.object(svc, "_get_current_liquidity", return_value=Decimal("10000000")), \
             patch.object(svc, "_get_fixed_expenses_monthly", return_value=Decimal("2000000")), \
             patch.object(svc, "_get_historical_monthly_sales", return_value={
                 4: Decimal("3000000"), 5: Decimal("3000000")
             }), \
             patch.object(svc, "_get_upcoming_debt_payments", return_value=[]):

            result = await svc.get_cash_projection(months=2, growth_factor=Decimal("1.0"))

        proj = result["projections"]
        assert proj[0]["opening_balance"] == Decimal("10000000")
        assert proj[1]["opening_balance"] == proj[0]["closing_balance"]


class TestGetCurrentLiquidity:

    async def test_sums_cash_accounts(self):
        db = make_db_mock()
        svc = PlanningService(db)

        accounts_map = {
            "caja_menor": uuid4(),
            "caja_mayor": uuid4(),
            "nequi": uuid4(),
            "banco": uuid4(),
        }

        balance_results = []
        for _ in range(4):
            r = MagicMock()
            r.scalar.return_value = Decimal("5000000")
            balance_results.append(r)

        db.execute = AsyncMock(side_effect=balance_results)

        with patch.object(svc.balance_service, "get_or_create_global_accounts",
                         return_value=accounts_map):
            result = await svc._get_current_liquidity()

        assert result == Decimal("20000000")

    async def test_handles_missing_accounts(self):
        db = make_db_mock()
        svc = PlanningService(db)

        accounts_map = {"caja_menor": uuid4()}

        balance_result = MagicMock()
        balance_result.scalar.return_value = Decimal("1000000")
        db.execute = AsyncMock(return_value=balance_result)

        with patch.object(svc.balance_service, "get_or_create_global_accounts",
                         return_value=accounts_map):
            result = await svc._get_current_liquidity()

        assert result == Decimal("1000000")

    async def test_handles_none_balances(self):
        db = make_db_mock()
        svc = PlanningService(db)

        accounts_map = {"caja_menor": uuid4(), "banco": uuid4()}

        r1 = MagicMock()
        r1.scalar.return_value = None
        r2 = MagicMock()
        r2.scalar.return_value = Decimal("3000000")

        db.execute = AsyncMock(side_effect=[r1, r2])

        with patch.object(svc.balance_service, "get_or_create_global_accounts",
                         return_value=accounts_map):
            result = await svc._get_current_liquidity()

        assert result == Decimal("3000000")


class TestGetFixedExpensesMonthly:

    async def test_monthly_plus_yearly_divided(self):
        db = make_db_mock()

        monthly_result = MagicMock()
        monthly_result.scalar.return_value = Decimal("2000000")

        yearly_result = MagicMock()
        yearly_result.scalar.return_value = Decimal("12000000")

        db.execute = AsyncMock(side_effect=[monthly_result, yearly_result])

        svc = PlanningService(db)
        result = await svc._get_fixed_expenses_monthly()

        assert result == Decimal("3000000")

    async def test_no_expenses_returns_zero(self):
        db = make_db_mock()

        monthly_result = MagicMock()
        monthly_result.scalar.return_value = None

        yearly_result = MagicMock()
        yearly_result.scalar.return_value = None

        db.execute = AsyncMock(side_effect=[monthly_result, yearly_result])

        svc = PlanningService(db)
        result = await svc._get_fixed_expenses_monthly()

        assert result == Decimal("0")

    async def test_only_monthly_expenses(self):
        db = make_db_mock()

        monthly_result = MagicMock()
        monthly_result.scalar.return_value = Decimal("1500000")

        yearly_result = MagicMock()
        yearly_result.scalar.return_value = None

        db.execute = AsyncMock(side_effect=[monthly_result, yearly_result])

        svc = PlanningService(db)
        result = await svc._get_fixed_expenses_monthly()

        assert result == Decimal("1500000")


class TestProjectMonthlySales:

    def test_with_historical_data(self):
        svc = PlanningService.__new__(PlanningService)
        historical = {1: Decimal("5000000"), 7: Decimal("1000000")}

        result = svc._project_monthly_sales(1, historical, Decimal("1.20"))

        assert result == Decimal("6000000")

    def test_without_historical_uses_seasonality_fallback(self):
        svc = PlanningService.__new__(PlanningService)
        historical = {3: Decimal("500000")}

        result = svc._project_monthly_sales(1, historical, Decimal("1.0"))

        assert result > Decimal("0")

    def test_empty_historical_uses_default(self):
        svc = PlanningService.__new__(PlanningService)

        result = svc._project_monthly_sales(1, {}, Decimal("1.0"))

        assert result > Decimal("0")

    def test_growth_factor_applied(self):
        svc = PlanningService.__new__(PlanningService)
        historical = {5: Decimal("2000000")}

        result_1x = svc._project_monthly_sales(5, historical, Decimal("1.0"))
        result_2x = svc._project_monthly_sales(5, historical, Decimal("2.0"))

        assert result_2x == result_1x * 2

    def test_alta_season_higher_than_baja(self):
        svc = PlanningService.__new__(PlanningService)
        historical = {6: Decimal("1000000")}

        alta = svc._project_monthly_sales(1, historical, Decimal("1.0"))
        baja = svc._project_monthly_sales(9, historical, Decimal("1.0"))

        assert alta > baja


# ============================================================================
# PLANNING DASHBOARD
# ============================================================================

class TestGetPlanningDashboard:

    @patch(f"{TIMEZONE_MODULE}.get_colombia_date", return_value=date(2026, 1, 15))
    async def test_alta_season(self, _mock_date):
        db = make_db_mock()
        svc = PlanningService(db)

        with patch.object(svc, "_get_current_liquidity", return_value=Decimal("15000000")), \
             patch.object(svc, "_get_fixed_expenses_monthly", return_value=Decimal("2000000")), \
             patch.object(svc, "get_cash_projection", return_value={"projections": []}):

            pending_result = MagicMock()
            pending_result.scalar.return_value = Decimal("3000000")

            next_debt_result = MagicMock()
            next_debt_result.scalar_one_or_none.return_value = None

            db.execute = AsyncMock(side_effect=[pending_result, next_debt_result])

            result = await svc.get_planning_dashboard()

        assert result["current_season"] == "ALTA"
        assert "Maximizar ventas" in result["season_message"]
        assert result["current_liquidity"] == Decimal("15000000")
        assert result["pending_debt_total"] == Decimal("3000000")

    @patch(f"{TIMEZONE_MODULE}.get_colombia_date", return_value=date(2026, 7, 10))
    async def test_media_season(self, _mock_date):
        db = make_db_mock()
        svc = PlanningService(db)

        with patch.object(svc, "_get_current_liquidity", return_value=Decimal("10000000")), \
             patch.object(svc, "_get_fixed_expenses_monthly", return_value=Decimal("2000000")), \
             patch.object(svc, "get_cash_projection", return_value={"projections": []}):

            pending_result = MagicMock()
            pending_result.scalar.return_value = None

            next_debt_result = MagicMock()
            next_debt_result.scalar_one_or_none.return_value = None

            db.execute = AsyncMock(side_effect=[pending_result, next_debt_result])

            result = await svc.get_planning_dashboard()

        assert result["current_season"] == "MEDIA"
        assert "inventario" in result["season_message"]

    @patch(f"{TIMEZONE_MODULE}.get_colombia_date", return_value=date(2026, 10, 1))
    async def test_baja_season(self, _mock_date):
        db = make_db_mock()
        svc = PlanningService(db)

        with patch.object(svc, "_get_current_liquidity", return_value=Decimal("8000000")), \
             patch.object(svc, "_get_fixed_expenses_monthly", return_value=Decimal("1000000")), \
             patch.object(svc, "get_cash_projection", return_value={"projections": []}):

            pending_result = MagicMock()
            pending_result.scalar.return_value = Decimal("0")

            next_debt_result = MagicMock()
            next_debt_result.scalar_one_or_none.return_value = None

            db.execute = AsyncMock(side_effect=[pending_result, next_debt_result])

            result = await svc.get_planning_dashboard()

        assert result["current_season"] == "BAJA"
        assert "reservas" in result["season_message"]

    @patch(f"{TIMEZONE_MODULE}.get_colombia_date", return_value=FIXED_TODAY)
    async def test_includes_next_debt_payment(self, _mock_date):
        db = make_db_mock()
        svc = PlanningService(db)
        next_payment = make_debt_payment(due_date=date(2026, 5, 1))

        with patch.object(svc, "_get_current_liquidity", return_value=Decimal("5000000")), \
             patch.object(svc, "_get_fixed_expenses_monthly", return_value=Decimal("1000000")), \
             patch.object(svc, "get_cash_projection", return_value={"projections": []}):

            pending_result = MagicMock()
            pending_result.scalar.return_value = Decimal("500000")

            next_debt_result = MagicMock()
            next_debt_result.scalar_one_or_none.return_value = next_payment

            db.execute = AsyncMock(side_effect=[pending_result, next_debt_result])

            result = await svc.get_planning_dashboard()

        assert result["next_debt_payment"] is not None
        assert result["next_debt_payment"]["id"] == str(next_payment.id)


# ============================================================================
# FORMATTING
# ============================================================================

class TestFormatDebtPayment:

    @patch(f"{TIMEZONE_MODULE}.get_colombia_date", return_value=FIXED_TODAY)
    def test_all_fields_present(self, _mock_date):
        db = make_db_mock()
        svc = PlanningService(db)

        account_id = uuid4()
        ap_id = uuid4()
        user_id = uuid4()
        bal_id = uuid4()

        payment = make_debt_payment(
            description="Cuota 3",
            creditor="Banco Davivienda",
            amount=Decimal("1500000"),
            due_date=date(2026, 5, 15),
            is_recurring=True,
            recurrence_day=15,
            status=DebtPaymentStatus.PENDING,
            paid_date=date(2026, 5, 14),
            paid_amount=Decimal("1500000"),
            payment_method="transfer",
            payment_account_id=account_id,
            balance_account_id=bal_id,
            accounts_payable_id=ap_id,
            category="loan",
            notes="Cuota mensual",
            created_by=user_id,
        )

        result = svc._format_debt_payment(payment)

        assert result["id"] == str(payment.id)
        assert result["description"] == "Cuota 3"
        assert result["creditor"] == "Banco Davivienda"
        assert result["amount"] == Decimal("1500000")
        assert result["due_date"] == "2026-05-15"
        assert result["is_recurring"] is True
        assert result["recurrence_day"] == 15
        assert result["status"] == "pending"
        assert result["paid_date"] == "2026-05-14"
        assert result["paid_amount"] == Decimal("1500000")
        assert result["payment_method"] == "transfer"
        assert result["payment_account_id"] == str(account_id)
        assert result["balance_account_id"] == str(bal_id)
        assert result["accounts_payable_id"] == str(ap_id)
        assert result["category"] == "loan"
        assert result["notes"] == "Cuota mensual"
        assert result["created_by"] == str(user_id)
        assert result["days_until_due"] == (date(2026, 5, 15) - FIXED_TODAY).days

    @patch(f"{TIMEZONE_MODULE}.get_colombia_date", return_value=FIXED_TODAY)
    def test_optional_fields_null(self, _mock_date):
        db = make_db_mock()
        svc = PlanningService(db)

        payment = make_debt_payment(
            creditor=None,
            paid_date=None,
            paid_amount=None,
            payment_method=None,
            payment_account_id=None,
            balance_account_id=None,
            accounts_payable_id=None,
            category=None,
            notes=None,
            created_by=None,
        )

        result = svc._format_debt_payment(payment)

        assert result["creditor"] is None
        assert result["paid_date"] is None
        assert result["paid_amount"] is None
        assert result["payment_method"] is None
        assert result["payment_account_id"] is None
        assert result["balance_account_id"] is None
        assert result["accounts_payable_id"] is None
        assert result["category"] is None
        assert result["notes"] is None
        assert result["created_by"] is None

    @patch(f"{TIMEZONE_MODULE}.get_colombia_date", return_value=FIXED_TODAY)
    def test_days_until_due_negative_for_past(self, _mock_date):
        db = make_db_mock()
        svc = PlanningService(db)

        payment = make_debt_payment(due_date=date(2026, 4, 10))
        result = svc._format_debt_payment(payment)

        assert result["days_until_due"] == -4

    @patch(f"{TIMEZONE_MODULE}.get_colombia_date", return_value=FIXED_TODAY)
    def test_days_until_due_zero_for_today(self, _mock_date):
        db = make_db_mock()
        svc = PlanningService(db)

        payment = make_debt_payment(due_date=FIXED_TODAY)
        result = svc._format_debt_payment(payment)

        assert result["days_until_due"] == 0

    @patch(f"{TIMEZONE_MODULE}.get_colombia_date", return_value=FIXED_TODAY)
    def test_status_string_fallback(self, _mock_date):
        db = make_db_mock()
        svc = PlanningService(db)

        payment = make_debt_payment()
        payment.status = "custom_status"

        result = svc._format_debt_payment(payment)

        assert result["status"] == "custom_status"
