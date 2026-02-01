"""
Inventory Log Service

Service for creating and querying inventory movement logs.
Provides audit trail for all inventory changes.
"""
from uuid import UUID
from datetime import date, datetime
from sqlalchemy import select, func, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.models.inventory_log import InventoryLog, InventoryMovementType
from app.utils.timezone import COLOMBIA_TZ, get_colombia_now, get_colombia_date


from app.models.product import Inventory, Product, GlobalInventory, GlobalProduct
from app.models.user import User
from app.schemas.inventory_log import (
    InventoryLogCreate,
    InventoryLogResponse,
    InventoryLogWithProduct,
    InventoryLogFilter,
    InventoryLogListResponse,
)


class InventoryLogService:
    """Service for inventory log operations"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_log(
        self,
        inventory_id: UUID | None = None,
        global_inventory_id: UUID | None = None,
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
        """
        Create an inventory movement log entry.

        Args:
            inventory_id: School inventory ID (for school products)
            global_inventory_id: Global inventory ID (for global products)
            school_id: School ID for multi-tenant filtering
            movement_type: Type of movement (sale, order_reserve, etc.)
            quantity_delta: Change in quantity (positive or negative)
            quantity_after: Resulting quantity after movement
            description: Human-readable description
            reference: Reference code (VNT-2025-0001, etc.)
            sale_id: Related sale ID
            order_id: Related order ID
            sale_change_id: Related sale change ID
            created_by: User who triggered the change
            movement_date: Date of movement (defaults to today)

        Returns:
            Created InventoryLog
        """
        log = InventoryLog(
            inventory_id=inventory_id,
            global_inventory_id=global_inventory_id,
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

    async def get_logs_by_inventory(
        self,
        inventory_id: UUID,
        skip: int = 0,
        limit: int = 100
    ) -> list[InventoryLog]:
        """
        Get logs for a specific school inventory.

        Args:
            inventory_id: Inventory UUID
            skip: Offset for pagination
            limit: Max results

        Returns:
            List of InventoryLog
        """
        result = await self.db.execute(
            select(InventoryLog)
            .where(InventoryLog.inventory_id == inventory_id)
            .order_by(InventoryLog.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        return list(result.scalars().all())

    async def get_logs_by_global_inventory(
        self,
        global_inventory_id: UUID,
        skip: int = 0,
        limit: int = 100
    ) -> list[InventoryLog]:
        """
        Get logs for a specific global inventory.

        Args:
            global_inventory_id: Global inventory UUID
            skip: Offset for pagination
            limit: Max results

        Returns:
            List of InventoryLog
        """
        result = await self.db.execute(
            select(InventoryLog)
            .where(InventoryLog.global_inventory_id == global_inventory_id)
            .order_by(InventoryLog.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        return list(result.scalars().all())

    async def get_logs_by_product(
        self,
        product_id: UUID,
        school_id: UUID,
        skip: int = 0,
        limit: int = 100
    ) -> list[InventoryLogWithProduct]:
        """
        Get logs for a school product by product_id.

        Args:
            product_id: Product UUID
            school_id: School UUID
            skip: Offset for pagination
            limit: Max results

        Returns:
            List of InventoryLogWithProduct
        """
        # First get the inventory for this product
        inv_result = await self.db.execute(
            select(Inventory)
            .where(
                Inventory.product_id == product_id,
                Inventory.school_id == school_id
            )
        )
        inventory = inv_result.scalar_one_or_none()

        if not inventory:
            return []

        # Get logs with product info and user name
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
                    global_inventory_id=log.global_inventory_id,
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
                    is_global_product=False,
                    created_by_name=user.full_name or user.username if user else None,
                )
            )

        return logs

    async def get_logs_by_global_product(
        self,
        product_id: UUID,
        skip: int = 0,
        limit: int = 100
    ) -> list[InventoryLogWithProduct]:
        """
        Get logs for a global product by product_id.

        Args:
            product_id: Global product UUID
            skip: Offset for pagination
            limit: Max results

        Returns:
            List of InventoryLogWithProduct
        """
        # First get the global inventory for this product
        inv_result = await self.db.execute(
            select(GlobalInventory)
            .where(GlobalInventory.product_id == product_id)
        )
        inventory = inv_result.scalar_one_or_none()

        if not inventory:
            return []

        # Get logs with product info and user name
        result = await self.db.execute(
            select(InventoryLog, GlobalProduct, User)
            .join(GlobalInventory, InventoryLog.global_inventory_id == GlobalInventory.id)
            .join(GlobalProduct, GlobalInventory.product_id == GlobalProduct.id)
            .outerjoin(User, InventoryLog.created_by == User.id)
            .where(InventoryLog.global_inventory_id == inventory.id)
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
                    global_inventory_id=log.global_inventory_id,
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
                    is_global_product=True,
                    created_by_name=user.full_name or user.username if user else None,
                )
            )

        return logs

    async def get_logs_by_school(
        self,
        school_id: UUID,
        filters: InventoryLogFilter | None = None
    ) -> InventoryLogListResponse:
        """
        Get all inventory logs for a school with optional filters.

        Args:
            school_id: School UUID
            filters: Optional filters

        Returns:
            Paginated list of logs with product info
        """
        filters = filters or InventoryLogFilter()

        # Base query for school inventory logs
        base_conditions = [InventoryLog.school_id == school_id]

        # Apply filters
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

        # Count total
        count_query = select(func.count(InventoryLog.id)).where(and_(*base_conditions))
        total_result = await self.db.execute(count_query)
        total = total_result.scalar_one()

        # Get logs with product info and user name (school products)
        school_logs_query = (
            select(InventoryLog, Product, User)
            .outerjoin(Inventory, InventoryLog.inventory_id == Inventory.id)
            .outerjoin(Product, Inventory.product_id == Product.id)
            .outerjoin(User, InventoryLog.created_by == User.id)
            .where(
                and_(
                    *base_conditions,
                    InventoryLog.inventory_id.isnot(None)
                )
            )
            .order_by(InventoryLog.created_at.desc())
            .offset(filters.skip)
            .limit(filters.limit)
        )

        school_result = await self.db.execute(school_logs_query)

        logs = []
        for log, product, user in school_result.all():
            logs.append(
                InventoryLogWithProduct(
                    id=log.id,
                    inventory_id=log.inventory_id,
                    global_inventory_id=log.global_inventory_id,
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
                    is_global_product=False,
                    created_by_name=user.full_name or user.username if user else None,
                )
            )

        # Get logs for global products associated with this school's transactions
        global_logs_query = (
            select(InventoryLog, GlobalProduct, User)
            .outerjoin(GlobalInventory, InventoryLog.global_inventory_id == GlobalInventory.id)
            .outerjoin(GlobalProduct, GlobalInventory.product_id == GlobalProduct.id)
            .outerjoin(User, InventoryLog.created_by == User.id)
            .where(
                and_(
                    *base_conditions,
                    InventoryLog.global_inventory_id.isnot(None)
                )
            )
            .order_by(InventoryLog.created_at.desc())
            .offset(filters.skip)
            .limit(filters.limit)
        )

        global_result = await self.db.execute(global_logs_query)

        for log, product, user in global_result.all():
            logs.append(
                InventoryLogWithProduct(
                    id=log.id,
                    inventory_id=log.inventory_id,
                    global_inventory_id=log.global_inventory_id,
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
                    is_global_product=True,
                    created_by_name=user.full_name or user.username if user else None,
                )
            )

        # Sort combined results by created_at
        logs.sort(key=lambda x: x.created_at, reverse=True)

        return InventoryLogListResponse(
            items=logs[:filters.limit],
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
        """
        Get logs within a date range.

        Args:
            school_id: School UUID
            start_date: Start date (inclusive)
            end_date: End date (inclusive)
            movement_type: Optional filter by movement type

        Returns:
            List of InventoryLog
        """
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
        """
        Get all inventory logs related to a sale.

        Args:
            sale_id: Sale UUID

        Returns:
            List of InventoryLog
        """
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
        """
        Get all inventory logs related to an order.

        Args:
            order_id: Order UUID

        Returns:
            List of InventoryLog
        """
        result = await self.db.execute(
            select(InventoryLog)
            .where(InventoryLog.order_id == order_id)
            .order_by(InventoryLog.created_at.desc())
        )
        return list(result.scalars().all())
