"""Sale query methods with eager loading.

Provides optimized queries that load sale relationships in a single
round-trip using ``selectinload``, avoiding N+1 problems when the
caller needs items, products, and payments together.
"""
import logging
from uuid import UUID
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.sale import Sale, SaleItem

logger = logging.getLogger(__name__)


class SaleQueryMixin:
    """Provides ``get_sale_with_items`` to :class:`SaleService`."""

    db: AsyncSession

    async def get_sale_with_items(
        self,
        sale_id: UUID,
        school_id: UUID
    ) -> Sale | None:
        result = await self.db.execute(
            select(Sale)
            .options(
                selectinload(Sale.items).selectinload(SaleItem.product),
                selectinload(Sale.payments)
            )
            .where(
                Sale.id == sale_id,
                Sale.school_id == school_id
            )
        )
        return result.scalar_one_or_none()
