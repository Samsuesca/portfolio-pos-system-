"""
Order Changes Mixin

Contains order change (cambios y devoluciones de encargos) methods:
- create_order_change
- approve_order_change
- reject_order_change
- get_order_changes
"""
import logging
from uuid import UUID
from decimal import Decimal
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.utils.timezone import get_colombia_date, get_colombia_now_naive
from app.models.order import (
    Order, OrderItem, OrderStatus, OrderItemStatus, OrderChange, OriginalItemDisposal
)
from app.models.sale import ChangeStatus, ChangeType, PaymentMethod
from app.models.product import Product
from app.models.accounting import Transaction, TransactionType, AccPaymentMethod, AccountsReceivable
from app.models.inventory_log import InventoryMovementType
from app.schemas.order import OrderChangeCreate

logger = logging.getLogger(__name__)


class OrderChangeMixin:
    """Mixin providing order change methods for OrderService"""

    db: AsyncSession

    async def create_order_change(
        self,
        order_id: UUID,
        school_id: UUID,
        user_id: UUID,
        change_data: OrderChangeCreate
    ) -> OrderChange:
        order = await self.get_order_with_items(order_id, school_id)
        if not order:
            raise ValueError("Encargo no encontrado")

        if order.status == OrderStatus.CANCELLED:
            raise ValueError("No se puede modificar un encargo cancelado")

        original_item_result = await self.db.execute(
            select(OrderItem)
            .options(selectinload(OrderItem.product))
            .where(
                OrderItem.id == change_data.original_item_id,
                OrderItem.order_id == order_id
            )
        )
        original_item = original_item_result.scalar_one_or_none()

        if not original_item:
            raise ValueError("Item original del encargo no encontrado")

        if original_item.item_status == OrderItemStatus.CANCELLED:
            raise ValueError("No se puede modificar un item cancelado")

        approved_changes_result = await self.db.execute(
            select(func.coalesce(func.sum(OrderChange.returned_quantity), 0))
            .where(
                OrderChange.original_item_id == original_item.id,
                OrderChange.status == ChangeStatus.APPROVED
            )
        )
        already_returned = approved_changes_result.scalar() or 0
        available_quantity = original_item.quantity - already_returned

        if change_data.returned_quantity > available_quantity:
            if already_returned > 0:
                raise ValueError(
                    f"Cantidad disponible insuficiente. "
                    f"Original: {original_item.quantity}, Ya devuelto: {already_returned}, "
                    f"Disponible: {available_quantity}"
                )
            else:
                raise ValueError("La cantidad a devolver no puede exceder la cantidad original")

        # Disposal del item físico original.
        # Si vino de stock (Caso A): la liberación al inventario es automática y no requiere disposal.
        # Si NO vino de stock (estaba en producción o terminado made-to-order): el operador debe declarar el destino.
        item_came_from_stock = bool(original_item.reserved_from_stock)
        disposal = change_data.original_item_disposal
        if not item_came_from_stock:
            if disposal is None:
                raise ValueError(
                    "El item original no vino de stock (estaba en producción o terminado a la medida). "
                    "Debe especificar 'original_item_disposal': cancel_production, return_to_inventory o register_loss."
                )
            self._validate_disposal_against_item(disposal, original_item)
        elif disposal is not None and disposal != OriginalItemDisposal.RETURN_TO_INVENTORY:
            # Si vino de stock pero el operador pidió otra cosa, es contradictorio.
            raise ValueError(
                "El item vino de stock; el destino válido es 'return_to_inventory' o dejarlo vacío."
            )

        new_unit_price = None
        price_adjustment = Decimal("0")
        new_product_id = None

        if change_data.change_type != ChangeType.RETURN:
            if not change_data.new_product_id:
                raise ValueError(f"{change_data.change_type.value} requiere un nuevo producto")

            new_product_result = await self.db.execute(
                select(Product).where(
                    Product.id == change_data.new_product_id,
                    Product.is_active == True
                )
            )
            new_product = new_product_result.scalar_one_or_none()

            if not new_product:
                raise ValueError("Nuevo producto no encontrado o inactivo")

            if new_product.school_id is not None and new_product.school_id != school_id:
                raise ValueError("Nuevo producto no pertenece a este colegio")

            new_product_id = new_product.id
            new_unit_price = new_product.price

            price_adjustment = (
                (new_unit_price * change_data.new_quantity) -
                (original_item.unit_price * change_data.returned_quantity)
            )
        else:
            price_adjustment = -(original_item.unit_price * change_data.returned_quantity)

        change = OrderChange(
            order_id=order_id,
            original_item_id=original_item.id,
            user_id=user_id,
            change_type=change_data.change_type,
            returned_quantity=change_data.returned_quantity,
            new_product_id=new_product_id,
            new_quantity=change_data.new_quantity,
            new_unit_price=new_unit_price,
            new_size=change_data.new_size,
            new_color=change_data.new_color,
            new_custom_measurements=change_data.new_custom_measurements,
            new_embroidery_text=change_data.new_embroidery_text,
            price_adjustment=price_adjustment,
            reason=change_data.reason,
            status=ChangeStatus.PENDING,
            original_item_disposal=disposal,
        )

        self.db.add(change)
        await self.db.flush()
        await self.db.refresh(change)

        return change

    async def approve_order_change(
        self,
        change_id: UUID,
        school_id: UUID,
        payment_method: PaymentMethod = PaymentMethod.CASH,
        approved_by: UUID | None = None
    ) -> OrderChange:
        from app.services.inventory import InventoryService
        from app.services.accounting.transactions import TransactionService

        inv_service = InventoryService(self.db)
        txn_service = TransactionService(self.db)

        result = await self.db.execute(
            select(OrderChange)
            .options(
                selectinload(OrderChange.order),
                selectinload(OrderChange.original_item).selectinload(OrderItem.product),
                selectinload(OrderChange.new_product),
            )
            .where(OrderChange.id == change_id)
        )
        change = result.scalar_one_or_none()

        if not change:
            raise ValueError("Solicitud de cambio no encontrada")

        if change.order.school_id != school_id:
            raise ValueError("El cambio no pertenece a este colegio")

        if change.status != ChangeStatus.PENDING:
            raise ValueError(f"El cambio ya fue procesado: {change.status.value}")

        order = change.order
        item = change.original_item

        # === STEP 1: Dispose of original physical item ===
        # Caso A (reservado de stock): liberación automática al inventario.
        # Casos B/C (producción / made-to-order): aplicar disposal declarado.
        if item.reserved_from_stock and item.quantity_reserved > 0:
            quantity_to_release = min(change.returned_quantity, item.quantity_reserved)
            if quantity_to_release > 0:
                try:
                    original_product = item.product
                    await inv_service.release_stock(
                        product_id=item.product_id,
                        school_id=original_product.school_id if original_product else school_id,
                        quantity=quantity_to_release,
                        movement_type=InventoryMovementType.CHANGE_RETURN,
                        reference=f"OCHG-{change.id}",
                        order_id=order.id,
                        created_by=approved_by,
                    )
                    item.quantity_reserved -= quantity_to_release
                    if item.quantity_reserved <= 0:
                        item.reserved_from_stock = False
                    logger.info(f"Released {quantity_to_release} units for order change {change.id}")
                except Exception as e:
                    logger.warning(f"Could not release stock for order change {change.id}: {e}")
        else:
            await self._apply_original_item_disposal(
                change=change, item=item, school_id=school_id,
                inv_service=inv_service, approved_by=approved_by,
            )

        # === STEP 2: Modify the OrderItem in-place ===
        if change.change_type == ChangeType.RETURN:
            item.quantity -= change.returned_quantity
            if item.quantity <= 0:
                item.quantity = 0
                item.item_status = OrderItemStatus.CANCELLED
                item.status_updated_at = get_colombia_now_naive()
            item.subtotal = Decimal(str(item.unit_price)) * item.quantity
        else:
            item.product_id = change.new_product_id
            new_product = change.new_product
            if new_product:
                if hasattr(new_product, 'garment_type_id'):
                    item.garment_type_id = new_product.garment_type_id
                # Resnapshotear unit_cost del producto nuevo (margen correcto en reportes)
                if hasattr(new_product, 'cost') and new_product.cost is not None:
                    item.unit_cost = new_product.cost

            item.quantity = change.new_quantity
            item.unit_price = change.new_unit_price
            item.subtotal = Decimal(str(change.new_unit_price)) * change.new_quantity

            if change.new_size is not None:
                item.size = change.new_size
            if change.new_color is not None:
                item.color = change.new_color
            if change.new_custom_measurements is not None:
                item.custom_measurements = change.new_custom_measurements
            if change.new_embroidery_text is not None:
                item.embroidery_text = change.new_embroidery_text

            new_item_reserved = False
            try:
                if change.new_product_id:
                    new_product_school_id = new_product.school_id if new_product else school_id
                    has_stock = await inv_service.check_availability(
                        change.new_product_id, new_product_school_id, change.new_quantity
                    )
                    if has_stock:
                        await inv_service.reserve_stock(
                            product_id=change.new_product_id,
                            school_id=new_product_school_id,
                            quantity=change.new_quantity,
                            movement_type=InventoryMovementType.CHANGE_OUT,
                            reference=f"OCHG-{change.id}",
                            order_id=order.id,
                            created_by=approved_by,
                        )
                        new_item_reserved = True
            except Exception as e:
                logger.warning(f"Could not reserve stock for new product in order change {change.id}: {e}")
                new_item_reserved = False

            if new_item_reserved:
                item.reserved_from_stock = True
                item.quantity_reserved = change.new_quantity
                item.item_status = OrderItemStatus.READY
            else:
                item.reserved_from_stock = False
                item.quantity_reserved = 0
                item.item_status = OrderItemStatus.PENDING
            item.status_updated_at = get_colombia_now_naive()

        # === STEP 3: Recalculate order totals ===
        items_result = await self.db.execute(
            select(OrderItem).where(
                OrderItem.order_id == order.id,
                OrderItem.item_status != OrderItemStatus.CANCELLED
            )
        )
        active_items = items_result.scalars().all()
        new_subtotal = sum(Decimal(str(i.subtotal)) for i in active_items)
        order.subtotal = new_subtotal
        order.total = new_subtotal + Decimal(str(order.tax)) + Decimal(str(order.delivery_fee))

        # === STEP 4: Handle financial adjustment with overpayment / balance_owed model ===
        # Invariante: order.total - order.paid_amount = open receivable balance.
        # price_adjustment se reparte entre receivable y paid_amount (caja real),
        # NUNCA ambos a la vez como hacía la lógica anterior.
        await self._settle_change_finance(
            change=change, order=order, school_id=school_id,
            payment_method=payment_method, txn_service=txn_service, approved_by=approved_by,
        )

        # === STEP 5: Update change status ===
        change.status = ChangeStatus.APPROVED
        await self.db.flush()

        # === STEP 6: Sync order status from items ===
        await self._sync_order_status_from_items(order.id, school_id)

        await self.db.refresh(change)
        return change

    async def reject_order_change(
        self,
        change_id: UUID,
        school_id: UUID,
        rejection_reason: str
    ) -> OrderChange:
        result = await self.db.execute(
            select(OrderChange)
            .options(selectinload(OrderChange.order))
            .where(OrderChange.id == change_id)
        )
        change = result.scalar_one_or_none()

        if not change:
            raise ValueError("Solicitud de cambio no encontrada")

        if change.order.school_id != school_id:
            raise ValueError("El cambio no pertenece a este colegio")

        if change.status != ChangeStatus.PENDING:
            raise ValueError(f"El cambio ya fue procesado: {change.status.value}")

        change.status = ChangeStatus.REJECTED
        change.rejection_reason = rejection_reason

        await self.db.flush()
        await self.db.refresh(change)

        return change

    async def get_order_changes(
        self,
        order_id: UUID,
        school_id: UUID
    ) -> list[OrderChange]:
        order = await self.get(order_id, school_id)
        if not order:
            raise ValueError("Encargo no encontrado")

        result = await self.db.execute(
            select(OrderChange)
            .where(OrderChange.order_id == order_id)
            .order_by(OrderChange.created_at.desc())
        )

        return list(result.scalars().all())

    async def _apply_original_item_disposal(
        self,
        change: OrderChange,
        item: OrderItem,
        school_id: UUID,
        inv_service,
        approved_by: UUID | None,
    ) -> None:
        """Apply the declared disposal for an item that did NOT come from stock.

        Si por alguna razón el cambio quedó sin disposal (datos legacy o cambio
        creado antes de esta migración), defaultea a ``register_loss`` y loguea
        warning. No bloquea — el cambio ya fue creado.
        """
        disposal = change.original_item_disposal
        if disposal is None:
            logger.warning(
                f"OrderChange {change.id} sin original_item_disposal en aprobación; "
                f"asumiendo register_loss para preservar trazabilidad."
            )
            disposal = OriginalItemDisposal.REGISTER_LOSS
            change.original_item_disposal = disposal

        qty = change.returned_quantity

        if disposal == OriginalItemDisposal.CANCEL_PRODUCTION:
            # Trabajo abandonado, sin contabilizar. Solo log para trazabilidad.
            logger.info(
                f"OrderChange {change.id}: cancel_production de {qty}u "
                f"(item {item.id}, producto {item.product_id})."
            )

        elif disposal == OriginalItemDisposal.RETURN_TO_INVENTORY:
            # Prenda terminada no personalizada vuelve al inventario regular.
            try:
                product = item.product
                await inv_service.add_stock(
                    product_id=item.product_id,
                    school_id=product.school_id if product else school_id,
                    quantity=qty,
                    movement_type=InventoryMovementType.CHANGE_RETURN,
                    reference=f"OCHG-{change.id}",
                    order_id=change.order_id,
                    created_by=approved_by,
                )
                logger.info(
                    f"OrderChange {change.id}: return_to_inventory de {qty}u del producto {item.product_id}."
                )
            except Exception as e:
                logger.error(
                    f"Falló return_to_inventory para change {change.id}: {e}. "
                    "El item se considera perdido en lugar de regresado."
                )
                # Degrada a register_loss para no perder trazabilidad
                change.original_item_disposal = OriginalItemDisposal.REGISTER_LOSS

        elif disposal == OriginalItemDisposal.REGISTER_LOSS:
            # Pérdida explícita. La columna disposal queda como registro;
            # contabilización detallada de costo será parte de la Fase 2.
            logger.info(
                f"OrderChange {change.id}: register_loss de {qty}u "
                f"(item {item.id}, producto {item.product_id}, subtotal ${item.subtotal})."
            )

    async def _settle_change_finance(
        self,
        change: OrderChange,
        order: Order,
        school_id: UUID,
        payment_method: PaymentMethod,
        txn_service,
        approved_by: UUID | None,
    ) -> None:
        """Aplica price_adjustment al receivable y a paid_amount sin doble-contabilizar.

        Modelo:
        - El order.total ya fue recalculado desde items.
        - El receivable abierto (si existe) representa lo que el cliente debe.
        - Si adj > 0 (cliente debe más):
          * credit  → engrosa receivable (crea uno si no había)
          * cash/etc → cobra ahora (INCOME), sube paid_amount
        - Si adj < 0 (cliente debe menos):
          * Reduce receivable hasta cero usando |adj|
          * Si quedó residuo (refund > deuda actual):
            - credit → bloquea (no hay customer_credit en Fase 0)
            - cash/etc → cash refund por el residuo (EXPENSE), baja paid_amount
        """
        adj = Decimal(str(change.price_adjustment))
        if adj == 0:
            return

        method_str = payment_method.value if hasattr(payment_method, 'value') else str(payment_method)
        is_credit = (method_str == 'credit')

        rec_result = await self.db.execute(
            select(AccountsReceivable).where(
                AccountsReceivable.order_id == order.id,
                AccountsReceivable.is_paid == False,
            )
        )
        rec = rec_result.scalar_one_or_none()
        rec_balance = (
            Decimal(str(rec.amount)) - Decimal(str(rec.amount_paid))
            if rec else Decimal("0")
        )

        if adj > 0:
            # Cliente debe más
            if is_credit:
                if rec:
                    rec.amount = Decimal(str(rec.amount)) + adj
                else:
                    from app.services.accounting.receivables import default_ar_due_date
                    ar_invoice_date = get_colombia_date()
                    new_rec = AccountsReceivable(
                        school_id=school_id,
                        client_id=order.client_id,
                        order_id=order.id,
                        amount=adj,
                        description=f"Diferencia por cambio {change.id} encargo {order.code}",
                        invoice_date=ar_invoice_date,
                        due_date=order.delivery_date or default_ar_due_date(ar_invoice_date),
                        created_by=approved_by,
                    )
                    self.db.add(new_rec)
            else:
                acc_pm = AccPaymentMethod(method_str)
                await txn_service.record(
                    type=TransactionType.INCOME,
                    amount=adj,
                    payment_method=acc_pm,
                    description=f"Diferencia cobrada - Cambio encargo {order.code}",
                    school_id=school_id,
                    category="order_changes",
                    reference_code=f"OCHG-{order.code}",
                    transaction_date=get_colombia_date(),
                    order_id=order.id,
                    created_by=approved_by,
                )
                order.paid_amount = Decimal(str(order.paid_amount)) + adj
            return

        # adj < 0: cliente recibe valor de vuelta
        refund_amount = abs(adj)
        rec_reduction = min(refund_amount, rec_balance)
        overpayment = refund_amount - rec_reduction

        if rec_reduction > 0 and rec is not None:
            new_rec_amount = Decimal(str(rec.amount)) - rec_reduction
            if new_rec_amount <= Decimal("0"):
                # El receivable se cierra completamente. El CHECK constraint
                # chk_ar_amount_positive exige amount > 0, por lo que saldamos
                # vía amount_paid en lugar de poner amount=0.
                rec.amount_paid = Decimal(str(rec.amount))
                rec.is_paid = True
            else:
                rec.amount = new_rec_amount
                if new_rec_amount <= Decimal(str(rec.amount_paid)):
                    rec.is_paid = True

        if overpayment > 0:
            if is_credit:
                raise ValueError(
                    f"El cambio genera saldo a favor del cliente por ${overpayment} que excede "
                    f"el receivable disponible (${rec_balance}). El método 'credit' no soporta "
                    "saldo a favor sin sistema de customer_credit. Use cash, transfer o nequi."
                )
            acc_pm = AccPaymentMethod(method_str)
            await txn_service.record(
                type=TransactionType.EXPENSE,
                amount=overpayment,
                payment_method=acc_pm,
                description=f"Reembolso - Cambio encargo {order.code}",
                school_id=school_id,
                category="order_changes",
                reference_code=f"OCHG-{order.code}",
                transaction_date=get_colombia_date(),
                order_id=order.id,
                created_by=approved_by,
                # Reembolso sale de la cuenta donde entró el dinero original
                force_income_map=True,
            )
            new_paid = Decimal(str(order.paid_amount)) - overpayment
            if new_paid < 0:
                # Defensivo: nunca dejar paid_amount negativo
                logger.warning(
                    f"paid_amount de orden {order.code} pasaría a {new_paid} tras refund de {overpayment}; "
                    "se clampa a 0. Revisar consistencia de datos."
                )
                new_paid = Decimal("0")
            order.paid_amount = new_paid

    def _validate_disposal_against_item(
        self,
        disposal: OriginalItemDisposal,
        original_item: OrderItem,
    ) -> None:
        """Sanity-check the chosen disposal against item characteristics.

        Bloquea combinaciones que delatan error humano (ej: pedir devolver al
        inventario una prenda con bordado custom). No bloquea decisiones
        gerenciales razonables — solo previene errores obvios.
        """
        is_personalized = bool(
            (original_item.embroidery_text and original_item.embroidery_text.strip())
            or original_item.custom_measurements
        )

        if disposal == OriginalItemDisposal.RETURN_TO_INVENTORY and is_personalized:
            raise ValueError(
                "No se puede devolver al inventario una prenda personalizada "
                "(con bordado o medidas custom). Use 'register_loss' o 'cancel_production'."
            )

        if disposal == OriginalItemDisposal.CANCEL_PRODUCTION and original_item.item_status in (
            OrderItemStatus.READY, OrderItemStatus.DELIVERED
        ):
            raise ValueError(
                f"El item ya está {original_item.item_status.value}; no se puede 'cancelar producción'. "
                f"Use 'return_to_inventory' (si no es personalizada) o 'register_loss'."
            )
