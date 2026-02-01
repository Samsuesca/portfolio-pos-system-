"""Add cash micro-permissions and max_daily_count constraint

Revision ID: m1n2o3p4q5r6
Revises: l5m6n7o8p9q0
Create Date: 2026-01-27

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB
import uuid

# revision identifiers, used by Alembic.
revision: str = 'm1n2o3p4q5r6'
down_revision: Union[str, None] = 'l5m6n7o8p9q0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# New permission codes to insert
NEW_PERMISSIONS = [
    {"code": "accounting.open_register", "name": "Abrir caja", "description": "Abrir registro diario de caja", "category": "accounting", "is_sensitive": False},
    {"code": "accounting.close_register", "name": "Cerrar caja", "description": "Cerrar registro diario de caja", "category": "accounting", "is_sensitive": True},
    {"code": "accounting.view_caja_menor", "name": "Ver caja menor", "description": "Ver saldo y resumen de caja menor", "category": "accounting", "is_sensitive": False},
    {"code": "accounting.liquidate_caja_menor", "name": "Liquidar caja menor", "description": "Transferir fondos de caja menor a caja mayor", "category": "accounting", "is_sensitive": True},
    {"code": "accounting.view_liquidation_history", "name": "Ver historial liquidaciones", "description": "Ver historial de liquidaciones de caja menor", "category": "accounting", "is_sensitive": False},
    {"code": "accounting.adjust_balance", "name": "Ajustar saldos", "description": "Ajustar manualmente saldos de cuentas de caja y banco", "category": "accounting", "is_sensitive": True},
    {"code": "accounting.view_daily_flow", "name": "Ver flujo diario", "description": "Ver flujo diario de cuentas (cierre de caja)", "category": "accounting", "is_sensitive": False},
    {"code": "accounting.view_global_balances", "name": "Ver saldos globales", "description": "Ver saldos globales de caja y banco", "category": "accounting", "is_sensitive": False},
    {"code": "cash_drawer.open", "name": "Abrir cajon de caja", "description": "Abrir cajon de caja directamente sin codigo de autorizacion", "category": "cash_drawer", "is_sensitive": False},
]


def upgrade() -> None:
    # 1. Add max_daily_count column to role_permissions
    op.add_column('role_permissions', sa.Column('max_daily_count', sa.Integer(), nullable=True))

    # 2. Add operation_type and metadata_json to drawer_access_codes for generic approvals
    op.add_column('drawer_access_codes', sa.Column('operation_type', sa.String(50), nullable=True, server_default='cash_drawer'))
    op.add_column('drawer_access_codes', sa.Column('metadata_json', JSONB, nullable=True))

    # 3. Insert new permissions (skip cash_drawer.open if it already exists)
    conn = op.get_bind()

    for perm in NEW_PERMISSIONS:
        # Check if permission already exists
        existing = conn.execute(
            sa.text("SELECT id FROM permissions WHERE code = :code"),
            {"code": perm["code"]}
        ).fetchone()

        if not existing:
            conn.execute(
                sa.text("""
                    INSERT INTO permissions (id, code, name, description, category, is_sensitive, created_at)
                    VALUES (:id, :code, :name, :description, :category, :is_sensitive, NOW())
                """),
                {
                    "id": str(uuid.uuid4()),
                    "code": perm["code"],
                    "name": perm["name"],
                    "description": perm["description"],
                    "category": perm["category"],
                    "is_sensitive": perm["is_sensitive"],
                }
            )


def downgrade() -> None:
    # Remove new permissions
    conn = op.get_bind()
    codes = [p["code"] for p in NEW_PERMISSIONS]
    for code in codes:
        conn.execute(
            sa.text("DELETE FROM permissions WHERE code = :code"),
            {"code": code}
        )

    # Remove columns
    op.drop_column('drawer_access_codes', 'metadata_json')
    op.drop_column('drawer_access_codes', 'operation_type')
    op.drop_column('role_permissions', 'max_daily_count')
