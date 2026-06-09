"""
Alteration Service - Business logic for repairs/alterations portal.

GLOBAL module (no school_id) - operates business-wide like accounting.
"""
from __future__ import annotations
from uuid import UUID
from datetime import datetime, date
from decimal import Decimal
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
import logging

from app.utils.timezone import get_colombia_date
from app.models.alteration import Alteration, AlterationPayment, AlterationType, AlterationStatus
from app.models.client import Client
from app.models.accounting import Transaction, TransactionType, AccPaymentMethod
from app.schemas.alteration import (
    AlterationCreate, AlterationUpdate, AlterationPaymentCreate,
    AlterationsSummary, AlterationListResponse
)
from app.utils.payment_methods import STR_TO_ACC

logger = logging.getLogger(__name__)


PAYMENT_METHOD_MAP = STR_TO_ACC


class AlterationService:
    """
    Service for managing alterations (repairs/tailoring).

    This is a GLOBAL service - alterations are not tied to schools.
    All accounting integrations use the global balance accounts.
    """

    def __init__(self, db: AsyncSession):
        self.db = db

    @staticmethod
    def _fire_alert(alert_type: str, message: str) -> None:
        """Fan out a best-effort Telegram alert.

        Alterations are a global module (no school), so school_id is omitted —
        routing reaches every subscriber of ``alert_type``. Non-blocking: a
        Telegram failure never affects the alteration operation.
        """
        from app.services.telegram import fire_and_forget_routed_alert

        fire_and_forget_routed_alert(alert_type, message)

    def _notify_if_delivered(
        self, alteration: Alteration | None, was_delivered: bool
    ) -> None:
        """Fire ``alteration_delivered`` only on the first transition into DELIVERED.

        ``was_delivered`` is the status captured before the mutation; this guards
        against re-firing when an already-delivered alteration is edited again.
        """
        if (
            alteration is None
            or was_delivered
            or alteration.status != AlterationStatus.DELIVERED
        ):
            return
        try:
            from app.services.telegram_messages import TelegramMessageBuilder

            self._fire_alert(
                "alteration_delivered",
                TelegramMessageBuilder.alteration_delivered(
                    code=alteration.code,
                    garment_name=alteration.garment_name,
                    client_name=alteration.client_display_name or None,
                ),
            )
        except Exception as e:
            logger.error("Telegram alteration_delivered alert failed: %s", e)

    # ============================================
    # Code Generation
    # ============================================

    async def _generate_code(self) -> str:
        """
        Generate unique alteration code: ARR-YYYY-NNNN

        Examples: ARR-2026-0001, ARR-2026-0002, etc.
        """
        year = get_colombia_date().year
        prefix = f"ARR-{year}-"

        # Derivar del MAYOR consecutivo existente, no de count(*): un count se
        # desincroniza ante cualquier borrado y reutiliza numeros (colisiona el
        # UNIQUE de alterations.code y rompe la trazabilidad de la secuencia).
        # FOR UPDATE serializa la generacion concurrente (mismo patron que encargos
        # en order/utilities.py): sin el lock, dos arreglos simultaneos leen el mismo
        # maximo y generan el mismo ARR-, colisionando el UNIQUE con un 500.
        result = await self.db.execute(
            select(Alteration.code)
            .where(Alteration.code.like(f"{prefix}%"))
            .order_by(Alteration.code.desc())
            .limit(1)
            .with_for_update()
        )
        max_code = result.scalar_one_or_none()

        if max_code:
            try:
                last_num = int(max_code.rsplit("-", 1)[1])
            except (IndexError, ValueError):
                last_num = 0
        else:
            last_num = 0

        return f"{prefix}{last_num + 1:04d}"

    # ============================================
    # CRUD Operations
    # ============================================

    async def create(
        self,
        data: AlterationCreate,
        created_by: UUID | None = None
    ) -> Alteration:
        """
        Create a new alteration.

        Args:
            data: Alteration creation data
            created_by: ID of user creating the alteration

        Returns:
            Created Alteration
        """
        code = await self._generate_code()

        alteration = Alteration(
            code=code,
            client_id=data.client_id,
            alteration_type=data.alteration_type,
            garment_name=data.garment_name,
            description=data.description,
            cost=data.cost,
            received_date=data.received_date,
            estimated_delivery_date=data.estimated_delivery_date,
            notes=data.notes,
            created_by=created_by,
            status=AlterationStatus.PENDING,
            amount_paid=Decimal("0")
        )

        self.db.add(alteration)
        await self.db.flush()

        # Handle initial payment if provided
        if data.initial_payment and data.initial_payment_method:
            payment_data = AlterationPaymentCreate(
                amount=data.initial_payment,
                payment_method=data.initial_payment_method,
                apply_accounting=True
            )
            await self.record_payment(
                alteration_id=alteration.id,
                data=payment_data,
                created_by=created_by
            )

        # Re-fetch with client preloaded to avoid lazy-loading errors
        created = await self.get(alteration.id)

        if created:
            try:
                from app.services.telegram_messages import TelegramMessageBuilder

                self._fire_alert(
                    "alteration_received",
                    TelegramMessageBuilder.alteration_received(
                        code=created.code,
                        garment_name=created.garment_name,
                        cost=created.cost,
                        client_name=created.client_display_name or None,
                        alteration_type=created.alteration_type.value,
                    ),
                )
            except Exception as e:
                logger.error("Telegram alteration_received alert failed: %s", e)

        return created  # type: ignore

    async def get(self, alteration_id: UUID) -> Alteration | None:
        """Get alteration by ID with client preloaded."""
        result = await self.db.execute(
            select(Alteration)
            .options(selectinload(Alteration.client))
            .where(Alteration.id == alteration_id)
        )
        return result.scalar_one_or_none()

    async def get_by_code(self, code: str) -> Alteration | None:
        """Get alteration by code (ARR-YYYY-NNNN) with client preloaded."""
        result = await self.db.execute(
            select(Alteration)
            .options(selectinload(Alteration.client))
            .where(Alteration.code == code)
        )
        return result.scalar_one_or_none()

    async def get_with_payments(self, alteration_id: UUID) -> Alteration | None:
        """Get alteration with payments loaded."""
        result = await self.db.execute(
            select(Alteration)
            .options(
                selectinload(Alteration.payments),
                selectinload(Alteration.client)
            )
            .where(Alteration.id == alteration_id)
        )
        return result.scalar_one_or_none()

    async def update(
        self,
        alteration_id: UUID,
        data: AlterationUpdate
    ) -> Alteration | None:
        """
        Update an alteration.

        Args:
            alteration_id: ID of alteration to update
            data: Update data

        Returns:
            Updated Alteration or None if not found
        """
        alteration = await self.get(alteration_id)
        if not alteration:
            return None

        was_delivered = alteration.status == AlterationStatus.DELIVERED

        # Get non-None fields from update data
        update_data = data.model_dump(exclude_unset=True)

        for field, value in update_data.items():
            setattr(alteration, field, value)

        # Auto-set delivered_date when status changes to DELIVERED
        if data.status == AlterationStatus.DELIVERED and not alteration.delivered_date:
            alteration.delivered_date = get_colombia_date()

        # Auto-stamp ready_at on first transition to READY so reports can
        # compute response time (received -> ready) independent of pickup.
        if data.status == AlterationStatus.READY and alteration.ready_at is None:
            from app.utils.timezone import get_colombia_now_naive
            alteration.ready_at = get_colombia_now_naive()

        await self.db.flush()

        # Re-fetch with client preloaded
        updated = await self.get(alteration_id)

        self._notify_if_delivered(updated, was_delivered)

        return updated

    async def update_status(
        self,
        alteration_id: UUID,
        new_status: AlterationStatus
    ) -> Alteration | None:
        """
        Update alteration status.

        Automatically sets delivered_date when marking as DELIVERED.
        """
        alteration = await self.get(alteration_id)
        if not alteration:
            return None

        was_delivered = alteration.status == AlterationStatus.DELIVERED
        alteration.status = new_status

        if new_status == AlterationStatus.DELIVERED:
            alteration.delivered_date = get_colombia_date()

        # First transition to READY stamps the timestamp used by response-time
        # KPIs. Skipped if already set (preserves the original ready moment).
        if new_status == AlterationStatus.READY and alteration.ready_at is None:
            from app.utils.timezone import get_colombia_now_naive
            alteration.ready_at = get_colombia_now_naive()

        await self.db.flush()

        # Re-fetch with client preloaded
        updated = await self.get(alteration_id)

        self._notify_if_delivered(updated, was_delivered)

        return updated

    async def cancel(self, alteration_id: UUID) -> Alteration | None:
        """
        Cancel an alteration.

        Only allowed if no payments have been recorded.
        """
        alteration = await self.get_with_payments(alteration_id)
        if not alteration:
            return None

        if alteration.amount_paid > Decimal("0"):
            raise ValueError(
                "No se puede cancelar un arreglo que ya tiene pagos. "
                "Primero debe reversar los pagos."
            )

        alteration.status = AlterationStatus.CANCELLED
        await self.db.flush()

        # Re-fetch with client preloaded
        return await self.get(alteration_id)

    # ============================================
    # Payment Operations
    # ============================================

    async def record_payment(
        self,
        alteration_id: UUID,
        data: AlterationPaymentCreate,
        created_by: UUID | None = None
    ) -> AlterationPayment:
        """
        Record a payment for an alteration.

        Optionally creates a Transaction(INCOME, category='alterations')
        and updates the global balance account.

        Args:
            alteration_id: ID of the alteration
            data: Payment data
            created_by: ID of user recording the payment

        Returns:
            Created AlterationPayment

        Raises:
            ValueError: If alteration not found or payment exceeds balance
        """
        alteration = await self.get(alteration_id)
        if not alteration:
            raise ValueError("Arreglo no encontrado")

        # Validate payment doesn't exceed remaining balance
        remaining = alteration.balance
        if data.amount > remaining:
            raise ValueError(
                f"El pago (${data.amount:,.2f}) excede el saldo pendiente (${remaining:,.2f})"
            )

        # Calculate cash change (vueltas) for cash payments
        amount_received = None
        change_given = None
        if data.payment_method == 'cash':
            amt_received = getattr(data, 'amount_received', None)
            if amt_received is not None:
                if amt_received < data.amount:
                    raise ValueError(
                        f"El monto recibido ({amt_received}) "
                        f"debe ser mayor o igual al pago ({data.amount})"
                    )
                amount_received = amt_received
                change_given = amt_received - data.amount

        # Create payment record
        payment = AlterationPayment(
            alteration_id=alteration_id,
            amount=data.amount,
            payment_method=data.payment_method,
            notes=data.notes,
            created_by=created_by,
            amount_received=amount_received,
            change_given=change_given
        )
        self.db.add(payment)
        await self.db.flush()

        # Apply accounting if requested
        if data.apply_accounting and data.amount > Decimal("0"):
            acc_payment_method = PAYMENT_METHOD_MAP.get(
                data.payment_method,
                AccPaymentMethod.CASH
            )

            from app.services.accounting.transactions import TransactionService
            txn_service = TransactionService(self.db)
            transaction = await txn_service.record(
                type=TransactionType.INCOME,
                amount=data.amount,
                payment_method=acc_payment_method,
                description=f"Pago arreglo {alteration.code}",
                category="alterations",
                reference_code=alteration.code,
                transaction_date=get_colombia_date(),
                alteration_id=alteration_id,
                created_by=created_by,
            )
            payment.transaction_id = transaction.id

        # Update alteration paid amount
        alteration.amount_paid += data.amount
        await self.db.flush()
        await self.db.refresh(payment)

        try:
            from app.services.telegram_messages import TelegramMessageBuilder

            self._fire_alert(
                "alteration_payment",
                TelegramMessageBuilder.alteration_payment(
                    code=alteration.code,
                    amount=data.amount,
                    balance=alteration.balance,
                    payment_method=data.payment_method,
                    client_name=alteration.client_display_name or None,
                ),
            )
        except Exception as e:
            logger.error("Telegram alteration_payment alert failed: %s", e)

        return payment

    # ============================================
    # List and Search Operations
    # ============================================

    def _build_filters(
        self,
        status: AlterationStatus | None = None,
        alteration_type: AlterationType | None = None,
        search: str | None = None,
        start_date: date | None = None,
        end_date: date | None = None,
        is_paid: bool | None = None,
        client_id: UUID | None = None,
    ) -> list:
        filters = []
        if status:
            filters.append(Alteration.status == status)
        if alteration_type:
            filters.append(Alteration.alteration_type == alteration_type)
        if client_id:
            filters.append(Alteration.client_id == client_id)
        if search:
            search_term = f"%{search}%"
            filters.append(
                or_(
                    Alteration.code.ilike(search_term),
                    Alteration.garment_name.ilike(search_term),
                    Alteration.description.ilike(search_term),
                    Alteration.client.has(Client.name.ilike(search_term)),
                    Alteration.client.has(Client.phone.ilike(search_term)),
                )
            )
        if start_date:
            filters.append(Alteration.received_date >= start_date)
        if end_date:
            filters.append(Alteration.received_date <= end_date)
        if is_paid is not None:
            if is_paid:
                filters.append(Alteration.amount_paid >= Alteration.cost)
            else:
                filters.append(Alteration.amount_paid < Alteration.cost)
        return filters

    async def count(self, **filter_kwargs) -> int:
        filters = self._build_filters(**filter_kwargs)
        stmt = select(func.count(Alteration.id))
        if filters:
            stmt = stmt.where(*filters)
        return (await self.db.execute(stmt)).scalar_one()

    async def list(
        self,
        skip: int = 0,
        limit: int = 100,
        status: AlterationStatus | None = None,
        alteration_type: AlterationType | None = None,
        search: str | None = None,
        start_date: date | None = None,
        end_date: date | None = None,
        is_paid: bool | None = None,
        client_id: UUID | None = None,
    ) -> list[Alteration]:
        filters = self._build_filters(
            status=status, alteration_type=alteration_type,
            search=search, start_date=start_date, end_date=end_date,
            is_paid=is_paid, client_id=client_id,
        )
        query = (
            select(Alteration)
            .options(selectinload(Alteration.client))
            .order_by(Alteration.created_at.desc())
        )
        if filters:
            query = query.where(*filters)
        query = query.offset(skip).limit(limit)

        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def get_payments(self, alteration_id: UUID) -> list[AlterationPayment]:
        """Get all payments for an alteration."""
        result = await self.db.execute(
            select(AlterationPayment)
            .where(AlterationPayment.alteration_id == alteration_id)
            .order_by(AlterationPayment.created_at.desc())
        )
        return list(result.scalars().all())

    # ============================================
    # Statistics and Summary
    # ============================================

    async def get_summary(
        self,
        include_financials: bool = True,
        start_date: date | None = None,
        end_date: date | None = None,
    ) -> AlterationsSummary:
        """
        Get summary statistics for alterations dashboard.

        Args:
            include_financials: Whether to compute and return total_revenue
                and total_pending_payment. When False, both fields are
                returned as None and their queries are skipped.
            start_date, end_date: Optional period for the new
                `*_in_period` and `revenue_in_period` fields. When omitted
                (legacy callers like the dashboard widget), behavior is
                identical to before this argument was added.

        Returns:
            AlterationsSummary with counts and totals. When dates are
            provided, also populates `received_in_period`,
            `delivered_in_period`, and `revenue_in_period`.
        """
        today = get_colombia_date()

        # Total count
        total_result = await self.db.execute(
            select(func.count(Alteration.id))
        )
        total_count = total_result.scalar_one()

        # Count by status
        status_counts = {}
        for status in AlterationStatus:
            result = await self.db.execute(
                select(func.count(Alteration.id)).where(
                    Alteration.status == status
                )
            )
            status_counts[status.value] = result.scalar_one()

        total_revenue: Decimal | None = None
        total_pending: Decimal | None = None
        if include_financials:
            revenue_result = await self.db.execute(
                select(func.coalesce(func.sum(Alteration.amount_paid), 0))
            )
            total_revenue = Decimal(str(revenue_result.scalar_one()))

            pending_result = await self.db.execute(
                select(
                    func.coalesce(
                        func.sum(Alteration.cost - Alteration.amount_paid),
                        0
                    )
                ).where(
                    Alteration.status != AlterationStatus.CANCELLED,
                    Alteration.amount_paid < Alteration.cost
                )
            )
            total_pending = Decimal(str(pending_result.scalar_one()))

        # Today's counts
        today_received_result = await self.db.execute(
            select(func.count(Alteration.id)).where(
                Alteration.received_date == today
            )
        )
        today_received = today_received_result.scalar_one()

        today_delivered_result = await self.db.execute(
            select(func.count(Alteration.id)).where(
                Alteration.delivered_date == today
            )
        )
        today_delivered = today_delivered_result.scalar_one()

        # Period-scoped aggregations (Fase 2 — Reports Coverage)
        received_in_period: int | None = None
        delivered_in_period: int | None = None
        revenue_in_period: Decimal | None = None
        if start_date is not None or end_date is not None:
            from app.models.alteration import AlterationPayment

            # Build received_date / delivered_date filters
            received_filters = []
            delivered_filters = []
            payment_filters = []
            if start_date is not None:
                received_filters.append(Alteration.received_date >= start_date)
                delivered_filters.append(Alteration.delivered_date >= start_date)
                payment_filters.append(AlterationPayment.created_at >= start_date)
            if end_date is not None:
                received_filters.append(Alteration.received_date <= end_date)
                delivered_filters.append(Alteration.delivered_date <= end_date)
                # AlterationPayment.created_at is a DateTime; compare against
                # end_of_day to include payments made on end_date.
                from datetime import datetime
                payment_filters.append(
                    AlterationPayment.created_at <= datetime.combine(end_date, datetime.max.time())
                )

            received_in_period = (
                await self.db.execute(
                    select(func.count(Alteration.id)).where(*received_filters)
                )
            ).scalar_one()

            delivered_in_period = (
                await self.db.execute(
                    select(func.count(Alteration.id)).where(
                        Alteration.delivered_date.isnot(None),
                        *delivered_filters,
                    )
                )
            ).scalar_one()

            if include_financials:
                # Revenue in period: sum of AlterationPayment.amount whose
                # created_at falls in the window. Split-payment safe by
                # construction (each payment row contributes independently).
                revenue_in_period = Decimal(str(
                    (await self.db.execute(
                        select(func.coalesce(func.sum(AlterationPayment.amount), 0))
                        .where(*payment_filters)
                    )).scalar_one()
                ))

        return AlterationsSummary(
            total_count=total_count,
            pending_count=status_counts.get('pending', 0),
            in_progress_count=status_counts.get('in_progress', 0),
            ready_count=status_counts.get('ready', 0),
            delivered_count=status_counts.get('delivered', 0),
            cancelled_count=status_counts.get('cancelled', 0),
            total_revenue=total_revenue,
            total_pending_payment=total_pending,
            today_received=today_received,
            today_delivered=today_delivered,
            period_start=start_date,
            period_end=end_date,
            revenue_in_period=revenue_in_period,
            received_in_period=received_in_period,
            delivered_in_period=delivered_in_period,
        )

    # ============================================
    # Reports Coverage — Fase 2
    # ============================================

    async def get_response_time_metrics(
        self,
        start_date: date | None = None,
        end_date: date | None = None,
        overdue_pickup_threshold_days: int = 7,
    ):
        """Operational KPIs for alteration turnaround.

        - avg/median received -> ready (production time)
        - avg ready -> delivered (pickup time)
        - overdue_pickup: alterations marked READY more than
          `overdue_pickup_threshold_days` days ago but not yet DELIVERED

        Returns ``AlterationsResponseTime`` (in app.schemas.reports).
        """
        from datetime import datetime, timedelta
        from sqlalchemy import cast, Numeric, Date as SADate
        from app.schemas.reports import AlterationsResponseTime

        # received_to_ready window applies to ready_at (Fase 1 migration).
        # Rows with ready_at IS NULL are excluded from the avg/median.
        ready_filters = [Alteration.ready_at.isnot(None)]
        if start_date is not None:
            ready_filters.append(Alteration.ready_at >= datetime.combine(start_date, datetime.min.time()))
        if end_date is not None:
            ready_filters.append(Alteration.ready_at <= datetime.combine(end_date, datetime.max.time()))

        # (ready_at::date - received_date) is INTEGER days in PostgreSQL.
        days_received_to_ready = cast(Alteration.ready_at, SADate) - Alteration.received_date

        ready_row = (
            await self.db.execute(
                select(
                    func.avg(cast(days_received_to_ready, Numeric)).label('avg_days'),
                    func.percentile_cont(0.5)
                        .within_group(days_received_to_ready)
                        .label('median_days'),
                    func.count(Alteration.id).label('sample'),
                ).where(*ready_filters)
            )
        ).one()

        avg_r2r = float(ready_row.avg_days) if ready_row.avg_days is not None else None
        median_r2r = float(ready_row.median_days) if ready_row.median_days is not None else None
        sample_r2r = int(ready_row.sample or 0)

        # ready_to_delivered window applies to delivered_date.
        delivered_filters = [
            Alteration.delivered_date.isnot(None),
            Alteration.ready_at.isnot(None),
        ]
        if start_date is not None:
            delivered_filters.append(Alteration.delivered_date >= start_date)
        if end_date is not None:
            delivered_filters.append(Alteration.delivered_date <= end_date)

        days_ready_to_delivered = (
            Alteration.delivered_date - cast(Alteration.ready_at, SADate)
        )

        deliv_row = (
            await self.db.execute(
                select(
                    func.avg(cast(days_ready_to_delivered, Numeric)).label('avg_days'),
                    func.count(Alteration.id).label('sample'),
                ).where(*delivered_filters)
            )
        ).one()

        avg_r2d = float(deliv_row.avg_days) if deliv_row.avg_days is not None else None
        sample_r2d = int(deliv_row.sample or 0)

        # Overdue pickup: READY but not delivered, with ready_at more than
        # threshold days ago (cliente no ha regresado a retirar).
        today = get_colombia_date()
        cutoff_date = today - timedelta(days=overdue_pickup_threshold_days)
        cutoff_dt = datetime.combine(cutoff_date, datetime.max.time())

        overdue_filters = [
            Alteration.status == AlterationStatus.READY,
            Alteration.ready_at.isnot(None),
            Alteration.ready_at <= cutoff_dt,
        ]
        overdue_count = (
            await self.db.execute(
                select(func.count(Alteration.id)).where(*overdue_filters)
            )
        ).scalar_one()
        overdue_revenue_pending = Decimal(str(
            (await self.db.execute(
                select(func.coalesce(func.sum(Alteration.cost - Alteration.amount_paid), 0))
                .where(*overdue_filters)
            )).scalar_one()
        ))

        return AlterationsResponseTime(
            period_start=start_date,
            period_end=end_date,
            avg_received_to_ready_days=round(avg_r2r, 2) if avg_r2r is not None else None,
            median_received_to_ready_days=round(median_r2r, 2) if median_r2r is not None else None,
            sample_received_to_ready=sample_r2r,
            avg_ready_to_delivered_days=round(avg_r2d, 2) if avg_r2d is not None else None,
            sample_ready_to_delivered=sample_r2d,
            overdue_pickup_count=int(overdue_count),
            overdue_pickup_threshold_days=overdue_pickup_threshold_days,
            overdue_pickup_revenue_pending=overdue_revenue_pending,
        )

    async def get_top_types(
        self,
        limit: int = 5,
        start_date: date | None = None,
        end_date: date | None = None,
    ):
        """Top alteration types by volume in the period.

        Returns ``list[AlterationsTopType]`` (in app.schemas.reports).
        ``avg_response_hours`` only counts rows with ``ready_at`` set —
        legacy rows are excluded from the average, not approximated.
        """
        from sqlalchemy import cast, Numeric, case as sa_case
        from app.schemas.reports import AlterationsTopType
        from app.models.alteration import AlterationType

        filters: list = []
        if start_date is not None:
            filters.append(Alteration.received_date >= start_date)
        if end_date is not None:
            filters.append(Alteration.received_date <= end_date)

        # PostgreSQL: TIMESTAMP - DATE yields INTERVAL; extract epoch then
        # divide by 3600 to get hours. CASE guards against NULL ready_at
        # so the avg doesn't pull legacy rows into its denominator.
        hours_expr = func.extract(
            'epoch',
            Alteration.ready_at - Alteration.received_date,
        ) / 3600.0
        avg_hours_expr = func.avg(
            sa_case(
                (Alteration.ready_at.isnot(None), cast(hours_expr, Numeric)),
                else_=None,
            )
        )

        query = (
            select(
                Alteration.alteration_type,
                func.count(Alteration.id).label('count'),
                func.coalesce(func.sum(Alteration.cost), 0).label('revenue'),
                avg_hours_expr.label('avg_hours'),
            )
            .where(*filters)
            .group_by(Alteration.alteration_type)
            .order_by(func.count(Alteration.id).desc())
            .limit(limit)
        )
        rows = (await self.db.execute(query)).all()

        # Spanish labels — mirror the comments next to each enum value
        # in app.models.alteration.AlterationType.
        type_labels: dict[AlterationType, str] = {
            AlterationType.HEM: 'Dobladillo',
            AlterationType.LENGTH: 'Largo',
            AlterationType.WIDTH: 'Ancho',
            AlterationType.SEAM: 'Costura',
            AlterationType.BUTTONS: 'Botones',
            AlterationType.ZIPPER: 'Cremallera',
            AlterationType.PATCH: 'Parche',
            AlterationType.DARTS: 'Pinzas',
            AlterationType.OTHER: 'Otro',
        }

        return [
            AlterationsTopType(
                alteration_type=row.alteration_type.value,
                type_label=type_labels.get(row.alteration_type, row.alteration_type.value),
                count=int(row.count),
                revenue=Decimal(str(row.revenue)),
                avg_response_hours=(
                    round(float(row.avg_hours), 1)
                    if row.avg_hours is not None else None
                ),
            )
            for row in rows
        ]

    # ============================================
    # Helper Methods
    # ============================================

    async def count_by_status(
        self,
        status: AlterationStatus | None = None
    ) -> int:
        query = select(func.count(Alteration.id))
        if status:
            query = query.where(Alteration.status == status)
        result = await self.db.execute(query)
        return result.scalar_one()
