"""Add global product support to order_items

Revision ID: y9z0a1b2c3d4
Revises: x8y9z0a1b2c3
Create Date: 2026-01-11

Adds global_product_id and is_global_product columns to order_items table
to support orders with global products (same pattern as sale_items).
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'y9z0a1b2c3d4'
down_revision = 'x8y9z0a1b2c3'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add global_product_id column to order_items
    op.add_column('order_items', sa.Column(
        'global_product_id',
        postgresql.UUID(as_uuid=True),
        nullable=True
    ))

    # Add is_global_product column to order_items
    op.add_column('order_items', sa.Column(
        'is_global_product',
        sa.Boolean(),
        nullable=False,
        server_default='false'
    ))

    # Create foreign key constraint
    op.create_foreign_key(
        'fk_order_items_global_product',
        'order_items',
        'global_products',
        ['global_product_id'],
        ['id'],
        ondelete='SET NULL'
    )

    # Create index for global_product_id
    op.create_index(
        'ix_order_items_global_product_id',
        'order_items',
        ['global_product_id']
    )


def downgrade() -> None:
    # Drop index
    op.drop_index('ix_order_items_global_product_id', table_name='order_items')

    # Drop foreign key
    op.drop_constraint('fk_order_items_global_product', 'order_items', type_='foreignkey')

    # Drop columns
    op.drop_column('order_items', 'is_global_product')
    op.drop_column('order_items', 'global_product_id')
