"""
Order Service Package

Re-exports OrderService for backwards compatibility.
Import as: from app.services.order import OrderService
"""
from .base import OrderService

__all__ = ['OrderService']
