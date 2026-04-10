"""Sale creation orchestrator.

Handles the full lifecycle of creating a sale: product validation,
inventory reservation, payment processing, accounting entries, and
non-critical side effects (print queue, Telegram alerts, welcome emails).

Transaction strategy:
    All DB mutations use flush() — the caller (router) controls commit.
    If any step fails, the entire operation rolls back automatically.
    Side effects (Telegram, SSE, print queue) are fire-and-forget so they
    never block or fail the sale.
"""
import logging
from uuid import UUID
from datetime import datetime, timezone, timedelta
from decimal import Decimal
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.sale import Sale, SaleItem, SalePayment, SaleStatus, PaymentMethod
from app.models.product import Product, GlobalProduct, Inventory, GlobalInventory
from app.models.accounting import TransactionType, AccountsReceivable
from app.utils.payment_methods import to_acc_payment_method
from app.models.inventory_log import InventoryMovementType
from app.schemas.sale import SaleCreate
from app.services.global_product import GlobalInventoryService
from app.services.notification_utils import send_welcome_notification_if_first_transaction

logger = logging.getLogger(__name__)


class SaleCreationMixin:
    """Provides ``create_sale`` to :class:`SaleService` via mixin composition.

    Depends on ``self.db`` (AsyncSession) and ``self._generate_sale_code``
    from :class:`SaleUtilityMixin`.
    """

    db: AsyncSession

    async def create_sale(
        self,
        sale_data: SaleCreate,
        user_id: UUID | None = None
    ) -> Sale:
        """Create a sale with items, payments, and accounting entries.

        Orchestrates seven sequential phases within a single DB transaction:

        1. **Validation** — batch-load products and inventory, verify stock
        2. **Sale record** — generate code, persist Sale row
        3. **Items + inventory** — create SaleItems, reserve stock
        4. **Payments** — validate split payments, create SalePayment rows
        5. **Accounting** — create Transaction + update balance accounts;
           CREDIT payments generate AccountsReceivable instead
        6. **Notifications** — welcome email/WhatsApp on first purchase
        7. **Side effects** — print queue (cash), Telegram alert

        Historical sales (``is_historical=True``) skip inventory reservation
        and accounting — used for migrating legacy data.

        Args:
            sale_data: Validated sale payload including items and optional
                split payments. See :class:`SaleCreate` for field details.
            user_id: Authenticated user creating the sale. Falls back to
                ``sale_data.school_id`` for system-generated sales.

        Returns:
            The persisted Sale with ``items`` and ``payments`` eagerly loaded.

        Raises:
            ValueError: Product not found, insufficient stock, payment sum
                mismatch, or no valid payment method provided.
        """
        from app.services.inventory import InventoryService
        from app.schemas.product import GlobalInventoryAdjust

        inv_service = InventoryService(self.db)
        global_inv_service = GlobalInventoryService(self.db)

        is_historical = sale_data.is_historical

        logger.info(f"Creating sale - is_historical: {is_historical}, sale_date from request: {sale_data.sale_date}")

        code = await self._generate_sale_code(sale_data.school_id)

        # ── Phase 1: Batch-load products and inventory ──────────────
        items_data = []
        subtotal = Decimal("0")

        global_product_ids = [i.product_id for i in sale_data.items if i.is_global]
        school_product_ids = [i.product_id for i in sale_data.items if not i.is_global]

        global_products_map: dict = {}
        school_products_map: dict = {}

        if global_product_ids:
            result = await self.db.execute(
                select(GlobalProduct).where(
                    GlobalProduct.id.in_(global_product_ids),
                    GlobalProduct.is_active == True
                )
            )
            global_products_map = {p.id: p for p in result.scalars().all()}

        if school_product_ids:
            result = await self.db.execute(
                select(Product).where(
                    Product.id.in_(school_product_ids),
                    Product.school_id == sale_data.school_id,
                    Product.is_active == True
                )
            )
            school_products_map = {p.id: p for p in result.scalars().all()}

        global_inventory_map: dict[UUID, GlobalInventory] = {}
        school_inventory_map: dict[UUID, Inventory] = {}

        if not is_historical:
            if global_product_ids:
                result = await self.db.execute(
                    select(GlobalInventory).where(
                        GlobalInventory.product_id.in_(global_product_ids)
                    )
                )
                global_inventory_map = {
                    inv.product_id: inv for inv in result.scalars().all()
                }

            if school_product_ids:
                result = await self.db.execute(
                    select(Inventory).where(
                        Inventory.product_id.in_(school_product_ids),
                        Inventory.school_id == sale_data.school_id
                    )
                )
                school_inventory_map = {
                    inv.product_id: inv for inv in result.scalars().all()
                }

        # ── Validate each item and build items_data ─────────────────
        for item_data in sale_data.items:
            if item_data.is_global:
                global_product = global_products_map.get(item_data.product_id)

                if not global_product:
                    raise ValueError(f"Producto global {item_data.product_id} no encontrado")

                if not is_historical:
                    global_inv = global_inventory_map.get(global_product.id)
                    if not global_inv or global_inv.quantity < item_data.quantity:
                        raise ValueError(
                            f"Stock insuficiente para el producto global {global_product.code}"
                        )

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
                product = school_products_map.get(item_data.product_id)

                if not product:
                    raise ValueError(f"Producto {item_data.product_id} no encontrado")

                if not is_historical:
                    school_inv = school_inventory_map.get(product.id)
                    if not school_inv or school_inv.quantity < item_data.quantity:
                        raise ValueError(
                            f"Stock insuficiente para el producto {product.code}"
                        )

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

        total = subtotal

        # ── Phase 2: Create Sale record ─────────────────────────────
        colombia_tz = timezone(timedelta(hours=-5))

        if is_historical and sale_data.sale_date:
            sale_date = sale_data.sale_date
            logger.info(f"Using custom sale_date for historical sale: {sale_date}")
        else:
            sale_date = datetime.now(colombia_tz).replace(tzinfo=None)
            logger.info(f"Using Colombia datetime: {sale_date} (is_historical={is_historical}, sale_data.sale_date={sale_data.sale_date})")

        sale = Sale(
            school_id=sale_data.school_id,
            code=code,
            client_id=sale_data.client_id,
            user_id=user_id or sale_data.school_id,
            status=SaleStatus.COMPLETED,
            payment_method=sale_data.payment_method,
            total=total,
            paid_amount=total,
            is_historical=is_historical,
            sale_date=sale_date,
            notes=sale_data.notes
        )

        self.db.add(sale)
        await self.db.flush()
        await self.db.refresh(sale)

        # ── Phase 3: Create items and reserve inventory ─────────────
        for item_dict in items_data:
            item_dict["sale_id"] = sale.id
            sale_item = SaleItem(**item_dict)
            self.db.add(sale_item)

            if not is_historical:
                if item_dict["is_global_product"]:
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
                    await inv_service.reserve_stock(
                        item_dict["product_id"],
                        sale_data.school_id,
                        item_dict["quantity"],
                        sale_id=sale.id,
                        reference=code,
                    )

        await self.db.flush()

        # ── Phase 4: Split payments ─────────────────────────────────
        if sale_data.payments:
            total_payments = sum(p.amount for p in sale_data.payments)
            if total_payments != total:
                raise ValueError(
                    f"La suma de pagos ({total_payments}) no coincide con el total ({total})"
                )

            for payment_data in sale_data.payments:
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

        # ── Phase 5: Accounting entries ─────────────────────────────
        if not is_historical and sale.total > Decimal("0"):
            from app.services.accounting.transactions import TransactionService
            txn_service = TransactionService(self.db)

            payments_to_process = []

            if sale_data.payments:
                for payment_data in sale_data.payments:
                    payments_to_process.append({
                        "amount": payment_data.amount,
                        "method": payment_data.payment_method
                    })
            elif sale.payment_method:
                payments_to_process.append({
                    "amount": sale.total,
                    "method": sale.payment_method
                })

            if not payments_to_process:
                raise ValueError(
                    "No se proporcionaron pagos validos. Use 'payments' con montos > 0 "
                    "o especifique 'payment_method'"
                )

            credit_total = Decimal("0")
            sale_date = sale.sale_date.date() if hasattr(sale.sale_date, 'date') else sale.sale_date
            for payment_info in payments_to_process:
                if payment_info["method"] == PaymentMethod.CREDIT:
                    credit_total += payment_info["amount"]
                else:
                    method_label = payment_info['method'].value if hasattr(payment_info['method'], 'value') else payment_info['method']
                    desc = f"Venta {sale.code}" + (f" ({method_label})" if len(payments_to_process) > 1 else "")
                    await txn_service.record(
                        type=TransactionType.INCOME,
                        amount=payment_info["amount"],
                        payment_method=to_acc_payment_method(payment_info["method"]),
                        description=desc,
                        school_id=sale.school_id,
                        category="sales",
                        reference_code=sale.code,
                        transaction_date=sale_date,
                        sale_id=sale.id,
                        created_by=user_id,
                    )

            if credit_total > Decimal("0"):
                receivable = AccountsReceivable(
                    school_id=sale.school_id,
                    client_id=sale.client_id,
                    sale_id=sale.id,
                    amount=credit_total,
                    description=f"Venta a credito {sale.code}",
                    invoice_date=sale.sale_date.date() if hasattr(sale.sale_date, 'date') else sale.sale_date,
                    due_date=None,
                    created_by=user_id
                )
                self.db.add(receivable)

        await self.db.flush()
        await self.db.refresh(sale, ["items", "payments"])

        # ── Phase 6: Welcome notification (first purchase) ──────────
        if not is_historical and sale.client_id:
            await send_welcome_notification_if_first_transaction(
                db=self.db,
                client_id=sale.client_id,
                reference_code=sale.code,
                transaction_type="compra"
            )

        # ── Phase 7: Side effects (non-critical) ───────────────────
        if not is_historical and sale.total > Decimal("0"):
            has_cash_payment = False

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

                    source_device = sale.source.value if sale.source else "unknown"

                    print_queue_service = PrintQueueService(self.db)
                    queue_item = await print_queue_service.enqueue_sale(
                        sale=sale,
                        school_id=sale.school_id,
                        source_device=source_device,
                        client_name=client_name,
                        school_name=school_name
                    )

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
                    logger.error(f"Print queue enqueue failed for sale {sale.code}: {e}")

        if not is_historical:
            try:
                from app.services.telegram import fire_and_forget_routed_alert
                from app.services.telegram_messages import TelegramMessageBuilder
                from app.models.school import School

                school_result = await self.db.execute(
                    select(School).where(School.id == sale.school_id)
                )
                school = school_result.scalar_one_or_none()
                school_name = school.name if school else "N/A"

                msg = TelegramMessageBuilder.sale_created(
                    code=sale.code,
                    total=sale.total,
                    school_name=school_name,
                    payment_method=sale.payment_method.value if sale.payment_method else None,
                )
                fire_and_forget_routed_alert("sale_created", msg)
            except Exception as e:
                logger.error(f"Telegram alert failed for sale {sale.code}: {e}")

        return sale
