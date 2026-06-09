"""
Deep unit tests for PayrollService.

Covers edge cases and methods not well-tested in test_payroll_service.py:
frequency prorating, absence deductions, worked_days estimation,
monthly multiplier, fixed expense upsert, item updates, and state transitions.
"""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch, PropertyMock
from datetime import date, datetime, timedelta
from decimal import Decimal
from uuid import uuid4, UUID

from app.models.payroll import (
    Employee,
    PayrollRun,
    PayrollItem,
    PayrollStatus,
    PaymentFrequency,
)
from app.models.accounting import Expense, ExpenseCategory
from app.models.fixed_expense import (
    FixedExpense,
    FixedExpenseType,
    ExpenseFrequency as FixedExpenseFrequency,
)
from app.services.payroll_service import (
    PayrollService,
    PAYROLL_FREQUENCY_NAMES,
    PAYROLL_FIXED_EXPENSE_VENDOR,
)
from app.schemas.payroll import (
    PayrollRunCreate,
    PayrollItemUpdate,
    BonusBreakdownItem,
    DeductionBreakdownItem,
)


# ============================================
# Fixtures
# ============================================

@pytest.fixture
def db():
    session = AsyncMock()
    session.add = MagicMock()
    session.flush = AsyncMock()
    session.refresh = AsyncMock()
    session.commit = AsyncMock()
    session.execute = AsyncMock()
    return session


@pytest.fixture
def svc():
    return PayrollService()


def _make_employee(
    *,
    frequency: PaymentFrequency = PaymentFrequency.MONTHLY,
    salary: Decimal = Decimal("1500000"),
    active: bool = True,
) -> MagicMock:
    emp = MagicMock(spec=Employee)
    emp.id = uuid4()
    emp.is_active = active
    emp.base_salary = salary
    emp.payment_frequency = frequency
    emp.full_name = "Test Employee"
    return emp


def _employee_totals(
    base: Decimal = Decimal("1500000"),
    bonuses: Decimal = Decimal("0"),
    deductions: Decimal = Decimal("0"),
) -> dict:
    return {
        "base_salary": base,
        "total_bonuses": bonuses,
        "total_deductions": deductions,
        "net_amount": base + bonuses - deductions,
        "bonus_breakdown": [],
        "deduction_breakdown": [],
    }


def _make_payroll_run(
    status: PayrollStatus = PayrollStatus.DRAFT,
    items: list | None = None,
    expense_id: UUID | None = None,
) -> MagicMock:
    run = MagicMock(spec=PayrollRun)
    run.id = uuid4()
    run.status = status
    run.items = items or []
    run.expense_id = expense_id
    run.period_start = date(2026, 4, 1)
    run.period_end = date(2026, 4, 30)
    run.total_net = Decimal("1500000")
    run.payment_date = None
    run.total_base_salary = Decimal("1500000")
    run.total_bonuses = Decimal("0")
    run.total_deductions = Decimal("0")
    return run


def _mock_db_returns(db, value):
    result = MagicMock()
    result.scalar_one_or_none.return_value = value
    db.execute.return_value = result


def _mock_db_returns_sequence(db, values):
    results = []
    for v in values:
        r = MagicMock()
        r.scalar_one_or_none.return_value = v
        results.append(r)
    db.execute.side_effect = results


# ============================================
# 1. create_payroll_run
# ============================================

