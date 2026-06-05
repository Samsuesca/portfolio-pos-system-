"""Tabla de exclusion de productos globales por colegio (visibilidad de catalogo).

Feature (2026-05-28): definir, por colegio, que productos globales se muestran en el
catalogo publico. Modelo de exclusion — presencia de fila = global OCULTO para ese
colegio; sin fila = visible (default, comportamiento actual). Granularidad: garment_type.

Revision ID: v3_school_global_gt_excl_001
Revises: v3_catalog_rm_boxer_int_001
Create Date: 2026-05-28
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "v3_school_global_gt_excl_001"
down_revision: Union[str, Sequence[str], None] = "v3_catalog_rm_boxer_int_001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "school_global_gt_exclusions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("school_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("global_garment_type_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(
            ["school_id"], ["schools.id"], ondelete="CASCADE",
            name="fk_school_global_gt_excl_school",
        ),
        sa.ForeignKeyConstraint(
            ["global_garment_type_id"], ["garment_types.id"], ondelete="CASCADE",
            name="fk_school_global_gt_excl_gt",
        ),
    )
    op.create_index(
        "ix_school_global_gt_excl_school_id",
        "school_global_gt_exclusions",
        ["school_id"],
    )
    op.create_index(
        "ix_school_global_gt_excl_gt_id",
        "school_global_gt_exclusions",
        ["global_garment_type_id"],
    )
    op.create_index(
        "uq_school_global_gt_excl",
        "school_global_gt_exclusions",
        ["school_id", "global_garment_type_id"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("uq_school_global_gt_excl", table_name="school_global_gt_exclusions")
    op.drop_index("ix_school_global_gt_excl_gt_id", table_name="school_global_gt_exclusions")
    op.drop_index("ix_school_global_gt_excl_school_id", table_name="school_global_gt_exclusions")
    op.drop_table("school_global_gt_exclusions")
