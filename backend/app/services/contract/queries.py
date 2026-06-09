"""
Contract Query Mixin — lecturas y alta directa de contratos.

Recurso GLOBAL: sin filtro de school_id. El ``total`` para paginación sale de
un ``func.count`` independiente (Stats Pattern del CLAUDE.md), no de len(items).
"""
from decimal import Decimal
from uuid import UUID

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.b2b import Contract, ContractStatus, ContractMilestone, B2BClient
from app.schemas.b2b import ContractCreate
from app.utils.timezone import get_colombia_now_naive


class ContractQueryMixin:
    """Mixin con consultas y alta directa para ContractService."""

    db: AsyncSession  # Type hint for IDE support

    async def _enrich_contracts(self, contracts: list[Contract]) -> None:
        """Adjunta los atributos derivados que consume la API: ``client_name``
        (nombre del cliente B2B, no el UUID) y ``outstanding_balance`` (saldo
        realmente por cobrar vía CxC abiertas — 0 en contado/cobrados). Son
        atributos transitorios que el response_model lee por from_attributes."""
        if not contracts:
            return
        client_ids = {c.b2b_client_id for c in contracts}
        rows = await self.db.execute(
            select(B2BClient.id, B2BClient.legal_name).where(B2BClient.id.in_(client_ids))
        )
        names = {cid: name for cid, name in rows}
        for c in contracts:
            c.client_name = names.get(c.b2b_client_id)
            c.outstanding_balance = await self._outstanding_balance(c)

    async def get_contract_with_milestones(
        self,
        contract_id: UUID,
    ) -> Contract | None:
        """Carga el contrato con sus hitos (eager) para serializar ContractResponse."""
        result = await self.db.execute(
            select(Contract)
            .options(selectinload(Contract.milestones))
            .where(Contract.id == contract_id)
        )
        contract = result.scalar_one_or_none()
        if contract is not None:
            await self._enrich_contracts([contract])
        return contract

    async def list_contracts(
        self,
        *,
        skip: int,
        limit: int,
        status: ContractStatus | None = None,
        b2b_client_id: UUID | None = None,
        branch_id: UUID | None = None,
        search: str | None = None,
    ) -> tuple[list[Contract], int]:
        """Lista contratos paginados con filtros. Devuelve (items, total)."""
        filters = []
        if status is not None:
            filters.append(Contract.status == status)
        if b2b_client_id is not None:
            filters.append(Contract.b2b_client_id == b2b_client_id)
        if branch_id is not None:
            filters.append(Contract.branch_id == branch_id)
        if search:
            filters.append(Contract.contract_number.ilike(f"%{search}%"))

        items_query = (
            select(Contract)
            .where(*filters)
            .order_by(Contract.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        count_query = select(func.count(Contract.id)).where(*filters)

        items_result = await self.db.execute(items_query)
        total_result = await self.db.execute(count_query)

        items = list(items_result.scalars().all())
        total = total_result.scalar_one()
        await self._enrich_contracts(items)
        return items, total

    async def count_by_status(self) -> dict[str, int]:
        """Conteo de contratos por estado (para stats del frontend)."""
        result = await self.db.execute(
            select(Contract.status, func.count(Contract.id)).group_by(Contract.status)
        )
        counts: dict[str, int] = {s.value: 0 for s in ContractStatus}
        for status_value, count in result:
            key = status_value.value if hasattr(status_value, "value") else str(status_value)
            counts[key] = count
        return counts

    async def create_contract(
        self,
        data: ContractCreate,
        user_id: UUID | None = None,
    ) -> Contract:
        """Alta directa de un contrato (pending_deposit).

        Normalmente se crea convirtiendo una cotización aceptada, pero se permite
        alta directa. Computa ``balance_amount = total - deposit_amount`` y crea
        los hitos provistos.
        """
        total = data.total
        deposit = data.deposit_amount or Decimal("0")
        if deposit > total:
            raise ValueError("El anticipo no puede exceder el total del contrato")
        balance = total - deposit

        contract_number = await self._generate_contract_code()
        contract = Contract(
            branch_id=data.branch_id,
            b2b_client_id=data.b2b_client_id,
            quotation_id=data.quotation_id,
            contract_number=contract_number,
            status=ContractStatus.PENDING_DEPOSIT,
            total=total,
            deposit_amount=deposit,
            balance_amount=balance,
            delivery_date=data.delivery_date,
            has_milestones=data.has_milestones or bool(data.milestones),
            signed_document_url=data.signed_document_url,
            notes=data.notes,
            created_by=user_id,
        )
        self.db.add(contract)
        await self.db.flush()

        for ms in data.milestones:
            self.db.add(
                ContractMilestone(
                    contract_id=contract.id,
                    sequence=ms.sequence,
                    description=ms.description,
                    amount=ms.amount,
                    due_date=ms.due_date,
                )
            )
        if data.milestones:
            contract.has_milestones = True

        await self.db.flush()
        await self.db.refresh(contract, attribute_names=["milestones"])
        return contract
