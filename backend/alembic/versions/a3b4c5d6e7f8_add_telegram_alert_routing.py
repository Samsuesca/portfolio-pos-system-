"""add telegram alert routing

Revision ID: a3b4c5d6e7f8
Revises: 86f897bcfacd
Create Date: 2026-03-15 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


# revision identifiers, used by Alembic.
revision: str = "a3b4c5d6e7f8"
down_revision: Union[str, None] = "86f897bcfacd"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create enum type via raw SQL (avoids SQLAlchemy double-create issues)
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE telegram_alert_type_enum AS ENUM (
                'sale_created', 'web_order_created', 'order_status_changed',
                'low_stock', 'expense_created', 'expense_paid',
                'wompi_payment', 'pqrs_received', 'attendance_alert',
                'cash_drawer_access', 'reminder_close_cash', 'reminder_pending_expenses',
                'reminder_overdue_receivables', 'reminder_orders_ready',
                'reminder_weekly_summary', 'system_health', 'daily_digest'
            );
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$;
    """)

    # Add telegram_chat_id column to users table
    op.add_column(
        "users",
        sa.Column("telegram_chat_id", sa.String(50), nullable=True),
    )

    # Create telegram_alert_subscriptions table via raw SQL
    op.execute("""
        CREATE TABLE telegram_alert_subscriptions (
            id UUID PRIMARY KEY,
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            alert_type telegram_alert_type_enum NOT NULL,
            is_active BOOLEAN NOT NULL DEFAULT true,
            created_at TIMESTAMP NOT NULL,
            CONSTRAINT uq_user_alert_type UNIQUE (user_id, alert_type)
        );
    """)

    # Create indexes
    op.execute("CREATE INDEX ix_telegram_sub_user_id ON telegram_alert_subscriptions (user_id);")
    op.execute("CREATE INDEX ix_telegram_sub_alert_type ON telegram_alert_subscriptions (alert_type);")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_telegram_sub_alert_type;")
    op.execute("DROP INDEX IF EXISTS ix_telegram_sub_user_id;")
    op.execute("DROP TABLE IF EXISTS telegram_alert_subscriptions;")
    op.drop_column("users", "telegram_chat_id")
    op.execute("DROP TYPE IF EXISTS telegram_alert_type_enum;")
