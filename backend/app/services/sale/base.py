"""SaleService — composed service for all sale operations.

Uses mixin composition to split a large service into focused modules
while sharing a single ``AsyncSession``. All mixins operate on the same
DB session, so the entire sale lifecycle (creation, changes, payments,
cancellation) runs within one transaction controlled by the caller.

Example::

    async with get_db() as db:
        service = SaleService(db)
        sale = await service.create_sale(data, user_id)
        await db.commit()
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
    """Unified service for sale (venta) operations.

    Inherits from :class:`SchoolIsolatedService` which provides multi-tenant
    CRUD with automatic ``school_id`` filtering. Each mixin adds domain-specific
    behavior:

    - **SaleCreationMixin** — ``create_sale``: full sale lifecycle with inventory,
      payments, accounting, and notifications.
    - **SaleChangeMixin** — ``create_sale_change``, ``approve_sale_change``,
      ``reject_sale_change``, ``complete_change_from_order``: product exchanges,
      returns, and defect handling with optional order creation when stock is unavailable.
    - **SalePaymentMixin** — ``add_payment_to_sale``: retroactive payment addition
      with optional accounting integration.
    - **SaleQueryMixin** — ``get_sale_with_items``: eager-loaded sale retrieval.
    - **SaleUtilityMixin** — ``_generate_sale_code``: sequential code generation
      with row-level locking to prevent duplicates under concurrency.
    - **SaleCancellationMixin** — ``cancel_sale``: full reversal of inventory,
      accounting, and receivables.
    - **SaleUpdateMixin** — ``update_sale``, ``assign_client_to_sale``,
      ``remove_client_from_sale``: metadata updates.
    """

    def __init__(self, db: AsyncSession):
        super().__init__(Sale, db)
