"""
Email Service using Resend

Free tier: 3,000 emails/month

NOTE: Business info (name, contact, address, hours) is now centralized in
the business_settings table. Templates in this file should be gradually
updated to use get_business_info_sync() instead of hardcoded values.

EMAIL LOGGING: All email sends are logged via _queue_email_log() for auditing.
Use process_email_log_queue() to persist queued logs to the database.
"""
import logging
from typing import TYPE_CHECKING
from uuid import UUID

import resend

from app.core.config import settings
from app.models.email_log import EmailType, EmailStatus

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

# ============================================
# Email Logging Queue
# ============================================

# In-memory queue for pending email logs (processed asynchronously)
_email_log_queue: list[dict] = []


def _queue_email_log(
    email_type: EmailType,
    recipient_email: str,
    subject: str,
    status: EmailStatus,
    recipient_name: str | None = None,
    error_message: str | None = None,
    reference_code: str | None = None,
    client_id: UUID | None = None,
    order_id: UUID | None = None,
    sale_id: UUID | None = None,
    user_id: UUID | None = None,
    triggered_by: UUID | None = None,
) -> None:
    """
    Queue an email log entry for async processing.

    This is non-blocking and doesn't require a DB session.
    Call process_email_log_queue() to persist the logs.
    """
    _email_log_queue.append({
        "email_type": email_type,
        "recipient_email": recipient_email,
        "recipient_name": recipient_name,
        "subject": subject,
        "status": status,
        "error_message": error_message,
        "reference_code": reference_code,
        "client_id": client_id,
        "order_id": order_id,
        "sale_id": sale_id,
        "user_id": user_id,
        "triggered_by": triggered_by,
    })


async def process_email_log_queue(db: "AsyncSession") -> int:
    """
    Process pending email logs and persist them to the database.

    Returns the number of logs processed.

    Usage:
        # In a route or background task with DB session
        from app.services.email import process_email_log_queue
        await process_email_log_queue(db)
    """
    from app.services.email_log import EmailLogService

    global _email_log_queue

    if not _email_log_queue:
        return 0

    log_service = EmailLogService(db)
    processed = 0

    # Copy and clear queue atomically
    logs_to_process = _email_log_queue.copy()
    _email_log_queue.clear()

    for log_data in logs_to_process:
        try:
            await log_service.create_log(**log_data)
            processed += 1
        except Exception as e:
            logger.error(f"Failed to save email log: {e}")

    await db.commit()
    return processed


def get_email_log_queue_size() -> int:
    """Get the current size of the email log queue."""
    return len(_email_log_queue)


# Cached business info for email templates (sync version for non-async contexts)
_cached_business_info: dict | None = None
_cache_timestamp: float = 0

def get_business_info_sync() -> dict:
    """
    Get business info synchronously for email templates.
    Uses a simple cache to avoid DB calls on every email.

    Returns default values if DB is unavailable.
    """
    import time
    global _cached_business_info, _cache_timestamp

    # Cache for 5 minutes
    if _cached_business_info and (time.time() - _cache_timestamp) < 300:
        return _cached_business_info

    # Default values (fallback)
    defaults = {
        "business_name": "Uniformes Consuelo Rios",
        "business_name_short": "UCR",
        "phone_main": "+57 300 123 4567",
        "phone_support": "+57 301 568 7810",
        "whatsapp_number": "573001234567",
        "email_contact": "contact@example.com",
        "address_line1": "Calle 56 D #26 BE 04",
        "address_line2": "Villas de San José, Boston - Barrio Sucre",
        "city": "Medellín",
        "state": "Antioquia",
        "country": "Colombia",
        "hours_weekday": "Lunes a Viernes: 8:00 AM - 6:00 PM",
        "hours_saturday": "Sábados: 9:00 AM - 2:00 PM",
        "website_url": "https://yourdomain.com",
    }

    try:
        # Try to fetch from DB using sync connection
        from sqlalchemy import create_engine, text
        from app.core.config import settings as app_settings

        # Convert async URL to sync
        db_url = app_settings.DATABASE_URL.replace("+asyncpg", "")
        engine = create_engine(db_url)

        with engine.connect() as conn:
            result = conn.execute(text("SELECT key, value FROM business_settings"))
            rows = result.fetchall()
            if rows:
                _cached_business_info = {row[0]: row[1] for row in rows}
                _cache_timestamp = time.time()
                return _cached_business_info

    except Exception as e:
        logger.warning(f"Could not fetch business info from DB: {e}")

    _cached_business_info = defaults
    _cache_timestamp = time.time()
    return defaults


def invalidate_business_info_cache():
    """Clear the cached business info (call when settings are updated)."""
    global _cached_business_info, _cache_timestamp
    _cached_business_info = None
    _cache_timestamp = 0


def send_verification_email(email: str, code: str, name: str = "Usuario") -> bool:
    """
    Send email verification code.

    Returns True if sent successfully, False otherwise.
    """
    subject = "Codigo de verificacion - Uniformes"

    if not settings.RESEND_API_KEY:
        # Dev mode - just log
        logger.debug(f"[DEV] Verification code for {email}: {code}")
        _queue_email_log(
            email_type=EmailType.VERIFICATION,
            recipient_email=email,
            recipient_name=name,
            subject=subject,
            status=EmailStatus.DEV_SKIPPED,
        )
        return True

    resend.api_key = settings.RESEND_API_KEY

    try:
        resend.Emails.send({
            "from": settings.EMAIL_FROM,
            "to": [email],
            "subject": subject,
            "html": f"""
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: linear-gradient(135deg, #2563eb 0%, #4f46e5 100%); padding: 30px; text-align: center;">
                    <h1 style="color: white; margin: 0;">Uniformes</h1>
                </div>
                <div style="padding: 30px; background: #f9fafb;">
                    <h2 style="color: #1f2937; margin-top: 0;">Hola {name},</h2>
                    <p style="color: #4b5563; font-size: 16px;">
                        Tu código de verificación es:
                    </p>
                    <div style="background: white; border: 2px solid #e5e7eb; border-radius: 12px; padding: 20px; text-align: center; margin: 20px 0;">
                        <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #2563eb;">
                            {code}
                        </span>
                    </div>
                    <p style="color: #6b7280; font-size: 14px;">
                        Este código expira en <strong>10 minutos</strong>.
                    </p>
                    <p style="color: #6b7280; font-size: 14px;">
                        Si no solicitaste este código, puedes ignorar este correo.
                    </p>
                </div>
                <div style="padding: 20px; text-align: center; background: #f3f4f6;">
                    <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                        © 2026 Uniformes. Todos los derechos reservados.
                    </p>
                </div>
            </div>
            """
        })
        _queue_email_log(
            email_type=EmailType.VERIFICATION,
            recipient_email=email,
            recipient_name=name,
            subject=subject,
            status=EmailStatus.SUCCESS,
        )
        return True
    except Exception as e:
        logger.error(f"Error sending verification email: {e}")
        _queue_email_log(
            email_type=EmailType.VERIFICATION,
            recipient_email=email,
            recipient_name=name,
            subject=subject,
            status=EmailStatus.FAILED,
            error_message=str(e),
        )
        return False


