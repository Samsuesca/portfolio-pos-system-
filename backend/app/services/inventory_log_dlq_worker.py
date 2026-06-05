"""Inventory Log DLQ background worker.

Periodicamente reprocesa filas pendientes en `failed_inventory_logs`. Si
la causa original del fallo se resolvio (e.g. la transaccion del Order que
faltaba ya fue commiteada, o un hiccup transitorio de DB), el log se
re-inserta en `inventory_logs` y la auditoria queda completa.

Schedule: cada 1 hora. Process limit: 100 rows por corrida (cap suave para
no saturar la DB en bursts grandes).
"""
import asyncio
import logging

from app.db.session import AsyncSessionLocal
from app.services.inventory_log import InventoryLogService

logger = logging.getLogger(__name__)

DLQ_REPROCESS_INTERVAL_SECONDS = 3600  # 1 hora
DLQ_BATCH_SIZE = 100


async def reprocess_dlq_once() -> None:
    """Una pasada de reprocesamiento. Util para testing y para cron externo."""
    async with AsyncSessionLocal() as session:
        svc = InventoryLogService(session)
        try:
            result = await svc.reprocess_failed_logs(limit=DLQ_BATCH_SIZE)
            if result["processed"] > 0:
                logger.info(
                    "InventoryLog DLQ reprocess: processed=%d resolved=%d still_failing=%d",
                    result["processed"], result["resolved"], result["still_failing"],
                )
        except Exception as e:
            logger.exception("InventoryLog DLQ reprocess failed: %s", e)


async def inventory_log_dlq_loop() -> None:
    """Loop infinito que reprocesa la DLQ cada hora."""
    logger.info("InventoryLog DLQ worker started")

    while True:
        await asyncio.sleep(DLQ_REPROCESS_INTERVAL_SECONDS)
        await reprocess_dlq_once()
