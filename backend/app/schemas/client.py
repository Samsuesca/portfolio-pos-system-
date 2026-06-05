"""
Client Schemas

Clients are GLOBAL - not tied to a single school.
- REGULAR clients: Created by staff, no authentication
- WEB clients: Self-registered via web portal, requires authentication
"""
from datetime import datetime
from uuid import UUID
from pydantic import ConfigDict, Field, EmailStr, field_validator
from app.schemas.base import BaseSchema, IDModelSchema, TimestampSchema
from app.models.client import ClientType, NotificationPreference, IdentificationType
from app.schemas.validators import validate_colombian_phone


def normalize_identification(v: str | None) -> str | None:
    """Strip whitespace from an identification number; empty -> None."""
    if v is None:
        return None
    cleaned = v.strip()
    return cleaned or None


def format_name(name: str | None) -> str | None:
    """
    Format a name to Title Case.
    Handles multiple spaces and preserves None values.
    Example: "JUAN GARCIA" -> "Juan Garcia"
             "maria del carmen" -> "Maria Del Carmen"
    """
    if not name or not isinstance(name, str):
        return name
    # Strip, normalize spaces, and apply title case
    return ' '.join(name.split()).title()


# =============================================================================
# Client Student Schemas
# =============================================================================

class ClientStudentBase(BaseSchema):
    """Base client student schema"""
    student_name: str = Field(..., min_length=2, max_length=255, example="Valentina Rodríguez García")
    student_grade: str | None = Field(None, max_length=50, example="5to")
    student_section: str | None = Field(None, max_length=50, example="A")
    notes: str | None = Field(None, example="Estudiante nueva, ingreso segundo semestre")

    @field_validator('student_name', mode='before')
    @classmethod
    def format_student_name(cls, v: str | None) -> str | None:
        return format_name(v)


class ClientStudentCreate(ClientStudentBase):
    """Schema for creating a student under a client"""
    school_id: UUID = Field(..., example="550e8400-e29b-41d4-a716-446655440000")


class ClientStudentUpdate(BaseSchema):
    """Schema for updating a client student"""
    student_name: str | None = Field(None, min_length=2, max_length=255, example="Valentina Rodríguez García")
    student_grade: str | None = Field(None, max_length=50, example="6to")
    student_section: str | None = Field(None, max_length=50, example="B")
    notes: str | None = Field(None, example="Cambio de sección por solicitud del acudiente")
    is_active: bool | None = None

    @field_validator('student_name', mode='before')
    @classmethod
    def format_student_name(cls, v: str | None) -> str | None:
        return format_name(v)


class ClientStudentResponse(ClientStudentBase, IDModelSchema, TimestampSchema):
    """Client student for API responses"""
    client_id: UUID
    school_id: UUID
    is_active: bool

    # Include school name for display
    school_name: str | None = None

    model_config = ConfigDict(
        from_attributes=True,
        json_schema_extra={
            "example": {
                "id": "550e8400-e29b-41d4-a716-446655440000",
                "student_name": "Valentina García López",
                "student_grade": "5to",
                "student_section": "A",
                "notes": None,
                "client_id": "660e8400-e29b-41d4-a716-446655440001",
                "school_id": "770e8400-e29b-41d4-a716-446655440002",
                "is_active": True,
                "school_name": "Colegio San José",
                "created_at": "2026-04-12T10:30:00",
                "updated_at": "2026-04-12T10:30:00",
            }
        },
    )


# =============================================================================
# Client Schemas
# =============================================================================

class ClientBase(BaseSchema):
    """Base client schema"""
    name: str = Field(..., min_length=3, max_length=255, example="María García López")
    phone: str | None = Field(None, max_length=20, example="3015678901")
    email: EmailStr | None = Field(None, example="maria.garcia@email.com")
    address: str | None = Field(None, example="Cra 45 #32-10, Envigado")
    notes: str | None = Field(None, example="Cliente frecuente, prefiere pago en efectivo")

    # DIAN identification for electronic invoicing (optional)
    identification_type: IdentificationType | None = Field(None, example="CC")
    identification_number: str | None = Field(None, max_length=30, example="1037612345")

    # Legacy student information (for backwards compatibility)
    student_name: str | None = Field(None, max_length=255, example="Valentina García")
    student_grade: str | None = Field(None, max_length=50, example="5to")

    @field_validator('name', 'student_name', mode='before')
    @classmethod
    def format_names(cls, v: str | None) -> str | None:
        return format_name(v)

    @field_validator('phone', mode='before')
    @classmethod
    def validate_phone(cls, v: str | None) -> str | None:
        return validate_colombian_phone(v)

    @field_validator('identification_number', mode='before')
    @classmethod
    def clean_identification(cls, v: str | None) -> str | None:
        return normalize_identification(v)


