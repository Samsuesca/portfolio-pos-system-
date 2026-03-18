"""
Tests for TelegramMessageBuilder.

Validates that every static method produces valid HTML strings
with the expected content, formatting, and conditional sections.
"""
import pytest
from decimal import Decimal

from app.services.telegram_messages import TelegramMessageBuilder


# ---------------------------------------------------------------------------
# sale_created
# ---------------------------------------------------------------------------


class TestSaleCreated:
    """Test TelegramMessageBuilder.sale_created."""

    @pytest.mark.unit
    def test_sale_created_basic_fields(self):
        """Includes code, total, and school name."""
        msg = TelegramMessageBuilder.sale_created(
            code="VNT-2025-0001",
            total=Decimal("150000"),
            school_name="I.E. Caracas",
        )
        assert "<b>Venta Registrada</b>" in msg
        assert "<code>VNT-2025-0001</code>" in msg
        assert "$150,000" in msg
        assert "I.E. Caracas" in msg

    @pytest.mark.unit
    def test_sale_created_with_optional_fields(self):
        """Includes client, seller, and payment method when provided."""
        msg = TelegramMessageBuilder.sale_created(
            code="VNT-2025-0002",
            total=Decimal("250000"),
            school_name="Colegio Test",
            seller_name="Ana Lopez",
            payment_method="nequi",
            client_name="Maria Garcia",
        )
        assert "Cliente: Maria Garcia" in msg
        assert "Vendedor: Ana Lopez" in msg
        assert "Pago: nequi" in msg

    @pytest.mark.unit
    def test_sale_created_without_optional_fields(self):
        """Omits optional lines when not provided."""
        msg = TelegramMessageBuilder.sale_created(
            code="VNT-2025-0003",
            total=Decimal("100000"),
            school_name="Colegio A",
        )
        assert "Cliente:" not in msg
        assert "Vendedor:" not in msg
        assert "Pago:" not in msg

    @pytest.mark.unit
    def test_sale_created_large_total_formatted(self):
        """Large monetary values are formatted with thousand separators."""
        msg = TelegramMessageBuilder.sale_created(
            code="VNT-2025-0004",
            total=Decimal("12345678"),
            school_name="School",
        )
        assert "$12,345,678" in msg


# ---------------------------------------------------------------------------
# web_order_created
# ---------------------------------------------------------------------------


class TestWebOrderCreated:
    """Test TelegramMessageBuilder.web_order_created."""

    @pytest.mark.unit
    def test_web_order_basic(self):
        """Contains header, code, total, school."""
        msg = TelegramMessageBuilder.web_order_created(
            code="ENC-2025-0001",
            total=Decimal("200000"),
            school_name="Colegio Web",
        )
        assert "<b>Nuevo Pedido Web</b>" in msg
        assert "<code>ENC-2025-0001</code>" in msg
        assert "$200,000" in msg
        assert "Colegio Web" in msg

    @pytest.mark.unit
    def test_web_order_with_client_and_delivery(self):
        """Includes client and delivery type when provided."""
        msg = TelegramMessageBuilder.web_order_created(
            code="ENC-2025-0002",
            total=Decimal("350000"),
            school_name="Test",
            client_name="Pedro Ruiz",
            delivery_type="domicilio",
        )
        assert "Cliente: Pedro Ruiz" in msg
        assert "Entrega: domicilio" in msg

    @pytest.mark.unit
    def test_web_order_without_optionals(self):
        """Omits optional lines when None."""
        msg = TelegramMessageBuilder.web_order_created(
            code="ENC-2025-0003",
            total=Decimal("50000"),
            school_name="School",
        )
        assert "Cliente:" not in msg
        assert "Entrega:" not in msg


# ---------------------------------------------------------------------------
# order_status_changed
# ---------------------------------------------------------------------------


