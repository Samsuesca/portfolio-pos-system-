"""
Order Reporting Mixin

Contains reporting methods:
- get_product_demand
"""
from uuid import UUID
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.order import Order, OrderItem, OrderStatus, OrderItemStatus
from app.models.product import GarmentType


class OrderReportingMixin:
    """Mixin providing reporting methods for OrderService"""

    db: AsyncSession  # Type hint for IDE support

    async def get_product_demand(
        self,
        school_ids: list[UUID],
        include_ready: bool = False,
        type_filter: str | None = None,
        sort_by: str = "quantity",
        sort_order: str = "desc",
    ) -> dict:
        """
        Aggregate product demand from order items using a single optimized query.

        Strategy:
        1. Single query with JOINs to get all needed data
        2. Group in Python by (garment_type_id, size, color, is_yomber)
        3. Return structured response with order references

        Args:
            school_ids: List of school IDs to include
            include_ready: Whether to include items with 'ready' status
            type_filter: 'yomber', 'standard', or None/all
            sort_by: Field to sort by
            sort_order: 'asc' or 'desc'

        Returns:
            Dictionary with aggregated demand data
        """
        from app.models.school import School
        from app.models.client import Client
        from app.models.product import GlobalGarmentType

        # Build status filter
        item_statuses = [OrderItemStatus.PENDING, OrderItemStatus.IN_PRODUCTION]
        if include_ready:
            item_statuses.append(OrderItemStatus.READY)

        order_statuses = [OrderStatus.PENDING, OrderStatus.IN_PRODUCTION]
        if include_ready:
            order_statuses.append(OrderStatus.READY)

        # Single optimized query with all JOINs (including GlobalGarmentType for global products)
        query = (
            select(
                OrderItem,
                Order,
                Client,
                School,
                GarmentType,
                GlobalGarmentType,
            )
            .join(Order, OrderItem.order_id == Order.id)
            .join(Client, Order.client_id == Client.id)
            .join(School, Order.school_id == School.id)
            .outerjoin(GarmentType, OrderItem.garment_type_id == GarmentType.id)
            .outerjoin(GlobalGarmentType, OrderItem.global_garment_type_id == GlobalGarmentType.id)
            .where(
                Order.school_id.in_(school_ids),
                Order.status.in_(order_statuses),
                OrderItem.item_status.in_(item_statuses),
            )
        )

        result = await self.db.execute(query)
        rows = result.all()

        # Group by (garment_type_id, size, color, is_yomber)
        demand_map: dict[str, dict] = {}

        for item, order, client, school, garment_type, global_garment_type in rows:
            is_yomber = bool(item.custom_measurements and len(item.custom_measurements) > 0)

            # Apply type filter early
            if type_filter == 'yomber' and not is_yomber:
                continue
            if type_filter == 'standard' and is_yomber:
                continue

            # Get garment type info - try GarmentType first, then GlobalGarmentType
            garment_name = 'Desconocido'
            garment_category = None
            garment_type_id = item.garment_type_id  # Default to school garment_type_id

            if garment_type:
                # School-specific garment type
                garment_name = garment_type.name
                garment_category = garment_type.category
            elif global_garment_type:
                # Global product - use GlobalGarmentType info
                garment_name = global_garment_type.name
                garment_category = global_garment_type.category
                garment_type_id = item.global_garment_type_id  # Use global_garment_type_id for key

            # Create unique key for grouping (use appropriate garment_type_id)
            key = f"{garment_type_id or 'none'}|{item.size or ''}|{item.color or ''}|{is_yomber}"

            if key not in demand_map:
                demand_map[key] = {
                    'garment_type_id': str(garment_type_id) if garment_type_id else None,
                    'garment_type_name': garment_name,
                    'garment_type_category': garment_category,
                    'is_global_product': item.is_global_product,
                    'size': item.size,
                    'color': item.color,
                    'total_quantity': 0,
                    'pending_quantity': 0,
                    'in_production_quantity': 0,
                    'ready_quantity': 0,
                    'order_count': 0,
                    'item_count': 0,
                    'is_yomber': is_yomber,
                    'school_ids': set(),
                    'school_names': set(),
                    'orders': [],
                    'earliest_delivery_date': None,
                    '_order_ids': set(),  # Track unique orders
                }

            entry = demand_map[key]
            entry['total_quantity'] += item.quantity
            entry['item_count'] += 1
            entry['school_ids'].add(str(order.school_id))
            entry['school_names'].add(school.name)
            entry['_order_ids'].add(str(order.id))

            # Count by item status
            if item.item_status == OrderItemStatus.PENDING:
                entry['pending_quantity'] += item.quantity
            elif item.item_status == OrderItemStatus.IN_PRODUCTION:
                entry['in_production_quantity'] += item.quantity
            elif item.item_status == OrderItemStatus.READY:
                entry['ready_quantity'] += item.quantity

            # Add order reference
            entry['orders'].append({
                'order_id': str(order.id),
                'order_code': order.code,
                'order_status': order.status.value,
                'client_name': client.name,
                'student_name': client.student_name,
                'school_id': str(order.school_id),
                'school_name': school.name,
                'delivery_date': order.delivery_date.isoformat() if order.delivery_date else None,
                'quantity': item.quantity,
                'item_id': str(item.id),
                'item_status': item.item_status.value,
                'has_custom_measurements': is_yomber,
                'custom_measurements': item.custom_measurements if is_yomber else None,
            })

            # Track earliest delivery date
            if order.delivery_date:
                if not entry['earliest_delivery_date'] or order.delivery_date < entry['earliest_delivery_date']:
                    entry['earliest_delivery_date'] = order.delivery_date

        # Post-process entries
        items = []
        for entry in demand_map.values():
            entry['school_ids'] = list(entry['school_ids'])
            entry['school_names'] = list(entry['school_names'])
            entry['order_count'] = len(entry['_order_ids'])
            del entry['_order_ids']  # Remove helper field

            # Convert date to string for JSON
            if entry['earliest_delivery_date']:
                entry['earliest_delivery_date'] = entry['earliest_delivery_date'].isoformat()

            items.append(entry)

        # Sort
        reverse = sort_order == 'desc'
        if sort_by == 'quantity':
            items.sort(key=lambda x: x['total_quantity'], reverse=reverse)
        elif sort_by == 'delivery_date':
            items.sort(key=lambda x: x['earliest_delivery_date'] or '9999-12-31', reverse=reverse)
        elif sort_by == 'order_count':
            items.sort(key=lambda x: x['order_count'], reverse=reverse)

        # Calculate totals
        return {
            'items': items,
            'total_items': len(items),
            'total_quantity': sum(i['total_quantity'] for i in items),
            'total_orders': len(set(o['order_id'] for i in items for o in i['orders'])),
            'yomber_quantity': sum(i['total_quantity'] for i in items if i['is_yomber']),
            'standard_quantity': sum(i['total_quantity'] for i in items if not i['is_yomber']),
            'pending_quantity': sum(i['pending_quantity'] for i in items),
            'in_production_quantity': sum(i['in_production_quantity'] for i in items),
            'ready_quantity': sum(i['ready_quantity'] for i in items),
        }
