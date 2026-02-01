"""
Contact Model for PQRS (Peticiones, Quejas, Reclamos, Sugerencias)

This model handles contact messages from the web portal, following
Colombian PQRS standard for customer service communication.
"""
from sqlalchemy import Column, String, Text, DateTime, Boolean, ForeignKey, Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import enum
import uuid
from datetime import datetime

from app.db.base import Base
from app.utils.timezone import get_colombia_now_naive


class ContactType(str, enum.Enum):
    """Tipos de contacto según estándar colombiano PQRS"""
    INQUIRY = "inquiry"           # Consulta
    REQUEST = "request"           # Petición
    COMPLAINT = "complaint"       # Queja
    CLAIM = "claim"               # Reclamo
    SUGGESTION = "suggestion"     # Sugerencia


class ContactStatus(str, enum.Enum):
    """Estados del mensaje de contacto"""
    PENDING = "pending"           # Pendiente de revisión
    IN_REVIEW = "in_review"       # En revisión
    RESOLVED = "resolved"         # Resuelto
    CLOSED = "closed"             # Cerrado


class Contact(Base):
    """
    Contact messages from web portal.

    Attributes:
        id: Unique identifier
        client_id: Optional reference to registered client
        school_id: Optional reference to school (for filtering)
        name: Contact's full name
        email: Contact's email address
        phone: Contact's phone number (optional)
        contact_type: Type of contact (inquiry, request, complaint, claim, suggestion)
        subject: Brief subject/title of the message
        message: Full message content
        status: Current status of the contact message
        is_read: Whether admin has read the message
        admin_response: Response from administrator (optional)
        admin_response_date: Date when admin responded
        responded_by_id: User who responded to the message
        created_at: Timestamp when message was created
        updated_at: Timestamp when message was last updated
    """
    __tablename__ = "contacts"

    # IDs
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id = Column(
        UUID(as_uuid=True),
        ForeignKey("clients.id", ondelete="SET NULL"),
        nullable=True
    )
    school_id = Column(
        UUID(as_uuid=True),
        ForeignKey("schools.id", ondelete="CASCADE"),
        nullable=True
    )

    # Información del contacto
    name = Column(String(150), nullable=False)
    email = Column(String(150), nullable=False)
    phone = Column(String(20), nullable=True)

    # Mensaje
    contact_type = Column(SQLEnum(ContactType, values_callable=lambda x: [e.value for e in x]), nullable=False)
    subject = Column(String(200), nullable=False)
    message = Column(Text, nullable=False)

    # Estado y seguimiento
    status = Column(
        SQLEnum(ContactStatus, values_callable=lambda x: [e.value for e in x]),
        nullable=False,
        default=ContactStatus.PENDING
    )
    is_read = Column(Boolean, nullable=False, default=False)

    # Respuesta administrativa
    admin_response = Column(Text, nullable=True)
    admin_response_date = Column(DateTime, nullable=True)
    responded_by_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True
    )

    # Timestamps
    created_at = Column(DateTime, nullable=False, default=get_colombia_now_naive)
    updated_at = Column(
        DateTime,
        nullable=False,
        default=get_colombia_now_naive,
        onupdate=get_colombia_now_naive
    )

    # Relaciones
    client = relationship("Client", back_populates="contacts")
    school = relationship("School", back_populates="contacts")
    responded_by = relationship("User", foreign_keys=[responded_by_id])

    def __repr__(self):
        return f"<Contact {self.id} - {self.contact_type.value} from {self.name}>"
