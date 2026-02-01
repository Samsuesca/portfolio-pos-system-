"""Add is_historical to sales for migration data

Revision ID: c7d8e9f0a1b2
Revises: b1a9c3e54f78
Create Date: 2025-12-09 18:00:00.000000

Changes:
- Add is_historical boolean column to sales table
- Historical sales don't affect inventory (used for data migration)
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'c7d8e9f0a1b2'
down_revision = 'b1a9c3e54f78'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add is_historical column with default False
    op.add_column(
        'sales',
        sa.Column('is_historical', sa.Boolean(), nullable=False, server_default='false')
    )


def downgrade() -> None:
    op.drop_column('sales', 'is_historical')
