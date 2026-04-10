"""add budgets table

Revision ID: 456cfdab7656
Revises: 37d300168e7a
Create Date: 2026-03-18 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '456cfdab7656'
down_revision: Union[str, Sequence[str]] = '37d300168e7a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'budgets',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('period_type', sa.String(20), nullable=False),
        sa.Column('period_start', sa.Date(), nullable=False),
        sa.Column('period_end', sa.Date(), nullable=False),
        sa.Column('category', sa.String(100), nullable=False),
        sa.Column('school_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('budgeted_amount', sa.Numeric(14, 2), nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['school_id'], ['schools.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_budgets_period_type', 'budgets', ['period_type'])
    op.create_index('ix_budgets_period_start', 'budgets', ['period_start'])
    op.create_index('ix_budgets_category', 'budgets', ['category'])
    op.create_index('ix_budgets_school_id', 'budgets', ['school_id'])
    op.create_index('ix_budgets_created_by', 'budgets', ['created_by'])


def downgrade() -> None:
    op.drop_index('ix_budgets_created_by', table_name='budgets')
    op.drop_index('ix_budgets_school_id', table_name='budgets')
    op.drop_index('ix_budgets_category', table_name='budgets')
    op.drop_index('ix_budgets_period_start', table_name='budgets')
    op.drop_index('ix_budgets_period_type', table_name='budgets')
    op.drop_table('budgets')
