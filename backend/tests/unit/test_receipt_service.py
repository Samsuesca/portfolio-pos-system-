"""
Unit Tests for ReceiptService

Tests pure formatting functions, sale/order detail fetching,
and HTML generation for receipts and emails.
"""
import pytest
from datetime import datetime
from decimal import Decimal
from uuid import uuid4
from unittest.mock import AsyncMock, MagicMock, patch

from app.services.receipt import (
    format_currency,
    format_date,
    format_date_short,
    get_status_text,
    get_delivery_type_text,
    ReceiptService,
)
from app.models.order import OrderStatus, DeliveryType


FAKE_NOW = datetime(2026, 4, 14, 10, 0, 0)


def _make_client(name="Ana Garcia", student_name="Pedro Garcia"):
    c = MagicMock()
    c.name = name
    c.student_name = student_name
    return c


def _make_product(name="Camisa", size="M"):
    p = MagicMock()
    p.name = name
    p.size = size
    return p


def _make_sale_item(product_name="Camisa", size="M", qty=2, unit_price=25000, subtotal=50000):
    item = MagicMock()
    item.product = _make_product(name=product_name, size=size)
    item.size = size
    item.quantity = qty
    item.unit_price = Decimal(str(unit_price))
    item.subtotal = Decimal(str(subtotal))
    return item


def _make_sale(
    code="V-001",
    total=Decimal("50000"),
    subtotal=Decimal("55000"),
    discount=Decimal("5000"),
    payment_method="cash",
    status="completed",
    paid_amount=None,
    client=None,
    items=None,
):
    s = MagicMock()
    s.id = uuid4()
    s.code = code
    s.total = total
    s.subtotal = subtotal
    s.discount = discount
    s.payment_method = payment_method
    s.status = status
    s.paid_amount = paid_amount if paid_amount is not None else total
    s.sale_date = FAKE_NOW
    s.client = client or _make_client()
    s.school = MagicMock(name="Colegio Test")
    s.user = MagicMock(username="vendedora1")
    s.items = items or [_make_sale_item()]
    return s


def _make_garment_type(name="Falda"):
    g = MagicMock()
    g.name = name
    return g


def _make_order_item(garment_name="Falda", size="S", qty=1, subtotal=30000, unit_price=30000):
    item = MagicMock()
    item.garment_type = _make_garment_type(name=garment_name)
    item.size = size
    item.quantity = qty
    item.unit_price = Decimal(str(unit_price))
    item.subtotal = Decimal(str(subtotal))
    return item


def _make_order(
    code="E-001",
    total=Decimal("80000"),
    subtotal=Decimal("80000"),
    paid_amount=Decimal("30000"),
    balance=Decimal("50000"),
    delivery_fee=Decimal("0"),
    delivery_type=DeliveryType.PICKUP,
    delivery_address=None,
    delivery_neighborhood=None,
    delivery_city=None,
    delivery_references=None,
    status=OrderStatus.PENDING,
    client=None,
    items=None,
):
    o = MagicMock()
    o.id = uuid4()
    o.code = code
    o.total = total
    o.subtotal = subtotal
    o.paid_amount = paid_amount
    o.balance = balance
    o.delivery_fee = delivery_fee
    o.delivery_type = delivery_type
    o.delivery_address = delivery_address
    o.delivery_neighborhood = delivery_neighborhood
    o.delivery_city = delivery_city
    o.delivery_references = delivery_references
    o.status = status
    o.order_date = FAKE_NOW
    o.client = client or _make_client()
    o.school = MagicMock(name="Colegio Test")
    o.user = MagicMock(username="vendedora1")
    o.items = items or [_make_order_item()]
    return o


# ============================================================================
# Pure Functions
# ============================================================================

class TestFormatCurrency:

    def test_formats_integer_amount(self):
        assert format_currency(50000) == "$50.000"

    def test_formats_zero(self):
        assert format_currency(0) == "$0"

    def test_formats_decimal(self):
        assert format_currency(Decimal("1500000")) == "$1.500.000"

    def test_formats_small_amount(self):
        assert format_currency(500) == "$500"


class TestFormatDate:

    def test_formats_datetime(self):
        dt = datetime(2026, 4, 14, 15, 30, 0)
        result = format_date(dt)
        assert "14/04/2026" in result
        assert "03:30 PM" in result

    def test_formats_morning_time(self):
        dt = datetime(2026, 1, 5, 9, 5, 0)
        result = format_date(dt)
        assert "05/01/2026" in result
        assert "09:05 AM" in result


class TestFormatDateShort:

    def test_formats_date_only(self):
        dt = datetime(2026, 12, 25, 10, 0, 0)
        assert format_date_short(dt) == "25/12/2026"


