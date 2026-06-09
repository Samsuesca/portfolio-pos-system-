"""
Quotation Numbering Mixin

Genera consecutivos GLOBALES para cotizaciones (COT-YYYY-NNNN) y contratos
(CTR-YYYY-NNNN). Sin prefijo de colegio (B2B es corporativo).

Concurrencia: se toma un **advisory lock transaccional** (`pg_advisory_xact_lock`)
keyed por prefijo (COT-YYYY / CTR-YYYY) antes de calcular `max + 1`. Eso serializa
la generación de consecutivos para ese prefijo entre transacciones concurrentes,
eliminando colisiones por completo — incluso en la primera cotización del año,
donde un `SELECT ... FOR UPDATE` no tendría fila que bloquear. El lock se libera
al hacer commit/rollback de la transacción, así que no necesita retry ni rollback
manual (que romperían transacciones compartidas).
"""
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.b2b import Quotation, Contract
from app.utils.timezone import get_colombia_date


class QuotationNumberingMixin:
    """Mixin con generadores de consecutivos GLOBALES para B2B."""

    db: AsyncSession  # Type hint for IDE support

    async def _next_code(self, number_col, prefix: str) -> str:
        # Advisory lock transaccional por prefijo: serializa la generación de
        # consecutivos, garantizando unicidad sin retry/rollback.
        await self.db.execute(select(func.pg_advisory_xact_lock(func.hashtext(prefix))))

        result = await self.db.execute(
            select(number_col)
            .where(number_col.like(f"{prefix}%"))
            .order_by(number_col.desc())
            .limit(1)
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

    async def _generate_quotation_code(self) -> str:
        """Genera COT-YYYY-NNNN. GLOBAL (sin prefijo de colegio)."""
        year = get_colombia_date().year
        return await self._next_code(Quotation.quotation_number, f"COT-{year}-")

    async def _generate_contract_code(self) -> str:
        """Genera CTR-YYYY-NNNN. GLOBAL. Mismo patrón que las cotizaciones."""
        year = get_colombia_date().year
        return await self._next_code(Contract.contract_number, f"CTR-{year}-")
