"""Add discounts expense category and financial_snapshots table

Creates:
- New expense category: 'discounts' (Descuentos) for customer discounts
  Treated as revenue deduction in the Income Statement
- New table: financial_snapshots for saving ER/BG snapshots over time

Revision ID: p4q5r6s7t8u9
Revises: o3p4q5r6s7t8
Create Date: 2026-01-27

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import uuid
from datetime import datetime

# revision identifiers, used by Alembic.
revision: str = 'p4q5r6s7t8u9'
down_revision: Union[str, Sequence[str]] = 'o3p4q5r6s7t9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Insert 'discounts' expense category
    expense_categories = sa.table(
        'expense_categories',
        sa.column('id', sa.dialects.postgresql.UUID),
        sa.column('code', sa.String),
        sa.column('name', sa.String),
        sa.column('description', sa.String),
        sa.column('color', sa.String),
        sa.column('icon', sa.String),
        sa.column('is_system', sa.Boolean),
        sa.column('is_active', sa.Boolean),
        sa.column('display_order', sa.Integer),
        sa.column('created_at', sa.DateTime),
        sa.column('updated_at', sa.DateTime),
    )

    now = datetime.utcnow()

    op.bulk_insert(expense_categories, [
        {
            "id": str(uuid.uuid4()),
            "code": "discounts",
            "name": "Descuentos",
            "description": "Descuentos otorgados a clientes. Se restan de ingresos brutos en el Estado de Resultados.",
            "color": "#F59E0B",
            "icon": "percent",
            "is_system": True,
            "is_active": True,
            "display_order": 17,
            "created_at": now,
            "updated_at": now,
        }
    ])

    # 2. Create financial_snapshots table
    op.create_table(
        'financial_snapshots',
        sa.Column('id', sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('snapshot_type', sa.String(20), nullable=False),  # "balance_sheet" | "income_statement"
        sa.Column('snapshot_date', sa.Date, nullable=False),
        sa.Column('period_start', sa.Date, nullable=True),  # For ER only
        sa.Column('period_end', sa.Date, nullable=True),  # For ER only
        sa.Column('data', sa.JSON, nullable=False),
        sa.Column('notes', sa.String(500), nullable=True),
        sa.Column('created_by', sa.dialects.postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('users.id'), nullable=True),
        sa.Column('created_at', sa.DateTime, nullable=False),
    )

    op.create_index('ix_financial_snapshots_type', 'financial_snapshots', ['snapshot_type'])
    op.create_index('ix_financial_snapshots_date', 'financial_snapshots', ['snapshot_date'])


def downgrade() -> None:
    op.drop_index('ix_financial_snapshots_date', table_name='financial_snapshots')
    op.drop_index('ix_financial_snapshots_type', table_name='financial_snapshots')
    op.drop_table('financial_snapshots')

    op.execute("DELETE FROM expense_categories WHERE code = 'discounts'")
