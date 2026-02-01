"""Add worked_days and daily_rate to payroll_items

Revision ID: v0w1x2y3z4a5
Revises: u9v0w1x2y3z4
Create Date: 2026-02-01

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'v0w1x2y3z4a5'
down_revision: str = 'u9v0w1x2y3z4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('payroll_items', sa.Column('worked_days', sa.Integer(), nullable=True))
    op.add_column('payroll_items', sa.Column('daily_rate', sa.Numeric(15, 2), nullable=True))


def downgrade() -> None:
    op.drop_column('payroll_items', 'daily_rate')
    op.drop_column('payroll_items', 'worked_days')
