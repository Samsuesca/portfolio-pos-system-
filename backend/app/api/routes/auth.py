"""
Authentication Endpoints
"""
import secrets
from datetime import datetime, timedelta

from fastapi import APIRouter, HTTPException, status, Request, Query

from app.utils.timezone import get_colombia_now_naive
from pydantic import BaseModel, EmailStr
from sqlalchemy import select, delete

from app.api.dependencies import DatabaseSession, CurrentUser
from app.api.error_responses import responses, AUTHENTICATED
from app.schemas.base import ErrorResponse
from app.core.limiter import limiter
from app.schemas.user import (
    LoginRequest, LoginResponse, UserResponse, UserWithRoles,
    PasswordChange, UserSchoolRoleResponse, GoogleLoginRequest
)
from app.services.user import UserService
from app.services.google_auth import GoogleAuthService
from app.services.permission import PermissionService
from app.services.email import send_email_change_verification
from app.models.user import User, EmailVerificationToken


class EmailChangeRequest(BaseModel):
    new_email: EmailStr


class EmailVerifyRequest(BaseModel):
    token: str


router = APIRouter(prefix="/auth", tags=["Authentication"])


async def build_school_roles_with_permissions(
    db,
    user_id,
    user_service: UserService
) -> list[UserSchoolRoleResponse]:
    """
    Build school roles response with effective permissions for each role.
    This is used by both login and /me endpoints.
    """
    from uuid import UUID

    # Get user's school roles with custom_role relationship loaded
    school_roles = await user_service.get_user_schools(user_id, include_school=False)

    permission_service = PermissionService(db)
    school_roles_response = []

    # Permission codes that have constraints to include in login response
    CONSTRAINED_PERMISSIONS = [
        "accounting.liquidate_caja_menor",
        "accounting.adjust_balance",
        "cash_drawer.open",
    ]

    for role in school_roles:
        # Calculate effective permissions for this school
        permissions = await permission_service.get_user_permissions(user_id, role.school_id)
        max_discount = await permission_service.get_max_discount_percent(user_id, role.school_id)

        # Build constraints dict for permissions that have them
        constraints = {}
        for perm_code in CONSTRAINED_PERMISSIONS:
            if perm_code in permissions:
                perm_constraints = await permission_service.get_permission_constraints(
                    user_id, role.school_id, perm_code
                )
                if perm_constraints:
                    # Convert Decimal to float for JSON serialization
                    serializable = {}
                    for k, v in perm_constraints.items():
                        from decimal import Decimal as Dec
                        serializable[k] = float(v) if isinstance(v, Dec) else v
                    constraints[perm_code] = serializable

        # Build response with permissions included
        role_response = UserSchoolRoleResponse(
            id=role.id,
            user_id=role.user_id,
            school_id=role.school_id,
            role=role.role,
            custom_role_id=role.custom_role_id,
            custom_role_name=role.custom_role.name if role.custom_role else None,
            is_primary=role.is_primary,
            created_at=role.created_at,
            permissions=list(permissions),
            max_discount_percent=max_discount,
            constraints=constraints,
        )
        school_roles_response.append(role_response)

    return school_roles_response


@router.post("/login", response_model=LoginResponse, responses={401: {"model": ErrorResponse, "description": "Credenciales incorrectas"}}, operation_id="login")
@limiter.limit("5/minute")
async def login(
    request: Request,
    login_data: LoginRequest,
    db: DatabaseSession
):
    """Autentica un usuario con credenciales locales (usuario/correo + contrasena).

    Acepta tanto el username como el email en `login_data.username`. La contrasena
    se valida contra el hash bcrypt almacenado. Tras autenticar exitosamente, emite
    un JWT y devuelve el detalle del usuario junto con sus roles por colegio,
    incluyendo permisos efectivos y constraints relevantes (descuento maximo,
    liquidacion de caja menor, ajuste de balances, apertura de caja).

    Args:
        request: Request entrante (usado por el rate limiter para identificar IP).
        login_data: Credenciales con `username` (o email) y `password` en texto plano.
        db: Sesion async de base de datos inyectada.

    Returns:
        LoginResponse: JWT (`token`) y `user` con roles, permisos y constraints.

    Raises:
        HTTPException: 401 si el usuario no existe, esta inactivo, no tiene
            contrasena local configurada (cuenta solo Google) o la contrasena
            es incorrecta. Incluye header `WWW-Authenticate: Bearer`.
        HTTPException: 429 si se supera el rate limit de 5 intentos por minuto
            por IP (manejado por slowapi).

    Side effects:
        - Actualiza `User.last_login` con la hora actual de Colombia.
        - Hace flush a la base de datos (commit lo realiza el middleware de sesion).
    """
    user_service = UserService(db)

    # Authenticate user
    user = await user_service.authenticate(
        login_data.username,
        login_data.password
    )

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario o contraseña incorrectos",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Create access token
    token = user_service.create_access_token(
        user_id=user.id,
        username=user.username,
        token_version=user.token_version,
    )

    # Get user's school roles with permissions
    school_roles_response = await build_school_roles_with_permissions(
        db, user.id, user_service
    )

    # Build user response with roles
    user_data = UserResponse.model_validate(user).model_dump()
    user_with_roles = UserWithRoles(**user_data, school_roles=school_roles_response)

    return LoginResponse(
        token=token,
        user=user_with_roles
    )


