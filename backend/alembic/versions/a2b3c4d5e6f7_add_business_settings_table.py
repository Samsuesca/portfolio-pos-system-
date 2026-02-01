"""add_business_settings_table

Revision ID: a2b3c4d5e6f7
Revises: 3543b0efb39c
Create Date: 2026-01-21

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

# revision identifiers, used by Alembic.
revision = 'a2b3c4d5e6f7'
down_revision = '3543b0efb39c'
branch_labels = None
depends_on = None


# Default business settings to seed
DEFAULT_SETTINGS = [
    # General Info
    ("business_name", "Uniformes Consuelo Rios", "Nombre completo del negocio"),
    ("business_name_short", "UCR", "Nombre corto/abreviación"),
    ("tagline", "Sistema de Gestión", "Eslogan o subtítulo"),

    # Contact
    ("phone_main", "+57 300 123 4567", "Teléfono principal de contacto"),
    ("phone_support", "+57 301 568 7810", "Teléfono de soporte técnico"),
    ("whatsapp_number", "573001234567", "Número WhatsApp (sin + ni espacios, para links)"),
    ("email_contact", "contact@example.com", "Email público de contacto"),
    ("email_noreply", "noreply@yourdomain.com", "Email para envío de notificaciones"),

    # Address
    ("address_line1", "Calle 56 D #26 BE 04", "Dirección línea 1"),
    ("address_line2", "Villas de San José, Boston - Barrio Sucre", "Dirección línea 2 (barrio)"),
    ("city", "Medellín", "Ciudad"),
    ("state", "Antioquia", "Departamento/Estado"),
    ("country", "Colombia", "País"),
    ("maps_url", "https://www.google.com/maps/search/?api=1&query=Calle+56D+26BE+04+Villas+de+San+Jose+Boston+Medellin", "URL de Google Maps"),

    # Hours
    ("hours_weekday", "Lunes a Viernes: 8:00 AM - 6:00 PM", "Horario días de semana"),
    ("hours_saturday", "Sábados: 9:00 AM - 2:00 PM", "Horario sábados"),
    ("hours_sunday", "Domingos: Cerrado", "Horario domingos"),

    # Web
    ("website_url", "https://yourdomain.com", "URL del sitio web"),

    # Social Media (optional)
    ("social_facebook", "", "URL de Facebook (opcional)"),
    ("social_instagram", "", "URL de Instagram (opcional)"),
]


def upgrade() -> None:
    # Create business_settings table
    op.create_table(
        'business_settings',
        sa.Column('id', UUID(as_uuid=True), nullable=False),
        sa.Column('key', sa.String(length=100), nullable=False),
        sa.Column('value', sa.Text(), nullable=False, server_default=''),
        sa.Column('description', sa.String(length=255), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.Column('updated_by', UUID(as_uuid=True), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_business_settings_key'), 'business_settings', ['key'], unique=True)

    # Seed default settings using raw SQL with gen_random_uuid()
    for key, value, description in DEFAULT_SETTINGS:
        # Escape single quotes in values
        escaped_value = value.replace("'", "''")
        escaped_description = description.replace("'", "''")
        op.execute(
            f"""
            INSERT INTO business_settings (id, key, value, description, updated_at)
            VALUES (gen_random_uuid(), '{key}', '{escaped_value}', '{escaped_description}', NOW())
            """
        )


def downgrade() -> None:
    op.drop_index(op.f('ix_business_settings_key'), table_name='business_settings')
    op.drop_table('business_settings')
