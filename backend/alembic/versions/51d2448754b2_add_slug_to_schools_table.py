"""Add slug to schools table

Revision ID: 51d2448754b2
Revises: c7d8e9f0a1b2
Create Date: 2025-12-13 02:47:23.232123

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '51d2448754b2'
down_revision = 'c7d8e9f0a1b2'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add slug column
    op.add_column('schools', sa.Column('slug', sa.String(length=100), nullable=True))

    # Create unique constraint
    op.create_unique_constraint('uq_school_slug', 'schools', ['slug'])

    # Generate slugs for existing schools from their names
    op.execute("""
        UPDATE schools
        SET slug = LOWER(REGEXP_REPLACE(name, '[^a-zA-Z0-9]+', '-', 'g'))
        WHERE slug IS NULL
    """)

    # Make slug required after populating existing records
    op.alter_column('schools', 'slug', nullable=False)


def downgrade() -> None:
    op.drop_constraint('uq_school_slug', 'schools', type_='unique')
    op.drop_column('schools', 'slug')
