"""Sale change (cambios y devoluciones) workflow.

Handles four types of post-sale product modifications:
- **SIZE_CHANGE** — same product, different size
- **PRODUCT_CHANGE** — swap for a different product
- **RETURN** — return without replacement (full refund)
- **DEFECT** — exchange due to manufacturing defect

State machine::

    PENDING ──approve──▸ APPROVED
         │                  ▲
         ├──reject──▸ REJECTED
         │
         └──(no stock)──▸ PENDING_STOCK ──complete──▸ APPROVED
                              │
                              └── Creates an Order for the new product.
                                  Original product returned to inventory
                                  immediately. Accounting settled at creation.

When stock is unavailable and ``create_order_if_no_stock=True``, the system:
1. Returns the original product to inventory immediately
2. Settles accounting (price adjustment) immediately
3. Creates an Order for the new product
4. Sets change status to PENDING_STOCK
5. When the order is fulfilled, ``complete_change_from_order`` marks it APPROVED
"""
import logging
from uuid import UUID
from datetime import date
from decimal import Decimal
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.utils.timezone import get_colombia_date
from app.models.sale import (
    Sale, SaleItem, SaleStatus, SaleChange, ChangeStatus, ChangeType, PaymentMethod
)
from app.models.product import Product
from app.models.accounting import TransactionType, AccPaymentMethod
from app.models.inventory_log import InventoryMovementType
from app.schemas.sale import SaleChangeCreate

logger = logging.getLogger(__name__)


