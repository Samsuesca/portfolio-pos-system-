"""add_admin_portal_to_salesource_enum

Revision ID: ec3e44bb9fc9
Revises: f65680f4bffd
Create Date: 2026-01-13 11:52:40.692361

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'ec3e44bb9fc9'
down_revision = 'f65680f4bffd'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add 'admin_portal' to the sale_source_enum type
    op.execute("ALTER TYPE sale_source_enum ADD VALUE IF NOT EXISTS 'admin_portal'")


def downgrade() -> None:
    # PostgreSQL doesn't support removing enum values directly
    # Would need to recreate the type, which is complex and risky
    # Leaving as no-op since the value being present doesn't break anything
    pass