class TestCreatePayrollRun:

    async def test_period_end_before_start_raises(self, db, svc):
        data = PayrollRunCreate(
            period_start=date(2026, 4, 30),
            period_end=date(2026, 4, 1),
        )
        with pytest.raises(ValueError, match="fecha de fin"):
            await svc.create_payroll_run(db, data)

    async def test_period_same_day_is_valid(self, db, svc):
        data = PayrollRunCreate(
            period_start=date(2026, 4, 15),
            period_end=date(2026, 4, 15),
        )
        emp = _make_employee()
        with patch("app.services.payroll_service.employee_service") as emp_svc, \
             patch("app.services.payroll_service.attendance_service") as att_svc:
            emp_svc.get_employees = AsyncMock(return_value=[emp])
            emp_svc.calculate_employee_totals = AsyncMock(return_value=_employee_totals())
            att_svc.get_deductible_absences = AsyncMock(return_value=[])

            result = await svc.create_payroll_run(db, data)
            db.add.assert_called()

    async def test_no_active_employees_raises(self, db, svc):
        data = PayrollRunCreate(
            period_start=date(2026, 4, 1),
            period_end=date(2026, 4, 30),
        )
        with patch("app.services.payroll_service.employee_service") as emp_svc:
            emp_svc.get_employees = AsyncMock(return_value=[])
            with pytest.raises(ValueError, match="No hay empleados activos"):
                await svc.create_payroll_run(db, data)

    async def test_specific_employee_ids_filters_inactive(self, db, svc):
        active = _make_employee()
        inactive = _make_employee(active=False)
        data = PayrollRunCreate(
            period_start=date(2026, 4, 1),
            period_end=date(2026, 4, 30),
            employee_ids=[active.id, inactive.id],
        )
        with patch("app.services.payroll_service.employee_service") as emp_svc, \
             patch("app.services.payroll_service.attendance_service") as att_svc:
            async def get_emp(db, emp_id):
                if emp_id == active.id:
                    return active
                return inactive
            emp_svc.get_employee = AsyncMock(side_effect=get_emp)
            emp_svc.calculate_employee_totals = AsyncMock(return_value=_employee_totals())
            att_svc.get_deductible_absences = AsyncMock(return_value=[])

            await svc.create_payroll_run(db, data)
            assert emp_svc.calculate_employee_totals.call_count == 1

    async def test_specific_employee_ids_all_inactive_raises(self, db, svc):
        inactive = _make_employee(active=False)
        data = PayrollRunCreate(
            period_start=date(2026, 4, 1),
            period_end=date(2026, 4, 30),
            employee_ids=[inactive.id],
        )
        with patch("app.services.payroll_service.employee_service") as emp_svc:
            emp_svc.get_employee = AsyncMock(return_value=inactive)
            with pytest.raises(ValueError, match="No hay empleados activos"):
                await svc.create_payroll_run(db, data)

    async def test_daily_frequency_uses_worked_days(self, db, svc):
        emp = _make_employee(frequency=PaymentFrequency.DAILY, salary=Decimal("60000"))
        data = PayrollRunCreate(
            period_start=date(2026, 4, 1),
            period_end=date(2026, 4, 30),
        )
        with patch("app.services.payroll_service.employee_service") as emp_svc, \
             patch("app.services.payroll_service.attendance_service") as att_svc:
            emp_svc.get_employees = AsyncMock(return_value=[emp])
            emp_svc.calculate_employee_totals = AsyncMock(
                return_value=_employee_totals(base=Decimal("60000"))
            )
            att_svc.get_deductible_absences = AsyncMock(return_value=[])
            att_svc.get_attendance_records = AsyncMock(return_value=[])

            await svc.create_payroll_run(db, data)

            att_svc.get_attendance_records.assert_called_once()
            added_item = db.add.call_args_list[1][0][0]
            assert added_item.daily_rate == Decimal("60000")
            assert added_item.worked_days is not None

    async def test_weekly_frequency_prorates(self, db, svc):
        emp = _make_employee(frequency=PaymentFrequency.WEEKLY, salary=Decimal("500000"))
        data = PayrollRunCreate(
            period_start=date(2026, 4, 1),
            period_end=date(2026, 4, 14),
        )
        with patch("app.services.payroll_service.employee_service") as emp_svc, \
             patch("app.services.payroll_service.attendance_service") as att_svc:
            emp_svc.get_employees = AsyncMock(return_value=[emp])
            emp_svc.calculate_employee_totals = AsyncMock(
                return_value=_employee_totals(base=Decimal("500000"))
            )
            att_svc.get_deductible_absences = AsyncMock(return_value=[])

            await svc.create_payroll_run(db, data)
            added_item = db.add.call_args_list[1][0][0]
            expected = Decimal("500000") * (Decimal("14") / Decimal("7"))
            assert added_item.base_salary == expected

    async def test_biweekly_frequency_prorates(self, db, svc):
        emp = _make_employee(frequency=PaymentFrequency.BIWEEKLY, salary=Decimal("750000"))
        data = PayrollRunCreate(
            period_start=date(2026, 4, 1),
            period_end=date(2026, 4, 14),
        )
        with patch("app.services.payroll_service.employee_service") as emp_svc, \
             patch("app.services.payroll_service.attendance_service") as att_svc:
            emp_svc.get_employees = AsyncMock(return_value=[emp])
            emp_svc.calculate_employee_totals = AsyncMock(
                return_value=_employee_totals(base=Decimal("750000"))
            )
            att_svc.get_deductible_absences = AsyncMock(return_value=[])

            await svc.create_payroll_run(db, data)
            added_item = db.add.call_args_list[1][0][0]
            expected = Decimal("750000") * (Decimal("14") / Decimal("14"))
            assert added_item.base_salary == expected

    async def test_monthly_frequency_prorates_short_period(self, db, svc):
        emp = _make_employee(frequency=PaymentFrequency.MONTHLY, salary=Decimal("1500000"))
        data = PayrollRunCreate(
            period_start=date(2026, 4, 1),
            period_end=date(2026, 4, 15),
        )
        with patch("app.services.payroll_service.employee_service") as emp_svc, \
             patch("app.services.payroll_service.attendance_service") as att_svc:
            emp_svc.get_employees = AsyncMock(return_value=[emp])
            emp_svc.calculate_employee_totals = AsyncMock(
                return_value=_employee_totals(base=Decimal("1500000"))
            )
            att_svc.get_deductible_absences = AsyncMock(return_value=[])

            await svc.create_payroll_run(db, data)
            added_item = db.add.call_args_list[1][0][0]
            period_days = 15
            expected = Decimal("1500000") * (Decimal(str(period_days)) / Decimal("30"))
            assert added_item.base_salary == expected

    async def test_monthly_frequency_full_month_no_prorate(self, db, svc):
        emp = _make_employee(frequency=PaymentFrequency.MONTHLY, salary=Decimal("1500000"))
        data = PayrollRunCreate(
            period_start=date(2026, 4, 1),
            period_end=date(2026, 4, 30),
        )
        with patch("app.services.payroll_service.employee_service") as emp_svc, \
             patch("app.services.payroll_service.attendance_service") as att_svc:
            emp_svc.get_employees = AsyncMock(return_value=[emp])
            emp_svc.calculate_employee_totals = AsyncMock(
                return_value=_employee_totals(base=Decimal("1500000"))
            )
            att_svc.get_deductible_absences = AsyncMock(return_value=[])

            await svc.create_payroll_run(db, data)
            added_item = db.add.call_args_list[1][0][0]
            assert added_item.base_salary == Decimal("1500000")

    async def test_absence_deductions_integrated(self, db, svc):
        emp = _make_employee()
        data = PayrollRunCreate(
            period_start=date(2026, 4, 1),
            period_end=date(2026, 4, 30),
        )

        absence = MagicMock()
        absence.deduction_amount = Decimal("50000")
        absence.absence_type = MagicMock()
        absence.absence_type.value = "absence_unjustified"
        absence.absence_date = date(2026, 4, 10)

        with patch("app.services.payroll_service.employee_service") as emp_svc, \
             patch("app.services.payroll_service.attendance_service") as att_svc:
            emp_svc.get_employees = AsyncMock(return_value=[emp])
            emp_svc.calculate_employee_totals = AsyncMock(
                return_value=_employee_totals(deductions=Decimal("100000"))
            )
            att_svc.get_deductible_absences = AsyncMock(return_value=[absence])

            await svc.create_payroll_run(db, data)
            added_item = db.add.call_args_list[1][0][0]
            assert added_item.total_deductions == Decimal("150000")

    async def test_absence_zero_deduction_skipped_in_breakdown(self, db, svc):
        emp = _make_employee()
        data = PayrollRunCreate(
            period_start=date(2026, 4, 1),
            period_end=date(2026, 4, 30),
        )

        absence = MagicMock()
        absence.deduction_amount = Decimal("0")
        absence.absence_type = MagicMock()
        absence.absence_type.value = "tardiness"
        absence.absence_date = date(2026, 4, 5)

        with patch("app.services.payroll_service.employee_service") as emp_svc, \
             patch("app.services.payroll_service.attendance_service") as att_svc:
            emp_svc.get_employees = AsyncMock(return_value=[emp])
            emp_svc.calculate_employee_totals = AsyncMock(return_value=_employee_totals())
            att_svc.get_deductible_absences = AsyncMock(return_value=[absence])

            await svc.create_payroll_run(db, data)
            added_item = db.add.call_args_list[1][0][0]
            assert added_item.total_deductions == Decimal("0")

    async def test_payroll_run_totals_summed_correctly(self, db, svc):
        emp1 = _make_employee(salary=Decimal("1000000"))
        emp2 = _make_employee(salary=Decimal("2000000"))
        data = PayrollRunCreate(
            period_start=date(2026, 4, 1),
            period_end=date(2026, 4, 30),
        )
        with patch("app.services.payroll_service.employee_service") as emp_svc, \
             patch("app.services.payroll_service.attendance_service") as att_svc:
            emp_svc.get_employees = AsyncMock(return_value=[emp1, emp2])
            emp_svc.calculate_employee_totals = AsyncMock(side_effect=[
                _employee_totals(base=Decimal("1000000"), bonuses=Decimal("50000")),
                _employee_totals(base=Decimal("2000000"), bonuses=Decimal("100000")),
            ])
            att_svc.get_deductible_absences = AsyncMock(return_value=[])

            await svc.create_payroll_run(db, data)
            added_run = db.add.call_args_list[0][0][0]
            assert added_run.total_base_salary == Decimal("3000000")
            assert added_run.total_bonuses == Decimal("150000")
            assert added_run.total_net == Decimal("3150000")
            assert added_run.employee_count == 2


