"""Add inventory_logs table for audit trail

Revision ID: d0e1f2g3h4i5
Revises: c9d0e1f2a3b4
Create Date: 2026-01-19

Creates inventory_logs table to track all inventory movements
similar to balance_entries for accounting.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'd0e1f2g3h4i5'
down_revision = 'c9d0e1f2a3b4'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create inventory movement type enum
    inventory_movement_type_enum = postgresql.ENUM(
        'sale', 'sale_cancel', 'order_reserve', 'order_cancel',
        'order_deliver', 'change_return', 'change_out',
        'adjustment_in', 'adjustment_out', 'purchase', 'initial',
        name='inventory_movement_type_enum',
        create_type=False
    )
    inventory_movement_type_enum.create(op.get_bind(), checkfirst=True)

    # Create inventory_logs table
    op.create_table(
        'inventory_logs',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('inventory_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('global_inventory_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('school_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column(
            'movement_type',
            postgresql.ENUM(
                'sale', 'sale_cancel', 'order_reserve', 'order_cancel',
                'order_deliver', 'change_return', 'change_out',
                'adjustment_in', 'adjustment_out', 'purchase', 'initial',
                name='inventory_movement_type_enum',
                create_type=False
            ),
            nullable=False
        ),
        sa.Column('movement_date', sa.Date(), nullable=False),
        sa.Column('quantity_delta', sa.Integer(), nullable=False),
        sa.Column('quantity_after', sa.Integer(), nullable=False),
        sa.Column('description', sa.String(500), nullable=False),
        sa.Column('reference', sa.String(100), nullable=True),
        sa.Column('sale_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('order_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('sale_change_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),

        # Foreign keys
        sa.ForeignKeyConstraint(['inventory_id'], ['inventory.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['global_inventory_id'], ['global_inventory.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['school_id'], ['schools.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['sale_id'], ['sales.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['order_id'], ['orders.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['sale_change_id'], ['sale_changes.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ondelete='SET NULL'),
    )

    # Create indexes for common queries
    op.create_index('ix_inventory_logs_inventory_id', 'inventory_logs', ['inventory_id'])
    op.create_index('ix_inventory_logs_global_inventory_id', 'inventory_logs', ['global_inventory_id'])
    op.create_index('ix_inventory_logs_school_id', 'inventory_logs', ['school_id'])
    op.create_index('ix_inventory_logs_movement_type', 'inventory_logs', ['movement_type'])
    op.create_index('ix_inventory_logs_movement_date', 'inventory_logs', ['movement_date'])
    op.create_index('ix_inventory_logs_sale_id', 'inventory_logs', ['sale_id'])
    op.create_index('ix_inventory_logs_order_id', 'inventory_logs', ['order_id'])


def downgrade() -> None:
    # Drop indexes
    op.drop_index('ix_inventory_logs_order_id', table_name='inventory_logs')
    op.drop_index('ix_inventory_logs_sale_id', table_name='inventory_logs')
    op.drop_index('ix_inventory_logs_movement_date', table_name='inventory_logs')
    op.drop_index('ix_inventory_logs_movement_type', table_name='inventory_logs')
    op.drop_index('ix_inventory_logs_school_id', table_name='inventory_logs')
    op.drop_index('ix_inventory_logs_global_inventory_id', table_name='inventory_logs')
    op.drop_index('ix_inventory_logs_inventory_id', table_name='inventory_logs')

    # Drop table
    op.drop_table('inventory_logs')

    # Drop enum type
    op.execute('DROP TYPE IF EXISTS inventory_movement_type_enum CASCADE')
