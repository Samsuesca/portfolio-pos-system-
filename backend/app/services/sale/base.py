"""
Sale Service (Ventas)

Contabilidad de Ventas:
- Las ventas efectivas (CASH, TRANSFER, CARD) crean transaccion de ingreso + actualizan balance
- Las ventas a credito (CREDIT) solo crean cuenta por cobrar, no afectan Caja/Banco
- Las ventas historicas pueden saltarse la creacion de transacciones

This module composes all sale-related mixins into a single SaleService class.
"""
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.sale import Sale
from app.services.base import SchoolIsolatedService

from .creation import SaleCreationMixin
from .changes import SaleChangeMixin
from .payments import SalePaymentMixin
from .queries import SaleQueryMixin
from .utilities import SaleUtilityMixin
from .cancellation import SaleCancellationMixin
from .update import SaleUpdateMixin


class SaleService(
    SchoolIsolatedService[Sale],
    SaleCreationMixin,
    SaleChangeMixin,
    SalePaymentMixin,
    SaleQueryMixin,
    SaleUtilityMixin,
    SaleCancellationMixin,
    SaleUpdateMixin
):
    """
    Service for Sale (Ventas) operations.

    This class composes all sale-related functionality through mixins:
    - SaleCreationMixin: create_sale
    - SaleChangeMixin: create_sale_change, _create_change_with_order, approve_sale_change,
                       reject_sale_change, complete_change_from_order, get_sale_changes
    - SalePaymentMixin: add_payment_to_sale
    - SaleQueryMixin: get_sale_with_items
    - SaleUtilityMixin: _generate_sale_code
    - SaleCancellationMixin: cancel_sale
    - SaleUpdateMixin: update_sale, assign_client_to_sale, remove_client_from_sale
    """

    def __init__(self, db: AsyncSession):
        super().__init__(Sale, db)
