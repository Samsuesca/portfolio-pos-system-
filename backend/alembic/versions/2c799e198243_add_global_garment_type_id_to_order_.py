"""add_global_garment_type_id_to_order_items

Revision ID: 2c799e198243
Revises: a1b2c3d4e5f6
Create Date: 2026-01-12 13:28:23.983051

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '2c799e198243'
down_revision = 'a1b2c3d4e5f6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add global_garment_type_id column to order_items
    op.add_column('order_items', sa.Column('global_garment_type_id', sa.UUID(), nullable=True))

    # Make garment_type_id nullable (for global products that use global_garment_type_id)
    op.alter_column('order_items', 'garment_type_id',
               existing_type=sa.UUID(),
               nullable=True)

    # Create index for the new column
    op.create_index(op.f('ix_order_items_global_garment_type_id'), 'order_items', ['global_garment_type_id'], unique=False)

    # Create foreign key constraint
    op.create_foreign_key(
        'order_items_global_garment_type_id_fkey',
        'order_items',
        'global_garment_types',
        ['global_garment_type_id'],
        ['id'],
        ondelete='RESTRICT'
    )


def downgrade() -> None:
    # Drop foreign key constraint
    op.drop_constraint('order_items_global_garment_type_id_fkey', 'order_items', type_='foreignkey')

    # Drop index
    op.drop_index(op.f('ix_order_items_global_garment_type_id'), table_name='order_items')

    # Make garment_type_id NOT NULL again
    op.alter_column('order_items', 'garment_type_id',
               existing_type=sa.UUID(),
               nullable=False)

    # Drop the column
    op.drop_column('order_items', 'global_garment_type_id')
