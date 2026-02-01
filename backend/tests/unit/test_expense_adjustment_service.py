"""
Unit Tests for Expense Adjustment Service

Tests for:
- ExpenseAdjustmentService: Expense rollbacks, corrections, and reversals
"""
import pytest
from decimal import Decimal
from uuid import uuid4
from datetime import date
from unittest.mock import AsyncMock, MagicMock, patch

from app.services.expense_adjustment import ExpenseAdjustmentService
from app.models.accounting import (
    Expense, ExpenseAdjustment, AdjustmentReason,
    BalanceAccount, BalanceEntry, ExpenseCategory, AccPaymentMethod
)

pytestmark = pytest.mark.unit


# ============================================================================
# FIXTURES
# ============================================================================

@pytest.fixture
def mock_db_session():
    """Create a mock async database session."""
    session = AsyncMock()
    session.execute = AsyncMock()
    session.add = MagicMock()
    session.flush = AsyncMock()
    session.refresh = AsyncMock()
    return session


@pytest.fixture
def sample_expense():
    """Create a sample paid expense for testing."""
    expense_id = uuid4()
    account_id = uuid4()
    return MagicMock(
        id=expense_id,
        description="Test Expense",
        amount=Decimal("100000"),
        amount_paid=Decimal("100000"),
        is_paid=True,
        is_active=True,
        payment_method="cash",
        payment_account_id=account_id,
        expense_date=date.today(),
        category=ExpenseCategory.SUPPLIES,
        paid_at=date.today()
    )


@pytest.fixture
def sample_unpaid_expense():
    """Create a sample unpaid expense for testing."""
    expense_id = uuid4()
    return MagicMock(
        id=expense_id,
        description="Unpaid Expense",
        amount=Decimal("50000"),
        amount_paid=Decimal("0"),
        is_paid=False,
        is_active=True,
        payment_method=None,
        payment_account_id=None,
        expense_date=date.today(),
        category=ExpenseCategory.UTILITIES
    )


@pytest.fixture
def sample_account():
    """Create a sample balance account for testing."""
    return MagicMock(
        id=uuid4(),
        name="Caja Menor",
        code="CAJA_MENOR",
        balance=Decimal("500000"),
        is_active=True
    )


@pytest.fixture
def sample_new_account():
    """Create a new account for account change tests."""
    return MagicMock(
        id=uuid4(),
        name="Caja Mayor",
        code="CAJA_MAYOR",
        balance=Decimal("1000000"),
        is_active=True
    )


# ============================================================================
# TEST: adjust_expense - Amount Changes
# ============================================================================

