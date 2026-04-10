"""Sale change (cambios y devoluciones) workflow.

Handles four types of post-sale product modifications:
- **SIZE_CHANGE** — same product, different size
- **PRODUCT_CHANGE** — swap for a different product
- **RETURN** — return without replacement (full refund)
- **DEFECT** — exchange due to manufacturing defect

State machine::

    PENDING ──approve──▸ APPROVED
         │                  ▲
         ├──reject──▸ REJECTED
         │
         └──(no stock)──▸ PENDING_STOCK ──complete──▸ APPROVED
                              │
                              └── Creates an Order for the new product.
                                  Original product returned to inventory
                                  immediately. Accounting settled at creation.

When stock is unavailable and ``create_order_if_no_stock=True``, the system:
1. Returns the original product to inventory immediately
2. Settles accounting (price adjustment) immediately
3. Creates an Order for the new product
4. Sets change status to PENDING_STOCK
5. When the order is fulfilled, ``complete_change_from_order`` marks it APPROVED
"""
import logging
from uuid import UUID
from datetime import date
from decimal import Decimal
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.utils.timezone import get_colombia_date
from app.models.sale import (
    Sale, SaleItem, SaleStatus, SaleChange, ChangeStatus, ChangeType, PaymentMethod
)
from app.models.product import Product, GlobalProduct
from app.models.accounting import TransactionType, AccPaymentMethod
from app.models.inventory_log import InventoryMovementType
from app.schemas.sale import SaleChangeCreate
from app.services.global_product import GlobalInventoryService

logger = logging.getLogger(__name__)


