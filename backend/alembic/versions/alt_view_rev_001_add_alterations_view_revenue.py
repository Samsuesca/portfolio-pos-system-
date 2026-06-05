"""Add alterations.view_revenue permission

Gates the historical income totals (total_revenue, total_pending_payment)
on the alterations dashboard summary endpoint. Mirrors `sales.view_cost`
in spirit: counts and operational data remain visible to all alterations
viewers; aggregated financial figures are restricted.

Defaults to admin and owner system roles.

Revision ID: alt_view_rev_001
Revises: glob_prod_perm_001
Create Date: 2026-05-03
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import uuid
from datetime import datetime


revision: str = "alt_view_rev_001"
down_revision: Union[str, Sequence[str], None] = "glob_prod_perm_001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


NEW_PERMISSION = {
    "code": "alterations.view_revenue",
    "name": "Ver ingresos de arreglos",
    "description": "Ver ingresos historicos y saldos pendientes agregados en el dashboard de arreglos",
    "category": "alterations",
    "is_sensitive": True,
    "default_system_roles": ["admin", "owner"],
}


def upgrade() -> None:
    conn = op.get_bind()
    now = datetime.utcnow()

    existing = conn.execute(
        sa.text("SELECT id FROM permissions WHERE code = :code"),
        {"code": NEW_PERMISSION["code"]},
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
                "code": NEW_PERMISSION["code"],
                "name": NEW_PERMISSION["name"],
                "description": NEW_PERMISSION["description"],
                "category": NEW_PERMISSION["category"],
                "is_sensitive": NEW_PERMISSION["is_sensitive"],
                "created_at": now,
            },
        )

    for role_code in NEW_PERMISSION["default_system_roles"]:
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

    existing = conn.execute(
        sa.text("SELECT id FROM permissions WHERE code = :code"),
        {"code": NEW_PERMISSION["code"]},
    ).fetchone()
    if not existing:
        return
    perm_id = existing[0]

    conn.execute(
        sa.text("DELETE FROM role_permissions WHERE permission_id = :perm_id"),
        {"perm_id": perm_id},
    )
    conn.execute(
        sa.text("DELETE FROM permissions WHERE id = :perm_id"),
        {"perm_id": perm_id},
    )
