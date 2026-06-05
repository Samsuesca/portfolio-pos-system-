"""
Tests de OrderAuditService + helpers de integración de reportes (encargos GATE 0).

Cubre la invariante central del arreglo: la auditoría materializa la verdad
contable (caja del grupo A, overrides) SIN tocar ``orders.status`` público, y
los helpers de reporte excluyen correctamente lo resuelto.
"""
import pytest
from decimal import Decimal
from uuid import uuid4
from datetime import date

from sqlalchemy import select, func

from app.models.order import OrderStatus
from app.models.user import User
from app.models.accounting import AccountsReceivable, Transaction, TransactionType
from app.models.order_audit_override import OrderAuditDisposition
from app.services.order_audit import (
    OrderAuditService,
    order_audit_resolved_exists,
    order_audit_revenue_excluded_exists,
)

D = OrderAuditDisposition


async def _make_order(
    db, school_factory, client_factory, order_factory,
    *, status=OrderStatus.READY, total="100000", paid="0", with_ar=True,
    delivered_at=None,
):
    school = school_factory()
    db.add(school)
    user = User(
        id=str(uuid4()), username=f"u_{uuid4().hex[:8]}",
        email=f"{uuid4().hex[:8]}@test.com", hashed_password="x",
        is_active=True, is_superuser=False,
    )
    db.add(user)
    await db.flush()
    client = client_factory(school_id=school.id)
    db.add(client)
    await db.flush()
    order = order_factory(
        school_id=school.id, client_id=client.id, user_id=user.id,
        status=status, total=Decimal(total), paid_amount=Decimal(paid),
        delivered_at=delivered_at,
    )
    db.add(order)
    await db.flush()
    if with_ar:
        ar = AccountsReceivable(
            id=str(uuid4()), school_id=school.id, client_id=client.id, order_id=order.id,
            amount=Decimal(total) - Decimal(paid), amount_paid=Decimal("0"),
            description=f"Saldo encargo {order.code}",
            due_date=date(2026, 4, 1), invoice_date=date(2026, 2, 1), is_paid=False,
        )
        db.add(ar)
        await db.flush()
    return order


@pytest.mark.asyncio
class TestOrderAuditService:
    async def test_phantom_exchange_no_cash_no_status_change(
        self, db_session, school_factory, client_factory, order_factory
    ):
        order = await _make_order(
            db_session, school_factory, client_factory, order_factory,
            status=OrderStatus.READY, total="48000", paid="0",
        )
        txn_before = (await db_session.execute(select(func.count(Transaction.id)))).scalar()

        ov = await OrderAuditService(db_session).apply_override(
            order, disposition=D.PHANTOM_EXCHANGE,
            audit_explanation="cambio fantasma ya cobrado en venta original",
            real_balance=Decimal("0"),
        )
        await db_session.refresh(order)

        assert ov.real_balance == Decimal("0")
        assert order.status == OrderStatus.READY          # status público intacto
        assert order.paid_amount == Decimal("0")          # NO movió plata
        txn_after = (await db_session.execute(select(func.count(Transaction.id)))).scalar()
        assert txn_after == txn_before

    async def test_payment_retro_materializes_cash_keeps_public_status(
        self, db_session, school_factory, client_factory, order_factory
    ):
        order = await _make_order(
            db_session, school_factory, client_factory, order_factory,
            status=OrderStatus.READY, total="90000", paid="0",
        )
        ov = await OrderAuditService(db_session).apply_override(
            order, disposition=D.PAYMENT_RETRO,
            audit_explanation="pago no registrado; vendedora confirmó",
            real_status=OrderStatus.DELIVERED, recognize_payment=order.balance,
        )
        await db_session.refresh(order)

        # PUBLIC status untouched; la realidad va solo en el override
        assert order.status == OrderStatus.READY
        assert ov.real_status == OrderStatus.DELIVERED
        assert ov.notify_client is False
        # caja materializada
        assert order.paid_amount == Decimal("90000")
        assert order.balance == Decimal("0")
        assert ov.transaction_id is not None
        txn = (await db_session.execute(
            select(Transaction).where(Transaction.id == ov.transaction_id)
        )).scalar_one()
        assert txn.type == TransactionType.INCOME
        assert txn.amount == Decimal("90000")
        assert txn.order_id == order.id
        # AR marcada pagada
        ar = (await db_session.execute(
            select(AccountsReceivable).where(AccountsReceivable.order_id == order.id)
        )).scalar_one()
        assert ar.is_paid is True

    async def test_apply_override_is_idempotent_no_double_cash(
        self, db_session, school_factory, client_factory, order_factory
    ):
        order = await _make_order(
            db_session, school_factory, client_factory, order_factory,
            status=OrderStatus.DELIVERED, total="50000", paid="0",
        )
        service = OrderAuditService(db_session)
        ov1 = await service.apply_override(
            order, disposition=D.PAYMENT_RETRO, audit_explanation="x",
            recognize_payment=order.balance,
        )
        await db_session.refresh(order)
        paid_after_first = order.paid_amount
        txn_count = (await db_session.execute(select(func.count(Transaction.id)))).scalar()

        ov2 = await service.apply_override(
            order, disposition=D.PAYMENT_RETRO, audit_explanation="x",
            recognize_payment=order.balance,
        )
        await db_session.refresh(order)

        assert ov2.id == ov1.id                            # misma fila
        assert order.paid_amount == paid_after_first       # sin doble caja
        txn_after = (await db_session.execute(select(func.count(Transaction.id)))).scalar()
        assert txn_after == txn_count

    async def test_recognize_payment_over_total_raises(
        self, db_session, school_factory, client_factory, order_factory
    ):
        order = await _make_order(
            db_session, school_factory, client_factory, order_factory,
            total="10000", paid="0",
        )
        with pytest.raises(ValueError):
            await OrderAuditService(db_session).apply_override(
                order, disposition=D.PAYMENT_RETRO, audit_explanation="x",
                recognize_payment=Decimal("20000"),  # > total
            )