# ============================================
# 2. approve_payroll_run
# ============================================

class TestApprovePayrollRun:

    async def test_not_found_raises(self, db, svc):
        _mock_db_returns(db, None)
        with pytest.raises(ValueError, match="no encontrada"):
            await svc.approve_payroll_run(db, uuid4())

    async def test_non_draft_raises(self, db, svc):
        run = _make_payroll_run(status=PayrollStatus.APPROVED)
        _mock_db_returns(db, run)
        with pytest.raises(ValueError, match="borrador"):
            await svc.approve_payroll_run(db, run.id)

    @patch("app.services.payroll_service.get_colombia_date", return_value=date(2026, 4, 14))
    @patch("app.services.payroll_service.get_colombia_now_naive", return_value=datetime(2026, 4, 14, 10, 0))
    async def test_happy_path_creates_expense(self, mock_now, mock_date, db, svc):
        item = MagicMock(spec=PayrollItem)
        item.employee = MagicMock()
        item.employee.full_name = "Ana Lopez"
        item.net_amount = Decimal("1500000")
        item.employee_id = uuid4()

        run = _make_payroll_run(items=[item])
        _mock_db_returns(db, run)

        vendor_mock = MagicMock()
        vendor_mock.id = uuid4()

        with patch("app.services.payroll_service.employee_service") as emp_svc:
            emp_svc.get_employee = AsyncMock(return_value=_make_employee())

            with patch.object(svc, "_resolve_payroll_vendor_id", new_callable=AsyncMock, return_value=vendor_mock.id):
                with patch.object(svc, "_update_payroll_fixed_expenses", new_callable=AsyncMock):
                    approved_by = uuid4()
                    await svc.approve_payroll_run(db, run.id, approved_by=approved_by)

        assert run.status == PayrollStatus.APPROVED
        assert run.approved_by == approved_by
        db.add.assert_called()
        added_expense = db.add.call_args_list[0][0][0]
        assert isinstance(added_expense, Expense)
        assert added_expense.category == ExpenseCategory.PAYROLL
        assert added_expense.amount == Decimal("1500000")
        assert added_expense.is_paid is False

    @patch("app.services.payroll_service.get_colombia_date", return_value=date(2026, 4, 14))
    @patch("app.services.payroll_service.get_colombia_now_naive", return_value=datetime(2026, 4, 14, 10, 0))
    async def test_calls_update_fixed_expenses(self, mock_now, mock_date, db, svc):
        run = _make_payroll_run(items=[])
        _mock_db_returns(db, run)

        with patch.object(svc, "_resolve_payroll_vendor_id", new_callable=AsyncMock, return_value=uuid4()):
            with patch.object(svc, "_update_payroll_fixed_expenses", new_callable=AsyncMock) as mock_update:
                await svc.approve_payroll_run(db, run.id, approved_by=uuid4())
                mock_update.assert_called_once()


