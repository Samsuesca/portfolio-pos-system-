"""
Contact (PQRS) Endpoints

API routes for managing contact messages from the web portal.
Implements Colombian PQRS standard (Peticiones, Quejas, Reclamos, Sugerencias).

Two types of endpoints:
1. Public: /contacts/submit - Anyone can submit contact messages
2. Private: Admin-only endpoints for managing and responding to messages
"""
from fastapi import APIRouter, HTTPException, status, Query, Depends
from sqlalchemy import select, func, or_
from sqlalchemy.orm import selectinload
from uuid import UUID
from typing import Optional
from datetime import datetime

from app.utils.timezone import get_colombia_now_naive
from app.api.dependencies import DatabaseSession, CurrentUser, UserSchoolIds
from app.models.contact import Contact, ContactType, ContactStatus
from app.schemas.contact import (
    ContactCreate,
    ContactUpdate,
    ContactResponse,
    ContactListResponse
)

router = APIRouter(prefix="/contacts", tags=["Contacts"])


# ==========================================
# Endpoints PÚBLICOS (para web portal)
# ==========================================

@router.post(
    "/submit",
    response_model=ContactResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Submit contact message (PUBLIC)"
)
async def submit_contact(
    contact_data: ContactCreate,
    db: DatabaseSession
):
    """
    Public endpoint para enviar mensajes de contacto desde el portal web.
    NO requiere autenticación.

    Args:
        contact_data: Datos del mensaje de contacto
        db: Database session

    Returns:
        ContactResponse: El mensaje de contacto creado

    Example:
        ```
        POST /api/v1/contacts/submit
        {
            "name": "Juan Pérez",
            "email": "juan@example.com",
            "phone": "3001234567",
            "contact_type": "inquiry",
            "subject": "Consulta sobre uniformes",
            "message": "¿Tienen uniformes en talla 10?",
            "school_id": null,
            "client_id": null
        }
        ```
    """
    # Crear nuevo contacto
    contact = Contact(
        name=contact_data.name,
        email=contact_data.email,
        phone=contact_data.phone,
        contact_type=contact_data.contact_type.value if isinstance(contact_data.contact_type, ContactType) else contact_data.contact_type,
        subject=contact_data.subject,
        message=contact_data.message,
        school_id=contact_data.school_id,
        client_id=contact_data.client_id,
        status=ContactStatus.PENDING.value,
        is_read=False
    )

    db.add(contact)
    await db.commit()
    await db.refresh(contact)

    return ContactResponse.model_validate(contact)


@router.get(
    "/by-email",
    response_model=list[ContactResponse],
    summary="Get contacts by email (PUBLIC)"
)
async def get_contacts_by_email(
    db: DatabaseSession,
    email: str = Query(..., description="Email address to search for")
):
    """
    Public endpoint para que los usuarios consulten sus propios mensajes de contacto.
    NO requiere autenticación - cualquiera con el email puede ver sus PQRS.

    Args:
        email: Email address to search for
        db: Database session

    Returns:
        list[ContactResponse]: List of contact messages for this email

    Example:
        ```
        GET /api/v1/contacts/by-email?email=juan@example.com
        ```
    """
    query = (
        select(Contact)
        .options(
            selectinload(Contact.client),
            selectinload(Contact.school)
        )
        .where(Contact.email == email)
        .order_by(Contact.created_at.desc())
    )

    result = await db.execute(query)
    contacts = result.unique().scalars().all()

    return [ContactResponse.model_validate(c) for c in contacts]


# ==========================================
# Endpoints PRIVADOS (admin desktop app)
# ==========================================

@router.get(
    "",
    response_model=ContactListResponse,
    summary="List all contacts (ADMIN)"
)
async def list_contacts(
    db: DatabaseSession,
    current_user: CurrentUser,
    user_school_ids: UserSchoolIds,
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    school_id: Optional[UUID] = Query(None, description="Filter by school"),
    status_filter: Optional[ContactStatus] = Query(None, description="Filter by status"),
    contact_type_filter: Optional[ContactType] = Query(None, description="Filter by contact type"),
    unread_only: bool = Query(False, description="Only show unread messages"),
    search: Optional[str] = Query(None, description="Search in name, email, subject, message")
):
    """
    Listar mensajes de contacto con paginación y filtros.

    - Superusers ven todos los mensajes
    - Admins solo ven mensajes de sus colegios asignados

    Args:
        db: Database session
        current_user: Current authenticated user
        user_school_ids: List of school IDs user has access to
        page: Page number (default: 1)
        page_size: Items per page (default: 20, max: 100)
        school_id: Filter by specific school
        status_filter: Filter by contact status
        contact_type_filter: Filter by contact type
        unread_only: Only show unread messages
        search: Search text in name, email, subject, message

    Returns:
        ContactListResponse: Paginated list of contacts with metadata
    """
    if not user_school_ids:
        # User has no school access, return empty list
        return ContactListResponse(
            items=[],
            total=0,
            page=page,
            page_size=page_size,
            total_pages=0
        )

    # Construir query base
    query = select(Contact).options(
        selectinload(Contact.client),
        selectinload(Contact.school)
    )

    # Filtro de permisos
    if not current_user.is_superuser:
        query = query.where(
            or_(
                Contact.school_id.in_(user_school_ids),
                Contact.school_id.is_(None)  # Mensajes sin colegio
            )
        )

    # Filtros opcionales
    if school_id:
        if school_id not in user_school_ids and not current_user.is_superuser:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No access to this school"
            )
        query = query.where(Contact.school_id == school_id)

    if status_filter:
        query = query.where(Contact.status == status_filter)

    if contact_type_filter:
        query = query.where(Contact.contact_type == contact_type_filter)

    if unread_only:
        query = query.where(Contact.is_read == False)

    if search:
        search_term = f"%{search}%"
        query = query.where(
            or_(
                Contact.name.ilike(search_term),
                Contact.email.ilike(search_term),
                Contact.subject.ilike(search_term),
                Contact.message.ilike(search_term)
            )
        )

    # Contar total
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Paginación
    query = query.order_by(Contact.created_at.desc())
    query = query.offset((page - 1) * page_size).limit(page_size)

    result = await db.execute(query)
    contacts = result.unique().scalars().all()

    return ContactListResponse(
        items=[ContactResponse.model_validate(c) for c in contacts],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=(total + page_size - 1) // page_size
    )


