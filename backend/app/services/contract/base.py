"""
Contract Service Base

Constructor over BaseService[Contract]. B2B es un recurso GLOBAL/corporativo:
los contratos NO tienen school_id (al igual que las cotizaciones). Su
contabilidad es global (una sola caja, una sola cuenta de banco).
"""
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.b2b import Contract
from app.services.base import BaseService


class ContractServiceBase(BaseService[Contract]):
    """Base service for Contract (GLOBAL, sin school_id)."""

    def __init__(self, db: AsyncSession):
        super().__init__(Contract, db)
