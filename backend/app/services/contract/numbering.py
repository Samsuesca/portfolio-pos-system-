"""
Contract Numbering Mixin

Genera consecutivos GLOBALES para contratos (CTR-YYYY-NNNN). Comparte la
misma lógica de advisory lock transaccional que la numeración de cotizaciones
(`QuotationNumberingMixin`): se serializa la generación del consecutivo por
prefijo para garantizar unicidad sin retry/rollback manual.

Normalmente el contrato se crea convirtiendo una cotización aceptada (donde el
número ya se asignó en `convert_to_contract`), pero este mixin existe para el
alta directa de contratos vía `create_contract`.
"""
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.b2b import Contract
from app.utils.timezone import get_colombia_date


class ContractNumberingMixin:
    """Mixin con el generador de consecutivos GLOBAL para contratos."""

    db: AsyncSession  # Type hint for IDE support

    async def _generate_contract_code(self) -> str:
        """Genera CTR-YYYY-NNNN. GLOBAL (sin prefijo de colegio)."""
        year = get_colombia_date().year
        prefix = f"CTR-{year}-"

        # Advisory lock transaccional por prefijo: serializa la generación de
        # consecutivos, garantizando unicidad sin retry/rollback.
        await self.db.execute(
            select(func.pg_advisory_xact_lock(func.hashtext(prefix)))
        )

        result = await self.db.execute(
            select(Contract.contract_number)
            .where(Contract.contract_number.like(f"{prefix}%"))
            .order_by(Contract.contract_number.desc())
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
