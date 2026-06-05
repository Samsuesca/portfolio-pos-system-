"""
Recalcula products.cost = suma(componentes de costo activos) — rollup/backfill.

Contexto: `import_costs_from_xlsx.py` inserta filas en `product_cost_components`
pero NO actualiza el campo agregado `products.cost`. Ese rollup solo ocurre al
guardar costos por la UI (CostComponentService._recalculate_product_cost). Tras
una importacion masiva, `products.cost` queda desincronizado y la columna
COSTO/MARGEN de la lista de productos aparece vacia.

Este script reconcilia: para cada producto que tiene >= 1 componente con
template ACTIVO, setea products.cost a la suma de esos componentes. Productos
SIN componentes NO se tocan (preservan su costo manual; no se ponen en 0).

Idempotente: re-ejecutarlo no cambia nada si ya esta sincronizado.

Uso:
    cd backend
    venv/bin/python -m scripts.recalculate_product_costs              # DRY-RUN (no persiste)
    venv/bin/python -m scripts.recalculate_product_costs --commit     # persiste
    venv/bin/python -m scripts.recalculate_product_costs --commit --limit-preview 30
"""
import argparse
import asyncio
import logging
import sys
from decimal import Decimal
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parent.parent
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from sqlalchemy import select, func

from app.db.session import AsyncSessionLocal
from app.models.product import Product, ProductCostComponent, CostComponentTemplate

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger("recalc_costs")


async def run(commit: bool, limit_preview: int) -> int:
    async with AsyncSessionLocal() as db:
        # Suma de componentes ACTIVOS por producto (solo productos con componentes).
        sums = (await db.execute(
            select(
                ProductCostComponent.product_id,
                func.sum(ProductCostComponent.amount).label("total"),
            )
            .join(
                CostComponentTemplate,
                ProductCostComponent.template_id == CostComponentTemplate.id,
            )
            .where(CostComponentTemplate.is_active.is_(True))
            .group_by(ProductCostComponent.product_id)
        )).all()

        target = {row.product_id: (row.total or Decimal("0")) for row in sums}
        if not target:
            logger.info("No hay productos con componentes activos. Nada que hacer.")
            return 0

        products = (await db.execute(
            select(Product).where(Product.id.in_(list(target.keys())))
        )).scalars().all()

        changes: list[tuple[str, Decimal | None, Decimal]] = []
        for product in products:
            new_cost = target[product.id]
            old_cost = product.cost
            if old_cost is None or Decimal(old_cost) != Decimal(new_cost):
                changes.append((product.code, old_cost, new_cost))
                product.cost = new_cost

        logger.info("Productos con componentes activos: %d", len(target))
        logger.info("Productos cuyo products.cost cambiaria: %d", len(changes))
        if changes:
            logger.info("\nEjemplos (code: antes -> despues):")
            for code, old, new in changes[:limit_preview]:
                old_s = "NULL" if old is None else f"${Decimal(old):,.0f}"
                logger.info("  %-22s %s -> $%s", code, old_s, f"{Decimal(new):,.0f}")
            if len(changes) > limit_preview:
                logger.info("  ... y %d mas", len(changes) - limit_preview)

        if commit:
            await db.commit()
            logger.info("\n=== COMMIT: %d productos actualizados ===", len(changes))
        else:
            await db.rollback()
            logger.info("\n=== DRY-RUN — rollback. Re-ejecuta con --commit para persistir ===")
        return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Rollup products.cost desde componentes")
    parser.add_argument("--commit", action="store_true", help="Persiste cambios.")
    parser.add_argument("--limit-preview", type=int, default=20, help="Cuantos ejemplos mostrar.")
    args = parser.parse_args()
    return asyncio.run(run(args.commit, args.limit_preview))


if __name__ == "__main__":
    sys.exit(main())
