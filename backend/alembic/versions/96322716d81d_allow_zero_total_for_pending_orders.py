"""allow_zero_total_for_pending_orders

Revision ID: 96322716d81d
Revises: l6m7n8o9p0q1
Create Date: 2025-12-16 23:46:15.431363

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '96322716d81d'
down_revision = 'l6m7n8o9p0q1'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Drop the existing constraint that requires total > 0
    op.drop_constraint('chk_order_total_positive', 'orders', type_='check')

    # Create new constraint that allows zero total for PENDING orders or orders with needs_quotation items
    # This allows custom orders with pending quotation to have total = 0
    op.create_check_constraint(
        'chk_order_total_positive',
        'orders',
        'total > 0 OR status = \'PENDING\''
    )


def downgrade() -> None:
    # Restore the original constraint (total must always be > 0)
    op.drop_constraint('chk_order_total_positive', 'orders', type_='check')
    op.create_check_constraint(
        'chk_order_total_positive',
        'orders',
        'total > 0'
    )
