"""
Shared notification utilities

This module provides shared notification functions used across multiple services
(order.py and sale.py) to avoid code duplication.
"""
import logging
import secrets
from datetime import datetime, timedelta
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.utils.timezone import get_colombia_now_naive
from app.models.client import Client
from app.services import notification_channels

logger = logging.getLogger(__name__)


async def send_welcome_notification_if_first_transaction(
    db: AsyncSession,
    client_id: UUID,
    reference_code: str,
    transaction_type: str  # "encargo" | "compra"
) -> bool:
    """
    Send welcome notification via email + WhatsApp on client's FIRST transaction.
    Uses multi-channel notification based on client preferences.

    This is the preferred approach:
    - NOT sent when client is created
    - SENT when client has their first order or sale
    - Email includes activation link, portal instructions, and business contact info
    - WhatsApp includes welcome message

    Args:
        db: Database session
        client_id: Client UUID
        reference_code: Order/Sale code for reference (e.g., "ENC-2024-0001" or "VNT-2024-0001")
        transaction_type: "encargo" for orders, "compra" for sales

    Returns:
        True if any notification was sent, False otherwise
    """
    # Get client
    result = await db.execute(
        select(Client).where(Client.id == client_id)
    )
    client = result.scalar_one_or_none()

    if not client:
        return False

    # Check if client has any contact info
    if not client.email and not client.phone:
        logger.debug(f"Client {client.name} has no contact info, skipping welcome notification")
        return False

    # Check if welcome notification was already sent (not first transaction)
    if client.welcome_email_sent:
        logger.debug(f"Client {client.name} already received welcome notification, skipping")
        return False

    # Generate new activation token (64 chars hex) - only used for email
    activation_token = secrets.token_hex(32)

    # Set token expiration to 7 days
    client.verification_token = activation_token
    client.verification_token_expires = get_colombia_now_naive() + timedelta(days=7)

    # Mark welcome notification as sent
    client.welcome_email_sent = True
    client.welcome_email_sent_at = get_colombia_now_naive()

    await db.flush()

    # Send welcome notification via multi-channel
    try:
        notification_result = await notification_channels.notify_welcome(
            client=client,
            activation_token=activation_token,
            transaction_type=transaction_type
        )

        if notification_result.any_sent:
            channels = []
            if notification_result.email_sent:
                channels.append("email")
            if notification_result.whatsapp_sent:
                channels.append("whatsapp")
            logger.info(f"Welcome notification sent via {', '.join(channels)} for {transaction_type} {reference_code}")
        else:
            logger.warning(f"Failed to send welcome notification for {transaction_type} {reference_code}")
            # Rollback the flag if all channels failed
            client.welcome_email_sent = False
            client.welcome_email_sent_at = None
            await db.flush()

        return notification_result.any_sent
    except Exception as e:
        logger.error(f"Error sending welcome notification: {e}")
        # Rollback the flag if notification failed
        client.welcome_email_sent = False
        client.welcome_email_sent_at = None
        await db.flush()
        return False
