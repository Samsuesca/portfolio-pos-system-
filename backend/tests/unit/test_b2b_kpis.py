"""Tests de fórmula de los 5 KPIs comerciales B2B del dashboard del Modelo Financiero.

Ejercita ``KPIService`` directamente sobre ``db_session`` y afirma sobre el KPI
buscado por ``key`` en la lista devuelta por ``compute_kpis`` — mismo patrón de
servicio-directo + asserts-antes-del-rollback que
``test_contract_accounting_invariants.py``.

Cobertura de denominadores (la decisión NO es obvia, se prueba explícitamente):
  - conversión: numerador ACCEPTED / denominador DECIDIDAS (acc+rej+exp); excluye
    draft y cotizaciones abiertas (sent/negotiation).
  - pipeline ponderado: suma de total en estados abiertos; 0 → "$0" (no "—").
  - mix: base CAJA homogénea (Transaction INCOME b2b / Transaction INCOME total).
  - ticket promedio: func.avg de Contract.total DELIVERED (accrual).
  - concentración: top cliente / total B2B.

Los 5 KPIs solo aparecen en la vista GLOBAL (school_id IS NULL): B2B no se
atribuye a un colegio puntual.

Gotcha de ventana temporal: ``compute_kpis(months=6)`` mira
``[hoy - 6 meses, hoy]``. Las fixtures fijan ``created_at`` / ``delivered_at`` /
``transaction_date`` explícitamente dentro de esa ventana (vía
``get_colombia_*`` + timedelta — NUNCA ``datetime.now()``) para ser
determinísticas.
"""
from datetime import timedelta
from decimal import Decimal
from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.accounting import (
    AccPaymentMethod,
    Transaction,
    TransactionType,
)
from app.models.b2b import (
    B2BClient,
    B2BSegment,
    Contract,
    ContractStatus,
    Quotation,
    QuotationStatus,
)
from app.services.accounting.financial_model.kpis import KPIService
from app.utils.timezone import get_colombia_date, get_colombia_now_naive

B2B_KEYS = {
    "b2b_conversion_rate",
    "b2b_weighted_pipeline",
    "b2b_revenue_mix",
    "b2b_avg_ticket",
    "b2b_portfolio_concentration",
}

# Punto dentro de la ventana de 6 meses (hoy - 10 días) para fechas de fixtures.
_IN_WINDOW_DATE = get_colombia_date() - timedelta(days=10)
_IN_WINDOW_DT = get_colombia_now_naive() - timedelta(days=10)


def _find_kpi(result: dict, key: str) -> dict:
    return next(k for k in result["kpis"] if k["key"] == key)


# ---------------------------------------------------------------------------
# Fixtures / factories
# ---------------------------------------------------------------------------


@pytest.fixture
async def b2b_client(db_session: AsyncSession) -> B2BClient:
    record = B2BClient(
        id=uuid4(),
        legal_name=f"Cliente KPI {uuid4().hex[:6]} SAS",
        tax_id=f"901{uuid4().hex[:6]}",
        segment=B2BSegment.CORPORATE,
        payment_terms_days=0,
    )
    db_session.add(record)
    await db_session.flush()
    return record


async def _make_quotation(
    db_session: AsyncSession,
    client: B2BClient,
    *,
    status: QuotationStatus,
    total: Decimal,
) -> Quotation:
    issue = _IN_WINDOW_DATE
    quotation = Quotation(
        id=uuid4(),
        b2b_client_id=client.id,
        quotation_number=f"COT-KPI-{uuid4().hex[:8]}",
        status=status,
        issue_date=issue,
        valid_until=issue + timedelta(days=30),
        subtotal=total,
        tax_amount=Decimal("0"),
        total=total,
        created_at=_IN_WINDOW_DT,
    )
    db_session.add(quotation)
    await db_session.flush()
    return quotation


