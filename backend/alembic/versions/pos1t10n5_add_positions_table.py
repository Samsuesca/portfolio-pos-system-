"""add positions table and normalize employee positions

Revision ID: pos1t10n5
Revises: 20ec9c1bb001
Create Date: 2026-04-13
"""
from typing import Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'pos1t10n5'
down_revision = ('z0a1b2c3d4e5', 'a3b4c5d6e7f8')
branch_labels: Union[str, None] = None
depends_on: Union[str, None] = None


def upgrade() -> None:
    op.create_table(
        'positions',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('code', sa.String(50), nullable=False),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('sort_order', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('code'),
    )
    op.create_index('ix_positions_code', 'positions', ['code'])

    connection = op.get_bind()

    # Seed default positions
    connection.execute(sa.text("""
        INSERT INTO positions (id, code, name, description, is_active, sort_order, created_at, updated_at)
        VALUES
            (gen_random_uuid(), 'vendedor', 'Vendedor', 'Vendedor de punto de venta', true, 0, NOW(), NOW()),
            (gen_random_uuid(), 'administrador', 'Administrador', 'Administrador del negocio', true, 1, NOW(), NOW()),
            (gen_random_uuid(), 'bodeguista', 'Bodeguista', 'Encargado de bodega e inventario', true, 2, NOW(), NOW()),
            (gen_random_uuid(), 'almacenista', 'Almacenista', 'Encargado de almacén', true, 3, NOW(), NOW()),
            (gen_random_uuid(), 'ceo', 'CEO', 'Director ejecutivo', true, 4, NOW(), NOW()),
            (gen_random_uuid(), 'coo', 'COO', 'Director de operaciones', true, 5, NOW(), NOW())
    """))

    # Normalize existing employee positions to match position codes
    connection.execute(sa.text("""
        UPDATE employees SET position = 'vendedor'
        WHERE LOWER(TRIM(position)) IN ('vendedor', 'vendedor a', 'vendedora')
    """))
    connection.execute(sa.text("""
        UPDATE employees SET position = 'bodeguista'
        WHERE LOWER(TRIM(position)) IN ('bodegista', 'bodeguista')
    """))
    connection.execute(sa.text("""
        UPDATE employees SET position = 'almacenista'
        WHERE LOWER(TRIM(position)) = 'almacenista'
    """))
    connection.execute(sa.text("""
        UPDATE employees SET position = 'ceo'
        WHERE LOWER(TRIM(position)) = 'ceo'
    """))
    connection.execute(sa.text("""
        UPDATE employees SET position = 'coo'
        WHERE LOWER(TRIM(position)) = 'coo'
    """))


def downgrade() -> None:
    op.drop_index('ix_positions_code', table_name='positions')
    op.drop_table('positions')
