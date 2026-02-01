"""
Unit Tests for Balance Integration Service.

Tests cover:
- Global account creation and retrieval
- Transaction to balance application
- Payment method to account mapping
- Transfer operations between accounts
- Cash balance retrieval
- Initial balance setup
"""
import pytest
from decimal import Decimal
from uuid import uuid4
from datetime import date
from unittest.mock import AsyncMock, MagicMock, patch

from app.services.balance_integration import (
    BalanceIntegrationService,
    DEFAULT_ACCOUNTS,
    PAYMENT_METHOD_TO_ACCOUNT
)
from app.models.accounting import (
    Transaction, TransactionType, AccPaymentMethod,
    BalanceAccount, BalanceEntry, AccountType
)


pytestmark = pytest.mark.unit


# ============================================================================
# FIXTURES
# ============================================================================

@pytest.fixture
def mock_db():
    """Create mock database session."""
    db = AsyncMock()
    db.add = MagicMock()
    db.flush = AsyncMock()
    db.execute = AsyncMock()
    return db


@pytest.fixture
def balance_service(mock_db):
    """Create BalanceIntegrationService with mock db."""
    return BalanceIntegrationService(mock_db)


@pytest.fixture
def mock_caja_menor_account():
    """Create mock Caja Menor account."""
    account = MagicMock(spec=BalanceAccount)
    account.id = uuid4()
    account.school_id = None
    account.account_type = AccountType.ASSET_CURRENT
    account.name = "Caja Menor"
    account.code = "1101"
    account.balance = Decimal("500000")
    account.is_active = True
    account.updated_at = None
    return account


@pytest.fixture
def mock_banco_account():
    """Create mock Banco account."""
    account = MagicMock(spec=BalanceAccount)
    account.id = uuid4()
    account.school_id = None
    account.account_type = AccountType.ASSET_CURRENT
    account.name = "Banco"
    account.code = "1104"
    account.balance = Decimal("2000000")
    account.is_active = True
    account.updated_at = None
    return account


@pytest.fixture
def mock_income_transaction(mock_caja_menor_account):
    """Create mock income transaction."""
    transaction = MagicMock(spec=Transaction)
    transaction.id = uuid4()
    transaction.school_id = uuid4()
    transaction.type = TransactionType.INCOME
    transaction.amount = Decimal("150000")
    transaction.payment_method = AccPaymentMethod.CASH
    transaction.description = "Venta de prueba"
    transaction.reference_code = "VNT-001"
    transaction.transaction_date = date.today()
    transaction.balance_account_id = None
    return transaction


@pytest.fixture
def mock_expense_transaction(mock_banco_account):
    """Create mock expense transaction."""
    transaction = MagicMock(spec=Transaction)
    transaction.id = uuid4()
    transaction.school_id = uuid4()
    transaction.type = TransactionType.EXPENSE
    transaction.amount = Decimal("50000")
    transaction.payment_method = AccPaymentMethod.TRANSFER
    transaction.description = "Pago proveedor"
    transaction.reference_code = "PAG-001"
    transaction.transaction_date = date.today()
    transaction.balance_account_id = None
    return transaction


# ============================================================================
# DEFAULT ACCOUNTS TESTS
# ============================================================================

class TestDefaultAccounts:
    """Tests for default account configuration."""

    def test_default_accounts_structure(self):
        """Should have correct default accounts configured."""
        assert "caja_menor" in DEFAULT_ACCOUNTS
        assert "caja_mayor" in DEFAULT_ACCOUNTS
        assert "nequi" in DEFAULT_ACCOUNTS
        assert "banco" in DEFAULT_ACCOUNTS

    def test_caja_menor_config(self):
        """Caja Menor should have correct configuration."""
        config = DEFAULT_ACCOUNTS["caja_menor"]
        assert config["code"] == "1101"
        assert config["name"] == "Caja Menor"
        assert config["account_type"] == AccountType.ASSET_CURRENT

    def test_banco_config(self):
        """Banco should have correct configuration."""
        config = DEFAULT_ACCOUNTS["banco"]
        assert config["code"] == "1104"
        assert config["name"] == "Banco"
        assert config["account_type"] == AccountType.ASSET_CURRENT


