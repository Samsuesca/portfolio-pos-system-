"""
Quotation Service Package (B2B — GLOBAL/corporativo, sin school_id)

Composes all quotation-related mixins into a single QuotationService class:
- QuotationServiceBase:   constructor sobre BaseService[Quotation]
- QuotationNumberingMixin: _generate_quotation_code / _generate_contract_code (GLOBAL)
- QuotationCreationMixin:  create_quotation, update_quotation, replace_items
- QuotationStatusMixin:    update_status (FSM), convert_to_contract
- QuotationQueryMixin:     get_quotation_with_items, list_quotations
- QuotationDocumentMixin:  generate_quotation_html (A4 self-contained)

Import as: from app.services.quotation import QuotationService
"""
from sqlalchemy.ext.asyncio import AsyncSession

from .base import QuotationServiceBase
from .numbering import QuotationNumberingMixin
from .creation import QuotationCreationMixin
from .status import QuotationStatusMixin, VALID_TRANSITIONS
from .queries import QuotationQueryMixin
from .documents import QuotationDocumentMixin


class QuotationService(
    QuotationServiceBase,
    QuotationNumberingMixin,
    QuotationCreationMixin,
    QuotationStatusMixin,
    QuotationQueryMixin,
    QuotationDocumentMixin,
):
    """Service for B2B Quotation operations (GLOBAL, sin school_id)."""

    def __init__(self, db: AsyncSession):
        super().__init__(db)


__all__ = ["QuotationService", "VALID_TRANSITIONS"]
