"""
Contract Delivery Mixin — registrar anticipo y entrega total.

Implementa la secuencia exacta de asientos del spec B3. Los métodos hacen
``flush()``; la ruta controla el ``commit()``. Si algo falla a mitad, el
rollback deja las cuentas y el estado del contrato sin tocar.
"""
from datetime import date
from decimal import Decimal
from uuid import UUID

from app.models.accounting import AccPaymentMethod
from app.models.b2b import Contract, ContractStatus, B2BClient, MilestoneStatus
from app.utils.timezone import get_colombia_date, get_colombia_now_naive
from app.services.contract.accounting import _q


class ContractDeliveryMixin:
    """Mixin con ``register_deposit`` y ``deliver_contract``."""

    # ------------------------------------------------------------------
    # (1) REGISTRAR ANTICIPO — pending_deposit → in_production
    # ------------------------------------------------------------------

    async def register_deposit(
        self,
        contract_id: UUID,
        payment_method: AccPaymentMethod,
        amount: Decimal | None = None,
        payment_date: date | None = None,
        user_id: UUID | None = None,
    ) -> Contract:
        """Registra el anticipo del contrato.

        El anticipo NO es ingreso: dos BalanceEntry manuales (Caja+ / 2110+),
        SIN Transaction, SIN P&L. ``Δ(caja) == Δ(2110) == +deposit``.
        """
        contract = await self.get(contract_id)
        if not contract:
            raise ValueError("Contrato no encontrado")

        self._require_status(
            contract.status, {ContractStatus.PENDING_DEPOSIT}, "registrar el anticipo"
        )

        deposit = _q(amount) if amount is not None else _q(contract.deposit_amount)
        if deposit <= Decimal("0"):
            raise ValueError("El monto del anticipo debe ser mayor a 0")
        if deposit > _q(contract.total):
            raise ValueError("El anticipo no puede exceder el total del contrato")

        entry_date = payment_date or get_colombia_date()
        ref = contract.contract_number

        # Asiento A — pata caja (ASSET +)
        await self._post_cash_entry(
            payment_method=payment_method,
            amount=deposit,
            reference=ref,
            description=f"Anticipo contrato {ref}",
            entry_date=entry_date,
            created_by=user_id,
        )
        # Asiento B — pata pasivo 2110 (LIABILITY +)
        await self._post_liability_entry(
            amount=deposit,
            reference=ref,
            description=f"Anticipo recibido {ref}",
            entry_date=entry_date,
            created_by=user_id,
        )

        contract.status = ContractStatus.IN_PRODUCTION
        contract.deposit_received_at = get_colombia_now_naive()
        contract.deposit_payment_method = (
            payment_method.value if hasattr(payment_method, "value") else str(payment_method)
        )
        if amount is not None and deposit != contract.deposit_amount:
            contract.deposit_amount = deposit
            contract.balance_amount = _q(contract.total - deposit)

        await self.db.flush()
        await self.db.refresh(contract, attribute_names=["milestones"])
        return contract

    # ------------------------------------------------------------------
    # (2) ENTREGA TOTAL — in_production/partial_delivery → delivered
    # ------------------------------------------------------------------

    async def deliver_contract(
        self,
        contract_id: UUID,
        delivery_date: date | None = None,
        cogs_amount: Decimal | None = None,
        settlement_method: AccPaymentMethod = AccPaymentMethod.CASH,
        user_id: UUID | None = None,
    ) -> Contract:
        """Registra la entrega total del contrato.

        (a1) Reconoce ingreso de la porción anticipada con CREDIT (P&L+, caja 0).
        (b)  Reversa el pasivo 2110 por el anticipo aplicado (LIABILITY -).
        (a2) Reconoce ingreso del saldo: contado → caja+; crédito → CREDIT + CxC.
        (d)  COGS opcional (gated por cogs_amount).
        """
        # Cargar con hitos: si ya hubo entregas parciales hay que reconocer solo
        # el REMANENTE (no doble-contar lo ya reconocido por hito).
        contract = await self._get_contract_with_milestones(contract_id)
        if not contract:
            raise ValueError("Contrato no encontrado")

        self._require_status(
            contract.status,
            {ContractStatus.IN_PRODUCTION, ContractStatus.PARTIAL_DELIVERY},
            "entregar el contrato",
        )

        b2b_client = await self._get_b2b_client(contract.b2b_client_id)
        terms = b2b_client.payment_terms_days if b2b_client else 0

        deliver_date = delivery_date or get_colombia_date()

        total = _q(contract.total)
        deposit = _q(contract.deposit_amount)

        delivered_ms = [
            m for m in (contract.milestones or [])
            if self._milestone_status(m) == MilestoneStatus.DELIVERED
        ]
        if delivered_ms:
            # Reconocer solo lo no entregado aún. El anticipo aplicado en los
            # hitos previos se descuenta (misma fórmula proporcional que usó
            # cada hito) para que Σ anticipo aplicado == deposit exacto.
            delivered_amount = _q(sum((_q(m.amount) for m in delivered_ms), Decimal("0")))
            already_applied = (
                _q(sum((_q(deposit * _q(m.amount) / total) for m in delivered_ms), Decimal("0")))
                if total > Decimal("0") else Decimal("0")
            )
            recognized_total = _q(total - delivered_amount)
            applied_deposit = _q(deposit - already_applied)
            if applied_deposit < Decimal("0"):
                applied_deposit = Decimal("0")
            if applied_deposit > recognized_total:
                applied_deposit = recognized_total
            balance = _q(recognized_total - applied_deposit)
            # Cierra los hitos pendientes (esta entrega total los cubre todos).
            for m in contract.milestones:
                if self._milestone_status(m) == MilestoneStatus.PENDING:
                    m.status = MilestoneStatus.DELIVERED
                    m.delivered_at = get_colombia_now_naive()
        else:
            recognized_total = total
            applied_deposit = deposit
            balance = _q(contract.balance_amount)

        await self._recognize_delivery_entries(
            contract=contract,
            applied_deposit=applied_deposit,
            balance=balance,
            settlement_method=settlement_method,
            payment_terms_days=terms,
            cogs_amount=cogs_amount,
            recognized_total=recognized_total,
            milestone_label=None,
            deliver_date=deliver_date,
            user_id=user_id,
        )

        contract.status = ContractStatus.DELIVERED
        contract.delivered_at = get_colombia_now_naive()
        contract.delivery_date = deliver_date

        await self.db.flush()
        await self.db.refresh(contract, attribute_names=["milestones"])
        return contract

    # ------------------------------------------------------------------
    # Asientos compartidos de entrega (total y por hito)
    # ------------------------------------------------------------------

    async def _recognize_delivery_entries(
        self,
        *,
        contract: Contract,
        applied_deposit: Decimal,
        balance: Decimal,
        settlement_method: AccPaymentMethod,
        payment_terms_days: int,
        cogs_amount: Decimal | None,
        recognized_total: Decimal,
        milestone_label: str | None,
        deliver_date: date,
        user_id: UUID | None,
    ) -> None:
        """Secuencia de asientos de una entrega (total o de un hito).

        ``recognized_total`` debe ser ``applied_deposit + balance``.
        """
        ref = contract.contract_number
        suffix = f" {milestone_label}" if milestone_label else ""

        # (a1) Porción cubierta por el anticipo → INCOME con CREDIT (P&L+, caja 0)
        if applied_deposit > Decimal("0"):
            await self._recognize_income(
                amount=applied_deposit,
                payment_method=AccPaymentMethod.CREDIT,
                reference=ref,
                description=f"Reconocimiento ingreso (anticipo) contrato {ref}{suffix}",
                transaction_date=deliver_date,
                created_by=user_id,
            )
            # (b) Reversa del pasivo 2110 (LIABILITY -)
            await self._post_liability_entry(
                amount=-applied_deposit,
                reference=ref,
                description=f"Aplicación anticipo a entrega {ref}{suffix}",
                entry_date=deliver_date,
                created_by=user_id,
            )

        # (a2) Porción del saldo
        if balance > Decimal("0"):
            if payment_terms_days and payment_terms_days > 0:
                # Crédito: ingreso devengado (CREDIT, caja 0) + CxC
                await self._recognize_income(
                    amount=balance,
                    payment_method=AccPaymentMethod.CREDIT,
                    reference=ref,
                    description=f"Reconocimiento ingreso (saldo a crédito) contrato {ref}{suffix}",
                    transaction_date=deliver_date,
                    created_by=user_id,
                )
                due_date = self._credit_due_date(deliver_date, payment_terms_days)
                await self._create_b2b_receivable(
                    contract=contract,
                    amount=balance,
                    invoice_date=deliver_date,
                    due_date=due_date,
                    description=f"Saldo contrato {ref}{suffix}",
                    created_by=user_id,
                )
            else:
                # Contado: ingreso + caja
                await self._recognize_income(
                    amount=balance,
                    payment_method=settlement_method,
                    reference=ref,
                    description=f"Reconocimiento ingreso (saldo contado) contrato {ref}{suffix}",
                    transaction_date=deliver_date,
                    created_by=user_id,
                )

        # (d) COGS opcional
        if cogs_amount is not None and _q(cogs_amount) > Decimal("0"):
            await self._recognize_cogs(
                amount=_q(cogs_amount),
                reference=ref,
                description=f"COGS contrato {ref}{suffix}",
                expense_date=deliver_date,
                created_by=user_id,
            )

    async def _get_b2b_client(self, b2b_client_id: UUID) -> B2BClient | None:
        from sqlalchemy import select

        result = await self.db.execute(
            select(B2BClient).where(B2BClient.id == b2b_client_id)
        )
        return result.scalar_one_or_none()
