"""add global garment type images table

Revision ID: o9p0q1r2s3t4
Revises: n8o9p0q1r2s3
Create Date: 2026-01-04

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


# revision identifiers, used by Alembic.
revision = 'o9p0q1r2s3t4'
down_revision = 'n8o9p0q1r2s3'
branch_labels = None
depends_on = None


def upgrade():
    # Create global_garment_type_images table
    op.create_table(
        'global_garment_type_images',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('garment_type_id', UUID(as_uuid=True), nullable=False),
        sa.Column('image_url', sa.String(500), nullable=False),
        sa.Column('display_order', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('is_primary', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(
            ['garment_type_id'],
            ['global_garment_types.id'],
            name='fk_global_garment_type_images_garment_type',
            ondelete='CASCADE'
        ),
        sa.UniqueConstraint('garment_type_id', 'image_url', name='uq_global_garment_type_image')
    )

    # Create index for faster lookups
    op.create_index(
        'ix_global_garment_type_images_garment_type_id',
        'global_garment_type_images',
        ['garment_type_id']
    )


def downgrade():
    op.drop_index('ix_global_garment_type_images_garment_type_id', table_name='global_garment_type_images')
    op.drop_table('global_garment_type_images')
