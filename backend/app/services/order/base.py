"""
Order Service (Encargos)

Contabilidad de Encargos:
- Sin IVA (tax = 0, total = subtotal)
- Al crear con anticipo: registra transaccion de ingreso + cuenta por cobrar
- Al agregar abono: registra transaccion de ingreso + actualiza cuenta por cobrar
- Cuando se cancela totalmente: la cuenta por cobrar queda saldada

This module composes all order-related mixins into a single OrderService class.
"""
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.order import Order
from app.services.base import SchoolIsolatedService

from .creation import OrderCreationMixin
from .payments import OrderPaymentMixin
from .status import OrderStatusMixin
from .stock import OrderStockMixin
from .queries import OrderQueryMixin
from .utilities import OrderUtilityMixin
from .reporting import OrderReportingMixin
from .cancellation import OrderCancellationMixin
from .changes import OrderChangeMixin


class OrderService(
    SchoolIsolatedService[Order],
    OrderCreationMixin,
    OrderPaymentMixin,
    OrderStatusMixin,
    OrderStockMixin,
    OrderQueryMixin,
    OrderUtilityMixin,
    OrderReportingMixin,
    OrderCancellationMixin,
    OrderChangeMixin
):
    """
    Service for Order (Encargos) operations.

    This class composes all order-related functionality through mixins:
    - OrderCreationMixin: create_order, create_web_order, update_order
    - OrderPaymentMixin: add_payment
    - OrderStatusMixin: update_status, update_item_status, sync methods
    - OrderStockMixin: verify_order_stock, approve_order_with_stock
    - OrderQueryMixin: get_order_with_items, get_item
    - OrderUtilityMixin: _generate_order_code, _send_order_ready_notification, _complete_pending_sale_changes
    - OrderReportingMixin: get_product_demand
    - OrderCancellationMixin: cancel_order
    - OrderChangeMixin: create_order_change, approve_order_change, reject_order_change, get_order_changes
    """

    def __init__(self, db: AsyncSession):
        super().__init__(Order, db)
