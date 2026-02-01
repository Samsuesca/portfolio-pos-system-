"""Add alterations tables

Revision ID: c1d2e3f4g5h6
Revises: b2c3d4e5f6g7
Create Date: 2026-01-12 14:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'c1d2e3f4g5h6'
down_revision: Union[str, None] = 'b2c3d4e5f6g7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create alteration_type_enum
    alteration_type_enum = postgresql.ENUM(
        'hem', 'length', 'width', 'seam', 'buttons', 'zipper', 'patch', 'darts', 'other',
        name='alteration_type_enum',
        create_type=False
    )
    alteration_type_enum.create(op.get_bind(), checkfirst=True)

    # Create alteration_status_enum
    alteration_status_enum = postgresql.ENUM(
        'pending', 'in_progress', 'ready', 'delivered', 'cancelled',
        name='alteration_status_enum',
        create_type=False
    )
    alteration_status_enum.create(op.get_bind(), checkfirst=True)

    # Create alterations table
    op.create_table(
        'alterations',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text('gen_random_uuid()')),
        sa.Column('code', sa.String(20), nullable=False),
        sa.Column('client_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('external_client_name', sa.String(255), nullable=True),
        sa.Column('external_client_phone', sa.String(20), nullable=True),
        sa.Column('alteration_type', postgresql.ENUM('hem', 'length', 'width', 'seam', 'buttons', 'zipper', 'patch', 'darts', 'other', name='alteration_type_enum', create_type=False), nullable=False),
        sa.Column('garment_name', sa.String(255), nullable=False),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('cost', sa.Numeric(12, 2), nullable=False),
        sa.Column('amount_paid', sa.Numeric(12, 2), nullable=False, server_default='0'),
        sa.Column('status', postgresql.ENUM('pending', 'in_progress', 'ready', 'delivered', 'cancelled', name='alteration_status_enum', create_type=False), nullable=False, server_default='pending'),
        sa.Column('received_date', sa.Date(), nullable=False),
        sa.Column('estimated_delivery_date', sa.Date(), nullable=True),
        sa.Column('delivered_date', sa.Date(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['client_id'], ['clients.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ondelete='SET NULL'),
        sa.CheckConstraint('cost > 0', name='chk_alteration_cost_positive'),
        sa.CheckConstraint('amount_paid >= 0', name='chk_alteration_paid_positive'),
        sa.CheckConstraint('client_id IS NOT NULL OR external_client_name IS NOT NULL', name='chk_alteration_has_client'),
    )

    # Create indexes for alterations
    op.create_index('ix_alterations_code', 'alterations', ['code'], unique=True)
    op.create_index('ix_alterations_client_id', 'alterations', ['client_id'])
    op.create_index('ix_alterations_status', 'alterations', ['status'])
    op.create_index('ix_alterations_received_date', 'alterations', ['received_date'])

    # Create alteration_payments table
    op.create_table(
        'alteration_payments',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text('gen_random_uuid()')),
        sa.Column('alteration_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('amount', sa.Numeric(12, 2), nullable=False),
        sa.Column('payment_method', sa.String(20), nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('transaction_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['alteration_id'], ['alterations.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['transaction_id'], ['transactions.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ondelete='SET NULL'),
        sa.CheckConstraint('amount > 0', name='chk_alteration_payment_positive'),
    )

    # Create indexes for alteration_payments
    op.create_index('ix_alteration_payments_alteration_id', 'alteration_payments', ['alteration_id'])
    op.create_index('ix_alteration_payments_created_at', 'alteration_payments', ['created_at'])

    # Add alteration_id column to transactions table
    op.add_column(
        'transactions',
        sa.Column('alteration_id', postgresql.UUID(as_uuid=True), nullable=True)
    )
    op.create_foreign_key(
        'fk_transactions_alteration_id',
        'transactions',
        'alterations',
        ['alteration_id'],
        ['id'],
        ondelete='SET NULL'
    )
    op.create_index('ix_transactions_alteration_id', 'transactions', ['alteration_id'])


def downgrade() -> None:
    # Remove alteration_id from transactions
    op.drop_index('ix_transactions_alteration_id', table_name='transactions')
    op.drop_constraint('fk_transactions_alteration_id', 'transactions', type_='foreignkey')
    op.drop_column('transactions', 'alteration_id')

    # Drop alteration_payments table
    op.drop_index('ix_alteration_payments_created_at', table_name='alteration_payments')
    op.drop_index('ix_alteration_payments_alteration_id', table_name='alteration_payments')
    op.drop_table('alteration_payments')

    # Drop alterations table
    op.drop_index('ix_alterations_received_date', table_name='alterations')
    op.drop_index('ix_alterations_status', table_name='alterations')
    op.drop_index('ix_alterations_client_id', table_name='alterations')
    op.drop_index('ix_alterations_code', table_name='alterations')
    op.drop_table('alterations')

    # Drop enums
    op.execute('DROP TYPE IF EXISTS alteration_status_enum')
    op.execute('DROP TYPE IF EXISTS alteration_type_enum')