def send_welcome_email(email: str, name: str) -> bool:
    """
    Send welcome email after successful registration.
    """
    subject = "Bienvenido a Uniformes!"

    if not settings.RESEND_API_KEY:
        logger.debug(f"[DEV] Welcome email for {email}")
        _queue_email_log(
            email_type=EmailType.WELCOME,
            recipient_email=email,
            recipient_name=name,
            subject=subject,
            status=EmailStatus.DEV_SKIPPED,
        )
        return True

    resend.api_key = settings.RESEND_API_KEY

    try:
        resend.Emails.send({
            "from": settings.EMAIL_FROM,
            "to": [email],
            "subject": subject,
            "html": f"""
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: linear-gradient(135deg, #2563eb 0%, #4f46e5 100%); padding: 30px; text-align: center;">
                    <h1 style="color: white; margin: 0;">Uniformes</h1>
                </div>
                <div style="padding: 30px; background: #f9fafb;">
                    <h2 style="color: #1f2937; margin-top: 0;">¡Bienvenido {name}!</h2>
                    <p style="color: #4b5563; font-size: 16px;">
                        Tu cuenta ha sido creada exitosamente. Ahora puedes:
                    </p>
                    <ul style="color: #4b5563; font-size: 16px;">
                        <li>Ver el catálogo de uniformes</li>
                        <li>Realizar pedidos</li>
                        <li>Ver el estado de tus pedidos</li>
                    </ul>
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="{settings.FRONTEND_URL}" style="background: #2563eb; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">
                            Ir a Uniformes
                        </a>
                    </div>
                </div>
                <div style="padding: 20px; text-align: center; background: #f3f4f6;">
                    <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                        © 2026 Uniformes. Todos los derechos reservados.
                    </p>
                </div>
            </div>
            """
        })
        _queue_email_log(
            email_type=EmailType.WELCOME,
            recipient_email=email,
            recipient_name=name,
            subject=subject,
            status=EmailStatus.SUCCESS,
        )
        return True
    except Exception as e:
        logger.error(f"Error sending welcome email: {e}")
        _queue_email_log(
            email_type=EmailType.WELCOME,
            recipient_email=email,
            recipient_name=name,
            subject=subject,
            status=EmailStatus.FAILED,
            error_message=str(e),
        )
        return False


def send_password_reset_email(email: str, code: str, name: str = "Usuario") -> bool:
    """
    Send password reset code.
    """
    subject = "Recuperar contrasena - Uniformes"

    if not settings.RESEND_API_KEY:
        logger.debug(f"[DEV] Password reset code for {email}: {code}")
        _queue_email_log(
            email_type=EmailType.PASSWORD_RESET,
            recipient_email=email,
            recipient_name=name,
            subject=subject,
            status=EmailStatus.DEV_SKIPPED,
        )
        return True

    resend.api_key = settings.RESEND_API_KEY

    try:
        resend.Emails.send({
            "from": settings.EMAIL_FROM,
            "to": [email],
            "subject": subject,
            "html": f"""
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: linear-gradient(135deg, #2563eb 0%, #4f46e5 100%); padding: 30px; text-align: center;">
                    <h1 style="color: white; margin: 0;">Uniformes</h1>
                </div>
                <div style="padding: 30px; background: #f9fafb;">
                    <h2 style="color: #1f2937; margin-top: 0;">Hola {name},</h2>
                    <p style="color: #4b5563; font-size: 16px;">
                        Recibimos una solicitud para restablecer tu contraseña. Tu código es:
                    </p>
                    <div style="background: white; border: 2px solid #e5e7eb; border-radius: 12px; padding: 20px; text-align: center; margin: 20px 0;">
                        <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #2563eb;">
                            {code}
                        </span>
                    </div>
                    <p style="color: #6b7280; font-size: 14px;">
                        Este código expira en <strong>15 minutos</strong>.
                    </p>
                    <p style="color: #6b7280; font-size: 14px;">
                        Si no solicitaste restablecer tu contraseña, puedes ignorar este correo.
                    </p>
                </div>
                <div style="padding: 20px; text-align: center; background: #f3f4f6;">
                    <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                        © 2026 Uniformes. Todos los derechos reservados.
                    </p>
                </div>
            </div>
            """
        })
        _queue_email_log(
            email_type=EmailType.PASSWORD_RESET,
            recipient_email=email,
            recipient_name=name,
            subject=subject,
            status=EmailStatus.SUCCESS,
        )
        return True
    except Exception as e:
        logger.error(f"Error sending password reset email: {e}")
        _queue_email_log(
            email_type=EmailType.PASSWORD_RESET,
            recipient_email=email,
            recipient_name=name,
            subject=subject,
            status=EmailStatus.FAILED,
            error_message=str(e),
        )
        return False