@pytest.mark.asyncio
class TestReportHelpers:
    async def test_resolved_exists_matches_zero_balance_not_legit(
        self, db_session, school_factory, client_factory, order_factory
    ):
        resolved = await _make_order(
            db_session, school_factory, client_factory, order_factory, total="48000",
        )
        legit = await _make_order(
            db_session, school_factory, client_factory, order_factory, total="99000",
        )
        service = OrderAuditService(db_session)
        await service.apply_override(
            resolved, disposition=D.PHANTOM_EXCHANGE, audit_explanation="x",
            real_balance=Decimal("0"),
        )
        await service.apply_override(
            legit, disposition=D.LEGIT_RECEIVABLE, audit_explanation="x",
        )  # real_balance = None → NO resuelto

        async def _resolved(order):
            return (await db_session.execute(
                select(order_audit_resolved_exists(order.id))
            )).scalar()

        assert await _resolved(resolved) is True
        assert await _resolved(legit) is False

    async def test_revenue_excluded_matches_phantom_cancelled_not_writeoff(
        self, db_session, school_factory, client_factory, order_factory
    ):
        phantom = await _make_order(db_session, school_factory, client_factory, order_factory, total="45000")
        cancelled = await _make_order(db_session, school_factory, client_factory, order_factory, total="99000")
        writeoff = await _make_order(db_session, school_factory, client_factory, order_factory, total="1000")
        service = OrderAuditService(db_session)
        await service.apply_override(phantom, disposition=D.PHANTOM_EXCHANGE, audit_explanation="x", real_balance=Decimal("0"))
        await service.apply_override(cancelled, disposition=D.CANCELLED, audit_explanation="x", real_balance=Decimal("0"))
        await service.apply_override(writeoff, disposition=D.WRITE_OFF, audit_explanation="x", real_balance=Decimal("0"))

        async def _excluded(order):
            return (await db_session.execute(
                select(order_audit_revenue_excluded_exists(order.id))
            )).scalar()

        assert await _excluded(phantom) is True
        assert await _excluded(cancelled) is True
        assert await _excluded(writeoff) is False     # write_off NO se excluye del revenue