@router.post("/google-login", response_model=LoginResponse, responses={401: {"model": ErrorResponse, "description": "Credenciales incorrectas"}}, operation_id="googleLogin")
@limiter.limit("10/minute")
async def google_login(
    request: Request,
    data: GoogleLoginRequest,
    db: DatabaseSession
):
    """Autentica un usuario empleado mediante un ID token de Google OAuth.

    Verifica el ID token contra los client IDs configurados, valida la audience
    y exige `email_verified=true`. Resuelve el usuario primero por `google_id`
    y, si no existe, intenta por correo: si encuentra una cuenta de empleado
    con ese correo, vincula automaticamente el `google_id` a esa cuenta. No
    crea cuentas nuevas: el usuario debe existir previamente en el sistema.

    Args:
        request: Request entrante (usado por el rate limiter para identificar IP).
        data: Payload con `id_token` emitido por Google.
        db: Sesion async de base de datos inyectada.

    Returns:
        LoginResponse: JWT (`token`) y `user` con roles, permisos y constraints.

    Raises:
        HTTPException: 401 si el ID token de Google es invalido, expiro, tiene
            audience incorrecto o el correo no esta verificado.
        HTTPException: 403 si no existe un usuario empleado con ese correo
            (mensaje: contactar al administrador) o si la cuenta esta inactiva.
        HTTPException: 429 si se supera el rate limit de 10 intentos por minuto.

    Side effects:
        - Si el correo coincide con un usuario sin `google_id`, vincula la cuenta
          (`User.google_id` se setea y `User.auth_provider` pasa a `"both"`).
        - Actualiza `User.last_login` con la hora actual de Colombia.
        - Hace flush a la base de datos.
    """
    from app.core.config import settings

    google_service = GoogleAuthService(settings)
    claims = google_service.verify_id_token(data.id_token)

    if not claims:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token de Google invalido o expirado",
        )

    user_service = UserService(db)
    google_sub = claims["sub"]
    email = claims["email"]

    user = await user_service.get_by_google_id(google_sub)

    if not user:
        user = await user_service.get_by_email(email)
        if user:
            await user_service.link_google_account(user.id, google_sub)
            await db.refresh(user)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No se encontro una cuenta de empleado con este correo. Contacta al administrador.",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tu cuenta esta desactivada. Contacta al administrador.",
        )

    user.last_login = get_colombia_now_naive()
    await db.flush()

    token = user_service.create_access_token(
        user_id=user.id,
        username=user.username,
        token_version=user.token_version,
    )

    school_roles_response = await build_school_roles_with_permissions(
        db, user.id, user_service
    )

    user_data = UserResponse.model_validate(user).model_dump()
    user_with_roles = UserWithRoles(**user_data, school_roles=school_roles_response)

    return LoginResponse(token=token, user=user_with_roles)


