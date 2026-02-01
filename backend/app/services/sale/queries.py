"""
Sale Query Mixin

Contains query methods for sale operations:
- get_sale_with_items
"""
import logging
from uuid import UUID
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.sale import Sale, SaleItem

logger = logging.getLogger(__name__)


class SaleQueryMixin:
    """Mixin providing query methods for SaleService"""

    db: AsyncSession  # Type hint for IDE support

    async def get_sale_with_items(
        self,
        sale_id: UUID,
        school_id: UUID
    ) -> Sale | None:
        """
        Get sale with items and payments loaded (including product relationships)

        Args:
            sale_id: Sale UUID
            school_id: School UUID

        Returns:
            Sale with items and payments or None
        """
        result = await self.db.execute(
            select(Sale)
            .options(
                selectinload(Sale.items).selectinload(SaleItem.product),
                selectinload(Sale.items).selectinload(SaleItem.global_product),
                selectinload(Sale.payments)
            )
            .where(
                Sale.id == sale_id,
                Sale.school_id == school_id
            )
        )
        return result.scalar_one_or_none()