class TestAdjustExpenseAmount:
    """Tests for adjust_expense() with amount changes."""

    @pytest.mark.asyncio
    async def test_adjust_amount_increase(self, mock_db_session, sample_expense, sample_account):
        """Increasing expense amount should not change amount_paid."""
        # Setup
        service = ExpenseAdjustmentService(mock_db_session)

        # Mock get_expense_by_id
        mock_result = AsyncMock()
        mock_result.scalar_one_or_none = MagicMock(return_value=sample_expense)
        mock_db_session.execute.return_value = mock_result

        # Patch get_account_by_id to return account
        with patch.object(service, 'get_account_by_id', return_value=sample_account):
            # Act
            result = await service.adjust_expense(
                expense_id=sample_expense.id,
                new_amount=Decimal("120000"),  # Increase
                description="Corrección: se olvidó incluir impuestos"
            )

        # Assert
        assert sample_expense.amount == Decimal("120000")
        assert sample_expense.amount_paid == Decimal("100000")  # Unchanged
        assert sample_expense.is_paid == False  # Now has balance

    @pytest.mark.asyncio
    async def test_adjust_amount_decrease_with_refund(self, mock_db_session, sample_expense, sample_account):
        """Decreasing expense amount below amount_paid should refund difference."""
        # Setup
        service = ExpenseAdjustmentService(mock_db_session)

        mock_result = AsyncMock()
        mock_result.scalar_one_or_none = MagicMock(return_value=sample_expense)
        mock_db_session.execute.return_value = mock_result

        with patch.object(service, 'get_account_by_id', return_value=sample_account):
            # Act
            result = await service.adjust_expense(
                expense_id=sample_expense.id,
                new_amount=Decimal("80000"),  # Decrease
                description="Corrección: descuento no aplicado"
            )

        # Assert
        assert sample_expense.amount == Decimal("80000")
        assert sample_expense.amount_paid == Decimal("80000")
        assert sample_expense.is_paid == True
        # Refund entry should be created
        assert mock_db_session.add.called

    @pytest.mark.asyncio
    async def test_adjust_unpaid_expense_fails(self, mock_db_session, sample_unpaid_expense):
        """Should raise error when trying to adjust unpaid expense."""
        # Setup
        service = ExpenseAdjustmentService(mock_db_session)

        mock_result = AsyncMock()
        mock_result.scalar_one_or_none = MagicMock(return_value=sample_unpaid_expense)
        mock_db_session.execute.return_value = mock_result

        # Act & Assert
        with pytest.raises(ValueError, match="no ha sido pagado"):
            await service.adjust_expense(
                expense_id=sample_unpaid_expense.id,
                new_amount=Decimal("30000"),
                description="Intento de ajuste"
            )

    @pytest.mark.asyncio
    async def test_adjust_nonexistent_expense_fails(self, mock_db_session):
        """Should raise error when expense doesn't exist."""
        # Setup
        service = ExpenseAdjustmentService(mock_db_session)

        mock_result = AsyncMock()
        mock_result.scalar_one_or_none = MagicMock(return_value=None)
        mock_db_session.execute.return_value = mock_result

        # Act & Assert
        with pytest.raises(ValueError, match="no encontrado"):
            await service.adjust_expense(
                expense_id=uuid4(),
                new_amount=Decimal("30000"),
                description="Intento de ajuste"
            )

    @pytest.mark.asyncio
    async def test_adjust_no_changes_fails(self, mock_db_session, sample_expense):
        """Should raise error when no actual changes are made."""
        # Setup
        service = ExpenseAdjustmentService(mock_db_session)

        mock_result = AsyncMock()
        mock_result.scalar_one_or_none = MagicMock(return_value=sample_expense)
        mock_db_session.execute.return_value = mock_result

        # Act & Assert
        with pytest.raises(ValueError, match="nuevo monto o una nueva cuenta"):
            await service.adjust_expense(
                expense_id=sample_expense.id,
                new_amount=sample_expense.amount,  # Same as current
                description="Sin cambios"
            )


# ============================================================================
# TEST: adjust_expense - Account Changes
# ============================================================================

