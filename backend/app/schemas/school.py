"""
School (Tenant) Schemas
"""
from uuid import UUID
from pydantic import Field, field_validator, HttpUrl
from app.schemas.base import BaseSchema, IDModelSchema, TimestampSchema


class SchoolBase(BaseSchema):
    """Base school schema"""
    name: str = Field(..., min_length=3, max_length=255)
    slug: str | None = Field(None, min_length=3, max_length=100, pattern=r'^[a-z0-9-]+$')
    logo_url: HttpUrl | str | None = None
    primary_color: str | None = Field(None, pattern=r'^#[0-9A-Fa-f]{6}$')
    secondary_color: str | None = Field(None, pattern=r'^#[0-9A-Fa-f]{6}$')
    address: str | None = None
    phone: str | None = Field(None, max_length=20)
    email: str | None = Field(None, max_length=255)

    @field_validator('primary_color', 'secondary_color')
    @classmethod
    def validate_color(cls, v: str | None) -> str | None:
        """Validate hex color format"""
        if v and not v.startswith('#'):
            return f'#{v}'
        return v


class SchoolSettings(BaseSchema):
    """School-specific settings"""
    currency: str = Field(default="COP", max_length=3)
    tax_rate: float = Field(default=19, ge=0, le=100)
    commission_per_garment: float = Field(default=5000, ge=0)
    allow_credit_sales: bool = True
    max_credit_days: int = Field(default=30, ge=0)


class SchoolCreate(SchoolBase):
    """Schema for creating a new school"""
    code: str = Field(..., min_length=3, max_length=20, pattern=r'^[A-Z0-9-]+$')
    settings: SchoolSettings = Field(default_factory=SchoolSettings)

    @field_validator('code')
    @classmethod
    def validate_code(cls, v: str) -> str:
        """Ensure code is uppercase"""
        return v.upper()


class SchoolUpdate(BaseSchema):
    """Schema for updating school information"""
    name: str | None = Field(None, min_length=3, max_length=255)
    logo_url: HttpUrl | str | None = None
    primary_color: str | None = Field(None, pattern=r'^#[0-9A-Fa-f]{6}$')
    secondary_color: str | None = Field(None, pattern=r'^#[0-9A-Fa-f]{6}$')
    address: str | None = None
    phone: str | None = Field(None, max_length=20)
    email: str | None = Field(None, max_length=255)
    settings: dict | None = None
    is_active: bool | None = None


class SchoolInDB(SchoolBase, IDModelSchema, TimestampSchema):
    """School as stored in database"""
    code: str
    slug: str
    settings: dict
    is_active: bool


class SchoolResponse(SchoolInDB):
    """School for API responses"""
    pass


class SchoolListResponse(BaseSchema):
    """Response for listing schools"""
    id: UUID
    code: str
    name: str
    slug: str
    logo_url: str | None
    is_active: bool
    display_order: int = 100


class SchoolReorderItem(BaseSchema):
    """Single item for reordering schools"""
    id: UUID
    display_order: int = Field(..., ge=0)


class SchoolReorderRequest(BaseSchema):
    """Request schema for reordering schools"""
    schools: list[SchoolReorderItem]


class SchoolSummary(BaseSchema):
    """School summary with statistics"""
    id: UUID
    code: str
    name: str
    total_products: int = 0
    total_clients: int = 0
    total_sales: int = 0
    is_active: bool