class ClientCreate(ClientBase):
    """Schema for creating a regular client (by staff)"""
    # code will be auto-generated (CLI-0001)
    # school_id is optional - only used for backwards compatibility
    school_id: UUID | None = Field(None, example="550e8400-e29b-41d4-a716-446655440000")

    # Optionally create students at the same time
    students: list[ClientStudentCreate] | None = None


class ClientWebRegister(BaseSchema):
    """Schema for web client self-registration"""
    name: str = Field(..., min_length=3, max_length=255, example="Ana Martínez Pérez")
    email: EmailStr = Field(..., example="ana.martinez@email.com")
    password: str = Field(..., min_length=8, max_length=100, example="MiClave2026!")
    phone: str | None = Field(None, max_length=20, example="3209876543")

    # At least one student is required for web registration
    students: list[ClientStudentCreate] = Field(..., min_length=1)

    @field_validator('name', mode='before')
    @classmethod
    def format_client_name(cls, v: str | None) -> str | None:
        return format_name(v)

    @field_validator('phone', mode='before')
    @classmethod
    def validate_phone(cls, v: str | None) -> str | None:
        return validate_colombian_phone(v)


class ClientWebLogin(BaseSchema):
    """Schema for web client login"""
    email: EmailStr = Field(..., example="ana.martinez@email.com")
    password: str = Field(..., example="MiClave2026!")


class ClientWebTokenResponse(BaseSchema):
    """Response for web client login"""
    access_token: str
    token_type: str = "bearer"
    client: "ClientResponse"

    model_config = ConfigDict(
        from_attributes=True,
        json_schema_extra={
            "example": {
                "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
                "token_type": "bearer",
                "client": {
                    "id": "550e8400-e29b-41d4-a716-446655440000",
                    "name": "María García López",
                    "phone": "3015678901",
                    "email": "maria.garcia@correo.com",
                    "code": "CLI-0042",
                    "client_type": "web",
                    "is_active": True,
                },
            }
        },
    )


class ClientUpdate(BaseSchema):
    """Schema for updating client"""
    name: str | None = Field(None, min_length=3, max_length=255, example="María García López")
    phone: str | None = Field(None, max_length=20, example="3015678901")
    email: EmailStr | None = Field(None, example="maria.garcia@email.com")
    address: str | None = Field(None, example="Cra 45 #32-10, Envigado")
    notes: str | None = Field(None, example="Actualizar dirección de entrega")
    identification_type: IdentificationType | None = Field(None, example="CC")
    identification_number: str | None = Field(None, max_length=30, example="1037612345")
    student_name: str | None = Field(None, max_length=255, example="Valentina García")
    student_grade: str | None = Field(None, max_length=50, example="6to")
    is_active: bool | None = None

    # Notification preferences
    notification_preference: NotificationPreference | None = Field(None, example="email")
    whatsapp_opted_in: bool | None = None

    @field_validator('name', 'student_name', mode='before')
    @classmethod
    def format_names(cls, v: str | None) -> str | None:
        return format_name(v)

    @field_validator('phone', mode='before')
    @classmethod
    def validate_phone(cls, v: str | None) -> str | None:
        return validate_colombian_phone(v)

    @field_validator('identification_number', mode='before')
    @classmethod
    def clean_identification(cls, v: str | None) -> str | None:
        return normalize_identification(v)


class ClientInDB(ClientBase, IDModelSchema, TimestampSchema):
    """Client as stored in database"""
    code: str
    is_active: bool
    client_type: ClientType

    # Optional school_id for backwards compatibility
    school_id: UUID | None = None

    # Web auth fields (only for web clients)
    is_verified: bool = False
    last_login: datetime | None = None

    # Google OAuth
    google_id: str | None = None
    auth_provider: str | None = None

    # Notification preferences
    notification_preference: NotificationPreference = NotificationPreference.AUTO
    whatsapp_opted_in: bool = False


