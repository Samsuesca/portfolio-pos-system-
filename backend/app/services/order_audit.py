"""
Order Audit Service — aplica/consulta el acta forense de encargos (GATE 0).

Aplica una decisión por encargo sin tocar el estado público (`orders.status`):
- ``PAYMENT_RETRO`` (grupo A): materializa la caja real no registrada reusando
  el flujo canónico de pago (paid_amount + Transaction INCOME + CxC), con fecha
  de reconocimiento explícita para que el ingreso caiga en el periodo correcto.
- ``PHANTOM_EXCHANGE`` / ``CANCELLED`` / ``WRITE_OFF`` / ``LEGIT_RECEIVABLE``:
  no mueven plata; solo registran la fila de override que los reportes honran.

Idempotente: ``order_id`` es UNIQUE; ``apply_override`` retorna el override
existente sin re-materializar caja si el encargo ya fue procesado.
"""
from __future__ import annotations

from decimal import Decimal
from datetime import datetime, date
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.order import Order, OrderStatus
from app.models.order_audit_override import OrderAuditOverride, OrderAuditDisposition
from app.models.accounting import (
    Transaction,
    TransactionType,
    AccPaymentMethod,
    AccountsReceivable,
)
from app.utils.timezone import get_colombia_now_naive


def order_audit_resolved_exists(order_id_col):
    """Cláusula EXISTS correlacionada: el encargo de ``order_id_col`` tiene un
    override de auditoría que lo resuelve a saldo real 0 (grupos E/D/C/Jennifer).

    Úsala con ``~order_audit_resolved_exists(AccountsReceivable.order_id)`` para
    excluir del aging las CxC de encargos ya resueltos por la auditoría, o con
    ``order_audit_resolved_exists(Order.id)`` para excluirlos del revenue
    accrual. Los encargos del grupo B (``real_balance`` NULL) NO se excluyen:
    siguen siendo CxC reales vigentes.
    """
    return (
        select(OrderAuditOverride.id)
        .where(
            OrderAuditOverride.order_id == order_id_col,
            OrderAuditOverride.real_balance == 0,
        )
        .exists()
    )


def order_audit_revenue_excluded_exists(order_id_col):
    """Cláusula EXISTS: el encargo debe excluirse del revenue **accrual** porque
    su override lo marca cambio fantasma (duplica el ingreso de la venta
    original) o cancelado (cliente no llevó, sin ingreso).

    NO excluye ``write_off`` (la venta fue real; solo el saldo de centavos es
    incobrable) ni ``payment_retro`` (ingreso legítimo).
    """
    return (
        select(OrderAuditOverride.id)
        .where(
            OrderAuditOverride.order_id == order_id_col,
            OrderAuditOverride.disposition.in_(
                [
                    OrderAuditDisposition.PHANTOM_EXCHANGE,
                    OrderAuditDisposition.CANCELLED,
                ]
            ),
        )
        .exists()
    )


class OrderAuditService:
    """Servicio para aplicar/consultar overrides de auditoría de encargos."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_order(self, order_id: UUID) -> OrderAuditOverride | None:
        result = await self.db.execute(
            select(OrderAuditOverride).where(OrderAuditOverride.order_id == order_id)
        )
        return result.scalar_one_or_none()

    async def list_overrides(self) -> list[OrderAuditOverride]:
        result = await self.db.execute(
            select(OrderAuditOverride).order_by(OrderAuditOverride.order_code)
        )
        return list(result.scalars().all())

    async def apply_override(
        self,
        order: Order,
        *,
        disposition: OrderAuditDisposition,
        audit_explanation: str,
        real_status: OrderStatus | None = None,
        real_paid_amount: Decimal | None = None,
        real_balance: Decimal | None = None,
        recognize_payment: Decimal | None = None,
        recognition_date: date | None = None,
        external_evidence: str | None = None,
        notify_client: bool = False,
        auditor_user_id: UUID | None = None,
        audited_at: datetime | None = None,
    ) -> OrderAuditOverride:
        """Aplica una decisión de auditoría a un encargo.

        Idempotente: si ya existe override para ``order.id``, lo retorna sin
        re-aplicar (no re-materializa caja).
        """
        existing = await self.get_by_order(order.id)
        if existing:
            return existing

        transaction_id: UUID | None = None
        if (
            disposition == OrderAuditDisposition.PAYMENT_RETRO
            and recognize_payment
            and recognize_payment > 0
        ):
            txn = await self._recognize_cash(
                order, recognize_payment, recognition_date, auditor_user_id
            )
            transaction_id = txn.id
            if real_paid_amount is None:
                real_paid_amount = order.total
            if real_balance is None:
                real_balance = Decimal("0")

        override = OrderAuditOverride(
            order_id=order.id,
            order_code=order.code,
            disposition=disposition,
            real_status=real_status,
            real_paid_amount=real_paid_amount,
            real_balance=real_balance,
            audit_explanation=audit_explanation,
            notify_client=notify_client,
            external_evidence=external_evidence,
            transaction_id=transaction_id,
            auditor_user_id=auditor_user_id,
            audited_at=audited_at or get_colombia_now_naive(),
        )
        self.db.add(override)
        await self.db.flush()
        return override

    async def _recognize_cash(
        self,
        order: Order,
        amount: Decimal,
        recognition_date: date | None,
        user_id: UUID | None,
    ) -> Transaction:
        """Materializa caja real no registrada.

        Mismo flujo que ``OrderService.add_payment`` (paid_amount + Transaction
        INCOME con integración de balance + CxC) pero con fecha de
        reconocimiento explícita. NO toca ``orders.status``.
        """
        new_paid = order.paid_amount + amount
        if new_paid > order.total:
            raise ValueError(
                f"Reconocer {amount} en {order.code} excede el total "
                f"{order.total} (pagado {order.paid_amount})."
            )
        order.paid_amount = new_paid
        await self.db.flush()

        from app.services.accounting.transactions import TransactionService

        txn_service = TransactionService(self.db)
        txn = await txn_service.record(
            type=TransactionType.INCOME,
            amount=amount,
            payment_method=AccPaymentMethod.CASH,
            description=f"Override audit: pago retroactivo encargo {order.code}",
            school_id=order.school_id,
            category="orders",
            reference_code=order.code,
            transaction_date=recognition_date,  # None ⇒ hoy (Colombia)
            order_id=order.id,
            created_by=user_id,
        )

        result = await self.db.execute(
            select(AccountsReceivable).where(
                AccountsReceivable.order_id == order.id,
                AccountsReceivable.is_paid.is_(False),
            )
        )
        for receivable in result.scalars().all():
            receivable.amount_paid = receivable.amount_paid + amount
            if receivable.amount_paid >= receivable.amount:
                receivable.is_paid = True
        await self.db.flush()
        return txn
