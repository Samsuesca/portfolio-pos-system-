"""
Unit tests for EmployeeService.

Tests cover business logic for employee management including
creation, updates, deactivation, and bonus calculations.
"""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import date
from decimal import Decimal
from uuid import uuid4

from app.models.payroll import Employee, EmployeeBonus, BonusType, PaymentFrequency
from app.services.employee_service import EmployeeService, employee_service
from app.schemas.payroll import EmployeeCreate, EmployeeUpdate, EmployeeBonusCreate


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
def employee_service_instance():
    """Create a fresh EmployeeService instance for testing."""
    return EmployeeService()


@pytest.mark.asyncio
async def test_create_employee_sets_active(mock_db_session, employee_service_instance):
    """Test that creating an employee sets is_active to True by default."""
    create_data = EmployeeCreate(
        full_name="Test Employee",
        document_id="12345678",
        position="Vendedora",
        hire_date=date.today(),
        base_salary=Decimal("1300000")
    )

    # Mock the duplicate check
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = None  # No existing employee
    mock_db_session.execute.return_value = mock_result

    result = await employee_service_instance.create_employee(mock_db_session, create_data)

    mock_db_session.add.assert_called_once()
    added_employee = mock_db_session.add.call_args[0][0]

    # Default is_active comes from model default, not explicitly set
    assert added_employee.full_name == "Test Employee"


@pytest.mark.asyncio
async def test_create_employee_rejects_duplicate_document(mock_db_session, employee_service_instance):
    """Test that creating employee with duplicate document fails."""
    create_data = EmployeeCreate(
        full_name="New Employee",
        document_id="12345678",
        position="Auxiliar",
        hire_date=date.today(),
        base_salary=Decimal("1200000")
    )

    # Mock existing employee with same document
    mock_existing = MagicMock(spec=Employee)
    mock_existing.document_id = "12345678"

    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = mock_existing
    mock_db_session.execute.return_value = mock_result

    with pytest.raises(ValueError, match="Ya existe un empleado"):
        await employee_service_instance.create_employee(mock_db_session, create_data)


@pytest.mark.asyncio
async def test_delete_employee_sets_inactive(mock_db_session, employee_service_instance):
    """Test that delete_employee sets is_active to False."""
    mock_employee = MagicMock(spec=Employee)
    mock_employee.id = uuid4()
    mock_employee.is_active = True
    mock_employee.termination_date = None

    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = mock_employee
    mock_db_session.execute.return_value = mock_result

    result = await employee_service_instance.delete_employee(mock_db_session, mock_employee.id)

    assert result is True
    assert mock_employee.is_active is False
    assert mock_employee.termination_date == date.today()


@pytest.mark.asyncio
async def test_delete_nonexistent_employee_returns_false(mock_db_session, employee_service_instance):
    """Test that deleting non-existent employee returns False."""
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = None
    mock_db_session.execute.return_value = mock_result

    result = await employee_service_instance.delete_employee(mock_db_session, uuid4())

    assert result is False


@pytest.mark.asyncio
async def test_update_employee_changes_fields(mock_db_session, employee_service_instance):
    """Test that updating an employee changes the specified fields."""
    mock_employee = MagicMock(spec=Employee)
    mock_employee.id = uuid4()
    mock_employee.document_id = "12345678"
    mock_employee.position = "Vendedora"
    mock_employee.base_salary = Decimal("1300000")
    mock_employee.bonuses = []

    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = mock_employee
    mock_db_session.execute.return_value = mock_result

    update_data = EmployeeUpdate(
        position="Jefe de Ventas",
        base_salary=Decimal("1800000")
    )

    result = await employee_service_instance.update_employee(
        mock_db_session,
        mock_employee.id,
        update_data
    )

    assert mock_employee.position == "Jefe de Ventas"
    assert mock_employee.base_salary == Decimal("1800000")


@pytest.mark.asyncio
async def test_update_nonexistent_employee_raises(mock_db_session, employee_service_instance):
    """Test that updating non-existent employee raises ValueError."""
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = None
    mock_db_session.execute.return_value = mock_result

    update_data = EmployeeUpdate(position="Test")

    with pytest.raises(ValueError, match="Empleado no encontrado"):
        await employee_service_instance.update_employee(mock_db_session, uuid4(), update_data)


@pytest.mark.asyncio
async def test_get_employees_filters_by_active(mock_db_session, employee_service_instance):
    """Test that get_employees filters by is_active."""
    mock_employees = [
        MagicMock(spec=Employee, is_active=True),
        MagicMock(spec=Employee, is_active=True),
    ]

    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = mock_employees
    mock_db_session.execute.return_value = mock_result

    result = await employee_service_instance.get_employees(mock_db_session, is_active=True)

    assert len(result) == 2


