"""
Order Service (Encargos) - Backwards Compatibility Shim

This module re-exports OrderService from the new modular structure.
The actual implementation is now in app/services/order/ package.

For new code, import directly from the package:
    from app.services.order import OrderService

This file exists for backwards compatibility with existing imports:
    from app.services.order import OrderService
"""
from app.services.order import OrderService

__all__ = ['OrderService']
