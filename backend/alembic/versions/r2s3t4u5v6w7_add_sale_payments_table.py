"""Add sale_payments table for multiple payment methods per sale

Revision ID: r2s3t4u5v6w7
Revises: q1r2s3t4u5v6
Create Date: 2026-01-06

This migration adds support for multiple payment methods per sale.
Instead of a single payment_method on the sale, payments are tracked
in a separate table allowing partial payments.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'r2s3t4u5v6w7'
down_revision: Union[str, None] = 'q1r2s3t4u5v6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create sale_payments table
    # Use existing payment_method_enum from sales table
    payment_method_enum = postgresql.ENUM('cash', 'nequi', 'transfer', 'card', 'credit', name='payment_method_enum', create_type=False)

    op.create_table(
        'sale_payments',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('sale_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('sales.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('amount', sa.Numeric(10, 2), nullable=False),
        sa.Column('payment_method', payment_method_enum, nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('transaction_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('transactions.id', ondelete='SET NULL'), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint('amount > 0', name='chk_sale_payment_amount_positive'),
    )

    # Make payment_method nullable in sales table (for backwards compatibility)
    # New sales will use sale_payments table, old sales keep their payment_method
    op.alter_column('sales', 'payment_method', nullable=True)


def downgrade() -> None:
    # Drop the sale_payments table
    op.drop_table('sale_payments')

    # Make payment_method NOT NULL again (may fail if there are NULLs)
    op.alter_column('sales', 'payment_method', nullable=False)