async def _make_delivered_contract(
    db_session: AsyncSession,
    client: B2BClient,
    *,
    total: Decimal,
    status: ContractStatus = ContractStatus.DELIVERED,
) -> Contract:
    contract = Contract(
        id=uuid4(),
        b2b_client_id=client.id,
        contract_number=f"CTR-KPI-{uuid4().hex[:8]}",
        status=status,
        total=total,
        deposit_amount=Decimal("0"),
        balance_amount=total,
        has_milestones=False,
        delivered_at=_IN_WINDOW_DT if status == ContractStatus.DELIVERED else None,
    )
    db_session.add(contract)
    await db_session.flush()
    return contract


async def _make_income_txn(
    db_session: AsyncSession,
    *,
    amount: Decimal,
    category: str | None,
) -> Transaction:
    txn = Transaction(
        id=uuid4(),
        type=TransactionType.INCOME,
        amount=amount,
        payment_method=AccPaymentMethod.CASH,
        description=f"KPI test income {category or 'retail'}",
        category=category,
        transaction_date=_IN_WINDOW_DATE,
    )
    db_session.add(txn)
    await db_session.flush()
    return txn


# ===========================================================================
# KPI 1 — Tasa de Conversión
# ===========================================================================


@pytest.mark.asyncio
async def test_conversion_rate_excludes_drafts_and_open(
    db_session: AsyncSession, b2b_client: B2BClient
):
    """2 ACCEPTED de 4 DECIDIDAS = 50%; draft y sent quedan fuera del denominador."""
    for _ in range(2):
        await _make_quotation(db_session, b2b_client, status=QuotationStatus.ACCEPTED, total=Decimal("100000"))
    await _make_quotation(db_session, b2b_client, status=QuotationStatus.REJECTED, total=Decimal("100000"))
    await _make_quotation(db_session, b2b_client, status=QuotationStatus.EXPIRED, total=Decimal("100000"))
    await _make_quotation(db_session, b2b_client, status=QuotationStatus.DRAFT, total=Decimal("100000"))
    await _make_quotation(db_session, b2b_client, status=QuotationStatus.SENT, total=Decimal("100000"))

    result = await KPIService(db_session).compute_kpis(months=6)

    kpi = _find_kpi(result, "b2b_conversion_rate")
    assert kpi["value"] == Decimal("50")
    assert kpi["formatted_value"] == "50.0%"


@pytest.mark.asyncio
async def test_conversion_rate_none_when_no_decided(
    db_session: AsyncSession, b2b_client: B2BClient
):
    """Solo cotizaciones abiertas/borrador → sin decididas → None ("—")."""
    await _make_quotation(db_session, b2b_client, status=QuotationStatus.DRAFT, total=Decimal("100000"))
    await _make_quotation(db_session, b2b_client, status=QuotationStatus.SENT, total=Decimal("100000"))
    await _make_quotation(db_session, b2b_client, status=QuotationStatus.NEGOTIATION, total=Decimal("100000"))

    result = await KPIService(db_session).compute_kpis(months=6)

    kpi = _find_kpi(result, "b2b_conversion_rate")
    assert kpi["value"] is None
    assert kpi["formatted_value"] == "—"
    assert kpi["status"] == "neutral"


# ===========================================================================
# KPI 2 — Pipeline Ponderado
# ===========================================================================


@pytest.mark.asyncio
async def test_weighted_pipeline_sums_open_quotations(
    db_session: AsyncSession, b2b_client: B2BClient
):
    """SENT(100k) + NEGOTIATION(50k) = 150k; ACCEPTED(999k) excluido."""
    await _make_quotation(db_session, b2b_client, status=QuotationStatus.SENT, total=Decimal("100000"))
    await _make_quotation(db_session, b2b_client, status=QuotationStatus.NEGOTIATION, total=Decimal("50000"))
    await _make_quotation(db_session, b2b_client, status=QuotationStatus.ACCEPTED, total=Decimal("999000"))

    result = await KPIService(db_session).compute_kpis(months=6)

    kpi = _find_kpi(result, "b2b_weighted_pipeline")
    assert kpi["value"] == Decimal("150000")