@router.post("/link-google", responses=responses(400, 409), operation_id="linkGoogle")
async def link_google_account(
    data: GoogleLoginRequest,
    current_user: CurrentUser,
    db: DatabaseSession
):
    """Vincula una cuenta de Google al usuario actualmente autenticado.

    Verifica el ID token de Google y, si es valido, asocia el `sub` (google_id)
    al usuario en sesion. Bloquea la operacion si ese `google_id` ya pertenece
    a otro usuario distinto del actual.

    Args:
        data: Payload con `id_token` emitido por Google.
        current_user: Usuario autenticado (resuelto desde el JWT).
        db: Sesion async de base de datos inyectada.

    Returns:
        dict: `{"message": str, "google_email": str}` con el correo Google vinculado.

    Raises:
        HTTPException: 400 si el ID token de Google es invalido o expiro.
        HTTPException: 409 si la cuenta de Google ya esta vinculada a otro usuario.

    Side effects:
        - Setea `User.google_id` y cambia `User.auth_provider` a `"both"`.
        - Hace commit explicito de la transaccion.
    """
    from app.core.config import settings

    google_service = GoogleAuthService(settings)
    claims = google_service.verify_id_token(data.id_token)

    if not claims:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Token de Google invalido o expirado",
        )

    user_service = UserService(db)
    google_sub = claims["sub"]

    existing = await user_service.get_by_google_id(google_sub)
    if existing and existing.id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Esta cuenta de Google ya esta vinculada a otro usuario.",
        )

    await user_service.link_google_account(current_user.id, google_sub)
    await db.commit()

    return {"message": "Cuenta de Google vinculada exitosamente", "google_email": claims["email"]}


@router.post("/unlink-google", responses=responses(400), operation_id="unlinkGoogle")
async def unlink_google_account(
    current_user: CurrentUser,
    db: DatabaseSession
):
    """Desvincula la cuenta de Google del usuario autenticado.

    Solo permite la desvinculacion si el usuario tiene una contrasena local
    configurada, para evitar que pierda acceso al sistema. Tras desvincular,
    el usuario queda como autenticacion local pura.

    Args:
        current_user: Usuario autenticado (resuelto desde el JWT).
        db: Sesion async de base de datos inyectada.

    Returns:
        dict: `{"message": str}` confirmando la desvinculacion.

    Raises:
        HTTPException: 400 si el usuario no tiene una cuenta de Google vinculada.
        HTTPException: 400 si el usuario no tiene `hashed_password` configurada
            (desvincular lo dejaria sin metodo de login).

    Side effects:
        - Setea `User.google_id` a NULL y `User.auth_provider` a `"local"`.
        - Hace commit explicito de la transaccion.
    """
    if not current_user.google_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No tienes una cuenta de Google vinculada.",
        )

    if not current_user.hashed_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No puedes desvincular Google sin tener una contrasena configurada.",
        )

    user_service = UserService(db)
    await user_service.unlink_google_account(current_user.id)
    await db.commit()

    return {"message": "Cuenta de Google desvinculada exitosamente"}


@router.get("/me", response_model=UserWithRoles, responses=AUTHENTICATED, operation_id="getMe")
async def get_current_user_info(
    current_user: CurrentUser,
    db: DatabaseSession
):
    """Devuelve la informacion del usuario autenticado con sus roles efectivos.

    Recalcula en cada llamada los permisos por colegio (incluyendo herencia de
    custom roles), el descuento maximo permitido y los constraints de permisos
    sensibles (liquidacion de caja menor, ajuste de balances, apertura de caja).
    El frontend lo invoca tras login y al recargar para hidratar el estado de
    autorizacion.

    Args:
        current_user: Usuario autenticado (resuelto desde el JWT).
        db: Sesion async de base de datos inyectada.

    Returns:
        UserWithRoles: Datos del usuario y `school_roles` con permisos y constraints.

    Raises:
        HTTPException: 401 si el JWT es invalido, expiro o el usuario fue desactivado
            (manejado por la dependencia `CurrentUser`).

    Side effects:
        Ninguno (operacion de solo lectura).
    """
    user_service = UserService(db)

    # Get user's school roles with permissions
    school_roles_response = await build_school_roles_with_permissions(
        db, current_user.id, user_service
    )

    # Build response with roles
    user_data = UserResponse.model_validate(current_user).model_dump()
    return UserWithRoles(**user_data, school_roles=school_roles_response)


