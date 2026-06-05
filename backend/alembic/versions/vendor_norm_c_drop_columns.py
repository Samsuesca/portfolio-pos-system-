"""vendor normalization step C: drop old vendor string columns, enforce NOT NULL

Revision ID: vendor_norm_c
Revises: vendor_norm_b
Create Date: 2026-04-13
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text

revision: str = "vendor_norm_c"
down_revision: Union[str, None] = "vendor_norm_b"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Enforce NOT NULL on accounts_payable.vendor_id (vendor was required there)
    op.alter_column("accounts_payable", "vendor_id", nullable=False)

    # Drop old vendor string columns
    op.drop_column("expenses", "vendor")
    op.drop_column("accounts_payable", "vendor")
    op.drop_column("fixed_expenses", "vendor")


def downgrade() -> None:
    # Re-add vendor string columns
    op.add_column("expenses", sa.Column("vendor", sa.String(255), nullable=True))
    op.add_column("accounts_payable", sa.Column("vendor", sa.String(255), nullable=False, server_default=""))
    op.add_column("fixed_expenses", sa.Column("vendor", sa.String(255), nullable=True))

    # Populate from vendor relationship
    op.execute(text("""
        UPDATE expenses SET vendor = v.name
        FROM vendors v WHERE expenses.vendor_id = v.id
    """))
    op.execute(text("""
        UPDATE accounts_payable SET vendor = v.name
        FROM vendors v WHERE accounts_payable.vendor_id = v.id
    """))
    op.execute(text("""
        UPDATE fixed_expenses SET vendor = v.name
        FROM vendors v WHERE fixed_expenses.vendor_id = v.id
    """))

    # Make vendor_id nullable again on accounts_payable
    op.alter_column("accounts_payable", "vendor_id", nullable=True)