class SaleChangeMixin:
    """Provides sale change operations to :class:`SaleService`.

    Methods:
        create_sale_change: Create a change request (PENDING or PENDING_STOCK).
        approve_sale_change: Execute inventory + accounting for a PENDING change.
        reject_sale_change: Reject a PENDING change with reason.
        complete_change_from_order: Finalize a PENDING_STOCK change.
        get_sale_changes: List all changes for a sale.
    """

    db: AsyncSession

    async def create_sale_change(
        self,
        sale_id: UUID,
        school_id: UUID,
        user_id: UUID,
        change_data: SaleChangeCreate
    ) -> SaleChange:
        """Create a sale change request.

        Validates the original item exists and has sufficient unreturned
        quantity (accounting for previously approved changes). For non-RETURN
        types, checks stock availability of the new product.

        If stock is unavailable and ``change_data.create_order_if_no_stock``
        is True, delegates to ``_create_change_with_order`` which handles
        immediate inventory return + order creation.

        Args:
            sale_id: Sale UUID containing the item to change.
            school_id: School UUID for tenant isolation.
            user_id: User creating the change request.
            change_data: Change details including type, quantities, and
                optional new product. See :class:`SaleChangeCreate`.

        Returns:
            Created SaleChange with status PENDING or PENDING_STOCK.

        Raises:
            ValueError: Sale not found/cancelled, item not found, quantity
                exceeds available, new product not found/inactive, or
                insufficient stock (when create_order_if_no_stock=False).
        """
        from app.services.inventory import InventoryService

        inv_service = InventoryService(self.db)
        global_inv_service = GlobalInventoryService(self.db)

        sale = await self.get(sale_id, school_id)
        if not sale:
            raise ValueError("Venta no encontrada")

        if sale.status == SaleStatus.CANCELLED:
            raise ValueError("No se puede modificar una venta cancelada")

        original_item_result = await self.db.execute(
            select(SaleItem)
            .options(
                selectinload(SaleItem.product),
                selectinload(SaleItem.global_product)
            )
            .where(
                SaleItem.id == change_data.original_item_id,
                SaleItem.sale_id == sale_id
            )
        )
        original_item = original_item_result.scalar_one_or_none()

        if not original_item:
            raise ValueError("Producto original de la venta no encontrado")

        # Guard against over-returning: sum of approved changes for this item
        approved_changes_result = await self.db.execute(
            select(func.coalesce(func.sum(SaleChange.returned_quantity), 0))
            .where(
                SaleChange.original_item_id == original_item.id,
                SaleChange.status == ChangeStatus.APPROVED
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

        new_unit_price = None
        price_adjustment = Decimal("0")
        new_product_id = None
        new_global_product_id = None

        if change_data.change_type != ChangeType.RETURN:
            if not change_data.new_product_id:
                raise ValueError(f"{change_data.change_type.value} requiere un nuevo producto")

            if change_data.is_new_global_product:
                new_product_result = await self.db.execute(
                    select(GlobalProduct).where(
                        GlobalProduct.id == change_data.new_product_id,
                        GlobalProduct.is_active == True
                    )
                )
                new_product = new_product_result.scalar_one_or_none()

                if not new_product:
                    raise ValueError("Nuevo producto global no encontrado o inactivo")

                global_inv = await global_inv_service.get_by_product(new_product.id)
                has_stock = global_inv and global_inv.quantity >= change_data.new_quantity

                new_global_product_id = new_product.id
                new_unit_price = new_product.price
            else:
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

                has_stock = await inv_service.check_availability(
                    new_product.id,
                    school_id,
                    change_data.new_quantity
                )

                new_product_id = new_product.id
                new_unit_price = new_product.price

            price_adjustment = (
                (new_unit_price * change_data.new_quantity) -
                (original_item.unit_price * change_data.returned_quantity)
            )

            if not has_stock:
                if change_data.create_order_if_no_stock:
                    if not sale.client_id:
                        raise ValueError(
                            "No se puede crear un encargo automatico porque la venta no tiene cliente registrado. "
                            "Asigne un cliente a la venta primero o agregue stock del producto manualmente."
                        )
                    return await self._create_change_with_order(
                        sale=sale,
                        original_item=original_item,
                        change_data=change_data,
                        school_id=school_id,
                        user_id=user_id,
                        new_product=new_product,
                        new_product_id=new_product_id,
                        new_global_product_id=new_global_product_id,
                        new_unit_price=new_unit_price,
                        price_adjustment=price_adjustment,
                        inv_service=inv_service,
                        global_inv_service=global_inv_service,
                    )
                else:
                    raise ValueError(f"Stock insuficiente para el producto {new_product.code}")
        else:
            price_adjustment = -(original_item.unit_price * change_data.returned_quantity)

        change = SaleChange(
            sale_id=sale_id,
            original_item_id=original_item.id,
            user_id=user_id,
            change_type=change_data.change_type,
            returned_quantity=change_data.returned_quantity,
            new_product_id=new_product_id,
            new_global_product_id=new_global_product_id,
            is_new_global_product=change_data.is_new_global_product,
            new_quantity=change_data.new_quantity,
            new_unit_price=new_unit_price,
            price_adjustment=price_adjustment,
            reason=change_data.reason,
            status=ChangeStatus.PENDING
        )

        self.db.add(change)
        await self.db.flush()
        await self.db.refresh(change)

        return change

    async def _create_change_with_order(
        self,
        sale: Sale,
        original_item: SaleItem,
        change_data: SaleChangeCreate,
        school_id: UUID,
        user_id: UUID,
        new_product,
        new_product_id: UUID | None,
        new_global_product_id: UUID | None,
        new_unit_price: Decimal,
        price_adjustment: Decimal,
        inv_service,
        global_inv_service,
    ) -> SaleChange:
        """Handle a change when the new product has no stock.

        Unlike the standard flow (which defers inventory to approval),
        this path acts immediately:

        1. Returns original product to inventory NOW (not at approval)
        2. Settles accounting for price difference NOW
        3. Creates an Order for the new product
        4. Creates SaleChange with PENDING_STOCK status

        When the order is fulfilled, ``complete_change_from_order`` marks
        the change as APPROVED without additional inventory movement
        (the product goes directly from supplier to customer).

        Args:
            sale: Parent sale (must have client_id for order creation).
            original_item: The SaleItem being returned.
            change_data: Change request details.
            school_id: School UUID.
            user_id: User creating the change.
            new_product: The Product or GlobalProduct being requested.
            new_product_id: UUID if school product, None if global.
            new_global_product_id: UUID if global product, None if school.
            new_unit_price: Price of the new product.
            price_adjustment: Calculated difference (positive = customer pays more).
            inv_service: InventoryService instance.
            global_inv_service: GlobalInventoryService instance.

        Returns:
            SaleChange with status PENDING_STOCK and associated order_id.
        """
        from app.services.order import OrderService
        from app.schemas.order import OrderCreate, OrderItemCreate
        from app.services.accounting.transactions import TransactionService

        order_service = OrderService(self.db)
        txn_service = TransactionService(self.db)

        # 1. Return original product to inventory immediately
        if original_item.is_global_product:
            await global_inv_service.release_stock(
                product_id=original_item.global_product_id,
                quantity=change_data.returned_quantity,
                movement_type=InventoryMovementType.CHANGE_RETURN,
                reference=f"CHG-PENDING",
                sale_id=sale.id,
                school_id=school_id,
                created_by=user_id,
            )
        else:
            await inv_service.add_stock(
                original_item.product_id,
                school_id,
                change_data.returned_quantity,
                f"Devolucion anticipada - Cambio pendiente de stock",
                movement_type=InventoryMovementType.CHANGE_RETURN,
                sale_id=sale.id,
                created_by=user_id,
            )

        # 2. Settle accounting for price difference
        if price_adjustment != 0:
            payment_method = change_data.payment_method or PaymentMethod.CASH
            payment_method_str = payment_method.value if hasattr(payment_method, 'value') else str(payment_method)

            if payment_method_str != 'credit':
                acc_payment_method = AccPaymentMethod(payment_method_str)
                txn_type = TransactionType.INCOME if price_adjustment > 0 else TransactionType.EXPENSE
                desc = (f"Diferencia cobrada - Cambio pendiente venta {sale.code}"
                        if price_adjustment > 0
                        else f"Reembolso - Cambio pendiente venta {sale.code}")

                await txn_service.record(
                    type=txn_type,
                    amount=Decimal(str(abs(price_adjustment))),
                    payment_method=acc_payment_method,
                    description=desc,
                    school_id=school_id,
                    category="sale_changes",
                    reference_code=f"CHG-{sale.code}",
                    transaction_date=get_colombia_date(),
                    sale_id=sale.id,
                    created_by=user_id,
                )

        # 3. Create order for the new product
        garment_type_id = None
        global_garment_type_id = None

        if change_data.is_new_global_product:
            global_garment_type_id = getattr(new_product, 'garment_type_id', None)
        else:
            garment_type_id = getattr(new_product, 'garment_type_id', None)

        order_data = OrderCreate(
            school_id=school_id,
            client_id=sale.client_id,
            notes=f"Encargo automatico por cambio de venta {sale.code} [sale_id:{sale.id}]. Motivo: {change_data.reason}",
            items=[
                OrderItemCreate(
                    garment_type_id=garment_type_id,
                    product_id=new_product_id,
                    global_product_id=new_global_product_id,
                    is_global_product=change_data.is_new_global_product,
                    quantity=change_data.new_quantity,
                    unit_price=new_unit_price,
                    order_type="catalog",
                    reserve_stock=False,
                    size=getattr(new_product, 'size', None),
                    color=getattr(new_product, 'color', None),
                )
            ]
        )

        order = await order_service.create_order(order_data, user_id)

        # 4. Create change with PENDING_STOCK status
        change = SaleChange(
            sale_id=sale.id,
            original_item_id=original_item.id,
            user_id=user_id,
            change_type=change_data.change_type,
            returned_quantity=change_data.returned_quantity,
            new_product_id=new_product_id,
            new_global_product_id=new_global_product_id,
            is_new_global_product=change_data.is_new_global_product,
            new_quantity=change_data.new_quantity,
            new_unit_price=new_unit_price,
            price_adjustment=price_adjustment,
            reason=change_data.reason,
            status=ChangeStatus.PENDING_STOCK,
            order_id=order.id
        )

        self.db.add(change)
        await self.db.flush()
        await self.db.refresh(change)

        return change

    async def approve_sale_change(
        self,
        change_id: UUID,
        school_id: UUID,
        payment_method: PaymentMethod = PaymentMethod.CASH,
        approved_by: UUID | None = None
    ) -> SaleChange:
        """Approve a PENDING change and execute inventory + accounting.

        Performs three operations atomically:
        1. Returns original product to inventory (school or global)
        2. Deducts new product from inventory (if applicable)
        3. Creates accounting transaction for price adjustment

        Price adjustment logic:
        - ``price_adjustment > 0`` → customer pays more → INCOME transaction
        - ``price_adjustment < 0`` → refund to customer → EXPENSE transaction
        - ``price_adjustment == 0`` → no financial transaction

        Args:
            change_id: SaleChange UUID to approve.
            school_id: School UUID for tenant isolation.
            payment_method: How the price difference is settled.
            approved_by: User approving the change.

        Returns:
            The approved SaleChange.

        Raises:
            ValueError: Change not found, wrong school, already processed,
                or new product no longer has stock.
        """
        from app.services.inventory import InventoryService
        from app.services.accounting.transactions import TransactionService

        inv_service = InventoryService(self.db)
        global_inv_service = GlobalInventoryService(self.db)
        txn_service = TransactionService(self.db)

        result = await self.db.execute(
            select(SaleChange)
            .options(
                selectinload(SaleChange.sale),
                selectinload(SaleChange.original_item).selectinload(SaleItem.product),
                selectinload(SaleChange.original_item).selectinload(SaleItem.global_product),
                selectinload(SaleChange.new_global_product)
            )
            .where(SaleChange.id == change_id)
        )
        change = result.scalar_one_or_none()

        if not change:
            raise ValueError("Solicitud de cambio no encontrada")

        if change.sale.school_id != school_id:
            raise ValueError("El cambio no pertenece a este colegio")

        if change.status != ChangeStatus.PENDING:
            raise ValueError(f"Change already {change.status.value}")

        # 1. Return original product to inventory
        if change.original_item.is_global_product:
            await global_inv_service.release_stock(
                product_id=change.original_item.global_product_id,
                quantity=change.returned_quantity,
                movement_type=InventoryMovementType.CHANGE_RETURN,
                reference=f"CHG-{change.id}",
                sale_change_id=change.id,
                sale_id=change.sale_id,
                school_id=school_id,
                created_by=approved_by,
            )
        else:
            await inv_service.add_stock(
                change.original_item.product_id,
                school_id,
                change.returned_quantity,
                f"Devolucion - Cambio #{change.id}",
                movement_type=InventoryMovementType.CHANGE_RETURN,
                sale_change_id=change.id,
                sale_id=change.sale_id,
                created_by=approved_by,
            )

        # 2. Deduct new product from inventory
        if change.new_global_product_id:
            await global_inv_service.reserve_stock(
                product_id=change.new_global_product_id,
                quantity=change.new_quantity,
                movement_type=InventoryMovementType.CHANGE_OUT,
                reference=f"CHG-{change.id}",
                sale_change_id=change.id,
                sale_id=change.sale_id,
                school_id=school_id,
                created_by=approved_by,
            )

        elif change.new_product_id:
            has_stock = await inv_service.check_availability(
                change.new_product_id,
                school_id,
                change.new_quantity
            )

            if not has_stock:
                raise ValueError("Stock ya no disponible para el nuevo producto")

            await inv_service.remove_stock(
                change.new_product_id,
                school_id,
                change.new_quantity,
                f"Entrega - Cambio #{change.id}",
                movement_type=InventoryMovementType.CHANGE_OUT,
                sale_change_id=change.id,
                sale_id=change.sale_id,
                created_by=approved_by,
            )

        # 3. Create accounting transaction for price adjustment
        payment_method_str = payment_method.value if hasattr(payment_method, 'value') else str(payment_method)
        if change.price_adjustment != 0 and payment_method_str != 'credit':
            acc_payment_method = AccPaymentMethod(payment_method_str)
            txn_type = TransactionType.INCOME if change.price_adjustment > 0 else TransactionType.EXPENSE
            desc = (f"Diferencia cobrada - Cambio venta {change.sale.code}"
                    if change.price_adjustment > 0
                    else f"Reembolso - Cambio venta {change.sale.code}")

            await txn_service.record(
                type=txn_type,
                amount=Decimal(str(abs(change.price_adjustment))),
                payment_method=acc_payment_method,
                description=desc,
                school_id=school_id,
                category="sale_changes",
                reference_code=f"CHG-{change.sale.code}",
                transaction_date=get_colombia_date(),
                sale_id=change.sale_id,
                created_by=approved_by,
            )

        change.status = ChangeStatus.APPROVED
        await self.db.flush()
        await self.db.refresh(change)

        return change

    async def reject_sale_change(
        self,
        change_id: UUID,
        school_id: UUID,
        rejection_reason: str
    ) -> SaleChange:
        """Reject a PENDING change request.

        No inventory or accounting side effects — simply updates status.

        Args:
            change_id: SaleChange UUID.
            school_id: School UUID for tenant isolation.
            rejection_reason: Reason for rejection (stored on the change).

        Returns:
            The rejected SaleChange.

        Raises:
            ValueError: Change not found, wrong school, or already processed.
        """
        result = await self.db.execute(
            select(SaleChange)
            .options(selectinload(SaleChange.sale))
            .where(SaleChange.id == change_id)
        )
        change = result.scalar_one_or_none()

        if not change:
            raise ValueError("Solicitud de cambio no encontrada")

        if change.sale.school_id != school_id:
            raise ValueError("El cambio no pertenece a este colegio")

        if change.status != ChangeStatus.PENDING:
            raise ValueError(f"Change already {change.status.value}")

        change.status = ChangeStatus.REJECTED
        change.rejection_reason = rejection_reason

        await self.db.flush()
        await self.db.refresh(change)

        return change

    async def get_sale_changes(
        self,
        sale_id: UUID,
        school_id: UUID
    ) -> list[SaleChange]:
        """List all changes for a sale, most recent first.

        Args:
            sale_id: Sale UUID.
            school_id: School UUID for tenant isolation.

        Returns:
            List of SaleChange records ordered by created_at DESC.

        Raises:
            ValueError: Sale not found for this school.
        """
        sale = await self.get(sale_id, school_id)
        if not sale:
            raise ValueError("Venta no encontrada")

        result = await self.db.execute(
            select(SaleChange)
            .where(SaleChange.sale_id == sale_id)
            .order_by(SaleChange.created_at.desc())
        )

        return list(result.scalars().all())

    async def complete_change_from_order(
        self,
        change_id: UUID,
        school_id: UUID,
        approved_by: UUID | None = None
    ) -> SaleChange:
        """Finalize a PENDING_STOCK change after order fulfillment.

        Called when the associated order has stock available. Because the
        PENDING_STOCK flow already handled inventory return and accounting
        at creation time, this method only updates the change status.

        The new product goes directly from supplier to customer via the
        order — no additional inventory movement through our system.

        Args:
            change_id: SaleChange UUID.
            school_id: School UUID for tenant isolation.
            approved_by: User completing the change.

        Returns:
            The approved SaleChange.

        Raises:
            ValueError: Change not found, wrong school, not in PENDING_STOCK
                status, or missing associated order.
        """
        from app.services.inventory import InventoryService
        from app.services.order import OrderService
        from app.models.order import OrderStatus

        inv_service = InventoryService(self.db)
        global_inv_service = GlobalInventoryService(self.db)
        order_service = OrderService(self.db)

        result = await self.db.execute(
            select(SaleChange)
            .options(
                selectinload(SaleChange.sale),
                selectinload(SaleChange.order)
            )
            .where(SaleChange.id == change_id)
        )
        change = result.scalar_one_or_none()

        if not change:
            raise ValueError("Solicitud de cambio no encontrada")

        if change.sale.school_id != school_id:
            raise ValueError("El cambio no pertenece a este colegio")

        if change.status != ChangeStatus.PENDING_STOCK:
            raise ValueError(f"Este cambio no esta esperando stock. Estado actual: {change.status.value}")

        if not change.order_id:
            raise ValueError("Este cambio no tiene un pedido asociado")

        order = change.order
        if not order:
            raise ValueError("El pedido asociado no fue encontrado")

        change.status = ChangeStatus.APPROVED
        await self.db.flush()
        await self.db.refresh(change)

        return change
