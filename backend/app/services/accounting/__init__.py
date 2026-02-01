"""
Accounting Services Package

Re-exports all accounting services for backwards compatibility.
Import from here or from individual modules:

    # Option 1: Import from package (backwards compatible)
    from app.services.accounting import TransactionService, ExpenseService

    # Option 2: Import from specific modules
    from app.services.accounting.transactions import TransactionService
    from app.services.accounting.expenses import ExpenseService
"""
from app.services.accounting.transactions import TransactionService
from app.services.accounting.expenses import ExpenseService
from app.services.accounting.cash_register import DailyCashRegisterService
from app.services.accounting.reports import AccountingService
from app.services.accounting.balance_accounts import BalanceAccountService, BalanceEntryService
from app.services.accounting.receivables import AccountsReceivableService
from app.services.accounting.payables import AccountsPayableService
from app.services.accounting.balance_general import BalanceGeneralService
from app.services.accounting.expense_categories import ExpenseCategoryService
from app.services.accounting.fixed_expenses import FixedExpenseService
from app.services.accounting.expense_adjustments import ExpenseAdjustmentService

__all__ = [
    # Core transaction services
    'TransactionService',
    'ExpenseService',
    'DailyCashRegisterService',
    # Reports and dashboard
    'AccountingService',
    # Balance accounts
    'BalanceAccountService',
    'BalanceEntryService',
    # Receivables and payables
    'AccountsReceivableService',
    'AccountsPayableService',
    # Balance general
    'BalanceGeneralService',
    # Expense management
    'ExpenseCategoryService',
    'FixedExpenseService',
    'ExpenseAdjustmentService',
]