@pytest.mark.asyncio
async def test_weighted_pipeline_zero_when_no_open(
    db_session: AsyncSession, b2b_client: B2BClient
):
    """Sin cotizaciones abiertas → valor 0 y "$0" (cero es info válida, no None)."""
    await _make_quotation(db_session, b2b_client, status=QuotationStatus.ACCEPTED, total=Decimal("500000"))

    result = await KPIService(db_session).compute_kpis(months=6)

    kpi = _find_kpi(result, "b2b_weighted_pipeline")
    assert kpi["value"] == Decimal("0")
    assert kpi["formatted_value"] == "$0"


# ===========================================================================
# KPI 3 — Mix B2B vs Total (base caja)
# ===========================================================================


@pytest.mark.asyncio
async def test_revenue_mix_cash_basis(
    db_session: AsyncSession, b2b_client: B2BClient
):
    """INCOME b2b=30k sobre INCOME total=100k → 30% (base caja homogénea)."""
    await _make_income_txn(db_session, amount=Decimal("30000"), category="b2b")
    await _make_income_txn(db_session, amount=Decimal("70000"), category=None)

    result = await KPIService(db_session).compute_kpis(months=6)

    kpi = _find_kpi(result, "b2b_revenue_mix")
    assert kpi["value"] == Decimal("30")
    assert kpi["formatted_value"] == "30.0%"


@pytest.mark.asyncio
async def test_revenue_mix_none_when_no_total_revenue(
    db_session: AsyncSession, b2b_client: B2BClient
):
    """Sin ingresos totales → denominador 0 → None ("—")."""
    result = await KPIService(db_session).compute_kpis(months=6)

    kpi = _find_kpi(result, "b2b_revenue_mix")
    assert kpi["value"] is None
    assert kpi["formatted_value"] == "—"


# ===========================================================================
# KPI 4 — Ticket Promedio B2B
# ===========================================================================


@pytest.mark.asyncio
async def test_avg_ticket_delivered_only(
    db_session: AsyncSession, b2b_client: B2BClient
):
    """avg(200k, 400k) = 300k; el contrato IN_PRODUCTION(999k) no cuenta."""
    await _make_delivered_contract(db_session, b2b_client, total=Decimal("200000"))
    await _make_delivered_contract(db_session, b2b_client, total=Decimal("400000"))
    await _make_delivered_contract(
        db_session, b2b_client, total=Decimal("999000"), status=ContractStatus.IN_PRODUCTION
    )

    result = await KPIService(db_session).compute_kpis(months=6)

    kpi = _find_kpi(result, "b2b_avg_ticket")
    assert kpi["value"] == Decimal("300000")


@pytest.mark.asyncio
async def test_avg_ticket_none_when_no_delivered(
    db_session: AsyncSession, b2b_client: B2BClient
):
    """Sin contratos entregados → None ("—")."""
    await _make_delivered_contract(
        db_session, b2b_client, total=Decimal("500000"), status=ContractStatus.IN_PRODUCTION
    )

    result = await KPIService(db_session).compute_kpis(months=6)

    kpi = _find_kpi(result, "b2b_avg_ticket")
    assert kpi["value"] is None
    assert kpi["formatted_value"] == "—"


# ===========================================================================
# KPI 5 — Concentración de Cartera
# ===========================================================================


