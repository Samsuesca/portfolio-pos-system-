"""
Client Endpoints

Clients are GLOBAL - not tied to a specific school.
This module provides endpoints for:
- Staff client management (regular clients)
- Web portal client registration and authentication (web clients)
- Client student management
"""
from uuid import UUID
from fastapi import APIRouter, HTTPException, status, Query, Depends
from sqlalchemy import select

from app.api.dependencies import DatabaseSession, CurrentUser, get_current_user
from app.models.user import UserRole, User
from app.models.client import ClientType, Client
from app.schemas.client import (
    ClientCreate,
    ClientUpdate,
    ClientResponse,
    ClientListResponse,
    ClientSummary,
    ClientStudentCreate,
    ClientStudentUpdate,
    ClientStudentResponse,
    ClientWebRegister,
    ClientWebLogin,
    ClientWebTokenResponse,
    ClientPasswordResetRequest,
    ClientPasswordReset,
    ClientPasswordChange,
    PhoneVerificationSend,
    PhoneVerificationConfirm,
    EmailVerificationSend,
    EmailVerificationConfirm,
)
from app.services.client import ClientService
from app.services.email import send_verification_email, send_welcome_email
from app.core.redis_client import (
    set_verification_code,
    get_verification_code,
    delete_verification_code,
    set_verified_email,
    is_email_verified,
    delete_verified_email
)

import random
from datetime import timedelta

from app.utils.timezone import get_colombia_now_naive


# =============================================================================
# Staff Client Management Router (requires authentication)
# =============================================================================
router = APIRouter(prefix="/clients", tags=["Clients"])


@router.post(
    "",
    response_model=ClientResponse,
    status_code=status.HTTP_201_CREATED
)
async def create_client(
    client_data: ClientCreate,
    db: DatabaseSession,
    current_user: CurrentUser
):
    """
    Create a new regular client (by staff).

    Requires authenticated user (any role can create clients).
    """
    client_service = ClientService(db)

    try:
        client = await client_service.create_client(
            client_data,
            created_by_user_id=current_user.id
        )
        await db.commit()
        return ClientResponse.model_validate(client)

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get(
    "",
    response_model=list[ClientListResponse]
)
async def list_clients(
    db: DatabaseSession,
    current_user: CurrentUser,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    search: str | None = Query(None, min_length=1),
    client_type: ClientType | None = None,
    is_active: bool = True
):
    """
    List all clients (global).

    Supports filtering by search term, client type, and active status.
    """
    client_service = ClientService(db)
    clients = await client_service.get_all_clients(
        skip=skip,
        limit=limit,
        search=search,
        client_type=client_type,
        is_active=is_active
    )

    return [
        ClientListResponse(
            id=c.id,
            code=c.code,
            name=c.name,
            phone=c.phone,
            email=c.email,
            student_name=c.student_name,
            student_grade=c.student_grade,
            is_active=c.is_active,
            client_type=c.client_type,
            student_count=len(c.students) if c.students else 0,
            is_verified=c.is_verified,
            welcome_email_sent=c.welcome_email_sent,
            has_password=c.password_hash is not None
        )
        for c in clients
    ]


@router.get(
    "/search",
    response_model=list[ClientListResponse]
)
async def search_clients(
    q: str = Query(..., min_length=1),
    db: DatabaseSession = None,
    current_user: User = Depends(get_current_user),
    limit: int = Query(20, ge=1, le=50)
):
    """Search clients by code, name, email, phone, or student name."""
    client_service = ClientService(db)
    clients = await client_service.search_clients(q, limit=limit)

    return [
        ClientListResponse(
            id=c.id,
            code=c.code,
            name=c.name,
            phone=c.phone,
            email=c.email,
            student_name=c.student_name,
            student_grade=c.student_grade,
            is_active=c.is_active,
            client_type=c.client_type,
            student_count=len(c.students) if c.students else 0,
            is_verified=c.is_verified,
            welcome_email_sent=c.welcome_email_sent,
            has_password=c.password_hash is not None
        )
        for c in clients
    ]


@router.get(
    "/top",
    response_model=list[ClientSummary]
)
async def get_top_clients(
    db: DatabaseSession,
    current_user: CurrentUser,
    limit: int = Query(10, ge=1, le=50)
):
    """Get top clients by total spent (global)."""
    client_service = ClientService(db)
    return await client_service.get_top_clients(limit=limit)


