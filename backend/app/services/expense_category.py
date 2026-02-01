"""
Backwards compatibility shim.
This module has been moved to app.services.accounting.expense_categories
"""
from app.services.accounting.expense_categories import ExpenseCategoryService

__all__ = ['ExpenseCategoryService']
