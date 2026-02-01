"""Add advanced recurrence system to fixed_expenses

Revision ID: z0a1b2c3d4e5
Revises: y9z0a1b2c3d4
Create Date: 2026-01-12

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers
revision = 'z0a1b2c3d4e5'
down_revision = 'y9z0a1b2c3d4'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Create new enum types (if not exist)
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE recurrence_frequency_enum AS ENUM ('daily', 'weekly', 'monthly', 'yearly');
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    """)

    op.execute("""
        DO $$ BEGIN
            CREATE TYPE month_day_type_enum AS ENUM ('specific', 'last_day', 'first_weekday', 'last_weekday');
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    """)

    # 2. Add new columns to fixed_expenses
    op.add_column('fixed_expenses', sa.Column(
        'recurrence_frequency',
        sa.Enum('daily', 'weekly', 'monthly', 'yearly', name='recurrence_frequency_enum'),
        nullable=True
    ))

    op.add_column('fixed_expenses', sa.Column(
        'recurrence_interval',
        sa.Integer(),
        nullable=True,
        server_default='1'
    ))

    op.add_column('fixed_expenses', sa.Column(
        'recurrence_weekdays',
        postgresql.JSON(astext_type=sa.Text()),
        nullable=True
    ))

    op.add_column('fixed_expenses', sa.Column(
        'recurrence_month_days',
        postgresql.JSON(astext_type=sa.Text()),
        nullable=True
    ))

    op.add_column('fixed_expenses', sa.Column(
        'recurrence_month_day_type',
        sa.Enum('specific', 'last_day', 'first_weekday', 'last_weekday', name='month_day_type_enum'),
        nullable=True
    ))

    op.add_column('fixed_expenses', sa.Column(
        'recurrence_months',
        postgresql.JSON(astext_type=sa.Text()),
        nullable=True
    ))

    op.add_column('fixed_expenses', sa.Column(
        'recurrence_start_date',
        sa.Date(),
        nullable=True
    ))

    op.add_column('fixed_expenses', sa.Column(
        'recurrence_end_date',
        sa.Date(),
        nullable=True
    ))

    op.add_column('fixed_expenses', sa.Column(
        'recurrence_max_occurrences',
        sa.Integer(),
        nullable=True
    ))

    op.add_column('fixed_expenses', sa.Column(
        'recurrence_occurrences_generated',
        sa.Integer(),
        nullable=False,
        server_default='0'
    ))

    # 3. Make legacy frequency nullable (for new records using new system)
    op.alter_column('fixed_expenses', 'frequency',
        existing_type=sa.Enum('weekly', 'biweekly', 'monthly', 'quarterly', 'yearly', name='expense_frequency_enum'),
        nullable=True
    )

    # 4. Create index for new frequency column
    op.create_index(
        'ix_fixed_expenses_recurrence_frequency',
        'fixed_expenses',
        ['recurrence_frequency']
    )


def downgrade() -> None:
    # 1. Drop index
    op.drop_index('ix_fixed_expenses_recurrence_frequency', 'fixed_expenses')

    # 2. Remove new columns
    columns_to_drop = [
        'recurrence_frequency',
        'recurrence_interval',
        'recurrence_weekdays',
        'recurrence_month_days',
        'recurrence_month_day_type',
        'recurrence_months',
        'recurrence_start_date',
        'recurrence_end_date',
        'recurrence_max_occurrences',
        'recurrence_occurrences_generated',
    ]
    for col in columns_to_drop:
        op.drop_column('fixed_expenses', col)

    # 3. Make frequency NOT NULL again
    # First, ensure all records have a frequency
    op.execute("""
        UPDATE fixed_expenses
        SET frequency = 'monthly'
        WHERE frequency IS NULL
    """)
    op.alter_column('fixed_expenses', 'frequency',
        existing_type=sa.Enum('weekly', 'biweekly', 'monthly', 'quarterly', 'yearly', name='expense_frequency_enum'),
        nullable=False
    )

    # 4. Drop enum types (optional, keeping them doesn't hurt)
    # op.execute("DROP TYPE IF EXISTS month_day_type_enum")
    # op.execute("DROP TYPE IF EXISTS recurrence_frequency_enum")
