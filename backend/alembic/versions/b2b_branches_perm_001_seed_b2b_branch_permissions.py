"""Seed B2B + branches permissions into the permissions catalog

Los códigos b2b.* y branches.* se agregaron a SYSTEM_ROLE_PERMISSIONS /
EXTRA_REGISTRY_PERMISSIONS en código, así que los roles de SISTEMA
(viewer/seller/admin/owner) y los superusuarios ya los resuelven. Pero NUNCA se
sembraron en la tabla `permissions`, de modo que:

  - el editor de roles (get_permission_catalog → select(Permission)) no los lista
    como asignables, y
  - un rol CUSTOM no puede recibirlos (no hay fila Permission a la cual enlazar
    via role_permissions).

Esta migración los siembra (idempotente) y los asigna a los custom_roles de
sistema según la jerarquía de SYSTEM_ROLE_PERMISSIONS. Mismo patrón que
glob_prod_perm_001.

Revision ID: b2b_branches_perm_001
Revises: branch_retrofit_001
Create Date: 2026-06-08
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import uuid
from datetime import datetime


revision: str = "b2b_branches_perm_001"
down_revision: Union[str, Sequence[str], None] = "branch_retrofit_001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


NEW_PERMISSIONS = [
    {
        "code": "b2b.view",
        "name": "Ver B2B",
        "description": "Ver cotizaciones, contratos y clientes empresariales (B2B).",
        "category": "b2b",
        "is_sensitive": False,
        "default_system_roles": ["viewer", "seller", "admin"],
    },
    {
        "code": "b2b.manage_quotations",
        "name": "Gestionar cotizaciones B2B",
        "description": "Crear, editar, enviar y cambiar el estado de cotizaciones B2B.",
        "category": "b2b",
        "is_sensitive": False,
        "default_system_roles": ["seller", "admin"],
    },
    {
        "code": "b2b.manage_contracts",
        "name": "Gestionar contratos B2B",
        "description": (
            "Convertir cotizaciones, registrar anticipos, entregas y cobros de "
            "contratos B2B (afecta la contabilidad)."
        ),
        "category": "b2b",
        "is_sensitive": True,
        "default_system_roles": ["admin"],
    },
    {
        "code": "b2b.manage_clients",
        "name": "Gestionar clientes B2B",
        "description": "Crear y editar clientes empresariales (NIT, términos de pago, cupo).",
        "category": "b2b",
        "is_sensitive": True,
        "default_system_roles": ["admin"],
    },
    {
        "code": "b2b.void_contracts",
        "name": "Anular contratos B2B",
        "description": (
            "Cancelar un contrato B2B ya firmado/con anticipo, aplicando la "
            "política de retención. Reversa asientos contables."
        ),
        "category": "b2b",
        "is_sensitive": True,
        "default_system_roles": [],  # solo owner (bypass) o rol custom
    },
    {
        "code": "branches.view",
        "name": "Ver sucursales",
        "description": "Ver el listado/selector de sucursales físicas.",
        "category": "branches",
        "is_sensitive": False,
        "default_system_roles": ["viewer", "seller", "admin"],
    },
    {
        "code": "branches.manage",
        "name": "Gestionar sucursales",
        "description": "Crear, editar y desactivar sucursales físicas.",
        "category": "branches",
        "is_sensitive": True,
        "default_system_roles": ["admin"],
    },
]


def upgrade() -> None:
    conn = op.get_bind()
    now = datetime.utcnow()

    for perm in NEW_PERMISSIONS:
        existing = conn.execute(
            sa.text("SELECT id FROM permissions WHERE code = :code"),
            {"code": perm["code"]},
        ).fetchone()
        if existing:
            perm_id = existing[0]
        else:
            perm_id = str(uuid.uuid4())
            conn.execute(
                sa.text(
                    """
                    INSERT INTO permissions
                        (id, code, name, description, category, is_sensitive, created_at)
                    VALUES
                        (:id, :code, :name, :description, :category, :is_sensitive, :created_at)
                    """
                ),
                {
                    "id": perm_id,
                    "code": perm["code"],
                    "name": perm["name"],
                    "description": perm["description"],
                    "category": perm["category"],
                    "is_sensitive": perm["is_sensitive"],
                    "created_at": now,
                },
            )

        for role_code in perm["default_system_roles"]:
            role = conn.execute(
                sa.text(
                    "SELECT id FROM custom_roles "
                    "WHERE code = :code AND is_system = true AND school_id IS NULL"
                ),
                {"code": role_code},
            ).fetchone()
            if not role:
                continue

            already = conn.execute(
                sa.text(
                    "SELECT 1 FROM role_permissions "
                    "WHERE role_id = :role_id AND permission_id = :perm_id"
                ),
                {"role_id": role[0], "perm_id": perm_id},
            ).fetchone()
            if already:
                continue

            conn.execute(
                sa.text(
                    """
                    INSERT INTO role_permissions
                        (id, role_id, permission_id, requires_approval, created_at)
                    VALUES
                        (:id, :role_id, :perm_id, false, :created_at)
                    """
                ),
                {
                    "id": str(uuid.uuid4()),
                    "role_id": role[0],
                    "perm_id": perm_id,
                    "created_at": now,
                },
            )


def downgrade() -> None:
    conn = op.get_bind()

    for perm in NEW_PERMISSIONS:
        existing = conn.execute(
            sa.text("SELECT id FROM permissions WHERE code = :code"),
            {"code": perm["code"]},
        ).fetchone()
        if not existing:
            continue
        perm_id = existing[0]

        conn.execute(
            sa.text("DELETE FROM role_permissions WHERE permission_id = :perm_id"),
            {"perm_id": perm_id},
        )
        conn.execute(
            sa.text("DELETE FROM permissions WHERE id = :perm_id"),
            {"perm_id": perm_id},
        )
