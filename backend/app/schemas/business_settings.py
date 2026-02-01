"""
Business Settings Schemas

Pydantic schemas for business configuration API.
"""
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from uuid import UUID


class BusinessSettingBase(BaseModel):
    """Base schema for a single setting."""
    key: str
    value: str
    description: Optional[str] = None


class BusinessSettingUpdate(BaseModel):
    """Schema for updating a single setting."""
    value: str


class BusinessSettingInDB(BusinessSettingBase):
    """Schema for a setting stored in DB."""
    id: UUID
    updated_at: datetime
    updated_by: Optional[UUID] = None

    class Config:
        from_attributes = True


class BusinessInfoResponse(BaseModel):
    """
    Flattened response with all business settings.
    This is what the API returns - a simple key-value dict.
    """
    # General Info
    business_name: str = Field(default="", description="Nombre completo del negocio")
    business_name_short: str = Field(default="", description="Nombre corto/abreviación")
    tagline: str = Field(default="", description="Eslogan o subtítulo")

    # Contact
    phone_main: str = Field(default="", description="Teléfono principal")
    phone_support: str = Field(default="", description="Teléfono de soporte")
    whatsapp_number: str = Field(default="", description="Número WhatsApp (sin + ni espacios)")
    email_contact: str = Field(default="", description="Email público")
    email_noreply: str = Field(default="", description="Email para notificaciones")

    # Address
    address_line1: str = Field(default="", description="Dirección línea 1")
    address_line2: str = Field(default="", description="Dirección línea 2")
    city: str = Field(default="", description="Ciudad")
    state: str = Field(default="", description="Departamento/Estado")
    country: str = Field(default="", description="País")
    maps_url: str = Field(default="", description="URL de Google Maps")

    # Hours
    hours_weekday: str = Field(default="", description="Horario días de semana")
    hours_saturday: str = Field(default="", description="Horario sábados")
    hours_sunday: str = Field(default="", description="Horario domingos")

    # Web
    website_url: str = Field(default="", description="URL del sitio web")

    # Social Media
    social_facebook: str = Field(default="", description="URL de Facebook")
    social_instagram: str = Field(default="", description="URL de Instagram")

    class Config:
        from_attributes = True


class BusinessInfoUpdate(BaseModel):
    """
    Schema for bulk updating business settings.
    All fields are optional - only provided fields will be updated.
    """
    # General Info
    business_name: Optional[str] = None
    business_name_short: Optional[str] = None
    tagline: Optional[str] = None

    # Contact
    phone_main: Optional[str] = None
    phone_support: Optional[str] = None
    whatsapp_number: Optional[str] = None
    email_contact: Optional[str] = None
    email_noreply: Optional[str] = None

    # Address
    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None
    maps_url: Optional[str] = None

    # Hours
    hours_weekday: Optional[str] = None
    hours_saturday: Optional[str] = None
    hours_sunday: Optional[str] = None

    # Web
    website_url: Optional[str] = None

    # Social Media
    social_facebook: Optional[str] = None
    social_instagram: Optional[str] = None