class TestOrderStatusChanged:
    """Test TelegramMessageBuilder.order_status_changed."""

    @pytest.mark.unit
    def test_order_status_basic(self):
        """Contains code, old/new status, and school name."""
        msg = TelegramMessageBuilder.order_status_changed(
            code="ENC-2025-0001",
            old_status="pending",
            new_status="in_production",
            school_name="Colegio X",
        )
        assert "<b>Pedido Actualizado</b>" in msg
        assert "<code>ENC-2025-0001</code>" in msg
        assert "pending" in msg
        assert "<b>in_production</b>" in msg
        assert "Colegio X" in msg

    @pytest.mark.unit
    @pytest.mark.parametrize(
        "new_status,expected_emoji",
        [
            ("pending", "\U0001f550"),      # clock
            ("in_production", "\U0001f528"),  # hammer
            ("ready", "\u2705"),             # check mark
            ("delivered", "\U0001f4e6"),      # package
            ("cancelled", "\u274c"),         # cross mark
        ],
    )
    def test_order_status_emoji_mapping(self, new_status, expected_emoji):
        """Each status maps to a specific emoji."""
        msg = TelegramMessageBuilder.order_status_changed(
            code="X",
            old_status="pending",
            new_status=new_status,
            school_name="S",
        )
        assert msg.startswith(expected_emoji)

    @pytest.mark.unit
    def test_order_status_unknown_status_uses_bell(self):
        """Unknown status uses the default bell emoji."""
        msg = TelegramMessageBuilder.order_status_changed(
            code="X",
            old_status="a",
            new_status="unknown_value",
            school_name="S",
        )
        assert msg.startswith("\U0001f514")  # bell emoji


# ---------------------------------------------------------------------------
# low_stock
# ---------------------------------------------------------------------------


class TestLowStock:
    """Test TelegramMessageBuilder.low_stock."""

    @pytest.mark.unit
    def test_low_stock_all_fields(self):
        """Message includes product info, stock, and school."""
        msg = TelegramMessageBuilder.low_stock(
            product_code="PRD-0001",
            product_name="Camisa Blanca T12",
            current_qty=3,
            min_alert=10,
            school_name="I.E. Caracas",
        )
        assert "<b>Inventario Bajo</b>" in msg
        assert "Camisa Blanca T12" in msg
        assert "<code>PRD-0001</code>" in msg
        assert "<b>3</b>" in msg
        assert "minimo: 10" in msg
        assert "I.E. Caracas" in msg


# ---------------------------------------------------------------------------
# expense_created
# ---------------------------------------------------------------------------


class TestExpenseCreated:
    """Test TelegramMessageBuilder.expense_created."""

    @pytest.mark.unit
    def test_expense_created_basic(self):
        """Contains description and amount."""
        msg = TelegramMessageBuilder.expense_created(
            description="Electricity bill",
            amount=Decimal("250000"),
        )
        assert "<b>Gasto Registrado</b>" in msg
        assert "Electricity bill" in msg
        assert "$250,000" in msg

    @pytest.mark.unit
    def test_expense_created_with_category(self):
        """Includes category when provided."""
        msg = TelegramMessageBuilder.expense_created(
            description="Water",
            amount=Decimal("80000"),
            category="utilities",
        )
        assert "Categoria: utilities" in msg

    @pytest.mark.unit
    def test_expense_created_without_category(self):
        """Omits category line when None."""
        msg = TelegramMessageBuilder.expense_created(
            description="Misc",
            amount=Decimal("10000"),
        )
        assert "Categoria:" not in msg


# ---------------------------------------------------------------------------
# expense_paid
# ---------------------------------------------------------------------------


class TestExpensePaid:
    """Test TelegramMessageBuilder.expense_paid."""

    @pytest.mark.unit
    def test_expense_paid_basic(self):
        """Contains description and amount."""
        msg = TelegramMessageBuilder.expense_paid(
            description="Rent",
            amount=Decimal("2000000"),
        )
        assert "<b>Gasto Pagado</b>" in msg
        assert "Rent" in msg
        assert "$2,000,000" in msg

    @pytest.mark.unit
    def test_expense_paid_with_payment_method(self):
        """Includes payment method when provided."""
        msg = TelegramMessageBuilder.expense_paid(
            description="Rent",
            amount=Decimal("2000000"),
            payment_method="transfer",
        )
        assert "Metodo: transfer" in msg

    @pytest.mark.unit
    def test_expense_paid_without_payment_method(self):
        """Omits method line when None."""
        msg = TelegramMessageBuilder.expense_paid(
            description="Rent",
            amount=Decimal("1000000"),
        )
        assert "Metodo:" not in msg


# ---------------------------------------------------------------------------
# wompi_payment
# ---------------------------------------------------------------------------