@pytest.mark.asyncio
async def test_portfolio_concentration_top_client_pct(
    db_session: AsyncSession
):
    """Cliente A=700k, Cliente B=300k → top/total = 70%."""
    client_a = B2BClient(
        id=uuid4(), legal_name=f"Cliente A {uuid4().hex[:6]}",
        tax_id=f"901{uuid4().hex[:6]}", segment=B2BSegment.CORPORATE, payment_terms_days=0,
    )
    client_b = B2BClient(
        id=uuid4(), legal_name=f"Cliente B {uuid4().hex[:6]}",
        tax_id=f"901{uuid4().hex[:6]}", segment=B2BSegment.CORPORATE, payment_terms_days=0,
    )
    db_session.add_all([client_a, client_b])
    await db_session.flush()

    await _make_delivered_contract(db_session, client_a, total=Decimal("700000"))
    await _make_delivered_contract(db_session, client_b, total=Decimal("300000"))

    result = await KPIService(db_session).compute_kpis(months=6)

    kpi = _find_kpi(result, "b2b_portfolio_concentration")
    assert kpi["value"] == Decimal("70")
    assert kpi["status"] == "critical"  # >60 → riesgo invertido


@pytest.mark.asyncio
async def test_portfolio_concentration_does_not_merge_homonym_clients(
    db_session: AsyncSession
):
    """Dos clientes DISTINTOS con el mismo legal_name no se fusionan: la
    concentración agrupa por id (700k/1000k = 70%), no por nombre (que daría
    100% erróneo si se agrupara por legal_name)."""
    same_name = f"Dotaciones {uuid4().hex[:6]} SAS"
    client_a = B2BClient(
        id=uuid4(), legal_name=same_name,
        tax_id=f"901{uuid4().hex[:6]}", segment=B2BSegment.CORPORATE, payment_terms_days=0,
    )
    client_b = B2BClient(
        id=uuid4(), legal_name=same_name,
        tax_id=f"902{uuid4().hex[:6]}", segment=B2BSegment.CORPORATE, payment_terms_days=0,
    )
    db_session.add_all([client_a, client_b])
    await db_session.flush()

    await _make_delivered_contract(db_session, client_a, total=Decimal("700000"))
    await _make_delivered_contract(db_session, client_b, total=Decimal("300000"))

    result = await KPIService(db_session).compute_kpis(months=6)

    kpi = _find_kpi(result, "b2b_portfolio_concentration")
    assert kpi["value"] == Decimal("70")  # NO 100


@pytest.mark.asyncio
async def test_portfolio_concentration_none_when_no_b2b_revenue(
    db_session: AsyncSession, b2b_client: B2BClient
):
    """Sin contratos entregados → total B2B 0 → None ("—")."""
    result = await KPIService(db_session).compute_kpis(months=6)

    kpi = _find_kpi(result, "b2b_portfolio_concentration")
    assert kpi["value"] is None
    assert kpi["formatted_value"] == "—"


# ===========================================================================
# Integración: gating por school_id + no-regresión de KPIs existentes
# ===========================================================================


@pytest.mark.asyncio
async def test_b2b_kpis_absent_when_school_filter(
    db_session: AsyncSession, b2b_client: B2BClient
):
    """Con school_id, ninguno de los 5 KPIs B2B aparece (B2B no es por colegio)."""
    await _make_quotation(db_session, b2b_client, status=QuotationStatus.ACCEPTED, total=Decimal("100000"))

    result = await KPIService(db_session).compute_kpis(months=6, school_id=uuid4())

    present_keys = {k["key"] for k in result["kpis"]}
    assert B2B_KEYS.isdisjoint(present_keys)


@pytest.mark.asyncio
async def test_b2b_kpis_present_in_global_view(
    db_session: AsyncSession
):
    """En la vista global los 5 KPIs B2B están presentes."""
    result = await KPIService(db_session).compute_kpis(months=6)

    present_keys = {k["key"] for k in result["kpis"]}
    assert B2B_KEYS.issubset(present_keys)


@pytest.mark.asyncio
async def test_existing_kpis_not_broken(
    db_session: AsyncSession
):
    """Smoke de no-regresión: los KPIs core siguen presentes tras añadir B2B."""
    result = await KPIService(db_session).compute_kpis(months=6)

    present_keys = {k["key"] for k in result["kpis"]}
    assert {"gross_margin", "operating_margin", "breakeven"}.issubset(present_keys)