def send_order_confirmation_email(
    email: str,
    name: str,
    order_code: str,
    html_content: str,
    order_id: UUID | None = None,
    client_id: UUID | None = None,
    triggered_by: UUID | None = None,
) -> bool:
    """
    Send order confirmation email with receipt details.

    Args:
        email: Client email address
        name: Client name
        order_code: Order code (e.g., ENC-2026-0001)
        html_content: Pre-generated HTML content from ReceiptService
        order_id: Order UUID for logging
        client_id: Client UUID for logging
        triggered_by: User UUID who triggered the email
    """
    subject = f"Confirmacion de Encargo #{order_code} - Uniformes"

    if not settings.RESEND_API_KEY:
        logger.debug(f"[DEV] Order confirmation email for {email} - Order #{order_code}")
        _queue_email_log(
            email_type=EmailType.ORDER_CONFIRMATION,
            recipient_email=email,
            recipient_name=name,
            subject=subject,
            status=EmailStatus.DEV_SKIPPED,
            reference_code=order_code,
            order_id=order_id,
            client_id=client_id,
            triggered_by=triggered_by,
        )
        return True

    resend.api_key = settings.RESEND_API_KEY

    try:
        resend.Emails.send({
            "from": settings.EMAIL_FROM,
            "to": [email],
            "subject": subject,
            "html": html_content
        })
        logger.info(f"Order confirmation email sent to {email} for order #{order_code}")
        _queue_email_log(
            email_type=EmailType.ORDER_CONFIRMATION,
            recipient_email=email,
            recipient_name=name,
            subject=subject,
            status=EmailStatus.SUCCESS,
            reference_code=order_code,
            order_id=order_id,
            client_id=client_id,
            triggered_by=triggered_by,
        )
        return True
    except Exception as e:
        logger.error(f"Error sending order confirmation email: {e}")
        _queue_email_log(
            email_type=EmailType.ORDER_CONFIRMATION,
            recipient_email=email,
            recipient_name=name,
            subject=subject,
            status=EmailStatus.FAILED,
            error_message=str(e),
            reference_code=order_code,
            order_id=order_id,
            client_id=client_id,
            triggered_by=triggered_by,
        )
        return False


def send_sale_confirmation_email(
    email: str,
    name: str,
    sale_code: str,
    html_content: str,
    sale_id: UUID | None = None,
    client_id: UUID | None = None,
    triggered_by: UUID | None = None,
) -> bool:
    """
    Send sale confirmation email with receipt details.

    Args:
        email: Client email address
        name: Client name
        sale_code: Sale code (e.g., VNT-2026-0001)
        html_content: Pre-generated HTML content from ReceiptService
        sale_id: Sale UUID for logging
        client_id: Client UUID for logging
        triggered_by: User UUID who triggered the email
    """
    subject = f"Recibo de Venta #{sale_code} - Uniformes"

    if not settings.RESEND_API_KEY:
        logger.debug(f"[DEV] Sale confirmation email for {email} - Sale #{sale_code}")
        _queue_email_log(
            email_type=EmailType.SALE_CONFIRMATION,
            recipient_email=email,
            recipient_name=name,
            subject=subject,
            status=EmailStatus.DEV_SKIPPED,
            reference_code=sale_code,
            sale_id=sale_id,
            client_id=client_id,
            triggered_by=triggered_by,
        )
        return True

    resend.api_key = settings.RESEND_API_KEY

    try:
        resend.Emails.send({
            "from": settings.EMAIL_FROM,
            "to": [email],
            "subject": subject,
            "html": html_content
        })
        logger.info(f"Sale confirmation email sent to {email} for sale #{sale_code}")
        _queue_email_log(
            email_type=EmailType.SALE_CONFIRMATION,
            recipient_email=email,
            recipient_name=name,
            subject=subject,
            status=EmailStatus.SUCCESS,
            reference_code=sale_code,
            sale_id=sale_id,
            client_id=client_id,
            triggered_by=triggered_by,
        )
        return True
    except Exception as e:
        logger.error(f"Error sending sale confirmation email: {e}")
        _queue_email_log(
            email_type=EmailType.SALE_CONFIRMATION,
            recipient_email=email,
            recipient_name=name,
            subject=subject,
            status=EmailStatus.FAILED,
            error_message=str(e),
            reference_code=sale_code,
            sale_id=sale_id,
            client_id=client_id,
            triggered_by=triggered_by,
        )
        return False


def send_activation_email(
    email: str,
    token: str,
    name: str,
    client_id: UUID | None = None,
) -> bool:
    """
    Send account activation email to REGULAR client with token link.
    Token expires in 7 days.
    """
    subject = "Tu cuenta en Uniformes Consuelo Rios esta lista!"

    if not settings.RESEND_API_KEY:
        logger.debug(f"[DEV] Activation link for {name} ({email}): {settings.FRONTEND_URL}/activar-cuenta/{token}")
        _queue_email_log(
            email_type=EmailType.ACTIVATION,
            recipient_email=email,
            recipient_name=name,
            subject=subject,
            status=EmailStatus.DEV_SKIPPED,
            client_id=client_id,
        )
        return True

    try:
        resend.api_key = settings.RESEND_API_KEY

        activation_link = f"{settings.FRONTEND_URL}/activar-cuenta/{token}"

        params = {
            "from": settings.EMAIL_FROM,
            "to": [email],
            "subject": subject,
            "html": f"""
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                </head>
                <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5;">
                    <div style="max-width: 600px; margin: 40px auto; background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                        <!-- Header -->
                        <div style="background: linear-gradient(135deg, #1A1A1A 0%, #2D2D2D 100%); padding: 40px 20px; text-align: center;">
                            <h1 style="color: #C9A227; margin: 0; font-size: 28px;">Uniformes Consuelo Rios</h1>
                        </div>

                        <!-- Content -->
                        <div style="padding: 40px 30px; background-color: #f9fafb;">
                            <h2 style="color: #1f2937; margin: 0 0 20px 0;">¡Hola {name}!</h2>

                            <p style="color: #4b5563; line-height: 1.6; margin: 0 0 20px 0;">
                                Hemos creado una cuenta para ti en nuestro portal web. Ahora puedes consultar el estado de tus pedidos en línea cuando quieras.
                            </p>

                            <p style="color: #4b5563; line-height: 1.6; margin: 0 0 30px 0;">
                                Para activar tu cuenta y elegir una contraseña, haz clic en el botón:
                            </p>

                            <div style="text-align: center; margin: 30px 0;">
                                <a href="{activation_link}"
                                   style="display: inline-block; background-color: #C9A227; color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
                                    Activar Mi Cuenta
                                </a>
                            </div>

                            <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 30px 0 0 0;">
                                Este enlace expira en 7 días. Si no solicitaste esta cuenta, puedes ignorar este mensaje.
                            </p>
                        </div>

                        <!-- Footer -->
                        <div style="background-color: #1f2937; padding: 20px; text-align: center;">
                            <p style="color: #9ca3af; margin: 0; font-size: 12px;">
                                © 2026 Uniformes Consuelo Rios. Todos los derechos reservados.
                            </p>
                        </div>
                    </div>
                </body>
                </html>
            """
        }

        resend.Emails.send(params)
        logger.info(f"Activation email sent to {email}")
        _queue_email_log(
            email_type=EmailType.ACTIVATION,
            recipient_email=email,
            recipient_name=name,
            subject=subject,
            status=EmailStatus.SUCCESS,
            client_id=client_id,
        )
        return True

    except Exception as e:
        logger.error(f"Error sending activation email to {email}: {e}")
        _queue_email_log(
            email_type=EmailType.ACTIVATION,
            recipient_email=email,
            recipient_name=name,
            subject=subject,
            status=EmailStatus.FAILED,
            error_message=str(e),
            client_id=client_id,
        )
        return False


