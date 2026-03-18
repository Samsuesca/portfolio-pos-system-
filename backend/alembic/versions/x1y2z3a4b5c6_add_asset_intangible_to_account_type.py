"""Add asset_intangible to account_type enum

Revision ID: x1y2z3a4b5c6
Revises: 20d0ed915197
Create Date: 2026-02-26 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'x1y2z3a4b5c6'
down_revision: Union[str, None] = '20d0ed915197'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add 'asset_intangible' to the account_type_enum PostgreSQL enum
    # Note: Must use uppercase to match existing enum convention (ASSET_CURRENT, ASSET_FIXED, etc.)
    op.execute("ALTER TYPE account_type_enum ADD VALUE IF NOT EXISTS 'ASSET_INTANGIBLE'")


def downgrade() -> None:
    # PostgreSQL does not support removing values from enums directly.
    # To downgrade, you would need to recreate the enum type without this value.
    # This is intentionally left as a no-op since removing enum values
    # requires recreating the type and all dependent columns.
    pass