# ============================================================================
# PAYMENT METHOD MAPPING TESTS
# ============================================================================

class TestPaymentMethodMapping:
    """Tests for payment method to account mapping."""

    def test_cash_maps_to_caja_menor(self):
        """CASH should map to caja_menor."""
        assert PAYMENT_METHOD_TO_ACCOUNT[AccPaymentMethod.CASH] == "caja_menor"

    def test_nequi_maps_to_nequi(self):
        """NEQUI should map to nequi account."""
        assert PAYMENT_METHOD_TO_ACCOUNT[AccPaymentMethod.NEQUI] == "nequi"

    def test_transfer_maps_to_banco(self):
        """TRANSFER should map to banco."""
        assert PAYMENT_METHOD_TO_ACCOUNT[AccPaymentMethod.TRANSFER] == "banco"

    def test_card_maps_to_banco(self):
        """CARD should map to banco."""
        assert PAYMENT_METHOD_TO_ACCOUNT[AccPaymentMethod.CARD] == "banco"

    def test_credit_maps_to_none(self):
        """CREDIT should not affect balance accounts."""
        assert PAYMENT_METHOD_TO_ACCOUNT[AccPaymentMethod.CREDIT] is None

    def test_other_maps_to_none(self):
        """OTHER should not affect balance accounts."""
        assert PAYMENT_METHOD_TO_ACCOUNT[AccPaymentMethod.OTHER] is None


# ============================================================================
# GET OR CREATE GLOBAL ACCOUNTS TESTS
# ============================================================================

class TestGetOrCreateGlobalAccounts:
    """Tests for get_or_create_global_accounts method."""

    async def test_creates_accounts_when_not_exist(
        self,
        balance_service,
        mock_db
    ):
        """Should create global accounts when they don't exist."""
        # Mock: no existing accounts
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_db.execute.return_value = mock_result

        user_id = uuid4()
        accounts = await balance_service.get_or_create_global_accounts(
            created_by=user_id
        )

        # Should have created all default accounts
        assert len(accounts) == len(DEFAULT_ACCOUNTS)
        assert mock_db.add.call_count == len(DEFAULT_ACCOUNTS)
        assert mock_db.flush.called

    async def test_returns_existing_accounts(
        self,
        balance_service,
        mock_db,
        mock_caja_menor_account
    ):
        """Should return existing accounts without creating new ones."""
        # Mock: account exists
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_caja_menor_account
        mock_db.execute.return_value = mock_result

        accounts = await balance_service.get_or_create_global_accounts()

        # Should not add new accounts (using existing)
        # Note: It will still try to add for other account types
        assert mock_caja_menor_account.id in accounts.values()


# ============================================================================
# GET GLOBAL ACCOUNT TESTS
# ============================================================================

class TestGetGlobalAccount:
    """Tests for get_global_account method."""

    async def test_returns_account_when_exists(
        self,
        balance_service,
        mock_db,
        mock_caja_menor_account
    ):
        """Should return account when it exists."""
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_caja_menor_account
        mock_db.execute.return_value = mock_result

        account = await balance_service.get_global_account("1101")

        assert account is not None
        assert account.code == "1101"

    async def test_returns_none_when_not_exists(
        self,
        balance_service,
        mock_db
    ):
        """Should return None when account doesn't exist."""
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_db.execute.return_value = mock_result

        account = await balance_service.get_global_account("9999")

        assert account is None


# ============================================================================
# GET ACCOUNT FOR PAYMENT METHOD TESTS
# ============================================================================

