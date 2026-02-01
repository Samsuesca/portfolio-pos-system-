"""
Unit tests for AlterationService.

Tests cover business logic for alterations including
payment status calculation, status transitions, and statistics.
"""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import date, timedelta
from decimal import Decimal
from uuid import uuid4

from app.services.alteration import AlterationService
from app.models.alteration import Alteration, AlterationStatus, AlterationType
from app.schemas.alteration import AlterationCreate, AlterationUpdate, AlterationPaymentCreate


@pytest.fixture
def mock_db_session():
    """Create a mock async database session."""
    session = AsyncMock()
    session.add = MagicMock()
    session.flush = AsyncMock()
    session.refresh = AsyncMock()
    session.commit = AsyncMock()
    session.execute = AsyncMock()
    return session


@pytest.fixture
def alteration_service(mock_db_session):
    """Create AlterationService instance with mock session."""
    return AlterationService(mock_db_session)


@pytest.mark.asyncio
async def test_create_alteration_generates_code(mock_db_session, alteration_service):
    """Test that creating alteration generates unique code."""
    create_data = AlterationCreate(
        external_client_name="Test Client",
        garment_name="Pantalón",
        description="Arreglo de dobladillo en pantalón",
        alteration_type=AlterationType.HEM,
        cost=Decimal("20000"),
        received_date=date.today()
    )

    # Mock alteration that will be returned by get()
    mock_alteration = MagicMock(spec=Alteration)
    mock_alteration.code = "ARR-2026-0001"
    mock_alteration.status = AlterationStatus.PENDING
    mock_alteration.amount_paid = Decimal("0")

    # Mock code generation query (first call) and get() query (second call)
    code_gen_result = MagicMock()
    code_gen_result.scalar_one.return_value = 0  # No existing alterations

    get_result = MagicMock()
    get_result.scalar_one_or_none.return_value = mock_alteration

    mock_db_session.execute.side_effect = [code_gen_result, get_result]

    result = await alteration_service.create(create_data, uuid4())

    # Verify alteration was added
    mock_db_session.add.assert_called()
    added_alteration = mock_db_session.add.call_args[0][0]

    assert added_alteration.code.startswith("ARR-")
    assert added_alteration.status == AlterationStatus.PENDING
    assert added_alteration.amount_paid == Decimal("0")


@pytest.mark.asyncio
async def test_create_alteration_with_initial_payment(mock_db_session, alteration_service):
    """Test that creating alteration with initial payment records it."""
    create_data = AlterationCreate(
        external_client_name="Test Client",
        garment_name="Falda",
        description="Ajuste de ancho en falda escolar",
        alteration_type=AlterationType.WIDTH,
        cost=Decimal("25000"),
        received_date=date.today(),
        initial_payment=Decimal("10000"),
        initial_payment_method="cash"
    )

    # Mock alteration that will be returned by get()
    mock_alteration = MagicMock(spec=Alteration)
    mock_alteration.id = uuid4()
    mock_alteration.code = "ARR-2026-0001"

    # Mock code generation query (first call) and get() query (second call)
    code_gen_result = MagicMock()
    code_gen_result.scalar_one.return_value = 0

    get_result = MagicMock()
    get_result.scalar_one_or_none.return_value = mock_alteration

    mock_db_session.execute.side_effect = [code_gen_result, get_result]

    # Mock the record_payment method (called for initial payment)
    with patch.object(alteration_service, 'record_payment', AsyncMock()):
        result = await alteration_service.create(create_data, uuid4())

    mock_db_session.add.assert_called()


@pytest.mark.asyncio
async def test_get_alteration_returns_none_for_nonexistent(mock_db_session, alteration_service):
    """Test that get returns None for non-existent alteration."""
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = None
    mock_db_session.execute.return_value = mock_result

    result = await alteration_service.get(uuid4())

    assert result is None


@pytest.mark.asyncio
async def test_update_status_to_delivered_sets_date(mock_db_session, alteration_service):
    """Test that updating status to delivered sets delivered_date."""
    mock_alteration = MagicMock(spec=Alteration)
    mock_alteration.id = uuid4()
    mock_alteration.status = AlterationStatus.READY
    mock_alteration.delivered_date = None

    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = mock_alteration
    mock_db_session.execute.return_value = mock_result

    result = await alteration_service.update_status(
        mock_alteration.id,
        AlterationStatus.DELIVERED
    )

    assert mock_alteration.status == AlterationStatus.DELIVERED
    assert mock_alteration.delivered_date == date.today()


@pytest.mark.asyncio
async def test_cancel_alteration_with_payments_fails(mock_db_session, alteration_service):
    """Test that cancelling alteration with payments raises error."""
    mock_alteration = MagicMock(spec=Alteration)
    mock_alteration.id = uuid4()
    mock_alteration.status = AlterationStatus.PENDING
    mock_alteration.amount_paid = Decimal("5000")  # Has payments
    mock_alteration.payments = []

    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = mock_alteration
    mock_db_session.execute.return_value = mock_result

    with pytest.raises(ValueError, match="No se puede cancelar"):
        await alteration_service.cancel(mock_alteration.id)


