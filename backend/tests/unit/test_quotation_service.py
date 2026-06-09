"""
Unit tests del QuotationService (B2B Fase 2) ejercitando la lógica de negocio
directamente sobre el servicio, sin la capa HTTP.

Complementa los tests de ruta (tests/integration/test_b2b_quotation_routes.py):
aquí se valida el servicio en aislamiento — cómputo de totales, FSM de estados
y conversión a contrato — usando ``db_session`` real (los mixins hacen flush,
el test hace los asserts antes del rollback de la fixture).

Cubre los comportamientos del SPEC de Fase 2:
  (2) create_quotation computa subtotal/total desde los items.
  (3) update_status aplica/rechaza transiciones según la FSM.
  (4) convert_to_contract crea un CTR con totales y quotation_id correctos.
"""
from datetime import timedelta
from decimal import Decimal
from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.b2b import (
    B2BClient,
    B2BSegment,
    ContractStatus,
    QuotationStatus,
)
from app.schemas.b2b import QuotationCreate, QuotationItemCreate
from app.services.quotation import QuotationService
from app.utils.timezone import get_colombia_date


# ---------------------------------------------------------------------------
# Helpers / fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
async def b2b_client_record(db_session: AsyncSession) -> B2BClient:
    """Cliente empresarial mínimo para colgar cotizaciones."""
    record = B2BClient(
        id=uuid4(),
        legal_name="Hotel Andino SAS",
        tax_id=f"900{uuid4().hex[:6]}",
        segment=B2BSegment.CORPORATE,
    )
    db_session.add(record)
    await db_session.flush()
    return record


def _payload(
    client_id,
    *,
    items: list[QuotationItemCreate] | None = None,
    tax_amount: Decimal = Decimal("0"),
    deposit_pct: Decimal = Decimal("50"),
    valid_offset_days: int = 15,
) -> QuotationCreate:
    today = get_colombia_date()
    return QuotationCreate(
        b2b_client_id=client_id,
        issue_date=today,
        valid_until=today + timedelta(days=valid_offset_days),
        deposit_pct=deposit_pct,
        tax_amount=tax_amount,
        items=items
        or [
            QuotationItemCreate(
                description="Camisa corporativa",
                quantity=10,
                unit_price=Decimal("50000"),
            ),
            QuotationItemCreate(
                description="Pantalón dotación",
                quantity=5,
                unit_price=Decimal("80000"),
            ),
        ],
    )


async def _accepted_quotation(service: QuotationService, client_id):
    """Crea una cotización y la lleva por la FSM hasta ``accepted``."""
    quotation = await service.create_quotation(_payload(client_id), user_id=None)
    await service.update_status(quotation.id, QuotationStatus.SENT)
    await service.update_status(quotation.id, QuotationStatus.ACCEPTED)
    return quotation


# ---------------------------------------------------------------------------
# (2) Cómputo de totales
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_create_quotation_computes_line_totals_subtotal_and_total(
    db_session: AsyncSession, b2b_client_record: B2BClient
):
    service = QuotationService(db_session)

    quotation = await service.create_quotation(
        _payload(b2b_client_record.id, tax_amount=Decimal("19000")),
        user_id=None,
    )

    loaded = await service.get_quotation_with_items(quotation.id)
    line_totals = {item.description: item.line_total for item in loaded.items}

    assert line_totals["Camisa corporativa"] == Decimal("500000.00")  # 50000 * 10
    assert line_totals["Pantalón dotación"] == Decimal("400000.00")  # 80000 * 5
    assert loaded.subtotal == Decimal("900000.00")
    assert loaded.tax_amount == Decimal("19000.00")
    assert loaded.total == Decimal("919000.00")  # subtotal + tax_amount
    assert loaded.status == QuotationStatus.DRAFT


@pytest.mark.asyncio
async def test_create_quotation_zero_tax_total_equals_subtotal(
    db_session: AsyncSession, b2b_client_record: B2BClient
):
    service = QuotationService(db_session)

    quotation = await service.create_quotation(
        _payload(b2b_client_record.id, tax_amount=Decimal("0")),
        user_id=None,
    )

    assert quotation.subtotal == Decimal("900000.00")
    assert quotation.total == quotation.subtotal


@pytest.mark.asyncio
async def test_create_quotation_valid_until_before_issue_raises(
    db_session: AsyncSession, b2b_client_record: B2BClient
):
    service = QuotationService(db_session)
    today = get_colombia_date()
    bad = QuotationCreate(
        b2b_client_id=b2b_client_record.id,
        issue_date=today,
        valid_until=today - timedelta(days=1),  # vigencia anterior a la emisión
        items=[
            QuotationItemCreate(
                description="X", quantity=1, unit_price=Decimal("1000")
            )
        ],
    )

    with pytest.raises(ValueError, match="vigencia no puede ser anterior"):
        await service.create_quotation(bad, user_id=None)


