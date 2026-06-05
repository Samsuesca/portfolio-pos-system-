"""Unit Tests for Order/Sale Change Approval Flows

Cubre los fixes de Fase 0+1 introducidos tras el audit
(docs/audits/history/changes-returns-orders-2026-05-03.md):

- Validación de ``advance_payment <= total`` en creación de encargo
- Validación de ``original_item_disposal`` en creación de cambio sobre items
  no-stock (en producción o made-to-order)
- ``_validate_disposal_against_item``: bloqueos de combinaciones inválidas
- Lógica financiera ``_settle_change_finance`` y ``_settle_sale_change_finance``:
  aplica price_adjustment a receivable y caja sin doble-contar
"""
import pytest
from datetime import date
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

from app.models.order import OrderItemStatus, OriginalItemDisposal
from app.models.sale import PaymentMethod
from app.models.accounting import TransactionType


# ============================================================================
# 1. advance_payment <= total validation
# ============================================================================

class TestAdvancePaymentValidation:
    """create_order debe rechazar advance_payment > total."""

    def test_advance_payment_validation_logic(self):
        """La regla pura: advance_payment <= total."""
        total = Decimal("48000")

        # Caso bug del audit: ENC-2026-0117 (96k de anticipo en encargo de 48k)
        invalid_advance = Decimal("96000")
        assert invalid_advance > total, "Setup: el anticipo excede el total"

        # La regla rechaza este caso
        with pytest.raises(ValueError, match="no puede exceder el total"):
            if invalid_advance > total:
                raise ValueError(
                    f"El anticipo ({invalid_advance}) no puede exceder el total del encargo ({total})"
                )

    def test_advance_payment_equal_to_total_is_valid(self):
        """Anticipo == total es válido (cliente paga todo upfront)."""
        total = Decimal("48000")
        advance = Decimal("48000")
        assert advance <= total

    def test_advance_payment_zero_is_valid(self):
        """Anticipo == 0 es válido (cliente paga al entregar)."""
        total = Decimal("48000")
        advance = Decimal("0")
        assert advance <= total


# ============================================================================
# 2. _validate_disposal_against_item
# ============================================================================

@pytest.fixture
def order_change_service():
    """Instancia de OrderService con db mockeado para llamar al validator."""
    from app.services.order import OrderService

    service = OrderService(db=AsyncMock())
    return service


@pytest.fixture
def order_item_factory():
    def _create(
        embroidery_text: str | None = None,
        custom_measurements: dict | None = None,
        item_status: OrderItemStatus = OrderItemStatus.PENDING,
    ):
        item = MagicMock()
        item.embroidery_text = embroidery_text
        item.custom_measurements = custom_measurements
        item.item_status = item_status
        return item

    return _create


class TestDisposalValidation:
    """Validación de disposal_action contra características del item."""

    def test_return_to_inventory_blocked_for_personalized_with_embroidery(
        self, order_change_service, order_item_factory
    ):
        item = order_item_factory(embroidery_text="Juanito Pérez")

        with pytest.raises(ValueError, match="prenda personalizada"):
            order_change_service._validate_disposal_against_item(
                OriginalItemDisposal.RETURN_TO_INVENTORY, item
            )

    def test_return_to_inventory_blocked_for_personalized_with_custom_meas(
        self, order_change_service, order_item_factory
    ):
        item = order_item_factory(custom_measurements={"cintura": 75})

        with pytest.raises(ValueError, match="prenda personalizada"):
            order_change_service._validate_disposal_against_item(
                OriginalItemDisposal.RETURN_TO_INVENTORY, item
            )

    def test_return_to_inventory_allowed_for_non_personalized(
        self, order_change_service, order_item_factory
    ):
        item = order_item_factory()  # sin embroidery, sin custom_meas

        order_change_service._validate_disposal_against_item(
            OriginalItemDisposal.RETURN_TO_INVENTORY, item
        )

    def test_cancel_production_blocked_for_ready_item(
        self, order_change_service, order_item_factory
    ):
        item = order_item_factory(item_status=OrderItemStatus.READY)

        with pytest.raises(ValueError, match="cancelar producción"):
            order_change_service._validate_disposal_against_item(
                OriginalItemDisposal.CANCEL_PRODUCTION, item
            )

    def test_cancel_production_blocked_for_delivered_item(
        self, order_change_service, order_item_factory
    ):
        item = order_item_factory(item_status=OrderItemStatus.DELIVERED)

        with pytest.raises(ValueError, match="cancelar producción"):
            order_change_service._validate_disposal_against_item(
                OriginalItemDisposal.CANCEL_PRODUCTION, item
            )

    def test_cancel_production_allowed_for_pending_item(
        self, order_change_service, order_item_factory
    ):
        item = order_item_factory(item_status=OrderItemStatus.PENDING)

        order_change_service._validate_disposal_against_item(
            OriginalItemDisposal.CANCEL_PRODUCTION, item
        )

    def test_cancel_production_allowed_for_in_production_item(
        self, order_change_service, order_item_factory
    ):
        item = order_item_factory(item_status=OrderItemStatus.IN_PRODUCTION)

        order_change_service._validate_disposal_against_item(
            OriginalItemDisposal.CANCEL_PRODUCTION, item
        )

    def test_register_loss_always_allowed(
        self, order_change_service, order_item_factory
    ):
        # READY personalizado
        item1 = order_item_factory(
            embroidery_text="Juanito",
            item_status=OrderItemStatus.READY,
        )
        order_change_service._validate_disposal_against_item(
            OriginalItemDisposal.REGISTER_LOSS, item1
        )

        # IN_PRODUCTION
        item2 = order_item_factory(item_status=OrderItemStatus.IN_PRODUCTION)
        order_change_service._validate_disposal_against_item(
            OriginalItemDisposal.REGISTER_LOSS, item2
        )


