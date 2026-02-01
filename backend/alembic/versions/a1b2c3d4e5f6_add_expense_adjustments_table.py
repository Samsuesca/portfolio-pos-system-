"""Add expense_adjustments table for rollbacks

Revision ID: a1b2c3d4e5f6
Revises: z0a1b2c3d4e5
Create Date: 2026-01-12

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers
revision = 'a1b2c3d4e5f6'
down_revision = 'z0a1b2c3d4e5'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Create adjustment_reason enum type (if not exists)
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE adjustment_reason_enum AS ENUM (
                'amount_correction',
                'account_correction',
                'both_correction',
                'error_reversal',
                'partial_refund'
            );
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    """)

    # 2. Create expense_adjustments table
    # Use raw SQL to reference existing enum type to avoid SQLAlchemy trying to create it
    op.execute("""
        CREATE TABLE expense_adjustments (
            id UUID PRIMARY KEY,
            expense_id UUID NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,

            reason adjustment_reason_enum NOT NULL,
            description VARCHAR(500) NOT NULL,

            previous_amount NUMERIC(12, 2) NOT NULL,
            previous_amount_paid NUMERIC(12, 2) NOT NULL,
            previous_payment_method VARCHAR(20),
            previous_payment_account_id UUID REFERENCES balance_accounts(id) ON DELETE SET NULL,

            new_amount NUMERIC(12, 2) NOT NULL,
            new_amount_paid NUMERIC(12, 2) NOT NULL,
            new_payment_method VARCHAR(20),
            new_payment_account_id UUID REFERENCES balance_accounts(id) ON DELETE SET NULL,

            adjustment_delta NUMERIC(12, 2) NOT NULL,

            refund_entry_id UUID REFERENCES balance_entries(id) ON DELETE SET NULL,
            new_payment_entry_id UUID REFERENCES balance_entries(id) ON DELETE SET NULL,

            adjusted_by UUID REFERENCES users(id) ON DELETE SET NULL,
            adjusted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
    """)

    # 3. Create indexes for common queries
    op.execute("CREATE INDEX ix_expense_adjustments_expense_id ON expense_adjustments(expense_id);")
    op.execute("CREATE INDEX ix_expense_adjustments_adjusted_at ON expense_adjustments(adjusted_at);")
    op.execute("CREATE INDEX ix_expense_adjustments_reason ON expense_adjustments(reason);")


def downgrade() -> None:
    # 1. Drop indexes
    op.execute("DROP INDEX IF EXISTS ix_expense_adjustments_reason;")
    op.execute("DROP INDEX IF EXISTS ix_expense_adjustments_adjusted_at;")
    op.execute("DROP INDEX IF EXISTS ix_expense_adjustments_expense_id;")

    # 2. Drop table
    op.execute("DROP TABLE IF EXISTS expense_adjustments;")

    # 3. Drop enum type
    op.execute("DROP TYPE IF EXISTS adjustment_reason_enum;")
