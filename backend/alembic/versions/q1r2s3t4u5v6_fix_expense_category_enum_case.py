"""Fix expense_category_enum case to lowercase

Revision ID: q1r2s3t4u5v6
Revises: p0q1r2s3t4u5
Create Date: 2026-01-05

This migration fixes the mismatch between PostgreSQL enum values (UPPERCASE)
and Python enum values (lowercase).
"""
from typing import Sequence, Union
from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'q1r2s3t4u5v6'
down_revision: Union[str, None] = 'p0q1r2s3t4u5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # PostgreSQL 10+ supports ALTER TYPE ... RENAME VALUE
    # Rename all enum values from UPPERCASE to lowercase
    op.execute("ALTER TYPE expense_category_enum RENAME VALUE 'RENT' TO 'rent'")
    op.execute("ALTER TYPE expense_category_enum RENAME VALUE 'UTILITIES' TO 'utilities'")
    op.execute("ALTER TYPE expense_category_enum RENAME VALUE 'PAYROLL' TO 'payroll'")
    op.execute("ALTER TYPE expense_category_enum RENAME VALUE 'SUPPLIES' TO 'supplies'")
    op.execute("ALTER TYPE expense_category_enum RENAME VALUE 'INVENTORY' TO 'inventory'")
    op.execute("ALTER TYPE expense_category_enum RENAME VALUE 'TRANSPORT' TO 'transport'")
    op.execute("ALTER TYPE expense_category_enum RENAME VALUE 'MAINTENANCE' TO 'maintenance'")
    op.execute("ALTER TYPE expense_category_enum RENAME VALUE 'MARKETING' TO 'marketing'")
    op.execute("ALTER TYPE expense_category_enum RENAME VALUE 'TAXES' TO 'taxes'")
    op.execute("ALTER TYPE expense_category_enum RENAME VALUE 'BANK_FEES' TO 'bank_fees'")
    op.execute("ALTER TYPE expense_category_enum RENAME VALUE 'OTHER' TO 'other'")


def downgrade() -> None:
    # Revert to UPPERCASE
    op.execute("ALTER TYPE expense_category_enum RENAME VALUE 'rent' TO 'RENT'")
    op.execute("ALTER TYPE expense_category_enum RENAME VALUE 'utilities' TO 'UTILITIES'")
    op.execute("ALTER TYPE expense_category_enum RENAME VALUE 'payroll' TO 'PAYROLL'")
    op.execute("ALTER TYPE expense_category_enum RENAME VALUE 'supplies' TO 'SUPPLIES'")
    op.execute("ALTER TYPE expense_category_enum RENAME VALUE 'inventory' TO 'INVENTORY'")
    op.execute("ALTER TYPE expense_category_enum RENAME VALUE 'transport' TO 'TRANSPORT'")
    op.execute("ALTER TYPE expense_category_enum RENAME VALUE 'maintenance' TO 'MAINTENANCE'")
    op.execute("ALTER TYPE expense_category_enum RENAME VALUE 'marketing' TO 'MARKETING'")
    op.execute("ALTER TYPE expense_category_enum RENAME VALUE 'taxes' TO 'TAXES'")
    op.execute("ALTER TYPE expense_category_enum RENAME VALUE 'bank_fees' TO 'BANK_FEES'")
    op.execute("ALTER TYPE expense_category_enum RENAME VALUE 'other' TO 'OTHER'")