# ============================================
# 3. mark_payroll_paid
# ============================================

class TestMarkPayrollPaid:

    async def test_not_found_raises(self, db, svc):
        _mock_db_returns(db, None)
        with pytest.raises(ValueError, match="no encontrada"):
            await svc.mark_payroll_paid(db, uuid4())

    async def test_non_approved_raises(self, db, svc):
        run = _make_payroll_run(status=PayrollStatus.DRAFT)
        _mock_db_returns(db, run)
        with pytest.raises(ValueError, match="aprobadas"):
            await svc.mark_payroll_paid(db, run.id)

    # Happy-path coverage (marks items/expense paid, skips already-paid, records
    # the cash Transaction) moved to tests/integration/test_payroll_payment.py —
    # it now hits balance integration and locks rows, so mocking db.execute is moot.


# ============================================
# 4. cancel_payroll_run
# ============================================

class TestCancelPayrollRun:

    async def test_not_found_raises(self, db, svc):
        _mock_db_returns(db, None)
        with pytest.raises(ValueError, match="no encontrada"):
            await svc.cancel_payroll_run(db, uuid4())

    async def test_paid_raises(self, db, svc):
        run = _make_payroll_run(status=PayrollStatus.PAID)
        _mock_db_returns(db, run)
        with pytest.raises(ValueError, match="pagadas"):
            await svc.cancel_payroll_run(db, run.id)

    async def test_draft_can_be_cancelled(self, db, svc):
        run = _make_payroll_run(status=PayrollStatus.DRAFT)
        run.expense_id = None
        _mock_db_returns(db, run)

        await svc.cancel_payroll_run(db, run.id)
        assert run.status == PayrollStatus.CANCELLED

    async def test_approved_can_be_cancelled(self, db, svc):
        run = _make_payroll_run(status=PayrollStatus.APPROVED)
        run.expense_id = None
        _mock_db_returns(db, run)

        await svc.cancel_payroll_run(db, run.id)
        assert run.status == PayrollStatus.CANCELLED

    async def test_deactivates_unpaid_expense(self, db, svc):
        expense_id = uuid4()
        run = _make_payroll_run(status=PayrollStatus.APPROVED, expense_id=expense_id)

        expense = MagicMock(spec=Expense)
        expense.is_paid = False
        expense.notes = "Original notes"

        run_result = MagicMock()
        run_result.scalar_one_or_none.return_value = run
        expense_result = MagicMock()
        expense_result.scalar_one_or_none.return_value = expense

        db.execute.side_effect = [run_result, expense_result]

        await svc.cancel_payroll_run(db, run.id)

        assert expense.is_active is False
        assert "CANCELADO" in expense.notes

    async def test_does_not_deactivate_paid_expense(self, db, svc):
        expense_id = uuid4()
        run = _make_payroll_run(status=PayrollStatus.APPROVED, expense_id=expense_id)

        expense = MagicMock(spec=Expense)
        expense.is_paid = True
        expense.is_active = True
        expense.notes = "Paid"

        run_result = MagicMock()
        run_result.scalar_one_or_none.return_value = run
        expense_result = MagicMock()
        expense_result.scalar_one_or_none.return_value = expense

        db.execute.side_effect = [run_result, expense_result]

        await svc.cancel_payroll_run(db, run.id)

        assert expense.is_active is True
        assert "CANCELADO" not in expense.notes


# ============================================
# 5. update_payroll_item
# ============================================