@pytest.mark.asyncio
async def test_cancel_alteration_without_payments_succeeds(mock_db_session, alteration_service):
    """Test that cancelling alteration without payments succeeds."""
    mock_alteration = MagicMock(spec=Alteration)
    mock_alteration.id = uuid4()
    mock_alteration.status = AlterationStatus.PENDING
    mock_alteration.amount_paid = Decimal("0")  # No payments
    mock_alteration.payments = []

    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = mock_alteration
    mock_db_session.execute.return_value = mock_result

    result = await alteration_service.cancel(mock_alteration.id)

    assert mock_alteration.status == AlterationStatus.CANCELLED


@pytest.mark.asyncio
async def test_record_payment_updates_amount_paid(mock_db_session, alteration_service):
    """Test that recording payment updates amount_paid."""
    mock_alteration = MagicMock(spec=Alteration)
    mock_alteration.id = uuid4()
    mock_alteration.code = "ARR-2026-0001"
    mock_alteration.cost = Decimal("20000")
    mock_alteration.amount_paid = Decimal("5000")
    mock_alteration.balance = Decimal("15000")  # cost - amount_paid

    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = mock_alteration
    mock_db_session.execute.return_value = mock_result

    payment_data = AlterationPaymentCreate(
        amount=Decimal("10000"),
        payment_method="cash",
        apply_accounting=False  # Skip accounting for unit test
    )

    result = await alteration_service.record_payment(
        mock_alteration.id,
        payment_data,
        uuid4()
    )

    # Verify payment was added and amount updated
    assert mock_db_session.add.called
    assert mock_alteration.amount_paid == Decimal("15000")


@pytest.mark.asyncio
async def test_record_payment_exceeding_balance_fails(mock_db_session, alteration_service):
    """Test that payment exceeding balance raises error."""
    mock_alteration = MagicMock(spec=Alteration)
    mock_alteration.id = uuid4()
    mock_alteration.cost = Decimal("20000")
    mock_alteration.amount_paid = Decimal("15000")
    mock_alteration.balance = Decimal("5000")  # Only 5000 remaining

    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = mock_alteration
    mock_db_session.execute.return_value = mock_result

    payment_data = AlterationPaymentCreate(
        amount=Decimal("10000"),  # Exceeds balance
        payment_method="cash"
    )

    with pytest.raises(ValueError, match="excede el saldo"):
        await alteration_service.record_payment(
            mock_alteration.id,
            payment_data,
            uuid4()
        )


@pytest.mark.asyncio
async def test_list_alterations_with_filters(mock_db_session, alteration_service):
    """Test that list applies filters correctly."""
    mock_alterations = [
        MagicMock(spec=Alteration, status=AlterationStatus.PENDING),
        MagicMock(spec=Alteration, status=AlterationStatus.PENDING),
    ]

    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = mock_alterations
    mock_db_session.execute.return_value = mock_result

    result = await alteration_service.list(
        status=AlterationStatus.PENDING,
        limit=10
    )

    assert len(result) == 2
    mock_db_session.execute.assert_called_once()


@pytest.mark.asyncio
async def test_get_summary_returns_statistics(mock_db_session, alteration_service):
    """Test that get_summary returns correct statistics."""
    # Mock multiple execute calls for different queries
    total_result = MagicMock()
    total_result.scalar_one.return_value = 10  # total count

    status_result = MagicMock()
    status_result.scalar_one.return_value = 3  # count per status

    revenue_result = MagicMock()
    revenue_result.scalar_one.return_value = Decimal("150000")

    pending_result = MagicMock()
    pending_result.scalar_one.return_value = Decimal("50000")

    today_result = MagicMock()
    today_result.scalar_one.return_value = 2

    # Set up execute to return different results for each call
    mock_db_session.execute.side_effect = [
        total_result,
        status_result, status_result, status_result,  # For each status
        status_result, status_result,
        revenue_result,
        pending_result,
        today_result,
        today_result
    ]

    result = await alteration_service.get_summary()

    assert result.total_count == 10
    assert result.total_revenue == Decimal("150000")
    assert result.total_pending_payment == Decimal("50000")


@pytest.mark.asyncio
async def test_update_alteration_changes_fields(mock_db_session, alteration_service):
    """Test that update changes specified fields."""
    alteration_id = uuid4()
    mock_alteration = MagicMock(spec=Alteration)
    mock_alteration.id = alteration_id
    mock_alteration.garment_name = "Original"
    mock_alteration.cost = Decimal("15000")
    mock_alteration.status = None  # No status in update
    mock_alteration.delivered_date = None

    # First call: get() in update method, Second call: get() at end of update
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = mock_alteration
    mock_db_session.execute.return_value = mock_result

    update_data = AlterationUpdate(
        garment_name="Updated",
        cost=Decimal("20000")
    )

    result = await alteration_service.update(alteration_id, update_data)

    assert mock_alteration.garment_name == "Updated"
    assert mock_alteration.cost == Decimal("20000")
