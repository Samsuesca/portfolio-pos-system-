"""
WhatsApp Business Cloud API Service

Sends notifications via WhatsApp Business API (Meta Cloud API).
Works in parallel with email notifications - if one fails, the other continues.

Free tier: 1,000 service conversations/month
Utility messages (Colombia): ~$0.0008 USD per message
"""
import logging
import re
import httpx
from decimal import Decimal
from typing import Optional
from app.core.config import settings

logger = logging.getLogger(__name__)


def format_phone_for_whatsapp(phone: str) -> str:
    """
    Convert Colombian phone number to international format for WhatsApp API.

    Args:
        phone: Phone in various formats ("3001234567", "300 123 4567", "+573001234567")

    Returns:
        Phone in format "573001234567" (no + prefix, with country code)
    """
    if not phone:
        return ""

    # Remove all non-digit characters
    clean = re.sub(r'\D', '', phone)

    # If already has country code (57)
    if clean.startswith('57') and len(clean) == 12:
        return clean

    # Colombian mobile: 10 digits starting with 3
    if len(clean) == 10 and clean.startswith('3'):
        return f"57{clean}"

    # Return as-is if format is unknown
    return clean


def _send_template_message(
    phone: str,
    template_name: str,
    template_params: list[str],
    language_code: str = "es"
) -> bool:
    """
    Send a WhatsApp template message via Meta Cloud API.

    Args:
        phone: Phone number in international format (573001234567)
        template_name: Name of the pre-approved template
        template_params: List of parameter values for template variables
        language_code: Template language (default: "es" for Spanish)

    Returns:
        True if sent successfully, False otherwise
    """
    # Dev mode - just log
    if not settings.WHATSAPP_ENABLED:
        logger.debug(f"WhatsApp disabled. Would send '{template_name}' to {phone}")
        return True

    if not settings.WHATSAPP_ACCESS_TOKEN or not settings.WHATSAPP_PHONE_NUMBER_ID:
        logger.debug(f"WhatsApp not configured. Would send '{template_name}' to {phone}")
        return True

    # Format phone number
    formatted_phone = format_phone_for_whatsapp(phone)
    if not formatted_phone:
        logger.warning(f"Invalid phone number for WhatsApp: {phone}")
        return False

    # Build template components
    components = []
    if template_params:
        components.append({
            "type": "body",
            "parameters": [
                {"type": "text", "text": param} for param in template_params
            ]
        })

    # API request payload
    payload = {
        "messaging_product": "whatsapp",
        "to": formatted_phone,
        "type": "template",
        "template": {
            "name": template_name,
            "language": {"code": language_code},
            "components": components
        }
    }

    try:
        url = f"https://graph.facebook.com/v21.0/{settings.WHATSAPP_PHONE_NUMBER_ID}/messages"
        headers = {
            "Authorization": f"Bearer {settings.WHATSAPP_ACCESS_TOKEN}",
            "Content-Type": "application/json"
        }

        with httpx.Client(timeout=30.0) as client:
            response = client.post(url, json=payload, headers=headers)

        if response.status_code == 200:
            data = response.json()
            message_id = data.get("messages", [{}])[0].get("id", "unknown")
            logger.info(f"WhatsApp sent to {formatted_phone}: {template_name} (id: {message_id})")
            return True
        else:
            error = response.json().get("error", {})
            error_msg = error.get("message", response.text)
            error_code = error.get("code", "unknown")
            logger.error(f"WhatsApp API error ({error_code}): {error_msg}")
            return False

    except httpx.TimeoutException:
        logger.error(f"WhatsApp API timeout sending to {formatted_phone}")
        return False
    except Exception as e:
        logger.error(f"WhatsApp error sending to {formatted_phone}: {e}")
        return False


def send_order_ready(
    phone: str,
    name: str,
    order_code: str,
    school_name: str = ""
) -> bool:
    """
    Send WhatsApp notification when order is ready for pickup.

    Template: order_ready_v1
    Variables: {{1}} = name, {{2}} = order_code
    Category: UTILITY (~$0.0008 USD)
    """
    params = [name, order_code]
    return _send_template_message(phone, "order_ready_v1", params)


def send_order_confirmation(
    phone: str,
    name: str,
    order_code: str,
    total: Decimal
) -> bool:
    """
    Send WhatsApp confirmation when order is created.

    Template: order_confirmation_v1
    Variables: {{1}} = name, {{2}} = order_code, {{3}} = total
    Category: UTILITY
    """
    # Format total as Colombian pesos
    total_formatted = f"${total:,.0f}".replace(",", ".")
    params = [name, order_code, total_formatted]
    return _send_template_message(phone, "order_confirmation_v1", params)


def send_sale_confirmation(
    phone: str,
    name: str,
    sale_code: str,
    total: Decimal
) -> bool:
    """
    Send WhatsApp confirmation when sale is completed.

    Template: sale_confirmation_v1
    Variables: {{1}} = name, {{2}} = sale_code, {{3}} = total
    Category: UTILITY
    """
    total_formatted = f"${total:,.0f}".replace(",", ".")
    params = [name, sale_code, total_formatted]
    return _send_template_message(phone, "sale_confirmation_v1", params)


def send_welcome_message(
    phone: str,
    name: str
) -> bool:
    """
    Send WhatsApp welcome message for new clients.

    Template: welcome_v1
    Variables: {{1}} = name
    Category: UTILITY
    """
    params = [name]
    return _send_template_message(phone, "welcome_v1", params)


def send_payment_reminder(
    phone: str,
    name: str,
    amount: Decimal,
    due_date: str
) -> bool:
    """
    Send WhatsApp payment reminder for pending receivables.

    Template: payment_reminder_v1
    Variables: {{1}} = name, {{2}} = amount, {{3}} = due_date
    Category: UTILITY
    """
    amount_formatted = f"${amount:,.0f}".replace(",", ".")
    params = [name, amount_formatted, due_date]
    return _send_template_message(phone, "payment_reminder_v1", params)


def send_order_status_update(
    phone: str,
    name: str,
    order_code: str,
    trigger_message: str,
    progress_summary: str = ""
) -> bool:
    """
    Send WhatsApp notification when an order item status changes.

    Template: order_status_update_v1
    Variables: {{1}} = name, {{2}} = order_code, {{3}} = trigger_message, {{4}} = progress_summary
    Category: UTILITY
    """
    params = [name, order_code, trigger_message, progress_summary]
    return _send_template_message(phone, "order_status_update_v1", params)


def send_custom_message(
    phone: str,
    template_name: str,
    params: list[str]
) -> bool:
    """
    Send any custom template message.

    Use this for templates not covered by the specific functions above.
    """
    return _send_template_message(phone, template_name, params)