@router.get("/permissions-refresh", responses=AUTHENTICATED, operation_id="refreshPermissions")
async def permissions_refresh(
    version: int,
    current_user: CurrentUser,
    db: DatabaseSession
):
    """Verifica si los permisos del usuario cambiaron desde la ultima carga.

    El frontend hace polling de este endpoint cada ~60s con el
    `permissions_version` que tiene cacheado. Si coincide con el valor en BD,
    responde `current` sin recalcular permisos. Si difiere (porque un admin
    modifico roles, custom roles o permisos), responde `stale` con la nueva
    version y los `school_roles` actualizados, evitando forzar un re-login.

    Args:
        version: Version de permisos que el cliente tiene cacheada.
        current_user: Usuario autenticado (resuelto desde el JWT).
        db: Sesion async de base de datos inyectada.

    Returns:
        dict: `{"status": "current"}` si la version coincide, o
            `{"status": "stale", "permissions_version": int, "school_roles": list}`
            con los roles serializados en modo JSON cuando hay cambios.

    Raises:
        HTTPException: 401 si el JWT es invalido o expiro (manejado por la
            dependencia `CurrentUser`).

    Side effects:
        Ninguno (operacion de solo lectura).
    """
    if current_user.permissions_version == version:
        return {"status": "current"}

    user_service = UserService(db)
    school_roles_response = await build_school_roles_with_permissions(
        db, current_user.id, user_service
    )

    return {
        "status": "stale",
        "permissions_version": current_user.permissions_version,
        "school_roles": [sr.model_dump(mode="json") for sr in school_roles_response],
    }


@router.post("/change-password", responses=responses(400), operation_id="changePassword")
async def change_password(
    password_data: PasswordChange,
    current_user: CurrentUser,
    db: DatabaseSession
):
    """Cambia la contrasena del usuario autenticado e invalida JWTs vivos.

    Verifica la contrasena actual contra el hash bcrypt y, si coincide, almacena
    el nuevo hash bcrypt. Tras el cambio se incrementa ``User.token_version``,
    lo que rechaza inmediatamente cualquier JWT emitido antes (HTTP 401 en
    el siguiente request). El cliente debe iniciar sesion nuevamente.

    Args:
        password_data: Contrasena actual (`old_password`) y nueva (`new_password`).
        current_user: Usuario autenticado (resuelto desde el JWT).
        db: Sesion async de base de datos inyectada.

    Returns:
        dict: `{"message": "Password changed successfully"}`.

    Raises:
        HTTPException: 400 si la contrasena actual es incorrecta (mensaje del
            `ValueError` propagado por el servicio) o si el cambio falla
            internamente (usuario no encontrado).

    Side effects:
        - Reemplaza `User.hashed_password` con el nuevo hash bcrypt.
        - Bumpea ``User.token_version`` para invalidar JWTs vigentes.
        - Hace commit explicito de la transaccion.
    """
    from app.services.auth_invalidation import TokenInvalidator

    user_service = UserService(db)

    try:
        success = await user_service.change_password(
            current_user.id,
            password_data
        )

        if not success:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No se pudo cambiar la contraseña"
            )

        # Invalidar JWTs vivos antes del commit — un token robado deja de
        # funcionar en el proximo request post-deploy.
        await TokenInvalidator(db).bump_user(current_user.id)

        await db.commit()

        return {"message": "Password changed successfully"}

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post("/request-email-change", responses=responses(400, 409), operation_id="requestEmailChange")
async def request_email_change(
    email_data: EmailChangeRequest,
    current_user: CurrentUser,
    db: DatabaseSession
):
    """Inicia el cambio de correo enviando un enlace de verificacion al correo nuevo.

    Genera un token aleatorio (`secrets.token_urlsafe(48)`) con expiracion de
    24 horas y lo envia por correo al nuevo email. El cambio NO se aplica hasta
    que el usuario abra el enlace y se llame a `/auth/verify-email/{token}`.
    Si ya existia un token de verificacion previo para este usuario, se elimina
    antes de generar el nuevo.

    Args:
        email_data: Payload con `new_email` validado por Pydantic (EmailStr).
        current_user: Usuario autenticado (resuelto desde el JWT).
        db: Sesion async de base de datos inyectada.

    Returns:
        dict: `{"message": str, "email": str}` confirmando el envio del enlace.

    Raises:
        HTTPException: 400 si el nuevo correo es igual al actual
            (comparacion case-insensitive).
        HTTPException: 400 si el correo ya esta en uso por otro usuario.

    Side effects:
        - Elimina cualquier `EmailVerificationToken` previo del usuario.
        - Crea un nuevo `EmailVerificationToken` con expiracion 24h (Colombia tz).
        - Hace commit explicito de la transaccion.
        - Envia correo via Resend (o solo loggea en dev si `RESEND_API_KEY`
            no esta configurada). El envio del correo NO es bloqueante respecto
            al commit ni se reintenta si falla.
        - El destinatario es el correo NUEVO, no el actual.
    """
    new_email = email_data.new_email.lower()

    # Check if new email is same as current
    if new_email == current_user.email.lower():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El nuevo correo es igual al actual"
        )

    # Check if new email is already in use
    existing = await db.execute(
        select(User).where(User.email == new_email)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Este correo ya esta en uso por otro usuario"
        )

    # Delete any existing tokens for this user
    await db.execute(
        delete(EmailVerificationToken).where(
            EmailVerificationToken.user_id == current_user.id
        )
    )

    # Generate new token
    token = secrets.token_urlsafe(48)  # 64 chars base64
    expires_at = get_colombia_now_naive() + timedelta(hours=24)

    # Create verification token
    verification_token = EmailVerificationToken(
        user_id=current_user.id,
        new_email=new_email,
        token=token,
        expires_at=expires_at
    )
    db.add(verification_token)
    await db.commit()

    # Send verification email
    user_name = current_user.full_name or current_user.username
    send_email_change_verification(new_email, token, user_name)

    return {
        "message": f"Se envio un enlace de verificacion a {new_email}",
        "email": new_email
    }


