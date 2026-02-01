"""
Unit tests for PayrollService.

Tests cover business logic for payroll management including
payroll run creation, approval, payment, and cancellation.
"""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import date, datetime, timedelta
from decimal import Decimal
from uuid import uuid4

from app.models.payroll import Employee, PayrollRun, PayrollItem, PayrollStatus, PaymentFrequency
from app.services.payroll_service import PayrollService, payroll_service
from app.schemas.payroll import PayrollRunCreate, PayrollRunUpdate


@pytest.fixture
def mock_db_session():
    """Create a mock async database session."""
    session = AsyncMock()
    session.add = MagicMock()
    session.flush = AsyncMock()
    session.refresh = AsyncMock()
    session.commit = AsyncMock()
    session.execute = AsyncMock()
    return session


@pytest.fixture
def payroll_service_instance():
    """Create a fresh PayrollService instance for testing."""
    return PayrollService()


@pytest.mark.asyncio
async def test_create_payroll_run_initializes_draft(mock_db_session, payroll_service_instance):
    """Test that creating a payroll run starts in draft status."""
    create_data = PayrollRunCreate(
        period_start=date.today() - timedelta(days=15),
        period_end=date.today()
    )

    mock_employees = [
        MagicMock(
            spec=Employee,
            id=uuid4(),
            is_active=True,
            base_salary=Decimal("1500000")
        )
    ]

    # Mock employee_service and attendance_service
    with patch('app.services.payroll_service.employee_service') as mock_emp_service, \
         patch('app.services.payroll_service.attendance_service') as mock_att_service:
        mock_emp_service.get_employees = AsyncMock(return_value=mock_employees)
        mock_emp_service.calculate_employee_totals = AsyncMock(return_value={
            "base_salary": Decimal("1500000"),
            "total_bonuses": Decimal("100000"),
            "total_deductions": Decimal("120000"),
            "net_amount": Decimal("1480000"),
            "bonus_breakdown": [],
            "deduction_breakdown": []
        })
        mock_att_service.get_deductible_absences = AsyncMock(return_value=[])

        result = await payroll_service_instance.create_payroll_run(
            mock_db_session,
            create_data,
            created_by=uuid4()
        )

    mock_db_session.add.assert_called()
    added_run = mock_db_session.add.call_args_list[0][0][0]

    assert added_run.status == PayrollStatus.DRAFT


@pytest.mark.asyncio
async def test_create_payroll_run_validates_dates(mock_db_session, payroll_service_instance):
    """Test that payroll run rejects invalid date range."""
    create_data = PayrollRunCreate(
        period_start=date.today(),
        period_end=date.today() - timedelta(days=15)  # End before start
    )

    with pytest.raises(ValueError, match="fecha de fin"):
        await payroll_service_instance.create_payroll_run(
            mock_db_session,
            create_data,
            created_by=uuid4()
        )


@pytest.mark.asyncio
async def test_approve_payroll_changes_status(mock_db_session, payroll_service_instance):
    """Test that approving a payroll run changes status to approved."""
    mock_run = MagicMock(spec=PayrollRun)
    mock_run.id = uuid4()
    mock_run.status = PayrollStatus.DRAFT
    mock_run.period_start = date.today() - timedelta(days=15)
    mock_run.period_end = date.today()
    mock_run.total_net = Decimal("1480000")
    mock_run.payment_date = None
    mock_run.items = []

    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = mock_run
    mock_db_session.execute.return_value = mock_result

    result = await payroll_service_instance.approve_payroll_run(
        mock_db_session,
        mock_run.id,
        approved_by=uuid4()
    )

    assert mock_run.status == PayrollStatus.APPROVED


