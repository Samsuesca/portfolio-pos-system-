"""Add print_queue table for cash sale synchronization

Creates print_queue table to manage sales pending print on the
primary thermal printer. Enables multi-device cash sale sync.

Revision ID: h1i2j3k4l5m6
Revises: g0h1i2j3k4l5
Create Date: 2026-01-22

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'h1i2j3k4l5m6'
down_revision: Union[str, None] = 'g0h1i2j3k4l5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create print_queue_status enum
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE print_queue_status_enum AS ENUM (
                'pending', 'printed', 'skipped', 'failed'
            );
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    """)

    # Create print_queue table
    op.create_table(
        'print_queue',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('sale_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('school_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('status', postgresql.ENUM(
            'pending', 'printed', 'skipped', 'failed',
            name='print_queue_status_enum',
            create_type=False
        ), nullable=False, server_default='pending'),
        sa.Column('print_receipt', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('open_drawer', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('sale_code', sa.String(30), nullable=False),
        sa.Column('sale_total', sa.Numeric(10, 2), nullable=False),
        sa.Column('client_name', sa.String(255), nullable=True),
        sa.Column('school_name', sa.String(255), nullable=True),
        sa.Column('source_device', sa.String(100), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('processed_at', sa.DateTime(), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('retry_count', sa.Integer(), nullable=False, server_default='0'),

        # Foreign keys
        sa.ForeignKeyConstraint(['sale_id'], ['sales.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['school_id'], ['schools.id'], ondelete='CASCADE'),
    )

    # Create indexes for efficient querying
    op.create_index('ix_print_queue_sale_id', 'print_queue', ['sale_id'])
    op.create_index('ix_print_queue_school_id', 'print_queue', ['school_id'])
    op.create_index('ix_print_queue_status', 'print_queue', ['status'])
    op.create_index('ix_print_queue_created_at', 'print_queue', ['created_at'])
    # Composite index for pending items query (most common query)
    op.create_index(
        'ix_print_queue_status_created_at',
        'print_queue',
        ['status', 'created_at'],
        postgresql_where=sa.text("status = 'pending'")
    )


def downgrade() -> None:
    # Drop indexes
    op.drop_index('ix_print_queue_status_created_at', table_name='print_queue')
    op.drop_index('ix_print_queue_created_at', table_name='print_queue')
    op.drop_index('ix_print_queue_status', table_name='print_queue')
    op.drop_index('ix_print_queue_school_id', table_name='print_queue')
    op.drop_index('ix_print_queue_sale_id', table_name='print_queue')

    # Drop table
    op.drop_table('print_queue')

    # Drop enum
    op.execute('DROP TYPE IF EXISTS print_queue_status_enum CASCADE')