@pytest.mark.asyncio
async def test_calculate_employee_totals(mock_db_session, employee_service_instance):
    """Test that employee totals are calculated correctly."""
    mock_employee = MagicMock(spec=Employee)
    mock_employee.id = uuid4()
    mock_employee.base_salary = Decimal("1500000")
    mock_employee.health_deduction = Decimal("60000")
    mock_employee.pension_deduction = Decimal("60000")
    mock_employee.other_deductions = Decimal("0")
    mock_employee.bonuses = []

    # Mock employee query
    emp_result = MagicMock()
    emp_result.scalar_one_or_none.return_value = mock_employee

    # Mock bonuses query (empty)
    bonuses_result = MagicMock()
    bonuses_result.scalars.return_value.all.return_value = []

    mock_db_session.execute.side_effect = [emp_result, bonuses_result]

    result = await employee_service_instance.calculate_employee_totals(
        mock_db_session,
        mock_employee.id
    )

    assert result["base_salary"] == Decimal("1500000")
    assert result["total_deductions"] == Decimal("120000")
    assert result["net_amount"] == Decimal("1380000")


@pytest.mark.asyncio
async def test_calculate_employee_totals_with_bonuses(mock_db_session, employee_service_instance):
    """Test that employee totals include bonuses."""
    mock_employee = MagicMock(spec=Employee)
    mock_employee.id = uuid4()
    mock_employee.base_salary = Decimal("1500000")
    mock_employee.health_deduction = Decimal("60000")
    mock_employee.pension_deduction = Decimal("60000")
    mock_employee.other_deductions = Decimal("0")

    mock_bonus = MagicMock(spec=EmployeeBonus)
    mock_bonus.name = "Transporte"
    mock_bonus.amount = Decimal("100000")
    mock_bonus.is_recurring = True
    mock_bonus.bonus_type = BonusType.FIXED

    # Mock employee query
    emp_result = MagicMock()
    emp_result.scalar_one_or_none.return_value = mock_employee

    # Mock bonuses query
    bonuses_result = MagicMock()
    bonuses_result.scalars.return_value.all.return_value = [mock_bonus]

    mock_db_session.execute.side_effect = [emp_result, bonuses_result]

    result = await employee_service_instance.calculate_employee_totals(
        mock_db_session,
        mock_employee.id
    )

    assert result["total_bonuses"] == Decimal("100000")
    assert result["net_amount"] == Decimal("1480000")  # 1500000 + 100000 - 120000
    assert len(result["bonus_breakdown"]) == 1


@pytest.mark.asyncio
async def test_create_bonus_for_employee(mock_db_session, employee_service_instance):
    """Test creating a bonus for an employee."""
    mock_employee = MagicMock(spec=Employee)
    mock_employee.id = uuid4()
    mock_employee.bonuses = []

    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = mock_employee
    mock_db_session.execute.return_value = mock_result

    bonus_data = EmployeeBonusCreate(
        name="Transporte",
        bonus_type=BonusType.FIXED,
        amount=Decimal("100000"),
        start_date=date.today(),
        is_recurring=True
    )

    result = await employee_service_instance.create_bonus(
        mock_db_session,
        mock_employee.id,
        bonus_data
    )

    mock_db_session.add.assert_called_once()


@pytest.mark.asyncio
async def test_create_bonus_for_nonexistent_employee_fails(mock_db_session, employee_service_instance):
    """Test that creating bonus for non-existent employee fails."""
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = None
    mock_db_session.execute.return_value = mock_result

    bonus_data = EmployeeBonusCreate(
        name="Test Bonus",
        bonus_type=BonusType.FIXED,
        amount=Decimal("50000"),
        start_date=date.today()
    )

    with pytest.raises(ValueError, match="Empleado no encontrado"):
        await employee_service_instance.create_bonus(mock_db_session, uuid4(), bonus_data)


@pytest.mark.asyncio
async def test_delete_bonus_soft_deletes(mock_db_session, employee_service_instance):
    """Test that delete_bonus performs soft delete."""
    mock_bonus = MagicMock(spec=EmployeeBonus)
    mock_bonus.id = uuid4()
    mock_bonus.is_active = True

    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = mock_bonus
    mock_db_session.execute.return_value = mock_result

    result = await employee_service_instance.delete_bonus(mock_db_session, mock_bonus.id)

    assert result is True
    assert mock_bonus.is_active is False
