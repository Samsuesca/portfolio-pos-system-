"""
Multi-Channel Notification Orchestrator

Coordinates sending notifications across multiple channels (email, WhatsApp).
Each channel operates independently - if one fails, others continue.

Default behavior (AUTO preference):
- If client has email → send email
- If client has phone AND WhatsApp is enabled → send WhatsApp
- Both channels can be used simultaneously
"""
import asyncio
import logging
from dataclasses import dataclass
from decimal import Decimal
from typing import TYPE_CHECKING

logger = logging.getLogger(__name__)

from app.core.config import settings
from app.models.client import NotificationPreference
from app.services import email as email_service
from app.services import whatsapp as whatsapp_service

if TYPE_CHECKING:
    from app.models.client import Client
    from app.models.order import Order
    from app.models.sale import Sale


@dataclass
class NotificationResult:
    """Result of sending notification to multiple channels"""
    email_sent: bool = False
    email_error: str | None = None
    whatsapp_sent: bool = False
    whatsapp_error: str | None = None

    @property
    def any_sent(self) -> bool:
        """True if at least one channel succeeded"""
        return self.email_sent or self.whatsapp_sent

    @property
    def all_sent(self) -> bool:
        """True if all attempted channels succeeded"""
        return self.email_sent and self.whatsapp_sent


def _get_channels_for_client(client: "Client") -> list[str]:
    """
    Determine which notification channels to use for a client.

    Logic:
    - If preference is explicit (email/whatsapp/both/none) → respect it
    - If preference is AUTO → use available channels based on client data
    """
    pref = client.notification_preference

    # Explicit preferences
    if pref == NotificationPreference.NONE:
        return []
    if pref == NotificationPreference.EMAIL:
        return ["email"] if client.email else []
    if pref == NotificationPreference.WHATSAPP:
        return ["whatsapp"] if client.phone and settings.WHATSAPP_ENABLED else []
    if pref == NotificationPreference.BOTH:
        channels = []
        if client.email:
            channels.append("email")
        if client.phone and settings.WHATSAPP_ENABLED:
            channels.append("whatsapp")
        return channels

    # AUTO mode - use available channels
    channels = []
    if client.email:
        channels.append("email")
    if client.phone and settings.WHATSAPP_ENABLED:
        channels.append("whatsapp")

    return channels


async def notify_order_ready(
    client: "Client",
    order: "Order",
    school_name: str = ""
) -> NotificationResult:
    """
    Send "order ready for pickup" notification via available channels.

    Args:
        client: Client to notify
        order: Order that is ready
        school_name: School name for context

    Returns:
        NotificationResult with status of each channel
    """
    result = NotificationResult()
    channels = _get_channels_for_client(client)

    if not channels:
        logger.debug(f"No channels available for client {client.code}")
        return result

    tasks = []

    # Email notification
    if "email" in channels and client.email:
        async def send_email():
            try:
                success = email_service.send_order_ready_email(
                    email=client.email,
                    name=client.name,
                    order_code=order.code,
                    school_name=school_name
                )
                return ("email", success, None)
            except Exception as e:
                return ("email", False, str(e))
        tasks.append(send_email())

    # WhatsApp notification
    if "whatsapp" in channels and client.phone:
        async def send_whatsapp():
            try:
                success = whatsapp_service.send_order_ready(
                    phone=client.phone,
                    name=client.name,
                    order_code=order.code,
                    school_name=school_name
                )
                return ("whatsapp", success, None)
            except Exception as e:
                return ("whatsapp", False, str(e))
        tasks.append(send_whatsapp())

    # Run all channels in parallel
    if tasks:
        results = await asyncio.gather(*tasks, return_exceptions=True)

        for res in results:
            if isinstance(res, Exception):
                logger.error(f"Unexpected notification error: {res}")
                continue

            channel, success, error = res
            if channel == "email":
                result.email_sent = success
                result.email_error = error
            elif channel == "whatsapp":
                result.whatsapp_sent = success
                result.whatsapp_error = error

    logger.info(f"Order {order.code} ready notification - email:{result.email_sent} whatsapp:{result.whatsapp_sent}")
    return result