def send_order_ready_email(
    email: str,
    name: str,
    order_code: str,
    school_name: str = "",
    order_id: UUID | None = None,
    client_id: UUID | None = None,
    triggered_by: UUID | None = None,
) -> bool:
    """
    Send email to client when their order is ready for pickup.

    Args:
        email: Client email address
        name: Client name
        order_code: Order code (e.g., ENC-2026-0001)
        school_name: School name for context (optional)
        order_id: Order UUID for logging
        client_id: Client UUID for logging
        triggered_by: User UUID who triggered the email
    """
    subject = f"Tu pedido {order_code} esta listo! - Uniformes Consuelo Rios"

    if not settings.RESEND_API_KEY:
        logger.debug(f"[DEV] Order ready email for {email} - Order #{order_code}")
        _queue_email_log(
            email_type=EmailType.ORDER_READY,
            recipient_email=email,
            recipient_name=name,
            subject=subject,
            status=EmailStatus.DEV_SKIPPED,
            reference_code=order_code,
            order_id=order_id,
            client_id=client_id,
            triggered_by=triggered_by,
        )
        return True

    resend.api_key = settings.RESEND_API_KEY

    try:
        school_text = f" del colegio {school_name}" if school_name else ""
        portal_url = settings.FRONTEND_URL

        resend.Emails.send({
            "from": settings.EMAIL_FROM,
            "to": [email],
            "subject": subject,
            "html": f"""
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                </head>
                <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5;">
                    <div style="max-width: 600px; margin: 40px auto; background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                        <!-- Header -->
                        <div style="background: linear-gradient(135deg, #1A1A1A 0%, #2D2D2D 100%); padding: 40px 20px; text-align: center;">
                            <h1 style="color: #C9A227; margin: 0; font-size: 28px;">Uniformes Consuelo Rios</h1>
                        </div>

                        <!-- Content -->
                        <div style="padding: 40px 30px; background-color: #f9fafb;">
                            <div style="text-align: center; margin-bottom: 30px;">
                                <span style="font-size: 60px;">🎉</span>
                            </div>

                            <h2 style="color: #1f2937; margin: 0 0 20px 0; text-align: center;">
                                ¡Hola {name}!
                            </h2>

                            <div style="background-color: #d1fae5; border: 2px solid #10b981; border-radius: 12px; padding: 25px; margin: 25px 0; text-align: center;">
                                <p style="color: #065f46; font-size: 18px; font-weight: bold; margin: 0 0 10px 0;">
                                    ¡Tu pedido está listo para recoger!
                                </p>
                                <p style="color: #047857; font-size: 24px; font-weight: bold; margin: 0; letter-spacing: 2px;">
                                    {order_code}
                                </p>
                                {f'<p style="color: #065f46; font-size: 14px; margin: 10px 0 0 0;">{school_text}</p>' if school_text else ''}
                            </div>

                            <p style="color: #4b5563; line-height: 1.6; margin: 0 0 20px 0; text-align: center;">
                                Tu encargo de uniformes{school_text} ya está terminado y listo para que lo recojas en nuestra tienda.
                            </p>

                            <div style="background-color: #fef3c7; border-radius: 8px; padding: 20px; margin: 25px 0;">
                                <p style="color: #92400e; font-weight: bold; margin: 0 0 10px 0;">
                                    📋 Recuerda traer:
                                </p>
                                <ul style="color: #78350f; margin: 0; padding-left: 20px;">
                                    <li>Tu número de pedido: <strong>{order_code}</strong></li>
                                    <li>Documento de identidad</li>
                                    <li>Saldo pendiente (si aplica)</li>
                                </ul>
                            </div>
                        </div>

                        <!-- Contact Info -->
                        <div style="padding: 30px; background-color: #1f2937; color: white;">
                            <h3 style="color: #C9A227; margin: 0 0 20px 0; font-size: 18px; text-align: center;">
                                📍 ¿Dónde recogemos?
                            </h3>

                            <table style="width: 100%; border-collapse: collapse;">
                                <tr>
                                    <td style="padding: 8px 0; vertical-align: top; width: 30px;">
                                        <span style="font-size: 18px;">🏠</span>
                                    </td>
                                    <td style="padding: 8px 0; color: #e5e7eb;">
                                        <strong>Dirección:</strong><br>
                                        Calle 56 D #26 BE 04<br>
                                        Villas de San José, Boston - Barrio Sucre<br>
                                        Medellín, Colombia
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding: 8px 0; vertical-align: top;">
                                        <span style="font-size: 18px;">🕐</span>
                                    </td>
                                    <td style="padding: 8px 0; color: #e5e7eb;">
                                        <strong>Horario:</strong><br>
                                        Lunes a Viernes: 8:00 AM - 6:00 PM<br>
                                        Sábado: 9:00 AM - 2:00 PM
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding: 8px 0; vertical-align: top;">
                                        <span style="font-size: 18px;">📞</span>
                                    </td>
                                    <td style="padding: 8px 0; color: #e5e7eb;">
                                        <strong>WhatsApp:</strong><br>
                                        <a href="https://wa.me/573001234567" style="color: #C9A227; text-decoration: none;">+57 300 123 4567</a>
                                    </td>
                                </tr>
                            </table>

                            <div style="text-align: center; margin-top: 20px;">
                                <a href="{portal_url}/mi-cuenta"
                                   style="display: inline-block; background-color: #C9A227; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                                    Ver Mi Pedido en el Portal
                                </a>
                            </div>
                        </div>

                        <!-- Footer -->
                        <div style="padding: 20px; text-align: center; background-color: #111827;">
                            <p style="color: #9ca3af; margin: 0; font-size: 12px;">
                                © 2026 Uniformes Consuelo Rios. Todos los derechos reservados.
                            </p>
                        </div>
                    </div>
                </body>
                </html>
            """
        })
        logger.info(f"Order ready email sent to {email} for order #{order_code}")
        _queue_email_log(
            email_type=EmailType.ORDER_READY,
            recipient_email=email,
            recipient_name=name,
            subject=subject,
            status=EmailStatus.SUCCESS,
            reference_code=order_code,
            order_id=order_id,
            client_id=client_id,
            triggered_by=triggered_by,
        )
        return True
    except Exception as e:
        logger.error(f"Error sending order ready email: {e}")
        _queue_email_log(
            email_type=EmailType.ORDER_READY,
            recipient_email=email,
            recipient_name=name,
            subject=subject,
            status=EmailStatus.FAILED,
            error_message=str(e),
            reference_code=order_code,
            order_id=order_id,
            client_id=client_id,
            triggered_by=triggered_by,
        )
        return False


