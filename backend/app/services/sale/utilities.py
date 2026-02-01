"""
Sale Utility Mixin

Contains utility methods for sale operations:
- _generate_sale_code
"""
import logging
from uuid import UUID
from datetime import datetime
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.sale import Sale
from app.utils.timezone import get_colombia_date

logger = logging.getLogger(__name__)


class SaleUtilityMixin:
    """Mixin providing utility methods for SaleService"""

    db: AsyncSession  # Type hint for IDE support

    async def _generate_sale_code(self, school_id: UUID) -> str:
        """Generate sale code: VNT-YYYY-NNNN"""
        year = get_colombia_date().year
        prefix = f"VNT-{year}-"

        # Count sales for this year
        count = await self.db.execute(
            select(func.count(Sale.id)).where(
                Sale.school_id == school_id,
                Sale.code.like(f"{prefix}%")
            )
        )

        sequence = count.scalar_one() + 1
        return f"{prefix}{sequence:04d}"
