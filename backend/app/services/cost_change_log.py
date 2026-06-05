"""
Cost Change Log Service

Append-only logger para cambios en costos por componente. Lo invocan los
mutadores de `CostComponentService` (upsert_breakdown, bulk_apply_component,
deactivate_template) pasando `changed_by=current_user.id` desde el route handler.

No commitea: hace `db.add` + `db.flush`. La transacción la cierra el caller —
si el cambio funcional falla, el log también cae (comportamiento correcto).
"""
import logging
from decimal import Decimal
from uuid import UUID

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.cost_change_log import CostChangeLog, CostChangeType

logger = logging.getLogger(__name__)


class CostChangeLogService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def log_change(
        self,
        *,
        product_id: UUID,
        change_type: CostChangeType,
        template_id: UUID | None = None,
        product_cost_component_id: UUID | None = None,
        school_id: UUID | None = None,
        amount_before: Decimal | None = None,
        amount_after: Decimal | None = None,
        notes_before: str | None = None,
        notes_after: str | None = None,
        reason: str | None = None,
        changed_by: UUID | None = None,
    ) -> CostChangeLog:
        log = CostChangeLog(
            product_id=product_id,
            template_id=template_id,
            product_cost_component_id=product_cost_component_id,
            school_id=school_id,
            change_type=change_type,
            amount_before=amount_before,
            amount_after=amount_after,
            notes_before=notes_before,
            notes_after=notes_after,
            reason=reason,
            changed_by=changed_by,
        )
        self.db.add(log)
        return log

    async def log_changes_batch(self, logs: list[CostChangeLog]) -> None:
        """Inserta N logs de un saque (para bulk_apply / template_deactivated)."""
        if not logs:
            return
        self.db.add_all(logs)

    async def get_product_history(
        self,
        product_id: UUID,
        skip: int = 0,
        limit: int = 100,
    ) -> tuple[list[CostChangeLog], int]:
        """
        Historial paginado de un producto, joined con user + template para
        resolver nombres en una sola query.
        """
        count_stmt = (
            select(func.count(CostChangeLog.id))
            .where(CostChangeLog.product_id == product_id)
        )
        total = (await self.db.execute(count_stmt)).scalar_one()

        stmt = (
            select(CostChangeLog)
            .options(
                selectinload(CostChangeLog.changed_by_user),
                selectinload(CostChangeLog.template),
            )
            .where(CostChangeLog.product_id == product_id)
            .order_by(CostChangeLog.created_at.desc(), CostChangeLog.id.desc())
            .offset(skip)
            .limit(limit)
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all()), total
