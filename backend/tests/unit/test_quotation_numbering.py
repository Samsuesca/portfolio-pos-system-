"""
Unit tests para la numeración GLOBAL de cotizaciones (COT-YYYY-NNNN).

Cubre: primer consecutivo, incremento, rollover de año, y concurrencia
(el retry-ante-IntegrityError garantiza unicidad bajo gather).
"""
import asyncio
from datetime import date
from decimal import Decimal
from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.models.b2b import B2BClient, B2BSegment, Quotation, QuotationStatus
from app.schemas.b2b import QuotationCreate, QuotationItemCreate
from app.services.quotation import QuotationService
from app.utils.timezone import get_colombia_date


async def _seed_b2b_client(db: AsyncSession) -> B2BClient:
    client = B2BClient(
        id=uuid4(),
        legal_name="Restaurante La Mesa SAS",
        tax_id=f"900{uuid4().hex[:6]}",
        segment=B2BSegment.RESTAURANT,
    )
    db.add(client)
    await db.flush()
    return client


def _quotation_payload(client_id) -> QuotationCreate:
    today = get_colombia_date()
    return QuotationCreate(
        b2b_client_id=client_id,
        issue_date=today,
        valid_until=today,
        tax_amount=Decimal("0"),
        items=[
            QuotationItemCreate(
                description="Camisa corporativa",
                quantity=10,
                unit_price=Decimal("50000"),
            )
        ],
    )


@pytest.mark.asyncio
async def test_first_code_is_0001(db_session: AsyncSession):
    client = await _seed_b2b_client(db_session)
    service = QuotationService(db_session)

    code = await service._generate_quotation_code()

    year = get_colombia_date().year
    assert code == f"COT-{year}-0001"


@pytest.mark.asyncio
async def test_sequence_increments(db_session: AsyncSession):
    client = await _seed_b2b_client(db_session)
    service = QuotationService(db_session)
    year = get_colombia_date().year

    db_session.add(
        Quotation(
            id=uuid4(),
            b2b_client_id=client.id,
            quotation_number=f"COT-{year}-0003",
            status=QuotationStatus.DRAFT,
            issue_date=get_colombia_date(),
            valid_until=get_colombia_date(),
            total=Decimal("0"),
        )
    )
    await db_session.flush()

    code = await service._generate_quotation_code()
    assert code == f"COT-{year}-0004"


@pytest.mark.asyncio
async def test_year_rollover(db_session: AsyncSession):
    client = await _seed_b2b_client(db_session)
    service = QuotationService(db_session)
    year = get_colombia_date().year

    # Consecutivo de un año previo no afecta el primero del año actual.
    db_session.add(
        Quotation(
            id=uuid4(),
            b2b_client_id=client.id,
            quotation_number=f"COT-{year - 1}-0009",
            status=QuotationStatus.DRAFT,
            issue_date=date(year - 1, 12, 1),
            valid_until=date(year - 1, 12, 31),
            total=Decimal("0"),
        )
    )
    await db_session.flush()

    code = await service._generate_quotation_code()
    assert code == f"COT-{year}-0001"


@pytest.mark.asyncio
async def test_concurrent_creation_no_duplicate_sequence(async_engine):
    """N corutinas crean cotizaciones en paralelo sobre sesiones independientes.

    Verifica que los quotation_number resultantes son TODOS únicos (el retry
    ante IntegrityError recupera de las colisiones que el lock no previene en
    la primera cotización del año).
    """
    session_factory = async_sessionmaker(
        async_engine, class_=AsyncSession, expire_on_commit=False
    )

    # Cliente B2B compartido (creado en su propia sesión, commiteado).
    async with session_factory() as setup_db:
        client = await _seed_b2b_client(setup_db)
        await setup_db.commit()
        client_id = client.id

    n = 8

    async def _create_one() -> str:
        async with session_factory() as db:
            service = QuotationService(db)
            quotation = await service.create_quotation(
                _quotation_payload(client_id), user_id=None
            )
            await db.commit()
            return quotation.quotation_number

    numbers = await asyncio.gather(*[_create_one() for _ in range(n)])

    # La garantía real del diseño (lock FOR UPDATE + retry ante UniqueConstraint)
    # es UNICIDAD, no contigüidad: si dos transacciones ven la tabla vacía a la
    # vez, ambas intentan -0001, una gana y la otra reintenta. Bajo carga, eso
    # puede dejar huecos sin duplicar. La invariante a verificar es la unicidad.
    assert len(set(numbers)) == n, f"Consecutivos duplicados: {numbers}"
    year = get_colombia_date().year
    assert all(num.startswith(f"COT-{year}-") for num in numbers), (
        f"Prefijo de año inesperado: {numbers}"
    )
