"""
Contract Cancellation Mixin — cancelar contrato según política de anticipo.

Política documentada:
- pending_deposit (sin anticipo): solo marca CANCELLED. Sin asientos.
- in_production (anticipo recibido, nada entregado):
    retain_deposit=False → reversa pasivo (2110 -) y devuelve caja (ASSET -).
    retain_deposit=True  → reversa pasivo (2110 -) y reconoce ingreso por
                           penalidad (INCOME CREDIT, category=b2b_penalty); la
                           caja conserva el efectivo del anticipo.
- partial_delivery/delivered: NO se cancela libremente (ya hay ingreso/COGS
  reconocido) → requiere flujo de devolución/nota crédito (fuera de scope B3).
"""
from uuid import UUID

from app.models.accounting import AccPaymentMethod
from app.models.b2b import Contract, ContractStatus
from app.utils.timezone import get_colombia_date
from app.services.contract.accounting import _q
from app.services.contract.lifecycle import as_contract_status


class ContractCancellationMixin:
    """Mixin con ``cancel_contract``."""

    async def cancel_contract(
        self,
        contract_id: UUID,
        retain_deposit: bool = False,
        reason: str | None = None,
        user_id: UUID | None = None,
    ) -> Contract:
        contract = await self.get(contract_id)
        if not contract:
            raise ValueError("Contrato no encontrado")

        status = as_contract_status(contract.status)
        self._require_status(
            status,
            {ContractStatus.PENDING_DEPOSIT, ContractStatus.IN_PRODUCTION},
            "cancelar el contrato",
        )

        ref = contract.contract_number
        entry_date = get_colombia_date()
        deposit = _q(contract.deposit_amount)

        if status == ContractStatus.IN_PRODUCTION and deposit > 0 and contract.deposit_received_at:
            if retain_deposit:
                # Reversa pasivo + reconoce ingreso por penalidad (caja intacta).
                await self._post_liability_entry(
                    amount=-deposit,
                    reference=ref,
                    description=f"Anticipo retenido como ingreso (cancelación) {ref}",
                    entry_date=entry_date,
                    created_by=user_id,
                )
                await self._recognize_income(
                    amount=deposit,
                    payment_method=AccPaymentMethod.CREDIT,
                    reference=ref,
                    description=f"Penalidad por cancelación contrato {ref}",
                    transaction_date=entry_date,
                    category="b2b_penalty",
                    created_by=user_id,
                )
            else:
                # Devolución del anticipo: reversa pasivo + salida de caja.
                await self._post_liability_entry(
                    amount=-deposit,
                    reference=ref,
                    description=f"Reversa anticipo (cancelación) {ref}",
                    entry_date=entry_date,
                    created_by=user_id,
                )
                refund_method = self._refund_cash_method(contract)
                await self._post_cash_entry(
                    payment_method=refund_method,
                    amount=-deposit,
                    reference=ref,
                    description=f"Devolución anticipo {ref}",
                    entry_date=entry_date,
                    created_by=user_id,
                )

        contract.status = ContractStatus.CANCELLED
        if reason:
            note = f"[Cancelado] {reason}"
            contract.notes = f"{contract.notes}\n{note}" if contract.notes else note

        await self.db.flush()
        await self.db.refresh(contract, attribute_names=["milestones"])
        return contract

    @staticmethod
    def _refund_cash_method(contract: Contract) -> AccPaymentMethod:
        """Cuenta de la que sale la devolución: la MISMA por la que entró el
        anticipo (``contract.deposit_payment_method``). Si no está registrado
        (contratos legados), cae a Caja como fallback simétrico al efectivo.
        """
        stored = contract.deposit_payment_method
        if stored:
            try:
                return AccPaymentMethod(stored)
            except ValueError:
                pass
        return AccPaymentMethod.CASH