class TestUpdatePayrollItem:

    async def test_item_not_found_raises(self, db, svc):
        _mock_db_returns(db, None)
        data = PayrollItemUpdate(base_salary=Decimal("2000000"))
        with pytest.raises(ValueError, match="no encontrado"):
            await svc.update_payroll_item(db, uuid4(), data)

    async def test_non_draft_payroll_raises(self, db, svc):
        item = MagicMock(spec=PayrollItem)
        item.id = uuid4()
        item.payroll_run_id = uuid4()

        run = _make_payroll_run(status=PayrollStatus.APPROVED, items=[item])

        _mock_db_returns_sequence(db, [item, run])

        data = PayrollItemUpdate(base_salary=Decimal("2000000"))
        with pytest.raises(ValueError, match="borrador"):
            await svc.update_payroll_item(db, item.id, data)

    async def test_bonus_breakdown_recalculates_total(self, db, svc):
        item = MagicMock(spec=PayrollItem)
        item.id = uuid4()
        item.payroll_run_id = uuid4()
        item.base_salary = Decimal("1500000")
        item.total_bonuses = Decimal("0")
        item.total_deductions = Decimal("0")
        item.net_amount = Decimal("1500000")

        run = _make_payroll_run(status=PayrollStatus.DRAFT, items=[item])
        _mock_db_returns_sequence(db, [item, run])

        b1 = BonusBreakdownItem(name="Transporte", amount=Decimal("162000"))
        b2 = BonusBreakdownItem(name="Comisiones", amount=Decimal("50000"))
        data = MagicMock()
        data.model_dump.return_value = {"bonus_breakdown": [b1, b2]}
        await svc.update_payroll_item(db, item.id, data)

        assert item.total_bonuses == Decimal("212000")
        assert item.net_amount == Decimal("1500000") + Decimal("212000") - Decimal("0")

    async def test_deduction_breakdown_recalculates(self, db, svc):
        item = MagicMock(spec=PayrollItem)
        item.id = uuid4()
        item.payroll_run_id = uuid4()
        item.base_salary = Decimal("1500000")
        item.total_bonuses = Decimal("100000")
        item.total_deductions = Decimal("0")
        item.net_amount = Decimal("1600000")

        run = _make_payroll_run(status=PayrollStatus.DRAFT, items=[item])
        _mock_db_returns_sequence(db, [item, run])

        d1 = DeductionBreakdownItem(name="Salud", amount=Decimal("72000"))
        d2 = DeductionBreakdownItem(name="Pension", amount=Decimal("72000"))
        data = MagicMock()
        data.model_dump.return_value = {"deduction_breakdown": [d1, d2]}
        await svc.update_payroll_item(db, item.id, data)

        assert item.total_deductions == Decimal("144000")
        assert item.net_amount == Decimal("1500000") + Decimal("100000") - Decimal("144000")

    async def test_base_salary_update_recalculates_net(self, db, svc):
        item = MagicMock(spec=PayrollItem)
        item.id = uuid4()
        item.payroll_run_id = uuid4()
        item.base_salary = Decimal("1500000")
        item.total_bonuses = Decimal("100000")
        item.total_deductions = Decimal("50000")
        item.net_amount = Decimal("1550000")

        run = _make_payroll_run(status=PayrollStatus.DRAFT, items=[item])
        _mock_db_returns_sequence(db, [item, run])

        data = PayrollItemUpdate(base_salary=Decimal("2000000"))
        await svc.update_payroll_item(db, item.id, data)

        assert item.base_salary == Decimal("2000000")
        assert item.net_amount == Decimal("2000000") + Decimal("100000") - Decimal("50000")


# ============================================
# 6. pay_payroll_item
# ============================================

class TestPayPayrollItem:

    async def test_item_not_found_raises(self, db, svc):
        _mock_db_returns(db, None)
        with pytest.raises(ValueError, match="no encontrado"):
            await svc.pay_payroll_item(db, uuid4(), "cash")

    # Happy-path / state-transition coverage (sets fields, all-items-paid flips the
    # run to PAID, partial keeps APPROVED, already-paid/draft guards) moved to
    # tests/integration/test_payroll_payment.py: the pay flow now records a real
    # cash Transaction and locks the item FOR UPDATE.


# ============================================
# 7. _get_worked_days
# ============================================

class TestGetWorkedDays:

    async def test_with_attendance_records(self, db, svc):
        present = MagicMock()
        present.status = MagicMock()
        present.status.value = "present"

        late = MagicMock()
        late.status = MagicMock()
        late.status.value = "late"

        absent = MagicMock()
        absent.status = MagicMock()
        absent.status.value = "absent"

        with patch("app.services.payroll_service.attendance_service") as att_svc:
            att_svc.get_attendance_records = AsyncMock(return_value=[present, late, absent])
            result = await svc._get_worked_days(db, uuid4(), date(2026, 4, 1), date(2026, 4, 3))

        assert result == 2

    async def test_without_records_estimates(self, db, svc):
        with patch("app.services.payroll_service.attendance_service") as att_svc:
            att_svc.get_attendance_records = AsyncMock(return_value=[])
            result = await svc._get_worked_days(db, uuid4(), date(2026, 4, 1), date(2026, 4, 7))

        total_days = 7
        expected = int(total_days * 6 / 7)
        assert result == expected

    async def test_single_day_returns_at_least_one(self, db, svc):
        with patch("app.services.payroll_service.attendance_service") as att_svc:
            att_svc.get_attendance_records = AsyncMock(return_value=[])
            result = await svc._get_worked_days(db, uuid4(), date(2026, 4, 1), date(2026, 4, 1))

        assert result >= 1

    async def test_all_absent_returns_zero(self, db, svc):
        absent1 = MagicMock()
        absent1.status = MagicMock()
        absent1.status.value = "absent"

        absent2 = MagicMock()
        absent2.status = MagicMock()
        absent2.status.value = "absent"

        with patch("app.services.payroll_service.attendance_service") as att_svc:
            att_svc.get_attendance_records = AsyncMock(return_value=[absent1, absent2])
            result = await svc._get_worked_days(db, uuid4(), date(2026, 4, 1), date(2026, 4, 2))

        assert result == 0


