"""Reconcilia ``inventory.reserved_quantity`` contra el respaldo real de
``order_items`` ABIERTOS (encargos pendientes).

Contexto: algunas filas de inventario quedaron con ``reserved_quantity`` mayor
que la suma de reservas de pedidos realmente abiertos ("reservas fantasma").
La causa es el consumo fail-open en ``order/status.py`` y ediciones manuales de
la conciliacion de encargos que dejaron items en ``delivered`` sin liberar su
reserva. El resultado: ``adjust_quantity`` rechaza cualquier remocion de stock
porque exige ``quantity + delta >= reserved_quantity`` (catch-22 para el conteo
fisico de las vendedoras).

Por defecto el script SOLO DISMINUYE reservas fantasma (clamp-down): nunca sube
``reserved_quantity`` a ciegas, porque una sub-reserva no revisada subida
automaticamente bloquearia ventas legitimas. NO toca el ``quantity`` fisico.

Con ``--full`` (opt-in EXPLICITO, tras revisar el dry-run) reconcilia AMBAS
direcciones: ademas SUBE ``reserved_quantity`` donde el respaldo de pedidos
abiertos es mayor (sub-reserva legitima, p.ej. productos globales que el backfill
nunca respaldo por matchear con ``order.school_id``). El target se topa en
``quantity`` para no violar ``chk_inventory_reserved_lte_quantity``.

Invariante objetivo por fila de inventario::

    target = min(reserved_quantity_actual, respaldo_de_pedidos_abiertos)
    se aplica solo si  target < reserved_quantity_actual

donde respaldo = SUM(order_items.quantity_reserved) de items con
``reserved_from_stock = true`` y ``item_status NOT IN ('delivered','cancelled')``
[MINUSCULAS: OrderItemStatus usa values_callable], agrupado por
``(product_id, products.school_id)`` para respetar la particion de productos
globales (school_id NULL) — NO por ``order.school_id`` (ese fue el bug del
backfill original que nunca respaldo los productos globales).

Guardas de seguridad (cada una cierra un ataque adversarial verificado):
  - ABORTA si existen order_items abiertos y reservados con ``product_id NULL``
    (FK ON DELETE SET NULL): en ese caso el respaldo no es un limite inferior
    confiable y liberar podria destruir una reserva legitima.
  - UPDATE atomico con guarda optimista (no hay row lock en inventory.py):
    una entrega/cancelacion concurrente no se pisa.
  - Log de auditoria con ``quantity_delta=0`` y ``quantity_after`` = quantity
    fisico SIN cambio (la reserva no mueve stock fisico; meterlo en
    quantity_delta contaminaria reportes de COGS/valor de inventario).

ALCANCE: libera reservas fantasma y desbloquea el ajuste de inventario. NO
corrige el ``quantity`` fisico que pudo quedar sobreestimado cuando un consumo
fail-open omitio decrementar quantity Y reserved juntos — eso requiere un
conteo fisico aparte.

Uso::

    venv/bin/python -m scripts.reconcile_reserved_quantity            # dry-run (rollback)
    venv/bin/python -m scripts.reconcile_reserved_quantity --commit   # persiste
"""
from __future__ import annotations

import argparse
import asyncio
import logging
import sys

from sqlalchemy import func, or_, select, update

from app.db.session import AsyncSessionLocal
from app.models.inventory_log import InventoryMovementType
from app.models.order import Order, OrderItem
from app.models.product import Inventory, Product
from app.services.inventory_log import InventoryLogService
from app.utils.timezone import get_colombia_date

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger("reconcile_reserved")
for _noisy in ("sqlalchemy.engine", "sqlalchemy.engine.Engine", "sqlalchemy.pool"):
    logging.getLogger(_noisy).setLevel(logging.WARNING)

# MINUSCULAS a proposito: OrderItemStatus declara values_callable, asi que la
# columna guarda los VALORES (minuscula). OrderStatus NO lo hace (guarda NOMBRES
# en mayuscula) — por eso jamas se debe filtrar este script por order.status.
CLOSED_ITEM_STATUSES = ("delivered", "cancelled")
REFERENCE = f"RECON-RESERVED-{get_colombia_date().isoformat()}"


async def count_dangling_open_reservations(db) -> int:
    """Cuenta order_items abiertos y reservados que perdieron su product_id.

    Si existe aunque sea uno, el respaldo por producto deja de ser un limite
    inferior confiable (la reserva viva no se puede atribuir a ninguna fila de
    inventario), y el script debe abortar para no liberar reservas legitimas.
    """
    stmt = select(func.count(OrderItem.id)).where(
        OrderItem.reserved_from_stock.is_(True),
        OrderItem.quantity_reserved > 0,
        OrderItem.item_status.notin_(CLOSED_ITEM_STATUSES),
        OrderItem.product_id.is_(None),
    )
    return (await db.execute(stmt)).scalar() or 0


