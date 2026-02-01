"""add_debt_payment_schedule

Revision ID: b4f40f2b4bc1
Revises: e1f2g3h4i5j6
Create Date: 2026-01-20 21:04:01.982766

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = 'b4f40f2b4bc1'
down_revision = 'e1f2g3h4i5j6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Check if enum type exists, create if not
    conn = op.get_bind()
    result = conn.execute(sa.text(
        "SELECT 1 FROM pg_type WHERE typname = 'debt_payment_status_enum'"
    ))
    if not result.fetchone():
        # Create the enum type
        op.execute(
            "CREATE TYPE debt_payment_status_enum AS ENUM ('pending', 'paid', 'overdue', 'cancelled')"
        )

    # Create debt_payment_schedule table
    op.create_table('debt_payment_schedule',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('description', sa.String(length=500), nullable=False),
        sa.Column('creditor', sa.String(length=255), nullable=True),
        sa.Column('amount', sa.Numeric(precision=14, scale=2), nullable=False),
        sa.Column('due_date', sa.Date(), nullable=False),
        sa.Column('is_recurring', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('recurrence_day', sa.Integer(), nullable=True),
        sa.Column('status', postgresql.ENUM('pending', 'paid', 'overdue', 'cancelled', name='debt_payment_status_enum', create_type=False), nullable=False, server_default='pending'),
        sa.Column('paid_date', sa.Date(), nullable=True),
        sa.Column('paid_amount', sa.Numeric(precision=14, scale=2), nullable=True),
        sa.Column('payment_method', sa.String(length=20), nullable=True),
        sa.Column('payment_account_id', sa.UUID(), nullable=True),
        sa.Column('balance_account_id', sa.UUID(), nullable=True),
        sa.Column('accounts_payable_id', sa.UUID(), nullable=True),
        sa.Column('category', sa.String(length=100), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_by', sa.UUID(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.CheckConstraint('amount > 0', name='chk_debt_amount_positive'),
        sa.CheckConstraint('recurrence_day IS NULL OR (recurrence_day >= 1 AND recurrence_day <= 28)', name='chk_recurrence_day_valid'),
        sa.ForeignKeyConstraint(['accounts_payable_id'], ['accounts_payable.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['balance_account_id'], ['balance_accounts.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['payment_account_id'], ['balance_accounts.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_debt_payment_schedule_due_date'), 'debt_payment_schedule', ['due_date'], unique=False)
    op.create_index(op.f('ix_debt_payment_schedule_status'), 'debt_payment_schedule', ['status'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_debt_payment_schedule_status'), table_name='debt_payment_schedule')
    op.drop_index(op.f('ix_debt_payment_schedule_due_date'), table_name='debt_payment_schedule')
    op.drop_table('debt_payment_schedule')
    op.execute('DROP TYPE IF EXISTS debt_payment_status_enum')
