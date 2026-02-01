"""
Order Stock Mixin

Contains stock verification and approval methods:
- verify_order_stock
- approve_order_with_stock
"""
from uuid import UUID
from datetime import datetime
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.utils.timezone import get_colombia_now_naive
from app.models.order import Order, OrderItem, OrderStatus, OrderItemStatus


class OrderStockMixin:
    """Mixin providing stock verification methods for OrderService"""

    db: AsyncSession  # Type hint for IDE support

    async def verify_order_stock(
        self,
        order_id: UUID,
        school_id: UUID
    ) -> dict:
        """
        Verify stock availability for all items in an order.

        For each item, tries to find a matching product in inventory
        based on garment_type, size, and color.

        IMPORTANT: Tracks "virtual consumption" of stock so that if multiple
        items need the same product, the available stock is correctly reduced.

        Returns:
            Dictionary with stock verification results
        """
        from app.models.product import Product, Inventory

        order = await self.get_order_with_items(order_id, school_id)
        if not order:
            raise ValueError("Pedido no encontrado")

        # First, load all products with their stock for this school
        all_products_query = (
            select(Product, Inventory.quantity)
            .outerjoin(Inventory, Product.id == Inventory.product_id)
            .where(
                Product.school_id == school_id,
                Product.is_active == True
            )
        )
        result = await self.db.execute(all_products_query)
        all_products = result.all()

        # Build a map of product_id -> (product, available_stock)
        # This will track "virtual" stock as we assign items
        product_stock_map: dict[UUID, tuple[Product, int]] = {}
        for product, inv_qty in all_products:
            product_stock_map[product.id] = (product, inv_qty or 0)

        items_info = []
        items_in_stock = 0
        items_partial = 0
        items_to_produce = 0

        for item in order.items:
            # Skip cancelled items
            if item.item_status == OrderItemStatus.CANCELLED:
                continue

            # Has custom measurements? Always produce (yomber)
            if item.custom_measurements:
                items_to_produce += 1
                items_info.append({
                    "item_id": str(item.id),
                    "garment_type_id": str(item.garment_type_id),
                    "garment_type_name": item.garment_type.name if item.garment_type else "Unknown",
                    "size": item.size,
                    "color": item.color,
                    "quantity_requested": item.quantity,
                    "product_id": None,
                    "product_code": None,
                    "stock_available": 0,
                    "can_fulfill_from_stock": False,
                    "quantity_from_stock": 0,
                    "quantity_to_produce": item.quantity,
                    "suggested_action": "produce",
                    "has_custom_measurements": True,
                    "item_status": item.item_status.value
                })
                continue

            # Find matching products by garment_type, size, color
            matching_products = []
            for product_id, (product, stock) in product_stock_map.items():
                if product.garment_type_id != item.garment_type_id:
                    continue
                # Match size if specified
                if item.size and product.size != item.size:
                    continue
                # Match color if specified
                if item.color and product.color != item.color:
                    continue
                matching_products.append((product, stock))

            # Sort by available stock descending to pick best match
            matching_products.sort(key=lambda x: x[1], reverse=True)

            # Pick the best match (most stock available)
            best_match = None
            best_stock = 0
            if matching_products:
                best_match, best_stock = matching_products[0]

            # If no exact match, try any product of same garment type (fallback)
            if not best_match:
                fallback_products = [
                    (p, s) for pid, (p, s) in product_stock_map.items()
                    if p.garment_type_id == item.garment_type_id
                ]
                fallback_products.sort(key=lambda x: x[1], reverse=True)
                if fallback_products:
                    best_match, best_stock = fallback_products[0]

            # Determine fulfillment based on CURRENT virtual stock
            can_fulfill = best_stock >= item.quantity
            quantity_from_stock = min(best_stock, item.quantity)
            quantity_to_produce = item.quantity - quantity_from_stock

            # Determine suggested action
            if can_fulfill:
                suggested_action = "fulfill"
                items_in_stock += 1
            elif quantity_from_stock > 0:
                suggested_action = "partial"
                items_partial += 1
            else:
                suggested_action = "produce"
                items_to_produce += 1

            # IMPORTANT: Virtually consume the stock for this item
            # so next items see the reduced availability
            if best_match and quantity_from_stock > 0:
                current_product, current_stock = product_stock_map[best_match.id]
                product_stock_map[best_match.id] = (current_product, current_stock - quantity_from_stock)

            items_info.append({
                "item_id": str(item.id),
                "garment_type_id": str(item.garment_type_id),
                "garment_type_name": item.garment_type.name if item.garment_type else "Unknown",
                "size": item.size,
                "color": item.color,
                "quantity_requested": item.quantity,
                "product_id": str(best_match.id) if best_match else None,
                "product_code": best_match.code if best_match else None,
                "stock_available": best_stock,  # Stock BEFORE this item's consumption
                "can_fulfill_from_stock": can_fulfill,
                "quantity_from_stock": quantity_from_stock,
                "quantity_to_produce": quantity_to_produce,
                "suggested_action": suggested_action,
                "has_custom_measurements": False,
                "item_status": item.item_status.value
            })

        # Determine overall suggestion
        total_items = len(items_info)
        can_fulfill_completely = items_in_stock == total_items and items_partial == 0 and items_to_produce == 0

        if can_fulfill_completely:
            suggested_action = "approve_all"
        elif items_to_produce == total_items:
            suggested_action = "produce_all"
        elif items_in_stock > 0 or items_partial > 0:
            suggested_action = "partial"
        else:
            suggested_action = "review"

        return {
            "order_id": str(order.id),
            "order_code": order.code,
            "order_status": order.status.value,
            "items": items_info,
            "total_items": total_items,
            "items_in_stock": items_in_stock,
            "items_partial": items_partial,
            "items_to_produce": items_to_produce,
            "can_fulfill_completely": can_fulfill_completely,
            "suggested_action": suggested_action
        }

    async def approve_order_with_stock(
        self,
        order_id: UUID,
        school_id: UUID,
        user_id: UUID,
        auto_fulfill: bool = True,
        item_actions: list[dict] | None = None
    ) -> Order:
        """
        Approve/process a web order with intelligent stock handling.

        For items with stock available:
        - Marks as READY
        - Decrements inventory
        - Links product to item

        For items without stock:
        - Marks as IN_PRODUCTION

        Args:
            order_id: Order UUID
            school_id: School UUID
            user_id: User approving the order
            auto_fulfill: If True, automatically fulfill items with stock
            item_actions: Optional list of specific actions per item

        Returns:
            Updated order
        """
        from app.models.product import Inventory

        order = await self.get_order_with_items(order_id, school_id)
        if not order:
            raise ValueError("Pedido no encontrado")

        if order.status not in [OrderStatus.PENDING]:
            raise ValueError(f"Solo se pueden aprobar pedidos pendientes. Estado actual: {order.status.value}")

        # Get stock verification
        stock_info = await self.verify_order_stock(order_id, school_id)

        # Build action map from item_actions if provided
        action_map = {}
        if item_actions:
            for action in item_actions:
                action_map[action.get("item_id")] = action

        # Process each item
        for item_info in stock_info["items"]:
            item_id = item_info["item_id"]

            # Get custom action if provided
            custom_action = action_map.get(item_id, {})
            action = custom_action.get("action", "auto")

            # Determine final action
            if action == "auto":
                if auto_fulfill and item_info["can_fulfill_from_stock"]:
                    action = "fulfill"
                else:
                    action = "produce"

            # Get the item
            result = await self.db.execute(
                select(OrderItem).where(OrderItem.id == item_id)
            )
            item = result.scalar_one_or_none()
            if not item:
                continue

            if action == "fulfill":
                # Fulfill from stock
                product_id = custom_action.get("product_id") or item_info.get("product_id")
                qty_from_stock = custom_action.get("quantity_from_stock") or item_info.get("quantity_from_stock", 0)

                if product_id and qty_from_stock > 0:
                    # Decrement inventory
                    inv_result = await self.db.execute(
                        select(Inventory).where(Inventory.product_id == product_id)
                    )
                    inventory = inv_result.scalar_one_or_none()

                    if inventory and inventory.quantity >= qty_from_stock:
                        inventory.quantity -= qty_from_stock
                        inventory.last_updated = get_colombia_now_naive()

                        # Link product to item
                        item.product_id = UUID(product_id) if isinstance(product_id, str) else product_id

                        # Mark as READY (available for delivery)
                        item.item_status = OrderItemStatus.READY
                        item.status_updated_at = get_colombia_now_naive()
                    else:
                        # Not enough stock, send to production
                        item.item_status = OrderItemStatus.IN_PRODUCTION
                        item.status_updated_at = get_colombia_now_naive()
                else:
                    # No product match, send to production
                    item.item_status = OrderItemStatus.IN_PRODUCTION
                    item.status_updated_at = get_colombia_now_naive()

            else:  # action == "produce"
                # Send to production
                item.item_status = OrderItemStatus.IN_PRODUCTION
                item.status_updated_at = get_colombia_now_naive()

        await self.db.flush()

        # Sync order status based on items
        await self._sync_order_status_from_items(order_id, school_id)

        # Reload and return
        await self.db.refresh(order)
        return order