class TestGetStatusText:

    @pytest.mark.parametrize("status,expected", [
        (OrderStatus.PENDING, "Pendiente"),
        (OrderStatus.IN_PRODUCTION, "En Produccion"),
        (OrderStatus.READY, "Listo para Entrega"),
        (OrderStatus.DELIVERED, "Entregado"),
        (OrderStatus.CANCELLED, "Cancelado"),
    ])
    def test_maps_known_statuses(self, status, expected):
        assert get_status_text(status) == expected

    def test_returns_string_for_unknown_status(self):
        unknown = MagicMock()
        unknown.__str__ = lambda self: "weird_status"
        result = get_status_text(unknown)
        assert result == "weird_status"


class TestGetDeliveryTypeText:

    def test_pickup(self):
        assert get_delivery_type_text(DeliveryType.PICKUP) == "Retiro en Tienda"

    def test_delivery(self):
        assert get_delivery_type_text(DeliveryType.DELIVERY) == "Domicilio"


# ============================================================================
# ReceiptService — DB methods
# ============================================================================

class TestGetSaleWithDetails:

    @pytest.mark.asyncio
    async def test_returns_sale_when_found(self, mock_db_session):
        sale = _make_sale()
        mock_db_session.execute = AsyncMock(
            return_value=MagicMock(scalar_one_or_none=MagicMock(return_value=sale))
        )
        svc = ReceiptService(mock_db_session)

        result = await svc.get_sale_with_details(sale.id)

        assert result is sale

    @pytest.mark.asyncio
    async def test_returns_none_when_not_found(self, mock_db_session):
        mock_db_session.execute = AsyncMock(
            return_value=MagicMock(scalar_one_or_none=MagicMock(return_value=None))
        )
        svc = ReceiptService(mock_db_session)

        result = await svc.get_sale_with_details(uuid4())

        assert result is None


class TestGetOrderWithDetails:

    @pytest.mark.asyncio
    async def test_returns_order_when_found(self, mock_db_session):
        order = _make_order()
        mock_db_session.execute = AsyncMock(
            return_value=MagicMock(scalar_one_or_none=MagicMock(return_value=order))
        )
        svc = ReceiptService(mock_db_session)

        result = await svc.get_order_with_details(order.id)

        assert result is order

    @pytest.mark.asyncio
    async def test_returns_none_when_not_found(self, mock_db_session):
        mock_db_session.execute = AsyncMock(
            return_value=MagicMock(scalar_one_or_none=MagicMock(return_value=None))
        )
        svc = ReceiptService(mock_db_session)

        result = await svc.get_order_with_details(uuid4())

        assert result is None


# ============================================================================
# generate_sale_receipt_html
# ============================================================================

class TestGenerateSaleReceiptHtml:

    @pytest.mark.asyncio
    async def test_returns_none_for_missing_sale(self, mock_db_session):
        mock_db_session.execute = AsyncMock(
            return_value=MagicMock(scalar_one_or_none=MagicMock(return_value=None))
        )
        svc = ReceiptService(mock_db_session)

        result = await svc.generate_sale_receipt_html(uuid4())

        assert result is None

    @pytest.mark.asyncio
    async def test_includes_sale_code_and_total(self, mock_db_session):
        sale = _make_sale(code="V-500", total=Decimal("65000"), discount=Decimal("0"))
        mock_db_session.execute = AsyncMock(
            return_value=MagicMock(scalar_one_or_none=MagicMock(return_value=sale))
        )
        svc = ReceiptService(mock_db_session)

        html = await svc.generate_sale_receipt_html(sale.id)

        assert "V-500" in html
        assert "$65.000" in html

    @pytest.mark.asyncio
    async def test_includes_client_and_student_name(self, mock_db_session):
        client = _make_client(name="Maria Lopez", student_name="Juan Lopez")
        sale = _make_sale(client=client, discount=Decimal("0"))
        mock_db_session.execute = AsyncMock(
            return_value=MagicMock(scalar_one_or_none=MagicMock(return_value=sale))
        )
        svc = ReceiptService(mock_db_session)

        html = await svc.generate_sale_receipt_html(sale.id)

        assert "Maria Lopez" in html
        assert "Juan Lopez" in html

    @pytest.mark.asyncio
    async def test_shows_discount_when_present(self, mock_db_session):
        sale = _make_sale(discount=Decimal("10000"))
        mock_db_session.execute = AsyncMock(
            return_value=MagicMock(scalar_one_or_none=MagicMock(return_value=sale))
        )
        svc = ReceiptService(mock_db_session)

        html = await svc.generate_sale_receipt_html(sale.id)

        assert "Descuento" in html
        assert "$10.000" in html

    @pytest.mark.asyncio
    async def test_hides_discount_when_zero(self, mock_db_session):
        sale = _make_sale(discount=Decimal("0"))
        mock_db_session.execute = AsyncMock(
            return_value=MagicMock(scalar_one_or_none=MagicMock(return_value=sale))
        )
        svc = ReceiptService(mock_db_session)

        html = await svc.generate_sale_receipt_html(sale.id)

        assert "Descuento" not in html

    @pytest.mark.asyncio
    @pytest.mark.parametrize("method,expected_text", [
        ("cash", "Efectivo"),
        ("nequi", "Nequi"),
        ("transfer", "Transferencia"),
        ("card", "Tarjeta"),
        ("credit", "Credito"),
    ])
    async def test_payment_method_text_mapping(self, method, expected_text, mock_db_session):
        sale = _make_sale(payment_method=method, discount=Decimal("0"))
        mock_db_session.execute = AsyncMock(
            return_value=MagicMock(scalar_one_or_none=MagicMock(return_value=sale))
        )
        svc = ReceiptService(mock_db_session)

        html = await svc.generate_sale_receipt_html(sale.id)

        assert expected_text in html

    @pytest.mark.asyncio
    async def test_includes_item_details(self, mock_db_session):
        items = [_make_sale_item(product_name="Pantalon", size="L", qty=3, subtotal=90000)]
        sale = _make_sale(items=items, discount=Decimal("0"))
        mock_db_session.execute = AsyncMock(
            return_value=MagicMock(scalar_one_or_none=MagicMock(return_value=sale))
        )
        svc = ReceiptService(mock_db_session)

        html = await svc.generate_sale_receipt_html(sale.id)

        assert "3x Pantalon L" in html
        assert "$90.000" in html