# ============================================
# 8. _get_monthly_multiplier
# ============================================

class TestGetMonthlyMultiplier:

    def test_daily(self, svc):
        assert svc._get_monthly_multiplier(PaymentFrequency.DAILY) == Decimal("21.67")

    def test_weekly(self, svc):
        assert svc._get_monthly_multiplier(PaymentFrequency.WEEKLY) == Decimal("4.33")

    def test_biweekly(self, svc):
        assert svc._get_monthly_multiplier(PaymentFrequency.BIWEEKLY) == Decimal("2.17")

    def test_monthly(self, svc):
        assert svc._get_monthly_multiplier(PaymentFrequency.MONTHLY) == Decimal("1")


# ============================================
# 9. get_payroll_summary
# ============================================

class TestGetPayrollSummary:

    async def test_no_employees_returns_zero(self, db, svc):
        with patch("app.services.payroll_service.employee_service") as emp_svc:
            emp_svc.get_employees = AsyncMock(return_value=[])

            pending_result = MagicMock()
            pending_result.scalars.return_value.all.return_value = []
            last_paid_result = MagicMock()
            last_paid_result.scalar_one_or_none.return_value = None
            fixed_result = MagicMock()
            fixed_result.scalars.return_value.all.return_value = []

            db.execute.side_effect = [pending_result, last_paid_result, fixed_result]

            result = await svc.get_payroll_summary(db)

        assert result["active_employees"] == 0
        assert result["total_monthly_payroll"] == Decimal("0")
        assert result["last_payroll_date"] is None

    async def test_multiplier_applied_per_frequency(self, db, svc):
        daily_emp = _make_employee(frequency=PaymentFrequency.DAILY, salary=Decimal("60000"))
        monthly_emp = _make_employee(frequency=PaymentFrequency.MONTHLY, salary=Decimal("1500000"))

        with patch("app.services.payroll_service.employee_service") as emp_svc:
            emp_svc.get_employees = AsyncMock(return_value=[daily_emp, monthly_emp])
            emp_svc.calculate_employee_totals = AsyncMock(side_effect=[
                _employee_totals(base=Decimal("60000")),
                _employee_totals(base=Decimal("1500000")),
            ])

            pending_result = MagicMock()
            pending_result.scalars.return_value.all.return_value = []
            last_paid_result = MagicMock()
            last_paid_result.scalar_one_or_none.return_value = None
            fixed_result = MagicMock()
            fixed_result.scalars.return_value.all.return_value = []

            db.execute.side_effect = [pending_result, last_paid_result, fixed_result]

            result = await svc.get_payroll_summary(db)

        daily_monthly = Decimal("60000") * Decimal("21.67")
        monthly_monthly = Decimal("1500000") * Decimal("1")
        assert result["total_monthly_payroll"] == daily_monthly + monthly_monthly

    async def test_fixed_expense_synced_when_close(self, db, svc):
        emp = _make_employee(frequency=PaymentFrequency.MONTHLY)

        fe = MagicMock(spec=FixedExpense)
        fe.id = uuid4()
        fe.amount = Decimal("1500000")
        fe.updated_at = datetime(2026, 4, 10)
        fe.created_at = datetime(2026, 4, 1)

        with patch("app.services.payroll_service.employee_service") as emp_svc:
            emp_svc.get_employees = AsyncMock(return_value=[emp])
            emp_svc.calculate_employee_totals = AsyncMock(
                return_value=_employee_totals(base=Decimal("1500000"))
            )

            pending_result = MagicMock()
            pending_result.scalars.return_value.all.return_value = []
            last_paid_result = MagicMock()
            last_paid_result.scalar_one_or_none.return_value = None
            fixed_result = MagicMock()
            fixed_result.scalars.return_value.all.return_value = [fe]

            db.execute.side_effect = [pending_result, last_paid_result, fixed_result]

            result = await svc.get_payroll_summary(db)

        assert result["fixed_expense_integration"] is not None
        assert result["fixed_expense_integration"]["is_synced"] is True

    async def test_fixed_expense_not_synced_when_far(self, db, svc):
        emp = _make_employee(frequency=PaymentFrequency.MONTHLY)

        fe = MagicMock(spec=FixedExpense)
        fe.id = uuid4()
        fe.amount = Decimal("500000")
        fe.updated_at = datetime(2026, 4, 10)
        fe.created_at = datetime(2026, 4, 1)

        with patch("app.services.payroll_service.employee_service") as emp_svc:
            emp_svc.get_employees = AsyncMock(return_value=[emp])
            emp_svc.calculate_employee_totals = AsyncMock(
                return_value=_employee_totals(base=Decimal("1500000"))
            )

            pending_result = MagicMock()
            pending_result.scalars.return_value.all.return_value = []
            last_paid_result = MagicMock()
            last_paid_result.scalar_one_or_none.return_value = None
            fixed_result = MagicMock()
            fixed_result.scalars.return_value.all.return_value = [fe]

            db.execute.side_effect = [pending_result, last_paid_result, fixed_result]

            result = await svc.get_payroll_summary(db)

        assert result["fixed_expense_integration"]["is_synced"] is False