class ClientResponse(ClientInDB):
    """Client for API responses"""
    # Include students list
    students: list[ClientStudentResponse] = []

    model_config = ConfigDict(
        from_attributes=True,
        json_schema_extra={
            "example": {
                "id": "550e8400-e29b-41d4-a716-446655440000",
                "name": "María García López",
                "phone": "3015678901",
                "email": "maria.garcia@correo.com",
                "address": "Calle 72 #10-25, Bogotá",
                "notes": None,
                "student_name": "Valentina García",
                "student_grade": "5to",
                "code": "CLI-0042",
                "is_active": True,
                "client_type": "regular",
                "school_id": None,
                "is_verified": False,
                "last_login": None,
                "google_id": None,
                "auth_provider": None,
                "notification_preference": "auto",
                "whatsapp_opted_in": False,
                "students": [],
                "created_at": "2026-04-12T10:30:00",
                "updated_at": "2026-04-12T10:30:00",
            }
        },
    )


class ClientListResponse(BaseSchema):
    """Simplified client response for listings"""
    id: UUID
    code: str
    name: str
    phone: str | None
    email: str | None
    student_name: str | None
    student_grade: str | None
    is_active: bool
    client_type: ClientType

    # Number of students (across all schools)
    student_count: int = 0

    # Portal activation status
    is_verified: bool = False
    welcome_email_sent: bool = False
    has_password: bool = False

    # Notification preferences
    notification_preference: NotificationPreference = NotificationPreference.AUTO
    whatsapp_opted_in: bool = False

    model_config = ConfigDict(
        from_attributes=True,
        json_schema_extra={
            "example": {
                "id": "550e8400-e29b-41d4-a716-446655440000",
                "code": "CLI-0042",
                "name": "María García López",
                "phone": "3015678901",
                "email": "maria.garcia@correo.com",
                "student_name": "Valentina García",
                "student_grade": "5to",
                "is_active": True,
                "client_type": "regular",
                "student_count": 2,
                "is_verified": False,
                "welcome_email_sent": False,
                "has_password": False,
                "notification_preference": "auto",
                "whatsapp_opted_in": False,
            }
        },
    )


class ClientSummary(BaseSchema):
    """Client with transaction summary"""
    id: UUID
    code: str
    name: str
    phone: str | None
    email: str | None
    student_name: str | None
    client_type: ClientType
    total_purchases: int = 0
    total_spent: float = 0
    pending_orders: int = 0
    last_purchase_date: str | None = None

    # Schools where client has students
    schools: list[str] = []

    model_config = ConfigDict(
        from_attributes=True,
        json_schema_extra={
            "example": {
                "id": "550e8400-e29b-41d4-a716-446655440000",
                "code": "CLI-0042",
                "name": "María García López",
                "phone": "3015678901",
                "email": "maria.garcia@correo.com",
                "student_name": "Valentina García",
                "client_type": "regular",
                "total_purchases": 8,
                "total_spent": 360000.00,
                "pending_orders": 1,
                "last_purchase_date": "2026-04-10",
                "schools": ["Colegio San José", "Instituto Pedagógico Nacional"],
            }
        },
    )


# =============================================================================
# Password Reset Schemas (for web clients)
# =============================================================================

class ClientPasswordResetRequest(BaseSchema):
    """Request password reset"""
    email: EmailStr = Field(..., example="ana.martinez@email.com")


class ClientPasswordReset(BaseSchema):
    """Reset password with token"""
    token: str = Field(..., example="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...")
    new_password: str = Field(..., min_length=8, max_length=100, example="NuevaClave2026!")


class ClientPasswordChange(BaseSchema):
    """Change password (authenticated)"""
    current_password: str = Field(..., example="ClaveAnterior2026!")
    new_password: str = Field(..., min_length=8, max_length=100, example="NuevaClave2026!")


# =============================================================================
# Phone Verification Schemas (deprecated - use email instead)
# =============================================================================

class PhoneVerificationSend(BaseSchema):
    """Request to send verification code"""
    phone: str = Field(..., min_length=10, max_length=15)


class PhoneVerificationConfirm(BaseSchema):
    """Confirm phone verification code"""
    phone: str = Field(..., min_length=10, max_length=15)
    code: str = Field(..., min_length=6, max_length=6)


# =============================================================================
# Email Verification Schemas
# =============================================================================

class EmailVerificationSend(BaseSchema):
    """Request to send email verification code"""
    email: EmailStr
    name: str | None = Field(None, max_length=255)


class EmailVerificationConfirm(BaseSchema):
    """Confirm email verification code"""
    email: EmailStr
    code: str = Field(..., min_length=6, max_length=6)


# Update forward references
ClientWebTokenResponse.model_rebuild()
