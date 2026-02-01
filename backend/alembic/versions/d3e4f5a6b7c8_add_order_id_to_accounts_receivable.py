"""Add order_id to accounts_receivable table

Revision ID: d3e4f5a6b7c8
Revises: 51d2448754b2
Create Date: 2025-12-14

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'd3e4f5a6b7c8'
down_revision: Union[str, None] = '51d2448754b2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add order_id column to accounts_receivable table
    op.add_column(
        'accounts_receivable',
        sa.Column('order_id', postgresql.UUID(as_uuid=True), nullable=True)
    )

    # Add foreign key constraint
    op.create_foreign_key(
        'fk_accounts_receivable_order_id',
        'accounts_receivable',
        'orders',
        ['order_id'],
        ['id'],
        ondelete='SET NULL'
    )

    # Add index for better query performance
    op.create_index(
        'ix_accounts_receivable_order_id',
        'accounts_receivable',
        ['order_id']
    )


def downgrade() -> None:
    # Remove index
    op.drop_index('ix_accounts_receivable_order_id', table_name='accounts_receivable')

    # Remove foreign key constraint
    op.drop_constraint('fk_accounts_receivable_order_id', 'accounts_receivable', type_='foreignkey')

    # Remove column
    op.drop_column('accounts_receivable', 'order_id')
