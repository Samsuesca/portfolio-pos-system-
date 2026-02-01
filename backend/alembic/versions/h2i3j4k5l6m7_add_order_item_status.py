"""Add item_status to order_items for independent item tracking

Revision ID: h2i3j4k5l6m7
Revises: g1h2i3j4k5l6
Create Date: 2025-12-14

This migration adds independent status tracking per order item.
This allows items in the same order to have different statuses
(e.g., one item delivered while another is still in production).

States: pending, in_production, ready, delivered, cancelled
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'h2i3j4k5l6m7'
down_revision: Union[str, None] = 'g1h2i3j4k5l6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create enum type for order item status
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE order_item_status_enum AS ENUM (
                'pending', 'in_production', 'ready', 'delivered', 'cancelled'
            );
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    """)

    # 2. Add item_status column with default 'pending'
    op.add_column(
        'order_items',
        sa.Column(
            'item_status',
            postgresql.ENUM('pending', 'in_production', 'ready', 'delivered', 'cancelled',
                          name='order_item_status_enum', create_type=False),
            nullable=False,
            server_default='pending'
        )
    )

    # 3. Add status_updated_at column for tracking when status changed
    op.add_column(
        'order_items',
        sa.Column('status_updated_at', sa.DateTime(), nullable=True)
    )

    # 4. Create index for efficient filtering by status
    op.create_index(
        'ix_order_items_item_status',
        'order_items',
        ['item_status']
    )


def downgrade() -> None:
    # 1. Drop index
    op.drop_index('ix_order_items_item_status', table_name='order_items')

    # 2. Drop columns
    op.drop_column('order_items', 'status_updated_at')
    op.drop_column('order_items', 'item_status')

    # 3. Drop enum type
    op.execute('DROP TYPE IF EXISTS order_item_status_enum CASCADE')