def send_welcome_with_activation_email(
    email: str,
    token: str,
    name: str,
    transaction_type: str = "encargo",
    client_id: UUID | None = None,
) -> bool:
    """
    Send welcome email on first transaction with activation link and business info.

    This is sent when a client has their first order or sale, not on registration.
    Includes:
    - Personalized welcome
    - Account activation link
    - Instructions for portal access
    - Business contact information

    Args:
        email: Client email address
        token: Activation token for creating password
        name: Client name
        transaction_type: "encargo" or "venta" for personalized message
        client_id: Client UUID for logging
    """
    subject = "Bienvenido a Uniformes Consuelo Rios! - Tu cuenta esta lista"

    if not settings.RESEND_API_KEY:
        logger.debug(f"[DEV] Welcome email for {name} ({email}): {settings.FRONTEND_URL}/activar-cuenta/{token}")
        _queue_email_log(
            email_type=EmailType.WELCOME_ACTIVATION,
            recipient_email=email,
            recipient_name=name,
            subject=subject,
            status=EmailStatus.DEV_SKIPPED,
            client_id=client_id,
        )
        return True

    try:
        resend.api_key = settings.RESEND_API_KEY

        activation_link = f"{settings.FRONTEND_URL}/activar-cuenta/{token}"
        portal_url = settings.FRONTEND_URL

        params = {
            "from": settings.EMAIL_FROM,
            "to": [email],
            "subject": subject,
            "html": f"""
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                </head>
                <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5;">
                    <div style="max-width: 600px; margin: 40px auto; background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                        <!-- Header -->
                        <div style="background: linear-gradient(135deg, #1A1A1A 0%, #2D2D2D 100%); padding: 40px 20px; text-align: center;">
                            <h1 style="color: #C9A227; margin: 0; font-size: 28px;">Uniformes Consuelo Rios</h1>
                            <p style="color: #9ca3af; margin: 10px 0 0 0; font-size: 14px;">Calidad y tradición en uniformes escolares</p>
                        </div>

                        <!-- Welcome Content -->
                        <div style="padding: 40px 30px; background-color: #f9fafb;">
                            <h2 style="color: #1f2937; margin: 0 0 20px 0;">¡Bienvenido {name}!</h2>

                            <p style="color: #4b5563; line-height: 1.6; margin: 0 0 20px 0;">
                                Gracias por confiar en nosotros para tu {transaction_type}. Hemos creado una cuenta para ti en nuestro portal web para que puedas:
                            </p>

                            <ul style="color: #4b5563; line-height: 1.8; margin: 0 0 25px 0; padding-left: 20px;">
                                <li>📦 <strong>Consultar el estado de tus pedidos</strong> en tiempo real</li>
                                <li>📋 <strong>Ver el historial</strong> de todas tus compras</li>
                                <li>🛒 <strong>Realizar nuevos pedidos</strong> desde la comodidad de tu hogar</li>
                                <li>📱 <strong>Acceder cuando quieras</strong> desde cualquier dispositivo</li>
                            </ul>

                            <!-- Activation Button -->
                            <div style="background-color: #fff; border: 2px solid #e5e7eb; border-radius: 12px; padding: 25px; margin: 25px 0; text-align: center;">
                                <p style="color: #1f2937; font-weight: bold; margin: 0 0 15px 0; font-size: 16px;">
                                    Activa tu cuenta ahora
                                </p>
                                <a href="{activation_link}"
                                   style="display: inline-block; background-color: #C9A227; color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
                                    Crear Mi Contraseña
                                </a>
                                <p style="color: #6b7280; font-size: 12px; margin: 15px 0 0 0;">
                                    Este enlace expira en 7 días
                                </p>
                            </div>

                            <!-- How to use section -->
                            <div style="background-color: #f3f4f6; border-radius: 8px; padding: 20px; margin: 25px 0;">
                                <h3 style="color: #1f2937; margin: 0 0 15px 0; font-size: 16px;">📖 ¿Cómo consultar tus pedidos?</h3>
                                <ol style="color: #4b5563; line-height: 1.8; margin: 0; padding-left: 20px;">
                                    <li>Haz clic en "Crear Mi Contraseña" arriba</li>
                                    <li>Elige una contraseña segura</li>
                                    <li>Ingresa a <a href="{portal_url}" style="color: #C9A227;">{portal_url}</a></li>
                                    <li>Usa tu email y contraseña para acceder</li>
                                </ol>
                            </div>
                        </div>

                        <!-- Contact Info -->
                        <div style="padding: 30px; background-color: #1f2937; color: white;">
                            <h3 style="color: #C9A227; margin: 0 0 20px 0; font-size: 18px; text-align: center;">
                                📍 Visítanos o Contáctanos
                            </h3>

                            <table style="width: 100%; border-collapse: collapse;">
                                <tr>
                                    <td style="padding: 8px 0; vertical-align: top; width: 30px;">
                                        <span style="font-size: 18px;">📞</span>
                                    </td>
                                    <td style="padding: 8px 0; color: #e5e7eb;">
                                        <strong>Teléfono / WhatsApp:</strong><br>
                                        <a href="https://wa.me/573001234567" style="color: #C9A227; text-decoration: none;">+57 300 123 4567</a>
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding: 8px 0; vertical-align: top;">
                                        <span style="font-size: 18px;">📧</span>
                                    </td>
                                    <td style="padding: 8px 0; color: #e5e7eb;">
                                        <strong>Email:</strong><br>
                                        <a href="mailto:contact@example.com" style="color: #C9A227; text-decoration: none;">contact@example.com</a>
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding: 8px 0; vertical-align: top;">
                                        <span style="font-size: 18px;">🏠</span>
                                    </td>
                                    <td style="padding: 8px 0; color: #e5e7eb;">
                                        <strong>Dirección:</strong><br>
                                        Calle 56 D #26 BE 04<br>
                                        Villas de San José, Boston - Barrio Sucre<br>
                                        Medellín, Colombia
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding: 8px 0; vertical-align: top;">
                                        <span style="font-size: 18px;">🕐</span>
                                    </td>
                                    <td style="padding: 8px 0; color: #e5e7eb;">
                                        <strong>Horario:</strong><br>
                                        Lunes a Viernes: 8:00 AM - 6:00 PM<br>
                                        Sábado: 9:00 AM - 2:00 PM
                                    </td>
                                </tr>
                            </table>
                        </div>

                        <!-- Footer -->
                        <div style="padding: 20px; text-align: center; background-color: #111827;">
                            <p style="color: #6b7280; margin: 0 0 10px 0; font-size: 12px;">
                                Si no realizaste esta compra, puedes ignorar este mensaje.
                            </p>
                            <p style="color: #9ca3af; margin: 0; font-size: 12px;">
                                © 2026 Uniformes Consuelo Rios. Todos los derechos reservados.
                            </p>
                        </div>
                    </div>
                </body>
                </html>
            """
        }

        resend.Emails.send(params)
        logger.info(f"Welcome email with activation sent to {email}")
        _queue_email_log(
            email_type=EmailType.WELCOME_ACTIVATION,
            recipient_email=email,
            recipient_name=name,
            subject=subject,
            status=EmailStatus.SUCCESS,
            client_id=client_id,
        )
        return True

    except Exception as e:
        logger.error(f"Error sending welcome email to {email}: {e}")
        _queue_email_log(
            email_type=EmailType.WELCOME_ACTIVATION,
            recipient_email=email,
            recipient_name=name,
            subject=subject,
            status=EmailStatus.FAILED,
            error_message=str(e),
            client_id=client_id,
        )
        return False


