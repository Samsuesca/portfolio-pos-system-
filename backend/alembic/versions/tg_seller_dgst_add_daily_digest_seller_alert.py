"""add daily_digest_seller to telegram_alert_type_enum

Revision ID: tg_seller_dgst
Revises: vendor_norm_c
Create Date: 2026-05-01 12:00:00.000000

"""
from alembic import op


revision = "tg_seller_dgst"
down_revision = "vendor_norm_c"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "ALTER TYPE telegram_alert_type_enum ADD VALUE IF NOT EXISTS 'daily_digest_seller'"
    )


def downgrade() -> None:
    # PostgreSQL no soporta DROP VALUE en enums sin recrear el tipo (requiere
    # actualizar todas las columnas dependientes). El valor extra no rompe nada
    # si no se usa, así que el downgrade es no-op intencional.
    pass
