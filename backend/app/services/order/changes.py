"""
Order Changes Mixin

Contains order change (cambios y devoluciones de encargos) methods:
- create_order_change
- approve_order_change
- reject_order_change
- get_order_changes
"""
import logging
from uuid import UUID
from decimal import Decimal
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.utils.timezone import get_colombia_date, get_colombia_now_naive
from app.models.order import Order, OrderItem, OrderStatus, OrderItemStatus, OrderChange
from app.models.sale import ChangeStatus, ChangeType, PaymentMethod
from app.models.product import Product, GlobalProduct
from app.models.accounting import Transaction, TransactionType, AccPaymentMethod, AccountsReceivable
from app.models.inventory_log import InventoryMovementType
from app.schemas.order import OrderChangeCreate
from app.services.global_product import GlobalInventoryService

logger = logging.getLogger(__name__)


class OrderChangeMixin:
    """Mixin providing order change methods for OrderService"""

    db: AsyncSession  # Type hint for IDE support

    async def create_order_change(
        self,
        order_id: UUID,
        school_id: UUID,
        user_id: UUID,
        change_data: OrderChangeCreate
    ) -> OrderChange:
        """
        Create an order change request (size change, product change, return, defect).

        Args:
            order_id: Order UUID
            school_id: School UUID
            user_id: User creating the change
            change_data: Change request data

        Returns:
            Created OrderChange

        Raises:
            ValueError: If validation fails
        """
        # 1. Validate order exists and belongs to school
        order = await self.get_order_with_items(order_id, school_id)
        if not order:
            raise ValueError("Encargo no encontrado")

        if order.status == OrderStatus.CANCELLED:
            raise ValueError("No se puede modificar un encargo cancelado")

        # 2. Get original order item
        original_item_result = await self.db.execute(
            select(OrderItem)
            .options(
                selectinload(OrderItem.product),
                selectinload(OrderItem.global_product)
            )
            .where(
                OrderItem.id == change_data.original_item_id,
                OrderItem.order_id == order_id
            )
        )
        original_item = original_item_result.scalar_one_or_none()

        if not original_item:
            raise ValueError("Item original del encargo no encontrado")

        if original_item.item_status == OrderItemStatus.CANCELLED:
            raise ValueError("No se puede modificar un item cancelado")

        # Calculate quantity already returned by APPROVED changes for this item
        approved_changes_result = await self.db.execute(
            select(func.coalesce(func.sum(OrderChange.returned_quantity), 0))
            .where(
                OrderChange.original_item_id == original_item.id,
                OrderChange.status == ChangeStatus.APPROVED
            )
        )
        already_returned = approved_changes_result.scalar() or 0
        available_quantity = original_item.quantity - already_returned

        if change_data.returned_quantity > available_quantity:
            if already_returned > 0:
                raise ValueError(
                    f"Cantidad disponible insuficiente. "
                    f"Original: {original_item.quantity}, Ya devuelto: {already_returned}, "
                    f"Disponible: {available_quantity}"
                )
            else:
                raise ValueError("La cantidad a devolver no puede exceder la cantidad original")

        # 3. Initialize change record
        new_unit_price = None
        price_adjustment = Decimal("0")
        new_product_id = None
        new_global_product_id = None

        # 4. Handle change types that require new product
        if change_data.change_type != ChangeType.RETURN:
            if not change_data.new_product_id:
                raise ValueError(f"{change_data.change_type.value} requiere un nuevo producto")

            if change_data.is_new_global_product:
                # Get new GLOBAL product
                new_product_result = await self.db.execute(
                    select(GlobalProduct).where(
                        GlobalProduct.id == change_data.new_product_id,
                        GlobalProduct.is_active == True
                    )
                )
                new_product = new_product_result.scalar_one_or_none()

                if not new_product:
                    raise ValueError("Nuevo producto global no encontrado o inactivo")

                new_global_product_id = new_product.id
                new_unit_price = new_product.price
            else:
                # Get new SCHOOL product
                new_product_result = await self.db.execute(
                    select(Product).where(
                        Product.id == change_data.new_product_id,
                        Product.school_id == school_id,
                        Product.is_active == True
                    )
                )
                new_product = new_product_result.scalar_one_or_none()

                if not new_product:
                    raise ValueError("Nuevo producto no encontrado o inactivo")

                new_product_id = new_product.id
                new_unit_price = new_product.price

            # Calculate price adjustment
            price_adjustment = (
                (new_unit_price * change_data.new_quantity) -
                (original_item.unit_price * change_data.returned_quantity)
            )
        else:
            # Pure return - negative price adjustment (refund)
            price_adjustment = -(original_item.unit_price * change_data.returned_quantity)

        # 5. Create change record with status PENDING
        change = OrderChange(
            order_id=order_id,
            original_item_id=original_item.id,
            user_id=user_id,
            change_type=change_data.change_type,
            returned_quantity=change_data.returned_quantity,
            new_product_id=new_product_id,
            new_global_product_id=new_global_product_id,
            is_new_global_product=change_data.is_new_global_product,
            new_quantity=change_data.new_quantity,
            new_unit_price=new_unit_price,
            new_size=change_data.new_size,
            new_color=change_data.new_color,
            new_custom_measurements=change_data.new_custom_measurements,
            new_embroidery_text=change_data.new_embroidery_text,
            price_adjustment=price_adjustment,
            reason=change_data.reason,
            status=ChangeStatus.PENDING
        )

        self.db.add(change)
        await self.db.flush()
        await self.db.refresh(change)

        return change

    async def approve_order_change(
        self,
        change_id: UUID,
        school_id: UUID,
        payment_method: PaymentMethod = PaymentMethod.CASH,
        approved_by: UUID | None = None
    ) -> OrderChange:
        """
        Approve an order change and execute inventory + accounting adjustments.
        Modifies the original OrderItem in-place.

        Logic varies by original item status:
        - READY/DELIVERED: has reserved/delivered stock -> release it
        - PENDING/IN_PRODUCTION: no stock to release (in production)

        For non-return changes, the item is updated with new product info.
        For returns, the item quantity is reduced (or cancelled if 0).

        Args:
            change_id: OrderChange UUID
            school_id: School UUID
            payment_method: Payment method for price adjustment
            approved_by: User ID who approved

        Returns:
            Approved OrderChange

        Raises:
            ValueError: If change not found or already processed
        """
        from app.services.inventory import InventoryService
        from app.services.balance_integration import BalanceIntegrationService

        inv_service = InventoryService(self.db)
        global_inv_service = GlobalInventoryService(self.db)
        balance_service = BalanceIntegrationService(self.db)

        # Get change with related data
        result = await self.db.execute(
            select(OrderChange)
            .options(
                selectinload(OrderChange.order),
                selectinload(OrderChange.original_item).selectinload(OrderItem.product),
                selectinload(OrderChange.original_item).selectinload(OrderItem.global_product),
                selectinload(OrderChange.new_product),
                selectinload(OrderChange.new_global_product)
            )
            .where(OrderChange.id == change_id)
        )
        change = result.scalar_one_or_none()

        if not change:
            raise ValueError("Solicitud de cambio no encontrada")

        if change.order.school_id != school_id:
            raise ValueError("El cambio no pertenece a este colegio")

        if change.status != ChangeStatus.PENDING:
            raise ValueError(f"El cambio ya fue procesado: {change.status.value}")

        order = change.order
        item = change.original_item

        # === STEP 1: Release reserved stock from original item (if applicable) ===
        if item.reserved_from_stock and item.quantity_reserved > 0:
            quantity_to_release = min(change.returned_quantity, item.quantity_reserved)
            if quantity_to_release > 0:
                try:
                    if item.global_product_id:
                        await global_inv_service.release_stock(
                            product_id=item.global_product_id,
                            quantity=quantity_to_release,
                            movement_type=InventoryMovementType.CHANGE_RETURN,
                            reference=f"OCHG-{change.id}",
                            order_id=order.id,
                            school_id=school_id,
                            created_by=approved_by,
                        )
                    elif item.product_id:
                        await inv_service.release_stock(
                            product_id=item.product_id,
                            school_id=school_id,
                            quantity=quantity_to_release,
                            movement_type=InventoryMovementType.CHANGE_RETURN,
                            reference=f"OCHG-{change.id}",
                            order_id=order.id,
                            created_by=approved_by,
                        )
                    item.quantity_reserved -= quantity_to_release
                    if item.quantity_reserved <= 0:
                        item.reserved_from_stock = False
                    logger.info(f"Released {quantity_to_release} units for order change {change.id}")
                except Exception as e:
                    logger.warning(f"Could not release stock for order change {change.id}: {e}")

        # === STEP 2: Modify the OrderItem in-place ===
        if change.change_type == ChangeType.RETURN:
            # Reduce quantity or cancel item
            item.quantity -= change.returned_quantity
            if item.quantity <= 0:
                item.quantity = 0
                item.item_status = OrderItemStatus.CANCELLED
                item.status_updated_at = get_colombia_now_naive()
            item.subtotal = Decimal(str(item.unit_price)) * item.quantity
        else:
            # size_change, product_change, defect -> update item with new product
            if change.is_new_global_product:
                item.global_product_id = change.new_global_product_id
                item.product_id = None
                item.is_global_product = True
                # Update garment type from global product if available
                if change.new_global_product and hasattr(change.new_global_product, 'garment_type_id'):
                    item.global_garment_type_id = change.new_global_product.garment_type_id
            else:
                item.product_id = change.new_product_id
                item.global_product_id = None
                item.is_global_product = False
                # Update garment type from school product if available
                if change.new_product and hasattr(change.new_product, 'garment_type_id'):
                    item.garment_type_id = change.new_product.garment_type_id

            item.quantity = change.new_quantity
            item.unit_price = change.new_unit_price
            item.subtotal = Decimal(str(change.new_unit_price)) * change.new_quantity

            # Update specifications if provided
            if change.new_size is not None:
                item.size = change.new_size
            if change.new_color is not None:
                item.color = change.new_color
            if change.new_custom_measurements is not None:
                item.custom_measurements = change.new_custom_measurements
            if change.new_embroidery_text is not None:
                item.embroidery_text = change.new_embroidery_text

            # Try to reserve stock for the new product
            new_item_reserved = False
            try:
                if change.is_new_global_product and change.new_global_product_id:
                    global_inv = await global_inv_service.get_by_product(change.new_global_product_id)
                    if global_inv and global_inv.quantity >= change.new_quantity:
                        await global_inv_service.reserve_stock(
                            product_id=change.new_global_product_id,
                            quantity=change.new_quantity,
                            movement_type=InventoryMovementType.CHANGE_OUT,
                            reference=f"OCHG-{change.id}",
                            order_id=order.id,
                            school_id=school_id,
                            created_by=approved_by,
                        )
                        new_item_reserved = True
                elif change.new_product_id:
                    has_stock = await inv_service.check_availability(
                        change.new_product_id, school_id, change.new_quantity
                    )
                    if has_stock:
                        await inv_service.reserve_stock(
                            product_id=change.new_product_id,
                            school_id=school_id,
                            quantity=change.new_quantity,
                            movement_type=InventoryMovementType.CHANGE_OUT,
                            reference=f"OCHG-{change.id}",
                            order_id=order.id,
                            created_by=approved_by,
                        )
                        new_item_reserved = True
            except Exception as e:
                logger.warning(f"Could not reserve stock for new product in order change {change.id}: {e}")
                new_item_reserved = False

            # Update item status based on stock reservation
            if new_item_reserved:
                item.reserved_from_stock = True
                item.quantity_reserved = change.new_quantity
                item.item_status = OrderItemStatus.READY
            else:
                item.reserved_from_stock = False
                item.quantity_reserved = 0
                item.item_status = OrderItemStatus.PENDING
            item.status_updated_at = get_colombia_now_naive()

        # === STEP 3: Recalculate order totals ===
        # Re-query all active items to recalculate
        items_result = await self.db.execute(
            select(OrderItem).where(
                OrderItem.order_id == order.id,
                OrderItem.item_status != OrderItemStatus.CANCELLED
            )
        )
        active_items = items_result.scalars().all()
        new_subtotal = sum(Decimal(str(i.subtotal)) for i in active_items)
        order.subtotal = new_subtotal
        order.total = new_subtotal + Decimal(str(order.tax)) + Decimal(str(order.delivery_fee))
        # balance is a computed column (total - paid_amount), no need to set it

        # === STEP 4: Handle accounting (price adjustment) ===
        payment_method_str = payment_method.value if hasattr(payment_method, 'value') else str(payment_method)
        if change.price_adjustment != 0 and payment_method_str != 'credit':
            acc_payment_method = AccPaymentMethod(payment_method_str)

            if change.price_adjustment > 0:
                # Customer pays more -> INCOME
                transaction = Transaction(
                    school_id=school_id,
                    type=TransactionType.INCOME,
                    amount=Decimal(str(abs(change.price_adjustment))),
                    payment_method=acc_payment_method,
                    description=f"Diferencia cobrada - Cambio encargo {order.code}",
                    category="order_changes",
                    reference_code=f"OCHG-{order.code}",
                    transaction_date=get_colombia_date(),
                    order_id=order.id,
                    created_by=approved_by
                )
            else:
                # Refund to customer -> EXPENSE
                transaction = Transaction(
                    school_id=school_id,
                    type=TransactionType.EXPENSE,
                    amount=Decimal(str(abs(change.price_adjustment))),
                    payment_method=acc_payment_method,
                    description=f"Reembolso - Cambio encargo {order.code}",
                    category="order_changes",
                    reference_code=f"OCHG-{order.code}",
                    transaction_date=get_colombia_date(),
                    order_id=order.id,
                    created_by=approved_by
                )

            self.db.add(transaction)
            await self.db.flush()
            await balance_service.apply_transaction_to_balance(transaction, approved_by)

        # Update accounts receivable if exists for this order
        if change.price_adjustment != 0:
            rec_result = await self.db.execute(
                select(AccountsReceivable).where(
                    AccountsReceivable.order_id == order.id,
                    AccountsReceivable.is_paid == False
                )
            )
            receivable = rec_result.scalar_one_or_none()
            if receivable:
                receivable.amount = max(
                    Decimal("0"),
                    Decimal(str(receivable.amount)) + Decimal(str(change.price_adjustment))
                )
                if receivable.amount <= receivable.amount_paid:
                    receivable.is_paid = True

        # === STEP 5: Update change status ===
        change.status = ChangeStatus.APPROVED
        await self.db.flush()

        # === STEP 6: Sync order status from items ===
        await self._sync_order_status_from_items(order.id, school_id)

        await self.db.refresh(change)
        return change

    async def reject_order_change(
        self,
        change_id: UUID,
        school_id: UUID,
        rejection_reason: str
    ) -> OrderChange:
        """
        Reject an order change request.

        Args:
            change_id: OrderChange UUID
            school_id: School UUID
            rejection_reason: Reason for rejection

        Returns:
            Rejected OrderChange

        Raises:
            ValueError: If change not found or already processed
        """
        result = await self.db.execute(
            select(OrderChange)
            .options(selectinload(OrderChange.order))
            .where(OrderChange.id == change_id)
        )
        change = result.scalar_one_or_none()

        if not change:
            raise ValueError("Solicitud de cambio no encontrada")

        if change.order.school_id != school_id:
            raise ValueError("El cambio no pertenece a este colegio")

        if change.status != ChangeStatus.PENDING:
            raise ValueError(f"El cambio ya fue procesado: {change.status.value}")

        change.status = ChangeStatus.REJECTED
        change.rejection_reason = rejection_reason

        await self.db.flush()
        await self.db.refresh(change)

        return change

    async def get_order_changes(
        self,
        order_id: UUID,
        school_id: UUID
    ) -> list[OrderChange]:
        """
        Get all changes for an order.

        Args:
            order_id: Order UUID
            school_id: School UUID

        Returns:
            List of OrderChanges
        """
        order = await self.get(order_id, school_id)
        if not order:
            raise ValueError("Encargo no encontrado")

        result = await self.db.execute(
            select(OrderChange)
            .where(OrderChange.order_id == order_id)
            .order_by(OrderChange.created_at.desc())
        )

        return list(result.scalars().all())
