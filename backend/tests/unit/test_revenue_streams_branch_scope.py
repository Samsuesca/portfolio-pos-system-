"""Tests del scoping OPCIONAL por sucursal en revenue_streams (v3.1 — Fase 0b).

El test central es de NO-REGRESIÓN: con ``branch_id=None`` los calculadores
devuelven exactamente el mismo resultado que antes del retrofit (la columna
``branch_id`` no debe alterar nada cuando no se filtra). Cuando se pasa un
``branch_id`` concreto, solo cuentan las filas de esa sucursal.

Alterations y B2B no tienen columna ``branch_id``: pasarles un branch_id debe
ser inerte (no-op documentado), devolviendo el mismo total que con None.
"""
from datetime import date, datetime
from decimal import Decimal
from uuid import uuid4

from app.models.branch import Branch
from app.models.client import Client, ClientType
from app.models.product import GarmentType, Product
from app.models.sale import Sale, SaleItem, SaleStatus, PaymentMethod
from app.models.school import School
from app.models.user import User
from app.schemas.reports import RevenueBasis, RevenueStreamId
from app.services.revenue_streams import (
    SalesStreamCalculator,
    AlterationsStreamCalculator,
    B2BContractsStreamCalculator,
)


# ---------------------------------------------------------------------------
# Helpers locales (autosuficientes — no dependen del orden de fixtures)
# ---------------------------------------------------------------------------


async def _seed_base(db_session):
    """Crea school + user + client + product, los mínimos para una venta."""
    unique = uuid4().hex[:8]
    school = School(
        id=uuid4(), code=f"SC-{unique}", name=f"School {unique}",
        slug=f"school-{unique}", is_active=True,
    )
    user = User(
        id=uuid4(), username=f"u_{unique}", email=f"u_{unique}@test.com",
        hashed_password="x", is_active=True, is_superuser=False,
    )
    client = Client(
        id=uuid4(), code=f"CL-{unique}", name=f"Cliente {unique}",
        client_type=ClientType.REGULAR, is_active=True,
    )
    db_session.add_all([school, user, client])
    await db_session.flush()

    gt = GarmentType(
        id=uuid4(), school_id=school.id, name=f"Camisa {unique}",
        category="uniforme_diario", is_active=True,
    )
    db_session.add(gt)
    await db_session.flush()

    product = Product(
        id=uuid4(), school_id=school.id, garment_type_id=gt.id,
        code=f"PR-{unique}", name=f"Producto {unique}",
        size="T12", color="Blanco",
        price=Decimal("45000"), cost=Decimal("20000"), is_active=True,
    )
    db_session.add(product)
    await db_session.flush()
    return school, user, client, product


async def _make_branch(db_session, code: str) -> Branch:
    branch = Branch(id=uuid4(), name=f"Sucursal {code}", code=f"{code}-{uuid4().hex[:6]}")
    db_session.add(branch)
    await db_session.flush()
    return branch


async def _make_sale(db_session, school, user, client, product, *, branch_id, amount):
    unique = uuid4().hex[:8]
    sale = Sale(
        id=uuid4(), school_id=school.id, user_id=user.id, client_id=client.id,
        branch_id=branch_id,
        code=f"{school.code}-VNT-2026-{unique}",
        status=SaleStatus.COMPLETED, is_historical=False,
        total=Decimal(amount), paid_amount=Decimal(amount),
        payment_method=PaymentMethod.CASH,
        sale_date=datetime(2026, 3, 15, 12, 0, 0),
    )
    db_session.add(sale)
    await db_session.flush()
    db_session.add(SaleItem(
        id=uuid4(), sale_id=sale.id, product_id=product.id,
        quantity=1, unit_price=Decimal(amount), subtotal=Decimal(amount),
    ))
    await db_session.flush()
    return sale


_START = date(2026, 1, 1)
_END = date(2026, 12, 31)


# ---------------------------------------------------------------------------
# NO-REGRESIÓN: branch_id=None se comporta como antes del retrofit
# ---------------------------------------------------------------------------


async def test_sales_branch_none_matches_baseline(db_session):
    """branch_id=None ⇒ suma TODAS las ventas (NULL y CENTRAL), igual que hoy."""
    school, user, client, product = await _seed_base(db_session)
    central = await _make_branch(db_session, "CENTRAL")
    # Una venta sin sucursal (estado previo al backfill) y otra en CENTRAL.
    await _make_sale(db_session, school, user, client, product,
                     branch_id=None, amount="45000")
    await _make_sale(db_session, school, user, client, product,
                     branch_id=central.id, amount="30000")

    calc = SalesStreamCalculator(db_session)
    result = await calc.breakdown(
        _START, _END, None, None, RevenueBasis.ACCRUAL, include_cost=False,
    )

    assert result.revenue == Decimal("75000")
    assert result.count == 2


