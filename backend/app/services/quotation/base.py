"""
Quotation Service Base

Constructor over BaseService[Quotation]. B2B es un recurso GLOBAL/corporativo:
las cotizaciones NO tienen school_id (a diferencia de SchoolIsolatedService).
"""
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.b2b import Quotation
from app.services.base import BaseService


class QuotationServiceBase(BaseService[Quotation]):
    """Base service for Quotation (GLOBAL, sin school_id)."""

    def __init__(self, db: AsyncSession):
        super().__init__(Quotation, db)
