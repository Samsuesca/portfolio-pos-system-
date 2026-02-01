"""
Sale Creation Mixin

Contains sale creation methods:
- create_sale
"""
import logging
from uuid import UUID
from datetime import datetime, timezone, timedelta
from decimal import Decimal
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.sale import Sale, SaleItem, SalePayment, SaleStatus, PaymentMethod
from app.models.product import Product, GlobalProduct
from app.models.accounting import Transaction, TransactionType, AccPaymentMethod, AccountsReceivable
from app.models.inventory_log import InventoryMovementType
from app.schemas.sale import SaleCreate
from app.services.global_product import GlobalInventoryService
from app.services.notification_utils import send_welcome_notification_if_first_transaction

logger = logging.getLogger(__name__)


class SaleCreationMixin:
    """Mixin providing sale creation methods for SaleService"""

    db: AsyncSession  # Type hint for IDE support

    async def create_sale(
        self,
        sale_data: SaleCreate,
        user_id: UUID | None = None
    ) -> Sale:
        """
        Create a new sale with items (supports both school and global products)

        Args:
            sale_data: Sale creation data including items

        Returns:
            Created sale with items

        Raises:
            ValueError: If products not found or insufficient inventory
        """
        from app.services.inventory import InventoryService
        from app.schemas.product import GlobalInventoryAdjust

        inv_service = InventoryService(self.db)
        global_inv_service = GlobalInventoryService(self.db)

        # Check if this is a historical sale (migration)
        is_historical = sale_data.is_historical

        # Debug logging for historical sales
        logger.info(f"Creating sale - is_historical: {is_historical}, sale_date from request: {sale_data.sale_date}")

        # Generate sale code
        code = await self._generate_sale_code(sale_data.school_id)

        # Calculate totals and validate products
        items_data = []
        subtotal = Decimal("0")

        for item_data in sale_data.items:
            if item_data.is_global:
                # Handle global product
                result = await self.db.execute(
                    select(GlobalProduct).where(
                        GlobalProduct.id == item_data.product_id,
                        GlobalProduct.is_active == True
                    )
                )
                global_product = result.scalar_one_or_none()

                if not global_product:
                    raise ValueError(f"Producto global {item_data.product_id} no encontrado")

                # Check global inventory ONLY for non-historical sales
                if not is_historical:
                    global_inv = await global_inv_service.get_by_product(global_product.id)
                    if not global_inv or global_inv.quantity < item_data.quantity:
                        raise ValueError(
                            f"Stock insuficiente para el producto global {global_product.code}"
                        )

                # Calculate item totals
                unit_price = global_product.price
                item_subtotal = unit_price * item_data.quantity

                items_data.append({
                    "global_product_id": global_product.id,
                    "product_id": None,
                    "is_global_product": True,
                    "quantity": item_data.quantity,
                    "unit_price": unit_price,
                    "subtotal": item_subtotal
                })

                subtotal += item_subtotal
            else:
                # Handle school product (original logic)
                result = await self.db.execute(
                    select(Product).where(
                        Product.id == item_data.product_id,
                        Product.school_id == sale_data.school_id,
                        Product.is_active == True
                    )
                )
                product = result.scalar_one_or_none()

                if not product:
                    raise ValueError(f"Producto {item_data.product_id} no encontrado")

                # Check inventory ONLY for non-historical sales
                if not is_historical:
                    has_stock = await inv_service.check_availability(
                        product.id,
                        sale_data.school_id,
                        item_data.quantity
                    )

                    if not has_stock:
                        raise ValueError(
                            f"Stock insuficiente para el producto {product.code}"
                        )

                # Calculate item totals
                unit_price = product.price
                item_subtotal = unit_price * item_data.quantity

                items_data.append({
                    "product_id": product.id,
                    "global_product_id": None,
                    "is_global_product": False,
                    "quantity": item_data.quantity,
                    "unit_price": unit_price,
                    "subtotal": item_subtotal
                })

                subtotal += item_subtotal

        # Total = subtotal (no tax for now)
        total = subtotal

        # Determine sale date (use custom date for historical sales)
        # Colombia timezone is UTC-5
        colombia_tz = timezone(timedelta(hours=-5))

        if is_historical and sale_data.sale_date:
            # Use the date provided for historical sales (keep as-is, it's already a date)
            sale_date = sale_data.sale_date
            logger.info(f"Using custom sale_date for historical sale: {sale_date}")
        else:
            # For current sales, use Colombia time
            sale_date = datetime.now(colombia_tz).replace(tzinfo=None)
            logger.info(f"Using Colombia datetime: {sale_date} (is_historical={is_historical}, sale_data.sale_date={sale_data.sale_date})")

        # Create sale (only use fields that exist in the model)
        sale = Sale(
            school_id=sale_data.school_id,
            code=code,
            client_id=sale_data.client_id,
            user_id=user_id or sale_data.school_id,  # Use provided user_id or fallback
            status=SaleStatus.COMPLETED,
            payment_method=sale_data.payment_method,
            total=total,
            paid_amount=total,  # Assuming full payment
            is_historical=is_historical,
            sale_date=sale_date,
            notes=sale_data.notes
        )

        self.db.add(sale)
        await self.db.flush()
        await self.db.refresh(sale)

        # Create sale items and reserve inventory (SKIP inventory for historical sales)
        for item_dict in items_data:
            item_dict["sale_id"] = sale.id
            sale_item = SaleItem(**item_dict)
            self.db.add(sale_item)

            # Only adjust inventory for NON-historical sales
            if not is_historical:
                if item_dict["is_global_product"]:
                    # Reserve global stock with logging
                    await global_inv_service.adjust_quantity(
                        item_dict["global_product_id"],
                        GlobalInventoryAdjust(
                            adjustment=-item_dict["quantity"],
                            reason=f"Venta {code}"
                        ),
                        movement_type=InventoryMovementType.SALE,
                        reference=code,
                        sale_id=sale.id,
                        school_id=sale_data.school_id,
                    )
                else:
                    # Reserve school stock with logging
                    await inv_service.reserve_stock(
                        item_dict["product_id"],
                        sale_data.school_id,
                        item_dict["quantity"],
                        sale_id=sale.id,
                        reference=code,
                    )

        await self.db.flush()

        # === PAGOS MULTIPLES ===
        # Si se proporcionan pagos multiples, crearlos
        if sale_data.payments:
            # Validar que la suma de pagos iguale el total
            total_payments = sum(p.amount for p in sale_data.payments)
            if total_payments != total:
                raise ValueError(
                    f"La suma de pagos ({total_payments}) no coincide con el total ({total})"
                )

            for payment_data in sale_data.payments:
                # Calculate change for cash payments
                amount_received = None
                change_given = None

                if payment_data.payment_method == PaymentMethod.CASH:
                    if payment_data.amount_received is not None:
                        if payment_data.amount_received < payment_data.amount:
                            raise ValueError(
                                f"El monto recibido ({payment_data.amount_received}) "
                                f"debe ser mayor o igual al monto a pagar ({payment_data.amount})"
                            )
                        amount_received = payment_data.amount_received
                        change_given = payment_data.amount_received - payment_data.amount

                payment = SalePayment(
                    sale_id=sale.id,
                    amount=payment_data.amount,
                    payment_method=payment_data.payment_method,
                    notes=payment_data.notes,
                    amount_received=amount_received,
                    change_given=change_given
                )
                self.db.add(payment)

            await self.db.flush()

        # === CONTABILIDAD ===
        # Solo para ventas no historicas
        if not is_historical and sale.total > Decimal("0"):
            # Mapear payment_method de Sale a AccPaymentMethod
            payment_method_map = {
                PaymentMethod.CASH: AccPaymentMethod.CASH,
                PaymentMethod.NEQUI: AccPaymentMethod.NEQUI,
                PaymentMethod.TRANSFER: AccPaymentMethod.TRANSFER,
                PaymentMethod.CARD: AccPaymentMethod.CARD,
                PaymentMethod.CREDIT: AccPaymentMethod.CREDIT,
            }

            # Determinar pagos a procesar
            # Si hay multiples pagos, procesarlos individualmente
            # Si hay un solo payment_method, usarlo para toda la venta
            payments_to_process = []

            if sale_data.payments:
                # Multiples pagos - procesar cada uno
                for payment_data in sale_data.payments:
                    payments_to_process.append({
                        "amount": payment_data.amount,
                        "method": payment_data.payment_method
                    })
            elif sale.payment_method:
                # Pago unico tradicional
                payments_to_process.append({
                    "amount": sale.total,
                    "method": sale.payment_method
                })

            # Validar que hay pagos para procesar
            if not payments_to_process:
                raise ValueError(
                    "No se proporcionaron pagos validos. Use 'payments' con montos > 0 "
                    "o especifique 'payment_method'"
                )

            # Procesar cada pago
            credit_total = Decimal("0")
            for payment_info in payments_to_process:
                acc_payment_method = payment_method_map.get(
                    payment_info["method"],
                    AccPaymentMethod.CASH
                )

                # CREDIT no afecta cuentas de balance - solo genera cuenta por cobrar
                if payment_info["method"] == PaymentMethod.CREDIT:
                    credit_total += payment_info["amount"]
                else:
                    # Ventas efectivas: crear transaccion de ingreso
                    transaction = Transaction(
                        school_id=sale.school_id,
                        type=TransactionType.INCOME,
                        amount=payment_info["amount"],
                        payment_method=acc_payment_method,
                        description=f"Venta {sale.code}" + (f" ({payment_info['method'].value if hasattr(payment_info['method'], 'value') else payment_info['method']})" if len(payments_to_process) > 1 else ""),
                        category="sales",
                        reference_code=sale.code,
                        transaction_date=sale.sale_date.date() if hasattr(sale.sale_date, 'date') else sale.sale_date,
                        sale_id=sale.id,
                        created_by=user_id
                    )
                    self.db.add(transaction)
                    await self.db.flush()

                    # Apply balance integration (agrega a Caja/Banco)
                    # Wrapped in try-catch so sales don't fail if balance integration has issues
                    try:
                        from app.services.balance_integration import BalanceIntegrationService
                        balance_service = BalanceIntegrationService(self.db)
                        await balance_service.apply_transaction_to_balance(transaction, user_id)
                    except Exception as e:
                        # Log the error but don't fail the sale
                        logging.error(f"Balance integration failed for sale {sale.code}: {e}")

            # Crear cuenta por cobrar si hay monto a credito
            if credit_total > Decimal("0"):
                receivable = AccountsReceivable(
                    school_id=sale.school_id,
                    client_id=sale.client_id,
                    sale_id=sale.id,
                    amount=credit_total,
                    description=f"Venta a credito {sale.code}",
                    invoice_date=sale.sale_date.date() if hasattr(sale.sale_date, 'date') else sale.sale_date,
                    due_date=None,  # Sin fecha de vencimiento definida
                    created_by=user_id
                )
                self.db.add(receivable)

        await self.db.flush()

        # Refresh sale with items and payments loaded
        await self.db.refresh(sale, ["items", "payments"])

        # === ENVIAR NOTIFICACION DE BIENVENIDA EN PRIMERA TRANSACCION ===
        # Solo para ventas no historicas con cliente asociado
        # Usa multi-canal (email + WhatsApp) segun preferencias del cliente
        if not is_historical and sale.client_id:
            await send_welcome_notification_if_first_transaction(
                db=self.db,
                client_id=sale.client_id,
                reference_code=sale.code,
                transaction_type="compra"
            )

        # === ENCOLAR PARA IMPRESION SI ES EFECTIVO ===
        # Solo para ventas no historicas con pago en efectivo
        if not is_historical and sale.total > Decimal("0"):
            has_cash_payment = False

            # Check if any payment is cash
            if sale_data.payments:
                has_cash_payment = any(
                    p.payment_method == PaymentMethod.CASH
                    for p in sale_data.payments
                )
            elif sale.payment_method == PaymentMethod.CASH:
                has_cash_payment = True

            if has_cash_payment:
                try:
                    from app.services.print_queue import PrintQueueService
                    from app.services.sse_manager import sse_manager
                    from app.models.client import Client
                    from app.models.school import School

                    # Get client and school names for display
                    client_name = None
                    school_name = None

                    if sale.client_id:
                        client_result = await self.db.execute(
                            select(Client).where(Client.id == sale.client_id)
                        )
                        client = client_result.scalar_one_or_none()
                        client_name = client.name if client else None

                    school_result = await self.db.execute(
                        select(School).where(School.id == sale.school_id)
                    )
                    school = school_result.scalar_one_or_none()
                    school_name = school.name if school else None

                    # Determine source device
                    source_device = sale.source.value if sale.source else "unknown"

                    # Enqueue for printing
                    print_queue_service = PrintQueueService(self.db)
                    queue_item = await print_queue_service.enqueue_sale(
                        sale=sale,
                        school_id=sale.school_id,
                        source_device=source_device,
                        client_name=client_name,
                        school_name=school_name
                    )

                    # Broadcast SSE event
                    await sse_manager.broadcast_print_queue_event(
                        "new_sale",
                        {
                            "id": str(queue_item.id),
                            "sale_id": str(sale.id),
                            "school_id": str(sale.school_id),
                            "sale_code": sale.code,
                            "sale_total": float(sale.total),
                            "client_name": client_name,
                            "school_name": school_name,
                            "source_device": source_device,
                            "created_at": queue_item.created_at.isoformat()
                        }
                    )
                    logger.info(f"Print queue: Enqueued sale {sale.code} from {source_device}")
                except Exception as e:
                    # Log but don't fail the sale
                    logger.error(f"Print queue enqueue failed for sale {sale.code}: {e}")

        return sale
