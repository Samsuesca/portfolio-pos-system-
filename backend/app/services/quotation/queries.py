"""
Quotation Query Mixin

Lecturas con eager loading. Recurso GLOBAL: sin filtro de school_id.
El `total` para paginacion sale de un func.count independiente (NO len(items)),
siguiendo el Stats Pattern del CLAUDE.md.
"""
from uuid import UUID

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload, joinedload

from app.models.b2b import Quotation, QuotationStatus, B2BClient


class QuotationQueryMixin:
    """Mixin con metodos de consulta para QuotationService."""

    db: AsyncSession  # Type hint for IDE support

    async def _attach_client_names(self, quotations: list[Quotation]) -> None:
        """Adjunta ``client_name`` (legal_name del cliente B2B) como atributo
        transitorio para que el response_model lo exponga en vez del UUID."""
        if not quotations:
            return
        client_ids = {q.b2b_client_id for q in quotations}
        rows = await self.db.execute(
            select(B2BClient.id, B2BClient.legal_name).where(B2BClient.id.in_(client_ids))
        )
        names = {cid: name for cid, name in rows}
        for q in quotations:
            q.client_name = names.get(q.b2b_client_id)

    async def get_quotation_with_items(
        self,
        quotation_id: UUID,
    ) -> Quotation | None:
        """Carga la cotizacion con items, cliente B2B y contrato (si existe)."""
        result = await self.db.execute(
            select(Quotation)
            .options(
                selectinload(Quotation.items),
                joinedload(Quotation.b2b_client),
                joinedload(Quotation.contract),
            )
            .where(Quotation.id == quotation_id)
        )
        quotation = result.unique().scalar_one_or_none()
        if quotation is not None:
            quotation.client_name = (
                quotation.b2b_client.legal_name if quotation.b2b_client else None
            )
        return quotation

    async def list_quotations(
        self,
        *,
        skip: int,
        limit: int,
        status: QuotationStatus | None = None,
        b2b_client_id: UUID | None = None,
        branch_id: UUID | None = None,
        search: str | None = None,
    ) -> tuple[list[Quotation], int]:
        """Lista cotizaciones paginadas con filtros opcionales.

        Devuelve (items, total). `total` proviene de un count independiente.
        """
        filters = []
        if status is not None:
            filters.append(Quotation.status == status)
        if b2b_client_id is not None:
            filters.append(Quotation.b2b_client_id == b2b_client_id)
        if branch_id is not None:
            filters.append(Quotation.branch_id == branch_id)
        if search:
            filters.append(Quotation.quotation_number.ilike(f"%{search}%"))

        items_query = (
            select(Quotation)
            .where(*filters)
            .order_by(Quotation.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        count_query = select(func.count(Quotation.id)).where(*filters)

        items_result = await self.db.execute(items_query)
        total_result = await self.db.execute(count_query)

        items = list(items_result.scalars().all())
        total = total_result.scalar_one()
        await self._attach_client_names(items)
        return items, total