@router.get(
    "/{client_id}",
    response_model=ClientResponse
)
async def get_client(
    client_id: UUID,
    db: DatabaseSession,
    current_user: CurrentUser
):
    """Get a specific client by ID with students."""
    client_service = ClientService(db)
    client = await client_service.get_with_students(client_id)

    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cliente no encontrado"
        )

    # Build response with students including school names
    students = []
    for student in client.students:
        students.append(ClientStudentResponse(
            id=student.id,
            client_id=student.client_id,
            school_id=student.school_id,
            student_name=student.student_name,
            student_grade=student.student_grade,
            student_section=student.student_section,
            notes=student.notes,
            is_active=student.is_active,
            created_at=student.created_at,
            updated_at=student.updated_at,
            school_name=student.school.name if student.school else None
        ))

    return ClientResponse(
        id=client.id,
        code=client.code,
        name=client.name,
        phone=client.phone,
        email=client.email,
        address=client.address,
        notes=client.notes,
        student_name=client.student_name,
        student_grade=client.student_grade,
        is_active=client.is_active,
        client_type=client.client_type,
        school_id=client.school_id,
        is_verified=client.is_verified,
        last_login=client.last_login,
        created_at=client.created_at,
        updated_at=client.updated_at,
        students=students
    )


@router.get(
    "/{client_id}/summary",
    response_model=ClientSummary
)
async def get_client_summary(
    client_id: UUID,
    db: DatabaseSession,
    current_user: CurrentUser
):
    """Get client with purchase statistics across all schools."""
    client_service = ClientService(db)
    summary = await client_service.get_client_summary(client_id)

    if not summary:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cliente no encontrado"
        )

    return summary


@router.patch(
    "/{client_id}",
    response_model=ClientResponse
)
async def update_client(
    client_id: UUID,
    client_data: ClientUpdate,
    db: DatabaseSession,
    current_user: CurrentUser
):
    """Update a client."""
    client_service = ClientService(db)

    client = await client_service.get(client_id)
    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cliente no encontrado"
        )

    try:
        updated_client = await client_service.update_client(client_id, client_data)
        await db.commit()

        # Reload with students
        updated_client = await client_service.get_with_students(client_id)
        return ClientResponse.model_validate(updated_client)

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.delete(
    "/{client_id}",
    status_code=status.HTTP_204_NO_CONTENT
)
async def delete_client(
    client_id: UUID,
    db: DatabaseSession,
    current_user: CurrentUser
):
    """
    Delete a client (soft delete).

    Only admins can delete clients.
    """
    # Check if user is admin
    if not current_user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo administradores pueden eliminar clientes"
        )

    client_service = ClientService(db)

    client = await client_service.get(client_id)
    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cliente no encontrado"
        )

    # Soft delete
    await client_service.soft_delete(client_id)
    await db.commit()


@router.post(
    "/{client_id}/resend-activation",
    status_code=status.HTTP_200_OK
)
async def resend_activation_email(
    client_id: UUID,
    db: DatabaseSession,
    current_user: CurrentUser
):
    """
    Resend activation email to a client.

    Generates a new activation token and sends the welcome email.
    Only works for clients with email who haven't activated their account yet.
    """
    from app.services.email import send_welcome_with_activation_email
    import secrets
    from datetime import datetime, timedelta

    client_service = ClientService(db)

    client = await client_service.get(client_id)
    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cliente no encontrado"
        )

    if not client.email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El cliente no tiene email registrado"
        )

    if client.is_verified and client.password_hash:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El cliente ya activó su cuenta"
        )

    # Generate new activation token
    activation_token = secrets.token_hex(32)
    client.verification_token = activation_token
    client.verification_token_expires = get_colombia_now_naive() + timedelta(days=7)

    # Send activation email
    sent = send_welcome_with_activation_email(
        email=client.email,
        token=activation_token,
        name=client.name,
        transaction_type="recordatorio"
    )

    if not sent:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al enviar el correo. Intenta de nuevo."
        )

    # Update welcome_email_sent flag
    client.welcome_email_sent = True
    client.welcome_email_sent_at = get_colombia_now_naive()

    await db.commit()

    return {
        "message": f"Correo de activación enviado a {client.email}",
        "email": client.email
    }


