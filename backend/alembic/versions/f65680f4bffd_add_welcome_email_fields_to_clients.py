"""add_welcome_email_fields_to_clients

Revision ID: f65680f4bffd
Revises: 5b06501ab9aa
Create Date: 2026-01-12 16:15:53.301998

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'f65680f4bffd'
down_revision = '5b06501ab9aa'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add welcome email tracking fields to clients table
    op.add_column('clients', sa.Column('welcome_email_sent', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('clients', sa.Column('welcome_email_sent_at', sa.DateTime(), nullable=True))


def downgrade() -> None:
    op.drop_column('clients', 'welcome_email_sent_at')
    op.drop_column('clients', 'welcome_email_sent')
