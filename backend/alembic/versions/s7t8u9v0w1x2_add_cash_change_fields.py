"""Add cash change (vueltas) fields to orders and alteration_payments

Revision ID: s7t8u9v0w1x2
Revises: r6s7t8u9v0w1
Create Date: 2026-01-27

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 's7t8u9v0w1x2'
down_revision: str = 'r6s7t8u9v0w1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add cash change fields to orders table
    op.add_column('orders', sa.Column(
        'amount_received', sa.Numeric(10, 2), nullable=True,
        comment='Physical amount received from customer (cash only)'
    ))
    op.add_column('orders', sa.Column(
        'change_given', sa.Numeric(10, 2), nullable=True,
        comment='Change returned to customer (cash only)'
    ))

    # Add cash change fields to alteration_payments table
    op.add_column('alteration_payments', sa.Column(
        'amount_received', sa.Numeric(10, 2), nullable=True,
        comment='Physical amount received from customer (cash only)'
    ))
    op.add_column('alteration_payments', sa.Column(
        'change_given', sa.Numeric(10, 2), nullable=True,
        comment='Change returned to customer (cash only)'
    ))


def downgrade() -> None:
    op.drop_column('alteration_payments', 'change_given')
    op.drop_column('alteration_payments', 'amount_received')
    op.drop_column('orders', 'change_given')
    op.drop_column('orders', 'amount_received')
