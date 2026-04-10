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

        # Count existing alterations this year
        result = await self.db.execute(
            select(func.count(Alteration.id)).where(
                Alteration.code.like(f"{prefix}%")
            )
        )
        count = result.scalar_one()

        # Generate next sequence number
        sequence = count + 1
        return f"{prefix}{sequence:04d}"

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
            external_client_name=data.external_client_name,
            external_client_phone=data.external_client_phone,
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
        return await self.get(alteration.id)  # type: ignore

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

        # Get non-None fields from update data
        update_data = data.model_dump(exclude_unset=True)

        for field, value in update_data.items():
            setattr(alteration, field, value)

        # Auto-set delivered_date when status changes to DELIVERED
        if data.status == AlterationStatus.DELIVERED and not alteration.delivered_date:
            alteration.delivered_date = get_colombia_date()

        await self.db.flush()

        # Re-fetch with client preloaded
        return await self.get(alteration_id)

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

        alteration.status = new_status

        if new_status == AlterationStatus.DELIVERED:
            alteration.delivered_date = get_colombia_date()

        await self.db.flush()

        # Re-fetch with client preloaded
        return await self.get(alteration_id)

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

        return payment

    # ============================================
    # List and Search Operations
    # ============================================

    async def list(
        self,
        skip: int = 0,
        limit: int = 100,
        status: AlterationStatus | None = None,
        alteration_type: AlterationType | None = None,
        search: str | None = None,
        start_date: date | None = None,
        end_date: date | None = None,
        is_paid: bool | None = None
    ) -> list[Alteration]:
        """
        List alterations with optional filters.

        Args:
            skip: Number of records to skip
            limit: Maximum number of records to return
            status: Filter by status
            alteration_type: Filter by type
            search: Search in code, garment_name, client names
            start_date: Filter by received_date >= start_date
            end_date: Filter by received_date <= end_date
            is_paid: Filter by payment status

        Returns:
            List of Alteration objects
        """
        # Use selectinload for client to avoid lazy-loading errors in async context
        query = (
            select(Alteration)
            .options(selectinload(Alteration.client))
            .order_by(Alteration.created_at.desc())
        )

        # Apply filters
        if status:
            query = query.where(Alteration.status == status)

        if alteration_type:
            query = query.where(Alteration.alteration_type == alteration_type)

        if search:
            search_term = f"%{search}%"
            query = query.where(
                or_(
                    Alteration.code.ilike(search_term),
                    Alteration.garment_name.ilike(search_term),
                    Alteration.external_client_name.ilike(search_term),
                    Alteration.description.ilike(search_term)
                )
            )

        if start_date:
            query = query.where(Alteration.received_date >= start_date)

        if end_date:
            query = query.where(Alteration.received_date <= end_date)

        if is_paid is not None:
            if is_paid:
                query = query.where(Alteration.amount_paid >= Alteration.cost)
            else:
                query = query.where(Alteration.amount_paid < Alteration.cost)

        # Exclude cancelled by default? No, let the caller filter if needed
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

    async def get_summary(self) -> AlterationsSummary:
        """
        Get summary statistics for alterations dashboard.

        Returns:
            AlterationsSummary with counts and totals
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

        # Total revenue (sum of amount_paid)
        revenue_result = await self.db.execute(
            select(func.coalesce(func.sum(Alteration.amount_paid), 0))
        )
        total_revenue = revenue_result.scalar_one()

        # Total pending payment (sum of balance where status != CANCELLED)
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
        total_pending = pending_result.scalar_one()

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

        return AlterationsSummary(
            total_count=total_count,
            pending_count=status_counts.get('pending', 0),
            in_progress_count=status_counts.get('in_progress', 0),
            ready_count=status_counts.get('ready', 0),
            delivered_count=status_counts.get('delivered', 0),
            cancelled_count=status_counts.get('cancelled', 0),
            total_revenue=Decimal(str(total_revenue)),
            total_pending_payment=Decimal(str(total_pending)),
            today_received=today_received,
            today_delivered=today_delivered
        )

    # ============================================
    # Helper Methods
    # ============================================

    async def count(
        self,
        status: AlterationStatus | None = None
    ) -> int:
        """Count alterations with optional status filter."""
        query = select(func.count(Alteration.id))

        if status:
            query = query.where(Alteration.status == status)

        result = await self.db.execute(query)
        return result.scalar_one()