@router.get(
    "/{contact_id}",
    response_model=ContactResponse,
    summary="Get contact by ID (ADMIN)"
)
async def get_contact(
    contact_id: UUID,
    db: DatabaseSession,
    current_user: CurrentUser,
    user_school_ids: UserSchoolIds
):
    """
    Obtener detalles de un mensaje de contacto por ID.

    Automáticamente marca el mensaje como leído cuando se accede.

    Args:
        contact_id: ID del mensaje de contacto
        db: Database session
        current_user: Current authenticated user
        user_school_ids: List of school IDs user has access to

    Returns:
        ContactResponse: Contact message details

    Raises:
        HTTPException: 404 if contact not found or no access
    """
    query = (
        select(Contact)
        .options(
            selectinload(Contact.client),
            selectinload(Contact.school)
        )
        .where(Contact.id == contact_id)
    )

    # Validar permisos
    if not current_user.is_superuser:
        query = query.where(
            or_(
                Contact.school_id.in_(user_school_ids),
                Contact.school_id.is_(None)
            )
        )

    result = await db.execute(query)
    contact = result.scalar_one_or_none()

    if not contact:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Contact message not found"
        )

    # Marcar como leído automáticamente
    if not contact.is_read:
        contact.is_read = True
        await db.commit()

    return ContactResponse.model_validate(contact)


@router.put(
    "/{contact_id}",
    response_model=ContactResponse,
    summary="Update contact (ADMIN)"
)
async def update_contact(
    contact_id: UUID,
    update_data: ContactUpdate,
    db: DatabaseSession,
    current_user: CurrentUser,
    user_school_ids: UserSchoolIds
):
    """
    Actualizar mensaje de contacto (estado, respuesta, marcar leído).

    Solo admin/superuser puede responder y cambiar estado.

    Args:
        contact_id: ID del mensaje de contacto
        update_data: Datos a actualizar
        db: Database session
        current_user: Current authenticated user
        user_school_ids: List of school IDs user has access to

    Returns:
        ContactResponse: Updated contact message

    Raises:
        HTTPException: 404 if contact not found or no access
    """
    query = select(Contact).where(Contact.id == contact_id)

    # Validar permisos
    if not current_user.is_superuser:
        query = query.where(
            or_(
                Contact.school_id.in_(user_school_ids),
                Contact.school_id.is_(None)
            )
        )

    result = await db.execute(query)
    contact = result.scalar_one_or_none()

    if not contact:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Contact message not found"
        )

    # Actualizar campos
    if update_data.status is not None:
        contact.status = update_data.status

    if update_data.admin_response is not None:
        contact.admin_response = update_data.admin_response
        contact.admin_response_date = get_colombia_now_naive()
        contact.responded_by_id = current_user.id

    if update_data.is_read is not None:
        contact.is_read = update_data.is_read

    await db.commit()
    await db.refresh(contact)

    return ContactResponse.model_validate(contact)


@router.get(
    "/stats/summary",
    summary="Get contact statistics (ADMIN)"
)
async def get_contact_stats(
    db: DatabaseSession,
    current_user: CurrentUser,
    user_school_ids: UserSchoolIds
):
    """
    Obtener estadísticas de mensajes de contacto.

    Returns:
        dict: Statistics including:
            - by_status: Count of messages by status
            - unread_count: Total unread messages
            - by_type: Count of messages by type
    """
    base_query = select(Contact)

    if not current_user.is_superuser:
        base_query = base_query.where(
            or_(
                Contact.school_id.in_(user_school_ids),
                Contact.school_id.is_(None)
            )
        )

    # Count by status
    status_counts = {}
    for status_value in ContactStatus:
        count_query = select(func.count()).select_from(
            base_query.where(Contact.status == status_value).subquery()
        )
        result = await db.execute(count_query)
        status_counts[status_value.value] = result.scalar() or 0

    # Count unread
    unread_query = select(func.count()).select_from(
        base_query.where(Contact.is_read == False).subquery()
    )
    unread_result = await db.execute(unread_query)
    unread_count = unread_result.scalar() or 0

    # Count by type
    type_counts = {}
    for type_value in ContactType:
        count_query = select(func.count()).select_from(
            base_query.where(Contact.contact_type == type_value).subquery()
        )
        result = await db.execute(count_query)
        type_counts[type_value.value] = result.scalar() or 0

    return {
        "by_status": status_counts,
        "unread_count": unread_count,
        "by_type": type_counts
    }