# =============================================================================
# Client Student Management
# =============================================================================

@router.post(
    "/{client_id}/students",
    response_model=ClientStudentResponse,
    status_code=status.HTTP_201_CREATED
)
async def add_student(
    client_id: UUID,
    student_data: ClientStudentCreate,
    db: DatabaseSession,
    current_user: CurrentUser
):
    """Add a student to a client."""
    client_service = ClientService(db)

    client = await client_service.get(client_id)
    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cliente no encontrado"
        )

    try:
        student = await client_service.add_student(client_id, student_data)
        await db.commit()
        await db.refresh(student, ['school'])

        return ClientStudentResponse(
            id=student.id,
            client_id=student.client_id,
            school_id=student.school_id,
            student_name=student.student_name,
            student_grade=student.student_grade,
            student_section=student.student_section,
            notes=student.notes,
            is_active=student.is_active,
            created_at=student.created_at,
            updated_at=student.updated_at,
            school_name=student.school.name if student.school else None
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.patch(
    "/{client_id}/students/{student_id}",
    response_model=ClientStudentResponse
)
async def update_student(
    client_id: UUID,
    student_id: UUID,
    student_data: ClientStudentUpdate,
    db: DatabaseSession,
    current_user: CurrentUser
):
    """Update a client student."""
    client_service = ClientService(db)

    student = await client_service.update_student(student_id, student_data)
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Estudiante no encontrado"
        )

    await db.commit()
    await db.refresh(student, ['school'])

    return ClientStudentResponse(
        id=student.id,
        client_id=student.client_id,
        school_id=student.school_id,
        student_name=student.student_name,
        student_grade=student.student_grade,
        student_section=student.student_section,
        notes=student.notes,
        is_active=student.is_active,
        created_at=student.created_at,
        updated_at=student.updated_at,
        school_name=student.school.name if student.school else None
    )


@router.delete(
    "/{client_id}/students/{student_id}",
    status_code=status.HTTP_204_NO_CONTENT
)
async def remove_student(
    client_id: UUID,
    student_id: UUID,
    db: DatabaseSession,
    current_user: CurrentUser
):
    """Remove a student from a client."""
    client_service = ClientService(db)

    removed = await client_service.remove_student(student_id)
    if not removed:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Estudiante no encontrado"
        )

    await db.commit()


# =============================================================================
# Web Portal Client Registration and Authentication (Public endpoints)
# =============================================================================
web_router = APIRouter(prefix="/portal/clients", tags=["Client Portal"])


@web_router.post(
    "/register",
    response_model=ClientResponse,
    status_code=status.HTTP_201_CREATED
)
async def register_web_client(
    registration_data: ClientWebRegister,
    db: DatabaseSession
):
    """
    Register a new web portal client (public endpoint).

    If email already exists, returns the existing client.
    This allows repeat customers to place orders without issues.
    """
    client_service = ClientService(db)

    # Check if email was verified via OTP
    email = registration_data.email.lower().strip()
    email_verified = await is_email_verified(email)

    try:
        client = await client_service.register_web_client(registration_data)

        # Update is_verified if email was confirmed via OTP
        if email_verified:
            client.is_verified = True
            # Remove from verified emails list
            await delete_verified_email(email)

        await db.commit()

        # TODO: Send welcome email

        return ClientResponse.model_validate(client)

    except ValueError as e:
        error_msg = str(e)
        # If email already registered, return the existing client
        if "already registered" in error_msg.lower() or "ya registrado" in error_msg.lower():
            existing_client = await client_service.get_by_email(registration_data.email)
            if existing_client:
                # Reload with students
                client_with_students = await client_service.get_with_students(existing_client.id)
                return ClientResponse.model_validate(client_with_students)

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@web_router.post(
    "/verify-token/{token}"
)
async def verify_email_token(
    token: str,
    db: DatabaseSession
):
    """Verify client email with token (legacy endpoint)."""
    client_service = ClientService(db)
    client = await client_service.verify_email(token)

    if not client:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Token inválido o expirado"
        )

    await db.commit()
    return {"message": "Email verificado exitosamente"}


