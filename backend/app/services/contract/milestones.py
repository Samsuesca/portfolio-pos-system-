"""
Contract Milestones Mixin — entrega por hitos (partial_delivery).

Cada hito reconoce ingreso/COGS proporcional al monto del hito; el anticipo se
aplica prorrateado (``deposit_amount * m.amount / total``). El residuo de
redondeo se cierra en el ÚLTIMO hito para que ``Σ applied_deposit_m`` cuadre
exacto con ``deposit_amount`` al centavo.
"""
from datetime import date
from decimal import Decimal
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.models.accounting import AccPaymentMethod
from app.models.b2b import (
    Contract,
    ContractStatus,
    ContractMilestone,
    MilestoneStatus,
)
from app.utils.timezone import get_colombia_date, get_colombia_now_naive
from app.services.contract.accounting import _q


class ContractMilestoneMixin:
    """Mixin con ``deliver_milestone``."""

    async def deliver_milestone(
        self,
        contract_id: UUID,
        milestone_id: UUID,
        delivery_date: date | None = None,
        cogs_amount: Decimal | None = None,
        settlement_method: AccPaymentMethod = AccPaymentMethod.CASH,
        user_id: UUID | None = None,
    ) -> Contract:
        """Registra la entrega de un hito.

        Mismos asientos que la entrega total, pero con ``recognized=m.amount`` y
        el anticipo prorrateado. Tras entregar todos los hitos el contrato pasa
        a DELIVERED; si quedan pendientes, a PARTIAL_DELIVERY.
        """
        contract = await self._get_contract_with_milestones(contract_id)
        if not contract:
            raise ValueError("Contrato no encontrado")

        if not contract.has_milestones or not contract.milestones:
            raise ValueError("El contrato no tiene hitos de entrega")

        milestone = next(
            (m for m in contract.milestones if m.id == milestone_id), None
        )
        if milestone is None:
            raise ValueError("Hito no encontrado")

        if self._milestone_status(milestone) != MilestoneStatus.PENDING:
            raise ValueError("El hito ya fue entregado")

        # Estado destino del contrato: DELIVERED si este es el último pendiente.
        pending = [
            m for m in contract.milestones
            if self._milestone_status(m) == MilestoneStatus.PENDING
        ]
        is_last = len(pending) == 1  # solo queda este por entregar
        target = ContractStatus.DELIVERED if is_last else ContractStatus.PARTIAL_DELIVERY
        self._assert_transition(contract.status, target)

        b2b_client = await self._get_b2b_client(contract.b2b_client_id)
        terms = b2b_client.payment_terms_days if b2b_client else 0

        deliver_date = delivery_date or get_colombia_date()

        total = _q(contract.total)
        deposit = _q(contract.deposit_amount)
        m_amount = _q(milestone.amount)

        # Prorrateo del anticipo. En el último hito se cierra el residuo para que
        # Σ(applied_deposit_m) == deposit_amount exacto.
        if is_last:
            already_applied = self._sum_applied_deposit(contract, exclude_id=milestone.id)
            applied_deposit = _q(deposit - already_applied)
        elif total > Decimal("0"):
            applied_deposit = _q(deposit * m_amount / total)
        else:
            applied_deposit = Decimal("0")

        if applied_deposit < Decimal("0"):
            applied_deposit = Decimal("0")
        if applied_deposit > m_amount:
            applied_deposit = m_amount

        balance = _q(m_amount - applied_deposit)
        label = f"hito {milestone.sequence}"

        await self._recognize_delivery_entries(
            contract=contract,
            applied_deposit=applied_deposit,
            balance=balance,
            settlement_method=settlement_method,
            payment_terms_days=terms,
            cogs_amount=cogs_amount,
            recognized_total=m_amount,
            milestone_label=label,
            deliver_date=deliver_date,
            user_id=user_id,
        )

        milestone.status = MilestoneStatus.DELIVERED
        milestone.delivered_at = get_colombia_now_naive()

        contract.status = target
        if target == ContractStatus.DELIVERED:
            contract.delivered_at = get_colombia_now_naive()
            contract.delivery_date = deliver_date

        await self.db.flush()
        await self.db.refresh(contract, attribute_names=["milestones"])
        return contract

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    async def _get_contract_with_milestones(
        self, contract_id: UUID
    ) -> Contract | None:
        result = await self.db.execute(
            select(Contract)
            .options(selectinload(Contract.milestones))
            .where(Contract.id == contract_id)
        )
        return result.scalar_one_or_none()

    @staticmethod
    def _milestone_status(milestone: ContractMilestone) -> MilestoneStatus:
        value = milestone.status
        return value if isinstance(value, MilestoneStatus) else MilestoneStatus(value)

    def _sum_applied_deposit(
        self, contract: Contract, exclude_id: UUID
    ) -> Decimal:
        """Suma del anticipo ya prorrateado en hitos previos (no-último).

        Recalcula con la misma fórmula proporcional sobre los hitos ya
        entregados para reconstruir cuánto anticipo se aplicó antes y cerrar el
        residuo en el último. Los hitos pendientes (salvo el actual) no cuentan.
        """
        total = _q(contract.total)
        if total <= Decimal("0"):
            return Decimal("0")
        deposit = _q(contract.deposit_amount)
        applied = Decimal("0")
        for m in contract.milestones:
            if m.id == exclude_id:
                continue
            if self._milestone_status(m) == MilestoneStatus.DELIVERED:
                applied += _q(deposit * _q(m.amount) / total)
        return _q(applied)
