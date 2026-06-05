"""V3 catalog: remove Boxer + Interiores del catalogo (soft-delete).

Decision del owner (2026-05-28): Boxer e Interiores no deben aparecer en el
catalogo publico. Se ship con el deploy v3.

Estrategia: soft-delete (is_active = false) en vez de DELETE fisico.
- El portal y la API filtran SIEMPRE por is_active (GarmentType.is_active y
  Product.is_active), asi que basta con desactivar para sacarlos del catalogo.
- Reversible: downgrade() los reactiva.
- FK-safe: no se borran filas, asi no hay riesgo con order_items/sale_items
  (verificado: 0 referencias al momento de crear esta migracion).

Alcance (verificado en dev uniformes_db):
- Boxer: 1 garment_type GLOBAL (school_id IS NULL) + 6 productos.
- Interiores: 3 garment_types de colegio (Caracas, Pumarejo, Pinal) + 3 productos.

Match por nombre (case-insensitive) para cubrir las 4 filas sin hardcodear UUIDs.

Revision ID: v3_catalog_rm_boxer_int_001
Revises: reports_cov_002
Create Date: 2026-05-28
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "v3_catalog_rm_boxer_int_001"
down_revision: Union[str, Sequence[str], None] = "reports_cov_002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Nombres a remover del catalogo (case-insensitive).
TARGET_NAMES = ("boxer", "interiores")


def upgrade() -> None:
    conn = op.get_bind()

    # 1) Desactivar productos de esos garment_types.
    op.execute(
        """
        UPDATE products
        SET is_active = false
        WHERE garment_type_id IN (
            SELECT id FROM garment_types
            WHERE LOWER(name) IN ('boxer', 'interiores')
        )
        """
    )

    # 2) Desactivar los garment_types.
    op.execute(
        """
        UPDATE garment_types
        SET is_active = false
        WHERE LOWER(name) IN ('boxer', 'interiores')
        """
    )

    # 3) Verificacion fail-loud: no debe quedar ningun gt activo con esos nombres.
    remaining = conn.execute(
        sa.text(
            """
            SELECT COUNT(*) FROM garment_types
            WHERE LOWER(name) IN ('boxer', 'interiores') AND is_active = true
            """
        )
    ).scalar()
    if remaining and remaining > 0:
        raise RuntimeError(
            f"[rm_boxer_interiores] Quedaron {remaining} garment_types activos "
            "con nombre Boxer/Interiores tras el soft-delete."
        )


def downgrade() -> None:
    # Reactivar garment_types y sus productos (revierte el soft-delete).
    op.execute(
        """
        UPDATE garment_types
        SET is_active = true
        WHERE LOWER(name) IN ('boxer', 'interiores')
        """
    )
    op.execute(
        """
        UPDATE products
        SET is_active = true
        WHERE garment_type_id IN (
            SELECT id FROM garment_types
            WHERE LOWER(name) IN ('boxer', 'interiores')
        )
        """
    )
