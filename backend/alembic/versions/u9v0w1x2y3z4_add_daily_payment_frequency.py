"""Add daily payment frequency enum value

Revision ID: u9v0w1x2y3z4
Revises: t8u9v0w1x2y3
Create Date: 2026-02-01

"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'u9v0w1x2y3z4'
down_revision: str = 't8u9v0w1x2y3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add 'daily' value to payment_frequency_enum
    op.execute("ALTER TYPE payment_frequency_enum ADD VALUE IF NOT EXISTS 'daily'")


def downgrade() -> None:
    # Note: PostgreSQL doesn't support removing enum values easily
    # This would require recreating the entire enum and updating all references
    pass