# ============================================
# 10. _update_payroll_fixed_expenses
# ============================================

class TestUpdatePayrollFixedExpenses:

    async def test_groups_by_frequency(self, db, svc):
        emp_weekly = _make_employee(frequency=PaymentFrequency.WEEKLY)
        emp_monthly = _make_employee(frequency=PaymentFrequency.MONTHLY)

        item_w = MagicMock(spec=PayrollItem)
        item_w.employee_id = emp_weekly.id
        item_w.net_amount = Decimal("500000")

        item_m = MagicMock(spec=PayrollItem)
        item_m.employee_id = emp_monthly.id
        item_m.net_amount = Decimal("1500000")

        run = _make_payroll_run(items=[item_w, item_m])

        with patch.object(svc, "_upsert_fixed_expense_for_frequency", new_callable=AsyncMock) as mock_upsert:
            await svc._update_payroll_fixed_expenses(
                db, run, [item_w, item_m], [emp_weekly, emp_monthly]
            )

        assert mock_upsert.call_count == 2
        call_args = {call.args[1]: call.args[2] for call in mock_upsert.call_args_list}
        assert call_args[PaymentFrequency.WEEKLY] == Decimal("500000")
        assert call_args[PaymentFrequency.MONTHLY] == Decimal("1500000")

    async def test_sums_same_frequency(self, db, svc):
        emp1 = _make_employee(frequency=PaymentFrequency.MONTHLY)
        emp2 = _make_employee(frequency=PaymentFrequency.MONTHLY)

        item1 = MagicMock(spec=PayrollItem)
        item1.employee_id = emp1.id
        item1.net_amount = Decimal("1000000")

        item2 = MagicMock(spec=PayrollItem)
        item2.employee_id = emp2.id
        item2.net_amount = Decimal("800000")

        run = _make_payroll_run()

        with patch.object(svc, "_upsert_fixed_expense_for_frequency", new_callable=AsyncMock) as mock_upsert:
            await svc._update_payroll_fixed_expenses(
                db, run, [item1, item2], [emp1, emp2]
            )

        assert mock_upsert.call_count == 1
        assert mock_upsert.call_args.args[2] == Decimal("1800000")

    async def test_skips_unknown_employees(self, db, svc):
        item = MagicMock(spec=PayrollItem)
        item.employee_id = uuid4()
        item.net_amount = Decimal("500000")

        run = _make_payroll_run()

        with patch.object(svc, "_upsert_fixed_expense_for_frequency", new_callable=AsyncMock) as mock_upsert:
            await svc._update_payroll_fixed_expenses(db, run, [item], [])

        mock_upsert.assert_not_called()


# ============================================
# 11. _upsert_fixed_expense_for_frequency
# ============================================

class TestUpsertFixedExpenseForFrequency:

    async def test_updates_existing(self, db, svc):
        existing = MagicMock(spec=FixedExpense)
        existing.amount = Decimal("1000000")
        existing.updated_at = None

        result_mock = MagicMock()
        result_mock.scalar_one_or_none.return_value = existing
        db.execute.return_value = result_mock

        with patch.object(svc, "_resolve_payroll_vendor_id", new_callable=AsyncMock, return_value=uuid4()):
            with patch("app.services.payroll_service.get_colombia_now_naive", return_value=datetime(2026, 4, 14)):
                fe = await svc._upsert_fixed_expense_for_frequency(
                    db, PaymentFrequency.MONTHLY, Decimal("1800000"), date(2026, 4, 1)
                )

        assert existing.amount == Decimal("1800000")
        assert existing.updated_at == datetime(2026, 4, 14)
        db.add.assert_not_called()

    async def test_creates_new_when_not_found(self, db, svc):
        result_mock = MagicMock()
        result_mock.scalar_one_or_none.return_value = None
        db.execute.return_value = result_mock

        vendor_id = uuid4()
        with patch.object(svc, "_resolve_payroll_vendor_id", new_callable=AsyncMock, return_value=vendor_id):
            fe = await svc._upsert_fixed_expense_for_frequency(
                db, PaymentFrequency.WEEKLY, Decimal("500000"), date(2026, 4, 1), updated_by=uuid4()
            )

        db.add.assert_called_once()
        added = db.add.call_args[0][0]
        assert isinstance(added, FixedExpense)
        assert added.name == "Nomina Semanal" or added.name == PAYROLL_FREQUENCY_NAMES[PaymentFrequency.WEEKLY]
        assert added.amount == Decimal("500000")
        assert added.category == ExpenseCategory.PAYROLL
        assert added.expense_type == FixedExpenseType.EXACT
        assert added.auto_generate is False
        assert added.vendor_id == vendor_id

    async def test_daily_maps_to_weekly_expense_frequency(self, db, svc):
        result_mock = MagicMock()
        result_mock.scalar_one_or_none.return_value = None
        db.execute.return_value = result_mock

        with patch.object(svc, "_resolve_payroll_vendor_id", new_callable=AsyncMock, return_value=uuid4()):
            await svc._upsert_fixed_expense_for_frequency(
                db, PaymentFrequency.DAILY, Decimal("60000"), date(2026, 4, 1)
            )

        added = db.add.call_args[0][0]
        assert added.frequency == FixedExpenseFrequency.WEEKLY

    async def test_monthly_sets_day_of_month(self, db, svc):
        result_mock = MagicMock()
        result_mock.scalar_one_or_none.return_value = None
        db.execute.return_value = result_mock

        with patch.object(svc, "_resolve_payroll_vendor_id", new_callable=AsyncMock, return_value=uuid4()):
            await svc._upsert_fixed_expense_for_frequency(
                db, PaymentFrequency.MONTHLY, Decimal("1500000"), date(2026, 4, 1)
            )

        added = db.add.call_args[0][0]
        assert added.day_of_month == 30

    async def test_non_monthly_no_day_of_month(self, db, svc):
        result_mock = MagicMock()
        result_mock.scalar_one_or_none.return_value = None
        db.execute.return_value = result_mock

        with patch.object(svc, "_resolve_payroll_vendor_id", new_callable=AsyncMock, return_value=uuid4()):
            await svc._upsert_fixed_expense_for_frequency(
                db, PaymentFrequency.BIWEEKLY, Decimal("750000"), date(2026, 4, 1)
            )

        added = db.add.call_args[0][0]
        assert added.day_of_month is None