# ---------------------------------------------------------------------------
# (3) FSM de estados
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_update_status_valid_path_draft_sent_accepted(
    db_session: AsyncSession, b2b_client_record: B2BClient
):
    service = QuotationService(db_session)
    quotation = await service.create_quotation(
        _payload(b2b_client_record.id), user_id=None
    )

    sent = await service.update_status(quotation.id, QuotationStatus.SENT)
    assert sent.status == QuotationStatus.SENT

    accepted = await service.update_status(quotation.id, QuotationStatus.ACCEPTED)
    assert accepted.status == QuotationStatus.ACCEPTED


@pytest.mark.asyncio
async def test_update_status_invalid_jump_draft_to_accepted_raises(
    db_session: AsyncSession, b2b_client_record: B2BClient
):
    service = QuotationService(db_session)
    quotation = await service.create_quotation(
        _payload(b2b_client_record.id), user_id=None
    )

    with pytest.raises(ValueError, match="no permitida"):
        await service.update_status(quotation.id, QuotationStatus.ACCEPTED)


@pytest.mark.asyncio
async def test_update_status_terminal_rejected_is_locked(
    db_session: AsyncSession, b2b_client_record: B2BClient
):
    service = QuotationService(db_session)
    quotation = await service.create_quotation(
        _payload(b2b_client_record.id), user_id=None
    )
    await service.update_status(quotation.id, QuotationStatus.SENT)
    await service.update_status(quotation.id, QuotationStatus.REJECTED)

    # rejected es terminal: cualquier salida debe fallar.
    with pytest.raises(ValueError, match="no permitida"):
        await service.update_status(quotation.id, QuotationStatus.SENT)


@pytest.mark.asyncio
async def test_update_status_missing_quotation_returns_none(
    db_session: AsyncSession
):
    service = QuotationService(db_session)
    result = await service.update_status(uuid4(), QuotationStatus.SENT)
    assert result is None


# ---------------------------------------------------------------------------
# (4) Conversión accepted → Contract
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_convert_to_contract_copies_totals_and_links_quotation(
    db_session: AsyncSession, b2b_client_record: B2BClient
):
    service = QuotationService(db_session)
    quotation = await _accepted_quotation(service, b2b_client_record.id)
    total = quotation.total  # 900000 (sin IVA en el payload por defecto)

    contract = await service.convert_to_contract(quotation.id, user_id=None)

    assert contract.status == ContractStatus.PENDING_DEPOSIT
    assert contract.contract_number.startswith("CTR-")
    assert contract.total == total
    assert contract.b2b_client_id == b2b_client_record.id
    assert contract.quotation_id == quotation.id

    expected_deposit = (total * Decimal("50") / Decimal("100")).quantize(
        Decimal("0.01")
    )
    assert contract.deposit_amount == expected_deposit
    assert contract.balance_amount == total - expected_deposit


@pytest.mark.asyncio
async def test_convert_to_contract_year_prefix_matches_current_year(
    db_session: AsyncSession, b2b_client_record: B2BClient
):
    service = QuotationService(db_session)
    quotation = await _accepted_quotation(service, b2b_client_record.id)

    contract = await service.convert_to_contract(quotation.id, user_id=None)

    year = get_colombia_date().year
    assert contract.contract_number == f"CTR-{year}-0001"


@pytest.mark.asyncio
async def test_convert_non_accepted_raises(
    db_session: AsyncSession, b2b_client_record: B2BClient
):
    service = QuotationService(db_session)
    quotation = await service.create_quotation(
        _payload(b2b_client_record.id), user_id=None
    )
    await service.update_status(quotation.id, QuotationStatus.SENT)

    with pytest.raises(ValueError, match="aceptadas"):
        await service.convert_to_contract(quotation.id, user_id=None)


@pytest.mark.asyncio
async def test_convert_twice_blocked_by_one_to_one(
    db_session: AsyncSession, b2b_client_record: B2BClient
):
    service = QuotationService(db_session)
    quotation = await _accepted_quotation(service, b2b_client_record.id)

    first = await service.convert_to_contract(quotation.id, user_id=None)
    assert first.contract_number.startswith("CTR-")

    with pytest.raises(ValueError, match="ya tiene un contrato"):
        await service.convert_to_contract(quotation.id, user_id=None)


@pytest.mark.asyncio
async def test_convert_missing_quotation_raises(db_session: AsyncSession):
    service = QuotationService(db_session)
    with pytest.raises(ValueError, match="no encontrada"):
        await service.convert_to_contract(uuid4(), user_id=None)