@pytest.mark.asyncio
async def test_approve_payroll_only_draft_allowed(mock_db_session, payroll_service_instance):
    """Test that only draft payroll can be approved."""
    mock_run = MagicMock(spec=PayrollRun)
    mock_run.id = uuid4()
    mock_run.status = PayrollStatus.PAID  # Not draft
    mock_run.items = []

    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = mock_run
    mock_db_session.execute.return_value = mock_result

    with pytest.raises(ValueError, match="borrador"):
        await payroll_service_instance.approve_payroll_run(
            mock_db_session,
            mock_run.id,
            approved_by=uuid4()
        )


@pytest.mark.asyncio
async def test_pay_payroll_item_marks_as_paid(mock_db_session, payroll_service_instance):
    """Test that paying a payroll item marks it as paid."""
    mock_item = MagicMock(spec=PayrollItem)
    mock_item.id = uuid4()
    mock_item.is_paid = False
    mock_item.paid_at = None
    mock_item.payment_method = None
    mock_item.payroll_run_id = uuid4()

    mock_run = MagicMock(spec=PayrollRun)
    mock_run.status = PayrollStatus.APPROVED
    mock_run.items = [mock_item]

    # First call returns item, second returns payroll run
    item_result = MagicMock()
    item_result.scalar_one_or_none.return_value = mock_item

    run_result = MagicMock()
    run_result.scalar_one_or_none.return_value = mock_run

    mock_db_session.execute.side_effect = [item_result, run_result]

    result = await payroll_service_instance.pay_payroll_item(
        mock_db_session,
        mock_item.id,
        "transfer"
    )

    assert mock_item.is_paid is True
    assert mock_item.payment_method == "transfer"


@pytest.mark.asyncio
async def test_pay_item_requires_approved_payroll(mock_db_session, payroll_service_instance):
    """Test that item can only be paid if payroll is approved."""
    mock_item = MagicMock(spec=PayrollItem)
    mock_item.id = uuid4()
    mock_item.is_paid = False
    mock_item.payroll_run_id = uuid4()

    mock_run = MagicMock(spec=PayrollRun)
    mock_run.status = PayrollStatus.DRAFT  # Not approved yet
    mock_run.items = [mock_item]

    item_result = MagicMock()
    item_result.scalar_one_or_none.return_value = mock_item

    run_result = MagicMock()
    run_result.scalar_one_or_none.return_value = mock_run

    mock_db_session.execute.side_effect = [item_result, run_result]

    with pytest.raises(ValueError, match="aprobadas"):
        await payroll_service_instance.pay_payroll_item(
            mock_db_session,
            mock_item.id,
            "cash"
        )


@pytest.mark.asyncio
async def test_mark_payroll_paid_marks_all_items(mock_db_session, payroll_service_instance):
    """Test that mark_payroll_paid marks all items as paid."""
    mock_item1 = MagicMock(spec=PayrollItem)
    mock_item1.is_paid = False
    mock_item1.paid_at = None

    mock_item2 = MagicMock(spec=PayrollItem)
    mock_item2.is_paid = False
    mock_item2.paid_at = None

    mock_run = MagicMock(spec=PayrollRun)
    mock_run.id = uuid4()
    mock_run.status = PayrollStatus.APPROVED
    mock_run.items = [mock_item1, mock_item2]

    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = mock_run
    mock_db_session.execute.return_value = mock_result

    result = await payroll_service_instance.mark_payroll_paid(
        mock_db_session,
        mock_run.id
    )

    assert mock_item1.is_paid is True
    assert mock_item2.is_paid is True
    assert mock_run.status == PayrollStatus.PAID


@pytest.mark.asyncio
async def test_mark_payroll_paid_requires_approved(mock_db_session, payroll_service_instance):
    """Test that mark_payroll_paid requires approved status."""
    mock_run = MagicMock(spec=PayrollRun)
    mock_run.id = uuid4()
    mock_run.status = PayrollStatus.DRAFT
    mock_run.items = []

    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = mock_run
    mock_db_session.execute.return_value = mock_result

    with pytest.raises(ValueError, match="aprobadas"):
        await payroll_service_instance.mark_payroll_paid(
            mock_db_session,
            mock_run.id
        )


