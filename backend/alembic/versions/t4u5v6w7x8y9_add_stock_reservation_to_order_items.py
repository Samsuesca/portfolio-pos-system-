"""Add stock reservation fields to order_items

Revision ID: t4u5v6w7x8y9
Revises: s3t4u5v6w7x8
Create Date: 2026-01-09

This migration adds support for reserving stock when creating orders.
- reserved_from_stock: Boolean flag indicating if stock was reserved from inventory
- quantity_reserved: Integer tracking how many units were reserved (for releasing on cancel)
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 't4u5v6w7x8y9'
down_revision: Union[str, None] = 's3t4u5v6w7x8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add reserved_from_stock column - indicates if stock was reserved from inventory
    op.add_column(
        'order_items',
        sa.Column(
            'reserved_from_stock',
            sa.Boolean(),
            nullable=False,
            server_default='false'
        )
    )

    # Add quantity_reserved column - tracks exact quantity reserved for releasing on cancel
    op.add_column(
        'order_items',
        sa.Column(
            'quantity_reserved',
            sa.Integer(),
            nullable=False,
            server_default='0'
        )
    )


def downgrade() -> None:
    op.drop_column('order_items', 'quantity_reserved')
    op.drop_column('order_items', 'reserved_from_stock')
