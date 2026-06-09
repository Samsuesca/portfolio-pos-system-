"""Branches foundation (v3.1 — Fase 0a)

Crea las dos tablas fundacionales de la arquitectura de sucursales sin tocar
ninguna tabla existente (sin FKs salientes). Esto desbloquea el `branch_id`
real en el módulo B2B sin requerir todavía el retrofit completo de branches
(Fase 0b: añadir branch_id a schools/sales/orders/contabilidad).

Crea:
- tabla `branches` (sucursal física; code UNIQUE)
- tabla `school_identities` (agrupa sedes del mismo colegio para reportes
  consolidados)

Siembra la sucursal "Central" (is_headquarters=true) de forma idempotente
(ON CONFLICT por code) — es la tienda actual a la que pertenece todo lo
existente cuando se ejecute el backfill de la Fase 0b.

Ver `docs/v3/v3-branch-architecture/branch-architecture.md`.

Revision ID: branches_foundation_001
Revises: tg_alt_ord_alerts
Create Date: 2026-06-07
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID
import uuid


revision: str = "branches_foundation_001"
down_revision: Union[str, Sequence[str], None] = "tg_alt_ord_alerts"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "branches",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("code", sa.String(length=50), nullable=False),
        sa.Column("address", sa.Text(), nullable=True),
        sa.Column("city", sa.String(length=100), nullable=True),
        sa.Column("phone", sa.String(length=50), nullable=True),
        sa.Column("is_headquarters", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_branches_code", "branches", ["code"], unique=True)

    op.create_table(
        "school_identities",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("logo_url", sa.String(length=500), nullable=True),
        sa.Column("city", sa.String(length=100), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )

    # Seed "Central" idempotente. Timestamps en hora local Colombia (naive),
    # consistente con get_colombia_now_naive del resto del sistema.
    op.execute(
        """
        INSERT INTO branches
            (id, name, code, is_headquarters, is_active, created_at, updated_at)
        VALUES
            (gen_random_uuid(), 'Central', 'CENTRAL', true, true,
             (now() AT TIME ZONE 'America/Bogota'),
             (now() AT TIME ZONE 'America/Bogota'))
        ON CONFLICT (code) DO NOTHING;
        """
    )


def downgrade() -> None:
    op.drop_table("school_identities")
    op.drop_index("ix_branches_code", table_name="branches")
    op.drop_table("branches")