async def notify_order_status_update(
    client: "Client",
    order: "Order",
    school_name: str = "",
    items_summary: list[dict] | None = None,
    trigger_message: str = "",
    order_status_label: str = "",
    progress_summary: str = "",
) -> NotificationResult:
    """
    Send order status update notification via available channels.
    Triggered when an individual item or the order status changes.

    Args:
        client: Client to notify
        order: Order with updated status
        school_name: School name for context
        items_summary: List of dicts with item details for email template
        trigger_message: Human-readable description of what changed
        order_status_label: Human-readable order status
        progress_summary: Short progress text for WhatsApp (e.g., "2/3 items listos")
    """
    result = NotificationResult()
    channels = _get_channels_for_client(client)

    if not channels:
        logger.debug(f"No channels available for client {client.code}")
        return result

    tasks = []

    # Email notification (detailed with items table)
    if "email" in channels and client.email:
        async def send_email():
            try:
                success = email_service.send_order_status_update_email(
                    email=client.email,
                    name=client.name,
                    order_code=order.code,
                    school_name=school_name,
                    items_summary=items_summary,
                    order_status_label=order_status_label,
                    trigger_message=trigger_message,
                    order_id=order.id,
                    client_id=order.client_id,
                )
                return ("email", success, None)
            except Exception as e:
                return ("email", False, str(e))
        tasks.append(send_email())

    # WhatsApp notification (short summary)
    if "whatsapp" in channels and client.phone:
        async def send_whatsapp():
            try:
                success = whatsapp_service.send_order_status_update(
                    phone=client.phone,
                    name=client.name,
                    order_code=order.code,
                    trigger_message=trigger_message,
                    progress_summary=progress_summary,
                )
                return ("whatsapp", success, None)
            except Exception as e:
                return ("whatsapp", False, str(e))
        tasks.append(send_whatsapp())

    if tasks:
        results = await asyncio.gather(*tasks, return_exceptions=True)
        for res in results:
            if isinstance(res, Exception):
                logger.error(f"Unexpected notification error: {res}")
                continue
            channel, success, error = res
            if channel == "email":
                result.email_sent = success
                result.email_error = error
            elif channel == "whatsapp":
                result.whatsapp_sent = success
                result.whatsapp_error = error

    logger.info(f"Order {order.code} status update notification - email:{result.email_sent} whatsapp:{result.whatsapp_sent}")
    return result


async def notify_order_confirmation(
    client: "Client",
    order: "Order",
    email_html: str,
    school_name: str = ""
) -> NotificationResult:
    """
    Send order confirmation notification via available channels.

    Args:
        client: Client to notify
        order: Order that was created
        email_html: Pre-generated HTML content for email
        school_name: School name for context

    Returns:
        NotificationResult with status of each channel
    """
    result = NotificationResult()
    channels = _get_channels_for_client(client)

    if not channels:
        return result

    tasks = []

    # Email notification (uses pre-generated HTML)
    if "email" in channels and client.email:
        async def send_email():
            try:
                success = email_service.send_order_confirmation_email(
                    email=client.email,
                    name=client.name,
                    order_code=order.code,
                    html_content=email_html
                )
                return ("email", success, None)
            except Exception as e:
                return ("email", False, str(e))
        tasks.append(send_email())

    # WhatsApp notification
    if "whatsapp" in channels and client.phone:
        async def send_whatsapp():
            try:
                success = whatsapp_service.send_order_confirmation(
                    phone=client.phone,
                    name=client.name,
                    order_code=order.code,
                    total=order.total
                )
                return ("whatsapp", success, None)
            except Exception as e:
                return ("whatsapp", False, str(e))
        tasks.append(send_whatsapp())

    if tasks:
        results = await asyncio.gather(*tasks, return_exceptions=True)
        for res in results:
            if isinstance(res, Exception):
                continue
            channel, success, error = res
            if channel == "email":
                result.email_sent = success
                result.email_error = error
            elif channel == "whatsapp":
                result.whatsapp_sent = success
                result.whatsapp_error = error

    logger.info(f"Order {order.code} confirmed notification - email:{result.email_sent} whatsapp:{result.whatsapp_sent}")
    return result


