"""
Sale Cancellation Mixin

Contains sale cancellation methods:
- cancel_sale
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
from app.models.accounting import Transaction, TransactionType, AccPaymentMethod, AccountsReceivable
from app.models.inventory_log import InventoryMovementType
from app.services.global_product import GlobalInventoryService

logger = logging.getLogger(__name__)


class SaleCancellationMixin:
    """Mixin providing sale cancellation methods for SaleService"""

    db: AsyncSession  # Type hint for IDE support

    async def cancel_sale(
        self,
        sale_id: UUID,
        school_id: UUID,
        reason: str,
        cancelled_by: UUID | None = None,
        refund_method: PaymentMethod | None = None,
        max_days_to_cancel: int = 30
    ) -> dict:
        """
        Cancel a sale and revert all effects:
        1. Validate sale can be cancelled
        2. Restore inventory (school and global products)
        3. Create reverse transactions (refunds)
        4. Cancel accounts receivable
        5. Update sale status

        Args:
            sale_id: Sale UUID
            school_id: School UUID
            reason: Cancellation reason
            cancelled_by: User ID who is cancelling
            refund_method: Payment method for refund (defaults to original)
            max_days_to_cancel: Maximum days since sale to allow cancellation

        Returns:
            Dict with cancellation details

        Raises:
            ValueError: If sale cannot be cancelled
        """
        from app.services.inventory import InventoryService
        from app.services.balance_integration import BalanceIntegrationService

        inv_service = InventoryService(self.db)
        global_inv_service = GlobalInventoryService(self.db)
        balance_service = BalanceIntegrationService(self.db)

        # === PASO 1: OBTENER VENTA CON TODAS LAS RELACIONES ===
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

        # === PASO 2: VALIDACIONES ===
        # 2.1 Verificar que no esté ya cancelada
        if sale.status == SaleStatus.CANCELLED:
            raise ValueError("La venta ya está cancelada")

        # 2.2 Verificar antigüedad
        sale_date = sale.sale_date.date() if hasattr(sale.sale_date, 'date') else sale.sale_date
        days_since_sale = (get_colombia_date() - sale_date).days
        if days_since_sale > max_days_to_cancel:
            raise ValueError(f"No se puede cancelar ventas con más de {max_days_to_cancel} días. Esta venta tiene {days_since_sale} días.")

        # 2.3 Verificar que no tenga cambios aprobados
        changes_result = await self.db.execute(
            select(SaleChange).where(
                SaleChange.sale_id == sale_id,
                SaleChange.status == ChangeStatus.APPROVED
            )
        )
        approved_changes = changes_result.scalars().first()
        if approved_changes:
            raise ValueError("No se puede cancelar ventas con cambios aprobados. Primero revierta los cambios.")

        # Variables de tracking
        inventory_restored = False
        transactions_reversed = False
        receivables_cancelled = False

        # === PASO 3: ROLLBACK DE INVENTARIO ===
        # Solo si no fue venta historica (que no afecto inventario)
        if not sale.is_historical:
            for item in sale.items:
                try:
                    if item.is_global_product and item.global_product_id:
                        # Devolver a inventario global
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
                        # Devolver a inventario del colegio
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

        # === PASO 4: ROLLBACK CONTABLE ===
        # Obtener todas las transacciones de la venta
        txn_result = await self.db.execute(
            select(Transaction).where(
                Transaction.sale_id == sale_id,
                Transaction.type == TransactionType.INCOME
            )
        )
        transactions = txn_result.scalars().all()

        for txn in transactions:
            # Crear transaccion inversa (EXPENSE para devolver dinero)
            # Usar metodo de reembolso especificado o el original
            actual_refund_method = refund_method or txn.payment_method

            # Mapear PaymentMethod a AccPaymentMethod si es necesario
            if isinstance(actual_refund_method, PaymentMethod):
                payment_method_map = {
                    PaymentMethod.CASH: AccPaymentMethod.CASH,
                    PaymentMethod.NEQUI: AccPaymentMethod.NEQUI,
                    PaymentMethod.TRANSFER: AccPaymentMethod.TRANSFER,
                    PaymentMethod.CARD: AccPaymentMethod.CARD,
                    PaymentMethod.CREDIT: AccPaymentMethod.CREDIT,
                }
                actual_refund_method = payment_method_map.get(actual_refund_method, AccPaymentMethod.CASH)

            reverse_transaction = Transaction(
                school_id=sale.school_id,
                type=TransactionType.EXPENSE,
                amount=txn.amount,
                payment_method=actual_refund_method,
                description=f"Cancelacion venta {sale.code}: {reason}",
                category="sale_cancellation",
                reference_code=f"CANC-{sale.code}",
                transaction_date=get_colombia_date(),
                sale_id=sale.id,
                created_by=cancelled_by
            )
            self.db.add(reverse_transaction)
            await self.db.flush()

            # Aplicar a balance (restar de la misma cuenta donde entró el dinero)
            # force_income_map=True asegura que CASH reste de Caja Menor (no Caja Mayor)
            try:
                await balance_service.apply_transaction_to_balance(
                    reverse_transaction, cancelled_by, force_income_map=True
                )
                logger.info(f"Created reverse transaction for sale {sale.code}: {txn.amount} via {actual_refund_method}")
            except Exception as e:
                logger.error(f"Error applying reverse transaction to balance: {e}")
                raise ValueError(f"Error al revertir transacción contable: {str(e)}")

        if transactions:
            transactions_reversed = True

        # === PASO 5: CANCELAR CUENTAS POR COBRAR ===
        rec_result = await self.db.execute(
            select(AccountsReceivable).where(
                AccountsReceivable.sale_id == sale_id,
                AccountsReceivable.is_paid == False
            )
        )
        receivables = rec_result.scalars().all()

        for receivable in receivables:
            receivable.is_paid = True
            receivable.amount_paid = receivable.amount  # Marcar como saldada
            receivable.notes = f"{receivable.notes or ''}\n[Cancelada por venta cancelada: {reason}]".strip()
            logger.info(f"Cancelled receivable {receivable.id} for sale {sale.code}")

        if receivables:
            receivables_cancelled = True

        # === PASO 6: ACTUALIZAR ESTADO DE LA VENTA ===
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
