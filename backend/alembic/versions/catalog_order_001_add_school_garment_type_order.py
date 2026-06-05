"""Add per-school catalog order (school_garment_type_order) + catalog.reorder permission

Issue #8: el dueno/admin puede definir, por colegio, el orden en que aparecen las
cards del catalogo (tipos de prenda), arrastrandolas. El orden es por colegio incluso
para tipos GLOBALES, asi que vive en una tabla puente (mismo patron que
school_global_gt_exclusions y GarmentTypeImage.school_id), no en una columna unica.

Tambien registra el micropermiso `catalog.reorder` (asignado por defecto a admin+owner;
OWNER lo recibe porque resuelve sus permisos como "todos los codigos de la tabla
permissions").

Revision ID: catalog_order_001
Revises: fe_invoicing_001
Create Date: 2026-06-04
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID
import uuid
from datetime import datetime


revision: str = "catalog_order_001"
down_revision: Union[str, Sequence[str], None] = "fe_invoicing_001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


NEW_PERMISSION = {
    "code": "catalog.reorder",
    "name": "Reordenar catálogo",
    "description": (
        "Definir, arrastrando las cards, el orden en que se muestran los tipos de "
        "prenda en el catálogo de cada colegio (app de escritorio y portal web)."
    ),
    "category": "catalog",
    "is_sensitive": False,
    "default_system_roles": ["admin", "owner"],
}


def upgrade() -> None:
    op.create_table(
        "school_garment_type_order",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column(
            "school_id",
            UUID(as_uuid=True),
            sa.ForeignKey("schools.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "garment_type_id",
            UUID(as_uuid=True),
            sa.ForeignKey("garment_types.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("display_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    op.create_index(
        "ix_school_garment_type_order_school_id",
        "school_garment_type_order",
        ["school_id"],
    )
    op.create_index(
        "ix_school_garment_type_order_garment_type_id",
        "school_garment_type_order",
        ["garment_type_id"],
    )
    op.create_index(
        "uq_sgt_order_school_gt",
        "school_garment_type_order",
        ["school_id", "garment_type_id"],
        unique=True,
    )

    # --- Permission row (idempotente) ---
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
    if existing:
        perm_id = existing[0]
        conn.execute(
            sa.text("DELETE FROM role_permissions WHERE permission_id = :perm_id"),
            {"perm_id": perm_id},
        )
        conn.execute(
            sa.text("DELETE FROM permissions WHERE id = :perm_id"),
            {"perm_id": perm_id},
        )

    op.drop_index("uq_sgt_order_school_gt", table_name="school_garment_type_order")
    op.drop_index(
        "ix_school_garment_type_order_garment_type_id",
        table_name="school_garment_type_order",
    )
    op.drop_index(
        "ix_school_garment_type_order_school_id",
        table_name="school_garment_type_order",
    )
    op.drop_table("school_garment_type_order")