def send_email_change_verification(email: str, token: str, name: str = "Usuario") -> bool:
    """
    Send email verification link for email change.

    Args:
        email: The NEW email address to verify
        token: Verification token
        name: User's name for personalization
    """
    subject = "Verifica tu nuevo correo - Uniformes"

    if not settings.RESEND_API_KEY:
        logger.debug(f"[DEV] Email change verification for {email}: {settings.ADMIN_PORTAL_URL}/verify-email/{token}")
        _queue_email_log(
            email_type=EmailType.EMAIL_CHANGE,
            recipient_email=email,
            recipient_name=name,
            subject=subject,
            status=EmailStatus.DEV_SKIPPED,
        )
        return True

    resend.api_key = settings.RESEND_API_KEY

    try:
        # Use admin portal URL since this is for internal users
        verification_link = f"{settings.ADMIN_PORTAL_URL}/verify-email/{token}"

        resend.Emails.send({
            "from": settings.EMAIL_FROM,
            "to": [email],
            "subject": subject,
            "html": f"""
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: linear-gradient(135deg, #1A1A1A 0%, #2D2D2D 100%); padding: 30px; text-align: center;">
                    <h1 style="color: #C9A227; margin: 0;">Uniformes Consuelo Rios</h1>
                </div>
                <div style="padding: 30px; background: #f9fafb;">
                    <h2 style="color: #1f2937; margin-top: 0;">Hola {name},</h2>
                    <p style="color: #4b5563; font-size: 16px;">
                        Recibimos una solicitud para cambiar tu correo electronico a esta direccion.
                    </p>
                    <p style="color: #4b5563; font-size: 16px;">
                        Para confirmar el cambio, haz clic en el siguiente boton:
                    </p>
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="{verification_link}"
                           style="display: inline-block; background-color: #C9A227; color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
                            Verificar Correo
                        </a>
                    </div>
                    <p style="color: #6b7280; font-size: 14px;">
                        Este enlace expira en <strong>24 horas</strong>.
                    </p>
                    <p style="color: #6b7280; font-size: 14px;">
                        Si no solicitaste este cambio, puedes ignorar este correo. Tu cuenta seguira usando el correo anterior.
                    </p>
                </div>
                <div style="padding: 20px; text-align: center; background: #f3f4f6;">
                    <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                        © 2026 Uniformes Consuelo Rios. Todos los derechos reservados.
                    </p>
                </div>
            </div>
            """
        })
        logger.info(f"Email change verification sent to {email}")
        _queue_email_log(
            email_type=EmailType.EMAIL_CHANGE,
            recipient_email=email,
            recipient_name=name,
            subject=subject,
            status=EmailStatus.SUCCESS,
        )
        return True
    except Exception as e:
        logger.error(f"Error sending email change verification: {e}")
        _queue_email_log(
            email_type=EmailType.EMAIL_CHANGE,
            recipient_email=email,
            recipient_name=name,
            subject=subject,
            status=EmailStatus.FAILED,
            error_message=str(e),
        )
        return False