@router.post("/verify-email/{token}", operation_id="verifyEmail")
async def verify_email(
    token: str,
    db: DatabaseSession
):
    """Confirma un cambio de correo aplicando el token enviado al correo nuevo.

    Endpoint publico (no requiere autenticacion: el token actua como portador).
    Valida el token, verifica que no haya expirado, comprueba que el correo
    siga disponible (otro usuario podria haberlo tomado en el intervalo) y
    actualiza el correo del usuario asociado al token.

    Args:
        token: Token de verificacion enviado por correo (path parameter).
        db: Sesion async de base de datos inyectada.

    Returns:
        dict: `{"message": str, "old_email": str, "new_email": str}` con el
            correo anterior y el nuevo aplicado.

    Raises:
        HTTPException: 404 si el token no existe (invalido o ya consumido).
        HTTPException: 400 si el token expiro (mas de 24h desde su creacion).
        HTTPException: 400 si el correo nuevo ya fue tomado por otro usuario
            despues de iniciada la solicitud.
        HTTPException: 404 si el usuario asociado al token ya no existe.

    Side effects:
        - Actualiza `User.email` al nuevo valor (consume el token incluso si
            falla por correo duplicado o usuario inexistente).
        - Elimina el `EmailVerificationToken` usado en TODOS los casos
            (exito, expiracion, duplicado, usuario inexistente).
        - En el camino de exito, bumpea ``User.token_version`` para invalidar
            JWTs vivos (cualquier sesion abierta queda forzada a re-login).
        - Hace commit explicito de la transaccion.
    """
    # Find token
    result = await db.execute(
        select(EmailVerificationToken).where(
            EmailVerificationToken.token == token
        )
    )
    verification = result.scalar_one_or_none()

    if not verification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Token invalido o expirado"
        )

    # Check expiration
    if get_colombia_now_naive() > verification.expires_at:
        # Delete expired token
        await db.delete(verification)
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El enlace de verificacion ha expirado"
        )

    # Check if new email is still available
    existing = await db.execute(
        select(User).where(User.email == verification.new_email)
    )
    if existing.scalar_one_or_none():
        await db.delete(verification)
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Este correo ya esta en uso por otro usuario"
        )

    # Update user's email
    user = await db.get(User, verification.user_id)
    if not user:
        await db.delete(verification)
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuario no encontrado"
        )

    old_email = user.email
    user.email = verification.new_email

    # Invalidar JWTs vivos: el cambio de correo es senal de evento sensible
    # (recuperacion de cuenta, suplantacion). Cualquier sesion abierta debe
    # autenticarse de nuevo.
    from app.services.auth_invalidation import TokenInvalidator
    await TokenInvalidator(db).bump_user(user.id)

    # Delete the used token
    await db.delete(verification)
    await db.commit()

    return {
        "message": "Correo actualizado exitosamente",
        "old_email": old_email,
        "new_email": user.email
    }