async def open_backing_by_product(db) -> dict[tuple, int]:
    """Suma de reservas de pedidos ABIERTOS, por (product_id, product.school_id).

    Se agrupa por el school_id del PRODUCTO (clave real de la fila de inventario,
    NULL para globales), no por el del pedido.
    """
    stmt = (
        select(
            OrderItem.product_id,
            Product.school_id.label("product_school_id"),
            func.coalesce(func.sum(OrderItem.quantity_reserved), 0).label("open_sum"),
        )
        .join(Order, Order.id == OrderItem.order_id)
        .join(Product, Product.id == OrderItem.product_id)
        .where(
            OrderItem.reserved_from_stock.is_(True),
            OrderItem.quantity_reserved > 0,
            OrderItem.item_status.notin_(CLOSED_ITEM_STATUSES),
        )
        .group_by(OrderItem.product_id, Product.school_id)
    )
    return {
        (row.product_id, row.product_school_id): row.open_sum
        for row in (await db.execute(stmt)).all()
    }


async def main(args: argparse.Namespace) -> int:
    async with AsyncSessionLocal() as db:
        dangling = await count_dangling_open_reservations(db)
        if dangling > 0:
            logger.error(
                "ABORTANDO: %d order_item(s) ABIERTOS y reservados con product_id NULL. "
                "El respaldo de pedidos no es confiable; reasignar producto o liberar la "
                "reserva manualmente antes de correr este script.",
                dangling,
            )
            return 2

        backing = await open_backing_by_product(db)

        # En modo --full tambien se consideran filas con reserved=0 cuyo respaldo
        # de pedidos abiertos es >0 (sub-reserva): el clamp-down nunca las ve.
        backing_pids = {pid for (pid, _sid) in backing}
        if args.full:
            inv_filter = or_(
                Inventory.reserved_quantity > 0,
                Inventory.product_id.in_(backing_pids),
            )
        else:
            inv_filter = Inventory.reserved_quantity > 0
        invs = (await db.execute(select(Inventory).where(inv_filter))).scalars().all()

        log_service = InventoryLogService(db)
        lowered = raised = skipped = capped = 0

        for inv in invs:
            open_sum = backing.get((inv.product_id, inv.school_id), 0)

            if args.full:
                # Reconcilia AMBAS direcciones (opt-in explicito, revisado).
                target = min(open_sum, inv.quantity)  # nunca viola reserved<=quantity
                if open_sum > inv.quantity:
                    capped += 1
                    logger.warning(
                        "  [!] product=%s school=%s respaldo %d > quantity %d — tope a %d",
                        inv.product_id, inv.school_id, open_sum, inv.quantity, inv.quantity,
                    )
            else:
                # Default seguro: solo BAJA reservas fantasma, nunca sube.
                target = min(inv.reserved_quantity, open_sum)

            if target == inv.reserved_quantity:
                skipped += 1
                continue

            old = inv.reserved_quantity
            result = await db.execute(
                update(Inventory)
                .where(Inventory.id == inv.id, Inventory.reserved_quantity == old)
                .values(reserved_quantity=target)
                .returning(Inventory.reserved_quantity)
            )
            if result.first() is None:
                logger.warning(
                    "  [~] product=%s school=%s cambio concurrente — saltado",
                    inv.product_id, inv.school_id,
                )
                skipped += 1
                continue

            sube = target > old
            desc = (
                f"Sub-reserva corregida: reservado {old}->{target} (agrega {target - old})"
                if sube else
                f"Reconciliacion reserva fantasma: reservado {old}->{target} (libera {old - target})"
            )
            await log_service.create_log_with_retry(
                inventory_id=inv.id,
                school_id=inv.school_id,
                movement_type=InventoryMovementType.ADJUSTMENT_IN,
                quantity_delta=0,
                quantity_after=inv.quantity,
                description=desc,
                reference=REFERENCE,
                movement_date=get_colombia_date(),
            )
            logger.info(
                "  [%s] product=%s school=%s reservado %d->%d",
                "^" if sube else "+", inv.product_id, inv.school_id, old, target,
            )
            raised += 1 if sube else 0
            lowered += 0 if sube else 1

        logger.info(
            "Bajadas (fantasma): %d · Subidas (sub-reserva): %d · Sin cambio: %d · Topadas: %d",
            lowered, raised, skipped, capped,
        )

        if args.commit:
            await db.commit()
            logger.info("=== COMMIT ===")
        else:
            await db.rollback()
            logger.info("=== DRY-RUN (rollback). Re-ejecuta con --commit para persistir ===")
    return 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--commit", action="store_true", help="Persiste los cambios (sin esto, dry-run)")
    parser.add_argument(
        "--full",
        action="store_true",
        help=(
            "Opt-in EXPLICITO: reconcilia AMBAS direcciones (tambien SUBE reserved "
            "donde una sub-reserva legitima quedo en 0, p.ej. globales no respaldados "
            "por el backfill). Tope en quantity para no violar la constraint. Por "
            "defecto el script solo BAJA reservas fantasma."
        ),
    )
    sys.exit(asyncio.run(main(parser.parse_args())))