# ============================================
# 12. _resolve_payroll_vendor_id
# ============================================

class TestResolvePayrollVendorId:

    async def test_returns_vendor_id(self, db, svc):
        expected_id = uuid4()
        mock_vendor = MagicMock()
        mock_vendor.id = expected_id

        mock_vendor_svc_instance = AsyncMock()
        mock_vendor_svc_instance.get_or_create = AsyncMock(return_value=mock_vendor)

        with patch("app.services.accounting.vendors.VendorService", return_value=mock_vendor_svc_instance):
            result = await svc._resolve_payroll_vendor_id(db)

        assert result == expected_id


# ============================================
# Edge cases
# ============================================

class TestEdgeCases:

    async def test_create_payroll_run_employee_not_found_in_specific_ids(self, db, svc):
        data = PayrollRunCreate(
            period_start=date(2026, 4, 1),
            period_end=date(2026, 4, 30),
            employee_ids=[uuid4()],
        )
        with patch("app.services.payroll_service.employee_service") as emp_svc:
            emp_svc.get_employee = AsyncMock(return_value=None)
            with pytest.raises(ValueError, match="No hay empleados activos"):
                await svc.create_payroll_run(db, data)

    async def test_cancel_payroll_expense_with_no_notes(self, db, svc):
        expense_id = uuid4()
        run = _make_payroll_run(status=PayrollStatus.APPROVED, expense_id=expense_id)

        expense = MagicMock(spec=Expense)
        expense.is_paid = False
        expense.notes = None

        run_result = MagicMock()
        run_result.scalar_one_or_none.return_value = run
        expense_result = MagicMock()
        expense_result.scalar_one_or_none.return_value = expense

        db.execute.side_effect = [run_result, expense_result]

        await svc.cancel_payroll_run(db, run.id)

        assert "[CANCELADO" in expense.notes

    async def test_absence_early_departure_label(self, db, svc):
        emp = _make_employee()
        data = PayrollRunCreate(
            period_start=date(2026, 4, 1),
            period_end=date(2026, 4, 30),
        )

        absence = MagicMock()
        absence.deduction_amount = Decimal("25000")
        absence.absence_type = MagicMock()
        absence.absence_type.value = "early_departure"
        absence.absence_date = date(2026, 4, 12)

        with patch("app.services.payroll_service.employee_service") as emp_svc, \
             patch("app.services.payroll_service.attendance_service") as att_svc:
            emp_svc.get_employees = AsyncMock(return_value=[emp])
            emp_svc.calculate_employee_totals = AsyncMock(return_value=_employee_totals())
            att_svc.get_deductible_absences = AsyncMock(return_value=[absence])

            await svc.create_payroll_run(db, data)
            added_item = db.add.call_args_list[1][0][0]
            breakdown_names = [d["name"] for d in added_item.deduction_breakdown]
            assert any("Salida temprana" in n for n in breakdown_names)

    async def test_absence_unknown_type_uses_falta(self, db, svc):
        emp = _make_employee()
        data = PayrollRunCreate(
            period_start=date(2026, 4, 1),
            period_end=date(2026, 4, 30),
        )

        absence = MagicMock()
        absence.deduction_amount = Decimal("10000")
        absence.absence_type = MagicMock()
        absence.absence_type.value = "some_unknown_type"
        absence.absence_date = date(2026, 4, 20)

        with patch("app.services.payroll_service.employee_service") as emp_svc, \
             patch("app.services.payroll_service.attendance_service") as att_svc:
            emp_svc.get_employees = AsyncMock(return_value=[emp])
            emp_svc.calculate_employee_totals = AsyncMock(return_value=_employee_totals())
            att_svc.get_deductible_absences = AsyncMock(return_value=[absence])

            await svc.create_payroll_run(db, data)
            added_item = db.add.call_args_list[1][0][0]
            breakdown_names = [d["name"] for d in added_item.deduction_breakdown]
            assert any("Falta" in n for n in breakdown_names)
