"""
Sale Service - Backwards Compatibility Shim

This module re-exports SaleService from the sale package for backwards compatibility.
Import as: from app.services.sale import SaleService

For new code, prefer importing from the package directly:
    from app.services.sale import SaleService
"""
from app.services.sale import SaleService

__all__ = ['SaleService']