def send_order_status_update_email(
    email: str,
    name: str,
    order_code: str,
    school_name: str = "",
    items_summary: list[dict] | None = None,
    order_status_label: str = "",
    trigger_message: str = "",
    order_id: UUID | None = None,
    client_id: UUID | None = None,
    triggered_by: UUID | None = None,
) -> bool:
    """
    Send email to client when an order item status changes.
    Shows a summary of all items and their current statuses.

    Args:
        email: Client email address
        name: Client name
        order_code: Order code (e.g., ENC-2026-0001)
        school_name: School name for context
        items_summary: List of dicts with {garment_name, size, quantity, status_label, status_key}
        order_status_label: Human-readable order status
        trigger_message: Description of what changed (e.g., "Tu Yomber talla M paso a En Produccion")
        order_id: Order UUID for logging
        client_id: Client UUID for logging
        triggered_by: User UUID who triggered the change
    """
    subject = f"Novedades en tu pedido {order_code} - Uniformes Consuelo Rios"

    if not settings.RESEND_API_KEY:
        logger.debug(f"[DEV] Order status update email for {email} - Order #{order_code}: {trigger_message}")
        _queue_email_log(
            email_type=EmailType.ORDER_STATUS_UPDATE,
            recipient_email=email,
            recipient_name=name,
            subject=subject,
            status=EmailStatus.DEV_SKIPPED,
            reference_code=order_code,
            order_id=order_id,
            client_id=client_id,
            triggered_by=triggered_by,
        )
        return True

    resend.api_key = settings.RESEND_API_KEY

    # Build items table rows
    status_styles = {
        "pending": {"color": "#6b7280", "bg": "#f3f4f6", "icon": "⏳", "label": "Pendiente"},
        "in_production": {"color": "#d97706", "bg": "#fef3c7", "icon": "🧵", "label": "En Produccion"},
        "ready": {"color": "#059669", "bg": "#d1fae5", "icon": "✅", "label": "Listo"},
        "delivered": {"color": "#2563eb", "bg": "#dbeafe", "icon": "📦", "label": "Entregado"},
        "cancelled": {"color": "#dc2626", "bg": "#fee2e2", "icon": "❌", "label": "Cancelado"},
    }

    items_html = ""
    if items_summary:
        for item in items_summary:
            style = status_styles.get(item.get("status_key", ""), status_styles["pending"])
            size_text = f" - Talla {item['size']}" if item.get("size") else ""
            items_html += f"""
                <tr>
                    <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb;">
                        <strong style="color: #1f2937;">{item.get('garment_name', 'Producto')}</strong>
                        <span style="color: #6b7280; font-size: 13px;">{size_text}</span>
                        <br><span style="color: #9ca3af; font-size: 12px;">Cant: {item.get('quantity', 1)}</span>
                    </td>
                    <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; text-align: center;">
                        <span style="display: inline-block; background-color: {style['bg']}; color: {style['color']}; padding: 4px 12px; border-radius: 20px; font-size: 13px; font-weight: 600;">
                            {style['icon']} {style['label']}
                        </span>
                    </td>
                </tr>
            """

    # Calculate progress
    total_items = len(items_summary) if items_summary else 0
    ready_or_delivered = sum(
        1 for item in (items_summary or [])
        if item.get("status_key") in ("ready", "delivered")
    )
    progress_pct = int((ready_or_delivered / total_items) * 100) if total_items > 0 else 0

    school_text = f" del colegio {school_name}" if school_name else ""
    portal_url = settings.FRONTEND_URL

    try:
        resend.Emails.send({
            "from": settings.EMAIL_FROM,
            "to": [email],
            "subject": subject,
            "html": f"""
                <!DOCTYPE html>
                <html>
                <head><meta charset="UTF-8"></head>
                <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5;">
                    <div style="max-width: 600px; margin: 40px auto; background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                        <!-- Header -->
                        <div style="background: linear-gradient(135deg, #1A1A1A 0%, #2D2D2D 100%); padding: 40px 20px; text-align: center;">
                            <h1 style="color: #C9A227; margin: 0; font-size: 28px;">Uniformes Consuelo Rios</h1>
                        </div>

                        <!-- Content -->
                        <div style="padding: 40px 30px; background-color: #f9fafb;">
                            <h2 style="color: #1f2937; margin: 0 0 10px 0; text-align: center;">
                                Hola {name}
                            </h2>
                            <p style="color: #6b7280; text-align: center; margin: 0 0 25px 0;">
                                Pedido <strong>{order_code}</strong>{school_text}
                            </p>

                            <!-- Trigger message -->
                            <div style="background-color: #eff6ff; border-left: 4px solid #3b82f6; border-radius: 0 8px 8px 0; padding: 16px 20px; margin: 0 0 25px 0;">
                                <p style="color: #1e40af; margin: 0; font-size: 15px;">
                                    {trigger_message}
                                </p>
                            </div>

                            <!-- Progress bar -->
                            <div style="margin: 0 0 25px 0;">
                                <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
                                    <span style="color: #6b7280; font-size: 13px;">Progreso del pedido</span>
                                    <span style="color: #1f2937; font-size: 13px; font-weight: 600;">{ready_or_delivered}/{total_items} items listos</span>
                                </div>
                                <div style="background-color: #e5e7eb; border-radius: 10px; height: 12px; overflow: hidden;">
                                    <div style="background: linear-gradient(90deg, #10b981, #059669); height: 100%; width: {progress_pct}%; border-radius: 10px; transition: width 0.3s;"></div>
                                </div>
                            </div>

                            <!-- Items table -->
                            <table style="width: 100%; border-collapse: collapse; background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                                <thead>
                                    <tr style="background-color: #f9fafb;">
                                        <th style="padding: 12px 16px; text-align: left; color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Producto</th>
                                        <th style="padding: 12px 16px; text-align: center; color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Estado</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {items_html}
                                </tbody>
                            </table>

                            <!-- Order status -->
                            <div style="text-align: center; margin-top: 25px;">
                                <span style="color: #6b7280; font-size: 13px;">Estado general del pedido:</span>
                                <br>
                                <span style="font-size: 16px; font-weight: bold; color: #1f2937;">{order_status_label}</span>
                            </div>
                        </div>

                        <!-- Footer with portal link -->
                        <div style="padding: 25px; background-color: #1f2937; text-align: center;">
                            <a href="{portal_url}/mi-cuenta"
                               style="display: inline-block; background-color: #C9A227; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                                Ver Mi Pedido en el Portal
                            </a>
                            <p style="color: #9ca3af; margin: 15px 0 0 0; font-size: 12px;">
                                WhatsApp: <a href="https://wa.me/573001234567" style="color: #C9A227; text-decoration: none;">+57 300 123 4567</a>
                            </p>
                        </div>

                        <!-- Copyright -->
                        <div style="padding: 15px; text-align: center; background-color: #111827;">
                            <p style="color: #9ca3af; margin: 0; font-size: 12px;">
                                &copy; 2026 Uniformes Consuelo Rios. Todos los derechos reservados.
                            </p>
                        </div>
                    </div>
                </body>
                </html>
            """
        })
        logger.info(f"Order status update email sent to {email} for order #{order_code}")
        _queue_email_log(
            email_type=EmailType.ORDER_STATUS_UPDATE,
            recipient_email=email,
            recipient_name=name,
            subject=subject,
            status=EmailStatus.SUCCESS,
            reference_code=order_code,
            order_id=order_id,
            client_id=client_id,
            triggered_by=triggered_by,
        )
        return True
    except Exception as e:
        logger.error(f"Error sending order status update email: {e}")
        _queue_email_log(
            email_type=EmailType.ORDER_STATUS_UPDATE,
            recipient_email=email,
            recipient_name=name,
            subject=subject,
            status=EmailStatus.FAILED,
            error_message=str(e),
            reference_code=order_code,
            order_id=order_id,
            client_id=client_id,
            triggered_by=triggered_by,
        )
        return False


