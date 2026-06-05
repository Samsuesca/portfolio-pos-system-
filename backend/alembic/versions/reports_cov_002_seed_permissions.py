"""Seed permissions table with reports.* codes from Reports Coverage Expansion.

Three permission codes are referenced by `require_global_permission(...)`
decorators on the new Reports endpoints (added in commits 4ac742d, a5acea5,
and 739ca0e) and listed in `SYSTEM_ROLE_PERMISSIONS` /
`EXTRA_REGISTRY_PERMISSIONS` (app/services/permission.py), but the
`permissions` catalog table was never updated.

QA caught this on backend boot:

    Permission validation warning: Permission codes referenciados en rutas
    pero ausentes en DB (posible typo o seed faltante):
    ['reports.alterations', 'reports.orders']

Today the endpoints work because superusers bypass permission checks
entirely. A non-superuser with a custom role wouldn't be able to be
*assigned* these permissions from the role editor UI (the registry
endpoint reads from `permissions` table for available codes).

This migration inserts the three rows and binds them to ADMIN + OWNER
system roles, matching SYSTEM_ROLE_PERMISSIONS. SELLER and VIEWER do not
get them — the Reports module is admin-tier per the security model.

`reports.cost_visibility` is marked sensitive because absent ↔ COGS
masking semantics: hiding the permission hides margin data, equivalent
to `inventory.view_cost` and `sales.view_cost` (both also sensitive).

Revision ID: reports_cov_002
Revises: reports_cov_001
Create Date: 2026-05-24
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import uuid
from datetime import datetime


revision: str = "reports_cov_002"
# Originally branched off reports_cov_001, but gender_norm_001 +
# cost_change_001 were merged on top in a parallel session — re-parent so
# the migration chain stays linear and `alembic upgrade head` is
# unambiguous on dev / prod boxes.
down_revision: Union[str, Sequence[str], None] = "cost_change_001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


NEW_PERMISSIONS = [
    {
        "code": "reports.orders",
        "name": "Reportes de Encargos",
        "description": (
            "Ver agregaciones operativas de encargos: resumen, embudo de "
            "estados, cumplimiento de entregas, top productos y clientes."
        ),
        "category": "reports",
        "is_sensitive": False,
        "default_system_roles": ["admin", "owner"],
    },
    {
        "code": "reports.alterations",
        "name": "Reportes de Arreglos",
        "description": (
            "Ver agregaciones de arreglos por periodo: resumen filtrado "
            "por fecha, tiempo de respuesta, top tipos. (Distinto de "
            "alterations.view, que es el listado operativo del modulo.)"
        ),
        "category": "reports",
        "is_sensitive": False,
        "default_system_roles": ["admin", "owner"],
    },
    {
        "code": "reports.cost_visibility",
        "name": "Ver costos y margenes en reportes",
        "description": (
            "Cuando este permiso falta, los reportes ocultan columnas de "
            "COGS, utilidad bruta y margen — solo se muestran ingresos y "
            "conteos. Analogo a inventory.view_cost a nivel de reportes "
            "consolidados."
        ),
        "category": "reports",
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
