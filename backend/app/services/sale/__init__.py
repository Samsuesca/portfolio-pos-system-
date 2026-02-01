"""
Sale Service Package

Re-exports SaleService for backwards compatibility.
Import as: from app.services.sale import SaleService
"""
from .base import SaleService

__all__ = ['SaleService']
