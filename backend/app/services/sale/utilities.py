"""Sale utility methods.

Internal helpers shared across sale mixins. Not part of the public
service API — prefixed with underscore by convention.
"""
import logging
from uuid import UUID
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.sale import Sale
from app.models.school import School
from app.utils.timezone import get_colombia_date

logger = logging.getLogger(__name__)


class SaleUtilityMixin:
    """Provides ``_generate_sale_code`` to :class:`SaleService`."""

    db: AsyncSession

    async def _generate_sale_code(self, school_id: UUID) -> str:
        """Generate a sequential sale code: ``{SCHOOL}-VNT-{year}-{seq:04d}``.

        Uses ``ORDER BY code DESC LIMIT 1 FOR UPDATE`` to lock the highest
        code row, preventing duplicate codes when two concurrent requests
        create sales for the same school. The row-level lock makes the
        second transaction wait until the first commits.

        Falls back to sequence 1 if no sales exist for the current year.

        Args:
            school_id: School UUID to scope the sequence.

        Returns:
            Sale code string, e.g. ``CARACAS-001-VNT-2026-0042``.
        """
        school_code_result = await self.db.execute(
            select(School.code).where(School.id == school_id)
        )
        school_code = school_code_result.scalar_one()

        year = get_colombia_date().year
        prefix = f"{school_code}-VNT-{year}-"

        # FOR UPDATE is not allowed with aggregate functions (MAX),
        # so we select the actual row and lock it instead
        result = await self.db.execute(
            select(Sale.code)
            .where(
                Sale.school_id == school_id,
                Sale.code.like(f"{prefix}%"),
            )
            .order_by(Sale.code.desc())
            .limit(1)
            .with_for_update()
        )

        max_code = result.scalar_one_or_none()

        if max_code:
            try:
                sequence = int(max_code.split("-")[-1]) + 1
            except (ValueError, IndexError):
                sequence = 1
        else:
            sequence = 1

        return f"{prefix}{sequence:04d}"

    @staticmethod
    def normalize_code_for_lookup(code: str) -> tuple[str, bool]:
        """Build a lookup token tolerant to legacy code format.

        Pre-V3 tickets show the bare format ``VNT-YYYY-NNNN``. The new format
        prepends the school code: ``{SCHOOL}-VNT-YYYY-NNNN``. When a user
        searches with a legacy code, we expand to a ``LIKE`` pattern that
        matches any school's row ending in that legacy suffix.

        Returns:
            (token, is_pattern). If is_pattern is True, the caller should
            use ``Sale.code.like(token)``; otherwise an exact match.
        """
        stripped = (code or "").strip()
        if stripped.startswith(("VNT-", "ENC-")) and stripped.count("-") == 2:
            return f"%-{stripped}", True
        return stripped, False
