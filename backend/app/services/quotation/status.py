"""
Quotation Status Mixin

FSM de estados de cotizacion + conversion a contrato.

Transiciones validas:
  draft       → sent, expired
  sent        → negotiation, accepted, rejected, expired
  negotiation → accepted, rejected, expired
  accepted    → (terminal — solo via convert_to_contract)
  rejected    → (terminal)
  expired     → (terminal)

La conversion crea un Contract pending_deposit copiando total/cliente/branch y
enlazando contract.quotation_id. NO cambia el status de la cotizacion (queda
`accepted`); la relacion one-to-one quotation.contract previene doble conversion.
La contabilidad del anticipo se difiere a Fase B3 (ver docstring del modelo
Contract): convert_to_contract NO mueve caja ni pasivos.
"""
from decimal import Decimal
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.b2b import Quotation, Contract, QuotationStatus, ContractStatus

VALID_TRANSITIONS: dict[QuotationStatus, set[QuotationStatus]] = {
    QuotationStatus.DRAFT: {QuotationStatus.SENT, QuotationStatus.EXPIRED},
    QuotationStatus.SENT: {
        QuotationStatus.NEGOTIATION,
        QuotationStatus.ACCEPTED,
        QuotationStatus.REJECTED,
        QuotationStatus.EXPIRED,
    },
    QuotationStatus.NEGOTIATION: {
        QuotationStatus.ACCEPTED,
        QuotationStatus.REJECTED,
        QuotationStatus.EXPIRED,
    },
    QuotationStatus.ACCEPTED: set(),
    QuotationStatus.REJECTED: set(),
    QuotationStatus.EXPIRED: set(),
}


def _as_status(value: QuotationStatus | str) -> QuotationStatus:
    """Normaliza el status (puede venir como enum o como str del driver)."""
    return value if isinstance(value, QuotationStatus) else QuotationStatus(value)


class QuotationStatusMixin:
    """Mixin con FSM de estados y conversion a contrato."""

    db: AsyncSession  # Type hint for IDE support

    async def update_status(
        self,
        quotation_id: UUID,
        new_status: QuotationStatus,
    ) -> Quotation | None:
        """Aplica una transicion de estado validada por la FSM.

        Devuelve None si la cotizacion no existe (la ruta responde 404).
        Lanza ValueError si la transicion es invalida (la ruta responde 400).
        """
        quotation = await self.get(quotation_id)
        if not quotation:
            return None

        current = _as_status(quotation.status)
        new_status = _as_status(new_status)

        if new_status == current:
            return quotation

        if new_status not in VALID_TRANSITIONS[current]:
            raise ValueError(
                f"Transición no permitida: {current.value} → {new_status.value}"
            )

        quotation.status = new_status
        await self.db.flush()
        await self.db.refresh(quotation)
        return quotation

    async def convert_to_contract(
        self,
        quotation_id: UUID,
        user_id: UUID,
    ) -> Contract:
        """Crea un Contract pending_deposit desde una cotizacion aceptada.

        Lanza ValueError si: la cotizacion no existe, no esta en `accepted`, o
        ya tiene un contrato asociado (one-to-one). La ruta mapea estos casos a
        404 / 409 segun corresponda.
        """
        quotation = await self.get_quotation_with_items(quotation_id)
        if not quotation:
            raise ValueError("Cotización no encontrada")

        if _as_status(quotation.status) != QuotationStatus.ACCEPTED:
            raise ValueError("Solo se pueden convertir cotizaciones aceptadas")

        # Chequeo de doble-conversión por query directa (no por la relación
        # quotation.contract): en una misma sesión la relación queda cacheada en
        # None desde el get previo y no se refresca al crear el contrato, lo que
        # dejaría pasar una segunda conversión.
        existing = await self.db.execute(
            select(Contract.id).where(Contract.quotation_id == quotation_id)
        )
        if existing.scalar_one_or_none() is not None:
            raise ValueError("Esta cotización ya tiene un contrato asociado")

        deposit_amount = (
            quotation.total * quotation.deposit_pct / Decimal("100")
        ).quantize(Decimal("0.01"))
        balance_amount = quotation.total - deposit_amount

        # El advisory lock en _generate_contract_code serializa el consecutivo;
        # insert+flush directo es seguro bajo concurrencia.
        contract_number = await self._generate_contract_code()
        contract = Contract(
            branch_id=quotation.branch_id,
            b2b_client_id=quotation.b2b_client_id,
            quotation_id=quotation.id,
            contract_number=contract_number,
            status=ContractStatus.PENDING_DEPOSIT,
            total=quotation.total,
            deposit_amount=deposit_amount,
            balance_amount=balance_amount,
            delivery_date=None,
            has_milestones=False,
            created_by=user_id,
        )
        self.db.add(contract)
        await self.db.flush()

        # attribute_names=["milestones"] carga la colección (vacía) en la misma
        # llamada async. La ruta /convert devuelve el contrato directo y al
        # serializar ContractResponse.milestones se haría lazy-load → MissingGreenlet.
        await self.db.refresh(contract, attribute_names=["milestones"])
        return contract