# ============================================================================
# generate_order_receipt_html
# ============================================================================

class TestGenerateOrderReceiptHtml:

    @pytest.mark.asyncio
    async def test_returns_none_for_missing_order(self, mock_db_session):
        mock_db_session.execute = AsyncMock(
            return_value=MagicMock(scalar_one_or_none=MagicMock(return_value=None))
        )
        svc = ReceiptService(mock_db_session)

        result = await svc.generate_order_receipt_html(uuid4())

        assert result is None

    @pytest.mark.asyncio
    async def test_includes_order_code_and_status(self, mock_db_session):
        order = _make_order(code="E-200", status=OrderStatus.IN_PRODUCTION)
        mock_db_session.execute = AsyncMock(
            return_value=MagicMock(scalar_one_or_none=MagicMock(return_value=order))
        )
        svc = ReceiptService(mock_db_session)

        html = await svc.generate_order_receipt_html(order.id)

        assert "E-200" in html
        assert "En Produccion" in html

    @pytest.mark.asyncio
    async def test_shows_balance_when_partially_paid(self, mock_db_session):
        order = _make_order(
            total=Decimal("100000"),
            paid_amount=Decimal("40000"),
            balance=Decimal("60000"),
        )
        mock_db_session.execute = AsyncMock(
            return_value=MagicMock(scalar_one_or_none=MagicMock(return_value=order))
        )
        svc = ReceiptService(mock_db_session)

        html = await svc.generate_order_receipt_html(order.id)

        assert "Abonado" in html
        assert "$40.000" in html
        assert "SALDO" in html
        assert "$60.000" in html

    @pytest.mark.asyncio
    async def test_shows_pending_when_unpaid(self, mock_db_session):
        order = _make_order(
            total=Decimal("80000"),
            paid_amount=Decimal("0"),
            balance=Decimal("80000"),
        )
        mock_db_session.execute = AsyncMock(
            return_value=MagicMock(scalar_one_or_none=MagicMock(return_value=order))
        )
        svc = ReceiptService(mock_db_session)

        html = await svc.generate_order_receipt_html(order.id)

        assert "PENDIENTE" in html
        assert "$80.000" in html

    @pytest.mark.asyncio
    async def test_includes_delivery_info(self, mock_db_session):
        order = _make_order(
            delivery_type=DeliveryType.DELIVERY,
            delivery_address="Calle 10 #20-30",
            delivery_neighborhood="Poblado",
        )
        mock_db_session.execute = AsyncMock(
            return_value=MagicMock(scalar_one_or_none=MagicMock(return_value=order))
        )
        svc = ReceiptService(mock_db_session)

        html = await svc.generate_order_receipt_html(order.id)

        assert "Domicilio" in html
        assert "Calle 10 #20-30" in html
        assert "Poblado" in html


# ============================================================================
# generate_order_email_html
# ============================================================================

