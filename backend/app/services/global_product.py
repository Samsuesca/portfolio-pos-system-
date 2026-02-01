"""
Global Product Service - Handles shared products across all schools
"""
import logging
from uuid import UUID
from decimal import Decimal
from datetime import date, datetime
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.product import GlobalGarmentType, GlobalGarmentTypeImage, GlobalProduct, GlobalInventory
from app.models.inventory_log import InventoryMovementType
from app.utils.timezone import get_colombia_date

logger = logging.getLogger(__name__)


from app.schemas.product import (
    GlobalGarmentTypeCreate, GlobalGarmentTypeUpdate,
    GlobalGarmentTypeImageResponse,
    GlobalProductCreate, GlobalProductUpdate,
    GlobalInventoryCreate, GlobalInventoryUpdate, GlobalInventoryAdjust,
    GlobalProductWithInventory
)


class GlobalGarmentTypeService:
    """Service for global garment type operations"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, data: GlobalGarmentTypeCreate) -> GlobalGarmentType:
        """Create a new global garment type"""
        # Check if name already exists
        existing = await self.get_by_name(data.name)
        if existing:
            raise ValueError(f"Global garment type '{data.name}' already exists")

        garment_type = GlobalGarmentType(**data.model_dump())
        self.db.add(garment_type)
        await self.db.flush()
        await self.db.refresh(garment_type)
        return garment_type

    async def get(self, garment_type_id: UUID) -> GlobalGarmentType | None:
        """Get global garment type by ID"""
        result = await self.db.execute(
            select(GlobalGarmentType).where(GlobalGarmentType.id == garment_type_id)
        )
        return result.scalar_one_or_none()

    async def get_by_name(self, name: str) -> GlobalGarmentType | None:
        """Get global garment type by name"""
        result = await self.db.execute(
            select(GlobalGarmentType).where(GlobalGarmentType.name == name)
        )
        return result.scalar_one_or_none()

    async def get_all(self, active_only: bool = True) -> list[GlobalGarmentType]:
        """Get all global garment types"""
        query = select(GlobalGarmentType)
        if active_only:
            query = query.where(GlobalGarmentType.is_active == True)
        query = query.order_by(GlobalGarmentType.name)
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def update(
        self, garment_type_id: UUID, data: GlobalGarmentTypeUpdate
    ) -> GlobalGarmentType | None:
        """Update global garment type"""
        garment_type = await self.get(garment_type_id)
        if not garment_type:
            return None

        update_data = data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(garment_type, field, value)

        await self.db.flush()
        await self.db.refresh(garment_type)
        return garment_type


class GlobalProductService:
    """Service for global product operations"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def _generate_code(self, garment_type_name: str) -> str:
        """Generate unique product code: GLB-XXX-NNN"""
        # Get prefix from garment type (first 3 letters)
        prefix = garment_type_name[:3].upper()

        # Count existing products with this prefix
        result = await self.db.execute(
            select(func.count(GlobalProduct.id)).where(
                GlobalProduct.code.like(f"GLB-{prefix}-%")
            )
        )
        count = result.scalar() or 0

        return f"GLB-{prefix}-{count + 1:03d}"

    async def create(self, data: GlobalProductCreate) -> GlobalProduct:
        """Create a new global product"""
        # Get garment type for code generation
        garment_type_service = GlobalGarmentTypeService(self.db)
        garment_type = await garment_type_service.get(data.garment_type_id)
        if not garment_type:
            raise ValueError("Global garment type not found")

        # Generate code
        code = await self._generate_code(garment_type.name)

        # Create product
        product_data = data.model_dump()
        product_data["code"] = code

        # Generate display name if not provided
        if not product_data.get("name"):
            product_data["name"] = f"{garment_type.name} {data.size}"
            if data.color:
                product_data["name"] += f" {data.color}"

        product = GlobalProduct(**product_data)
        self.db.add(product)
        await self.db.flush()
        await self.db.refresh(product)

        # Create inventory record with initial quantity of 0
        inventory = GlobalInventory(
            product_id=product.id,
            quantity=0,
            min_stock_alert=5
        )
        self.db.add(inventory)
        await self.db.flush()

        return product

    async def get(self, product_id: UUID) -> GlobalProduct | None:
        """Get global product by ID"""
        result = await self.db.execute(
            select(GlobalProduct).where(GlobalProduct.id == product_id)
        )
        return result.scalar_one_or_none()

    async def get_by_code(self, code: str) -> GlobalProduct | None:
        """Get global product by code"""
        result = await self.db.execute(
            select(GlobalProduct).where(GlobalProduct.code == code)
        )
        return result.scalar_one_or_none()

    async def get_all(
        self,
        skip: int = 0,
        limit: int = 100,
        active_only: bool = True
    ) -> list[GlobalProduct]:
        """Get all global products"""
        query = select(GlobalProduct)
        if active_only:
            query = query.where(GlobalProduct.is_active == True)
        query = query.order_by(GlobalProduct.code).offset(skip).limit(limit)
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def get_with_inventory(
        self,
        skip: int = 0,
        limit: int = 500,
        with_images: bool = True
    ) -> list[GlobalProductWithInventory]:
        """Get global products with their inventory and optionally garment type images"""
        query = (
            select(GlobalProduct)
            .options(
                selectinload(GlobalProduct.inventory),
                selectinload(GlobalProduct.garment_type).selectinload(GlobalGarmentType.images) if with_images else selectinload(GlobalProduct.garment_type)
            )
            .where(GlobalProduct.is_active == True)
            .order_by(GlobalProduct.code)
            .offset(skip)
            .limit(limit)
        )
        result = await self.db.execute(query)
        products = result.scalars().all()

        responses = []
        for p in products:
            # Get images from garment type if available
            images = []
            primary_image_url = None
            if with_images and p.garment_type and p.garment_type.images:
                sorted_images = sorted(p.garment_type.images, key=lambda x: x.display_order)
                images = [GlobalGarmentTypeImageResponse.model_validate(img) for img in sorted_images]
                # Find primary image
                primary = next((img for img in sorted_images if img.is_primary), None)
                if primary:
                    primary_image_url = primary.image_url
                elif sorted_images:
                    primary_image_url = sorted_images[0].image_url

            responses.append(GlobalProductWithInventory(
                id=p.id,
                code=p.code,
                name=p.name,
                size=p.size,
                color=p.color,
                gender=p.gender,
                price=p.price,
                cost=p.cost,
                description=p.description,
                image_url=p.image_url,
                garment_type_id=p.garment_type_id,
                is_active=p.is_active,
                created_at=p.created_at,
                updated_at=p.updated_at,
                inventory_quantity=p.inventory.quantity if p.inventory else 0,
                inventory_min_stock=p.inventory.min_stock_alert if p.inventory else 5,
                garment_type_images=images,
                garment_type_primary_image_url=primary_image_url
            ))

        return responses

    async def get_by_garment_type(
        self,
        garment_type_id: UUID,
        active_only: bool = True
    ) -> list[GlobalProduct]:
        """Get global products by garment type"""
        query = select(GlobalProduct).where(
            GlobalProduct.garment_type_id == garment_type_id
        )
        if active_only:
            query = query.where(GlobalProduct.is_active == True)
        query = query.order_by(GlobalProduct.size)
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def update(
        self, product_id: UUID, data: GlobalProductUpdate
    ) -> GlobalProduct | None:
        """Update global product"""
        product = await self.get(product_id)
        if not product:
            return None

        update_data = data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(product, field, value)

        await self.db.flush()
        await self.db.refresh(product)
        return product

    async def search(self, query: str, limit: int = 20) -> list[GlobalProduct]:
        """Search global products by code, name, size"""
        search_query = f"%{query}%"
        result = await self.db.execute(
            select(GlobalProduct)
            .where(
                GlobalProduct.is_active == True,
                (
                    GlobalProduct.code.ilike(search_query) |
                    GlobalProduct.name.ilike(search_query) |
                    GlobalProduct.size.ilike(search_query) |
                    GlobalProduct.color.ilike(search_query)
                )
            )
            .order_by(GlobalProduct.code)
            .limit(limit)
        )
        return list(result.scalars().all())


