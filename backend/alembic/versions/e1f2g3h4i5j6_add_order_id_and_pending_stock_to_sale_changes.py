"""Add order_id and pending_stock status to sale_changes

Revision ID: e1f2g3h4i5j6
Revises: d0e1f2g3h4i5
Create Date: 2026-01-19

Adds:
- order_id column to sale_changes for linking to orders when stock unavailable
- pending_stock status to change_status_enum
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'e1f2g3h4i5j6'
down_revision = 'd0e1f2g3h4i5'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Add pending_stock to change_status_enum
    # PostgreSQL requires special handling for enum modification
    op.execute("ALTER TYPE change_status_enum ADD VALUE IF NOT EXISTS 'pending_stock'")

    # 2. Add order_id column to sale_changes (without inline index)
    op.add_column(
        'sale_changes',
        sa.Column(
            'order_id',
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey('orders.id', ondelete='SET NULL'),
            nullable=True
        )
    )

    # 3. Create index for order_id explicitly
    op.create_index(
        'ix_sale_changes_order_id',
        'sale_changes',
        ['order_id'],
        unique=False
    )


def downgrade() -> None:
    # Drop index and column
    op.drop_index('ix_sale_changes_order_id', table_name='sale_changes')
    op.drop_column('sale_changes', 'order_id')

    # Note: Cannot easily remove enum value in PostgreSQL
    # The pending_stock value will remain in the enum type
