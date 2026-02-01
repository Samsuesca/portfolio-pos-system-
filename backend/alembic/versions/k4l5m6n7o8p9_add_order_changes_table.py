"""Add order_changes table for order modifications/returns

Revision ID: k4l5m6n7o8p9
Revises: j3k4l5m6n7o8
Create Date: 2026-01-27
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers
revision = 'k4l5m6n7o8p9'
down_revision = 'j3k4l5m6n7o8'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Reference existing enums without creating them (they already exist from sale_changes)
    change_type_enum = postgresql.ENUM(
        'size_change', 'product_change', 'return', 'defect',
        name='change_type_enum', create_type=False
    )
    change_status_enum = postgresql.ENUM(
        'pending', 'pending_stock', 'approved', 'rejected',
        name='change_status_enum', create_type=False
    )

    op.create_table(
        'order_changes',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('order_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('orders.id', ondelete='CASCADE'),
                  nullable=False, index=True),
        sa.Column('original_item_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('order_items.id', ondelete='RESTRICT'),
                  nullable=False, index=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('users.id', ondelete='RESTRICT'),
                  nullable=False),
        sa.Column('change_type', change_type_enum, nullable=False),
        sa.Column('change_date', sa.DateTime, nullable=False),
        sa.Column('returned_quantity', sa.Integer, nullable=False),
        # New product references
        sa.Column('new_product_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('products.id', ondelete='RESTRICT'),
                  nullable=True),
        sa.Column('new_global_product_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('global_products.id', ondelete='RESTRICT'),
                  nullable=True),
        sa.Column('is_new_global_product', sa.Boolean, server_default='false', nullable=False),
        sa.Column('new_quantity', sa.Integer, server_default='0', nullable=False),
        sa.Column('new_unit_price', sa.Numeric(10, 2), nullable=True),
        # Order-specific item specifications
        sa.Column('new_size', sa.String(10), nullable=True),
        sa.Column('new_color', sa.String(50), nullable=True),
        sa.Column('new_custom_measurements', postgresql.JSONB, nullable=True),
        sa.Column('new_embroidery_text', sa.String(100), nullable=True),
        # Financial
        sa.Column('price_adjustment', sa.Numeric(10, 2), server_default='0', nullable=False),
        sa.Column('status', change_status_enum, nullable=False),
        sa.Column('reason', sa.Text, nullable=False),
        sa.Column('rejection_reason', sa.Text, nullable=True),
        # Timestamps
        sa.Column('created_at', sa.DateTime, nullable=False),
        sa.Column('updated_at', sa.DateTime, nullable=False),
        # Constraints
        sa.CheckConstraint('returned_quantity > 0', name='chk_order_change_returned_qty_positive'),
        sa.CheckConstraint('new_quantity >= 0', name='chk_order_change_new_qty_positive'),
    )

    # Additional indexes for common queries
    op.create_index('ix_order_changes_status', 'order_changes', ['status'])
    op.create_index('ix_order_changes_change_date', 'order_changes', ['change_date'])


def downgrade() -> None:
    op.drop_index('ix_order_changes_change_date', table_name='order_changes')
    op.drop_index('ix_order_changes_status', table_name='order_changes')
    op.drop_table('order_changes')