class TestGetAccountForPaymentMethod:
    """Tests for get_account_for_payment_method method."""

    async def test_returns_account_id_for_cash(
        self,
        balance_service,
        mock_db,
        mock_caja_menor_account
    ):
        """Should return caja_menor ID for CASH payment."""
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_caja_menor_account
        mock_db.execute.return_value = mock_result

        account_id = await balance_service.get_account_for_payment_method(
            AccPaymentMethod.CASH
        )

        assert account_id == mock_caja_menor_account.id

    async def test_returns_none_for_credit(
        self,
        balance_service
    ):
        """Should return None for CREDIT payment (no balance impact)."""
        account_id = await balance_service.get_account_for_payment_method(
            AccPaymentMethod.CREDIT
        )

        assert account_id is None


# ============================================================================
# APPLY TRANSACTION TO BALANCE TESTS
# ============================================================================

class TestApplyTransactionToBalance:
    """Tests for apply_transaction_to_balance method."""

    async def test_income_increases_balance(
        self,
        balance_service,
        mock_db,
        mock_caja_menor_account,
        mock_income_transaction
    ):
        """Income transaction should increase account balance."""
        # Setup mock to return caja_menor for CASH payment
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_caja_menor_account
        mock_db.execute.return_value = mock_result

        initial_balance = mock_caja_menor_account.balance

        entry = await balance_service.apply_transaction_to_balance(
            mock_income_transaction,
            created_by=uuid4()
        )

        # Balance should increase
        expected_balance = initial_balance + mock_income_transaction.amount
        assert mock_caja_menor_account.balance == expected_balance
        assert entry is not None
        assert mock_db.add.called

    async def test_expense_decreases_balance(
        self,
        balance_service,
        mock_db,
        mock_banco_account,
        mock_expense_transaction
    ):
        """Expense transaction should decrease account balance."""
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_banco_account
        mock_db.execute.return_value = mock_result

        initial_balance = mock_banco_account.balance

        entry = await balance_service.apply_transaction_to_balance(
            mock_expense_transaction,
            created_by=uuid4()
        )

        # Balance should decrease
        expected_balance = initial_balance - mock_expense_transaction.amount
        assert mock_banco_account.balance == expected_balance
        assert entry is not None

    async def test_credit_returns_none(
        self,
        balance_service,
        mock_db
    ):
        """CREDIT payment should not affect balance."""
        transaction = MagicMock(spec=Transaction)
        transaction.payment_method = AccPaymentMethod.CREDIT
        transaction.type = TransactionType.INCOME
        transaction.amount = Decimal("100000")

        entry = await balance_service.apply_transaction_to_balance(
            transaction
        )

        assert entry is None

    async def test_creates_balance_entry(
        self,
        balance_service,
        mock_db,
        mock_caja_menor_account,
        mock_income_transaction
    ):
        """Should create BalanceEntry for audit."""
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_caja_menor_account
        mock_db.execute.return_value = mock_result

        entry = await balance_service.apply_transaction_to_balance(
            mock_income_transaction,
            created_by=uuid4()
        )

        # Verify db.add was called to add BalanceEntry
        assert mock_db.add.called
        assert mock_db.flush.called


# ============================================================================
# APPLY TRANSFER TESTS
# ============================================================================

class TestApplyTransfer:
    """Tests for apply_transfer method."""

    async def test_transfer_between_accounts(
        self,
        balance_service,
        mock_db,
        mock_caja_menor_account,
        mock_banco_account
    ):
        """Should transfer amount between accounts."""
        # Setup: first call returns caja_menor, second returns banco
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.side_effect = [
            mock_caja_menor_account,
            mock_banco_account
        ]
        mock_db.execute.return_value = mock_result

        initial_caja = mock_caja_menor_account.balance
        initial_banco = mock_banco_account.balance

        transaction = MagicMock(spec=Transaction)
        transaction.type = TransactionType.TRANSFER
        transaction.amount = Decimal("100000")
        transaction.description = "Transfer test"
        transaction.reference_code = "TRF-001"
        transaction.transaction_date = date.today()

        entry_from, entry_to = await balance_service.apply_transfer(
            transaction,
            from_account_id=mock_caja_menor_account.id,
            to_account_id=mock_banco_account.id,
            created_by=uuid4()
        )

        # Caja should decrease, Banco should increase
        assert mock_caja_menor_account.balance == initial_caja - transaction.amount
        assert mock_banco_account.balance == initial_banco + transaction.amount
        assert mock_db.add.call_count == 2  # Two BalanceEntries

    async def test_transfer_raises_if_account_not_found(
        self,
        balance_service,
        mock_db
    ):
        """Should raise ValueError if accounts not found."""
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_db.execute.return_value = mock_result

        transaction = MagicMock(spec=Transaction)
        transaction.amount = Decimal("100000")

        with pytest.raises(ValueError, match="Cuentas de transferencia no encontradas"):
            await balance_service.apply_transfer(
                transaction,
                from_account_id=uuid4(),
                to_account_id=uuid4()
            )