@pytest.mark.asyncio
async def test_cancel_payroll_run(mock_db_session, payroll_service_instance):
    """Test that cancelling a payroll run changes status."""
    mock_run = MagicMock(spec=PayrollRun)
    mock_run.id = uuid4()
    mock_run.status = PayrollStatus.DRAFT
    mock_run.expense_id = None
    mock_run.items = []

    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = mock_run
    mock_db_session.execute.return_value = mock_result

    result = await payroll_service_instance.cancel_payroll_run(
        mock_db_session,
        mock_run.id
    )

    assert mock_run.status == PayrollStatus.CANCELLED


@pytest.mark.asyncio
async def test_cannot_cancel_paid_payroll(mock_db_session, payroll_service_instance):
    """Test that a paid payroll run cannot be cancelled."""
    mock_run = MagicMock(spec=PayrollRun)
    mock_run.id = uuid4()
    mock_run.status = PayrollStatus.PAID
    mock_run.items = []

    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = mock_run
    mock_db_session.execute.return_value = mock_result

    with pytest.raises(ValueError, match="pagadas"):
        await payroll_service_instance.cancel_payroll_run(
            mock_db_session,
            mock_run.id
        )


@pytest.mark.asyncio
async def test_get_payroll_summary(mock_db_session, payroll_service_instance):
    """Test that payroll summary returns correct data."""
    mock_employees = [
        MagicMock(spec=Employee, id=uuid4()),
        MagicMock(spec=Employee, id=uuid4()),
    ]

    # Mock pending payroll runs
    mock_pending = [MagicMock(spec=PayrollRun)]

    # Mock last paid payroll
    mock_last_paid = MagicMock(spec=PayrollRun)
    mock_last_paid.period_end = date.today() - timedelta(days=30)

    with patch('app.services.payroll_service.employee_service') as mock_emp_service:
        mock_emp_service.get_employees = AsyncMock(return_value=mock_employees)
        mock_emp_service.calculate_employee_totals = AsyncMock(return_value={
            "base_salary": Decimal("1500000"),
            "total_bonuses": Decimal("100000"),
            "total_deductions": Decimal("120000"),
            "net_amount": Decimal("1480000"),
            "bonus_breakdown": [],
            "deduction_breakdown": []
        })

        # Mock pending runs query
        pending_result = MagicMock()
        pending_result.scalars.return_value.all.return_value = mock_pending

        # Mock last paid query
        last_paid_result = MagicMock()
        last_paid_result.scalar_one_or_none.return_value = mock_last_paid

        # Mock fixed expense query (get_payroll_fixed_expense)
        fixed_expense_result = MagicMock()
        fixed_expense_result.scalar_one_or_none.return_value = None

        mock_db_session.execute.side_effect = [pending_result, last_paid_result, fixed_expense_result]

        result = await payroll_service_instance.get_payroll_summary(mock_db_session)

    assert result["active_employees"] == 2
    assert result["pending_payroll_runs"] == 1
    assert result["last_payroll_date"] == mock_last_paid.period_end


@pytest.mark.asyncio
async def test_update_payroll_run_only_draft(mock_db_session, payroll_service_instance):
    """Test that only draft payroll runs can be updated."""
    mock_run = MagicMock(spec=PayrollRun)
    mock_run.id = uuid4()
    mock_run.status = PayrollStatus.APPROVED  # Not draft
    mock_run.items = []

    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = mock_run
    mock_db_session.execute.return_value = mock_result

    update_data = PayrollRunUpdate(notes="Updated notes")

    with pytest.raises(ValueError, match="borrador"):
        await payroll_service_instance.update_payroll_run(
            mock_db_session,
            mock_run.id,
            update_data
        )


@pytest.mark.asyncio
async def test_get_payroll_run_not_found(mock_db_session, payroll_service_instance):
    """Test that non-existent payroll returns None."""
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = None
    mock_db_session.execute.return_value = mock_result

    result = await payroll_service_instance.get_payroll_run(mock_db_session, uuid4())

    assert result is None
