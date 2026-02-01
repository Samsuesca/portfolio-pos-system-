"""
Sale Changes Mixin

Contains sale change (cambios y devoluciones) methods:
- create_sale_change
- _create_change_with_order
- approve_sale_change
- reject_sale_change
- complete_change_from_order
- get_sale_changes
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
from app.models.accounting import Transaction, TransactionType, AccPaymentMethod
from app.models.inventory_log import InventoryMovementType
from app.schemas.sale import SaleChangeCreate
from app.services.global_product import GlobalInventoryService

logger = logging.getLogger(__name__)


class SaleChangeMixin:
    """Mixin providing sale change methods for SaleService"""

    db: AsyncSession  # Type hint for IDE support

    async def create_sale_change(
        self,
        sale_id: UUID,
        school_id: UUID,
        user_id: UUID,
        change_data: SaleChangeCreate
    ) -> SaleChange:
        """
        Create a sale change request (size change, product change, return, defect)
        Supports both school products and global products.

        Args:
            sale_id: Sale UUID
            school_id: School UUID
            user_id: User creating the change
            change_data: Change request data

        Returns:
            Created SaleChange

        Raises:
            ValueError: If validation fails
        """
        from app.services.inventory import InventoryService

        inv_service = InventoryService(self.db)
        global_inv_service = GlobalInventoryService(self.db)

        # 1. Validate sale exists and belongs to school
        sale = await self.get(sale_id, school_id)
        if not sale:
            raise ValueError("Venta no encontrada")

        if sale.status == SaleStatus.CANCELLED:
            raise ValueError("No se puede modificar una venta cancelada")

        # 2. Get original sale item (load both school and global product)
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

        # Calculate quantity already returned by APPROVED changes for this item
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

        # 3. Initialize change record
        new_unit_price = None
        price_adjustment = Decimal("0")
        new_product_id = None
        new_global_product_id = None

        # 4. Handle change types that require new product
        if change_data.change_type != ChangeType.RETURN:
            if not change_data.new_product_id:
                raise ValueError(f"{change_data.change_type.value} requiere un nuevo producto")

            # Check if new product is global or school-specific
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

                # Check global stock availability
                global_inv = await global_inv_service.get_by_product(new_product.id)
                has_stock = global_inv and global_inv.quantity >= change_data.new_quantity

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

                # Check school stock availability
                has_stock = await inv_service.check_availability(
                    new_product.id,
                    school_id,
                    change_data.new_quantity
                )

                new_product_id = new_product.id
                new_unit_price = new_product.price

            # Calculate price adjustment
            price_adjustment = (
                (new_unit_price * change_data.new_quantity) -
                (original_item.unit_price * change_data.returned_quantity)
            )

            # Handle no stock scenario
            if not has_stock:
                if change_data.create_order_if_no_stock:
                    # Validate sale has a client (required for creating order)
                    if not sale.client_id:
                        raise ValueError(
                            "No se puede crear un encargo automatico porque la venta no tiene cliente registrado. "
                            "Asigne un cliente a la venta primero o agregue stock del producto manualmente."
                        )
                    # Create order and process change with PENDING_STOCK status
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
            # Pure return - negative price adjustment (refund)
            price_adjustment = -(original_item.unit_price * change_data.returned_quantity)

        # 5. Create change record (standard flow with stock available)
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
        """
        Create a sale change with an associated order when stock is not available.

        Flow:
        1. Return original product to inventory immediately
        2. Create accounting transaction for price adjustment
        3. Create order for the new product
        4. Create SaleChange with status PENDING_STOCK
        """
        from app.services.order import OrderService
        from app.schemas.order import OrderCreate, OrderItemCreate
        from app.services.balance_integration import BalanceIntegrationService

        order_service = OrderService(self.db)
        balance_service = BalanceIntegrationService(self.db)

        # 1. Return original product to inventory IMMEDIATELY
        if original_item.is_global_product:
            await global_inv_service.release_stock(
                product_id=original_item.global_product_id,
                quantity=change_data.returned_quantity,
                movement_type=InventoryMovementType.CHANGE_RETURN,
                reference=f"CHG-PENDING",  # Will be updated after change is created
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

        # 2. Create accounting transaction for price adjustment if needed
        if price_adjustment != 0:
            payment_method = change_data.payment_method or PaymentMethod.CASH
            payment_method_str = payment_method.value if hasattr(payment_method, 'value') else str(payment_method)

            if payment_method_str != 'credit':
                acc_payment_method = AccPaymentMethod(payment_method_str)

                if price_adjustment > 0:
                    # Customer pays more -> INCOME
                    transaction = Transaction(
                        school_id=school_id,
                        type=TransactionType.INCOME,
                        amount=Decimal(str(abs(price_adjustment))),
                        payment_method=acc_payment_method,
                        description=f"Diferencia cobrada - Cambio pendiente venta {sale.code}",
                        category="sale_changes",
                        reference_code=f"CHG-{sale.code}",
                        transaction_date=get_colombia_date(),
                        sale_id=sale.id,
                        created_by=user_id
                    )
                else:
                    # Refund to customer -> EXPENSE
                    transaction = Transaction(
                        school_id=school_id,
                        type=TransactionType.EXPENSE,
                        amount=Decimal(str(abs(price_adjustment))),
                        payment_method=acc_payment_method,
                        description=f"Reembolso - Cambio pendiente venta {sale.code}",
                        category="sale_changes",
                        reference_code=f"CHG-{sale.code}",
                        transaction_date=get_colombia_date(),
                        sale_id=sale.id,
                        created_by=user_id
                    )

                self.db.add(transaction)
                await self.db.flush()
                await balance_service.apply_transaction_to_balance(transaction, user_id)

        # 3. Create order for the new product
        # Determine garment_type_id based on product type
        garment_type_id = None
        global_garment_type_id = None

        if change_data.is_new_global_product:
            # For global products, get the garment type from the product
            global_garment_type_id = getattr(new_product, 'garment_type_id', None)
        else:
            # For school products, get the garment type from the product
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
                    reserve_stock=False,  # No stock available to reserve
                    size=getattr(new_product, 'size', None),
                    color=getattr(new_product, 'color', None),
                )
            ]
        )

        order = await order_service.create_order(order_data, user_id)

        # 4. Create SaleChange with PENDING_STOCK status
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
        """
        Approve a sale change and execute inventory + accounting adjustments
        Supports both school products and global products.

        Args:
            change_id: SaleChange UUID
            school_id: School UUID
            payment_method: Payment method for price adjustment (refund/additional payment)
            approved_by: User ID who approved the change

        Returns:
            Approved SaleChange

        Raises:
            ValueError: If change not found or already processed

        Accounting Logic:
            - price_adjustment > 0: Customer pays more -> INCOME transaction
            - price_adjustment < 0: Refund to customer -> EXPENSE transaction
            - price_adjustment = 0: No financial transaction needed
        """
        from app.services.inventory import InventoryService
        from app.services.balance_integration import BalanceIntegrationService

        inv_service = InventoryService(self.db)
        global_inv_service = GlobalInventoryService(self.db)
        balance_service = BalanceIntegrationService(self.db)

        # Get change with related data (including global product)
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

        # Execute inventory adjustments

        # 1. Return original product to inventory (check if global or school)
        if change.original_item.is_global_product:
            # Return to GLOBAL inventory with proper logging
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
            # Return to SCHOOL inventory
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

        # 2. Deduct new product from inventory (if applicable)
        if change.new_global_product_id:
            # Deduct from GLOBAL inventory with proper logging
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
            # Deduct from SCHOOL inventory
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

        # 3. Create accounting transaction if there's a price adjustment
        # Convert payment_method to string for comparison (handles both enum and string)
        payment_method_str = payment_method.value if hasattr(payment_method, 'value') else str(payment_method)
        if change.price_adjustment != 0 and payment_method_str != 'credit':
            # Map to AccPaymentMethod (accepts string value like 'cash', 'nequi', etc.)
            acc_payment_method = AccPaymentMethod(payment_method_str)

            if change.price_adjustment > 0:
                # Customer pays more -> INCOME
                transaction = Transaction(
                    school_id=school_id,
                    type=TransactionType.INCOME,
                    amount=Decimal(str(abs(change.price_adjustment))),
                    payment_method=acc_payment_method,
                    description=f"Diferencia cobrada - Cambio venta {change.sale.code}",
                    category="sale_changes",
                    reference_code=f"CHG-{change.sale.code}",
                    transaction_date=get_colombia_date(),
                    sale_id=change.sale_id,
                    created_by=approved_by
                )
            else:
                # Refund to customer -> EXPENSE
                transaction = Transaction(
                    school_id=school_id,
                    type=TransactionType.EXPENSE,
                    amount=Decimal(str(abs(change.price_adjustment))),
                    payment_method=acc_payment_method,
                    description=f"Reembolso - Cambio venta {change.sale.code}",
                    category="sale_changes",
                    reference_code=f"CHG-{change.sale.code}",
                    transaction_date=get_colombia_date(),
                    sale_id=change.sale_id,
                    created_by=approved_by
                )

            self.db.add(transaction)
            await self.db.flush()

            # Update balance account (Caja/Banco)
            await balance_service.apply_transaction_to_balance(transaction, approved_by)

        # 4. Update change status
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
        """
        Reject a sale change request

        Args:
            change_id: SaleChange UUID
            school_id: School UUID
            rejection_reason: Reason for rejection

        Returns:
            Rejected SaleChange

        Raises:
            ValueError: If change not found or already processed
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
        """
        Get all changes for a sale

        Args:
            sale_id: Sale UUID
            school_id: School UUID

        Returns:
            List of SaleChanges
        """
        # Verify sale belongs to school
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
        """
        Complete a sale change that was waiting for stock (PENDING_STOCK status).

        This is called when the associated order has stock available (typically when
        the order is marked as READY).

        IMPORTANT: The original product was already returned to inventory when the
        change was created. The price adjustment was also already processed.
        We only need to deduct the new product from inventory.

        Args:
            change_id: SaleChange UUID
            school_id: School UUID
            approved_by: User ID who is completing the change

        Returns:
            Approved SaleChange

        Raises:
            ValueError: If change not found, not in PENDING_STOCK status, or no stock
        """
        from app.services.inventory import InventoryService
        from app.services.order import OrderService
        from app.models.order import OrderStatus

        inv_service = InventoryService(self.db)
        global_inv_service = GlobalInventoryService(self.db)
        order_service = OrderService(self.db)

        # Get change with related data
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

        # Verify the order exists and check its status
        order = change.order
        if not order:
            raise ValueError("El pedido asociado no fue encontrado")

        # IMPORTANT: When a change has an associated order (PENDING_STOCK), the product
        # comes directly from production/supplier via the order fulfillment.
        # The inventory deduction is NOT needed because:
        # 1. The order was created with reserve_stock=False (no stock existed)
        # 2. The product goes directly from supplier -> customer (not through inventory)
        # 3. The order items track what was delivered
        #
        # We only mark the change as APPROVED - no inventory movement needed.

        # Update change status to APPROVED
        change.status = ChangeStatus.APPROVED
        await self.db.flush()
        await self.db.refresh(change)

        return change
