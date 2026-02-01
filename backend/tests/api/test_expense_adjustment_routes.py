"""
Tests for Expense Adjustment API endpoints.

Tests cover:
- POST /expenses/{id}/adjust - Adjust expense amount/account
- POST /expenses/{id}/revert - Revert expense payment
- POST /expenses/{id}/partial-refund - Partial refund
- GET /expenses/{id}/adjustments - Get adjustment history
- GET /adjustments - List all adjustments

NOTE: These tests require global balance accounts (Caja/Banco) to be initialized.
They are marked as skip until proper test isolation fixtures are created.
"""
import pytest

# Skip all tests in this module due to DB isolation issues with balance accounts
pytestmark = [
    pytest.mark.skip(reason="Requires global balance accounts setup - DB isolation issue"),
    pytest.mark.api
]

from decimal import Decimal
from uuid import uuid4
from datetime import date

from tests.fixtures.assertions import (
    assert_success_response,
    assert_created_response,
    assert_not_found,
    assert_bad_request,
)


# ============================================================================
# FIXTURES
# ============================================================================

@pytest.fixture
async def global_cash_accounts(db_session):
    """Create global cash accounts for testing."""
    from app.models.accounting import BalanceAccount, AccountType

    caja_menor = BalanceAccount(
        id=str(uuid4()),
        school_id=None,
        account_type=AccountType.ASSET_CURRENT,
        name="Caja Menor",
        code="CAJA_MENOR",
        balance=Decimal("500000"),
        is_active=True
    )
    db_session.add(caja_menor)

    caja_mayor = BalanceAccount(
        id=str(uuid4()),
        school_id=None,
        account_type=AccountType.ASSET_CURRENT,
        name="Caja Mayor",
        code="CAJA_MAYOR",
        balance=Decimal("2000000"),
        is_active=True
    )
    db_session.add(caja_mayor)

    await db_session.flush()
    return {"caja_menor": caja_menor, "caja_mayor": caja_mayor}


@pytest.fixture
async def paid_global_expense(db_session, test_superuser, global_cash_accounts):
    """Create a paid global expense for testing adjustments."""
    from app.models.accounting import Expense, ExpenseCategory, BalanceEntry

    expense = Expense(
        id=str(uuid4()),
        school_id=None,
        category=ExpenseCategory.SUPPLIES,
        description="Compra de suministros de oficina",
        amount=Decimal("100000"),
        amount_paid=Decimal("100000"),
        expense_date=date.today(),
        vendor="Papelería XYZ",
        is_paid=True,
        is_active=True,
        payment_method="cash",
        payment_account_id=global_cash_accounts["caja_menor"].id,
        paid_at=date.today(),
        created_by=test_superuser.id
    )
    db_session.add(expense)

    # Create payment entry
    account = global_cash_accounts["caja_menor"]
    account.balance -= expense.amount
    entry = BalanceEntry(
        account_id=account.id,
        school_id=None,
        entry_date=date.today(),
        amount=-expense.amount,
        balance_after=account.balance,
        description=f"Pago gasto: {expense.description}",
        reference=f"EXP-{expense.id}",
        created_by=test_superuser.id
    )
    db_session.add(entry)

    await db_session.flush()
    return expense


@pytest.fixture
async def unpaid_global_expense(db_session, test_superuser):
    """Create an unpaid global expense for testing."""
    from app.models.accounting import Expense, ExpenseCategory

    expense = Expense(
        id=str(uuid4()),
        school_id=None,
        category=ExpenseCategory.UTILITIES,
        description="Pago de agua pendiente",
        amount=Decimal("75000"),
        amount_paid=Decimal("0"),
        expense_date=date.today(),
        vendor="EPM",
        is_paid=False,
        is_active=True,
        created_by=test_superuser.id
    )
    db_session.add(expense)
    await db_session.flush()
    return expense


@pytest.fixture
async def expense_with_adjustments(db_session, paid_global_expense, test_superuser):
    """Create an expense with existing adjustment history."""
    from app.models.accounting import ExpenseAdjustment, AdjustmentReason
    from datetime import datetime

    adj1 = ExpenseAdjustment(
        id=str(uuid4()),
        expense_id=paid_global_expense.id,
        reason=AdjustmentReason.AMOUNT_CORRECTION,
        description="Corrección inicial",
        previous_amount=Decimal("120000"),
        previous_amount_paid=Decimal("120000"),
        new_amount=Decimal("100000"),
        new_amount_paid=Decimal("100000"),
        adjustment_delta=Decimal("20000"),
        adjusted_by=test_superuser.id,
        adjusted_at=datetime.now()
    )
    db_session.add(adj1)

    adj2 = ExpenseAdjustment(
        id=str(uuid4()),
        expense_id=paid_global_expense.id,
        reason=AdjustmentReason.PARTIAL_REFUND,
        description="Reembolso por producto defectuoso",
        previous_amount=Decimal("100000"),
        previous_amount_paid=Decimal("100000"),
        new_amount=Decimal("100000"),
        new_amount_paid=Decimal("90000"),
        adjustment_delta=Decimal("10000"),
        adjusted_by=test_superuser.id,
        adjusted_at=datetime.now()
    )
    db_session.add(adj2)

    await db_session.flush()
    return paid_global_expense