class GlobalInventoryService:
    """Service for global inventory operations"""

    def __init__(self, db: AsyncSession):
        self.db = db
        self._log_service = None

    @property
    def log_service(self):
        """Lazy load log service to avoid circular imports"""
        if self._log_service is None:
            from app.services.inventory_log import InventoryLogService
            self._log_service = InventoryLogService(self.db)
        return self._log_service

    async def create(self, data: GlobalInventoryCreate) -> GlobalInventory:
        """Create inventory record for global product"""
        # Check if inventory already exists
        existing = await self.get_by_product(data.product_id)
        if existing:
            raise ValueError("Inventory record already exists for this product")

        inventory = GlobalInventory(**data.model_dump())
        self.db.add(inventory)
        await self.db.flush()
        await self.db.refresh(inventory)
        return inventory

    async def get(self, inventory_id: UUID) -> GlobalInventory | None:
        """Get inventory by ID"""
        result = await self.db.execute(
            select(GlobalInventory).where(GlobalInventory.id == inventory_id)
        )
        return result.scalar_one_or_none()

    async def get_by_product(self, product_id: UUID) -> GlobalInventory | None:
        """Get inventory by product ID"""
        result = await self.db.execute(
            select(GlobalInventory).where(GlobalInventory.product_id == product_id)
        )
        return result.scalar_one_or_none()

    async def update(
        self, product_id: UUID, data: GlobalInventoryUpdate
    ) -> GlobalInventory | None:
        """Update inventory"""
        inventory = await self.get_by_product(product_id)
        if not inventory:
            return None

        update_data = data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(inventory, field, value)

        await self.db.flush()
        await self.db.refresh(inventory)
        return inventory

    async def adjust_quantity(
        self,
        product_id: UUID,
        data: GlobalInventoryAdjust,
        # Logging parameters
        movement_type: InventoryMovementType | None = None,
        reference: str | None = None,
        sale_id: UUID | None = None,
        order_id: UUID | None = None,
        sale_change_id: UUID | None = None,
        school_id: UUID | None = None,
        created_by: UUID | None = None,
    ) -> GlobalInventory:
        """
        Adjust inventory quantity (add or subtract) and create audit log.

        Args:
            product_id: Global product UUID
            data: Adjustment data (positive or negative)
            movement_type: Type of movement for logging
            reference: Reference code (VNT-2025-0001, etc.)
            sale_id: Related sale ID
            order_id: Related order ID
            sale_change_id: Related sale change ID
            school_id: School where the transaction occurred
            created_by: User who triggered the change
        """
        inventory = await self.get_by_product(product_id)

        # Si no existe inventario, crearlo con quantity=0
        if not inventory:
            inventory = GlobalInventory(
                product_id=product_id,
                quantity=0,
                min_stock_alert=5
            )
            self.db.add(inventory)
            await self.db.flush()

        new_quantity = inventory.quantity + data.adjustment
        if new_quantity < 0:
            raise ValueError(
                f"Cannot reduce inventory below 0. Current: {inventory.quantity}, "
                f"Adjustment: {data.adjustment}"
            )

        inventory.quantity = new_quantity
        await self.db.flush()
        await self.db.refresh(inventory)

        # === CREATE INVENTORY LOG ===
        if movement_type is None:
            if data.adjustment > 0:
                movement_type = InventoryMovementType.ADJUSTMENT_IN
            else:
                movement_type = InventoryMovementType.ADJUSTMENT_OUT

        description = data.reason or f"Global inventory adjustment: {data.adjustment:+d}"

        try:
            await self.log_service.create_log(
                global_inventory_id=inventory.id,
                school_id=school_id,
                movement_type=movement_type,
                quantity_delta=data.adjustment,
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
            logger.warning(f"Failed to create global inventory log: {e}")

        return inventory

    async def get_low_stock(self, limit: int = 50) -> list[GlobalInventory]:
        """Get global products with low stock"""
        result = await self.db.execute(
            select(GlobalInventory)
            .options(selectinload(GlobalInventory.product))
            .where(GlobalInventory.quantity <= GlobalInventory.min_stock_alert)
            .order_by(GlobalInventory.quantity)
            .limit(limit)
        )
        return list(result.scalars().all())

    async def reserve_stock(
        self,
        product_id: UUID,
        quantity: int,
        # Logging parameters
        movement_type: InventoryMovementType | None = None,
        reference: str | None = None,
        sale_id: UUID | None = None,
        order_id: UUID | None = None,
        school_id: UUID | None = None,
        created_by: UUID | None = None,
    ) -> GlobalInventory | None:
        """
        Reserve stock for a sale/order (decreases inventory)

        Args:
            product_id: Global Product UUID
            quantity: Quantity to reserve
            movement_type: Type of movement (SALE or ORDER_RESERVE)
            reference: Reference code (VNT-2025-0001, etc.)
            sale_id: Related sale ID
            order_id: Related order ID
            school_id: School where the transaction occurred
            created_by: User who triggered the change

        Returns:
            Updated inventory

        Raises:
            ValueError: If insufficient stock
        """
        inventory = await self.get_by_product(product_id)
        if not inventory:
            raise ValueError(f"No inventory found for global product {product_id}")

        if inventory.quantity < quantity:
            raise ValueError(
                f"Insufficient stock. Available: {inventory.quantity}, Requested: {quantity}"
            )

        new_quantity = inventory.quantity - quantity
        inventory.quantity = new_quantity
        await self.db.flush()
        await self.db.refresh(inventory)

        # === CREATE INVENTORY LOG ===
        if movement_type is None:
            if sale_id:
                movement_type = InventoryMovementType.SALE
            elif order_id:
                movement_type = InventoryMovementType.ORDER_RESERVE
            else:
                movement_type = InventoryMovementType.ADJUSTMENT_OUT

        reason = "Reserved for sale" if sale_id else "Reserved for order" if order_id else "Reserved"

        try:
            await self.log_service.create_log(
                global_inventory_id=inventory.id,
                school_id=school_id,
                movement_type=movement_type,
                quantity_delta=-quantity,
                quantity_after=new_quantity,
                description=reason,
                reference=reference,
                sale_id=sale_id,
                order_id=order_id,
                created_by=created_by,
                movement_date=get_colombia_date(),
            )
        except Exception as e:
            # Don't fail the inventory operation if logging fails
            logger.warning(f"Failed to create global inventory log: {e}")

        return inventory

    async def release_stock(
        self,
        product_id: UUID,
        quantity: int,
        # Logging parameters
        movement_type: InventoryMovementType | None = None,
        reference: str | None = None,
        sale_id: UUID | None = None,
        order_id: UUID | None = None,
        school_id: UUID | None = None,
        created_by: UUID | None = None,
    ) -> GlobalInventory | None:
        """
        Release reserved stock (increases inventory)
        Used when sale/order is cancelled

        Args:
            product_id: Global Product UUID
            quantity: Quantity to release
            movement_type: Type of movement (SALE_CANCEL or ORDER_CANCEL)
            reference: Reference code (VNT-2025-0001, etc.)
            sale_id: Related sale ID
            order_id: Related order ID
            school_id: School where the transaction occurred
            created_by: User who triggered the change

        Returns:
            Updated inventory
        """
        inventory = await self.get_by_product(product_id)
        if not inventory:
            raise ValueError(f"No inventory found for global product {product_id}")

        new_quantity = inventory.quantity + quantity
        inventory.quantity = new_quantity
        await self.db.flush()
        await self.db.refresh(inventory)

        # === CREATE INVENTORY LOG ===
        if movement_type is None:
            if sale_id:
                movement_type = InventoryMovementType.SALE_CANCEL
            elif order_id:
                movement_type = InventoryMovementType.ORDER_CANCEL
            else:
                movement_type = InventoryMovementType.ADJUSTMENT_IN

        reason = "Released from cancelled sale" if sale_id else "Released from cancelled order" if order_id else "Released"

        try:
            await self.log_service.create_log(
                global_inventory_id=inventory.id,
                school_id=school_id,
                movement_type=movement_type,
                quantity_delta=quantity,
                quantity_after=new_quantity,
                description=reason,
                reference=reference,
                sale_id=sale_id,
                order_id=order_id,
                created_by=created_by,
                movement_date=get_colombia_date(),
            )
        except Exception as e:
            # Don't fail the inventory operation if logging fails
            logger.warning(f"Failed to create global inventory log: {e}")

        return inventory