async def test_sales_branch_filter_scopes_to_branch(db_session):
    """branch_id=<central> ⇒ solo la venta de esa sucursal."""
    school, user, client, product = await _seed_base(db_session)
    central = await _make_branch(db_session, "CENTRAL")
    await _make_sale(db_session, school, user, client, product,
                     branch_id=None, amount="45000")
    await _make_sale(db_session, school, user, client, product,
                     branch_id=central.id, amount="30000")

    calc = SalesStreamCalculator(db_session)
    result = await calc.breakdown(
        _START, _END, None, central.id, RevenueBasis.ACCRUAL, include_cost=False,
    )

    assert result.revenue == Decimal("30000")
    assert result.count == 1


async def test_sales_branch_with_cost_path_scopes_too(db_session):
    """El branch filter también aplica en el path con COGS (include_cost=True)."""
    school, user, client, product = await _seed_base(db_session)
    central = await _make_branch(db_session, "CENTRAL")
    await _make_sale(db_session, school, user, client, product,
                     branch_id=None, amount="45000")
    await _make_sale(db_session, school, user, client, product,
                     branch_id=central.id, amount="30000")

    calc = SalesStreamCalculator(db_session)

    consolidated = await calc.breakdown(
        _START, _END, None, None, RevenueBasis.ACCRUAL, include_cost=True,
    )
    scoped = await calc.breakdown(
        _START, _END, None, central.id, RevenueBasis.ACCRUAL, include_cost=True,
    )

    assert consolidated.revenue == Decimal("75000")
    assert consolidated.count == 2
    assert scoped.revenue == Decimal("30000")
    assert scoped.count == 1
    # COGS = 20000/unidad: consolidado 2 unidades, scoped 1.
    assert consolidated.cogs == Decimal("40000")
    assert scoped.cogs == Decimal("20000")


async def test_sales_monthly_branch_none_matches_baseline(db_session):
    """monthly_series con branch_id=None ⇒ suma todo en el mes (sin filtro)."""
    school, user, client, product = await _seed_base(db_session)
    central = await _make_branch(db_session, "CENTRAL")
    await _make_sale(db_session, school, user, client, product,
                     branch_id=None, amount="45000")
    await _make_sale(db_session, school, user, client, product,
                     branch_id=central.id, amount="30000")

    calc = SalesStreamCalculator(db_session)
    series = await calc.monthly_series(
        _START, _END, None, None, RevenueBasis.ACCRUAL, include_cost=False,
    )

    assert series["2026-03"].revenue == Decimal("75000")
    assert series["2026-03"].count == 2


async def test_sales_monthly_branch_filter_scopes(db_session):
    """monthly_series con branch_id=<central> ⇒ solo esa sucursal en el mes."""
    school, user, client, product = await _seed_base(db_session)
    central = await _make_branch(db_session, "CENTRAL")
    await _make_sale(db_session, school, user, client, product,
                     branch_id=None, amount="45000")
    await _make_sale(db_session, school, user, client, product,
                     branch_id=central.id, amount="30000")

    calc = SalesStreamCalculator(db_session)
    series = await calc.monthly_series(
        _START, _END, None, central.id, RevenueBasis.ACCRUAL, include_cost=False,
    )

    assert series["2026-03"].revenue == Decimal("30000")
    assert series["2026-03"].count == 1


# ---------------------------------------------------------------------------
# No-op documentado: Alterations y B2B ignoran branch_id
# ---------------------------------------------------------------------------


async def test_alterations_ignores_branch_id(db_session):
    """Alterations no tiene branch_id: pasar uno debe dar el mismo total."""
    branch = await _make_branch(db_session, "NORTE")
    calc = AlterationsStreamCalculator(db_session)

    none_result = await calc.breakdown(
        _START, _END, None, None, RevenueBasis.CASH, include_cost=False,
    )
    branch_result = await calc.breakdown(
        _START, _END, None, branch.id, RevenueBasis.CASH, include_cost=False,
    )

    assert none_result.revenue == branch_result.revenue
    assert none_result.count == branch_result.count


async def test_b2b_ignores_branch_id(db_session):
    """B2B (global) no tiene branch_id: pasar uno debe dar el mismo total."""
    branch = await _make_branch(db_session, "SUR")
    calc = B2BContractsStreamCalculator(db_session)

    none_result = await calc.breakdown(
        _START, _END, None, None, RevenueBasis.ACCRUAL, include_cost=False,
    )
    branch_result = await calc.breakdown(
        _START, _END, None, branch.id, RevenueBasis.ACCRUAL, include_cost=False,
    )

    assert none_result.revenue == branch_result.revenue
    assert none_result.count == branch_result.count
    assert calc.stream_id == RevenueStreamId.B2B_CONTRACTS
