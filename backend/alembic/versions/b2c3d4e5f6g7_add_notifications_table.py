"""Add notifications table

Revision ID: b2c3d4e5f6g7
Revises: 2c799e198243
Create Date: 2026-01-12

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers
revision = 'b2c3d4e5f6g7'
down_revision = '2c799e198243'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create NotificationType enum
    notification_type_enum = postgresql.ENUM(
        'new_web_order',
        'new_web_sale',
        'order_status_changed',
        'pqrs_received',
        name='notification_type_enum',
        create_type=False
    )
    notification_type_enum.create(op.get_bind(), checkfirst=True)

    # Create ReferenceType enum
    reference_type_enum = postgresql.ENUM(
        'order',
        'sale',
        'contact',
        name='reference_type_enum',
        create_type=False
    )
    reference_type_enum.create(op.get_bind(), checkfirst=True)

    # Create notifications table
    op.create_table(
        'notifications',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=True),
        sa.Column('type', notification_type_enum, nullable=False),
        sa.Column('title', sa.String(200), nullable=False),
        sa.Column('message', sa.Text(), nullable=False),
        sa.Column('reference_type', reference_type_enum, nullable=True),
        sa.Column('reference_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('school_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('schools.id', ondelete='CASCADE'), nullable=True),
        sa.Column('is_read', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('read_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
    )

    # Create indexes for common queries
    op.create_index('idx_notifications_user_id', 'notifications', ['user_id'])
    op.create_index('idx_notifications_type', 'notifications', ['type'])
    op.create_index('idx_notifications_is_read', 'notifications', ['is_read'])
    op.create_index('idx_notifications_school_id', 'notifications', ['school_id'])
    op.create_index('idx_notifications_reference_id', 'notifications', ['reference_id'])
    op.create_index('idx_notifications_created_at', 'notifications', ['created_at'])

    # Composite index for the most common query pattern (user's unread notifications)
    op.create_index(
        'idx_notifications_user_unread',
        'notifications',
        ['user_id', 'is_read', 'created_at']
    )


def downgrade() -> None:
    # Drop indexes
    op.drop_index('idx_notifications_user_unread', table_name='notifications')
    op.drop_index('idx_notifications_created_at', table_name='notifications')
    op.drop_index('idx_notifications_reference_id', table_name='notifications')
    op.drop_index('idx_notifications_school_id', table_name='notifications')
    op.drop_index('idx_notifications_is_read', table_name='notifications')
    op.drop_index('idx_notifications_type', table_name='notifications')
    op.drop_index('idx_notifications_user_id', table_name='notifications')

    # Drop table
    op.drop_table('notifications')

    # Drop enums
    op.execute('DROP TYPE IF EXISTS notification_type_enum')
    op.execute('DROP TYPE IF EXISTS reference_type_enum')
