"""Add caja_menor_config table and transfer permissions

Revision ID: q5r6s7t8u9v0
Revises: p4q5r6s7t8u9
Create Date: 2026-01-27

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'q5r6s7t8u9v0'
down_revision: Union[str, Sequence[str]] = 'p4q5r6s7t8u9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create caja_menor_config table
    op.create_table(
        'caja_menor_config',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), primary_key=True),
        sa.Column('base_amount', sa.Numeric(14, 2), nullable=False, server_default='400000'),
        sa.Column('auto_close_enabled', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('auto_close_time', sa.String(5), nullable=True),
        sa.Column('last_auto_close_at', sa.DateTime(), nullable=True),
        sa.Column('updated_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
    )

    # Insert new permissions
    op.execute("""
        INSERT INTO permissions (id, code, name, description, category, is_sensitive, created_at)
        VALUES
            (gen_random_uuid(), 'accounting.edit_caja_menor_config', 'Editar Config Caja Menor',
             'Permite editar el monto base y configuracion de auto-cierre de Caja Menor',
             'accounting', true, now()),
            (gen_random_uuid(), 'accounting.transfer_between_accounts', 'Transferir entre Cuentas',
             'Permite transferir dinero entre cuentas de balance',
             'accounting', true, now()),
            (gen_random_uuid(), 'accounting.view_transfers', 'Ver Transferencias',
             'Permite ver historial de transferencias entre cuentas',
             'accounting', false, now())
        ON CONFLICT (code) DO NOTHING;
    """)


def downgrade() -> None:
    # Remove permissions
    op.execute("""
        DELETE FROM permissions WHERE code IN (
            'accounting.edit_caja_menor_config',
            'accounting.transfer_between_accounts',
            'accounting.view_transfers'
        );
    """)

    # Drop table
    op.drop_table('caja_menor_config')
