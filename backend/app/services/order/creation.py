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
from app.models.product import GarmentType, Product, GlobalProduct, GlobalGarmentType
from app.models.accounting import Transaction, TransactionType, AccPaymentMethod, AccountsReceivable
from app.schemas.order import OrderCreate, OrderUpdate
from app.services.notification_utils import send_welcome_notification_if_first_transaction

# Required measurements for yomber orders
YOMBER_REQUIRED_MEASUREMENTS = ['delantero', 'trasero', 'cintura', 'largo']

logger = logging.getLogger(__name__)


class OrderCreationMixin:
    """Mixin providing order creation methods for OrderService"""

    db: AsyncSession  # Type hint for IDE support

    async def create_order(
        self,
        order_data: OrderCreate,
        user_id: UUID
    ) -> Order:
        """
        Create a new order with items

        Args:
            order_data: Order creation data including items
            user_id: User creating the order

        Returns:
            Created order with items
        """
        # Generate order code
        code = await self._generate_order_code(order_data.school_id)

        # Calculate totals
        items_data = []
        subtotal = Decimal("0")

        for item_data in order_data.items:
            # Detect if this is a global product to determine garment type source
            is_global_product = getattr(item_data, 'is_global_product', False)
            has_global_product_id = getattr(item_data, 'global_product_id', None) is not None

            # Get garment type - from global_garment_types for global products, garment_types for school products
            garment = None
            garment_type_id_to_use = item_data.garment_type_id

            if is_global_product or has_global_product_id:
                # For global products, first try to get the garment type from global_garment_types
                global_garment_result = await self.db.execute(
                    select(GlobalGarmentType).where(
                        GlobalGarmentType.id == item_data.garment_type_id,
                        GlobalGarmentType.is_active == True
                    )
                )
                global_garment = global_garment_result.scalar_one_or_none()

                if global_garment:
                    # Use a placeholder garment object with just the name for display
                    garment = global_garment
                else:
                    # Fallback: try school garment types (in case of data inconsistency)
                    school_garment_result = await self.db.execute(
                        select(GarmentType).where(
                            GarmentType.id == item_data.garment_type_id,
                            GarmentType.is_active == True
                        )
                    )
                    garment = school_garment_result.scalar_one_or_none()
            else:
                # For school products, get from school-specific garment_types
                school_garment_result = await self.db.execute(
                    select(GarmentType).where(
                        GarmentType.id == item_data.garment_type_id,
                        GarmentType.school_id == order_data.school_id,
                        GarmentType.is_active == True
                    )
                )
                garment = school_garment_result.scalar_one_or_none()

            if not garment:
                raise ValueError(f"Garment type {item_data.garment_type_id} not found")

            # Get order type and additional price
            order_type = getattr(item_data, 'order_type', 'custom')
            additional_price = getattr(item_data, 'additional_price', None) or Decimal("0")
            product_id = None
            global_product_id = None
            is_global_product = getattr(item_data, 'is_global_product', False)
            item_size = item_data.size
            item_color = item_data.color

            # Stock reservation tracking for this item
            reserved_from_stock = False
            quantity_reserved = 0

            if order_type == "catalog":
                # CATALOG: Price from selected product (school or global)

                # Check if it's a global product
                if is_global_product or getattr(item_data, 'global_product_id', None):
                    # GLOBAL PRODUCT
                    gp_id = getattr(item_data, 'global_product_id', None) or item_data.product_id
                    if not gp_id:
                        raise ValueError("global_product_id requerido para encargos de catalogo con producto global")

                    gp_result = await self.db.execute(
                        select(GlobalProduct).where(
                            GlobalProduct.id == gp_id,
                            GlobalProduct.is_active == True
                        )
                    )
                    global_product = gp_result.scalar_one_or_none()

                    if not global_product:
                        raise ValueError(f"Global product {gp_id} not found")

                    unit_price = Decimal(str(global_product.price)) + additional_price
                    global_product_id = global_product.id
                    is_global_product = True
                    # Use product's size/color if not specified
                    item_size = item_data.size or global_product.size
                    item_color = item_data.color or global_product.color

                    # === STOCK RESERVATION FOR GLOBAL PRODUCTS (calculated now, applied after order creation) ===
                    should_reserve = getattr(item_data, 'reserve_stock', True)
                    if should_reserve:
                        from app.services.global_product import GlobalInventoryService
                        global_inv_service = GlobalInventoryService(self.db)

                        # Check available stock
                        global_inventory = await global_inv_service.get_by_product(global_product_id)

                        if global_inventory and global_inventory.quantity > 0:
                            quantity_to_reserve = min(item_data.quantity, global_inventory.quantity)
                            if quantity_to_reserve > 0:
                                # Mark for reservation (will be applied after order creation)
                                reserved_from_stock = True
                                quantity_reserved = quantity_to_reserve

                else:
                    # SCHOOL PRODUCT
                    if not item_data.product_id:
                        raise ValueError("product_id requerido para encargos de catalogo")

                    product_result = await self.db.execute(
                        select(Product).where(
                            Product.id == item_data.product_id,
                            Product.school_id == order_data.school_id,
                            Product.is_active == True
                        )
                    )
                    product = product_result.scalar_one_or_none()

                    if not product:
                        raise ValueError(f"Product {item_data.product_id} not found")

                    unit_price = Decimal(str(product.price)) + additional_price
                    product_id = product.id
                    # Use product's size/color if not specified
                    item_size = item_data.size or product.size
                    item_color = item_data.color or product.color

                    # === STOCK RESERVATION ("PISAR") - calculated now, applied after order creation ===
                    # Reserve stock if available and reserve_stock flag is True
                    should_reserve = getattr(item_data, 'reserve_stock', True)
                    if should_reserve:
                        from app.services.inventory import InventoryService
                        inventory_service = InventoryService(self.db)

                        # Check available stock
                        inventory = await inventory_service.get_by_product(product_id, order_data.school_id)

                        if inventory and inventory.quantity > 0:
                            # Reserve up to available stock (partial reservation if not enough)
                            quantity_to_reserve = min(item_data.quantity, inventory.quantity)

                            if quantity_to_reserve > 0:
                                # Mark for reservation (will be applied after order creation)
                                reserved_from_stock = True
                                quantity_reserved = quantity_to_reserve

            elif order_type == "yomber":
                # YOMBER: Validate measurements + get base price
                if not item_data.custom_measurements:
                    raise ValueError("Medidas personalizadas requeridas para encargos de yomber")

                missing = [f for f in YOMBER_REQUIRED_MEASUREMENTS
                          if f not in item_data.custom_measurements]
                if missing:
                    raise ValueError(f"Medidas faltantes para yomber: {', '.join(missing)}")

                # Get price from product or manual
                if item_data.product_id:
                    product_result = await self.db.execute(
                        select(Product).where(
                            Product.id == item_data.product_id,
                            Product.school_id == order_data.school_id,
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
                # CUSTOM: Manual price required
                if not item_data.unit_price:
                    raise ValueError("unit_price requerido para encargos personalizados")
                unit_price = item_data.unit_price + additional_price

            item_subtotal = unit_price * item_data.quantity

            # Determine which garment type field to use based on product type
            if is_global_product or has_global_product_id:
                # For global products, use global_garment_type_id
                garment_type_id_value = None
                global_garment_type_id_value = garment.id
            else:
                # For school products, use garment_type_id
                garment_type_id_value = garment.id
                global_garment_type_id_value = None

            items_data.append({
                "school_id": order_data.school_id,
                "garment_type_id": garment_type_id_value,
                "global_garment_type_id": global_garment_type_id_value,
                "product_id": product_id,
                "global_product_id": global_product_id,
                "is_global_product": is_global_product,
                "quantity": item_data.quantity,
                "unit_price": unit_price,
                "subtotal": item_subtotal,
                "size": item_size,
                "color": item_color,
                "gender": item_data.gender,
                "custom_measurements": item_data.custom_measurements,
                "embroidery_text": item_data.embroidery_text,
                "notes": item_data.notes,
                # Stock reservation tracking
                "reserved_from_stock": reserved_from_stock,
                "quantity_reserved": quantity_reserved
            })

            subtotal += item_subtotal

        # Sin IVA para encargos (tax = 0)
        tax = Decimal("0")
        total = subtotal

        # Determine paid amount (anticipo)
        paid_amount = order_data.advance_payment or Decimal("0")

        # Get payment method for advance payment, convert string to enum if needed
        raw_method = getattr(order_data, 'advance_payment_method', None) or 'cash'
        try:
            payment_method = AccPaymentMethod(raw_method) if isinstance(raw_method, str) else raw_method
        except ValueError:
            payment_method = AccPaymentMethod.CASH

        # Calculate cash change (vueltas) for advance payment
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

        # Create order
        # Exclude fields that are not in Order model or are handled separately
        order_dict = order_data.model_dump(exclude={
            'items', 'advance_payment', 'advance_payment_method',
            'advance_amount_received',
            'custom_school_name'  # Not in Order model, only used for school resolution
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

        # Create order items and apply stock reservations (now that order exists)
        from app.services.inventory import InventoryService
        from app.services.global_product import GlobalInventoryService
        inventory_service = InventoryService(self.db)
        global_inv_service = GlobalInventoryService(self.db)

        for item_dict in items_data:
            item_dict["order_id"] = order.id
            order_item = OrderItem(**item_dict)
            self.db.add(order_item)

            # Apply stock reservation with logging
            if item_dict.get("reserved_from_stock") and item_dict.get("quantity_reserved", 0) > 0:
                if item_dict.get("is_global_product"):
                    await global_inv_service.reserve_stock(
                        product_id=item_dict["global_product_id"],
                        quantity=item_dict["quantity_reserved"],
                        order_id=order.id,
                        reference=order.code,
                        school_id=order_data.school_id,
                    )
                elif item_dict.get("product_id"):
                    await inventory_service.reserve_stock(
                        product_id=item_dict["product_id"],
                        school_id=order_data.school_id,
                        quantity=item_dict["quantity_reserved"],
                        order_id=order.id,
                        reference=order.code,
                    )

                # If full quantity reserved from stock, item is READY
                if item_dict["quantity_reserved"] >= item_dict["quantity"]:
                    order_item.item_status = OrderItemStatus.READY
                    order_item.status_updated_at = get_colombia_now_naive()

        await self.db.flush()

        # Sync order status from items (e.g., if all items are READY, order becomes READY)
        await self._sync_order_status_from_items(order.id, order_data.school_id)

        # === CONTABILIDAD ===
        # Si hay anticipo, crear transaccion de ingreso + actualizar balance
        if paid_amount > Decimal("0"):
            transaction = Transaction(
                school_id=order_data.school_id,
                type=TransactionType.INCOME,
                amount=paid_amount,
                payment_method=payment_method,
                description=f"Anticipo encargo {order.code}",
                category="orders",
                reference_code=order.code,
                transaction_date=get_colombia_date(),
                order_id=order.id,
                created_by=user_id
            )
            self.db.add(transaction)
            await self.db.flush()

            # Apply balance integration (agrega a Caja/Banco)
            from app.services.balance_integration import BalanceIntegrationService
            balance_service = BalanceIntegrationService(self.db)
            await balance_service.apply_transaction_to_balance(transaction, user_id)

        # Crear cuenta por cobrar por el saldo pendiente
        balance = total - paid_amount
        if balance > Decimal("0"):
            receivable = AccountsReceivable(
                school_id=order_data.school_id,
                client_id=order_data.client_id,
                order_id=order.id,
                amount=balance,
                description=f"Saldo pendiente encargo {order.code}",
                invoice_date=get_colombia_date(),
                due_date=order_data.delivery_date,
                created_by=user_id
            )
            self.db.add(receivable)

        await self.db.flush()

        # === ENVIAR NOTIFICACION DE BIENVENIDA EN PRIMERA TRANSACCION ===
        # Si el cliente tiene contacto y es su primera transaccion, enviar notificacion (email + WhatsApp)
        if order_data.client_id:
            await send_welcome_notification_if_first_transaction(
                db=self.db,
                client_id=order_data.client_id,
                reference_code=order.code,
                transaction_type="encargo"
            )

        return order

    async def update_order(
        self,
        order_id: UUID,
        school_id: UUID,
        order_update: OrderUpdate
    ) -> Order | None:
        """
        Update order details (delivery_date, notes, status)

        Args:
            order_id: Order UUID
            school_id: School UUID
            order_update: Update data

        Returns:
            Updated order
        """
        update_data = order_update.model_dump(exclude_unset=True)
        if not update_data:
            # No updates, just return the order
            return await self.get(order_id, school_id)

        order = await self.update(order_id, school_id, update_data)

        # Sync item statuses if status was changed to DELIVERED
        if order and 'status' in update_data and update_data['status'] == OrderStatus.DELIVERED:
            await self._sync_item_statuses_from_order(order_id, school_id, OrderStatus.DELIVERED)
            # Auto-complete any sale changes waiting for this order
            await self._complete_pending_sale_changes(order)

        return order

    async def create_web_order(
        self,
        order_data: OrderCreate
    ) -> Order:
        """
        Create a new order from web portal (no user_id required)

        Args:
            order_data: Order creation data including items

        Returns:
            Created order with items
        """
        from app.models.sale import SaleSource
        from app.models.school import School
        import uuid as uuid_lib
        from slugify import slugify

        # Resolve school_id - handle custom school names
        school_id = order_data.school_id
        if order_data.custom_school_name:
            # Search for existing school (case-insensitive)
            existing_school_result = await self.db.execute(
                select(School).where(
                    func.lower(School.name) == order_data.custom_school_name.lower(),
                    School.is_active == True
                )
            )
            existing_school = existing_school_result.scalar_one_or_none()

            if existing_school:
                # School exists, use its ID
                school_id = existing_school.id
            else:
                # Create new school with "+" prefix
                new_school_name = f"+{order_data.custom_school_name}"
                new_school_slug = slugify(new_school_name)

                # Generate unique code
                school_code = f"TEMP-{uuid_lib.uuid4().hex[:8].upper()}"

                new_school = School(
                    id=uuid_lib.uuid4(),
                    code=school_code,
                    name=new_school_name,
                    slug=new_school_slug,
                    is_active=False,  # Inactive until verified
                    settings={"needs_verification": True, "is_custom": True}
                )
                self.db.add(new_school)
                await self.db.flush()
                school_id = new_school.id

        # Generate order code
        code = await self._generate_order_code(school_id)

        # Calculate totals
        items_data = []
        subtotal = Decimal("0")

        for item_data in order_data.items:
            # Get garment type
            garment = await self.db.execute(
                select(GarmentType).where(
                    GarmentType.id == item_data.garment_type_id
                )
            )
            garment = garment.scalar_one_or_none()

            # Get order type and additional price
            order_type = getattr(item_data, 'order_type', 'catalog')  # Default to catalog for web
            additional_price = getattr(item_data, 'additional_price', None) or Decimal("0")
            product_id = None
            item_size = item_data.size
            item_color = getattr(item_data, 'color', None)

            if order_type == "catalog":
                # CATALOG: Price from selected product
                if not item_data.product_id:
                    raise ValueError("product_id requerido para encargos de catalogo")

                product_result = await self.db.execute(
                    select(Product).where(
                        Product.id == item_data.product_id,
                        Product.school_id == order_data.school_id,
                        Product.is_active == True
                    )
                )
                product = product_result.scalar_one_or_none()

                if not product:
                    raise ValueError(f"Product {item_data.product_id} not found")

                unit_price = Decimal(str(product.price)) + additional_price
                product_id = product.id
                item_size = item_data.size or product.size
                item_color = getattr(item_data, 'color', None) or product.color

            elif order_type == "yomber":
                # YOMBER: Validate measurements
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
                            Product.school_id == order_data.school_id,
                            Product.is_active == True
                        )
                    )
                    product = product_result.scalar_one_or_none()
                    if product:
                        unit_price = Decimal(str(product.price)) + additional_price
                        product_id = product.id
                    else:
                        raise ValueError(f"Product {item_data.product_id} not found")
                elif getattr(item_data, 'unit_price', None):
                    unit_price = item_data.unit_price + additional_price
                else:
                    raise ValueError("Precio requerido para yomber")

            elif order_type == "web_custom":
                # WEB_CUSTOM: Items from web portal needing quotation
                needs_quotation = getattr(item_data, 'needs_quotation', False)
                if needs_quotation:
                    # Price is 0, will be assigned later
                    unit_price = Decimal("0") + additional_price

                    # If no garment_type_id provided, create a generic one for custom products
                    if not item_data.garment_type_id:
                        # Try to find or create a generic "Producto Personalizado" garment type
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
                    # Default to 0 for web custom orders
                    unit_price = Decimal("0") + additional_price

            else:  # "custom"
                if not getattr(item_data, 'unit_price', None):
                    raise ValueError("unit_price requerido para encargos personalizados")
                unit_price = item_data.unit_price + additional_price

            item_subtotal = unit_price * item_data.quantity

            items_data.append({
                "school_id": school_id,  # Use resolved school_id
                "garment_type_id": item_data.garment_type_id,
                "product_id": product_id,
                "quantity": item_data.quantity,
                "unit_price": unit_price,
                "subtotal": item_subtotal,
                "size": item_size,
                "color": item_color,
                "gender": getattr(item_data, 'gender', None),
                "custom_measurements": getattr(item_data, 'custom_measurements', None),
                "embroidery_text": getattr(item_data, 'embroidery_text', None),
                "notes": getattr(item_data, 'notes', None)
            })

            subtotal += item_subtotal

        # Sin IVA para encargos (tax = 0)
        tax = Decimal("0")
        total = subtotal

        # Determine paid amount (anticipo)
        paid_amount = order_data.advance_payment or Decimal("0")

        # Calculate delivery fee if delivery type is specified
        from app.models.delivery_zone import DeliveryZone
        from app.models.order import DeliveryType

        delivery_fee = Decimal("0")
        delivery_type = getattr(order_data, 'delivery_type', DeliveryType.PICKUP)

        if delivery_type == DeliveryType.DELIVERY and getattr(order_data, 'delivery_zone_id', None):
            # Fetch delivery zone to get fee
            zone_result = await self.db.execute(
                select(DeliveryZone).where(
                    DeliveryZone.id == order_data.delivery_zone_id,
                    DeliveryZone.is_active == True
                )
            )
            zone = zone_result.scalar_one_or_none()
            if zone:
                delivery_fee = Decimal(str(zone.delivery_fee))
                total = subtotal + delivery_fee  # Add delivery fee to total

        # Create order without user_id (web portal order)
        order = Order(
            school_id=school_id,  # Use resolved school_id
            client_id=order_data.client_id,
            code=code,
            user_id=None,  # No user for web portal orders
            status=OrderStatus.PENDING,
            source=SaleSource.WEB_PORTAL,  # Mark as web portal order
            subtotal=subtotal,
            tax=tax,
            total=total,
            paid_amount=paid_amount,
            delivery_date=order_data.delivery_date,
            notes=order_data.notes,
            # Delivery fields
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

        # Create order items
        for item_dict in items_data:
            item_dict["order_id"] = order.id
            order_item = OrderItem(**item_dict)
            self.db.add(order_item)

        await self.db.flush()

        # === CONTABILIDAD ===
        # Para pedidos web, el anticipo es generalmente 0 (pago contra entrega)
        # Si hay anticipo, crear transaccion de ingreso + actualizar balance
        if paid_amount > Decimal("0"):
            transaction = Transaction(
                school_id=school_id,  # Use resolved school_id
                type=TransactionType.INCOME,
                amount=paid_amount,
                payment_method=AccPaymentMethod.TRANSFER,  # Web orders typically via transfer
                description=f"Anticipo encargo web {order.code}",
                category="orders",
                reference_code=order.code,
                transaction_date=get_colombia_date(),
                order_id=order.id,
                created_by=None
            )
            self.db.add(transaction)
            await self.db.flush()

            # Apply balance integration (agrega a Banco para transferencias web)
            from app.services.balance_integration import BalanceIntegrationService
            balance_service = BalanceIntegrationService(self.db)
            await balance_service.apply_transaction_to_balance(transaction, None)

        # Crear cuenta por cobrar por el saldo pendiente
        balance = total - paid_amount
        if balance > Decimal("0"):
            receivable = AccountsReceivable(
                school_id=order_data.school_id,
                client_id=order_data.client_id,
                order_id=order.id,
                amount=balance,
                description=f"Saldo pendiente encargo web {order.code}",
                invoice_date=get_colombia_date(),
                due_date=order_data.delivery_date,
                created_by=None
            )
            self.db.add(receivable)

        await self.db.flush()
        await self.db.refresh(order)

        # === NOTIFICATION ===
        # Notify about new web order
        from app.services.notification import NotificationService
        notification_service = NotificationService(self.db)
        await notification_service.notify_new_web_order(order)

        return order
