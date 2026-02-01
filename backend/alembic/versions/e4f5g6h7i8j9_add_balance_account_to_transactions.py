"""Add balance_account_id to transactions for balance integration

Revision ID: e4f5g6h7i8j9
Revises: d3e4f5a6b7c8
Create Date: 2025-12-14

This migration adds the ability to link transactions to balance accounts
for automatic cash/bank balance tracking.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'e4f5g6h7i8j9'
down_revision: Union[str, None] = 'd3e4f5a6b7c8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add balance_account_id column to transactions table
    # This links transactions to the balance account they affect (Caja, Banco, etc.)
    op.add_column(
        'transactions',
        sa.Column('balance_account_id', postgresql.UUID(as_uuid=True), nullable=True)
    )

    # Add transfer_to_account_id for TRANSFER type transactions
    # When transferring between accounts (e.g., Caja -> Banco)
    op.add_column(
        'transactions',
        sa.Column('transfer_to_account_id', postgresql.UUID(as_uuid=True), nullable=True)
    )

    # Add foreign key constraints
    op.create_foreign_key(
        'fk_transaction_balance_account',
        'transactions',
        'balance_accounts',
        ['balance_account_id'],
        ['id'],
        ondelete='SET NULL'
    )

    op.create_foreign_key(
        'fk_transaction_transfer_account',
        'transactions',
        'balance_accounts',
        ['transfer_to_account_id'],
        ['id'],
        ondelete='SET NULL'
    )

    # Add index for faster queries on balance_account_id
    op.create_index(
        'ix_transactions_balance_account_id',
        'transactions',
        ['balance_account_id']
    )


def downgrade() -> None:
    # Remove index
    op.drop_index('ix_transactions_balance_account_id', table_name='transactions')

    # Remove foreign key constraints
    op.drop_constraint('fk_transaction_transfer_account', 'transactions', type_='foreignkey')
    op.drop_constraint('fk_transaction_balance_account', 'transactions', type_='foreignkey')

    # Remove columns
    op.drop_column('transactions', 'transfer_to_account_id')
    op.drop_column('transactions', 'balance_account_id')
