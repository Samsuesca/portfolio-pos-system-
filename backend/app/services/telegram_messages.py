"""
Telegram Message Builder

Formats HTML messages for each alert type.
All messages use Telegram HTML parse mode.
"""
from decimal import Decimal


class TelegramMessageBuilder:
    """Build formatted Telegram HTML messages per alert type."""

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
            f"Codigo: <code>{code}</code>",
            f"Total: <b>${total:,.0f}</b>",
            f"Colegio: {school_name}",
        ]
        if client_name:
            parts.append(f"Cliente: {client_name}")
        if seller_name:
            parts.append(f"Vendedor: {seller_name}")
        if payment_method:
            parts.append(f"Pago: {payment_method}")
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
            f"Codigo: <code>{code}</code>",
            f"Total: <b>${total:,.0f}</b>",
            f"Colegio: {school_name}",
        ]
        if client_name:
            parts.append(f"Cliente: {client_name}")
        if delivery_type:
            parts.append(f"Entrega: {delivery_type}")
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
            f"Codigo: <code>{code}</code>\n"
            f"Estado: {old_status} → <b>{new_status}</b>\n"
            f"Colegio: {school_name}"
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
            f"Producto: {product_name} (<code>{product_code}</code>)\n"
            f"Stock actual: <b>{current_qty}</b> (minimo: {min_alert})\n"
            f"Colegio: {school_name}"
        )

    @staticmethod
    def expense_created(
        description: str,
        amount: Decimal,
        category: str | None = None,
    ) -> str:
        parts = [
            f"<b>Gasto Registrado</b>",
            f"Descripcion: {description}",
            f"Monto: <b>${amount:,.0f}</b>",
        ]
        if category:
            parts.append(f"Categoria: {category}")
        return "\n".join(parts)

    @staticmethod
    def expense_paid(
        description: str,
        amount: Decimal,
        payment_method: str | None = None,
    ) -> str:
        parts = [
            f"<b>Gasto Pagado</b>",
            f"Descripcion: {description}",
            f"Monto: <b>${amount:,.0f}</b>",
        ]
        if payment_method:
            parts.append(f"Metodo: {payment_method}")
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
            f"Referencia: <code>{reference}</code>",
        ]
        if order_code:
            parts.append(f"Pedido: <code>{order_code}</code>")
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
            f"Tipo: {contact_type}",
            f"De: {name}",
        ]
        if subject:
            parts.append(f"Asunto: {subject}")
        if school_name:
            parts.append(f"Colegio: {school_name}")
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
                f"Empleado: {employee_name}\n"
                f"Minutos tarde: <b>{minutes_late}</b>"
            )
        return (
            f"<b>Alerta Asistencia</b>\n"
            f"Empleado: {employee_name}\n"
            f"Estado: {status}"
        )

    @staticmethod
    def cash_drawer_access(
        requester_name: str,
        reason: str | None = None,
    ) -> str:
        parts = [
            f"<b>Acceso a Caja Solicitado</b>",
            f"Solicitante: {requester_name}",
        ]
        if reason:
            parts.append(f"Razon: {reason}")
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
