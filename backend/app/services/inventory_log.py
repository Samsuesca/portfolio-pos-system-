"""
Inventory Log Service

Service for creating and querying inventory movement logs.
Provides audit trail for all inventory changes.
"""
import asyncio
import logging
from uuid import UUID
from datetime import date, datetime
from sqlalchemy import select, func, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.models.inventory_log import InventoryLog, InventoryMovementType, FailedInventoryLog
from app.utils.timezone import COLOMBIA_TZ, get_colombia_now, get_colombia_date, get_colombia_now_naive

logger = logging.getLogger(__name__)

# Backoff por intento (segundos): 0.1, 0.5, 2.0
RETRY_BACKOFF_SECONDS = (0.1, 0.5, 2.0)


from app.models.product import Inventory, Product
from app.models.user import User
from app.schemas.inventory_log import (
    InventoryLogCreate,
    InventoryLogResponse,
    InventoryLogWithProduct,
    InventoryLogFilter,
    InventoryLogListResponse,
)


class InventoryLogService:

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_log(
        self,
        inventory_id: UUID | None = None,
        school_id: UUID | None = None,
        movement_type: InventoryMovementType = InventoryMovementType.ADJUSTMENT_IN,
        quantity_delta: int = 0,
        quantity_after: int = 0,
        description: str = "",
        reference: str | None = None,
        sale_id: UUID | None = None,
        order_id: UUID | None = None,
        sale_change_id: UUID | None = None,
        created_by: UUID | None = None,
        movement_date: date | None = None,
    ) -> InventoryLog:
        log = InventoryLog(
            inventory_id=inventory_id,
            school_id=school_id,
            movement_type=movement_type,
            movement_date=movement_date or get_colombia_date(),
            quantity_delta=quantity_delta,
            quantity_after=quantity_after,
            description=description,
            reference=reference,
            sale_id=sale_id,
            order_id=order_id,
            sale_change_id=sale_change_id,
            created_by=created_by,
        )

        self.db.add(log)
        await self.db.flush()
        await self.db.refresh(log)

        return log

    async def create_log_with_retry(
        self,
        inventory_id: UUID | None = None,
        school_id: UUID | None = None,
        movement_type: InventoryMovementType = InventoryMovementType.ADJUSTMENT_IN,
        quantity_delta: int = 0,
        quantity_after: int = 0,
        description: str = "",
        reference: str | None = None,
        sale_id: UUID | None = None,
        order_id: UUID | None = None,
        sale_change_id: UUID | None = None,
        created_by: UUID | None = None,
        movement_date: date | None = None,
    ) -> InventoryLog | None:
        """Crea un log con reintentos + DLQ.

        Intenta hasta 3 veces con backoff (0.1s, 0.5s, 2.0s) usando SAVEPOINTs
        anidados para no abortar la transaccion principal. Si los 3 intentos
        fallan, persiste el evento en `failed_inventory_logs` (DLQ) usando
        una sesion separada — la transaccion principal sigue viva sin
        importar lo que pase con el log.

        El cron `inventory_log_dlq_worker.reprocess_failed_logs` reprocesa
        periodicamente las filas con `resolved=false`.

        Returns:
            El `InventoryLog` creado si tuvo exito, o `None` si fallaron
            los 3 intentos (en cuyo caso quedo registrado en la DLQ).
        """
        movement_date = movement_date or get_colombia_date()
        last_exc: Exception | None = None

        for attempt, backoff in enumerate(RETRY_BACKOFF_SECONDS, start=1):
            try:
                async with self.db.begin_nested():
                    log = InventoryLog(
                        inventory_id=inventory_id,
                        school_id=school_id,
                        movement_type=movement_type,
                        movement_date=movement_date,
                        quantity_delta=quantity_delta,
                        quantity_after=quantity_after,
                        description=description,
                        reference=reference,
                        sale_id=sale_id,
                        order_id=order_id,
                        sale_change_id=sale_change_id,
                        created_by=created_by,
                    )
                    self.db.add(log)
                    await self.db.flush()
                if attempt > 1:
                    logger.info(
                        f"InventoryLog persistido en intento {attempt} "
                        f"({movement_type.value}, delta={quantity_delta})"
                    )
                return log
            except Exception as e:
                last_exc = e
                logger.warning(
                    f"InventoryLog intento {attempt}/3 fallo "
                    f"({movement_type.value}, delta={quantity_delta}): {e}"
                )
                if attempt < len(RETRY_BACKOFF_SECONDS):
                    await asyncio.sleep(backoff)

        # Los 3 intentos fallaron: persistir a DLQ con sesion separada
        await self._persist_to_dlq(
            inventory_id=inventory_id,
            school_id=school_id,
            movement_type=movement_type,
            movement_date=movement_date,
            quantity_delta=quantity_delta,
            quantity_after=quantity_after,
            description=description,
            reference=reference,
            sale_id=sale_id,
            order_id=order_id,
            sale_change_id=sale_change_id,
            created_by=created_by,
            error_message=str(last_exc) if last_exc else "Unknown error",
        )
        return None

    async def _persist_to_dlq(
        self,
        inventory_id: UUID | None,
        school_id: UUID | None,
        movement_type: InventoryMovementType,
        movement_date: date,
        quantity_delta: int,
        quantity_after: int,
        description: str,
        reference: str | None,
        sale_id: UUID | None,
        order_id: UUID | None,
        sale_change_id: UUID | None,
        created_by: UUID | None,
        error_message: str,
    ) -> None:
        """Inserta en `failed_inventory_logs` usando una sesion fresca.

        Sesion separada para evitar el rollback de la transaccion principal
        si esta tambien estuviera abortada. Si la insercion en DLQ tambien
        falla (DB caida total), loggea ERROR y dispara alerta Telegram —
        es la ultima linea de defensa.
        """
        try:
            from sqlalchemy.ext.asyncio import async_sessionmaker, AsyncSession
            # Reusa el engine de la sesion actual para no acoplarse a la URL
            # global. En tests esto apunta a la DB de tests; en produccion
            # apunta a la DB principal — ambos casos correctos.
            engine = self.db.bind
            session_factory = async_sessionmaker(
                engine, class_=AsyncSession, expire_on_commit=False
            )

            async with session_factory() as fresh_session:
                failed = FailedInventoryLog(
                    inventory_id=inventory_id,
                    school_id=school_id,
                    movement_type=movement_type.value,
                    movement_date=movement_date,
                    quantity_delta=quantity_delta,
                    quantity_after=quantity_after,
                    description=description,
                    reference=reference,
                    sale_id=sale_id,
                    order_id=order_id,
                    sale_change_id=sale_change_id,
                    created_by=created_by,
                    original_created_at=get_colombia_now_naive(),
                    error_message=error_message[:5000],
                    retry_count=len(RETRY_BACKOFF_SECONDS),
                    last_retry_at=get_colombia_now_naive(),
                )
                fresh_session.add(failed)
                await fresh_session.commit()

            logger.error(
                f"InventoryLog persistido en DLQ tras 3 fallos: "
                f"{movement_type.value} delta={quantity_delta} ref={reference}"
            )

            try:
                from app.services.telegram import fire_and_forget_routed_alert
                from app.services.telegram_messages import TelegramMessageBuilder
                msg = TelegramMessageBuilder.inventory_log_failed(
                    movement_type=movement_type.value,
                    quantity_delta=quantity_delta,
                    reference=reference,
                    error=error_message[:200],
                )
                fire_and_forget_routed_alert("inventory_log_failed", msg, school_id=school_id)
            except Exception as alert_err:
                logger.warning(f"DLQ alert dispatch failed: {alert_err}")

        except Exception as dlq_err:
            logger.exception(
                f"CRITICAL: Failed to persist inventory log to DLQ. "
                f"Original error: {error_message}. DLQ error: {dlq_err}"
            )

    async def reprocess_failed_logs(self, limit: int = 100) -> dict:
        """Reprocesa rows pendientes en `failed_inventory_logs`.

        Llamado por el cron diario. Para cada fila con `resolved=false`,
        intenta una vez insertar en `inventory_logs`. Si exitoso, marca
        `resolved=true` y guarda el `resolved_log_id`. Si falla, incrementa
        `retry_count` y `last_retry_at`.

        Returns:
            Dict con counts: `processed`, `resolved`, `still_failing`.
        """
        result = await self.db.execute(
            select(FailedInventoryLog)
            .where(FailedInventoryLog.resolved.is_(False))
            .order_by(FailedInventoryLog.failed_at)
            .limit(limit)
        )
        pending = list(result.scalars().all())

        resolved_count = 0
        failed_count = 0

        for failed in pending:
            try:
                async with self.db.begin_nested():
                    log = InventoryLog(
                        inventory_id=failed.inventory_id,
                        school_id=failed.school_id,
                        movement_type=InventoryMovementType(failed.movement_type),
                        movement_date=failed.movement_date,
                        quantity_delta=failed.quantity_delta,
                        quantity_after=failed.quantity_after,
                        description=failed.description,
                        reference=failed.reference,
                        sale_id=failed.sale_id,
                        order_id=failed.order_id,
                        sale_change_id=failed.sale_change_id,
                        created_by=failed.created_by,
                        created_at=failed.original_created_at,
                    )
                    self.db.add(log)
                    await self.db.flush()
                failed.resolved = True
                failed.resolved_at = get_colombia_now_naive()
                failed.resolved_log_id = log.id
                resolved_count += 1
            except Exception as e:
                failed.retry_count += 1
                failed.last_retry_at = get_colombia_now_naive()
                failed.error_message = (
                    f"{failed.error_message[:2000]}\n--- retry {failed.retry_count} @ "
                    f"{get_colombia_now_naive().isoformat()}: {str(e)[:1000]}"
                )
                failed_count += 1

        await self.db.commit()

        return {
            "processed": len(pending),
            "resolved": resolved_count,
            "still_failing": failed_count,
        }

    async def get_logs_by_inventory(
        self,
        inventory_id: UUID,
        skip: int = 0,
        limit: int = 100
    ) -> list[InventoryLog]:
        result = await self.db.execute(
            select(InventoryLog)
            .where(InventoryLog.inventory_id == inventory_id)
            .order_by(InventoryLog.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        return list(result.scalars().all())

    async def get_logs_by_product(
        self,
        product_id: UUID,
        school_id: UUID | None,
        skip: int = 0,
        limit: int = 100
    ) -> list[InventoryLogWithProduct]:
        if school_id is not None:
            inv_result = await self.db.execute(
                select(Inventory).where(
                    Inventory.product_id == product_id,
                    Inventory.school_id == school_id
                )
            )
        else:
            inv_result = await self.db.execute(
                select(Inventory).where(
                    Inventory.product_id == product_id,
                    Inventory.school_id.is_(None)
                )
            )
        inventory = inv_result.scalar_one_or_none()

        if not inventory:
            return []

        result = await self.db.execute(
            select(InventoryLog, Product, User)
            .join(Inventory, InventoryLog.inventory_id == Inventory.id)
            .join(Product, Inventory.product_id == Product.id)
            .outerjoin(User, InventoryLog.created_by == User.id)
            .where(InventoryLog.inventory_id == inventory.id)
            .order_by(InventoryLog.created_at.desc())
            .offset(skip)
            .limit(limit)
        )

        logs = []
        for log, product, user in result.all():
            logs.append(
                InventoryLogWithProduct(
                    id=log.id,
                    inventory_id=log.inventory_id,
                    school_id=log.school_id,
                    movement_type=log.movement_type,
                    movement_date=log.movement_date,
                    quantity_delta=log.quantity_delta,
                    quantity_after=log.quantity_after,
                    description=log.description,
                    reference=log.reference,
                    sale_id=log.sale_id,
                    order_id=log.order_id,
                    sale_change_id=log.sale_change_id,
                    created_by=log.created_by,
                    created_at=log.created_at,
                    product_code=product.code,
                    product_name=product.name,
                    product_size=product.size,
                    is_global=product.school_id is None,
                    created_by_name=user.full_name or user.username if user else None,
                )
            )

        return logs

    async def get_logs_by_school(
        self,
        school_id: UUID,
        filters: InventoryLogFilter | None = None
    ) -> InventoryLogListResponse:
        filters = filters or InventoryLogFilter()

        base_conditions = [InventoryLog.school_id == school_id]

        if filters.start_date:
            base_conditions.append(InventoryLog.movement_date >= filters.start_date)
        if filters.end_date:
            base_conditions.append(InventoryLog.movement_date <= filters.end_date)
        if filters.movement_type:
            base_conditions.append(InventoryLog.movement_type == filters.movement_type)
        if filters.sale_id:
            base_conditions.append(InventoryLog.sale_id == filters.sale_id)
        if filters.order_id:
            base_conditions.append(InventoryLog.order_id == filters.order_id)

        count_query = select(func.count(InventoryLog.id)).where(and_(*base_conditions))
        total_result = await self.db.execute(count_query)
        total = total_result.scalar_one()

        logs_query = (
            select(InventoryLog, Product, User)
            .outerjoin(Inventory, InventoryLog.inventory_id == Inventory.id)
            .outerjoin(Product, Inventory.product_id == Product.id)
            .outerjoin(User, InventoryLog.created_by == User.id)
            .where(and_(*base_conditions))
            .order_by(InventoryLog.created_at.desc())
            .offset(filters.skip)
            .limit(filters.limit)
        )

        result = await self.db.execute(logs_query)

        logs = []
        for log, product, user in result.all():
            logs.append(
                InventoryLogWithProduct(
                    id=log.id,
                    inventory_id=log.inventory_id,
                    school_id=log.school_id,
                    movement_type=log.movement_type,
                    movement_date=log.movement_date,
                    quantity_delta=log.quantity_delta,
                    quantity_after=log.quantity_after,
                    description=log.description,
                    reference=log.reference,
                    sale_id=log.sale_id,
                    order_id=log.order_id,
                    sale_change_id=log.sale_change_id,
                    created_by=log.created_by,
                    created_at=log.created_at,
                    product_code=product.code if product else None,
                    product_name=product.name if product else None,
                    product_size=product.size if product else None,
                    is_global=product.school_id is None if product else False,
                    created_by_name=user.full_name or user.username if user else None,
                )
            )

        return InventoryLogListResponse(
            items=logs,
            total=total,
            skip=filters.skip,
            limit=filters.limit,
        )

    async def get_logs_by_date_range(
        self,
        school_id: UUID,
        start_date: date,
        end_date: date,
        movement_type: InventoryMovementType | None = None
    ) -> list[InventoryLog]:
        conditions = [
            InventoryLog.school_id == school_id,
            InventoryLog.movement_date >= start_date,
            InventoryLog.movement_date <= end_date,
        ]

        if movement_type:
            conditions.append(InventoryLog.movement_type == movement_type)

        result = await self.db.execute(
            select(InventoryLog)
            .where(and_(*conditions))
            .order_by(InventoryLog.created_at.desc())
        )

        return list(result.scalars().all())

    async def get_logs_by_sale(
        self,
        sale_id: UUID
    ) -> list[InventoryLog]:
        result = await self.db.execute(
            select(InventoryLog)
            .where(InventoryLog.sale_id == sale_id)
            .order_by(InventoryLog.created_at.desc())
        )
        return list(result.scalars().all())

    async def get_logs_by_order(
        self,
        order_id: UUID
    ) -> list[InventoryLog]:
        result = await self.db.execute(
            select(InventoryLog)
            .where(InventoryLog.order_id == order_id)
            .order_by(InventoryLog.created_at.desc())
        )
        return list(result.scalars().all())
