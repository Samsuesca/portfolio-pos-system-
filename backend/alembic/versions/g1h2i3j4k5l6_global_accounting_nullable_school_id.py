"""Make school_id nullable in accounting tables for global accounting

Revision ID: g1h2i3j4k5l6
Revises: e4f5g6h7i8j9
Create Date: 2025-12-14

This migration makes school_id nullable in accounting tables to support
global accounting (business-wide) vs school-specific accounting.

- school_id = NULL → Global/business-wide record
- school_id = UUID → School-specific record (for reports)
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'g1h2i3j4k5l6'
down_revision: Union[str, None] = 'e4f5g6h7i8j9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Make school_id nullable in balance_accounts
    op.alter_column(
        'balance_accounts',
        'school_id',
        existing_type=postgresql.UUID(as_uuid=True),
        nullable=True
    )

    # 2. Make school_id nullable in balance_entries
    op.alter_column(
        'balance_entries',
        'school_id',
        existing_type=postgresql.UUID(as_uuid=True),
        nullable=True
    )

    # 3. Make school_id nullable in expenses
    op.alter_column(
        'expenses',
        'school_id',
        existing_type=postgresql.UUID(as_uuid=True),
        nullable=True
    )

    # 4. Make school_id nullable in daily_cash_registers
    op.alter_column(
        'daily_cash_registers',
        'school_id',
        existing_type=postgresql.UUID(as_uuid=True),
        nullable=True
    )

    # 5. Make school_id nullable in accounts_payable
    op.alter_column(
        'accounts_payable',
        'school_id',
        existing_type=postgresql.UUID(as_uuid=True),
        nullable=True
    )

    # 6. Make school_id nullable in accounts_receivable
    op.alter_column(
        'accounts_receivable',
        'school_id',
        existing_type=postgresql.UUID(as_uuid=True),
        nullable=True
    )

    # 7. Make school_id nullable in transactions
    op.alter_column(
        'transactions',
        'school_id',
        existing_type=postgresql.UUID(as_uuid=True),
        nullable=True
    )

    # Note: Global accounts (Caja, Banco) will be created via script
    # after migration is applied


def downgrade() -> None:
    # Revert school_id to NOT NULL (only if all records have school_id)
    # This may fail if there are NULL values - intentional safety check

    op.alter_column(
        'transactions',
        'school_id',
        existing_type=postgresql.UUID(as_uuid=True),
        nullable=False
    )

    op.alter_column(
        'accounts_receivable',
        'school_id',
        existing_type=postgresql.UUID(as_uuid=True),
        nullable=False
    )

    op.alter_column(
        'accounts_payable',
        'school_id',
        existing_type=postgresql.UUID(as_uuid=True),
        nullable=False
    )

    op.alter_column(
        'daily_cash_registers',
        'school_id',
        existing_type=postgresql.UUID(as_uuid=True),
        nullable=False
    )

    op.alter_column(
        'expenses',
        'school_id',
        existing_type=postgresql.UUID(as_uuid=True),
        nullable=False
    )

    op.alter_column(
        'balance_entries',
        'school_id',
        existing_type=postgresql.UUID(as_uuid=True),
        nullable=False
    )

    op.alter_column(
        'balance_accounts',
        'school_id',
        existing_type=postgresql.UUID(as_uuid=True),
        nullable=False
    )