# ============================================================================
# GET GLOBAL CASH BALANCES TESTS
# ============================================================================

class TestGetGlobalCashBalances:
    """Tests for get_global_cash_balances method."""

    async def test_returns_all_account_balances(
        self,
        balance_service,
        mock_db,
        mock_caja_menor_account,
        mock_banco_account
    ):
        """Should return balances for all global accounts."""
        # Mock get_or_create_global_accounts
        accounts_map = {
            "caja_menor": mock_caja_menor_account.id,
            "caja_mayor": uuid4(),
            "nequi": uuid4(),
            "banco": mock_banco_account.id
        }

        with patch.object(
            balance_service,
            'get_or_create_global_accounts',
            return_value=accounts_map
        ):
            mock_result = MagicMock()
            mock_result.scalar_one_or_none.side_effect = [
                mock_caja_menor_account,
                None,  # caja_mayor not found
                None,  # nequi not found
                mock_banco_account
            ]
            mock_db.execute.return_value = mock_result

            balances = await balance_service.get_global_cash_balances()

            assert "caja_menor" in balances
            assert "banco" in balances
            assert "total_liquid" in balances
            assert "total_cash" in balances

    async def test_calculates_total_liquid(
        self,
        balance_service,
        mock_db,
        mock_caja_menor_account,
        mock_banco_account
    ):
        """Should calculate total liquid assets correctly."""
        accounts_map = {
            "caja_menor": mock_caja_menor_account.id,
            "caja_mayor": uuid4(),
            "nequi": uuid4(),
            "banco": mock_banco_account.id
        }

        with patch.object(
            balance_service,
            'get_or_create_global_accounts',
            return_value=accounts_map
        ):
            mock_result = MagicMock()
            mock_result.scalar_one_or_none.side_effect = [
                mock_caja_menor_account,
                None,
                None,
                mock_banco_account
            ]
            mock_db.execute.return_value = mock_result

            balances = await balance_service.get_global_cash_balances()

            expected_total = mock_caja_menor_account.balance + mock_banco_account.balance
            assert balances["total_liquid"] == expected_total


# ============================================================================
# INITIALIZE GLOBAL ACCOUNTS TESTS
# ============================================================================

class TestInitializeGlobalAccounts:
    """Tests for initialize_global_accounts method."""

    async def test_creates_accounts_with_initial_balances(
        self,
        balance_service,
        mock_db
    ):
        """Should create accounts with specified initial balances."""
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_db.execute.return_value = mock_result

        accounts = await balance_service.initialize_global_accounts(
            caja_menor_initial_balance=Decimal("100000"),
            banco_initial_balance=Decimal("500000"),
            created_by=uuid4()
        )

        assert len(accounts) == len(DEFAULT_ACCOUNTS)
        # Should create accounts and balance entries for non-zero balances
        assert mock_db.add.call_count >= len(DEFAULT_ACCOUNTS)

    async def test_updates_existing_account_balances(
        self,
        balance_service,
        mock_db
    ):
        """Should update balance if account already exists."""
        # Create mock accounts for each of the 4 default accounts
        accounts = {}
        for key, config in DEFAULT_ACCOUNTS.items():
            mock_acct = MagicMock()
            mock_acct.id = uuid4()
            mock_acct.school_id = None
            mock_acct.account_type = config["account_type"]
            mock_acct.name = config["name"]
            mock_acct.code = config["code"]
            mock_acct.balance = Decimal("500000")
            mock_acct.is_active = True
            accounts[config["code"]] = mock_acct

        # Track which account should be returned
        call_index = [0]
        account_codes = list(DEFAULT_ACCOUNTS.values())

        async def mock_execute(query):
            idx = call_index[0]
            call_index[0] += 1
            code = account_codes[idx % len(account_codes)]["code"]
            mock_result = MagicMock()
            mock_result.scalar_one_or_none.return_value = accounts[code]
            return mock_result

        mock_db.execute = mock_execute

        new_balance = Decimal("999999")

        await balance_service.initialize_global_accounts(
            caja_menor_initial_balance=new_balance
        )

        # Should update existing caja_menor account balance
        assert accounts["1101"].balance == new_balance


