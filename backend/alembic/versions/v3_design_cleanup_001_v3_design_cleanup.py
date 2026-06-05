"""V3 design cleanup: limpia seed data sucia y normaliza taxonomia de garment_types.category

Sprint V3 storefront. Dos limpiezas:

1. schools.address tenia placeholder seed data (`Bogota, Colombia`, `Cali, Colombia`) para
   3 colegios cuando en realidad todos los colegios operan en Medellin. La data fue
   identificada al consultar la DB para el rediseno V3 — riesgo de segundo orden: cualquier
   agente que lea `schools.address` deduce cobertura nacional falsa. Limpiamos a NULL.

2. garment_types.category tenia taxonomia inconsistente:
   - accessories  (1 fila) — duplicado por casing/idioma de `accesorios` (13)
   - Superior     (5 filas) — duplicado por casing de `tops` (3) en otro idioma
   - Conjunto     (1 fila) — categoria one-off, consolidamos en `uniforme_diario`

   Taxonomia canonica final: uniforme_diario, uniforme_deportivo, tops, bottoms,
   accesorios, footwear (mas NULL para items sin clasificar).

El downgrade es no-op porque restaurar la seed data sucia no agrega valor.

Revision ID: v3_design_cleanup_001
Revises: exp_cat_fk_001
Create Date: 2026-05-04
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "v3_design_cleanup_001"
down_revision: Union[str, Sequence[str], None] = "exp_cat_fk_001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. schools.address: limpiar placeholders falsos
    op.execute(
        """
        UPDATE schools
        SET address = NULL
        WHERE address IN ('Bogotá, Colombia', 'Cali, Colombia')
        """
    )

    # 2. garment_types.category: normalizar taxonomia
    op.execute(
        """
        UPDATE garment_types
        SET category = CASE category
            WHEN 'accessories' THEN 'accesorios'
            WHEN 'Superior'    THEN 'tops'
            WHEN 'Conjunto'    THEN 'uniforme_diario'
            ELSE category
        END
        WHERE category IN ('accessories', 'Superior', 'Conjunto')
        """
    )

    # Verificacion post-migracion: ningun valor fuera de la taxonomia canonica
    conn = op.get_bind()
    result = conn.execute(
        sa.text(
            """
            SELECT DISTINCT category
            FROM garment_types
            WHERE category IS NOT NULL
              AND category NOT IN (
                  'uniforme_diario', 'uniforme_deportivo',
                  'tops', 'bottoms', 'accesorios', 'footwear'
              )
            """
        )
    )
    orphan_categories = [row[0] for row in result.fetchall()]
    if orphan_categories:
        raise RuntimeError(
            f"V3 migration found categories outside canonical taxonomy: {orphan_categories}. "
            f"Update the CASE statement in upgrade() to handle these before re-running."
        )


def downgrade() -> None:
    # Data cleanup migration — no value in restoring dirty seed data.
    # If a rollback is genuinely needed, the original values were:
    #   schools.address: 'Bogotá, Colombia' for CARACAS-001;
    #                    'Cali, Colombia' for PUMAREJO-001 and PINAL-001
    #   garment_types.category: 1x accessories, 5x Superior, 1x Conjunto
    # Restore manually if required.
    pass
