"""Telegram message templates for each alert type.

Each static method returns an HTML-formatted string ready for Telegram's
HTML parse mode. Methods map 1:1 to TelegramAlertType enum values.

Messages are sent with parse_mode="HTML", so every dynamic string field is
escaped via ``_esc`` before interpolation. This matters because some fields
ARE user-controlled: PQRS name/subject come from the public, unauthenticated
``POST /contacts/submit`` endpoint, and web-order client names come from the
portal. Without escaping, a ``&``/``<``/``>`` in a legitimate name silently
breaks Telegram's HTML parser (the alert is dropped), and an attacker could
inject an ``<a href>`` phishing link into the admins' chat.
"""
import html
from decimal import Decimal


def _esc(value: str) -> str:
    """Escape a dynamic value for Telegram HTML parse mode.

    quote=False keeps apostrophes readable (names like "Mom's"); ``<``/``>``/``&``
    are still escaped, which is what neutralizes tag injection in text context.
    """
    return html.escape(value, quote=False)


class TelegramMessageBuilder:
    """Stateless factory of HTML alert messages.

    Each method corresponds to a TelegramAlertType. Returns a ready-to-send
    string — callers pass it to TelegramService.send_alert() or route_alert().
    """

    @staticmethod
    def sale_created(
        code: str,
        total: Decimal,
        school_name: str,
        seller_name: str | None = None,
        payment_method: str | None = None,
        client_name: str | None = None,
    ) -> str:
        parts = [
            f"<b>Venta Registrada</b>",
            f"Codigo: <code>{_esc(code)}</code>",
            f"Total: <b>${total:,.0f}</b>",
            f"Colegio: {_esc(school_name)}",
        ]
        if client_name:
            parts.append(f"Cliente: {_esc(client_name)}")
        if seller_name:
            parts.append(f"Vendedor: {_esc(seller_name)}")
        if payment_method:
            parts.append(f"Pago: {_esc(payment_method)}")
        return "\n".join(parts)

    @staticmethod
    def web_order_created(
        code: str,
        total: Decimal,
        school_name: str,
        client_name: str | None = None,
        delivery_type: str | None = None,
    ) -> str:
        parts = [
            f"<b>Nuevo Pedido Web</b>",
            f"Codigo: <code>{_esc(code)}</code>",
            f"Total: <b>${total:,.0f}</b>",
            f"Colegio: {_esc(school_name)}",
        ]
        if client_name:
            parts.append(f"Cliente: {_esc(client_name)}")
        if delivery_type:
            parts.append(f"Entrega: {_esc(delivery_type)}")
        return "\n".join(parts)

    @staticmethod
    def order_created(
        code: str,
        total: Decimal,
        school_name: str,
        client_name: str | None = None,
        delivery_type: str | None = None,
        seller_name: str | None = None,
    ) -> str:
        """Encargo creado en mostrador (origen distinto a web_order_created)."""
        parts = [
            f"<b>Nuevo Encargo</b>",
            f"Codigo: <code>{_esc(code)}</code>",
            f"Total: <b>${total:,.0f}</b>",
            f"Colegio: {_esc(school_name)}",
        ]
        if client_name:
            parts.append(f"Cliente: {_esc(client_name)}")
        if seller_name:
            parts.append(f"Vendedor: {_esc(seller_name)}")
        if delivery_type:
            parts.append(f"Entrega: {_esc(delivery_type)}")
        return "\n".join(parts)

    @staticmethod
    def order_status_changed(
        code: str,
        old_status: str,
        new_status: str,
        school_name: str,
    ) -> str:
        status_emoji = {
            "pending": "🕐",
            "in_production": "🔨",
            "ready": "✅",
            "delivered": "📦",
            "cancelled": "❌",
        }
        emoji = status_emoji.get(new_status, "🔔")
        return (
            f"{emoji} <b>Pedido Actualizado</b>\n"
            f"Codigo: <code>{_esc(code)}</code>\n"
            f"Estado: {_esc(old_status)} → <b>{_esc(new_status)}</b>\n"
            f"Colegio: {_esc(school_name)}"
        )

    @staticmethod
    def low_stock(
        product_code: str,
        product_name: str,
        current_qty: int,
        min_alert: int,
        school_name: str,
    ) -> str:
        return (
            f"<b>Inventario Bajo</b>\n"
            f"Producto: {_esc(product_name)} (<code>{_esc(product_code)}</code>)\n"
            f"Stock actual: <b>{current_qty}</b> (minimo: {min_alert})\n"
            f"Colegio: {_esc(school_name)}"
        )

    @staticmethod
    def expense_created(
        description: str,
        amount: Decimal,
        category: str | None = None,
    ) -> str:
        parts = [
            f"<b>Gasto Registrado</b>",
            f"Descripcion: {_esc(description)}",
            f"Monto: <b>${amount:,.0f}</b>",
        ]
        if category:
            parts.append(f"Categoria: {_esc(category)}")
        return "\n".join(parts)

    @staticmethod
    def expense_paid(
        description: str,
        amount: Decimal,
        payment_method: str | None = None,
    ) -> str:
        parts = [
            f"<b>Gasto Pagado</b>",
            f"Descripcion: {_esc(description)}",
            f"Monto: <b>${amount:,.0f}</b>",
        ]
        if payment_method:
            parts.append(f"Metodo: {_esc(payment_method)}")
        return "\n".join(parts)

    @staticmethod
    def wompi_payment(
        status: str,
        amount: Decimal,
        reference: str,
        order_code: str | None = None,
    ) -> str:
        emoji = "✅" if status == "APPROVED" else "❌"
        status_label = "Aprobado" if status == "APPROVED" else "Rechazado"
        parts = [
            f"{emoji} <b>Pago Wompi {status_label}</b>",
            f"Monto: <b>${amount:,.0f}</b>",
            f"Referencia: <code>{_esc(reference)}</code>",
        ]
        if order_code:
            parts.append(f"Pedido: <code>{_esc(order_code)}</code>")
        return "\n".join(parts)

    @staticmethod
    def pqrs_received(
        contact_type: str,
        name: str,
        subject: str | None = None,
        school_name: str | None = None,
    ) -> str:
        parts = [
            f"<b>PQRS Recibido</b>",
            f"Tipo: {_esc(contact_type)}",
            f"De: {_esc(name)}",
        ]
        if subject:
            parts.append(f"Asunto: {_esc(subject)}")
        if school_name:
            parts.append(f"Colegio: {_esc(school_name)}")
        return "\n".join(parts)

    @staticmethod
    def attendance_alert(
        employee_name: str,
        status: str,
        minutes_late: int | None = None,
    ) -> str:
        if status == "late" and minutes_late:
            return (
                f"<b>Llegada Tarde</b>\n"
                f"Empleado: {_esc(employee_name)}\n"
                f"Minutos tarde: <b>{minutes_late}</b>"
            )
        return (
            f"<b>Alerta Asistencia</b>\n"
            f"Empleado: {_esc(employee_name)}\n"
            f"Estado: {_esc(status)}"
        )

    @staticmethod
    def cash_drawer_access(
        requester_name: str,
        reason: str | None = None,
    ) -> str:
        parts = [
            f"<b>Acceso a Caja Solicitado</b>",
            f"Solicitante: {_esc(requester_name)}",
        ]
        if reason:
            parts.append(f"Razon: {_esc(reason)}")
        return "\n".join(parts)

    # ── Arreglos / alterations ────────────────────────────────────

    @staticmethod
    def alteration_received(
        code: str,
        garment_name: str,
        cost: Decimal,
        client_name: str | None = None,
        alteration_type: str | None = None,
    ) -> str:
        parts = [
            f"<b>Nuevo Arreglo Recibido</b>",
            f"Codigo: <code>{_esc(code)}</code>",
            f"Prenda: {_esc(garment_name)}",
            f"Costo: <b>${cost:,.0f}</b>",
        ]
        if alteration_type:
            parts.append(f"Tipo: {_esc(alteration_type)}")
        if client_name:
            parts.append(f"Cliente: {_esc(client_name)}")
        return "\n".join(parts)

    @staticmethod
    def alteration_delivered(
        code: str,
        garment_name: str,
        client_name: str | None = None,
    ) -> str:
        parts = [
            f"<b>Arreglo Entregado</b>",
            f"Codigo: <code>{_esc(code)}</code>",
            f"Prenda: {_esc(garment_name)}",
        ]
        if client_name:
            parts.append(f"Cliente: {_esc(client_name)}")
        return "\n".join(parts)

    @staticmethod
    def alteration_payment(
        code: str,
        amount: Decimal,
        balance: Decimal,
        payment_method: str | None = None,
        client_name: str | None = None,
    ) -> str:
        parts = [
            f"<b>Pago de Arreglo</b>",
            f"Codigo: <code>{_esc(code)}</code>",
            f"Monto: <b>${amount:,.0f}</b>",
            f"Saldo pendiente: <b>${balance:,.0f}</b>",
        ]
        if payment_method:
            parts.append(f"Metodo: {_esc(payment_method)}")
        if client_name:
            parts.append(f"Cliente: {_esc(client_name)}")
        return "\n".join(parts)

    # ── Digest / Reminder messages ────────────────────────────────

    @staticmethod
    def daily_digest(
        date_str: str,
        total_sales: int,
        sales_revenue: Decimal,
        total_orders: int,
        pending_orders: int,
        cash_balance: Decimal | None = None,
        bank_balance: Decimal | None = None,
        low_stock_count: int = 0,
        expenses_total: Decimal | None = None,
    ) -> str:
        parts = [
            f"<b>Resumen Diario — {date_str}</b>",
            "",
            f"<b>Ventas:</b> {total_sales} por <b>${sales_revenue:,.0f}</b>",
            f"<b>Pedidos:</b> {total_orders} nuevos, {pending_orders} pendientes",
        ]
        if cash_balance is not None:
            parts.append(f"<b>Caja:</b> ${cash_balance:,.0f}")
        if bank_balance is not None:
            parts.append(f"<b>Banco:</b> ${bank_balance:,.0f}")
        if expenses_total is not None:
            parts.append(f"<b>Gastos hoy:</b> ${expenses_total:,.0f}")
        if low_stock_count > 0:
            parts.append(f"<b>Productos bajo stock:</b> {low_stock_count}")
        return "\n".join(parts)

    @staticmethod
    def daily_digest_seller(
        date_str: str,
        school_name: str,
        total_sales: int,
        sales_revenue: Decimal,
        total_orders: int,
        pending_orders: int,
        low_stock_count: int = 0,
    ) -> str:
        parts = [
            f"<b>Resumen Diario — {date_str}</b>",
            f"Colegio: <b>{_esc(school_name)}</b>",
            "",
            f"<b>Ventas:</b> {total_sales} por <b>${sales_revenue:,.0f}</b>",
            f"<b>Pedidos:</b> {total_orders} nuevos, {pending_orders} pendientes",
        ]
        if low_stock_count > 0:
            parts.append(f"<b>Productos bajo stock:</b> {low_stock_count}")
        return "\n".join(parts)

    @staticmethod
    def reminder_close_cash() -> str:
        return (
            "<b>Recordatorio: Cerrar Caja</b>\n"
            "No se ha registrado cierre de caja hoy.\n"
            "Recuerde cerrar caja antes de terminar la jornada."
        )

    @staticmethod
    def reminder_pending_expenses(count: int, total: Decimal) -> str:
        return (
            f"<b>Gastos Pendientes por Pagar</b>\n"
            f"Cantidad: <b>{count}</b>\n"
            f"Total pendiente: <b>${total:,.0f}</b>"
        )

    @staticmethod
    def reminder_overdue_receivables(count: int, total: Decimal) -> str:
        return (
            f"<b>Cuentas por Cobrar Vencidas</b>\n"
            f"Cantidad: <b>{count}</b>\n"
            f"Total vencido: <b>${total:,.0f}</b>"
        )

    @staticmethod
    def reminder_orders_ready(count: int) -> str:
        return (
            f"<b>Pedidos Listos para Entregar</b>\n"
            f"Hay <b>{count}</b> pedidos en estado READY pendientes de entrega."
        )

    @staticmethod
    def weekly_summary(
        week_str: str,
        total_sales: int,
        sales_revenue: Decimal,
        total_orders: int,
        expenses_total: Decimal,
        net_result: Decimal,
    ) -> str:
        emoji = "📈" if net_result >= 0 else "📉"
        return (
            f"<b>Resumen Semanal — {week_str}</b>\n"
            "\n"
            f"<b>Ventas:</b> {total_sales} por ${sales_revenue:,.0f}\n"
            f"<b>Pedidos:</b> {total_orders}\n"
            f"<b>Gastos:</b> ${expenses_total:,.0f}\n"
            f"{emoji} <b>Resultado neto:</b> ${net_result:,.0f}"
        )

    @staticmethod
    def low_balance_warning(
        account_name: str,
        balance: Decimal,
        threshold: Decimal,
    ) -> str:
        return "\n".join([
            f"<b>Alerta: Saldo Bajo</b>",
            f"Cuenta: {_esc(account_name)}",
            f"Saldo actual: <b>${balance:,.0f}</b>",
            f"Umbral: ${threshold:,.0f}",
            f"Atencion requerida.",
        ])

    @staticmethod
    def inventory_log_failed(
        movement_type: str,
        quantity_delta: int,
        reference: str | None,
        error: str,
    ) -> str:
        parts = [
            f"<b>Alerta: Log de Inventario en DLQ</b>",
            f"Un movimiento de stock no pudo registrarse en la auditoria",
            f"despues de 3 reintentos. La operacion de stock SI se persistio,",
            f"pero el log esta en cola de reintento.",
            f"",
            f"Tipo: <code>{_esc(movement_type)}</code>",
            f"Delta: <b>{quantity_delta:+d}</b>",
        ]
        if reference:
            parts.append(f"Referencia: <code>{_esc(reference)}</code>")
        parts.append(f"Error: {_esc(error)}")
        parts.append(f"Reprocesara automaticamente en el cron diario.")
        return "\n".join(parts)