class SaleChangeMixin:
    """Provides sale change operations to :class:`SaleService`."""

    db: AsyncSession

    async def create_sale_change(
        self,
        sale_id: UUID,
        school_id: UUID,
        user_id: UUID,
        change_data: SaleChangeCreate
    ) -> SaleChange:
        from app.services.inventory import InventoryService

        inv_service = InventoryService(self.db)

        sale = await self.get(sale_id, school_id)
        if not sale:
            raise ValueError("Venta no encontrada")

        if sale.status == SaleStatus.CANCELLED:
            raise ValueError("No se puede modificar una venta cancelada")

        original_item_result = await self.db.execute(
            select(SaleItem)
            .options(selectinload(SaleItem.product))
            .where(
                SaleItem.id == change_data.original_item_id,
                SaleItem.sale_id == sale_id
            )
        )
        original_item = original_item_result.scalar_one_or_none()

        if not original_item:
            raise ValueError("Producto original de la venta no encontrado")

        approved_changes_result = await self.db.execute(
            select(func.coalesce(func.sum(SaleChange.returned_quantity), 0))
            .where(
                SaleChange.original_item_id == original_item.id,
                SaleChange.status == ChangeStatus.APPROVED
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

            has_stock = await inv_service.check_availability(
                new_product.id,
                new_product.school_id,
                change_data.new_quantity
            )

            new_product_id = new_product.id
            new_unit_price = new_product.price

            price_adjustment = (
                (new_unit_price * change_data.new_quantity) -
                (original_item.unit_price * change_data.returned_quantity)
            )

            if not has_stock:
                if change_data.create_order_if_no_stock:
                    if not sale.client_id:
                        raise ValueError(
                            "No se puede crear un encargo automatico porque la venta no tiene cliente registrado. "
                            "Asigne un cliente a la venta primero o agregue stock del producto manualmente."
                        )
                    return await self._create_change_with_order(
                        sale=sale,
                        original_item=original_item,
                        change_data=change_data,
                        school_id=school_id,
                        user_id=user_id,
                        new_product=new_product,
                        new_product_id=new_product_id,
                        new_unit_price=new_unit_price,
                        price_adjustment=price_adjustment,
                        inv_service=inv_service,
                    )
                else:
                    raise ValueError(f"Stock insuficiente para el producto {new_product.code}")
        else:
            price_adjustment = -(original_item.unit_price * change_data.returned_quantity)

        change = SaleChange(
            sale_id=sale_id,
            original_item_id=original_item.id,
            user_id=user_id,
            change_type=change_data.change_type,
            returned_quantity=change_data.returned_quantity,
            new_product_id=new_product_id,
            new_quantity=change_data.new_quantity,
            new_unit_price=new_unit_price,
            price_adjustment=price_adjustment,
            reason=change_data.reason,
            status=ChangeStatus.PENDING
        )

        self.db.add(change)
        await self.db.flush()
        await self.db.refresh(change)

        return change

    async def _create_change_with_order(
        self,
        sale: Sale,
        original_item: SaleItem,
        change_data: SaleChangeCreate,
        school_id: UUID,
        user_id: UUID,
        new_product,
        new_product_id: UUID | None,
        new_unit_price: Decimal,
        price_adjustment: Decimal,
        inv_service,
    ) -> SaleChange:
        from app.services.order import OrderService
        from app.schemas.order import OrderCreate, OrderItemCreate
        from app.services.accounting.transactions import TransactionService

        order_service = OrderService(self.db)
        txn_service = TransactionService(self.db)

        original_product = original_item.product
        await inv_service.add_stock(
            original_item.product_id,
            original_product.school_id,
            change_data.returned_quantity,
            f"Devolucion anticipada - Cambio pendiente de stock",
            movement_type=InventoryMovementType.CHANGE_RETURN,
            sale_id=sale.id,
            created_by=user_id,
        )

        if price_adjustment != 0:
            payment_method = change_data.payment_method or PaymentMethod.CASH
            payment_method_str = payment_method.value if hasattr(payment_method, 'value') else str(payment_method)

            if payment_method_str != 'credit':
                acc_payment_method = AccPaymentMethod(payment_method_str)
                txn_type = TransactionType.INCOME if price_adjustment > 0 else TransactionType.EXPENSE
                desc = (f"Diferencia cobrada - Cambio pendiente venta {sale.code}"
                        if price_adjustment > 0
                        else f"Reembolso - Cambio pendiente venta {sale.code}")

                await txn_service.record(
                    type=txn_type,
                    amount=Decimal(str(abs(price_adjustment))),
                    payment_method=acc_payment_method,
                    description=desc,
                    school_id=school_id,
                    category="sale_changes",
                    reference_code=f"CHG-{sale.code}",
                    transaction_date=get_colombia_date(),
                    sale_id=sale.id,
                    created_by=user_id,
                    # Reembolso: sale de la misma cuenta donde entró el dinero original
                    force_income_map=(txn_type == TransactionType.EXPENSE),
                )

        garment_type_id = getattr(new_product, 'garment_type_id', None)

        order_data = OrderCreate(
            school_id=school_id,
            client_id=sale.client_id,
            notes=f"Encargo automatico por cambio de venta {sale.code} [sale_id:{sale.id}]. Motivo: {change_data.reason}",
            items=[
                OrderItemCreate(
                    garment_type_id=garment_type_id,
                    product_id=new_product_id,
                    quantity=change_data.new_quantity,
                    unit_price=new_unit_price,
                    order_type="catalog",
                    reserve_stock=False,
                    size=getattr(new_product, 'size', None),
                    color=getattr(new_product, 'color', None),
                )
            ]
        )

        order = await order_service.create_order(order_data, user_id)

        change = SaleChange(
            sale_id=sale.id,
            original_item_id=original_item.id,
            user_id=user_id,
            change_type=change_data.change_type,
            returned_quantity=change_data.returned_quantity,
            new_product_id=new_product_id,
            new_quantity=change_data.new_quantity,
            new_unit_price=new_unit_price,
            price_adjustment=price_adjustment,
            reason=change_data.reason,
            status=ChangeStatus.PENDING_STOCK,
            order_id=order.id
        )

        self.db.add(change)
        await self.db.flush()
        await self.db.refresh(change)

        return change

    async def approve_sale_change(
        self,
        change_id: UUID,
        school_id: UUID,
        payment_method: PaymentMethod = PaymentMethod.CASH,
        approved_by: UUID | None = None
    ) -> SaleChange:
        from app.services.inventory import InventoryService
        from app.services.accounting.transactions import TransactionService

        inv_service = InventoryService(self.db)
        txn_service = TransactionService(self.db)

        result = await self.db.execute(
            select(SaleChange)
            .options(
                selectinload(SaleChange.sale),
                selectinload(SaleChange.original_item).selectinload(SaleItem.product),
            )
            .where(SaleChange.id == change_id)
        )
        change = result.scalar_one_or_none()

        if not change:
            raise ValueError("Solicitud de cambio no encontrada")

        if change.sale.school_id != school_id:
            raise ValueError("El cambio no pertenece a este colegio")

        if change.status != ChangeStatus.PENDING:
            raise ValueError(f"Change already {change.status.value}")

        original_product = change.original_item.product
        await inv_service.add_stock(
            change.original_item.product_id,
            original_product.school_id,
            change.returned_quantity,
            f"Devolucion - Cambio #{change.id}",
            movement_type=InventoryMovementType.CHANGE_RETURN,
            sale_change_id=change.id,
            sale_id=change.sale_id,
            created_by=approved_by,
        )

        if change.new_product_id:
            new_product_result = await self.db.execute(
                select(Product).where(Product.id == change.new_product_id)
            )
            new_product = new_product_result.scalar_one_or_none()

            has_stock = await inv_service.check_availability(
                change.new_product_id,
                new_product.school_id if new_product else school_id,
                change.new_quantity
            )

            if not has_stock:
                raise ValueError("Stock ya no disponible para el nuevo producto")

            await inv_service.remove_stock(
                change.new_product_id,
                new_product.school_id if new_product else school_id,
                change.new_quantity,
                f"Entrega - Cambio #{change.id}",
                movement_type=InventoryMovementType.CHANGE_OUT,
                sale_change_id=change.id,
                sale_id=change.sale_id,
                created_by=approved_by,
            )

        # Liquidación financiera con modelo overpayment / balance_owed
        # (mismo modelo que orders): primero ajustamos receivable, después caja real.
        await self._settle_sale_change_finance(
            change=change,
            school_id=school_id,
            payment_method=payment_method,
            txn_service=txn_service,
            approved_by=approved_by,
        )

        # Sale.total y Sale.paid_amount reflejan el valor real de la venta
        # post-cambio (los SaleItems no se mutan, así que el ajuste se aplica
        # como delta sobre el total).
        sale = change.sale
        sale.total = Decimal(str(sale.total)) + Decimal(str(change.price_adjustment))

        change.status = ChangeStatus.APPROVED
        await self.db.flush()
        await self.db.refresh(change)

        return change

    async def reject_sale_change(
        self,
        change_id: UUID,
        school_id: UUID,
        rejection_reason: str
    ) -> SaleChange:
        result = await self.db.execute(
            select(SaleChange)
            .options(selectinload(SaleChange.sale))
            .where(SaleChange.id == change_id)
        )
        change = result.scalar_one_or_none()

        if not change:
            raise ValueError("Solicitud de cambio no encontrada")

        if change.sale.school_id != school_id:
            raise ValueError("El cambio no pertenece a este colegio")

        if change.status != ChangeStatus.PENDING:
            raise ValueError(f"Change already {change.status.value}")

        change.status = ChangeStatus.REJECTED
        change.rejection_reason = rejection_reason

        await self.db.flush()
        await self.db.refresh(change)

        return change

    async def get_sale_changes(
        self,
        sale_id: UUID,
        school_id: UUID
    ) -> list[SaleChange]:
        sale = await self.get(sale_id, school_id)
        if not sale:
            raise ValueError("Venta no encontrada")

        result = await self.db.execute(
            select(SaleChange)
            .where(SaleChange.sale_id == sale_id)
            .order_by(SaleChange.created_at.desc())
        )

        return list(result.scalars().all())

    async def _settle_sale_change_finance(
        self,
        change: SaleChange,
        school_id: UUID,
        payment_method: PaymentMethod,
        txn_service,
        approved_by: UUID | None,
    ) -> None:
        """Aplica price_adjustment al receivable/caja sin doble-contabilizar.

        Modelo idéntico al de orders: si el cliente debe más, o se cobra ahora
        (cash) o se engrosa el receivable (credit). Si el cliente recibe valor,
        primero se reduce el receivable abierto y solo el residuo se reembolsa
        en caja. Saldo a favor con method=credit bloquea hasta que exista
        sistema de customer_credit.
        """
        from app.models.accounting import AccountsReceivable

        adj = Decimal(str(change.price_adjustment))
        if adj == 0:
            return

        method_str = payment_method.value if hasattr(payment_method, 'value') else str(payment_method)
        is_credit = (method_str == 'credit')
        sale = change.sale

        rec_result = await self.db.execute(
            select(AccountsReceivable).where(
                AccountsReceivable.sale_id == sale.id,
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
                        client_id=sale.client_id,
                        sale_id=sale.id,
                        amount=adj,
                        description=f"Diferencia por cambio {change.id} venta {sale.code}",
                        invoice_date=ar_invoice_date,
                        due_date=default_ar_due_date(ar_invoice_date),
                        created_by=approved_by,
                    )
                    self.db.add(new_rec)
            else:
                acc_pm = AccPaymentMethod(method_str)
                await txn_service.record(
                    type=TransactionType.INCOME,
                    amount=adj,
                    payment_method=acc_pm,
                    description=f"Diferencia cobrada - Cambio venta {sale.code}",
                    school_id=school_id,
                    category="sale_changes",
                    reference_code=f"CHG-{sale.code}",
                    transaction_date=get_colombia_date(),
                    sale_id=sale.id,
                    created_by=approved_by,
                )
                sale.paid_amount = Decimal(str(sale.paid_amount)) + adj
            return

        # adj < 0: cliente recibe valor
        refund_amount = abs(adj)
        rec_reduction = min(refund_amount, rec_balance)
        overpayment = refund_amount - rec_reduction

        if rec_reduction > 0 and rec is not None:
            new_amount = Decimal(str(rec.amount)) - rec_reduction
            if new_amount <= Decimal("0"):
                # CHECK constraint chk_ar_amount_positive exige amount > 0.
                rec.amount_paid = Decimal(str(rec.amount))
                rec.is_paid = True
            else:
                rec.amount = new_amount
                if new_amount <= Decimal(str(rec.amount_paid)):
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
                description=f"Reembolso - Cambio venta {sale.code}",
                school_id=school_id,
                category="sale_changes",
                reference_code=f"CHG-{sale.code}",
                transaction_date=get_colombia_date(),
                sale_id=sale.id,
                created_by=approved_by,
                force_income_map=True,
            )
            new_paid = Decimal(str(sale.paid_amount)) - overpayment
            if new_paid < 0:
                logger.warning(
                    f"paid_amount de venta {sale.code} pasaría a {new_paid} tras refund "
                    f"de {overpayment}; se clampa a 0. Revisar consistencia de datos."
                )
                new_paid = Decimal("0")
            sale.paid_amount = new_paid

    async def complete_change_from_order(
        self,
        change_id: UUID,
        school_id: UUID,
        approved_by: UUID | None = None
    ) -> SaleChange:
        from app.services.order import OrderService
        from app.models.order import OrderStatus

        order_service = OrderService(self.db)

        result = await self.db.execute(
            select(SaleChange)
            .options(
                selectinload(SaleChange.sale),
                selectinload(SaleChange.order)
            )
            .where(SaleChange.id == change_id)
        )
        change = result.scalar_one_or_none()

        if not change:
            raise ValueError("Solicitud de cambio no encontrada")

        if change.sale.school_id != school_id:
            raise ValueError("El cambio no pertenece a este colegio")

        if change.status != ChangeStatus.PENDING_STOCK:
            raise ValueError(f"Este cambio no esta esperando stock. Estado actual: {change.status.value}")

        if not change.order_id:
            raise ValueError("Este cambio no tiene un pedido asociado")

        order = change.order
        if not order:
            raise ValueError("El pedido asociado no fue encontrado")

        change.status = ChangeStatus.APPROVED
        await self.db.flush()
        await self.db.refresh(change)

        return change
