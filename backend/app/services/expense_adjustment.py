"""
Backwards compatibility shim.
This module has been moved to app.services.accounting.expense_adjustments
"""
from app.services.accounting.expense_adjustments import ExpenseAdjustmentService

__all__ = ['ExpenseAdjustmentService']