class TestAdjustExpenseAccount:
    """Tests for adjust_expense() with account changes."""

    @pytest.mark.asyncio
    async def test_adjust_account_success(
        self, mock_db_session, sample_expense, sample_account, sample_new_account
    ):
        """Changing payment account should refund old and deduct from new."""
        # Setup
        service = ExpenseAdjustmentService(mock_db_session)

        mock_result = AsyncMock()
        mock_result.scalar_one_or_none = MagicMock(return_value=sample_expense)
        mock_db_session.execute.return_value = mock_result

        original_old_balance = sample_account.balance
        original_new_balance = sample_new_account.balance

        async def mock_get_account(account_id):
            if account_id == sample_expense.payment_account_id:
                return sample_account
            return sample_new_account

        with patch.object(service, 'get_account_by_id', side_effect=mock_get_account):
            # Act
            result = await service.adjust_expense(
                expense_id=sample_expense.id,
                new_payment_account_id=sample_new_account.id,
                description="Cambio de cuenta de pago"
            )

        # Assert - old account gets refund
        assert sample_account.balance == original_old_balance + sample_expense.amount_paid
        # Assert - new account gets deduction
        assert sample_new_account.balance == original_new_balance - sample_expense.amount_paid
        # Assert - expense updated
        assert sample_expense.payment_account_id == sample_new_account.id

    @pytest.mark.asyncio
    async def test_adjust_account_insufficient_funds_fails(
        self, mock_db_session, sample_expense, sample_account, sample_new_account
    ):
        """Should fail if new account has insufficient funds."""
        # Setup
        service = ExpenseAdjustmentService(mock_db_session)
        sample_new_account.balance = Decimal("10000")  # Less than needed

        mock_result = AsyncMock()
        mock_result.scalar_one_or_none = MagicMock(return_value=sample_expense)
        mock_db_session.execute.return_value = mock_result

        async def mock_get_account(account_id):
            if account_id == sample_expense.payment_account_id:
                return sample_account
            return sample_new_account

        with patch.object(service, 'get_account_by_id', side_effect=mock_get_account):
            # Act & Assert
            with pytest.raises(ValueError, match="Fondos insuficientes"):
                await service.adjust_expense(
                    expense_id=sample_expense.id,
                    new_payment_account_id=sample_new_account.id,
                    description="Cambio de cuenta de pago"
                )


# ============================================================================
# TEST: revert_expense_payment
# ============================================================================

class TestRevertPayment:
    """Tests for revert_expense_payment()."""

    @pytest.mark.asyncio
    async def test_revert_full_payment(self, mock_db_session, sample_expense, sample_account):
        """Reverting should return full payment to original account."""
        # Setup
        service = ExpenseAdjustmentService(mock_db_session)
        original_balance = sample_account.balance
        original_amount_paid = sample_expense.amount_paid  # Store before revert

        mock_result = AsyncMock()
        mock_result.scalar_one_or_none = MagicMock(return_value=sample_expense)
        mock_db_session.execute.return_value = mock_result

        with patch.object(service, 'get_account_by_id', return_value=sample_account):
            # Act
            result = await service.revert_expense_payment(
                expense_id=sample_expense.id,
                description="Error en el registro, no se realizó el pago"
            )

        # Assert - account balance increased by original payment
        assert sample_account.balance == original_balance + original_amount_paid
        # Expense payment fields are cleared
        assert sample_expense.amount_paid == Decimal("0")
        assert sample_expense.is_paid == False
        assert sample_expense.payment_method is None
        assert sample_expense.payment_account_id is None
        assert sample_expense.paid_at is None

    @pytest.mark.asyncio
    async def test_revert_unpaid_expense_fails(self, mock_db_session, sample_unpaid_expense):
        """Should raise error when trying to revert unpaid expense."""
        # Setup
        service = ExpenseAdjustmentService(mock_db_session)

        mock_result = AsyncMock()
        mock_result.scalar_one_or_none = MagicMock(return_value=sample_unpaid_expense)
        mock_db_session.execute.return_value = mock_result

        # Act & Assert
        with pytest.raises(ValueError, match="no ha sido pagado"):
            await service.revert_expense_payment(
                expense_id=sample_unpaid_expense.id,
                description="Intento de reversión"
            )


# ============================================================================
# TEST: partial_refund
# ============================================================================

