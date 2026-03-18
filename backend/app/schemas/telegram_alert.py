"""
Telegram Alert Schemas

Pydantic schemas for Telegram alert linking and subscription management.
"""
from uuid import UUID

from pydantic import Field

from app.models.telegram_subscription import TelegramAlertType
from app.schemas.base import BaseSchema


# ── Descriptions for each alert type ──────────────────────────────

ALERT_TYPE_DESCRIPTIONS: dict[str, str] = {
    TelegramAlertType.sale_created: "Nueva venta registrada",
    TelegramAlertType.web_order_created: "Nuevo pedido desde el portal web",
    TelegramAlertType.order_status_changed: "Cambio de estado en un pedido",
    TelegramAlertType.low_stock: "Alerta de inventario bajo",
    TelegramAlertType.expense_created: "Nuevo gasto registrado",
    TelegramAlertType.expense_paid: "Gasto marcado como pagado",
    TelegramAlertType.wompi_payment: "Pago Wompi aprobado o rechazado",
    TelegramAlertType.pqrs_received: "Nuevo mensaje de contacto/PQRS",
    TelegramAlertType.attendance_alert: "Empleado tarde o ausente",
    TelegramAlertType.cash_drawer_access: "Solicitud de acceso a caja",
    TelegramAlertType.reminder_close_cash: "Recordatorio: cerrar caja (6pm)",
    TelegramAlertType.reminder_pending_expenses: "Recordatorio: gastos pendientes por pagar (9am)",
    TelegramAlertType.reminder_overdue_receivables: "Recordatorio: cuentas por cobrar vencidas (9am)",
    TelegramAlertType.reminder_orders_ready: "Recordatorio: pedidos listos para entregar (9am)",
    TelegramAlertType.reminder_weekly_summary: "Resumen semanal (domingos 8pm)",
    TelegramAlertType.system_health: "Alertas de salud del sistema",
    TelegramAlertType.daily_digest: "Resumen diario del negocio (8pm)",
}


# ── Request schemas ───────────────────────────────────────────────

class TelegramLinkRequest(BaseSchema):
    """Request to link a Telegram chat_id to the current user."""
    chat_id: str = Field(
        ...,
        min_length=1,
        max_length=50,
        description="Telegram chat_id obtenido desde el bot",
    )


class TelegramUpdateSubscriptions(BaseSchema):
    """Request to update alert subscriptions."""
    alert_types: list[TelegramAlertType] = Field(
        ...,
        description="Lista de tipos de alerta a los que suscribirse (reemplaza las existentes)",
    )


class TelegramAdminLinkRequest(BaseSchema):
    """Admin request to link a user's Telegram."""
    chat_id: str = Field(
        ...,
        min_length=1,
        max_length=50,
    )


# ── Response schemas ──────────────────────────────────────────────

class AlertTypeInfo(BaseSchema):
    """Information about an alert type."""
    alert_type: TelegramAlertType
    description: str
    category: str  # "event", "reminder", or "system"


class SubscriptionResponse(BaseSchema):
    """A single subscription entry."""
    alert_type: TelegramAlertType
    description: str
    is_active: bool


class MySubscriptionsResponse(BaseSchema):
    """Current user's Telegram status and subscriptions."""
    is_linked: bool
    telegram_chat_id: str | None = None
    subscriptions: list[SubscriptionResponse]


class UserTelegramInfo(BaseSchema):
    """Admin view of a user's Telegram configuration."""
    user_id: UUID
    username: str
    full_name: str | None
    is_linked: bool
    telegram_chat_id: str | None = None
    subscriptions: list[SubscriptionResponse]


def get_alert_category(alert_type: TelegramAlertType) -> str:
    """Return the category for an alert type."""
    if alert_type.value.startswith("reminder_"):
        return "reminder"
    if alert_type in (TelegramAlertType.system_health, TelegramAlertType.daily_digest):
        return "system"
    return "event"