@web_router.post(
    "/login",
    response_model=ClientWebTokenResponse
)
async def login_web_client(
    credentials: ClientWebLogin,
    db: DatabaseSession
):
    """
    Authenticate a web portal client.

    Returns JWT token for subsequent requests.
    """
    client_service = ClientService(db)
    client = await client_service.authenticate_web_client(
        credentials.email,
        credentials.password
    )

    if not client:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales inválidas o cuenta no verificada"
        )

    await db.commit()

    # Generate real JWT token for client
    access_token = client_service.create_client_token(client)

    # Load client with students
    client_with_students = await client_service.get_with_students(client.id)

    return ClientWebTokenResponse(
        access_token=access_token,
        token_type="bearer",
        client=ClientResponse.model_validate(client_with_students)
    )


@web_router.post(
    "/password-reset/request"
)
async def request_password_reset(
    request_data: ClientPasswordResetRequest,
    db: DatabaseSession
):
    """Request password reset (sends email with token)."""
    client_service = ClientService(db)
    token = await client_service.request_password_reset(request_data.email)

    # Always return success to prevent email enumeration
    await db.commit()

    if token:
        # TODO: Send password reset email
        pass

    return {"message": "Si el correo existe, recibirás instrucciones para restablecer tu contraseña"}


@web_router.post(
    "/password-reset/confirm"
)
async def confirm_password_reset(
    reset_data: ClientPasswordReset,
    db: DatabaseSession
):
    """Reset password with token."""
    client_service = ClientService(db)
    success = await client_service.reset_password(reset_data.token, reset_data.new_password)

    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Token inválido o expirado"
        )

    await db.commit()
    return {"message": "Contraseña actualizada exitosamente"}


@web_router.get(
    "/me",
    response_model=ClientResponse
)
async def get_current_client(
    client_id: UUID = Query(..., description="Client ID from JWT token"),
    db: DatabaseSession = None
):
    """
    Get current authenticated client profile.

    Client ID should be extracted from JWT token by the frontend.
    """
    client_service = ClientService(db)
    client = await client_service.get_with_students(client_id)

    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cliente no encontrado"
        )

    return ClientResponse.model_validate(client)


@web_router.get(
    "/me/orders"
)
async def get_client_orders(
    client_id: UUID = Query(..., description="Client ID from JWT token"),
    db: DatabaseSession = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100)
):
    """
    Get all orders for the authenticated client.

    Returns orders sorted by creation date (most recent first).
    """
    client_service = ClientService(db)

    # Verify client exists
    client = await client_service.get(client_id)
    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cliente no encontrado"
        )

    orders = await client_service.get_client_orders(client_id, skip=skip, limit=limit)

    # Format response
    return [
        {
            "id": str(order.id),
            "code": order.code,
            "status": order.status.value,
            "source": order.source.value if order.source else "desktop_app",  # Origen del pedido
            "total": float(order.total),
            "balance": float(order.balance),
            "created_at": order.created_at.isoformat() if order.created_at else None,
            "delivery_date": order.delivery_date.isoformat() if order.delivery_date else None,
            "items_count": len(order.items) if order.items else 0,
            "payment_proof_url": order.payment_proof_url,
            "payment_proof_status": order.payment_proof_status.value if order.payment_proof_status else None,  # Estado del comprobante
            "items": [
                {
                    "id": str(item.id),
                    "quantity": item.quantity,
                    "unit_price": float(item.unit_price),
                    "subtotal": float(item.subtotal),
                    "size": item.size,
                    "color": item.color,
                }
                for item in (order.items or [])
            ]
        }
        for order in orders
    ]


# =============================================================================
# Phone Verification Endpoints
# =============================================================================

@web_router.post("/verify-phone/send")
async def send_phone_verification(
    data: PhoneVerificationSend,
    db: DatabaseSession
):
    """
    Send a verification code to the phone number.

    In production, this would send an SMS via Twilio/AWS SNS/etc.
    For now, it stores the code in Redis and returns it in the response (dev only).
    """
    # Clean phone number
    phone = data.phone.replace(" ", "").replace("-", "")

    # Generate 6-digit code
    code = "".join([str(random.randint(0, 9)) for _ in range(6)])

    # Store in Redis with 5-minute expiry
    await set_verification_code(f"phone:{phone}", code, ttl=300)

    # In production: Send SMS here via Twilio/AWS SNS
    # For now, we'll include the code in response for testing (REMOVE IN PRODUCTION)

    return {
        "message": "Código de verificación enviado",
        "expires_in": 300,  # 5 minutes
        # DEV ONLY - Remove this in production
        "dev_code": code
    }


