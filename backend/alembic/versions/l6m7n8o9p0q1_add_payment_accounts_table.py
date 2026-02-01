"""add payment accounts table

Revision ID: l6m7n8o9p0q1
Revises: k5l6m7n8o9p0
Create Date: 2025-12-16 20:00:00

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
import uuid


# revision identifiers, used by Alembic.
revision = 'l6m7n8o9p0q1'
down_revision = 'k5l6m7n8o9p0'
branch_labels = None
depends_on = None


def upgrade():
    """Add payment_accounts table"""
    op.create_table(
        'payment_accounts',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('method_type', sa.String(50), nullable=False),
        sa.Column('account_name', sa.String(200), nullable=False),
        sa.Column('account_number', sa.String(100), nullable=False),
        sa.Column('account_holder', sa.String(200), nullable=False),
        sa.Column('bank_name', sa.String(100), nullable=True),
        sa.Column('account_type', sa.String(50), nullable=True),
        sa.Column('qr_code_url', sa.String(500), nullable=True),
        sa.Column('instructions', sa.Text(), nullable=True),
        sa.Column('display_order', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('now()'))
    )

    # Create indexes
    op.create_index('idx_payment_accounts_is_active', 'payment_accounts', ['is_active'])
    op.create_index('idx_payment_accounts_display_order', 'payment_accounts', ['display_order'])


def downgrade():
    """Remove payment_accounts table"""
    op.drop_index('idx_payment_accounts_display_order', table_name='payment_accounts')
    op.drop_index('idx_payment_accounts_is_active', table_name='payment_accounts')
    op.drop_table('payment_accounts')
