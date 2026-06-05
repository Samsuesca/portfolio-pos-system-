"""add google oauth fields

Revision ID: b1c2d3e4f5a6
Revises: a4b5c6d7e8f9
Create Date: 2026-04-10 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'b1c2d3e4f5a6'
down_revision: Union[str, None] = 'a4b5c6d7e8f9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Users table
    op.add_column('users', sa.Column('google_id', sa.String(255), nullable=True))
    op.add_column('users', sa.Column('auth_provider', sa.String(20), server_default='local', nullable=True))
    op.create_index('ix_users_google_id', 'users', ['google_id'], unique=True)
    op.alter_column('users', 'hashed_password', existing_type=sa.String(255), nullable=True)

    # Clients table
    op.add_column('clients', sa.Column('google_id', sa.String(255), nullable=True))
    op.add_column('clients', sa.Column('auth_provider', sa.String(20), server_default='local', nullable=True))
    op.create_index('ix_clients_google_id', 'clients', ['google_id'], unique=True)


def downgrade() -> None:
    # Clients table
    op.drop_index('ix_clients_google_id', table_name='clients')
    op.drop_column('clients', 'auth_provider')
    op.drop_column('clients', 'google_id')

    # Users table
    op.alter_column('users', 'hashed_password', existing_type=sa.String(255), nullable=False)
    op.drop_index('ix_users_google_id', table_name='users')
    op.drop_column('users', 'auth_provider')
    op.drop_column('users', 'google_id')
