"""Add notification preference to clients for WhatsApp integration

Revision ID: c9d0e1f2a3b4
Revises: b8d918cf1a56
Create Date: 2026-01-19

Adds notification preference field to clients table to support
multi-channel notifications (email + WhatsApp).
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'c9d0e1f2a3b4'
down_revision = 'b8d918cf1a56'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create notification preference enum
    notification_preference_enum = postgresql.ENUM(
        'auto', 'email', 'whatsapp', 'both', 'none',
        name='notification_preference_enum',
        create_type=False
    )
    notification_preference_enum.create(op.get_bind(), checkfirst=True)

    # Add notification_preference column to clients
    # Default is 'auto' - uses available channels based on client data
    op.add_column(
        'clients',
        sa.Column(
            'notification_preference',
            sa.Enum('auto', 'email', 'whatsapp', 'both', 'none', name='notification_preference_enum'),
            nullable=False,
            server_default='auto'
        )
    )

    # Add whatsapp_opted_in for explicit consent tracking
    op.add_column(
        'clients',
        sa.Column(
            'whatsapp_opted_in',
            sa.Boolean(),
            nullable=False,
            server_default='false'
        )
    )


def downgrade() -> None:
    op.drop_column('clients', 'whatsapp_opted_in')
    op.drop_column('clients', 'notification_preference')

    # Drop enum type
    op.execute('DROP TYPE IF EXISTS notification_preference_enum')
