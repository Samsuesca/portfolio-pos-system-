"""add payment_transactions table

Revision ID: 768f87bbdaf5
Revises: x1y2z3a4b5c6
Create Date: 2026-03-15 08:17:58.601375

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = '768f87bbdaf5'
down_revision = 'x1y2z3a4b5c6'
branch_labels = None
depends_on = None


# Define the enum outside of sa.Enum to avoid auto-creation
wompi_status_enum = postgresql.ENUM(
    'PENDING', 'APPROVED', 'DECLINED', 'VOIDED', 'ERROR',
    name='wompi_transaction_status_enum',
    create_type=False,
)


def upgrade() -> None:
    # 1. Create the wompi_transaction_status_enum type (idempotent)
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'wompi_transaction_status_enum') THEN
                CREATE TYPE wompi_transaction_status_enum AS ENUM (
                    'PENDING', 'APPROVED', 'DECLINED', 'VOIDED', 'ERROR'
                );
            END IF;
        END$$;
    """)

    # 2. Create the payment_transactions table
    op.create_table(
        'payment_transactions',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('reference', sa.String(length=100), nullable=False),
        sa.Column('wompi_transaction_id', sa.String(length=100), nullable=True),
        sa.Column('order_id', sa.UUID(), nullable=True),
        sa.Column('receivable_id', sa.UUID(), nullable=True),
        sa.Column('school_id', sa.UUID(), nullable=True),
        sa.Column('client_id', sa.UUID(), nullable=True),
        sa.Column('amount_in_cents', sa.Integer(), nullable=False),
        sa.Column('currency', sa.String(length=3), nullable=False),
        sa.Column('status', wompi_status_enum, nullable=False),
        sa.Column('payment_method_type', sa.String(length=50), nullable=True),
        sa.Column('status_message', sa.Text(), nullable=True),
        sa.Column('wompi_response_data', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('integrity_signature', sa.String(length=128), nullable=False),
        sa.Column('accounting_applied', sa.Boolean(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.Column('completed_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['order_id'], ['orders.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['receivable_id'], ['accounts_receivable.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['school_id'], ['schools.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['client_id'], ['clients.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )

    # 3. Create indexes
    op.create_index(
        op.f('ix_payment_transactions_reference'),
        'payment_transactions', ['reference'], unique=True,
    )
    op.create_index(
        op.f('ix_payment_transactions_wompi_transaction_id'),
        'payment_transactions', ['wompi_transaction_id'], unique=False,
    )
    op.create_index(
        op.f('ix_payment_transactions_order_id'),
        'payment_transactions', ['order_id'], unique=False,
    )
    op.create_index(
        op.f('ix_payment_transactions_receivable_id'),
        'payment_transactions', ['receivable_id'], unique=False,
    )
    op.create_index(
        op.f('ix_payment_transactions_school_id'),
        'payment_transactions', ['school_id'], unique=False,
    )
    op.create_index(
        op.f('ix_payment_transactions_status'),
        'payment_transactions', ['status'], unique=False,
    )


def downgrade() -> None:
    # Drop indexes (implicit with table drop, but explicit for clarity)
    op.drop_index(op.f('ix_payment_transactions_status'), table_name='payment_transactions')
    op.drop_index(op.f('ix_payment_transactions_school_id'), table_name='payment_transactions')
    op.drop_index(op.f('ix_payment_transactions_receivable_id'), table_name='payment_transactions')
    op.drop_index(op.f('ix_payment_transactions_order_id'), table_name='payment_transactions')
    op.drop_index(op.f('ix_payment_transactions_wompi_transaction_id'), table_name='payment_transactions')
    op.drop_index(op.f('ix_payment_transactions_reference'), table_name='payment_transactions')

    # Drop table
    op.drop_table('payment_transactions')

    # Drop enum type
    op.execute("DROP TYPE IF EXISTS wompi_transaction_status_enum")
