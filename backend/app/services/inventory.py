"""
Inventory Service
"""
import logging
from uuid import UUID
from decimal import Decimal
from datetime import date, datetime
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.models.product import Inventory, Product
from app.models.inventory_log import InventoryMovementType
from app.utils.timezone import get_colombia_date

logger = logging.getLogger(__name__)


from app.schemas.product import (
    InventoryCreate,
    InventoryUpdate,
    InventoryAdjust,
    LowStockProduct,
    InventoryReport,
)
from app.services.base import SchoolIsolatedService


class InventoryService(SchoolIsolatedService[Inventory]):
    """Service for Inventory operations"""

    def __init__(self, db: AsyncSession):
        super().__init__(Inventory, db)
        self._log_service = None

    @property
    def log_service(self):
        """Lazy load log service to avoid circular imports"""
        if self._log_service is None:
            from app.services.inventory_log import InventoryLogService
            self._log_service = InventoryLogService(self.db)
        return self._log_service

    async def create_inventory(
        self,
        inventory_data: InventoryCreate
    ) -> Inventory:
        """
        Create inventory for a product

        Args:
            inventory_data: Inventory creation data

        Returns:
            Created inventory

        Raises:
            ValueError: If inventory already exists for product
        """
        # Check if inventory already exists for this product
        existing = await self.get_by_product(
            inventory_data.product_id,
            inventory_data.school_id
        )
        if existing:
            raise ValueError("Inventory already exists for this product")

        # Verify product exists and belongs to school
        product = await self.db.execute(
            select(Product).where(
                Product.id == inventory_data.product_id,
                Product.school_id == inventory_data.school_id
            )
        )
        if not product.scalar_one_or_none():
            raise ValueError("Product not found or does not belong to this school")

        return await self.create(inventory_data.model_dump())

    async def update_inventory(
        self,
        inventory_id: UUID,
        school_id: UUID,
        inventory_data: InventoryUpdate
    ) -> Inventory | None:
        """
        Update inventory

        Args:
            inventory_id: Inventory UUID
            school_id: School UUID
            inventory_data: Update data

        Returns:
            Updated inventory or None
        """
        update_dict = inventory_data.model_dump(exclude_unset=True)
        return await self.update(inventory_id, school_id, update_dict)

    async def get_by_product(
        self,
        product_id: UUID,
        school_id: UUID
    ) -> Inventory | None:
        """
        Get inventory by product

        Args:
            product_id: Product UUID
            school_id: School UUID

        Returns:
            Inventory or None
        """
        result = await self.db.execute(
            select(Inventory).where(
                Inventory.product_id == product_id,
                Inventory.school_id == school_id
            )
        )
        return result.scalar_one_or_none()

    async def adjust_quantity(
        self,
        product_id: UUID,
        school_id: UUID,
        adjust_data: InventoryAdjust,
        # Logging parameters
        movement_type: InventoryMovementType | None = None,
        reference: str | None = None,
        sale_id: UUID | None = None,
        order_id: UUID | None = None,
        sale_change_id: UUID | None = None,
        created_by: UUID | None = None,
    ) -> Inventory | None:
        """
        Adjust inventory quantity and create audit log.

        Args:
            product_id: Product UUID
            school_id: School UUID
            adjust_data: Adjustment data (positive or negative)
            movement_type: Type of movement for logging (optional, auto-detected if not provided)
            reference: Reference code (VNT-2025-0001, etc.)
            sale_id: Related sale ID
            order_id: Related order ID
            sale_change_id: Related sale change ID
            created_by: User who triggered the change

        Returns:
            Updated inventory or None

        Raises:
            ValueError: If adjustment would result in negative quantity
        """
        inventory = await self.get_by_product(product_id, school_id)
        if not inventory:
            raise ValueError("Inventory not found for this product")

        old_quantity = inventory.quantity
        new_quantity = inventory.quantity + adjust_data.adjustment

        if new_quantity < 0:
            raise ValueError(
                f"Insufficient inventory. Current: {inventory.quantity}, "
                f"Requested: {abs(adjust_data.adjustment)}"
            )

        # Update quantity directly on the model
        inventory.quantity = new_quantity
        await self.db.flush()
        await self.db.refresh(inventory)

        # === CREATE INVENTORY LOG ===
        # Auto-detect movement type if not provided
        if movement_type is None:
            if adjust_data.adjustment > 0:
                movement_type = InventoryMovementType.ADJUSTMENT_IN
            else:
                movement_type = InventoryMovementType.ADJUSTMENT_OUT

        description = adjust_data.reason or f"Inventory adjustment: {adjust_data.adjustment:+d}"

        try:
            await self.log_service.create_log(
                inventory_id=inventory.id,
                school_id=school_id,
                movement_type=movement_type,
                quantity_delta=adjust_data.adjustment,
                quantity_after=new_quantity,
                description=description,
                reference=reference,
                sale_id=sale_id,
                order_id=order_id,
                sale_change_id=sale_change_id,
                created_by=created_by,
                movement_date=get_colombia_date(),
            )
        except Exception as e:
            # Don't fail the inventory operation if logging fails
            logger.warning(f"Failed to create inventory log: {e}")

        # === LOW STOCK NOTIFICATION ===
        # Only notify when stock drops below minimum (not when it was already below)
        if (
            adjust_data.adjustment < 0  # Stock decreased
            and new_quantity < inventory.min_stock_alert  # Now below minimum
            and old_quantity >= inventory.min_stock_alert  # Was above minimum before
        ):
            await self._notify_low_stock(product_id, school_id, new_quantity, inventory.min_stock_alert)

        return inventory

    async def _notify_low_stock(
        self,
        product_id: UUID,
        school_id: UUID,
        current_quantity: int,
        min_stock_alert: int
    ) -> None:
        """Send low stock notification"""
        try:
            # Get product info
            product = await self.db.execute(
                select(Product).where(Product.id == product_id)
            )
            product = product.scalar_one_or_none()

            if product:
                from app.services.notification import NotificationService
                notification_service = NotificationService(self.db)
                await notification_service.notify_low_stock(
                    product_id=product_id,
                    product_code=product.code,
                    product_name=product.name,
                    current_quantity=current_quantity,
                    min_stock_alert=min_stock_alert,
                    school_id=school_id
                )

                # Telegram alert
                from app.services.telegram import fire_and_forget_routed_alert
                from app.services.telegram_messages import TelegramMessageBuilder
                from app.models.school import School

                school_result = await self.db.execute(
                    select(School).where(School.id == school_id)
                )
                school = school_result.scalar_one_or_none()
                school_name = school.name if school else "N/A"

                msg = TelegramMessageBuilder.low_stock(
                    product_code=product.code,
                    product_name=product.name,
                    current_qty=current_quantity,
                    min_alert=min_stock_alert,
                    school_name=school_name,
                )
                fire_and_forget_routed_alert("low_stock", msg)
        except Exception as e:
            # Don't fail the inventory operation if notification fails
            logger.warning(f"Failed to send low stock notification: {e}")

    async def add_stock(
        self,
        product_id: UUID,
        school_id: UUID,
        quantity: int,
        reason: str | None = None,
        # Logging parameters
        movement_type: InventoryMovementType | None = None,
        reference: str | None = None,
        sale_id: UUID | None = None,
        order_id: UUID | None = None,
        sale_change_id: UUID | None = None,
        created_by: UUID | None = None,
    ) -> Inventory | None:
        """
        Add stock to inventory

        Args:
            product_id: Product UUID
            school_id: School UUID
            quantity: Quantity to add (must be positive)
            reason: Optional reason for adding stock
            movement_type: Type of movement for logging
            reference: Reference code (VNT-2025-0001, etc.)
            sale_id: Related sale ID
            order_id: Related order ID
            sale_change_id: Related sale change ID
            created_by: User who triggered the change

        Returns:
            Updated inventory
        """
        if quantity <= 0:
            raise ValueError("Quantity must be positive")

        return await self.adjust_quantity(
            product_id,
            school_id,
            InventoryAdjust(adjustment=quantity, reason=reason),
            movement_type=movement_type or InventoryMovementType.ADJUSTMENT_IN,
            reference=reference,
            sale_id=sale_id,
            order_id=order_id,
            sale_change_id=sale_change_id,
            created_by=created_by,
        )

    async def remove_stock(
        self,
        product_id: UUID,
        school_id: UUID,
        quantity: int,
        reason: str | None = None,
        # Logging parameters
        movement_type: InventoryMovementType | None = None,
        reference: str | None = None,
        sale_id: UUID | None = None,
        order_id: UUID | None = None,
        sale_change_id: UUID | None = None,
        created_by: UUID | None = None,
    ) -> Inventory | None:
        """
        Remove stock from inventory

        Args:
            product_id: Product UUID
            school_id: School UUID
            quantity: Quantity to remove (must be positive)
            reason: Optional reason for removing stock
            movement_type: Type of movement for logging
            reference: Reference code (VNT-2025-0001, etc.)
            sale_id: Related sale ID
            order_id: Related order ID
            sale_change_id: Related sale change ID
            created_by: User who triggered the change

        Returns:
            Updated inventory

        Raises:
            ValueError: If insufficient stock
        """
        if quantity <= 0:
            raise ValueError("Quantity must be positive")

        return await self.adjust_quantity(
            product_id,
            school_id,
            InventoryAdjust(adjustment=-quantity, reason=reason),
            movement_type=movement_type or InventoryMovementType.ADJUSTMENT_OUT,
            reference=reference,
            sale_id=sale_id,
            order_id=order_id,
            sale_change_id=sale_change_id,
            created_by=created_by,
        )

    async def get_low_stock_products(
        self,
        school_id: UUID
    ) -> list[LowStockProduct]:
        """
        Get products with stock below minimum

        Args:
            school_id: School UUID

        Returns:
            List of low stock products
        """
        result = await self.db.execute(
            select(Inventory, Product)
            .join(Product, Inventory.product_id == Product.id)
            .where(
                Inventory.school_id == school_id,
                Inventory.quantity < Inventory.min_stock_alert,
                Product.is_active == True
            )
            .order_by(Inventory.quantity)
        )

        low_stock = []
        for inv, product in result.all():
            low_stock.append(
                LowStockProduct(
                    product_id=product.id,
                    product_code=product.code,
                    product_name=product.name,
                    size=product.size,
                    color=product.color,
                    current_quantity=inv.quantity,
                    min_stock_alert=inv.min_stock_alert,
                    difference=inv.min_stock_alert - inv.quantity
                )
            )

        return low_stock

    async def get_out_of_stock_products(
        self,
        school_id: UUID
    ) -> list[Product]:
        """
        Get products with zero stock

        Args:
            school_id: School UUID

        Returns:
            List of out of stock products
        """
        result = await self.db.execute(
            select(Product)
            .join(Inventory, Inventory.product_id == Product.id)
            .where(
                Inventory.school_id == school_id,
                Inventory.quantity == 0,
                Product.is_active == True
            )
            .order_by(Product.code)
        )

        return list(result.scalars().all())

    async def get_inventory_report(
        self,
        school_id: UUID
    ) -> InventoryReport:
        """
        Get complete inventory report for a school

        Args:
            school_id: School UUID

        Returns:
            InventoryReport with statistics
        """
        # Total products with inventory
        total_products = await self.db.execute(
            select(func.count(Inventory.id)).where(
                Inventory.school_id == school_id
            )
        )

        # Total stock value (quantity * cost)
        stock_value = await self.db.execute(
            select(func.sum(Inventory.quantity * Product.cost))
            .select_from(Inventory)
            .join(Product, Inventory.product_id == Product.id)
            .where(
                Inventory.school_id == school_id,
                Product.cost.isnot(None)
            )
        )

        # Low stock count
        low_stock_count = await self.db.execute(
            select(func.count(Inventory.id)).where(
                Inventory.school_id == school_id,
                Inventory.quantity < Inventory.min_stock_alert,
                Inventory.quantity > 0
            )
        )

        # Out of stock count
        out_of_stock_count = await self.db.execute(
            select(func.count(Inventory.id)).where(
                Inventory.school_id == school_id,
                Inventory.quantity == 0
            )
        )

        # Get low stock products
        low_stock_products = await self.get_low_stock_products(school_id)

        return InventoryReport(
            total_products=total_products.scalar_one(),
            total_stock_value=Decimal(stock_value.scalar_one() or 0),
            low_stock_count=low_stock_count.scalar_one(),
            out_of_stock_count=out_of_stock_count.scalar_one(),
            low_stock_products=low_stock_products
        )

    async def check_availability(
        self,
        product_id: UUID,
        school_id: UUID,
        quantity: int
    ) -> bool:
        """
        Check if product has enough stock

        Args:
            product_id: Product UUID
            school_id: School UUID
            quantity: Required quantity

        Returns:
            True if available, False otherwise
        """
        inventory = await self.get_by_product(product_id, school_id)
        if not inventory:
            return False

        return inventory.quantity >= quantity

    async def reserve_stock(
        self,
        product_id: UUID,
        school_id: UUID,
        quantity: int,
        # Logging parameters
        movement_type: InventoryMovementType | None = None,
        reference: str | None = None,
        sale_id: UUID | None = None,
        order_id: UUID | None = None,
        created_by: UUID | None = None,
    ) -> Inventory | None:
        """
        Reserve stock for a sale/order (decreases inventory)

        Args:
            product_id: Product UUID
            school_id: School UUID
            quantity: Quantity to reserve
            movement_type: Type of movement (SALE or ORDER_RESERVE)
            reference: Reference code (VNT-2025-0001, etc.)
            sale_id: Related sale ID
            order_id: Related order ID
            created_by: User who triggered the change

        Returns:
            Updated inventory

        Raises:
            ValueError: If insufficient stock
        """
        # Default to SALE if sale_id provided, ORDER_RESERVE if order_id provided
        if movement_type is None:
            if sale_id:
                movement_type = InventoryMovementType.SALE
            elif order_id:
                movement_type = InventoryMovementType.ORDER_RESERVE
            else:
                movement_type = InventoryMovementType.ADJUSTMENT_OUT

        reason = "Reserved for sale" if sale_id else "Reserved for order" if order_id else "Reserved"

        return await self.remove_stock(
            product_id,
            school_id,
            quantity,
            reason=reason,
            movement_type=movement_type,
            reference=reference,
            sale_id=sale_id,
            order_id=order_id,
            created_by=created_by,
        )

    async def release_stock(
        self,
        product_id: UUID,
        school_id: UUID,
        quantity: int,
        # Logging parameters
        movement_type: InventoryMovementType | None = None,
        reference: str | None = None,
        sale_id: UUID | None = None,
        order_id: UUID | None = None,
        created_by: UUID | None = None,
    ) -> Inventory | None:
        """
        Release reserved stock (increases inventory)
        Used when sale/order is cancelled

        Args:
            product_id: Product UUID
            school_id: School UUID
            quantity: Quantity to release
            movement_type: Type of movement (SALE_CANCEL or ORDER_CANCEL)
            reference: Reference code (VNT-2025-0001, etc.)
            sale_id: Related sale ID
            order_id: Related order ID
            created_by: User who triggered the change

        Returns:
            Updated inventory
        """
        # Default to SALE_CANCEL if sale_id provided, ORDER_CANCEL if order_id provided
        if movement_type is None:
            if sale_id:
                movement_type = InventoryMovementType.SALE_CANCEL
            elif order_id:
                movement_type = InventoryMovementType.ORDER_CANCEL
            else:
                movement_type = InventoryMovementType.ADJUSTMENT_IN

        reason = "Released from cancelled sale" if sale_id else "Released from cancelled order" if order_id else "Released"

        return await self.add_stock(
            product_id,
            school_id,
            quantity,
            reason=reason,
            movement_type=movement_type,
            reference=reference,
            sale_id=sale_id,
            order_id=order_id,
            created_by=created_by,
        )