# ============================================================================
# LEGACY METHOD COMPATIBILITY TESTS
# ============================================================================

class TestLegacyCompatibility:
    """Tests for legacy method compatibility."""

    async def test_get_cash_balances_calls_global(
        self,
        balance_service
    ):
        """Legacy get_cash_balances should call get_global_cash_balances."""
        with patch.object(
            balance_service,
            'get_global_cash_balances',
            return_value={"total_liquid": Decimal("1000000")}
        ) as mock_global:
            result = await balance_service.get_cash_balances(school_id=uuid4())

            mock_global.assert_called_once()
            assert result["total_liquid"] == Decimal("1000000")


# ============================================================================
# EDGE CASES
# ============================================================================

class TestEdgeCases:
    """Tests for edge cases and error handling."""

    async def test_zero_amount_transaction(
        self,
        balance_service,
        mock_db,
        mock_caja_menor_account
    ):
        """Should handle zero amount transactions."""
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_caja_menor_account
        mock_db.execute.return_value = mock_result

        transaction = MagicMock(spec=Transaction)
        transaction.type = TransactionType.INCOME
        transaction.amount = Decimal("0")
        transaction.payment_method = AccPaymentMethod.CASH
        transaction.description = "Zero amount"
        transaction.reference_code = "ZERO-001"
        transaction.transaction_date = date.today()
        transaction.school_id = uuid4()

        initial_balance = mock_caja_menor_account.balance

        await balance_service.apply_transaction_to_balance(transaction)

        # Balance should remain the same
        assert mock_caja_menor_account.balance == initial_balance

    async def test_large_amount_transaction(
        self,
        balance_service,
        mock_db,
        mock_caja_menor_account
    ):
        """Should handle large amount transactions."""
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_caja_menor_account
        mock_db.execute.return_value = mock_result

        transaction = MagicMock(spec=Transaction)
        transaction.type = TransactionType.INCOME
        transaction.amount = Decimal("999999999999")
        transaction.payment_method = AccPaymentMethod.CASH
        transaction.description = "Large amount"
        transaction.reference_code = "LARGE-001"
        transaction.transaction_date = date.today()
        transaction.school_id = uuid4()

        initial_balance = mock_caja_menor_account.balance

        await balance_service.apply_transaction_to_balance(transaction)

        expected = initial_balance + Decimal("999999999999")
        assert mock_caja_menor_account.balance == expected

    async def test_decimal_precision(
        self,
        balance_service,
        mock_db,
        mock_caja_menor_account
    ):
        """Should maintain decimal precision."""
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_caja_menor_account
        mock_db.execute.return_value = mock_result

        transaction = MagicMock(spec=Transaction)
        transaction.type = TransactionType.INCOME
        transaction.amount = Decimal("123456.789")
        transaction.payment_method = AccPaymentMethod.CASH
        transaction.description = "Decimal precision"
        transaction.reference_code = "DEC-001"
        transaction.transaction_date = date.today()
        transaction.school_id = uuid4()

        initial_balance = mock_caja_menor_account.balance

        await balance_service.apply_transaction_to_balance(transaction)

        expected = initial_balance + Decimal("123456.789")
        assert mock_caja_menor_account.balance == expected
