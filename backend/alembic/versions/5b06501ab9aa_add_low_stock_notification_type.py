"""Add low_stock_alert notification type and product reference type

Revision ID: 5b06501ab9aa
Revises: 4fe064566e85
Create Date: 2026-01-13

"""
from alembic import op

# revision identifiers
revision = '5b06501ab9aa'
down_revision = '4fe064566e85'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add new value to notification_type_enum
    op.execute("ALTER TYPE notification_type_enum ADD VALUE IF NOT EXISTS 'low_stock_alert'")

    # Add new value to reference_type_enum
    op.execute("ALTER TYPE reference_type_enum ADD VALUE IF NOT EXISTS 'product'")


def downgrade() -> None:
    # Note: PostgreSQL doesn't support removing enum values directly
    # The values will remain but won't be used
    pass