@web_router.post("/verify-phone/confirm")
async def confirm_phone_verification(
    data: PhoneVerificationConfirm,
    db: DatabaseSession
):
    """
    Verify the phone number with the code sent via SMS.
    """
    phone = data.phone.replace(" ", "").replace("-", "")
    code = data.code

    # Get code from Redis
    stored_code = await get_verification_code(f"phone:{phone}")

    # Check if code exists
    if not stored_code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No se encontró código de verificación o ha expirado. Solicita uno nuevo."
        )

    # Verify code
    if code != stored_code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Código incorrecto"
        )

    # Code is valid - remove from Redis
    await delete_verification_code(f"phone:{phone}")

    return {
        "message": "Teléfono verificado exitosamente",
        "phone": phone,
        "verified": True
    }


# =============================================================================
# Email Verification Endpoints
# =============================================================================

@web_router.post("/verify-email/send")
async def send_email_verification(
    data: EmailVerificationSend,
    db: DatabaseSession
):
    """
    Send a verification code to the email address.

    Uses Resend to send emails (3,000/month free).
    In dev mode without API key, code is logged to console.
    """
    email = data.email.lower().strip()
    name = data.name or "Usuario"

    # Check if email is already registered
    client_service = ClientService(db)
    existing = await client_service.get_by_email(email)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Este email ya está registrado. Por favor inicia sesión."
        )

    # Generate 6-digit code
    code = "".join([str(random.randint(0, 9)) for _ in range(6)])

    # Store in Redis with 10-minute expiry
    await set_verification_code(f"email:{email}", code, ttl=600)

    # Send email
    sent = send_verification_email(email, code, name)

    if not sent:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al enviar el correo. Intenta de nuevo."
        )

    return {
        "message": "Código de verificación enviado a tu correo",
        "expires_in": 600,  # 10 minutes
    }


@web_router.post("/verify-email/confirm")
async def confirm_email_verification(
    data: EmailVerificationConfirm,
    db: DatabaseSession
):
    """
    Verify the email with the code sent.
    """
    email = data.email.lower().strip()
    code = data.code

    # Get code from Redis
    stored_code = await get_verification_code(f"email:{email}")

    # Check if code exists
    if not stored_code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No se encontró código de verificación o ha expirado. Solicita uno nuevo."
        )

    # Verify code
    if code != stored_code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Código incorrecto"
        )

    # Code is valid - remove from Redis
    await delete_verification_code(f"email:{email}")

    # Mark email as verified for 30 minutes (time to complete registration)
    await set_verified_email(email, ttl=1800)

    return {
        "message": "Email verificado exitosamente",
        "email": email,
        "verified": True
    }


@web_router.post("/activate-account")
async def activate_account(
    data: dict,  # {token: str, password: str}
    db: DatabaseSession
):
    """
    Activate a REGULAR client account using token from activation email.
    Sets password and marks as verified.
    """
    token = data.get("token")
    password = data.get("password")

    if not token or not password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Token y contraseña son requeridos"
        )

    # Validate password strength
    if len(password) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La contraseña debe tener al menos 8 caracteres"
        )

    # Find client by token
    result = await db.execute(
        select(Client).where(
            Client.verification_token == token,
            Client.verification_token_expires > get_colombia_now_naive(),
            Client.client_type == ClientType.REGULAR
        )
    )
    client = result.scalar_one_or_none()

    if not client:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Token inválido o expirado. Solicita un nuevo enlace de activación."
        )

    # Set password and verify
    from passlib.context import CryptContext
    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

    client.password_hash = pwd_context.hash(password)
    client.is_verified = True
    client.verification_token = None  # Clear token after use
    client.verification_token_expires = None

    await db.commit()
    await db.refresh(client)

    return {
        "message": "Cuenta activada exitosamente",
        "email": client.email,
        "name": client.name
    }
