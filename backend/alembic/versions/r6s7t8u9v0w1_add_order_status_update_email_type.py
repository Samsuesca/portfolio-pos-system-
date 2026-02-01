"""Add order_status_update to email_type_enum

Revision ID: r6s7t8u9v0w1
Revises: q5r6s7t8u9v0
Create Date: 2026-01-27

"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'r6s7t8u9v0w1'
down_revision: str = 'q5r6s7t8u9v0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE email_type_enum ADD VALUE IF NOT EXISTS 'order_status_update'")


def downgrade() -> None:
    # PostgreSQL does not support removing values from an enum type
    # The value will remain but be unused after downgrade
    pass
