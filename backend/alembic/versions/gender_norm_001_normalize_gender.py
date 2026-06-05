"""Normalize non-canonical gender values (niña, dama → female)

ProductBase.validate_gender (app/schemas/product.py) acepta solo
{unisex, male, female}. La data en producción/dev tenía 16 productos globales
(Bicicletero y Top deportivo) con gender='niña' o 'dama', valores que el
validator de Pydantic rechazaba al serializar la lista de productos:

    400 Bad Request: gender: Valor inválido

Esto rompía GET /global/products (con efecto cascada en SaleModal,
ProductCostManager, CostBreakdownEditor y la tab "Productos Globales").

Mapeo semántico aplicado:
  'niña' → 'female'
  'dama' → 'female'

(Ambos son femeninos, no hay pérdida de información semántica. El género
"niñ@" se infiere por talla, no por este campo.)

Idempotente: si se re-ejecuta, el UPDATE no afecta filas porque las nuevas
filas ya tendrán los valores canónicos.

Revision ID: gender_norm_001
Revises: reports_cov_001
Create Date: 2026-05-24
"""
from alembic import op


revision = "gender_norm_001"
down_revision = "reports_cov_001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE products
        SET gender = 'female'
        WHERE gender IN ('niña', 'dama')
        """
    )


def downgrade() -> None:
    # No-op: restaurar 'niña'/'dama' rompería el validator de la app.
    # La data canónica es más limpia que la original; no hay razón para revertir.
    pass
