"""
Tests del fix de CxC fantasma en encargos-desde-cambio.

create_order(record_advance_transaction=False) fija paid_amount SIN registrar la
Transaction de anticipo. Lo usa el encargo generado por un cambio de venta, donde
la caja real ya se registró en el flujo de cambios: registrarla de nuevo
duplicaría el ingreso, y abrir una CxC por el precio completo crea CxC fantasma.
"""
import pytest
from decimal import Decimal
from uuid import uuid4

from sqlalchemy import select

from app.services.order import OrderService
from app.models.user import User
from app.models.accounting import AccountsReceivable, Transaction
from app.schemas.order import OrderCreate, OrderItemCreate


async def _setup(db, school_factory, client_factory, garment_type_factory, product_factory, price="50000"):
    school = school_factory(); db.add(school)
    user = User(
        id=str(uuid4()), username=f"u_{uuid4().hex[:8]}", email=f"{uuid4().hex[:8]}@t.com",
        hashed_password="x", is_active=True, is_superuser=False,
    )
    db.add(user)
    await db.flush()
    client = client_factory(school_id=school.id); db.add(client)
    gt = garment_type_factory(school_id=school.id); db.add(gt)
    await db.flush()
    prod = product_factory(school_id=school.id, garment_type_id=gt.id, price=Decimal(price))
    db.add(prod)
    await db.flush()
    return school, user, client, gt, prod


def _order_data(school, client, gt, prod, price, advance):
    return OrderCreate(
        school_id=school.id, client_id=client.id, advance_payment=Decimal(advance),
        items=[OrderItemCreate(
            garment_type_id=gt.id, product_id=prod.id, quantity=1,
            unit_price=Decimal(price), order_type="catalog", reserve_stock=False,
        )],
    )


@pytest.mark.asyncio
class TestCreateOrderAdvanceTransaction:
    async def test_no_phantom_cxc_ni_txn_cuando_advance_igual_total(
        self, db_session, school_factory, client_factory, garment_type_factory, product_factory
    ):
        """Caso no-crédito: el encargo nace pagado (advance=total) → sin CxC ni transacción."""
        school, user, client, gt, prod = await _setup(
            db_session, school_factory, client_factory, garment_type_factory, product_factory
        )
        od = _order_data(school, client, gt, prod, price="50000", advance="50000")
        order = await OrderService(db_session).create_order(od, user.id, record_advance_transaction=False)

        assert order.total == Decimal("50000")
        assert order.paid_amount == Decimal("50000")
        assert order.balance == Decimal("0")
        ar = (await db_session.execute(
            select(AccountsReceivable).where(AccountsReceivable.order_id == order.id)
        )).scalars().all()
        assert ar == []                          # sin CxC fantasma
        txn = (await db_session.execute(
            select(Transaction).where(Transaction.order_id == order.id)
        )).scalars().all()
        assert txn == []                         # sin transacción duplicada

    async def test_credito_con_diferencia_crea_AR_solo_por_el_ajuste(
        self, db_session, school_factory, client_factory, garment_type_factory, product_factory
    ):
        """Caso crédito con diferencia: el encargo carga AR SOLO por el ajuste, no el total."""
        school, user, client, gt, prod = await _setup(
            db_session, school_factory, client_factory, garment_type_factory, product_factory
        )
        # total 50000, debe solo el ajuste 1000 → advance = 49000
        od = _order_data(school, client, gt, prod, price="50000", advance="49000")
        order = await OrderService(db_session).create_order(od, user.id, record_advance_transaction=False)

        assert order.balance == Decimal("1000")
        ar = (await db_session.execute(
            select(AccountsReceivable).where(AccountsReceivable.order_id == order.id)
        )).scalars().all()
        assert len(ar) == 1
        assert ar[0].amount == Decimal("1000")   # CxC = solo el ajuste
        txn = (await db_session.execute(
            select(Transaction).where(Transaction.order_id == order.id)
        )).scalars().all()
        assert txn == []

    async def test_default_si_registra_transaccion(
        self, db_session, school_factory, client_factory, garment_type_factory, product_factory
    ):
        """Sin el flag (default True) el comportamiento normal se preserva: registra la transacción."""
        school, user, client, gt, prod = await _setup(
            db_session, school_factory, client_factory, garment_type_factory, product_factory
        )
        od = _order_data(school, client, gt, prod, price="50000", advance="20000")
        order = await OrderService(db_session).create_order(od, user.id)  # default

        txn = (await db_session.execute(
            select(Transaction).where(Transaction.order_id == order.id)
        )).scalars().all()
        assert len(txn) == 1                     # anticipo registrado normal
        assert txn[0].amount == Decimal("20000")