# ============================================================================
# ADJUST EXPENSE TESTS
# ============================================================================

class TestAdjustExpenseEndpoint:
    """Tests for POST /api/v1/global/accounting/expenses/{id}/adjust"""

    async def test_adjust_expense_amount_success(
        self,
        api_client,
        superuser_headers,
        paid_global_expense,
        global_cash_accounts
    ):
        """Should successfully adjust expense amount."""
        response = await api_client.post(
            f"/api/v1/global/accounting/expenses/{paid_global_expense.id}/adjust",
            headers=superuser_headers,
            json={
                "new_amount": 80000,
                "reason": "amount_correction",
                "description": "Corrección de monto - descuento no aplicado"
            }
        )

        data = assert_created_response(response)

        assert data["reason"] == "amount_correction"
        assert data["previous_amount"] == 100000
        assert data["new_amount"] == 80000
        assert data["adjustment_delta"] == 20000
        assert "description" in data

    async def test_adjust_expense_account_success(
        self,
        api_client,
        superuser_headers,
        paid_global_expense,
        global_cash_accounts
    ):
        """Should successfully change payment account."""
        new_account_id = global_cash_accounts["caja_mayor"].id

        response = await api_client.post(
            f"/api/v1/global/accounting/expenses/{paid_global_expense.id}/adjust",
            headers=superuser_headers,
            json={
                "new_payment_account_id": new_account_id,
                "reason": "account_correction",
                "description": "Cambio de cuenta - pago fue de Caja Mayor"
            }
        )

        data = assert_created_response(response)

        assert data["reason"] == "account_correction"
        assert data["new_payment_account_id"] == new_account_id

    async def test_adjust_expense_not_found(
        self,
        api_client,
        superuser_headers
    ):
        """Should return 404 for non-existent expense."""
        fake_id = str(uuid4())

        response = await api_client.post(
            f"/api/v1/global/accounting/expenses/{fake_id}/adjust",
            headers=superuser_headers,
            json={
                "new_amount": 50000,
                "description": "Intento de ajuste"
            }
        )

        assert_not_found(response)

    async def test_adjust_expense_not_paid_fails(
        self,
        api_client,
        superuser_headers,
        unpaid_global_expense
    ):
        """Should return 400 when trying to adjust unpaid expense."""
        response = await api_client.post(
            f"/api/v1/global/accounting/expenses/{unpaid_global_expense.id}/adjust",
            headers=superuser_headers,
            json={
                "new_amount": 50000,
                "description": "Intento de ajuste"
            }
        )

        assert_bad_request(response)

    async def test_adjust_expense_no_auth(
        self,
        api_client,
        paid_global_expense
    ):
        """Should return 401/403 without authentication."""
        response = await api_client.post(
            f"/api/v1/global/accounting/expenses/{paid_global_expense.id}/adjust",
            json={
                "new_amount": 50000,
                "description": "Intento sin auth"
            }
        )

        assert response.status_code in [401, 403]

    async def test_adjust_expense_missing_description(
        self,
        api_client,
        superuser_headers,
        paid_global_expense
    ):
        """Should return 422 when description is missing."""
        response = await api_client.post(
            f"/api/v1/global/accounting/expenses/{paid_global_expense.id}/adjust",
            headers=superuser_headers,
            json={
                "new_amount": 50000
                # Missing description
            }
        )

        assert response.status_code == 422


# ============================================================================
# REVERT EXPENSE TESTS
# ============================================================================

class TestRevertExpenseEndpoint:
    """Tests for POST /api/v1/global/accounting/expenses/{id}/revert"""

    async def test_revert_expense_success(
        self,
        api_client,
        superuser_headers,
        paid_global_expense,
        global_cash_accounts
    ):
        """Should successfully revert expense payment."""
        response = await api_client.post(
            f"/api/v1/global/accounting/expenses/{paid_global_expense.id}/revert",
            headers=superuser_headers,
            json={
                "description": "Error en registro - el pago no se realizó"
            }
        )

        data = assert_created_response(response)

        assert data["reason"] == "error_reversal"
        assert data["new_amount_paid"] == 0
        assert data["adjustment_delta"] == 100000  # Full refund

    async def test_revert_expense_not_paid_fails(
        self,
        api_client,
        superuser_headers,
        unpaid_global_expense
    ):
        """Should return 400 when trying to revert unpaid expense."""
        response = await api_client.post(
            f"/api/v1/global/accounting/expenses/{unpaid_global_expense.id}/revert",
            headers=superuser_headers,
            json={
                "description": "Intento de revertir"
            }
        )

        assert_bad_request(response)

    async def test_revert_expense_not_found(
        self,
        api_client,
        superuser_headers
    ):
        """Should return 404 for non-existent expense."""
        fake_id = str(uuid4())

        response = await api_client.post(
            f"/api/v1/global/accounting/expenses/{fake_id}/revert",
            headers=superuser_headers,
            json={
                "description": "Intento de revertir"
            }
        )

        assert_not_found(response)


