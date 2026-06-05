"""
User and Authentication Schemas
"""
from datetime import datetime
from uuid import UUID
from pydantic import EmailStr, Field, field_validator
from app.schemas.base import BaseSchema, IDModelSchema, TimestampSchema
from app.models.user import UserRole


# ============================================
# User Schemas
# ============================================

class UserBase(BaseSchema):
    """Base user schema with common fields"""
    username: str = Field(..., min_length=3, max_length=50, example="carlos_vendedor")
    email: EmailStr = Field(..., example="carlos.rodriguez@email.com")
    full_name: str | None = Field(None, max_length=255, example="Carlos Rodríguez Martínez")

    @field_validator('username')
    @classmethod
    def validate_username(cls, v: str) -> str:
        """Validate username format"""
        if not v.replace('_', '').replace('-', '').isalnum():
            raise ValueError('Username must contain only letters, numbers, underscores, and hyphens')
        return v.lower()


class UserCreate(UserBase):
    """Schema for creating a new user.

    Note: is_superuser is NOT exposed in this schema. Superuser status
    is managed exclusively via PUT /users/{user_id}/superuser.
    """
    password: str = Field(..., min_length=8, max_length=100, example="Clave2026Segura!")

    @field_validator('password')
    @classmethod
    def validate_password(cls, v: str) -> str:
        """Validate password strength"""
        if not any(char.isdigit() for char in v):
            raise ValueError('Password must contain at least one digit')
        if not any(char.isupper() for char in v):
            raise ValueError('Password must contain at least one uppercase letter')
        if not any(char.islower() for char in v):
            raise ValueError('Password must contain at least one lowercase letter')
        return v


class UserUpdate(BaseSchema):
    """Schema for updating user information"""
    username: str | None = Field(None, min_length=3, max_length=50, example="carlos_vendedor")
    email: EmailStr | None = Field(None, example="carlos.nuevo@email.com")
    full_name: str | None = Field(None, max_length=255, example="Carlos Rodríguez Martínez")
    password: str | None = Field(None, min_length=8, max_length=100, example="NuevaClave2026!")
    is_active: bool | None = None


class UserInDB(UserBase, IDModelSchema, TimestampSchema):
    """User schema as stored in database (without password).

    Overrides the parent ``email`` field as a plain ``str`` (not
    ``EmailStr``) so legacy / test rows with addresses that fail strict
    EmailStr validation (e.g. TLDs not in the email-validator catalog
    like ``.local``) can still be serialized in API responses. Input
    schemas (``UserCreate``, ``UserUpdate``) keep ``EmailStr`` so new
    rows are guaranteed valid.

    QA on 2026-05-24 caught a 400 on /auth/login for a user with email
    ``qa_test@temp.local``: response_model validation rejected the
    output even though credentials were correct. Read-side schemas
    should never reject data the DB already accepted.
    """
    email: str  # was EmailStr — relaxed on output, kept strict on input
    is_active: bool
    is_superuser: bool
    last_login: datetime | None = None
    telegram_chat_id: str | None = None
    permissions_version: int = 0
    google_id: str | None = None
    auth_provider: str | None = None


class UserResponse(UserInDB):
    """User schema for API responses"""
    pass


# ============================================
# UserSchoolRole Schemas
# ============================================

class UserSchoolRoleBase(BaseSchema):
    """Base schema for user-school relationship"""
    user_id: UUID
    school_id: UUID
    role: UserRole | None = None  # Can be null if using custom_role_id
    custom_role_id: UUID | None = None
    is_primary: bool = False


class UserSchoolRoleCreate(BaseSchema):
    """Schema for creating user-school role"""
    user_id: UUID = Field(..., example="550e8400-e29b-41d4-a716-446655440000")
    school_id: UUID = Field(..., example="550e8400-e29b-41d4-a716-446655440001")
    role: UserRole | None = Field(None, example="seller")
    custom_role_id: UUID | None = Field(None, example="550e8400-e29b-41d4-a716-446655440002")
    is_primary: bool = False


class UserSchoolRoleUpdate(BaseSchema):
    """Schema for updating user-school role"""
    role: UserRole | None = Field(None, example="admin")
    custom_role_id: UUID | None = Field(None, example="550e8400-e29b-41d4-a716-446655440002")
    is_primary: bool | None = None


class UserSchoolRoleInDB(UserSchoolRoleBase, IDModelSchema):
    """UserSchoolRole as stored in database"""
    created_at: datetime


class UserSchoolRoleResponse(UserSchoolRoleInDB):
    """UserSchoolRole for API responses"""
    custom_role_name: str | None = None
    permissions: list[str] = []  # Effective permissions for this role
    max_discount_percent: int = 0  # Maximum discount percentage allowed
    constraints: dict[str, dict] = {}  # Micro-permission constraints: {"perm.code": {"max_amount": ..., "requires_approval": ...}}


class SchoolInfoForRole(BaseSchema):
    """Minimal school info for user's school roles"""
    id: UUID
    code: str
    name: str
    is_active: bool


class UserSchoolRoleWithSchool(UserSchoolRoleInDB):
    """UserSchoolRole with nested school information"""
    school: SchoolInfoForRole
    custom_role_name: str | None = None


# ============================================
# Authentication Schemas
# ============================================

class Token(BaseSchema):
    """JWT token response"""
    access_token: str
    token_type: str = "bearer"
    expires_in: int  # seconds


class TokenData(BaseSchema):
    """Data encoded in JWT token"""
    user_id: UUID
    username: str
    school_id: UUID | None = None  # Current active school
    role: UserRole | None = None
    # Versión del token al momento de emisión. Validada contra
    # `User.token_version` en cada request: si difieren, el token
    # quedó invalidado por un password/email change y se rechaza.
    # `None` para tokens emitidos antes de la migración usr_token_ver_001
    # (compatibilidad pre-deploy: se aceptan hasta `exp` natural).
    token_version: int | None = None


class LoginRequest(BaseSchema):
    """Login credentials"""
    username: str = Field(..., example="carlos_vendedor")
    password: str = Field(..., example="Clave2026Segura!")


class GoogleLoginRequest(BaseSchema):
    """Google OAuth ID token for login"""
    id_token: str = Field(..., description="Google ID token from Google Sign-In", example="eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...")


class UserWithRoles(UserResponse):
    """User response including school roles"""
    school_roles: list["UserSchoolRoleResponse"] = []


class LoginResponse(BaseSchema):
    """Login response with token and user info including roles"""
    token: Token
    user: UserWithRoles


class PasswordChange(BaseSchema):
    """Schema for changing password"""
    old_password: str = Field(..., example="ClaveAnterior2026!")
    new_password: str = Field(..., min_length=8, max_length=100, example="NuevaClave2026!")

    @field_validator('new_password')
    @classmethod
    def validate_password(cls, v: str) -> str:
        """Validate password strength"""
        if not any(char.isdigit() for char in v):
            raise ValueError('Password must contain at least one digit')
        if not any(char.isupper() for char in v):
            raise ValueError('Password must contain at least one uppercase letter')
        if not any(char.islower() for char in v):
            raise ValueError('Password must contain at least one lowercase letter')
        return v


class PasswordReset(BaseSchema):
    """Schema for password reset"""
    email: EmailStr = Field(..., example="carlos.rodriguez@email.com")


class PasswordResetConfirm(BaseSchema):
    """Schema for confirming password reset with token"""
    token: str = Field(..., example="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...")
    new_password: str = Field(..., min_length=8, max_length=100, example="NuevaClave2026!")