class TestWompiPayment:
    """Test TelegramMessageBuilder.wompi_payment."""

    @pytest.mark.unit
    def test_wompi_payment_approved(self):
        """Approved payment shows check emoji and Aprobado label."""
        msg = TelegramMessageBuilder.wompi_payment(
            status="APPROVED",
            amount=Decimal("150000"),
            reference="REF-001",
        )
        assert "\u2705" in msg  # check mark
        assert "Aprobado" in msg
        assert "$150,000" in msg
        assert "<code>REF-001</code>" in msg

    @pytest.mark.unit
    def test_wompi_payment_declined(self):
        """Declined payment shows cross emoji and Rechazado label."""
        msg = TelegramMessageBuilder.wompi_payment(
            status="DECLINED",
            amount=Decimal("100000"),
            reference="REF-002",
        )
        assert "\u274c" in msg  # cross mark
        assert "Rechazado" in msg

    @pytest.mark.unit
    def test_wompi_payment_with_order_code(self):
        """Includes order code when provided."""
        msg = TelegramMessageBuilder.wompi_payment(
            status="APPROVED",
            amount=Decimal("50000"),
            reference="REF-003",
            order_code="ENC-2025-ABCD",
        )
        assert "<code>ENC-2025-ABCD</code>" in msg

    @pytest.mark.unit
    def test_wompi_payment_without_order_code(self):
        """Omits order line when None."""
        msg = TelegramMessageBuilder.wompi_payment(
            status="APPROVED",
            amount=Decimal("50000"),
            reference="REF-004",
        )
        assert "Pedido:" not in msg


# ---------------------------------------------------------------------------
# pqrs_received
# ---------------------------------------------------------------------------


class TestPqrsReceived:
    """Test TelegramMessageBuilder.pqrs_received."""

    @pytest.mark.unit
    def test_pqrs_basic(self):
        """Contains type and name."""
        msg = TelegramMessageBuilder.pqrs_received(
            contact_type="queja",
            name="Carlos Perez",
        )
        assert "<b>PQRS Recibido</b>" in msg
        assert "Tipo: queja" in msg
        assert "De: Carlos Perez" in msg

    @pytest.mark.unit
    def test_pqrs_with_subject_and_school(self):
        """Includes subject and school when provided."""
        msg = TelegramMessageBuilder.pqrs_received(
            contact_type="solicitud",
            name="Ana",
            subject="Cambio de talla",
            school_name="Colegio Z",
        )
        assert "Asunto: Cambio de talla" in msg
        assert "Colegio: Colegio Z" in msg

    @pytest.mark.unit
    def test_pqrs_without_optionals(self):
        """Omits optional lines when None."""
        msg = TelegramMessageBuilder.pqrs_received(
            contact_type="peticion",
            name="Juan",
        )
        assert "Asunto:" not in msg
        assert "Colegio:" not in msg


# ---------------------------------------------------------------------------
# attendance_alert
# ---------------------------------------------------------------------------


class TestAttendanceAlert:
    """Test TelegramMessageBuilder.attendance_alert."""

    @pytest.mark.unit
    def test_attendance_late_with_minutes(self):
        """Late status with minutes shows 'Llegada Tarde' and minutes count."""
        msg = TelegramMessageBuilder.attendance_alert(
            employee_name="Maria Lopez",
            status="late",
            minutes_late=15,
        )
        assert "<b>Llegada Tarde</b>" in msg
        assert "Maria Lopez" in msg
        assert "<b>15</b>" in msg

    @pytest.mark.unit
    def test_attendance_late_without_minutes(self):
        """Late status without minutes falls through to generic message."""
        msg = TelegramMessageBuilder.attendance_alert(
            employee_name="Pedro",
            status="late",
            minutes_late=None,
        )
        assert "<b>Alerta Asistencia</b>" in msg
        assert "Estado: late" in msg

    @pytest.mark.unit
    def test_attendance_generic_status(self):
        """Non-late status shows generic attendance alert."""
        msg = TelegramMessageBuilder.attendance_alert(
            employee_name="Juan",
            status="absent",
        )
        assert "<b>Alerta Asistencia</b>" in msg
        assert "Estado: absent" in msg
        assert "Minutos tarde" not in msg


# ---------------------------------------------------------------------------
# cash_drawer_access
# ---------------------------------------------------------------------------


class TestCashDrawerAccess:
    """Test TelegramMessageBuilder.cash_drawer_access."""

    @pytest.mark.unit
    def test_cash_drawer_basic(self):
        """Contains requester name."""
        msg = TelegramMessageBuilder.cash_drawer_access(
            requester_name="Ana Admin",
        )
        assert "<b>Acceso a Caja Solicitado</b>" in msg
        assert "Solicitante: Ana Admin" in msg

    @pytest.mark.unit
    def test_cash_drawer_with_reason(self):
        """Includes reason when provided."""
        msg = TelegramMessageBuilder.cash_drawer_access(
            requester_name="Ana",
            reason="Devolucion de efectivo",
        )
        assert "Razon: Devolucion de efectivo" in msg

    @pytest.mark.unit
    def test_cash_drawer_without_reason(self):
        """Omits reason when None."""
        msg = TelegramMessageBuilder.cash_drawer_access(
            requester_name="Ana",
        )
        assert "Razon:" not in msg


