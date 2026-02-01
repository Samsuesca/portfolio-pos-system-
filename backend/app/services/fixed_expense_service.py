"""
Backwards compatibility shim.
This module has been moved to app.services.accounting.fixed_expenses
"""
from app.services.accounting.fixed_expenses import FixedExpenseService

__all__ = ['FixedExpenseService']