class TestGenerateOrderEmailHtml:

    @patch("app.services.receipt.get_colombia_now_naive", return_value=FAKE_NOW)
    def test_delivery_section_for_delivery_type(self, _tz):
        order = _make_order(
            delivery_type=DeliveryType.DELIVERY,
            delivery_address="Carrera 5 #10-20",
            delivery_neighborhood="Centro",
            delivery_city="Medellin",
        )
        svc = ReceiptService(MagicMock())

        html = svc.generate_order_email_html(order)

        assert "Envio a Domicilio" in html
        assert "Carrera 5 #10-20" in html
        assert "Centro" in html

    @patch("app.services.receipt.get_colombia_now_naive", return_value=FAKE_NOW)
    def test_pickup_section(self, _tz):
        order = _make_order(delivery_type=DeliveryType.PICKUP)
        svc = ReceiptService(MagicMock())

        html = svc.generate_order_email_html(order)

        assert "Retiro en Tienda" in html

    @patch("app.services.receipt.get_colombia_now_naive", return_value=FAKE_NOW)
    def test_paid_status(self, _tz):
        order = _make_order(
            total=Decimal("50000"),
            paid_amount=Decimal("50000"),
            balance=Decimal("0"),
        )
        svc = ReceiptService(MagicMock())

        html = svc.generate_order_email_html(order)

        assert "PAGADO" in html

    @patch("app.services.receipt.get_colombia_now_naive", return_value=FAKE_NOW)
    def test_partial_payment_status(self, _tz):
        order = _make_order(
            total=Decimal("100000"),
            paid_amount=Decimal("30000"),
            balance=Decimal("70000"),
        )
        svc = ReceiptService(MagicMock())

        html = svc.generate_order_email_html(order)

        assert "Abono" in html
        assert "$30.000" in html
        assert "Saldo pendiente" in html
        assert "$70.000" in html

    @patch("app.services.receipt.get_colombia_now_naive", return_value=FAKE_NOW)
    def test_unpaid_status(self, _tz):
        order = _make_order(
            total=Decimal("90000"),
            paid_amount=Decimal("0"),
            balance=Decimal("90000"),
        )
        svc = ReceiptService(MagicMock())

        html = svc.generate_order_email_html(order)

        assert "Pendiente de pago" in html
        assert "$90.000" in html

    @patch("app.services.receipt.get_colombia_now_naive", return_value=FAKE_NOW)
    def test_includes_client_and_student_info(self, _tz):
        client = _make_client(name="Laura Diaz", student_name="Sofia Diaz")
        order = _make_order(client=client)
        svc = ReceiptService(MagicMock())

        html = svc.generate_order_email_html(order)

        assert "Laura Diaz" in html
        assert "Sofia Diaz" in html


# ============================================================================
# generate_sale_email_html
# ============================================================================

class TestGenerateSaleEmailHtml:

    @patch("app.services.receipt.get_colombia_now_naive", return_value=FAKE_NOW)
    def test_paid_status(self, _tz):
        sale = _make_sale(
            total=Decimal("50000"),
            paid_amount=Decimal("50000"),
            discount=Decimal("0"),
        )
        svc = ReceiptService(MagicMock())

        html = svc.generate_sale_email_html(sale)

        assert "PAGADO" in html

    @patch("app.services.receipt.get_colombia_now_naive", return_value=FAKE_NOW)
    def test_partial_payment_status(self, _tz):
        sale = _make_sale(
            total=Decimal("80000"),
            paid_amount=Decimal("20000"),
            discount=Decimal("0"),
        )
        svc = ReceiptService(MagicMock())

        html = svc.generate_sale_email_html(sale)

        assert "Abono" in html
        assert "Saldo pendiente" in html

    @patch("app.services.receipt.get_colombia_now_naive", return_value=FAKE_NOW)
    def test_unpaid_status(self, _tz):
        sale = _make_sale(
            total=Decimal("60000"),
            paid_amount=Decimal("0"),
            discount=Decimal("0"),
        )
        svc = ReceiptService(MagicMock())

        html = svc.generate_sale_email_html(sale)

        assert "Pendiente de pago" in html
        assert "$60.000" in html

    @patch("app.services.receipt.get_colombia_now_naive", return_value=FAKE_NOW)
    def test_shows_discount_when_present(self, _tz):
        sale = _make_sale(discount=Decimal("8000"))
        svc = ReceiptService(MagicMock())

        html = svc.generate_sale_email_html(sale)

        assert "Descuento" in html
        assert "$8.000" in html

    @patch("app.services.receipt.get_colombia_now_naive", return_value=FAKE_NOW)
    def test_hides_discount_when_zero(self, _tz):
        sale = _make_sale(discount=Decimal("0"))
        svc = ReceiptService(MagicMock())

        html = svc.generate_sale_email_html(sale)

        assert "Descuento" not in html

    @patch("app.services.receipt.get_colombia_now_naive", return_value=FAKE_NOW)
    def test_includes_payment_method(self, _tz):
        sale = _make_sale(payment_method="nequi", discount=Decimal("0"))
        svc = ReceiptService(MagicMock())

        html = svc.generate_sale_email_html(sale)

        assert "Nequi" in html
