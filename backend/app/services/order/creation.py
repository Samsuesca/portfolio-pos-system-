"""
Order Creation Mixin

Contains order creation methods:
- create_order
- create_web_order
- update_order
"""
import logging
from uuid import UUID
from datetime import datetime, date
from decimal import Decimal
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.utils.timezone import get_colombia_date, get_colombia_now_naive
from app.models.order import Order, OrderItem, OrderStatus, OrderItemStatus
from app.models.product import GarmentType, Product
from app.models.accounting import Transaction, TransactionType, AccPaymentMethod, AccountsReceivable
from app.schemas.order import OrderCreate, OrderUpdate
from app.services.notification_utils import send_welcome_notification_if_first_transaction

YOMBER_REQUIRED_MEASUREMENTS = ['delantero', 'trasero', 'cintura', 'largo']

logger = logging.getLogger(__name__)


class OrderCreationMixin:
    """Mixin providing order creation methods for OrderService"""

    db: AsyncSession

    async def create_order(
        self,
        order_data: OrderCreate,
        user_id: UUID
    ) -> Order:
        code = await self._generate_order_code(order_data.school_id)

        items_data = []
        subtotal = Decimal("0")

        for item_data in order_data.items:
            garment = None
            if item_data.garment_type_id:
                garment_result = await self.db.execute(
                    select(GarmentType).where(
                        GarmentType.id == item_data.garment_type_id,
                        GarmentType.is_active == True
                    )
                )
                garment = garment_result.scalar_one_or_none()

            if not garment:
                raise ValueError(f"Garment type {item_data.garment_type_id} not found")

            order_type = getattr(item_data, 'order_type', 'custom')
            additional_price = getattr(item_data, 'additional_price', None) or Decimal("0")
            product_id = None
            item_size = item_data.size
            item_color = item_data.color

            reserved_from_stock = False
            quantity_reserved = 0

            if order_type == "catalog":
                if not item_data.product_id:
                    raise ValueError("product_id requerido para encargos de catalogo")

                product_result = await self.db.execute(
                    select(Product).where(
                        Product.id == item_data.product_id,
                        Product.is_active == True
                    )
                )
                product = product_result.scalar_one_or_none()

                if not product:
                    raise ValueError(f"Product {item_data.product_id} not found")

                if product.school_id is not None and product.school_id != order_data.school_id:
                    raise ValueError(f"Product {product.code} does not belong to this school")

                unit_price = Decimal(str(product.price)) + additional_price
                product_id = product.id
                item_size = item_data.size or product.size
                item_color = item_data.color or product.color

                should_reserve = getattr(item_data, 'reserve_stock', True)
                if should_reserve:
                    from app.services.inventory import InventoryService
                    inventory_service = InventoryService(self.db)

                    inventory = await inventory_service.get_by_product(product_id, product.school_id)

                    if inventory and inventory.quantity > 0:
                        quantity_to_reserve = min(item_data.quantity, inventory.quantity)
                        if quantity_to_reserve > 0:
                            reserved_from_stock = True
                            quantity_reserved = quantity_to_reserve

            elif order_type == "yomber":
                if not item_data.custom_measurements:
                    raise ValueError("Medidas personalizadas requeridas para encargos de yomber")

                missing = [f for f in YOMBER_REQUIRED_MEASUREMENTS
                          if f not in item_data.custom_measurements]
                if missing:
                    raise ValueError(f"Medidas faltantes para yomber: {', '.join(missing)}")

                if item_data.product_id:
                    product_result = await self.db.execute(
                        select(Product).where(
                            Product.id == item_data.product_id,
                            Product.is_active == True
                        )
                    )
                    product = product_result.scalar_one_or_none()

                    if not product:
                        raise ValueError(f"Product {item_data.product_id} not found")

                    unit_price = Decimal(str(product.price)) + additional_price
                    product_id = product.id
                elif item_data.unit_price:
                    unit_price = item_data.unit_price + additional_price
                else:
                    raise ValueError("Precio requerido para yomber (product_id o unit_price)")

            else:  # "custom"
                if not item_data.unit_price:
                    raise ValueError("unit_price requerido para encargos personalizados")
                unit_price = item_data.unit_price + additional_price

            item_subtotal = unit_price * item_data.quantity

            unit_cost = None
            if product_id:
                p_result = await self.db.execute(select(Product).where(Product.id == product_id))
                p = p_result.scalar_one_or_none()
                unit_cost = p.cost if p else None

            items_data.append({
                "school_id": order_data.school_id,
                "garment_type_id": garment.id,
                "product_id": product_id,
                "quantity": item_data.quantity,
                "unit_price": unit_price,
                "unit_cost": unit_cost,
                "subtotal": item_subtotal,
                "size": item_size,
                "color": item_color,
                "gender": item_data.gender,
                "custom_measurements": item_data.custom_measurements,
                "embroidery_text": item_data.embroidery_text,
                "notes": item_data.notes,
                "reserved_from_stock": reserved_from_stock,
                "quantity_reserved": quantity_reserved
            })

            subtotal += item_subtotal

        tax = Decimal("0")
        total = subtotal

        paid_amount = order_data.advance_payment or Decimal("0")

        if paid_amount > total:
            raise ValueError(
                f"El anticipo ({paid_amount}) no puede exceder el total del encargo ({total})"
            )

        raw_method = getattr(order_data, 'advance_payment_method', None) or 'cash'
        try:
            payment_method = AccPaymentMethod(raw_method) if isinstance(raw_method, str) else raw_method
        except ValueError:
            payment_method = AccPaymentMethod.CASH

        amount_received = None
        change_given = None
        if paid_amount > Decimal("0") and payment_method == AccPaymentMethod.CASH:
            advance_amount_received = getattr(order_data, 'advance_amount_received', None)
            if advance_amount_received is not None:
                if advance_amount_received < paid_amount:
                    raise ValueError(
                        f"El monto recibido ({advance_amount_received}) "
                        f"debe ser mayor o igual al anticipo ({paid_amount})"
                    )
                amount_received = advance_amount_received
                change_given = advance_amount_received - paid_amount

        order_dict = order_data.model_dump(exclude={
            'items', 'advance_payment', 'advance_payment_method',
            'advance_amount_received',
            'custom_school_name'
        })
        order_dict.update({
            "code": code,
            "user_id": user_id,
            "status": OrderStatus.PENDING,
            "subtotal": subtotal,
            "tax": tax,
            "total": total,
            "paid_amount": paid_amount,
            "amount_received": amount_received,
            "change_given": change_given
        })

        order = Order(**order_dict)
        self.db.add(order)
        await self.db.flush()
        await self.db.refresh(order)

        from app.services.inventory import InventoryService
        inventory_service = InventoryService(self.db)

        for item_dict in items_data:
            item_dict["order_id"] = order.id
            order_item = OrderItem(**item_dict)
            self.db.add(order_item)

            if item_dict.get("reserved_from_stock") and item_dict.get("quantity_reserved", 0) > 0:
                product_result = await self.db.execute(
                    select(Product).where(Product.id == item_dict["product_id"])
                )
                product = product_result.scalar_one_or_none()

                await inventory_service.reserve_stock(
                    product_id=item_dict["product_id"],
                    school_id=product.school_id if product else order_data.school_id,
                    quantity=item_dict["quantity_reserved"],
                    order_id=order.id,
                    reference=order.code,
                )

                if item_dict["quantity_reserved"] >= item_dict["quantity"]:
                    order_item.item_status = OrderItemStatus.READY
                    order_item.status_updated_at = get_colombia_now_naive()

        await self.db.flush()

        await self._sync_order_status_from_items(order.id, order_data.school_id)

        if paid_amount > Decimal("0"):
            from app.services.accounting.transactions import TransactionService
            txn_service = TransactionService(self.db)
            await txn_service.record(
                type=TransactionType.INCOME,
                amount=paid_amount,
                payment_method=payment_method,
                description=f"Anticipo encargo {order.code}",
                school_id=order_data.school_id,
                category="orders",
                reference_code=order.code,
                transaction_date=get_colombia_date(),
                order_id=order.id,
                created_by=user_id,
            )

        balance = total - paid_amount
        if balance > Decimal("0"):
            from app.services.accounting.receivables import default_ar_due_date
            ar_invoice_date = get_colombia_date()
            receivable = AccountsReceivable(
                school_id=order_data.school_id,
                client_id=order_data.client_id,
                order_id=order.id,
                amount=balance,
                description=f"Saldo pendiente encargo {order.code}",
                invoice_date=ar_invoice_date,
                due_date=order_data.delivery_date or default_ar_due_date(ar_invoice_date),
                created_by=user_id
            )
            self.db.add(receivable)

        await self.db.flush()

        if order_data.client_id:
            await send_welcome_notification_if_first_transaction(
                db=self.db,
                client_id=order_data.client_id,
                reference_code=order.code,
                transaction_type="encargo"
            )

        try:
            from app.services.telegram import fire_and_forget_routed_alert
            from app.services.telegram_messages import TelegramMessageBuilder
            from app.models.school import School

            school_result = await self.db.execute(
                select(School).where(School.id == order.school_id)
            )
            school = school_result.scalar_one_or_none()
            school_name = school.name if school else "N/A"

            msg = TelegramMessageBuilder.web_order_created(
                code=order.code,
                total=order.total,
                school_name=school_name,
                delivery_type=order.delivery_type.value if order.delivery_type else None,
            )
            fire_and_forget_routed_alert(
                "web_order_created", msg, school_id=order.school_id
            )
        except Exception as e:
            logger.error(f"Telegram alert failed for order {order.code}: {e}")

        return order

    async def update_order(
        self,
        order_id: UUID,
        school_id: UUID,
        order_update: OrderUpdate
    ) -> Order | None:
        update_data = order_update.model_dump(exclude_unset=True)
        if not update_data:
            return await self.get(order_id, school_id)

        order = await self.update(order_id, school_id, update_data)

        if order and 'status' in update_data and update_data['status'] == OrderStatus.DELIVERED:
            await self._sync_item_statuses_from_order(order_id, school_id, OrderStatus.DELIVERED)
            await self._complete_pending_sale_changes(order)

        return order

    async def create_web_order(
        self,
        order_data: OrderCreate
    ) -> Order:
        from app.models.sale import SaleSource
        from app.models.school import School
        import uuid as uuid_lib
        from slugify import slugify

        school_id = order_data.school_id
        if order_data.custom_school_name:
            existing_school_result = await self.db.execute(
                select(School).where(
                    func.lower(School.name) == order_data.custom_school_name.lower(),
                    School.is_active == True
                )
            )
            existing_school = existing_school_result.scalar_one_or_none()

            if existing_school:
                school_id = existing_school.id
            else:
                new_school_name = f"+{order_data.custom_school_name}"
                new_school_slug = slugify(new_school_name)
                school_code = f"TEMP-{uuid_lib.uuid4().hex[:8].upper()}"

                new_school = School(
                    id=uuid_lib.uuid4(),
                    code=school_code,
                    name=new_school_name,
                    slug=new_school_slug,
                    is_active=False,
                    settings={"needs_verification": True, "is_custom": True}
                )
                self.db.add(new_school)
                await self.db.flush()
                school_id = new_school.id

        code = await self._generate_order_code(school_id)

        items_data = []
        subtotal = Decimal("0")

        for item_data in order_data.items:
            order_type = getattr(item_data, 'order_type', 'catalog')
            additional_price = getattr(item_data, 'additional_price', None) or Decimal("0")
            product_id = None

            garment = None
            if item_data.garment_type_id:
                garment_result = await self.db.execute(
                    select(GarmentType).where(
                        GarmentType.id == item_data.garment_type_id,
                        GarmentType.is_active == True
                    )
                )
                garment = garment_result.scalar_one_or_none()

            item_size = item_data.size
            item_color = getattr(item_data, 'color', None)

            if order_type == "catalog":
                if not item_data.product_id:
                    raise ValueError("product_id requerido para encargos de catalogo")

                product_result = await self.db.execute(
                    select(Product).where(
                        Product.id == item_data.product_id,
                        Product.is_active == True
                    )
                )
                product = product_result.scalar_one_or_none()

                if not product:
                    raise ValueError(
                        f"Producto no disponible. Es posible que haya sido desactivado o retirado del catalogo. "
                        f"Por favor actualiza tu carrito e intenta de nuevo."
                    )

                unit_price = Decimal(str(product.price)) + additional_price
                product_id = product.id
                item_size = item_data.size or product.size
                item_color = getattr(item_data, 'color', None) or product.color

                should_reserve = getattr(item_data, 'reserve_stock', True)
                if should_reserve:
                    from app.services.inventory import InventoryService
                    inv_service = InventoryService(self.db)
                    inventory = await inv_service.get_by_product(product_id, product.school_id)
                    if inventory and inventory.quantity > 0:
                        quantity_to_reserve = min(item_data.quantity, inventory.quantity)
                        if quantity_to_reserve > 0:
                            inventory.quantity -= quantity_to_reserve

            elif order_type == "yomber":
                measurements = getattr(item_data, 'custom_measurements', None)
                if not measurements:
                    raise ValueError("Medidas personalizadas requeridas para encargos de yomber")

                missing = [f for f in YOMBER_REQUIRED_MEASUREMENTS if f not in measurements]
                if missing:
                    raise ValueError(f"Medidas faltantes para yomber: {', '.join(missing)}")

                if item_data.product_id:
                    product_result = await self.db.execute(
                        select(Product).where(
                            Product.id == item_data.product_id,
                            Product.is_active == True
                        )
                    )
                    product = product_result.scalar_one_or_none()
                    if product:
                        unit_price = Decimal(str(product.price)) + additional_price
                        product_id = product.id
                    else:
                        raise ValueError(
                            f"Producto no disponible. Es posible que haya sido desactivado o retirado del catalogo. "
                            f"Por favor actualiza tu carrito e intenta de nuevo."
                        )
                elif getattr(item_data, 'unit_price', None):
                    unit_price = item_data.unit_price + additional_price
                else:
                    raise ValueError("Precio requerido para yomber")

            elif order_type == "web_custom":
                needs_quotation = getattr(item_data, 'needs_quotation', False)
                if needs_quotation:
                    unit_price = Decimal("0") + additional_price

                    if not item_data.garment_type_id:
                        generic_gt_result = await self.db.execute(
                            select(GarmentType).where(
                                GarmentType.school_id == school_id,
                                GarmentType.name == "Producto Personalizado"
                            )
                        )
                        generic_gt = generic_gt_result.scalar_one_or_none()

                        if not generic_gt:
                            generic_gt = GarmentType(
                                id=uuid_lib.uuid4(),
                                school_id=school_id,
                                name="Producto Personalizado",
                                description="Producto personalizado creado desde el portal web",
                                is_active=True
                            )
                            self.db.add(generic_gt)
                            await self.db.flush()

                        item_data.garment_type_id = generic_gt.id

                elif getattr(item_data, 'unit_price', None):
                    unit_price = item_data.unit_price + additional_price
                else:
                    unit_price = Decimal("0") + additional_price

            else:  # "custom"
                if not getattr(item_data, 'unit_price', None):
                    raise ValueError("unit_price requerido para encargos personalizados")
                unit_price = item_data.unit_price + additional_price

            item_subtotal = unit_price * item_data.quantity

            garment_type_id_value = garment.id if garment else item_data.garment_type_id

            unit_cost = None
            if product_id:
                p_result = await self.db.execute(select(Product).where(Product.id == product_id))
                p = p_result.scalar_one_or_none()
                unit_cost = p.cost if p else None

            items_data.append({
                "school_id": school_id,
                "garment_type_id": garment_type_id_value,
                "product_id": product_id,
                "quantity": item_data.quantity,
                "unit_price": unit_price,
                "unit_cost": unit_cost,
                "subtotal": item_subtotal,
                "size": item_size,
                "color": item_color,
                "gender": getattr(item_data, 'gender', None),
                "custom_measurements": getattr(item_data, 'custom_measurements', None),
                "embroidery_text": getattr(item_data, 'embroidery_text', None),
                "notes": getattr(item_data, 'notes', None)
            })

            subtotal += item_subtotal

        tax = Decimal("0")
        total = subtotal

        paid_amount = order_data.advance_payment or Decimal("0")

        from app.models.delivery_zone import DeliveryZone
        from app.models.order import DeliveryType

        delivery_fee = Decimal("0")
        delivery_type = getattr(order_data, 'delivery_type', DeliveryType.PICKUP)

        if delivery_type == DeliveryType.DELIVERY and getattr(order_data, 'delivery_zone_id', None):
            zone_result = await self.db.execute(
                select(DeliveryZone).where(
                    DeliveryZone.id == order_data.delivery_zone_id,
                    DeliveryZone.is_active == True
                )
            )
            zone = zone_result.scalar_one_or_none()
            if zone:
                delivery_fee = Decimal(str(zone.delivery_fee))
                total = subtotal + delivery_fee

        order = Order(
            school_id=school_id,
            client_id=order_data.client_id,
            code=code,
            user_id=None,
            status=OrderStatus.PENDING,
            source=SaleSource.WEB_PORTAL,
            subtotal=subtotal,
            tax=tax,
            total=total,
            paid_amount=paid_amount,
            delivery_date=order_data.delivery_date,
            notes=order_data.notes,
            delivery_type=delivery_type,
            delivery_address=getattr(order_data, 'delivery_address', None),
            delivery_neighborhood=getattr(order_data, 'delivery_neighborhood', None),
            delivery_city=getattr(order_data, 'delivery_city', None),
            delivery_references=getattr(order_data, 'delivery_references', None),
            delivery_zone_id=getattr(order_data, 'delivery_zone_id', None),
            delivery_fee=delivery_fee,
        )
        self.db.add(order)
        await self.db.flush()
        await self.db.refresh(order)

        for item_dict in items_data:
            item_dict["order_id"] = order.id
            order_item = OrderItem(**item_dict)
            self.db.add(order_item)

        await self.db.flush()

        if paid_amount > Decimal("0"):
            from app.services.accounting.transactions import TransactionService
            txn_service = TransactionService(self.db)
            await txn_service.record(
                type=TransactionType.INCOME,
                amount=paid_amount,
                payment_method=AccPaymentMethod.TRANSFER,
                description=f"Anticipo encargo web {order.code}",
                school_id=school_id,
                category="orders",
                reference_code=order.code,
                transaction_date=get_colombia_date(),
                order_id=order.id,
                created_by=None,
            )

        balance = total - paid_amount
        if balance > Decimal("0"):
            from app.services.accounting.receivables import default_ar_due_date
            ar_invoice_date = get_colombia_date()
            receivable = AccountsReceivable(
                school_id=school_id,
                client_id=order_data.client_id,
                order_id=order.id,
                amount=balance,
                description=f"Saldo pendiente encargo web {order.code}",
                invoice_date=ar_invoice_date,
                due_date=order_data.delivery_date or default_ar_due_date(ar_invoice_date),
                created_by=None
            )
            self.db.add(receivable)

        await self.db.flush()
        await self.db.refresh(order)

        return order
