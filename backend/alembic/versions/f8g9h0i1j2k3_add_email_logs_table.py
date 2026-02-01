"""Add email_logs table for email audit trail

Creates email_logs table to track all email sends
for monitoring and analytics.

Revision ID: f8g9h0i1j2k3
Revises: e7f8g9h0i1j2
Create Date: 2026-01-22

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'f8g9h0i1j2k3'
down_revision: Union[str, None] = 'e7f8g9h0i1j2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create email_type enum
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE email_type_enum AS ENUM (
                'verification', 'welcome', 'password_reset', 'order_confirmation',
                'sale_confirmation', 'activation', 'order_ready', 'welcome_activation',
                'email_change', 'drawer_access'
            );
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    """)

    # Create email_status enum
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE email_status_enum AS ENUM (
                'success', 'failed', 'dev_skipped'
            );
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    """)

    # Create email_logs table
    op.create_table(
        'email_logs',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('email_type', postgresql.ENUM(
            'verification', 'welcome', 'password_reset', 'order_confirmation',
            'sale_confirmation', 'activation', 'order_ready', 'welcome_activation',
            'email_change', 'drawer_access',
            name='email_type_enum',
            create_type=False
        ), nullable=False),
        sa.Column('recipient_email', sa.String(255), nullable=False),
        sa.Column('recipient_name', sa.String(255), nullable=True),
        sa.Column('subject', sa.String(500), nullable=False),
        sa.Column('status', postgresql.ENUM(
            'success', 'failed', 'dev_skipped',
            name='email_status_enum',
            create_type=False
        ), nullable=False),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('reference_code', sa.String(100), nullable=True),
        sa.Column('client_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('order_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('sale_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('triggered_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('sent_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),

        # Foreign keys
        sa.ForeignKeyConstraint(['client_id'], ['clients.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['order_id'], ['orders.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['sale_id'], ['sales.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['triggered_by'], ['users.id'], ondelete='SET NULL'),
    )

    # Create indexes for efficient querying
    op.create_index('ix_email_logs_email_type', 'email_logs', ['email_type'])
    op.create_index('ix_email_logs_recipient_email', 'email_logs', ['recipient_email'])
    op.create_index('ix_email_logs_status', 'email_logs', ['status'])
    op.create_index('ix_email_logs_reference_code', 'email_logs', ['reference_code'])
    op.create_index('ix_email_logs_client_id', 'email_logs', ['client_id'])
    op.create_index('ix_email_logs_order_id', 'email_logs', ['order_id'])
    op.create_index('ix_email_logs_sale_id', 'email_logs', ['sale_id'])
    op.create_index('ix_email_logs_sent_at', 'email_logs', ['sent_at'])


def downgrade() -> None:
    # Drop indexes
    op.drop_index('ix_email_logs_sent_at', table_name='email_logs')
    op.drop_index('ix_email_logs_sale_id', table_name='email_logs')
    op.drop_index('ix_email_logs_order_id', table_name='email_logs')
    op.drop_index('ix_email_logs_client_id', table_name='email_logs')
    op.drop_index('ix_email_logs_reference_code', table_name='email_logs')
    op.drop_index('ix_email_logs_status', table_name='email_logs')
    op.drop_index('ix_email_logs_recipient_email', table_name='email_logs')
    op.drop_index('ix_email_logs_email_type', table_name='email_logs')

    # Drop table
    op.drop_table('email_logs')

    # Drop enums
    op.execute('DROP TYPE IF EXISTS email_status_enum CASCADE')
    op.execute('DROP TYPE IF EXISTS email_type_enum CASCADE')
