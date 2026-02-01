"""Add display_order to schools table

Revision ID: p0q1r2s3t4u5
Revises: o9p0q1r2s3t4
Create Date: 2026-01-05

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'p0q1r2s3t4u5'
down_revision: Union[str, None] = 'o9p0q1r2s3t4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add display_order column with default 100
    op.add_column('schools', sa.Column('display_order', sa.Integer(), nullable=False, server_default='100'))

    # Set initial order for known schools (each UPDATE must be separate for asyncpg)
    # Caracas = 1, Pumarejo = 2, Pinal = 3, CONFAMA = 4
    op.execute("UPDATE schools SET display_order = 1 WHERE slug = 'caracas' OR name ILIKE '%caracas%'")
    op.execute("UPDATE schools SET display_order = 2 WHERE slug = 'pumarejo' OR name ILIKE '%pumarejo%'")
    op.execute("UPDATE schools SET display_order = 3 WHERE slug = 'pinal' OR name ILIKE '%pinal%'")
    op.execute("UPDATE schools SET display_order = 4 WHERE slug = 'confama' OR name ILIKE '%confama%'")


def downgrade() -> None:
    op.drop_column('schools', 'display_order')
