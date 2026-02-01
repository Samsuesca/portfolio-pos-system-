"""add_email_verification_and_drawer_access_tables

Revision ID: 3543b0efb39c
Revises: b4f40f2b4bc1
Create Date: 2026-01-20 21:49:37.805526

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '3543b0efb39c'
down_revision = 'b4f40f2b4bc1'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create drawer_access_codes table
    op.create_table('drawer_access_codes',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('code', sa.String(length=6), nullable=False),
        sa.Column('requested_by_id', sa.UUID(), nullable=False),
        sa.Column('expires_at', sa.DateTime(), nullable=False),
        sa.Column('used_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['requested_by_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_drawer_access_codes_code'), 'drawer_access_codes', ['code'], unique=False)

    # Create email_verification_tokens table
    op.create_table('email_verification_tokens',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('new_email', sa.String(length=255), nullable=False),
        sa.Column('token', sa.String(length=64), nullable=False),
        sa.Column('expires_at', sa.DateTime(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_email_verification_tokens_token'), 'email_verification_tokens', ['token'], unique=True)


def downgrade() -> None:
    op.drop_index(op.f('ix_email_verification_tokens_token'), table_name='email_verification_tokens')
    op.drop_table('email_verification_tokens')
    op.drop_index(op.f('ix_drawer_access_codes_code'), table_name='drawer_access_codes')
    op.drop_table('drawer_access_codes')
