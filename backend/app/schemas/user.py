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
    username: str = Field(..., min_length=3, max_length=50)
    email: EmailStr
    full_name: str | None = Field(None, max_length=255)

    @field_validator('username')
    @classmethod
    def validate_username(cls, v: str) -> str:
        """Validate username format"""
        if not v.replace('_', '').replace('-', '').isalnum():
            raise ValueError('Username must contain only letters, numbers, underscores, and hyphens')
        return v.lower()


class UserCreate(UserBase):
    """Schema for creating a new user"""
    password: str = Field(..., min_length=8, max_length=100)
    is_superuser: bool = False

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
    username: str | None = Field(None, min_length=3, max_length=50)
    email: EmailStr | None = None
    full_name: str | None = Field(None, max_length=255)
    password: str | None = Field(None, min_length=8, max_length=100)
    is_active: bool | None = None


class UserInDB(UserBase, IDModelSchema, TimestampSchema):
    """User schema as stored in database (without password)"""
    is_active: bool
    is_superuser: bool
    last_login: datetime | None = None
    telegram_chat_id: str | None = None


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
    user_id: UUID
    school_id: UUID
    role: UserRole | None = None
    custom_role_id: UUID | None = None
    is_primary: bool = False


class UserSchoolRoleUpdate(BaseSchema):
    """Schema for updating user-school role"""
    role: UserRole | None = None
    custom_role_id: UUID | None = None
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


class LoginRequest(BaseSchema):
    """Login credentials"""
    username: str
    password: str


class UserWithRoles(UserResponse):
    """User response including school roles"""
    school_roles: list["UserSchoolRoleResponse"] = []


class LoginResponse(BaseSchema):
    """Login response with token and user info including roles"""
    token: Token
    user: UserWithRoles


class PasswordChange(BaseSchema):
    """Schema for changing password"""
    old_password: str
    new_password: str = Field(..., min_length=8, max_length=100)

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
    email: EmailStr


class PasswordResetConfirm(BaseSchema):
    """Schema for confirming password reset with token"""
    token: str
    new_password: str = Field(..., min_length=8, max_length=100)
