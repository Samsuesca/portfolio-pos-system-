"""Sale cancellation with full reversal of inventory, accounting, and receivables.

Implements an all-or-nothing cancellation: if any step fails (inventory
restoration, reverse transaction, or balance update), the entire operation
rolls back. This is stricter than creation — a half-cancelled sale is worse
than a failed cancellation that the user can retry.

Cancellation steps (in order):
    1. Validate sale exists, is not already cancelled, and is within the
       allowed cancellation window (default: 30 days).
    2. Restore inventory for each item (school and global products).
    3. Create reverse accounting transactions (EXPENSE) and update balance.
    4. Mark unpaid AccountsReceivable as settled.
    5. Update sale status to CANCELLED.
"""
import logging
from uuid import UUID
from datetime import datetime, date as date_type
from decimal import Decimal
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.utils.timezone import get_colombia_date, get_colombia_now_naive
from app.models.sale import Sale, SaleStatus, SaleChange, ChangeStatus, PaymentMethod
from app.models.accounting import Transaction, TransactionType, AccountsReceivable
from app.utils.payment_methods import to_acc_payment_method
from app.models.inventory_log import InventoryMovementType
from app.services.global_product import GlobalInventoryService

logger = logging.getLogger(__name__)


class SaleCancellationMixin:
    """Provides ``cancel_sale`` to :class:`SaleService`."""

    db: AsyncSession

    async def cancel_sale(
        self,
        sale_id: UUID,
        school_id: UUID,
        reason: str,
        cancelled_by: UUID | None = None,
        refund_method: PaymentMethod | None = None,
        max_days_to_cancel: int = 30
    ) -> dict:
        """Cancel a sale and reverse all its effects.

        Args:
            sale_id: Sale UUID to cancel.
            school_id: School UUID for tenant isolation.
            reason: Free-text reason (stored in sale notes and reverse
                transaction descriptions).
            cancelled_by: User performing the cancellation.
            refund_method: Override payment method for the refund. If None,
                uses the original payment method from each transaction.
            max_days_to_cancel: Business rule — sales older than this
                cannot be cancelled. Default 30 days.

        Returns:
            Dict with cancellation summary::

                {
                    "id": UUID,
                    "code": str,
                    "status": SaleStatus.CANCELLED,
                    "cancelled_at": datetime,
                    "inventory_restored": bool,
                    "transactions_reversed": bool,
                    "receivables_cancelled": bool,
                    "message": str,
                }

        Raises:
            ValueError: Sale not found, already cancelled, too old,
                has approved changes, or inventory/accounting reversal fails.
        """
        from app.services.inventory import InventoryService
        from app.services.accounting.transactions import TransactionService

        inv_service = InventoryService(self.db)
        global_inv_service = GlobalInventoryService(self.db)
        txn_service = TransactionService(self.db)

        # ── Step 1: Load and validate ───────────────────────────────
        result = await self.db.execute(
            select(Sale)
            .options(
                selectinload(Sale.items),
                selectinload(Sale.payments)
            )
            .where(
                Sale.id == sale_id,
                Sale.school_id == school_id
            )
        )
        sale = result.scalar_one_or_none()

        if not sale:
            raise ValueError("Venta no encontrada")

        if sale.status == SaleStatus.CANCELLED:
            raise ValueError("La venta ya está cancelada")

        sale_date = sale.sale_date.date() if hasattr(sale.sale_date, 'date') else sale.sale_date
        days_since_sale = (get_colombia_date() - sale_date).days
        if days_since_sale > max_days_to_cancel:
            raise ValueError(f"No se puede cancelar ventas con más de {max_days_to_cancel} días. Esta venta tiene {days_since_sale} días.")

        changes_result = await self.db.execute(
            select(SaleChange).where(
                SaleChange.sale_id == sale_id,
                SaleChange.status == ChangeStatus.APPROVED
            )
        )
        approved_changes = changes_result.scalars().first()
        if approved_changes:
            raise ValueError("No se puede cancelar ventas con cambios aprobados. Primero revierta los cambios.")

        inventory_restored = False
        transactions_reversed = False
        receivables_cancelled = False

        # ── Step 2: Restore inventory ───────────────────────────────
        if not sale.is_historical:
            for item in sale.items:
                try:
                    if item.is_global_product and item.global_product_id:
                        await global_inv_service.release_stock(
                            product_id=item.global_product_id,
                            quantity=item.quantity,
                            movement_type=InventoryMovementType.SALE_CANCEL,
                            reference=sale.code,
                            sale_id=sale.id,
                            school_id=school_id,
                            created_by=cancelled_by,
                        )
                        logger.info(f"Restored {item.quantity} units of global product {item.global_product_id} for cancelled sale {sale.code}")
                    elif item.product_id:
                        await inv_service.release_stock(
                            product_id=item.product_id,
                            school_id=school_id,
                            quantity=item.quantity,
                            movement_type=InventoryMovementType.SALE_CANCEL,
                            reference=sale.code,
                            sale_id=sale.id,
                            created_by=cancelled_by,
                        )
                        logger.info(f"Restored {item.quantity} units of product {item.product_id} for cancelled sale {sale.code}")
                except Exception as e:
                    logger.error(f"Error restoring inventory for item {item.id}: {e}")
                    raise ValueError(f"Error al restaurar inventario: {str(e)}")

            inventory_restored = True

        # ── Step 3: Reverse accounting transactions ─────────────────
        txn_result = await self.db.execute(
            select(Transaction).where(
                Transaction.sale_id == sale_id,
                Transaction.type == TransactionType.INCOME
            )
        )
        transactions = txn_result.scalars().all()

        for txn in transactions:
            actual_refund_method = refund_method or txn.payment_method
            if isinstance(actual_refund_method, PaymentMethod):
                actual_refund_method = to_acc_payment_method(actual_refund_method)

            await txn_service.record(
                type=TransactionType.EXPENSE,
                amount=txn.amount,
                payment_method=actual_refund_method,
                description=f"Cancelacion venta {sale.code}: {reason}",
                school_id=sale.school_id,
                category="sale_cancellation",
                reference_code=f"CANC-{sale.code}",
                transaction_date=get_colombia_date(),
                sale_id=sale.id,
                created_by=cancelled_by,
                force_income_map=True,
            )
            logger.info(f"Created reverse transaction for sale {sale.code}: {txn.amount} via {actual_refund_method}")

        if transactions:
            transactions_reversed = True

        # ── Step 4: Cancel unpaid receivables ───────────────────────
        rec_result = await self.db.execute(
            select(AccountsReceivable).where(
                AccountsReceivable.sale_id == sale_id,
                AccountsReceivable.is_paid == False
            )
        )
        receivables = rec_result.scalars().all()

        for receivable in receivables:
            receivable.is_paid = True
            receivable.amount_paid = receivable.amount
            receivable.notes = f"{receivable.notes or ''}\n[Cancelada por venta cancelada: {reason}]".strip()
            logger.info(f"Cancelled receivable {receivable.id} for sale {sale.code}")

        if receivables:
            receivables_cancelled = True

        # ── Step 5: Update sale status ──────────────────────────────
        sale.status = SaleStatus.CANCELLED
        sale.notes = f"{sale.notes or ''}\n[Cancelada {get_colombia_date()}: {reason}]".strip()

        await self.db.flush()
        await self.db.refresh(sale)

        logger.info(f"Sale {sale.code} cancelled successfully. Inventory restored: {inventory_restored}, Transactions reversed: {transactions_reversed}, Receivables cancelled: {receivables_cancelled}")

        return {
            "id": sale.id,
            "code": sale.code,
            "status": sale.status,
            "cancelled_at": get_colombia_now_naive(),
            "inventory_restored": inventory_restored,
            "transactions_reversed": transactions_reversed,
            "receivables_cancelled": receivables_cancelled,
            "message": f"Venta {sale.code} cancelada exitosamente"
        }
