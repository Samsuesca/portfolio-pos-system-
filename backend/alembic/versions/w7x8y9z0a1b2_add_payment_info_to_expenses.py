"""Add payment info to expenses

Revision ID: w7x8y9z0a1b2
Revises: v6w7x8y9z0a1
Create Date: 2026-01-11

Adds payment tracking fields to expenses table:
- payment_method: Method used to pay (cash, nequi, transfer, etc)
- payment_account_id: FK to balance_accounts (Caja Menor, Banco, etc)
- paid_at: Timestamp when the expense was paid
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'w7x8y9z0a1b2'
down_revision = 'v6w7x8y9z0a1'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add payment info columns to expenses table
    op.add_column('expenses', sa.Column('payment_method', sa.String(20), nullable=True))
    op.add_column('expenses', sa.Column('payment_account_id', postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column('expenses', sa.Column('paid_at', sa.DateTime(), nullable=True))

    # Add foreign key constraint
    op.create_foreign_key(
        'fk_expenses_payment_account_id',
        'expenses',
        'balance_accounts',
        ['payment_account_id'],
        ['id'],
        ondelete='SET NULL'
    )

    # Create index for payment_account_id for faster queries
    op.create_index('ix_expenses_payment_account_id', 'expenses', ['payment_account_id'])


def downgrade() -> None:
    # Remove index
    op.drop_index('ix_expenses_payment_account_id', table_name='expenses')

    # Remove foreign key
    op.drop_constraint('fk_expenses_payment_account_id', 'expenses', type_='foreignkey')

    # Remove columns
    op.drop_column('expenses', 'paid_at')
    op.drop_column('expenses', 'payment_account_id')
    op.drop_column('expenses', 'payment_method')
