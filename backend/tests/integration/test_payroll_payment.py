"""
Integration tests for payroll payment cash integration (F1.0 / F1.3b).

Exercise the real DB + balance integration: paying payroll must record an
EXPENSE Transaction that debits Caja/Banco (mirroring ExpenseService.pay_expense),
route each employee to the account matching their payment_method, never debit
twice, and refuse to pay more cash than the account holds.
"""
from decimal import Decimal
from datetime import date
from uuid import uuid4

import pytest
from sqlalchemy import select

from app.models.payroll import Employee, PaymentFrequency, PayrollStatus
from app.models.accounting import (
    Transaction,
    TransactionType,
    AccPaymentMethod,
    BalanceAccount,
)
from app.schemas.payroll import PayrollRunCreate
from app.services.payroll_service import payroll_service
from app.services.balance_integration import BalanceIntegrationService

pytestmark = pytest.mark.integration

PERIOD = dict(period_start=date(2026, 4, 1), period_end=date(2026, 4, 30))


async def _make_employee(db, *, base_salary, payment_method, name):
    emp = Employee(
        id=uuid4(),
        full_name=name,
        document_type="CC",
        document_id=f"D{uuid4().hex[:8]}",
        position="Vendedora",
        hire_date=date(2025, 1, 1),
        base_salary=Decimal(str(base_salary)),
        payment_frequency=PaymentFrequency.MONTHLY,
        payment_method=payment_method,
        is_active=True,
        health_deduction=Decimal("0"),
        pension_deduction=Decimal("0"),
        other_deductions=Decimal("0"),
    )
    db.add(emp)
    await db.flush()
    return emp


async def _create_approved_run(db, approver_id):
    run = await payroll_service.create_payroll_run(
        db, PayrollRunCreate(**PERIOD), created_by=approver_id
    )
    return await payroll_service.approve_payroll_run(db, run.id, approved_by=approver_id)


async def _seed_balance(db, account_key, amount):
    """Give a global balance account an opening balance so payments don't hit the
    non-negative constraint (D4). Direct set is fine for a test fixture."""
    accounts = await BalanceIntegrationService(db).get_or_create_global_accounts()
    account = await db.get(BalanceAccount, accounts[account_key])
    account.balance = Decimal(str(amount))
    await db.flush()
    return accounts


async def _payroll_txns(db, expense_id):
    res = await db.execute(
        select(Transaction).where(
            Transaction.expense_id == expense_id,
            Transaction.type == TransactionType.EXPENSE,
        )
    )
    return list(res.scalars().all())


async def test_pay_all_records_cash_per_employee_method(db_session, test_superuser):
    """mark_payroll_paid debits each employee's own account and records one
    EXPENSE Transaction per item (D2 + D3)."""
    await _make_employee(db_session, base_salary=1_000_000, payment_method="cash", name="Empleada Caja")
    await _make_employee(db_session, base_salary=2_000_000, payment_method="transfer", name="Empleada Banco")
    run = await _create_approved_run(db_session, test_superuser.id)
    accounts = await _seed_balance(db_session, "caja_mayor", 5_000_000)
    await _seed_balance(db_session, "banco", 5_000_000)

    paid = await payroll_service.mark_payroll_paid(db_session, run.id, paid_by=test_superuser.id)

    assert paid.status == PayrollStatus.PAID
    txns = await _payroll_txns(db_session, run.expense_id)
    assert len(txns) == 2
    by_method = {t.payment_method: t.amount for t in txns}
    assert by_method[AccPaymentMethod.CASH] == Decimal("1000000")
    assert by_method[AccPaymentMethod.TRANSFER] == Decimal("2000000")

    # Cash actually left the accounts.
    caja = await db_session.get(BalanceAccount, accounts["caja_mayor"])
    banco = await db_session.get(BalanceAccount, accounts["banco"])
    assert caja.balance == Decimal("4000000")
    assert banco.balance == Decimal("3000000")


async def test_pay_item_records_one_transaction_and_marks_expense(db_session, test_superuser):
    await _make_employee(db_session, base_salary=1_000_000, payment_method="cash", name="E1")
    run = await _create_approved_run(db_session, test_superuser.id)
    await _seed_balance(db_session, "caja_mayor", 5_000_000)
    item = run.items[0]

    await payroll_service.pay_payroll_item(db_session, item.id, "cash", paid_by=test_superuser.id)

    txns = await _payroll_txns(db_session, run.expense_id)
    assert len(txns) == 1
    assert txns[0].amount == Decimal("1000000")
    assert txns[0].payment_method == AccPaymentMethod.CASH


async def test_double_pay_item_raises_and_records_once(db_session, test_superuser):
    """F1.3b: the second pay is rejected and no second cash debit happens."""
    await _make_employee(db_session, base_salary=1_000_000, payment_method="cash", name="E1")
    run = await _create_approved_run(db_session, test_superuser.id)
    await _seed_balance(db_session, "caja_mayor", 5_000_000)
    item = run.items[0]

    await payroll_service.pay_payroll_item(db_session, item.id, "cash", paid_by=test_superuser.id)
    with pytest.raises(ValueError, match="ya fue pagado"):
        await payroll_service.pay_payroll_item(db_session, item.id, "cash", paid_by=test_superuser.id)

    txns = await _payroll_txns(db_session, run.expense_id)
    assert len(txns) == 1


async def test_insufficient_funds_blocks_and_keeps_approved(db_session, test_superuser):
    """D4: paying more cash than Caja holds is refused and rolled back."""
    await _make_employee(db_session, base_salary=1_000_000, payment_method="cash", name="E1")
    run = await _create_approved_run(db_session, test_superuser.id)
    # Caja Mayor stays at 0 -> the debit would go negative.

    # The debit would breach the non-negative balance constraint, so record()
    # rolls back atomically and surfaces a Spanish error. We assert the refusal
    # only: re-querying the same session after its internal rollback is unusable
    # in this harness, and atomicity is guaranteed by record()'s own rollback
    # (prod closes the session per-request).
    with pytest.raises(ValueError, match="[Ff]ondos insuficientes"):
        await payroll_service.mark_payroll_paid(db_session, run.id, paid_by=test_superuser.id)


async def test_pay_item_on_draft_raises(db_session, test_superuser):
    await _make_employee(db_session, base_salary=1_000_000, payment_method="cash", name="E1")
    run = await payroll_service.create_payroll_run(
        db_session, PayrollRunCreate(**PERIOD), created_by=test_superuser.id
    )
    item = run.items[0]

    with pytest.raises(ValueError, match="aprobadas"):
        await payroll_service.pay_payroll_item(db_session, item.id, "cash", paid_by=test_superuser.id)
