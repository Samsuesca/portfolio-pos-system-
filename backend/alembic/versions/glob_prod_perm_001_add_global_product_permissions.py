"""Add granular permissions for global product mutations

Replaces the binary `require_superuser` gate on global product CRUD with
four granular permissions assignable to custom roles:

- products.create_global  (assigned to admin + owner system roles by default)
- products.edit_global    (owner only by default)
- products.delete_global  (owner only by default)
- garment_types.manage_global (owner only by default — covers create/edit/delete
  of global garment types and their images, since these are rarely manipulated)

All four are marked `is_sensitive=True` because mutations on global records
affect every tenant's inventory simultaneously.

This migration also merges the two pending heads (`alt_no_ext_v3` and
`fp_proj_001`) so subsequent migrations have a single linear history.

Revision ID: glob_prod_perm_001
Revises: alt_no_ext_v3, fp_proj_001
Create Date: 2026-05-02
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import uuid
from datetime import datetime


revision: str = "glob_prod_perm_001"
down_revision: Union[str, Sequence[str], None] = ("alt_no_ext_v3", "fp_proj_001")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


NEW_PERMISSIONS = [
    {
        "code": "products.create_global",
        "name": "Crear productos globales",
        "description": "Crear productos compartidos entre todos los colegios",
        "category": "products",
        "is_sensitive": True,
        "default_system_roles": ["admin", "owner"],
    },
    {
        "code": "products.edit_global",
        "name": "Editar productos globales",
        "description": "Modificar productos compartidos entre todos los colegios",
        "category": "products",
        "is_sensitive": True,
        "default_system_roles": ["owner"],
    },
    {
        "code": "products.delete_global",
        "name": "Eliminar productos globales",
        "description": "Desactivar productos compartidos entre todos los colegios",
        "category": "products",
        "is_sensitive": True,
        "default_system_roles": ["owner"],
    },
    {
        "code": "garment_types.manage_global",
        "name": "Gestionar tipos de prenda globales",
        "description": "Crear, editar, eliminar y administrar imágenes de tipos de prenda globales",
        "category": "garment_types",
        "is_sensitive": True,
        "default_system_roles": ["owner"],
    },
]


def upgrade() -> None:
    conn = op.get_bind()
    now = datetime.utcnow()

    for perm in NEW_PERMISSIONS:
        # Skip if already present (defensive — repeat-safe)
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