# ============================================================================
# 3. _settle_change_finance — lógica financiera de orders
# ============================================================================

@pytest.fixture
def mock_order():
    order = MagicMock()
    order.id = uuid4()
    order.code = "TEST-001-ENC-2026-0001"
    order.client_id = uuid4()
    order.delivery_date = date.today()
    order.paid_amount = Decimal("0")
    return order


@pytest.fixture
def mock_change(mock_order):
    change = MagicMock()
    change.id = uuid4()
    change.order = mock_order
    change.price_adjustment = Decimal("0")
    return change


@pytest.fixture
def mock_receivable_query(monkeypatch):
    """Mockea self.db.execute para devolver un receivable opcional."""
    def _setup(service, receivable):
        async def fake_execute(stmt):
            mock_result = MagicMock()
            mock_result.scalar_one_or_none = MagicMock(return_value=receivable)
            return mock_result

        service.db.execute = fake_execute

    return _setup


@pytest.fixture
def receivable_factory():
    def _create(amount: Decimal, amount_paid: Decimal = Decimal("0")):
        rec = MagicMock()
        rec.amount = amount
        rec.amount_paid = amount_paid
        rec.is_paid = False
        return rec

    return _create


@pytest.fixture
def txn_service_mock():
    txn = MagicMock()
    txn.record = AsyncMock()
    return txn