class TestPartialRefund:
    """Tests for partial_refund()."""

    @pytest.mark.asyncio
    async def test_partial_refund_success(self, mock_db_session, sample_expense, sample_account):
        """Partial refund should reduce amount_paid and return to account."""
        # Setup
        service = ExpenseAdjustmentService(mock_db_session)
        original_balance = sample_account.balance
        refund_amount = Decimal("30000")

        mock_result = AsyncMock()
        mock_result.scalar_one_or_none = MagicMock(return_value=sample_expense)
        mock_db_session.execute.return_value = mock_result

        with patch.object(service, 'get_account_by_id', return_value=sample_account):
            # Act
            result = await service.partial_refund(
                expense_id=sample_expense.id,
                refund_amount=refund_amount,
                description="Devolución parcial por producto defectuoso"
            )

        # Assert
        assert sample_account.balance == original_balance + refund_amount
        assert sample_expense.amount_paid == Decimal("70000")  # 100000 - 30000
        assert sample_expense.is_paid == False  # Now has balance

    @pytest.mark.asyncio
    async def test_refund_exceeds_paid_fails(self, mock_db_session, sample_expense):
        """Should fail if refund amount exceeds amount_paid."""
        # Setup
        service = ExpenseAdjustmentService(mock_db_session)

        mock_result = AsyncMock()
        mock_result.scalar_one_or_none = MagicMock(return_value=sample_expense)
        mock_db_session.execute.return_value = mock_result

        # Act & Assert
        with pytest.raises(ValueError, match="excede"):
            await service.partial_refund(
                expense_id=sample_expense.id,
                refund_amount=Decimal("150000"),  # More than paid
                description="Reembolso excesivo"
            )

    @pytest.mark.asyncio
    async def test_refund_zero_amount_fails(self, mock_db_session, sample_expense):
        """Should fail if refund amount is zero or negative."""
        # Setup
        service = ExpenseAdjustmentService(mock_db_session)

        mock_result = AsyncMock()
        mock_result.scalar_one_or_none = MagicMock(return_value=sample_expense)
        mock_db_session.execute.return_value = mock_result

        # Act & Assert
        with pytest.raises(ValueError, match="positivo"):
            await service.partial_refund(
                expense_id=sample_expense.id,
                refund_amount=Decimal("0"),
                description="Reembolso cero"
            )


# ============================================================================
# TEST: get_adjustment_history
# ============================================================================

class TestGetAdjustmentHistory:
    """Tests for get_adjustment_history()."""

    @pytest.mark.asyncio
    async def test_get_history_returns_ordered(self, mock_db_session):
        """History should be returned ordered by date descending."""
        # Setup
        service = ExpenseAdjustmentService(mock_db_session)
        expense_id = uuid4()

        mock_adjustments = [
            MagicMock(id=uuid4(), expense_id=expense_id, reason=AdjustmentReason.AMOUNT_CORRECTION),
            MagicMock(id=uuid4(), expense_id=expense_id, reason=AdjustmentReason.PARTIAL_REFUND),
        ]

        mock_result = AsyncMock()
        mock_result.scalars = MagicMock(return_value=MagicMock(all=MagicMock(return_value=mock_adjustments)))
        mock_db_session.execute.return_value = mock_result

        # Act
        result = await service.get_adjustment_history(expense_id)

        # Assert
        assert len(result) == 2
        assert mock_db_session.execute.called

    @pytest.mark.asyncio
    async def test_get_history_empty(self, mock_db_session):
        """Should return empty list if no adjustments exist."""
        # Setup
        service = ExpenseAdjustmentService(mock_db_session)
        expense_id = uuid4()

        mock_result = AsyncMock()
        mock_result.scalars = MagicMock(return_value=MagicMock(all=MagicMock(return_value=[])))
        mock_db_session.execute.return_value = mock_result

        # Act
        result = await service.get_adjustment_history(expense_id)

        # Assert
        assert result == []


# ============================================================================
# TEST: AdjustmentReason Enum
# ============================================================================

class TestAdjustmentReasonEnum:
    """Tests for AdjustmentReason enum values."""

    def test_all_reasons_exist(self):
        """All expected reasons should be defined."""
        expected_reasons = [
            'amount_correction',
            'account_correction',
            'both_correction',
            'error_reversal',
            'partial_refund'
        ]

        actual_reasons = [r.value for r in AdjustmentReason]

        for reason in expected_reasons:
            assert reason in actual_reasons

    def test_reason_values_are_strings(self):
        """All reason values should be strings."""
        for reason in AdjustmentReason:
            assert isinstance(reason.value, str)
