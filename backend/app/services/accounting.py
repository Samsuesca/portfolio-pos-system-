"""
Accounting Service - Backwards Compatibility Module

This module re-exports all accounting services from the accounting/ package.
For new code, prefer importing directly from the package:

    from app.services.accounting import TransactionService
    # or
    from app.services.accounting.transactions import TransactionService

This file exists to maintain backwards compatibility with existing imports.
"""
# Re-export everything from the accounting package
from app.services.accounting import (
    TransactionService,
    ExpenseService,
    DailyCashRegisterService,
    AccountingService,
    BalanceAccountService,
    BalanceEntryService,
    AccountsReceivableService,
    AccountsPayableService,
    BalanceGeneralService,
)

__all__ = [
    'TransactionService',
    'ExpenseService',
    'DailyCashRegisterService',
    'AccountingService',
    'BalanceAccountService',
    'BalanceEntryService',
    'AccountsReceivableService',
    'AccountsPayableService',
    'BalanceGeneralService',
]
