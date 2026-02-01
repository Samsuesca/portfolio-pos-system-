"""Convert expense category from enum to varchar

Changes the expenses.category column from ENUM type to VARCHAR(50)
to support dynamic expense categories from the expense_categories table.

Existing enum values are preserved as strings.

Revision ID: i2j3k4l5m6n7
Revises: h1i2j3k4l5m6
Create Date: 2026-01-22

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'i2j3k4l5m6n7'
down_revision: Union[str, None] = 'h1i2j3k4l5m6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # First, alter the column type from enum to varchar
    # PostgreSQL requires using ALTER TYPE for enum columns
    op.execute("""
        ALTER TABLE expenses
        ALTER COLUMN category TYPE VARCHAR(50)
        USING category::text
    """)

    # Optionally, we can drop the enum type if no longer used elsewhere
    # But let's keep it for safety in case other tables still reference it
    # op.execute("DROP TYPE IF EXISTS expense_category_enum")


def downgrade() -> None:
    # Convert back to enum
    # First ensure all values in the column are valid enum values
    op.execute("""
        ALTER TABLE expenses
        ALTER COLUMN category TYPE expense_category_enum
        USING category::expense_category_enum
    """)
