"""
Business Settings Model

Stores key-value configuration for business information (name, contacts, address, hours, etc.)
This data is exposed via /api/v1/business-info and can be edited from admin-portal.
"""
from sqlalchemy import Column, String, Text, DateTime
from sqlalchemy.dialects.postgresql import UUID
from app.db.base import Base
from app.utils.timezone import get_colombia_now_naive
import uuid
from datetime import datetime


class BusinessSettings(Base):
    """
    Key-value store for business configuration.

    Each setting is stored as a separate row with:
    - key: unique identifier (e.g., 'business_name', 'phone_main')
    - value: the actual value (stored as text)
    - description: human-readable description for admin UI
    """
    __tablename__ = "business_settings"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    key = Column(String(100), unique=True, nullable=False, index=True)
    value = Column(Text, nullable=False, default="")
    description = Column(String(255), nullable=True)
    updated_at = Column(DateTime, default=get_colombia_now_naive, onupdate=get_colombia_now_naive)
    updated_by = Column(UUID(as_uuid=True), nullable=True)

    def __repr__(self):
        return f"<BusinessSettings {self.key}={self.value[:50]}...>"


# Default settings to be seeded on first migration
DEFAULT_BUSINESS_SETTINGS = {
    # General Info
    "business_name": {
        "value": "Uniformes Consuelo Rios",
        "description": "Nombre completo del negocio"
    },
    "business_name_short": {
        "value": "UCR",
        "description": "Nombre corto/abreviación"
    },
    "tagline": {
        "value": "Sistema de Gestión",
        "description": "Eslogan o subtítulo"
    },

    # Contact
    "phone_main": {
        "value": "+57 300 123 4567",
        "description": "Teléfono principal de contacto"
    },
    "phone_support": {
        "value": "+57 301 568 7810",
        "description": "Teléfono de soporte técnico"
    },
    "whatsapp_number": {
        "value": "573001234567",
        "description": "Número WhatsApp (sin + ni espacios, para links)"
    },
    "email_contact": {
        "value": "contact@example.com",
        "description": "Email público de contacto"
    },
    "email_noreply": {
        "value": "noreply@yourdomain.com",
        "description": "Email para envío de notificaciones"
    },

    # Address
    "address_line1": {
        "value": "Calle 56 D #26 BE 04",
        "description": "Dirección línea 1"
    },
    "address_line2": {
        "value": "Villas de San José, Boston - Barrio Sucre",
        "description": "Dirección línea 2 (barrio)"
    },
    "city": {
        "value": "Medellín",
        "description": "Ciudad"
    },
    "state": {
        "value": "Antioquia",
        "description": "Departamento/Estado"
    },
    "country": {
        "value": "Colombia",
        "description": "País"
    },
    "maps_url": {
        "value": "https://www.google.com/maps/search/?api=1&query=Calle+56D+26BE+04+Villas+de+San+Jose+Boston+Medellin",
        "description": "URL de Google Maps"
    },

    # Hours
    "hours_weekday": {
        "value": "Lunes a Viernes: 8:00 AM - 6:00 PM",
        "description": "Horario días de semana"
    },
    "hours_saturday": {
        "value": "Sábados: 9:00 AM - 2:00 PM",
        "description": "Horario sábados"
    },
    "hours_sunday": {
        "value": "Domingos: Cerrado",
        "description": "Horario domingos"
    },

    # Web
    "website_url": {
        "value": "https://yourdomain.com",
        "description": "URL del sitio web"
    },

    # Social Media (optional)
    "social_facebook": {
        "value": "",
        "description": "URL de Facebook (opcional)"
    },
    "social_instagram": {
        "value": "",
        "description": "URL de Instagram (opcional)"
    },
}
