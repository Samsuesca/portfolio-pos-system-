"""Add missing route permissions detected by startup audit

Five permission codes are referenced via `require_permission(...)` /
`require_global_permission(...)` decorators in route files but were never
inserted into the `permissions` catalog table. The startup permission audit
warns:

    Permission validation warning: Permission codes referenciados en rutas
    pero ausentes en DB (posible typo o seed faltante):
    ['catalog.manage', 'catalog.view', 'costs.manage_templates',
     'employees.manage', 'payroll.manage']

This migration registers them and assigns to system roles consistent with
SYSTEM_ROLE_PERMISSIONS in app/services/permission.py.

Revision ID: perm_audit_001
Revises: v3codes001
Create Date: 2026-05-04
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import uuid
from datetime import datetime


revision: str = "perm_audit_001"
down_revision: Union[str, Sequence[str], None] = "v3codes001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


NEW_PERMISSIONS = [
    {
        "code": "catalog.view",
        "name": "Ver catálogo",
        "description": "Ver el catálogo de productos, talles y precios",
        "category": "catalog",
        "is_sensitive": False,
        "default_system_roles": ["viewer", "seller", "admin", "owner"],
    },
    {
        "code": "catalog.manage",
        "name": "Gestionar catálogo",
        "description": "Crear y editar entradas del catálogo (precios, talles, asignación)",
        "category": "catalog",
        "is_sensitive": False,
        "default_system_roles": ["admin", "owner"],
    },
    {
        "code": "costs.manage_templates",
        "name": "Gestionar templates de costos",
        "description": "Crear y editar plantillas de componentes de costo para productos",
        "category": "costs",
        "is_sensitive": False,
        "default_system_roles": ["admin", "owner"],
    },
    {
        "code": "employees.manage",
        "name": "Gestionar empleados",
        "description": "Crear, editar y eliminar empleados, bonos y registros laborales",
        "category": "employees",
        "is_sensitive": False,
        "default_system_roles": ["admin", "owner"],
    },
    {
        "code": "payroll.manage",
        "name": "Gestionar nómina",
        "description": "Configurar y procesar la nómina del personal (salarios, deducciones, períodos)",
        "category": "payroll",
        "is_sensitive": True,
        "default_system_roles": ["admin", "owner"],
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