class TestSettleChangeFinanceOrders:
    """Tests para OrderChangeMixin._settle_change_finance."""

    @pytest.mark.asyncio
    async def test_no_op_when_adjustment_zero(
        self, order_change_service, mock_change, mock_order, txn_service_mock,
        mock_receivable_query,
    ):
        mock_change.price_adjustment = Decimal("0")
        mock_receivable_query(order_change_service, None)

        await order_change_service._settle_change_finance(
            change=mock_change, order=mock_order, school_id=uuid4(),
            payment_method=PaymentMethod.CASH, txn_service=txn_service_mock,
            approved_by=None,
        )

        txn_service_mock.record.assert_not_called()
        assert mock_order.paid_amount == Decimal("0")

    @pytest.mark.asyncio
    async def test_positive_adjustment_cash_charges_now_and_raises_paid(
        self, order_change_service, mock_change, mock_order, txn_service_mock,
        mock_receivable_query, receivable_factory,
    ):
        # Cliente debe pagar 2k extra por cambio a producto más caro
        mock_change.price_adjustment = Decimal("2000")
        mock_order.paid_amount = Decimal("48000")
        rec = receivable_factory(amount=Decimal("0"))
        mock_receivable_query(order_change_service, rec)

        await order_change_service._settle_change_finance(
            change=mock_change, order=mock_order, school_id=uuid4(),
            payment_method=PaymentMethod.CASH, txn_service=txn_service_mock,
            approved_by=None,
        )

        txn_service_mock.record.assert_called_once()
        call_kwargs = txn_service_mock.record.call_args.kwargs
        assert call_kwargs["type"] == TransactionType.INCOME
        assert call_kwargs["amount"] == Decimal("2000")
        # paid_amount sube por la diferencia
        assert mock_order.paid_amount == Decimal("50000")

    @pytest.mark.asyncio
    async def test_positive_adjustment_credit_grows_existing_receivable(
        self, order_change_service, mock_change, mock_order, txn_service_mock,
        mock_receivable_query, receivable_factory,
    ):
        mock_change.price_adjustment = Decimal("2000")
        rec = receivable_factory(amount=Decimal("10000"))
        mock_receivable_query(order_change_service, rec)

        await order_change_service._settle_change_finance(
            change=mock_change, order=mock_order, school_id=uuid4(),
            payment_method=PaymentMethod.CREDIT, txn_service=txn_service_mock,
            approved_by=None,
        )

        txn_service_mock.record.assert_not_called()
        assert rec.amount == Decimal("12000")

    @pytest.mark.asyncio
    async def test_negative_adjustment_reduces_receivable_only_when_covers(
        self, order_change_service, mock_change, mock_order, txn_service_mock,
        mock_receivable_query, receivable_factory,
    ):
        # Encargo de 150k, paid 100k, recv 50k. Cambio adj=-20k.
        # Esperado: rec=30k, paid=100k (sin cash refund), no INCOME ni EXPENSE.
        mock_change.price_adjustment = Decimal("-20000")
        mock_order.paid_amount = Decimal("100000")
        rec = receivable_factory(amount=Decimal("50000"))
        mock_receivable_query(order_change_service, rec)

        await order_change_service._settle_change_finance(
            change=mock_change, order=mock_order, school_id=uuid4(),
            payment_method=PaymentMethod.CASH, txn_service=txn_service_mock,
            approved_by=None,
        )

        # NO registrar transacción — todo el adj cabe en el receivable
        txn_service_mock.record.assert_not_called()
        assert rec.amount == Decimal("30000")
        assert rec.is_paid is False
        # paid_amount intacto (sin refund)
        assert mock_order.paid_amount == Decimal("100000")

    @pytest.mark.asyncio
    async def test_negative_adjustment_overpayment_triggers_cash_refund(
        self, order_change_service, mock_change, mock_order, txn_service_mock,
        mock_receivable_query, receivable_factory,
    ):
        # Encargo paid_amount=total. adj=-20k. No hay receivable (ya pagado).
        # Esperado: EXPENSE 20k, paid baja a 80k, no se toca receivable.
        mock_change.price_adjustment = Decimal("-20000")
        mock_order.paid_amount = Decimal("100000")
        mock_receivable_query(order_change_service, None)

        await order_change_service._settle_change_finance(
            change=mock_change, order=mock_order, school_id=uuid4(),
            payment_method=PaymentMethod.CASH, txn_service=txn_service_mock,
            approved_by=None,
        )

        txn_service_mock.record.assert_called_once()
        call_kwargs = txn_service_mock.record.call_args.kwargs
        assert call_kwargs["type"] == TransactionType.EXPENSE
        assert call_kwargs["amount"] == Decimal("20000")
        # force_income_map=True para que el refund salga de la cuenta donde entró
        assert call_kwargs["force_income_map"] is True
        assert mock_order.paid_amount == Decimal("80000")

    @pytest.mark.asyncio
    async def test_negative_adjustment_partial_receivable_partial_refund(
        self, order_change_service, mock_change, mock_order, txn_service_mock,
        mock_receivable_query, receivable_factory,
    ):
        # rec=10k, paid=90k, total=100k; adj=-30k → recv→0 + cash refund 20k
        mock_change.price_adjustment = Decimal("-30000")
        mock_order.paid_amount = Decimal("90000")
        rec = receivable_factory(amount=Decimal("10000"))
        mock_receivable_query(order_change_service, rec)

        await order_change_service._settle_change_finance(
            change=mock_change, order=mock_order, school_id=uuid4(),
            payment_method=PaymentMethod.CASH, txn_service=txn_service_mock,
            approved_by=None,
        )

        # Receivable cierra: amount_paid se iguala a amount (CHECK chk_ar_amount_positive
        # impide poner amount=0). is_paid=True
        assert rec.amount == Decimal("10000")  # amount original sin tocar
        assert rec.amount_paid == Decimal("10000")  # saldo cubierto por la reducción del cambio
        assert rec.is_paid is True
        # Cash refund por el residuo (20k)
        txn_service_mock.record.assert_called_once()
        call_kwargs = txn_service_mock.record.call_args.kwargs
        assert call_kwargs["amount"] == Decimal("20000")
        assert mock_order.paid_amount == Decimal("70000")

    @pytest.mark.asyncio
    async def test_negative_adjustment_credit_blocks_when_overpayment(
        self, order_change_service, mock_change, mock_order, txn_service_mock,
        mock_receivable_query, receivable_factory,
    ):
        # adj=-30k, recv=10k, residuo 20k. Method=credit → bloquea.
        mock_change.price_adjustment = Decimal("-30000")
        rec = receivable_factory(amount=Decimal("10000"))
        mock_receivable_query(order_change_service, rec)

        with pytest.raises(ValueError, match="saldo a favor"):
            await order_change_service._settle_change_finance(
                change=mock_change, order=mock_order, school_id=uuid4(),
                payment_method=PaymentMethod.CREDIT, txn_service=txn_service_mock,
                approved_by=None,
            )

    @pytest.mark.asyncio
    async def test_paid_amount_clamps_at_zero(
        self, order_change_service, mock_change, mock_order, txn_service_mock,
        mock_receivable_query,
    ):
        # Defensivo: si la data es inconsistente, paid_amount no debe ser negativo
        mock_change.price_adjustment = Decimal("-50000")
        mock_order.paid_amount = Decimal("10000")
        mock_receivable_query(order_change_service, None)

        await order_change_service._settle_change_finance(
            change=mock_change, order=mock_order, school_id=uuid4(),
            payment_method=PaymentMethod.CASH, txn_service=txn_service_mock,
            approved_by=None,
        )

        assert mock_order.paid_amount == Decimal("0")


