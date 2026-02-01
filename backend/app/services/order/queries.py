"""
Order Query Mixin

Contains query methods for order operations:
- get_order_with_items
- get_item
"""
from uuid import UUID
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload, joinedload

from app.models.order import Order, OrderItem


class OrderQueryMixin:
    """Mixin providing query methods for OrderService"""

    db: AsyncSession  # Type hint for IDE support

    async def get_order_with_items(
        self,
        order_id: UUID,
        school_id: UUID
    ) -> Order | None:
        """Get order with items, client and garment types loaded"""
        result = await self.db.execute(
            select(Order)
            .options(
                selectinload(Order.items).selectinload(OrderItem.garment_type),
                joinedload(Order.client)
            )
            .where(
                Order.id == order_id,
                Order.school_id == school_id
            )
        )
        return result.unique().scalar_one_or_none()

    async def get_item(
        self,
        item_id: UUID,
        order_id: UUID,
        school_id: UUID
    ) -> OrderItem | None:
        """Get a single order item"""
        result = await self.db.execute(
            select(OrderItem)
            .options(selectinload(OrderItem.garment_type))
            .where(
                OrderItem.id == item_id,
                OrderItem.order_id == order_id,
                OrderItem.school_id == school_id
            )
        )
        return result.scalar_one_or_none()
