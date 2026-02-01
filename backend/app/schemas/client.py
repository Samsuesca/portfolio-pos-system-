"""
Client Schemas

Clients are GLOBAL - not tied to a single school.
- REGULAR clients: Created by staff, no authentication
- WEB clients: Self-registered via web portal, requires authentication
"""
from datetime import datetime
from uuid import UUID
from pydantic import Field, EmailStr, field_validator
from app.schemas.base import BaseSchema, IDModelSchema, TimestampSchema
from app.models.client import ClientType, NotificationPreference
from app.schemas.validators import validate_colombian_phone


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
    student_name: str = Field(..., min_length=2, max_length=255)
    student_grade: str | None = Field(None, max_length=50)
    student_section: str | None = Field(None, max_length=50)
    notes: str | None = None

    @field_validator('student_name', mode='before')
    @classmethod
    def format_student_name(cls, v: str | None) -> str | None:
        return format_name(v)


class ClientStudentCreate(ClientStudentBase):
    """Schema for creating a student under a client"""
    school_id: UUID


class ClientStudentUpdate(BaseSchema):
    """Schema for updating a client student"""
    student_name: str | None = Field(None, min_length=2, max_length=255)
    student_grade: str | None = Field(None, max_length=50)
    student_section: str | None = Field(None, max_length=50)
    notes: str | None = None
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


# =============================================================================
# Client Schemas
# =============================================================================

class ClientBase(BaseSchema):
    """Base client schema"""
    name: str = Field(..., min_length=3, max_length=255)
    phone: str | None = Field(None, max_length=20)
    email: EmailStr | None = None
    address: str | None = None
    notes: str | None = None

    # Legacy student information (for backwards compatibility)
    student_name: str | None = Field(None, max_length=255)
    student_grade: str | None = Field(None, max_length=50)

    @field_validator('name', 'student_name', mode='before')
    @classmethod
    def format_names(cls, v: str | None) -> str | None:
        return format_name(v)

    @field_validator('phone', mode='before')
    @classmethod
    def validate_phone(cls, v: str | None) -> str | None:
        return validate_colombian_phone(v)


class ClientCreate(ClientBase):
    """Schema for creating a regular client (by staff)"""
    # code will be auto-generated (CLI-0001)
    # school_id is optional - only used for backwards compatibility
    school_id: UUID | None = None

    # Optionally create students at the same time
    students: list[ClientStudentCreate] | None = None


class ClientWebRegister(BaseSchema):
    """Schema for web client self-registration"""
    name: str = Field(..., min_length=3, max_length=255)
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=100)
    phone: str | None = Field(None, max_length=20)

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
    email: EmailStr
    password: str


class ClientWebTokenResponse(BaseSchema):
    """Response for web client login"""
    access_token: str
    token_type: str = "bearer"
    client: "ClientResponse"


class ClientUpdate(BaseSchema):
    """Schema for updating client"""
    name: str | None = Field(None, min_length=3, max_length=255)
    phone: str | None = Field(None, max_length=20)
    email: EmailStr | None = None
    address: str | None = None
    notes: str | None = None
    student_name: str | None = Field(None, max_length=255)
    student_grade: str | None = Field(None, max_length=50)
    is_active: bool | None = None

    # Notification preferences
    notification_preference: NotificationPreference | None = None
    whatsapp_opted_in: bool | None = None

    @field_validator('name', 'student_name', mode='before')
    @classmethod
    def format_names(cls, v: str | None) -> str | None:
        return format_name(v)

    @field_validator('phone', mode='before')
    @classmethod
    def validate_phone(cls, v: str | None) -> str | None:
        return validate_colombian_phone(v)


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

    # Notification preferences
    notification_preference: NotificationPreference = NotificationPreference.AUTO
    whatsapp_opted_in: bool = False


class ClientResponse(ClientInDB):
    """Client for API responses"""
    # Include students list
    students: list[ClientStudentResponse] = []


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


# =============================================================================
# Password Reset Schemas (for web clients)
# =============================================================================

class ClientPasswordResetRequest(BaseSchema):
    """Request password reset"""
    email: EmailStr


class ClientPasswordReset(BaseSchema):
    """Reset password with token"""
    token: str
    new_password: str = Field(..., min_length=8, max_length=100)


class ClientPasswordChange(BaseSchema):
    """Change password (authenticated)"""
    current_password: str
    new_password: str = Field(..., min_length=8, max_length=100)


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