# ---------------------------------------------------------------------------
# daily_digest
# ---------------------------------------------------------------------------


class TestDailyDigest:
    """Test TelegramMessageBuilder.daily_digest."""

    @pytest.mark.unit
    def test_daily_digest_all_fields(self):
        """Includes all sections when all optional values are provided."""
        msg = TelegramMessageBuilder.daily_digest(
            date_str="15/03/2026",
            total_sales=12,
            sales_revenue=Decimal("2500000"),
            total_orders=5,
            pending_orders=3,
            cash_balance=Decimal("1200000"),
            bank_balance=Decimal("5000000"),
            low_stock_count=4,
            expenses_total=Decimal("800000"),
        )
        assert "<b>Resumen Diario" in msg
        assert "15/03/2026" in msg
        assert "12" in msg
        assert "$2,500,000" in msg
        assert "5 nuevos" in msg
        assert "3 pendientes" in msg
        assert "$1,200,000" in msg
        assert "$5,000,000" in msg
        assert "4" in msg
        assert "$800,000" in msg

    @pytest.mark.unit
    def test_daily_digest_minimal(self):
        """Only required fields produce a valid message."""
        msg = TelegramMessageBuilder.daily_digest(
            date_str="15/03/2026",
            total_sales=0,
            sales_revenue=Decimal("0"),
            total_orders=0,
            pending_orders=0,
        )
        assert "<b>Resumen Diario" in msg
        assert "Caja:" not in msg
        assert "Banco:" not in msg
        assert "Gastos hoy:" not in msg
        assert "Productos bajo stock:" not in msg

    @pytest.mark.unit
    def test_daily_digest_low_stock_zero_hidden(self):
        """low_stock_count=0 does not show the low stock line."""
        msg = TelegramMessageBuilder.daily_digest(
            date_str="01/01/2026",
            total_sales=1,
            sales_revenue=Decimal("50000"),
            total_orders=0,
            pending_orders=0,
            low_stock_count=0,
        )
        assert "Productos bajo stock:" not in msg


# ---------------------------------------------------------------------------
# reminder_close_cash
# ---------------------------------------------------------------------------


class TestReminderCloseCash:
    """Test TelegramMessageBuilder.reminder_close_cash."""

    @pytest.mark.unit
    def test_reminder_close_cash_content(self):
        """Static method returns the close-cash reminder text."""
        msg = TelegramMessageBuilder.reminder_close_cash()
        assert "<b>Recordatorio: Cerrar Caja</b>" in msg
        assert "cierre de caja" in msg.lower()


# ---------------------------------------------------------------------------
# reminder_pending_expenses
# ---------------------------------------------------------------------------


class TestReminderPendingExpenses:
    """Test TelegramMessageBuilder.reminder_pending_expenses."""

    @pytest.mark.unit
    def test_reminder_pending_expenses(self):
        """Shows count and total of pending expenses."""
        msg = TelegramMessageBuilder.reminder_pending_expenses(
            count=5, total=Decimal("3500000")
        )
        assert "<b>Gastos Pendientes por Pagar</b>" in msg
        assert "<b>5</b>" in msg
        assert "$3,500,000" in msg


# ---------------------------------------------------------------------------
# reminder_overdue_receivables
# ---------------------------------------------------------------------------


class TestReminderOverdueReceivables:
    """Test TelegramMessageBuilder.reminder_overdue_receivables."""

    @pytest.mark.unit
    def test_reminder_overdue_receivables(self):
        """Shows count and total of overdue receivables."""
        msg = TelegramMessageBuilder.reminder_overdue_receivables(
            count=3, total=Decimal("1200000")
        )
        assert "<b>Cuentas por Cobrar Vencidas</b>" in msg
        assert "<b>3</b>" in msg
        assert "$1,200,000" in msg


# ---------------------------------------------------------------------------
# reminder_orders_ready
# ---------------------------------------------------------------------------


class TestReminderOrdersReady:
    """Test TelegramMessageBuilder.reminder_orders_ready."""

    @pytest.mark.unit
    def test_reminder_orders_ready(self):
        """Shows count of orders ready for delivery."""
        msg = TelegramMessageBuilder.reminder_orders_ready(count=7)
        assert "<b>Pedidos Listos para Entregar</b>" in msg
        assert "<b>7</b>" in msg
        assert "READY" in msg


# ---------------------------------------------------------------------------
# weekly_summary
# ---------------------------------------------------------------------------