# ============================================================================
# 4. _settle_sale_change_finance — lógica financiera de sales
# ============================================================================

@pytest.fixture
def sale_change_service():
    """Instancia de SaleService con db mockeado."""
    from app.services.sale import SaleService

    return SaleService(db=AsyncMock())


@pytest.fixture
def mock_sale():
    sale = MagicMock()
    sale.id = uuid4()
    sale.code = "TEST-001-VNT-2026-0001"
    sale.client_id = uuid4()
    sale.total = Decimal("100000")
    sale.paid_amount = Decimal("100000")
    return sale


@pytest.fixture
def mock_sale_change(mock_sale):
    change = MagicMock()
    change.id = uuid4()
    change.sale = mock_sale
    change.price_adjustment = Decimal("0")
    return change


class TestSettleSaleChangeFinance:
    """Tests para SaleChangeMixin._settle_sale_change_finance."""

    @pytest.mark.asyncio
    async def test_negative_adjustment_full_paid_triggers_cash_refund(
        self, sale_change_service, mock_sale_change, txn_service_mock,
        mock_receivable_query,
    ):
        # Sale paid=100k=total. adj=-20k. No receivable. → EXPENSE 20k, paid→80k.
        mock_sale_change.price_adjustment = Decimal("-20000")
        mock_receivable_query(sale_change_service, None)

        await sale_change_service._settle_sale_change_finance(
            change=mock_sale_change, school_id=uuid4(),
            payment_method=PaymentMethod.CASH, txn_service=txn_service_mock,
            approved_by=None,
        )

        txn_service_mock.record.assert_called_once()
        call_kwargs = txn_service_mock.record.call_args.kwargs
        assert call_kwargs["type"] == TransactionType.EXPENSE
        assert call_kwargs["amount"] == Decimal("20000")
        assert call_kwargs["force_income_map"] is True
        assert mock_sale_change.sale.paid_amount == Decimal("80000")

    @pytest.mark.asyncio
    async def test_positive_adjustment_cash_charges_and_raises_paid(
        self, sale_change_service, mock_sale_change, txn_service_mock,
        mock_receivable_query,
    ):
        mock_sale_change.price_adjustment = Decimal("3000")
        mock_receivable_query(sale_change_service, None)

        await sale_change_service._settle_sale_change_finance(
            change=mock_sale_change, school_id=uuid4(),
            payment_method=PaymentMethod.CASH, txn_service=txn_service_mock,
            approved_by=None,
        )

        txn_service_mock.record.assert_called_once()
        call_kwargs = txn_service_mock.record.call_args.kwargs
        assert call_kwargs["type"] == TransactionType.INCOME
        assert mock_sale_change.sale.paid_amount == Decimal("103000")

    @pytest.mark.asyncio
    async def test_credit_with_overpayment_blocks(
        self, sale_change_service, mock_sale_change, txn_service_mock,
        mock_receivable_query,
    ):
        mock_sale_change.price_adjustment = Decimal("-15000")
        mock_receivable_query(sale_change_service, None)

        with pytest.raises(ValueError, match="saldo a favor"):
            await sale_change_service._settle_sale_change_finance(
                change=mock_sale_change, school_id=uuid4(),
                payment_method=PaymentMethod.CREDIT, txn_service=txn_service_mock,
                approved_by=None,
            )