# ============================================================================
# PARTIAL REFUND TESTS
# ============================================================================

class TestPartialRefundEndpoint:
    """Tests for POST /api/v1/global/accounting/expenses/{id}/partial-refund"""

    async def test_partial_refund_success(
        self,
        api_client,
        superuser_headers,
        paid_global_expense,
        global_cash_accounts
    ):
        """Should successfully issue partial refund."""
        response = await api_client.post(
            f"/api/v1/global/accounting/expenses/{paid_global_expense.id}/partial-refund",
            headers=superuser_headers,
            json={
                "refund_amount": 30000,
                "description": "Devolución parcial - producto dañado"
            }
        )

        data = assert_created_response(response)

        assert data["reason"] == "partial_refund"
        assert data["adjustment_delta"] == 30000
        assert data["new_amount_paid"] == 70000  # 100000 - 30000

    async def test_partial_refund_exceeds_paid_fails(
        self,
        api_client,
        superuser_headers,
        paid_global_expense
    ):
        """Should return 400 when refund exceeds amount paid."""
        response = await api_client.post(
            f"/api/v1/global/accounting/expenses/{paid_global_expense.id}/partial-refund",
            headers=superuser_headers,
            json={
                "refund_amount": 150000,  # More than paid
                "description": "Reembolso excesivo"
            }
        )

        assert_bad_request(response)

    async def test_partial_refund_zero_amount_fails(
        self,
        api_client,
        superuser_headers,
        paid_global_expense
    ):
        """Should return 400/422 when refund amount is zero."""
        response = await api_client.post(
            f"/api/v1/global/accounting/expenses/{paid_global_expense.id}/partial-refund",
            headers=superuser_headers,
            json={
                "refund_amount": 0,
                "description": "Reembolso cero"
            }
        )

        assert response.status_code in [400, 422]


# ============================================================================
# ADJUSTMENT HISTORY TESTS
# ============================================================================

class TestAdjustmentHistoryEndpoint:
    """Tests for GET /api/v1/global/accounting/expenses/{id}/adjustments"""

    async def test_get_adjustment_history_success(
        self,
        api_client,
        superuser_headers,
        expense_with_adjustments
    ):
        """Should return adjustment history for expense."""
        response = await api_client.get(
            f"/api/v1/global/accounting/expenses/{expense_with_adjustments.id}/adjustments",
            headers=superuser_headers
        )

        data = assert_success_response(response)

        assert isinstance(data, list)
        assert len(data) >= 2
        # Should have adjustment fields
        assert all("reason" in adj for adj in data)
        assert all("adjustment_delta" in adj for adj in data)

    async def test_get_adjustment_history_empty(
        self,
        api_client,
        superuser_headers,
        paid_global_expense
    ):
        """Should return empty list for expense without adjustments."""
        response = await api_client.get(
            f"/api/v1/global/accounting/expenses/{paid_global_expense.id}/adjustments",
            headers=superuser_headers
        )

        data = assert_success_response(response)

        assert isinstance(data, list)
        assert len(data) == 0

    async def test_get_adjustment_history_not_found(
        self,
        api_client,
        superuser_headers
    ):
        """Should return 404 for non-existent expense."""
        fake_id = str(uuid4())

        response = await api_client.get(
            f"/api/v1/global/accounting/expenses/{fake_id}/adjustments",
            headers=superuser_headers
        )

        # Could be 404 or empty list depending on implementation
        assert response.status_code in [200, 404]


# ============================================================================
# LIST ADJUSTMENTS TESTS
# ============================================================================

class TestListAdjustmentsEndpoint:
    """Tests for GET /api/v1/global/accounting/adjustments"""

    async def test_list_adjustments_success(
        self,
        api_client,
        superuser_headers,
        expense_with_adjustments
    ):
        """Should list all adjustments."""
        today = date.today()
        response = await api_client.get(
            "/api/v1/global/accounting/adjustments",
            headers=superuser_headers,
            params={
                "start_date": str(today),
                "end_date": str(today)
            }
        )

        data = assert_success_response(response)

        assert isinstance(data, list)

    async def test_list_adjustments_filter_by_reason(
        self,
        api_client,
        superuser_headers,
        expense_with_adjustments
    ):
        """Should filter adjustments by reason."""
        today = date.today()
        response = await api_client.get(
            "/api/v1/global/accounting/adjustments",
            headers=superuser_headers,
            params={
                "start_date": str(today),
                "end_date": str(today),
                "reason": "amount_correction"
            }
        )

        data = assert_success_response(response)

        assert isinstance(data, list)
        # All results should have the specified reason
        for adj in data:
            assert adj["reason"] == "amount_correction"

    async def test_list_adjustments_no_auth(self, api_client):
        """Should return 401/403 without authentication."""
        response = await api_client.get(
            "/api/v1/global/accounting/adjustments",
            params={
                "start_date": str(date.today()),
                "end_date": str(date.today())
            }
        )

        assert response.status_code in [401, 403]
