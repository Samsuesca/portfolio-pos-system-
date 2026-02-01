"""Add nequi to payment_method_enum and acc_payment_method_enum

Revision ID: i3j4k5l6m7n8
Revises: h2i3j4k5l6m7
Create Date: 2025-12-16

This migration adds 'nequi' as a payment method option to support
Nequi digital wallet payments in Colombia.

Updates:
- payment_method_enum: Used in sales table
- acc_payment_method_enum: Used in transactions and accounting tables
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'i3j4k5l6m7n8'
down_revision: Union[str, None] = 'h2i3j4k5l6m7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add 'NEQUI' value to payment_method_enum (sales)
    # PostgreSQL requires ALTER TYPE ... ADD VALUE
    # Note: Enum values must be UPPERCASE to match Python enum names
    op.execute("""
        DO $$ BEGIN
            ALTER TYPE payment_method_enum ADD VALUE IF NOT EXISTS 'NEQUI';
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    """)

    # Add 'NEQUI' value to acc_payment_method_enum (accounting)
    op.execute("""
        DO $$ BEGIN
            ALTER TYPE acc_payment_method_enum ADD VALUE IF NOT EXISTS 'NEQUI';
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    """)


def downgrade() -> None:
    # Note: PostgreSQL does not support removing values from enums easily.
    # The safest approach is to:
    # 1. Create a new enum without 'nequi'
    # 2. Update columns to use the new enum
    # 3. Drop the old enum
    # 4. Rename the new enum to the old name
    #
    # However, this is destructive if there are rows with 'nequi' value.
    # For safety, we'll just leave a warning and not actually remove the value.
    # In production, you would need to handle this carefully.

    # WARNING: This downgrade does nothing because removing enum values
    # requires data migration. If you need to downgrade, manually:
    # 1. Update any rows with payment_method='nequi' to another value
    # 2. Recreate the enums without 'nequi'
    pass