class TestWeeklySummary:
    """Test TelegramMessageBuilder.weekly_summary."""

    @pytest.mark.unit
    def test_weekly_summary_positive_net(self):
        """Positive net result uses up-trend emoji."""
        msg = TelegramMessageBuilder.weekly_summary(
            week_str="09/03 - 15/03/2026",
            total_sales=45,
            sales_revenue=Decimal("8500000"),
            total_orders=12,
            expenses_total=Decimal("3200000"),
            net_result=Decimal("5300000"),
        )
        assert "<b>Resumen Semanal" in msg
        assert "09/03 - 15/03/2026" in msg
        assert "45" in msg
        assert "$8,500,000" in msg
        assert "12" in msg
        assert "$3,200,000" in msg
        assert "$5,300,000" in msg
        # Up-trend emoji for positive result
        assert "\U0001f4c8" in msg  # chart increasing

    @pytest.mark.unit
    def test_weekly_summary_negative_net(self):
        """Negative net result uses down-trend emoji."""
        msg = TelegramMessageBuilder.weekly_summary(
            week_str="02/03 - 08/03/2026",
            total_sales=10,
            sales_revenue=Decimal("1000000"),
            total_orders=2,
            expenses_total=Decimal("1500000"),
            net_result=Decimal("-500000"),
        )
        assert "\U0001f4c9" in msg  # chart decreasing

    @pytest.mark.unit
    def test_weekly_summary_zero_net(self):
        """Zero net result uses up-trend emoji (>= 0 condition)."""
        msg = TelegramMessageBuilder.weekly_summary(
            week_str="X",
            total_sales=0,
            sales_revenue=Decimal("0"),
            total_orders=0,
            expenses_total=Decimal("0"),
            net_result=Decimal("0"),
        )
        assert "\U0001f4c8" in msg


# ---------------------------------------------------------------------------
# HTML validity checks (cross-cutting)
# ---------------------------------------------------------------------------


class TestHtmlValidity:
    """Verify all message builders produce well-formed HTML tags."""

    @pytest.mark.unit
    @pytest.mark.parametrize(
        "builder_call",
        [
            lambda: TelegramMessageBuilder.sale_created("C", Decimal("1"), "S"),
            lambda: TelegramMessageBuilder.web_order_created("C", Decimal("1"), "S"),
            lambda: TelegramMessageBuilder.order_status_changed("C", "a", "b", "S"),
            lambda: TelegramMessageBuilder.low_stock("C", "N", 1, 10, "S"),
            lambda: TelegramMessageBuilder.expense_created("D", Decimal("1")),
            lambda: TelegramMessageBuilder.expense_paid("D", Decimal("1")),
            lambda: TelegramMessageBuilder.wompi_payment("APPROVED", Decimal("1"), "R"),
            lambda: TelegramMessageBuilder.pqrs_received("T", "N"),
            lambda: TelegramMessageBuilder.attendance_alert("N", "late", 5),
            lambda: TelegramMessageBuilder.cash_drawer_access("N"),
            lambda: TelegramMessageBuilder.daily_digest("D", 0, Decimal("0"), 0, 0),
            lambda: TelegramMessageBuilder.reminder_close_cash(),
            lambda: TelegramMessageBuilder.reminder_pending_expenses(1, Decimal("1")),
            lambda: TelegramMessageBuilder.reminder_overdue_receivables(1, Decimal("1")),
            lambda: TelegramMessageBuilder.reminder_orders_ready(1),
            lambda: TelegramMessageBuilder.weekly_summary("W", 0, Decimal("0"), 0, Decimal("0"), Decimal("0")),
        ],
    )
    def test_all_builders_return_strings_with_html_bold(self, builder_call):
        """Every builder returns a non-empty string containing <b> tags."""
        msg = builder_call()
        assert isinstance(msg, str)
        assert len(msg) > 0
        assert "<b>" in msg
        assert "</b>" in msg

    @pytest.mark.unit
    @pytest.mark.parametrize(
        "builder_call",
        [
            lambda: TelegramMessageBuilder.sale_created("C", Decimal("1"), "S"),
            lambda: TelegramMessageBuilder.web_order_created("C", Decimal("1"), "S"),
            lambda: TelegramMessageBuilder.order_status_changed("C", "a", "b", "S"),
            lambda: TelegramMessageBuilder.low_stock("C", "N", 1, 10, "S"),
            lambda: TelegramMessageBuilder.wompi_payment("APPROVED", Decimal("1"), "R"),
        ],
    )
    def test_code_fields_use_code_tag(self, builder_call):
        """Messages with code/reference fields use <code> tag."""
        msg = builder_call()
        assert "<code>" in msg
        assert "</code>" in msg
