"""Add amount_received and change_given to sale_payments for cash change tracking

Revision ID: g0h1i2j3k4l5
Revises: f8g9h0i1j2k3
Create Date: 2026-01-22

Adds fields to track:
- amount_received: Physical cash received from customer
- change_given: Change returned to customer

These are informational fields for receipts/auditing.
They do NOT affect accounting (change is immediate in/out).
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = 'g0h1i2j3k4l5'
down_revision: Union[str, None] = 'f8g9h0i1j2k3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add amount_received - nullable (only applicable for cash payments)
    op.add_column('sale_payments',
        sa.Column('amount_received', sa.Numeric(10, 2), nullable=True,
                  comment='Physical amount received from customer (cash only)')
    )

    # Add change_given - nullable (only applicable for cash payments)
    op.add_column('sale_payments',
        sa.Column('change_given', sa.Numeric(10, 2), nullable=True,
                  comment='Change returned to customer (cash only)')
    )


def downgrade() -> None:
    op.drop_column('sale_payments', 'change_given')
    op.drop_column('sale_payments', 'amount_received')