async def notify_sale_confirmation(
    client: "Client",
    sale: "Sale",
    email_html: str,
    school_name: str = ""
) -> NotificationResult:
    """
    Send sale confirmation notification via available channels.

    Args:
        client: Client to notify
        sale: Sale that was completed
        email_html: Pre-generated HTML content for email
        school_name: School name for context

    Returns:
        NotificationResult with status of each channel
    """
    result = NotificationResult()
    channels = _get_channels_for_client(client)

    if not channels:
        return result

    tasks = []

    # Email notification
    if "email" in channels and client.email:
        async def send_email():
            try:
                success = email_service.send_sale_confirmation_email(
                    email=client.email,
                    name=client.name,
                    sale_code=sale.code,
                    html_content=email_html
                )
                return ("email", success, None)
            except Exception as e:
                return ("email", False, str(e))
        tasks.append(send_email())

    # WhatsApp notification
    if "whatsapp" in channels and client.phone:
        async def send_whatsapp():
            try:
                success = whatsapp_service.send_sale_confirmation(
                    phone=client.phone,
                    name=client.name,
                    sale_code=sale.code,
                    total=sale.total
                )
                return ("whatsapp", success, None)
            except Exception as e:
                return ("whatsapp", False, str(e))
        tasks.append(send_whatsapp())

    if tasks:
        results = await asyncio.gather(*tasks, return_exceptions=True)
        for res in results:
            if isinstance(res, Exception):
                continue
            channel, success, error = res
            if channel == "email":
                result.email_sent = success
                result.email_error = error
            elif channel == "whatsapp":
                result.whatsapp_sent = success
                result.whatsapp_error = error

    logger.info(f"Sale {sale.code} confirmed notification - email:{result.email_sent} whatsapp:{result.whatsapp_sent}")
    return result


async def notify_welcome(
    client: "Client",
    activation_token: str,
    transaction_type: str = "encargo"
) -> NotificationResult:
    """
    Send welcome notification for new clients on first transaction.

    Args:
        client: New client to welcome
        activation_token: Token for account activation
        transaction_type: "encargo" or "venta"

    Returns:
        NotificationResult with status of each channel
    """
    result = NotificationResult()
    channels = _get_channels_for_client(client)

    if not channels:
        return result

    tasks = []

    # Email welcome (includes activation link)
    if "email" in channels and client.email:
        async def send_email():
            try:
                success = email_service.send_welcome_with_activation_email(
                    email=client.email,
                    token=activation_token,
                    name=client.name,
                    transaction_type=transaction_type
                )
                return ("email", success, None)
            except Exception as e:
                return ("email", False, str(e))
        tasks.append(send_email())

    # WhatsApp welcome
    if "whatsapp" in channels and client.phone:
        async def send_whatsapp():
            try:
                success = whatsapp_service.send_welcome_message(
                    phone=client.phone,
                    name=client.name
                )
                return ("whatsapp", success, None)
            except Exception as e:
                return ("whatsapp", False, str(e))
        tasks.append(send_whatsapp())

    if tasks:
        results = await asyncio.gather(*tasks, return_exceptions=True)
        for res in results:
            if isinstance(res, Exception):
                continue
            channel, success, error = res
            if channel == "email":
                result.email_sent = success
                result.email_error = error
            elif channel == "whatsapp":
                result.whatsapp_sent = success
                result.whatsapp_error = error

    logger.info(f"Welcome notification {client.code} - email:{result.email_sent} whatsapp:{result.whatsapp_sent}")
    return result


async def notify_payment_reminder(
    client: "Client",
    amount: Decimal,
    due_date: str,
    reference: str = ""
) -> NotificationResult:
    """
    Send payment reminder notification.

    Args:
        client: Client with pending payment
        amount: Amount due
        due_date: Due date string
        reference: Order/sale reference

    Returns:
        NotificationResult with status of each channel
    """
    result = NotificationResult()
    channels = _get_channels_for_client(client)

    if not channels:
        return result

    tasks = []

    # WhatsApp reminder (primary channel for reminders)
    if "whatsapp" in channels and client.phone:
        async def send_whatsapp():
            try:
                success = whatsapp_service.send_payment_reminder(
                    phone=client.phone,
                    name=client.name,
                    amount=amount,
                    due_date=due_date
                )
                return ("whatsapp", success, None)
            except Exception as e:
                return ("whatsapp", False, str(e))
        tasks.append(send_whatsapp())

    # Note: Email reminder not implemented yet
    # Could add email_service.send_payment_reminder() in the future

    if tasks:
        results = await asyncio.gather(*tasks, return_exceptions=True)
        for res in results:
            if isinstance(res, Exception):
                continue
            channel, success, error = res
            if channel == "whatsapp":
                result.whatsapp_sent = success
                result.whatsapp_error = error

    logger.info(f"Payment reminder {client.code} - whatsapp:{result.whatsapp_sent}")
    return result
