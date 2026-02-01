"""add garment_type_images table

Revision ID: m7n8o9p0q1r2
Revises: 96322716d81d
Create Date: 2026-01-03 12:00:00

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = 'm7n8o9p0q1r2'
down_revision = '96322716d81d'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create garment_type_images table for multiple images per garment type
    op.create_table(
        'garment_type_images',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('garment_type_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('school_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('image_url', sa.String(length=500), nullable=False),
        sa.Column('display_order', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('is_primary', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['garment_type_id'], ['garment_types.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['school_id'], ['schools.id'], ondelete='CASCADE'),
        sa.UniqueConstraint('garment_type_id', 'school_id', 'image_url', name='uq_garment_type_image'),
    )

    # Create indexes for faster lookups
    op.create_index('idx_garment_type_images_garment', 'garment_type_images', ['garment_type_id'])
    op.create_index('idx_garment_type_images_school', 'garment_type_images', ['school_id'])


def downgrade() -> None:
    op.drop_index('idx_garment_type_images_school', table_name='garment_type_images')
    op.drop_index('idx_garment_type_images_garment', table_name='garment_type_images')
    op.drop_table('garment_type_images')
