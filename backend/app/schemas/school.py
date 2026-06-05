"""
School (Tenant) Schemas
"""
from uuid import UUID
from pydantic import ConfigDict, Field, field_validator, HttpUrl
from app.schemas.base import BaseSchema, IDModelSchema, TimestampSchema


class SchoolBase(BaseSchema):
    """Base school schema"""
    name: str = Field(..., min_length=3, max_length=255, example="Colegio San José")
    slug: str | None = Field(None, min_length=3, max_length=100, pattern=r'^[a-z0-9-]+$', example="colegio-san-jose")
    logo_url: HttpUrl | str | None = None
    primary_color: str | None = Field(None, pattern=r'^#[0-9A-Fa-f]{6}$', example="#1E3A5F")
    secondary_color: str | None = Field(None, pattern=r'^#[0-9A-Fa-f]{6}$', example="#F5A623")
    address: str | None = Field(None, example="Calle 72 #10-25, Bogotá")
    phone: str | None = Field(None, max_length=20, example="3015678901")
    email: str | None = Field(None, max_length=255, example="contacto@colegiosanjose.edu.co")

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
    code: str = Field(..., min_length=3, max_length=20, pattern=r'^[A-Z0-9-]+$', example="CSJ-001")
    settings: SchoolSettings = Field(default_factory=SchoolSettings)

    @field_validator('code')
    @classmethod
    def validate_code(cls, v: str) -> str:
        """Ensure code is uppercase"""
        return v.upper()


class SchoolUpdate(BaseSchema):
    """Schema for updating school information"""
    name: str | None = Field(None, min_length=3, max_length=255, example="Colegio San José Actualizado")
    logo_url: HttpUrl | str | None = None
    primary_color: str | None = Field(None, pattern=r'^#[0-9A-Fa-f]{6}$', example="#2B4A6F")
    secondary_color: str | None = Field(None, pattern=r'^#[0-9A-Fa-f]{6}$', example="#E89B1A")
    address: str | None = Field(None, example="Carrera 15 #80-20, Bogotá")
    phone: str | None = Field(None, max_length=20, example="3209876543")
    email: str | None = Field(None, max_length=255, example="admin@colegiosanjose.edu.co")
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

    model_config = ConfigDict(
        from_attributes=True,
        json_schema_extra={
            "example": {
                "id": "770e8400-e29b-41d4-a716-446655440002",
                "code": "CSJ-001",
                "name": "Colegio San José",
                "slug": "colegio-san-jose",
                "logo_url": None,
                "primary_color": "#1E3A5F",
                "secondary_color": "#F5A623",
                "address": "Calle 72 #10-25, Bogotá",
                "phone": "3015678901",
                "email": "contacto@colegiosanjose.edu.co",
                "settings": {
                    "currency": "COP",
                    "tax_rate": 19,
                    "commission_per_garment": 5000,
                    "allow_credit_sales": True,
                    "max_credit_days": 30,
                },
                "is_active": True,
                "created_at": "2026-04-12T10:30:00",
                "updated_at": "2026-04-12T10:30:00",
            }
        },
    )


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
