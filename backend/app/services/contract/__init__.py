"""
Contract Service Package (B2B — GLOBAL/corporativo, sin school_id)

Compone los mixins del ciclo de vida contable de un contrato B2B made-to-order
en una sola clase ``ContractService``:

- ContractServiceBase:        constructor sobre BaseService[Contract]
- ContractNumberingMixin:     _generate_contract_code (CTR-YYYY-NNNN, GLOBAL)
- ContractLifecycleMixin:     FSM de estados (_assert_transition)
- ContractAccountingMixin:    asientos (anticipo=pasivo, entrega=ingreso, COGS, CxC)
- ContractDeliveryMixin:      register_deposit, deliver_contract
- ContractMilestoneMixin:     deliver_milestone (prorrateo + cierre de redondeo)
- ContractCancellationMixin:  cancel_contract (política de retención de anticipo)
- ContractQueryMixin:         get_contract_with_milestones, list_contracts, create_contract

Regla contable central (Fase B3): el anticipo NO es ingreso (es pasivo 2110
"Anticipos de Clientes"). El ingreso se reconoce SOLO contra la entrega.

Import as: from app.services.contract import ContractService
"""
from sqlalchemy.ext.asyncio import AsyncSession

from .base import ContractServiceBase
from .numbering import ContractNumberingMixin
from .lifecycle import ContractLifecycleMixin, VALID_TRANSITIONS
from .accounting import ContractAccountingMixin
from .delivery import ContractDeliveryMixin
from .milestones import ContractMilestoneMixin
from .cancellation import ContractCancellationMixin
from .queries import ContractQueryMixin


class ContractService(
    ContractServiceBase,
    ContractNumberingMixin,
    ContractLifecycleMixin,
    ContractAccountingMixin,
    ContractDeliveryMixin,
    ContractMilestoneMixin,
    ContractCancellationMixin,
    ContractQueryMixin,
):
    """Service for B2B Contract operations (GLOBAL, sin school_id)."""

    def __init__(self, db: AsyncSession):
        super().__init__(db)


__all__ = ["ContractService", "VALID_TRANSITIONS"]
