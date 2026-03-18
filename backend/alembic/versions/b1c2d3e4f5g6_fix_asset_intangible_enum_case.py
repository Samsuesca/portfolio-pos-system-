"""Fix asset_intangible enum case to ASSET_INTANGIBLE

The original migration x1y2z3a4b5c6 added the value in lowercase
('asset_intangible') but all other enum values use UPPERCASE convention.
This caused SQLAlchemy queries to fail with:
  invalid input value for enum account_type_enum: "ASSET_INTANGIBLE"

Revision ID: b1c2d3e4f5g6
Revises: a3b4c5d6e7f8
Create Date: 2026-03-16 14:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
from sqlalchemy import text


# revision identifiers, used by Alembic.
revision: str = 'b1c2d3e4f5g6'
down_revision: Union[str, None] = 'a3b4c5d6e7f8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    # Check if lowercase version exists before renaming
    result = conn.execute(text(
        "SELECT 1 FROM pg_enum WHERE enumlabel = 'asset_intangible' "
        "AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'account_type_enum')"
    ))
    if result.scalar():
        conn.execute(text(
            "ALTER TYPE account_type_enum RENAME VALUE 'asset_intangible' TO 'ASSET_INTANGIBLE'"
        ))


def downgrade() -> None:
    conn = op.get_bind()
    result = conn.execute(text(
        "SELECT 1 FROM pg_enum WHERE enumlabel = 'ASSET_INTANGIBLE' "
        "AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'account_type_enum')"
    ))
    if result.scalar():
        conn.execute(text(
            "ALTER TYPE account_type_enum RENAME VALUE 'ASSET_INTANGIBLE' TO 'asset_intangible'"
        ))
