"""add_sale_changes_table

Revision ID: d868decca943
Revises: 4093d4173dee
Create Date: 2025-10-19 22:17:32.756056

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'd868decca943'
down_revision = '4093d4173dee'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create enum types for change_type and change_status (skip if already exist)
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE change_type_enum AS ENUM ('size_change', 'product_change', 'return', 'defect');
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    """)

    op.execute("""
        DO $$ BEGIN
            CREATE TYPE change_status_enum AS ENUM ('pending', 'approved', 'rejected');
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    """)

    # Create sale_changes table
    op.create_table(
        'sale_changes',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('sale_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('original_item_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('change_type', postgresql.ENUM('size_change', 'product_change', 'return', 'defect', name='change_type_enum', create_type=False), nullable=False),
        sa.Column('change_date', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('returned_quantity', sa.Integer(), nullable=False),
        sa.Column('new_product_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('new_quantity', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('new_unit_price', sa.Numeric(10, 2), nullable=True),
        sa.Column('price_adjustment', sa.Numeric(10, 2), nullable=False, server_default='0'),
        sa.Column('status', postgresql.ENUM('pending', 'approved', 'rejected', name='change_status_enum', create_type=False), nullable=False, server_default='pending'),
        sa.Column('reason', sa.Text(), nullable=False),
        sa.Column('rejection_reason', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('now()'), onupdate=sa.text('now()')),

        # Foreign keys
        sa.ForeignKeyConstraint(['sale_id'], ['sales.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['original_item_id'], ['sale_items.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['new_product_id'], ['products.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='RESTRICT'),

        # Check constraints
        sa.CheckConstraint('returned_quantity > 0', name='chk_change_returned_qty_positive'),
        sa.CheckConstraint('new_quantity >= 0', name='chk_change_new_qty_positive'),
    )

    # Create indexes for common queries
    op.create_index('ix_sale_changes_sale_id', 'sale_changes', ['sale_id'])
    op.create_index('ix_sale_changes_original_item_id', 'sale_changes', ['original_item_id'])
    op.create_index('ix_sale_changes_status', 'sale_changes', ['status'])
    op.create_index('ix_sale_changes_change_date', 'sale_changes', ['change_date'])


def downgrade() -> None:
    # Drop indexes
    op.drop_index('ix_sale_changes_change_date', table_name='sale_changes')
    op.drop_index('ix_sale_changes_status', table_name='sale_changes')
    op.drop_index('ix_sale_changes_original_item_id', table_name='sale_changes')
    op.drop_index('ix_sale_changes_sale_id', table_name='sale_changes')

    # Drop table
    op.drop_table('sale_changes')

    # Drop enum types
    op.execute('DROP TYPE IF EXISTS change_status_enum CASCADE')
    op.execute('DROP TYPE IF EXISTS change_type_enum CASCADE')