def send_drawer_access_code(
    admin_email: str,
    code: str,
    requester_name: str,
    triggered_by: UUID | None = None,
) -> bool:
    """
    Send cash drawer access code to administrator.

    Args:
        admin_email: Superuser email to receive the code
        code: 6-digit access code
        requester_name: Name of user requesting access
        triggered_by: User UUID who requested drawer access
    """
    subject = f"Codigo de acceso al cajon - Solicitado por {requester_name}"

    if not settings.RESEND_API_KEY:
        logger.debug(f"[DEV] Drawer access code for {admin_email}: {code} (requested by {requester_name})")
        _queue_email_log(
            email_type=EmailType.DRAWER_ACCESS,
            recipient_email=admin_email,
            recipient_name=requester_name,
            subject=subject,
            status=EmailStatus.DEV_SKIPPED,
            triggered_by=triggered_by,
        )
        return True

    resend.api_key = settings.RESEND_API_KEY

    try:
        resend.Emails.send({
            "from": settings.EMAIL_FROM,
            "to": [admin_email],
            "subject": subject,
            "html": f"""
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: linear-gradient(135deg, #1A1A1A 0%, #2D2D2D 100%); padding: 30px; text-align: center;">
                    <h1 style="color: #C9A227; margin: 0;">Uniformes Consuelo Rios</h1>
                </div>
                <div style="padding: 30px; background: #f9fafb;">
                    <h2 style="color: #1f2937; margin-top: 0;">Solicitud de apertura de cajon</h2>
                    <p style="color: #4b5563; font-size: 16px;">
                        <strong>{requester_name}</strong> ha solicitado abrir el cajon de dinero.
                    </p>
                    <p style="color: #4b5563; font-size: 16px;">
                        Si autorizas esta accion, comparte el siguiente codigo:
                    </p>
                    <div style="background: white; border: 2px solid #e5e7eb; border-radius: 12px; padding: 20px; text-align: center; margin: 20px 0;">
                        <span style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #C9A227;">
                            {code}
                        </span>
                    </div>
                    <p style="color: #dc2626; font-size: 14px; font-weight: bold;">
                        ⚠️ Este codigo expira en 5 minutos y solo puede usarse una vez.
                    </p>
                    <p style="color: #6b7280; font-size: 14px;">
                        Si no reconoces esta solicitud, no compartas el codigo.
                    </p>
                </div>
                <div style="padding: 20px; text-align: center; background: #f3f4f6;">
                    <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                        © 2026 Uniformes Consuelo Rios. Todos los derechos reservados.
                    </p>
                </div>
            </div>
            """
        })
        logger.info(f"Drawer access code sent to {admin_email}")
        _queue_email_log(
            email_type=EmailType.DRAWER_ACCESS,
            recipient_email=admin_email,
            recipient_name=requester_name,
            subject=subject,
            status=EmailStatus.SUCCESS,
            triggered_by=triggered_by,
        )
        return True
    except Exception as e:
        logger.error(f"Error sending drawer access code: {e}")
        _queue_email_log(
            email_type=EmailType.DRAWER_ACCESS,
            recipient_email=admin_email,
            recipient_name=requester_name,
            subject=subject,
            status=EmailStatus.FAILED,
            error_message=str(e),
            triggered_by=triggered_by,
        )
        return False
