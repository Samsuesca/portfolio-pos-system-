"""
Inventory Service (unified — school_id=NULL means global)
"""
import logging
from uuid import UUID
from decimal import Decimal
from datetime import date, datetime
from sqlalchemy import select, update, func, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.models.product import Inventory, Product
from app.models.inventory_log import InventoryMovementType
from app.utils.timezone import get_colombia_date

logger = logging.getLogger(__name__)


from app.schemas.product import (
    InventoryCreate,
    InventoryUpdate,
    InventoryAdjust,
    LowStockProduct,
    InventoryReport,
)
from app.services.base import SchoolIsolatedService


class InventoryService(SchoolIsolatedService[Inventory]):

    def __init__(self, db: AsyncSession):
        super().__init__(Inventory, db)
        self._log_service = None

    @property
    def log_service(self):
        """Lazy-loaded `InventoryLogService` que comparte la misma sesion DB.

        Se importa diferido (dentro del getter) para romper el ciclo de
        importacion entre `inventory` e `inventory_log`. Se cachea por
        instancia de `InventoryService`, asi que la primera invocacion
        construye el servicio y las siguientes reutilizan la misma
        instancia (todas escriben en la misma transaccion).
        """
        if self._log_service is None:
            from app.services.inventory_log import InventoryLogService
            self._log_service = InventoryLogService(self.db)
        return self._log_service

    async def create_inventory(
        self,
        inventory_data: InventoryCreate
    ) -> Inventory:
        """Crea una fila de inventario nueva para un producto.

        Garantiza unicidad por (product_id, school_id) antes de insertar:
        no debe existir ya un inventario para ese par. Tambien valida que
        el `Product` referenciado exista y pertenezca al mismo `school_id`
        (o sea global si `school_id is None`); esto evita inventarios
        cruzados entre tenants.

        Side effects:
            - INSERT en tabla `inventory` (via `self.create()` del base service).
            - Hace `flush` pero NO `commit`: la transaccion la cierra el caller.
            - No registra movimiento en `inventory_logs` (es creacion, no ajuste).

        Returns:
            La fila `Inventory` recien creada con `quantity` y
            `min_stock_alert` segun `inventory_data`.

        Raises:
            ValueError: Si ya existe inventario para ese producto+colegio,
                o si el producto no existe / no pertenece al colegio.
        """
        existing = await self.get_by_product(
            inventory_data.product_id,
            inventory_data.school_id
        )
        if existing:
            raise ValueError("Inventory already exists for this product")

        product_query = select(Product).where(Product.id == inventory_data.product_id)
        if inventory_data.school_id is not None:
            product_query = product_query.where(Product.school_id == inventory_data.school_id)
        else:
            product_query = product_query.where(Product.school_id.is_(None))

        product = await self.db.execute(product_query)
        if not product.scalar_one_or_none():
            raise ValueError("Product not found or does not belong to this school")

        return await self.create(inventory_data.model_dump())

    async def update_inventory(
        self,
        inventory_id: UUID,
        school_id: UUID,
        inventory_data: InventoryUpdate
    ) -> Inventory | None:
        """Actualiza metadata del inventario (solo `min_stock_alert`).

        El schema `InventoryUpdate` ya no permite mutar `quantity` ni
        `reserved_quantity` por aqui. Para mover stock real usar
        `add_stock` / `remove_stock` / `adjust_quantity` (escriben
        `inventory_logs` y disparan alertas low_stock).

        Aislado por `school_id` por el base service.

        Returns:
            La fila actualizada, o `None` si no existe (o pertenece a otro
            colegio).
        """
        update_dict = inventory_data.model_dump(exclude_unset=True)
        return await self.update(inventory_id, school_id, update_dict)

    async def get_by_product(
        self,
        product_id: UUID,
        school_id: UUID | None
    ) -> Inventory | None:
        """Busca el inventario de un producto en un colegio (o global).

        Distingue explicitamente entre `school_id=None` (inventario de
        productos globales: zapatos, medias, jeans, blusas) y `school_id`
        especifico. Esto es necesario porque `school_id IS NULL` no se
        puede expresar con `==` en SQL y los indices unicos de la tabla
        son parciales (uno para school NOT NULL, otro para school IS NULL).

        Args:
            school_id: UUID del colegio, o `None` para inventario global.

        Returns:
            La fila `Inventory` correspondiente, o `None` si no hay
            registro (lo que NO equivale a stock cero — significa que
            nunca se ha creado fila para ese producto).
        """
        if school_id is not None:
            result = await self.db.execute(
                select(Inventory).where(
                    Inventory.product_id == product_id,
                    Inventory.school_id == school_id
                )
            )
        else:
            result = await self.db.execute(
                select(Inventory).where(
                    Inventory.product_id == product_id,
                    Inventory.school_id.is_(None)
                )
            )
        return result.scalar_one_or_none()

    async def adjust_quantity(
        self,
        product_id: UUID,
        school_id: UUID | None,
        adjust_data: InventoryAdjust,
        movement_type: InventoryMovementType | None = None,
        reference: str | None = None,
        sale_id: UUID | None = None,
        order_id: UUID | None = None,
        sale_change_id: UUID | None = None,
        created_by: UUID | None = None,
    ) -> Inventory | None:
        """Aplica un delta (positivo o negativo) al `quantity` de un producto.

        Es el primitivo central de todo movimiento de stock: `add_stock`,
        `remove_stock`, `reserve_stock` y `release_stock` delegan aqui.
        Si no existe fila de inventario para el producto, la crea con
        `quantity=0` y `min_stock_alert=5` por defecto antes de aplicar
        el delta — esto permite que la primera entrada de stock funcione
        sin un setup previo explicito.

        Side effects:
            - Modifica DIRECTAMENTE `inventory.quantity` (no hay separacion
              entre stock real y reservado en este modelo: la "reserva"
              de un order/sale descuenta `quantity`).
            - Registra una fila en `inventory_logs` con el `movement_type`
              (si no se pasa, infiere ADJUSTMENT_IN/OUT por el signo).
              Si el log falla, se loggea warning pero NO se aborta el
              ajuste de stock — invariante: el stock siempre se persiste
              aunque la auditoria se pierda.
            - Dispara alerta low_stock (Telegram + notificacion interna)
              SOLO al cruzar el umbral hacia abajo: `old >= min_alert` y
              `new < min_alert`. Por construccion, un stock que ya estaba
              por debajo del umbral NO redispara la alerta en cada salida.
            - Hace `flush` + `refresh` pero NO `commit`.
            - NO toma lock pesimista (FOR UPDATE): hay riesgo teorico de
              oversell bajo concurrencia alta — la unica salvaguarda es
              el `CheckConstraint('quantity >= 0')` a nivel DB, que
              abortaria la transaccion del segundo writer.

        Args:
            adjust_data: Lleva `adjustment` (delta firmado) y `reason`
                opcional para describir el movimiento en el log.
            movement_type: Tipo semantico del movimiento (SALE,
                ORDER_RESERVE, CHANGE_RETURN, etc.). Si es `None`,
                se infiere por el signo del delta.
            reference: Codigo legible (ej. codigo de venta/pedido) para
                trazabilidad en el log.
            sale_id / order_id / sale_change_id: FKs opcionales para
                vincular el movimiento a la transaccion de negocio que
                lo origino.
            created_by: User UUID responsable del movimiento.

        Returns:
            La fila `Inventory` con su `quantity` actualizado, o `None`
            solo si la creacion auto fallara (no ocurre en la practica).

        Raises:
            ValueError: Si el delta dejaria `quantity` negativo. Mensaje
                en español con el stock actual y el solicitado.
        """
        inventory = await self.get_by_product(product_id, school_id)

        if not inventory:
            inventory = Inventory(
                product_id=product_id,
                school_id=school_id,
                quantity=0,
                reserved_quantity=0,
                min_stock_alert=5
            )
            self.db.add(inventory)
            await self.db.flush()

        old_quantity = inventory.quantity
        delta = adjust_data.adjustment

        # Atomic UPDATE con check inline contra reserved_quantity.
        # Para deltas negativos, garantiza que la operacion no deje quantity
        # por debajo de reserved_quantity (lo cual violaria el invariante
        # `reserved <= quantity`). Para deltas positivos, el check siempre
        # pasa (quantity solo crece).
        # Esto reemplaza el patron read-then-write que sufria race condition
        # bajo concurrencia.
        stmt = (
            update(Inventory)
            .where(Inventory.id == inventory.id)
            .where(Inventory.quantity + delta >= Inventory.reserved_quantity)
            .values(quantity=Inventory.quantity + delta)
            .returning(Inventory.quantity)
        )
        result = await self.db.execute(stmt)
        new_qty_row = result.first()
        if new_qty_row is None:
            await self.db.refresh(inventory)
            available = inventory.quantity - inventory.reserved_quantity
            raise ValueError(
                f"Stock insuficiente. Disponible: {available} "
                f"(total={inventory.quantity}, reservado={inventory.reserved_quantity}). "
                f"Solicitado: {abs(delta)}. "
                f"Hay {inventory.reserved_quantity} unidad(es) reservada(s) a pedidos; "
                f"libere la reserva para poder ajustar."
            )
        new_quantity = new_qty_row[0]
        await self.db.refresh(inventory)

        if movement_type is None:
            if adjust_data.adjustment > 0:
                movement_type = InventoryMovementType.ADJUSTMENT_IN
            else:
                movement_type = InventoryMovementType.ADJUSTMENT_OUT

        description = adjust_data.reason or f"Inventory adjustment: {adjust_data.adjustment:+d}"

        await self._safe_create_log(
            inventory_id=inventory.id,
            school_id=school_id,
            movement_type=movement_type,
            quantity_delta=adjust_data.adjustment,
            quantity_after=new_quantity,
            description=description,
            reference=reference,
            sale_id=sale_id,
            order_id=order_id,
            sale_change_id=sale_change_id,
            created_by=created_by,
            movement_date=get_colombia_date(),
        )

        if (
            adjust_data.adjustment < 0
            and new_quantity < inventory.min_stock_alert
            and old_quantity >= inventory.min_stock_alert
        ):
            await self._notify_low_stock(product_id, school_id, new_quantity, inventory.min_stock_alert)

        return inventory

    async def _notify_low_stock(
        self,
        product_id: UUID,
        school_id: UUID | None,
        current_quantity: int,
        min_stock_alert: int
    ) -> None:
        try:
            product = await self.db.execute(
                select(Product).where(Product.id == product_id)
            )
            product = product.scalar_one_or_none()

            if product:
                from app.services.notification import NotificationService
                notification_service = NotificationService(self.db)
                await notification_service.notify_low_stock(
                    product_id=product_id,
                    product_code=product.code,
                    product_name=product.name,
                    current_quantity=current_quantity,
                    min_stock_alert=min_stock_alert,
                    school_id=school_id
                )

                from app.services.telegram import fire_and_forget_routed_alert
                from app.services.telegram_messages import TelegramMessageBuilder
                from app.models.school import School

                school_name = "Global"
                if school_id:
                    school_result = await self.db.execute(
                        select(School).where(School.id == school_id)
                    )
                    school = school_result.scalar_one_or_none()
                    school_name = school.name if school else "N/A"

                msg = TelegramMessageBuilder.low_stock(
                    product_code=product.code,
                    product_name=product.name,
                    current_qty=current_quantity,
                    min_alert=min_stock_alert,
                    school_name=school_name,
                )
                fire_and_forget_routed_alert("low_stock", msg, school_id=school_id)
        except Exception as e:
            logger.warning(f"Failed to send low stock notification: {e}")

    async def add_stock(
        self,
        product_id: UUID,
        school_id: UUID | None,
        quantity: int,
        reason: str | None = None,
        movement_type: InventoryMovementType | None = None,
        reference: str | None = None,
        sale_id: UUID | None = None,
        order_id: UUID | None = None,
        sale_change_id: UUID | None = None,
        created_by: UUID | None = None,
    ) -> Inventory | None:
        """Incrementa el stock de un producto (entrada de inventario).

        Wrapper sobre `adjust_quantity` con delta positivo. Usado para
        compras a proveedor, recepcion de produccion, devoluciones de
        cliente (CHANGE_RETURN) y reversas de cancelacion (SALE_CANCEL,
        ORDER_CANCEL).

        Side effects:
            - Igual que `adjust_quantity` con delta `+quantity`.
            - NUNCA dispara alerta low_stock (solo se cruzan umbrales hacia
              abajo).

        Args:
            quantity: Cantidad positiva a sumar. Debe ser > 0.
            reason: Texto descriptivo opcional persistido en el log.
            movement_type: Si es `None`, default `ADJUSTMENT_IN`. Para
                operaciones especificas pasar `CHANGE_RETURN`,
                `SALE_CANCEL`, `ORDER_CANCEL`, etc.

        Raises:
            ValueError: Si `quantity <= 0` (no permite ceros ni negativos
                — para restar usar `remove_stock`).
        """
        if quantity <= 0:
            raise ValueError("Quantity must be positive")

        return await self.adjust_quantity(
            product_id,
            school_id,
            InventoryAdjust(adjustment=quantity, reason=reason),
            movement_type=movement_type or InventoryMovementType.ADJUSTMENT_IN,
            reference=reference,
            sale_id=sale_id,
            order_id=order_id,
            sale_change_id=sale_change_id,
            created_by=created_by,
        )

    async def remove_stock(
        self,
        product_id: UUID,
        school_id: UUID | None,
        quantity: int,
        reason: str | None = None,
        movement_type: InventoryMovementType | None = None,
        reference: str | None = None,
        sale_id: UUID | None = None,
        order_id: UUID | None = None,
        sale_change_id: UUID | None = None,
        created_by: UUID | None = None,
    ) -> Inventory | None:
        """Decrementa el stock de un producto (salida de inventario).

        Wrapper sobre `adjust_quantity` con delta negativo. Usado para
        venta efectiva, entrega de cambio (CHANGE_OUT), perdida/merma,
        y reservas de pedido (que en este modelo son descuentos directos
        de `quantity`, no una columna separada).

        Side effects:
            - Igual que `adjust_quantity` con delta `-quantity`.
            - PUEDE disparar alerta low_stock si esta operacion cruza el
              umbral `min_stock_alert` hacia abajo.

        Args:
            quantity: Cantidad positiva a restar (el signo lo aplica este
                metodo). Debe ser > 0.
            reason: Texto descriptivo opcional persistido en el log.
            movement_type: Si es `None`, default `ADJUSTMENT_OUT`. Para
                operaciones especificas pasar `SALE`, `ORDER_RESERVE`,
                `CHANGE_OUT`, etc.

        Raises:
            ValueError: Si `quantity <= 0`, o si el descuento dejaria
                el stock por debajo de cero (mensaje propagado desde
                `adjust_quantity`).
        """
        if quantity <= 0:
            raise ValueError("Quantity must be positive")

        return await self.adjust_quantity(
            product_id,
            school_id,
            InventoryAdjust(adjustment=-quantity, reason=reason),
            movement_type=movement_type or InventoryMovementType.ADJUSTMENT_OUT,
            reference=reference,
            sale_id=sale_id,
            order_id=order_id,
            sale_change_id=sale_change_id,
            created_by=created_by,
        )

    async def list_by_school(
        self,
        school_id: UUID,
        skip: int = 0,
        limit: int = 100,
    ) -> tuple[list[Inventory], int]:
        """Lista paginada del inventario de un colegio con su producto cargado.

        Hace `joinedload(Inventory.product)` para evitar N+1 queries cuando
        el caller serializa los items con datos del producto. Ordena por
        `product_id` para resultado estable entre paginas.

        Solo retorna inventarios de UN colegio; productos globales
        (`school_id IS NULL`) se obtienen por otra via (`get_global_low_stock`
        u otros endpoints globales).

        Args:
            skip: Offset de paginacion.
            limit: Tamaño de pagina (sin tope duro — el caller debe
                validar si se expone publicamente).

        Returns:
            Tupla `(items, total)` donde `total` es el conteo absoluto
            sin offset/limit (para calcular total_pages en el caller).
        """
        count_stmt = select(func.count()).select_from(Inventory).where(Inventory.school_id == school_id)
        total = (await self.db.execute(count_stmt)).scalar() or 0

        stmt = (
            select(Inventory)
            .options(joinedload(Inventory.product))
            .where(Inventory.school_id == school_id)
            .order_by(Inventory.product_id)
            .offset(skip)
            .limit(limit)
        )
        result = await self.db.execute(stmt)
        items = list(result.unique().scalars().all())
        return items, total

    async def get_low_stock_products(
        self,
        school_id: UUID
    ) -> list[LowStockProduct]:
        """Devuelve productos del colegio con stock al alcanzar o bajo el umbral.

        Filtra `quantity <= min_stock_alert` (criterio unificado en todo el
        sistema) y solo productos activos. Incluye agotados (`quantity=0`).
        Para conteos separados de "low" (qty>0) vs "out of stock" (qty=0),
        ver `get_inventory_report`.

        Returns:
            Lista de `LowStockProduct` ordenada por `quantity` ascendente
            (los mas criticos primero), con campo `difference` = umbral - actual.
        """
        result = await self.db.execute(
            select(Inventory, Product)
            .join(Product, Inventory.product_id == Product.id)
            .where(
                Inventory.school_id == school_id,
                Inventory.quantity <= Inventory.min_stock_alert,
                Product.is_active == True
            )
            .order_by(Inventory.quantity)
        )

        low_stock = []
        for inv, product in result.all():
            low_stock.append(
                LowStockProduct(
                    product_id=product.id,
                    product_code=product.code,
                    product_name=product.name,
                    size=product.size,
                    color=product.color,
                    current_quantity=inv.quantity,
                    min_stock_alert=inv.min_stock_alert,
                    difference=inv.min_stock_alert - inv.quantity
                )
            )

        return low_stock

    async def get_global_low_stock(self, limit: int = 50) -> list[Inventory]:
        """Devuelve inventarios globales (`school_id IS NULL`) con stock bajo.

        Equivalente a `get_low_stock_products` pero para productos globales
        (zapatos, medias, jeans, blusas), que viven en la misma tabla
        `inventory` pero con `school_id = NULL` y tienen su propio indice
        unico parcial. Usa `<=` (a diferencia del `<` estricto en
        `get_low_stock_products`), de modo que items justo en el umbral
        TAMBIEN se reportan aqui.

        Args:
            limit: Tope de items a retornar (default 50).

        Returns:
            Lista de `Inventory` con `product` cargado (joinedload),
            ordenada por `quantity` ascendente.
        """
        result = await self.db.execute(
            select(Inventory)
            .options(joinedload(Inventory.product))
            .where(
                Inventory.school_id.is_(None),
                Inventory.quantity > 0,
                Inventory.quantity <= Inventory.min_stock_alert
            )
            .order_by(Inventory.quantity)
            .limit(limit)
        )
        return list(result.unique().scalars().all())

    async def get_out_of_stock_products(
        self,
        school_id: UUID
    ) -> list[Product]:
        """Devuelve los productos activos del colegio con stock exactamente cero.

        Solo considera productos con `is_active = True` (no reporta SKUs
        retirados). Usa join sobre `inventory`, asi que productos sin fila
        de inventario NO aparecen aqui (por definicion no tienen stock,
        pero tampoco hay registro — usar otra via si se requiere
        identificar productos sin inventario nunca creado).

        Returns:
            Lista de `Product` ordenada por `code`.
        """
        result = await self.db.execute(
            select(Product)
            .join(Inventory, Inventory.product_id == Product.id)
            .where(
                Inventory.school_id == school_id,
                Inventory.quantity == 0,
                Product.is_active == True
            )
            .order_by(Product.code)
        )

        return list(result.scalars().all())

    async def get_inventory_report(
        self,
        school_id: UUID
    ) -> InventoryReport:
        """Construye un resumen agregado del inventario de un colegio.

        Calcula en una sola pasada:
        - Total de filas de inventario (no de unidades).
        - Valor total del stock = SUM(quantity * Product.cost), excluyendo
          productos sin costo definido (Product.cost IS NULL no se suma).
        - Conteo de items en low-stock (`0 < quantity <= min_stock_alert`)
          — no incluye agotados.
        - Conteo de items agotados (`quantity == 0`).
        - Listado detallado de items en/bajo umbral, incluyendo agotados
          (mismo criterio `<= min_stock_alert` que `get_low_stock_products`).

        Criterio unificado en todo el sistema: `quantity <= min_stock_alert`.
        El listado incluye agotados; los KPIs los reportan en bucket separado
        (`out_of_stock_count`).

        Side effects:
            - Solo lectura, ejecuta 4 queries de agregacion + 1 detallado.

        Returns:
            `InventoryReport` con totales y la lista de productos criticos.
        """
        total_products = await self.db.execute(
            select(func.count(Inventory.id)).where(
                Inventory.school_id == school_id
            )
        )

        stock_value = await self.db.execute(
            select(func.sum(Inventory.quantity * Product.cost))
            .select_from(Inventory)
            .join(Product, Inventory.product_id == Product.id)
            .where(
                Inventory.school_id == school_id,
                Product.cost.isnot(None)
            )
        )

        low_stock_count = await self.db.execute(
            select(func.count(Inventory.id)).where(
                Inventory.school_id == school_id,
                Inventory.quantity <= Inventory.min_stock_alert,
                Inventory.quantity > 0
            )
        )

        out_of_stock_count = await self.db.execute(
            select(func.count(Inventory.id)).where(
                Inventory.school_id == school_id,
                Inventory.quantity == 0
            )
        )

        low_stock_products = await self.get_low_stock_products(school_id)

        return InventoryReport(
            total_products=total_products.scalar_one(),
            total_stock_value=Decimal(stock_value.scalar_one() or 0),
            low_stock_count=low_stock_count.scalar_one(),
            out_of_stock_count=out_of_stock_count.scalar_one(),
            low_stock_products=low_stock_products
        )

    async def check_availability(
        self,
        product_id: UUID,
        school_id: UUID | None,
        quantity: int
    ) -> bool:
        """Verifica si hay suficiente stock para satisfacer una cantidad pedida.

        Lectura simple, sin lock: el resultado puede quedar obsoleto antes
        de que el caller reserve. Es un check oportunista, NO una garantia
        — la garantia real la da el `CheckConstraint('quantity >= 0')` al
        intentar el UPDATE en `adjust_quantity`.

        Si no existe fila de inventario para ese producto, retorna `False`
        (sin fila => sin stock disponible).

        Args:
            quantity: Cantidad requerida a verificar.

        Returns:
            `True` si `inventory.quantity >= quantity`, `False` en otro caso
            (incluyendo cuando no hay fila de inventario).
        """
        inventory = await self.get_by_product(product_id, school_id)
        if not inventory:
            return False

        return inventory.available >= quantity

    async def _safe_create_log(self, **kwargs) -> None:
        """Crea inventory_log con retry + DLQ.

        Delega a `InventoryLogService.create_log_with_retry`, que intenta
        hasta 3 veces con backoff dentro de SAVEPOINTs. Si los 3 fallan,
        persiste en `failed_inventory_logs` (DLQ) usando una sesion separada
        y dispara alerta Telegram. La transaccion principal del stock nunca
        se aborta por culpa del log.
        """
        await self.log_service.create_log_with_retry(**kwargs)

    async def _atomic_adjust_reserved(
        self,
        inventory_id: UUID,
        delta: int,
    ) -> int | None:
        """Aplica un delta atomico a `reserved_quantity` con check de invariantes.

        Garantiza:
          - reserved_quantity + delta >= 0 (no negativo)
          - reserved_quantity + delta <= quantity (no excede stock total)

        Returns:
            El nuevo valor de `reserved_quantity` si la operacion fue
            aplicada, o `None` si fallaron los checks (concurrencia o falta
            de stock disponible).
        """
        stmt = (
            update(Inventory)
            .where(Inventory.id == inventory_id)
            .where(Inventory.reserved_quantity + delta >= 0)
            .where(Inventory.reserved_quantity + delta <= Inventory.quantity)
            .values(reserved_quantity=Inventory.reserved_quantity + delta)
            .returning(Inventory.reserved_quantity)
        )
        result = await self.db.execute(stmt)
        row = result.first()
        return row[0] if row else None

    async def _atomic_consume_reserved(
        self,
        inventory_id: UUID,
        amount: int,
    ) -> tuple[int, int] | None:
        """Consume reserva: decrementa `reserved_quantity` y `quantity` por `amount`.

        Atomico. Garantiza:
          - reserved_quantity >= amount (hay reserva suficiente para consumir)
          - quantity >= amount (siempre verdadero por invariante reserved <= quantity,
            pero el check explicito blinda contra estados inconsistentes)

        Returns:
            Tupla (nueva_quantity, nueva_reserved) si la operacion fue
            aplicada, o `None` si fallaron los checks.
        """
        stmt = (
            update(Inventory)
            .where(Inventory.id == inventory_id)
            .where(Inventory.reserved_quantity >= amount)
            .where(Inventory.quantity >= amount)
            .values(
                quantity=Inventory.quantity - amount,
                reserved_quantity=Inventory.reserved_quantity - amount,
            )
            .returning(Inventory.quantity, Inventory.reserved_quantity)
        )
        result = await self.db.execute(stmt)
        row = result.first()
        return (row[0], row[1]) if row else None

    async def reserve_stock(
        self,
        product_id: UUID,
        school_id: UUID | None,
        quantity: int,
        movement_type: InventoryMovementType | None = None,
        reference: str | None = None,
        sale_id: UUID | None = None,
        order_id: UUID | None = None,
        created_by: UUID | None = None,
    ) -> Inventory | None:
        """Incrementa `reserved_quantity` para apartar stock a una orden.

        En el modelo actual la reserva NO toca `quantity` (stock fisico total).
        Solo incrementa `reserved_quantity`, que representa items comprometidos
        a pedidos READY (fisicamente movidos a la estanteria de encargos).
        El consumo real ocurre cuando el pedido se entrega (DELIVERED), via
        `consume_reserved_stock`.

        Atomic: usa UPDATE con check inline contra `quantity` (no se puede
        reservar mas de lo que hay fisicamente). Resistente a race conditions.

        Tipos de movimiento inferidos:
            - `order_id` presente => `InventoryMovementType.ORDER_RESERVE`
            - ninguno o `sale_id` => `ADJUSTMENT_OUT`
        Para Sales (compras inmediatas) usar `remove_stock` directamente.

        Side effects:
            - Incremento atomico de `reserved_quantity`.
            - Registra log con razon legible.
            - NO modifica `quantity`, NO dispara alerta low_stock.

        Returns:
            `Inventory` refrescado con la nueva reserva.

        Raises:
            ValueError: Si `quantity <= 0` o si no hay stock disponible
                (`available < quantity` solicitada).
        """
        if quantity <= 0:
            raise ValueError("Quantity must be positive")

        inventory = await self.get_by_product(product_id, school_id)
        if not inventory:
            raise ValueError(
                f"No inventory record for product {product_id} (school={school_id})"
            )

        new_reserved = await self._atomic_adjust_reserved(inventory.id, quantity)
        if new_reserved is None:
            await self.db.refresh(inventory)
            raise ValueError(
                f"Insufficient inventory to reserve. Available: {inventory.available} "
                f"(quantity={inventory.quantity}, reserved={inventory.reserved_quantity}), "
                f"Requested: {quantity}"
            )

        await self.db.refresh(inventory)

        if movement_type is None:
            movement_type = (
                InventoryMovementType.ORDER_RESERVE if order_id
                else InventoryMovementType.ADJUSTMENT_OUT
            )

        reason = "Reserved for order" if order_id else "Reserved"

        await self._safe_create_log(
            inventory_id=inventory.id,
            school_id=school_id,
            movement_type=movement_type,
            quantity_delta=-quantity,
            quantity_after=inventory.quantity,
            description=reason,
            reference=reference,
            sale_id=sale_id,
            order_id=order_id,
            created_by=created_by,
            movement_date=get_colombia_date(),
        )

        return inventory

    async def release_stock(
        self,
        product_id: UUID,
        school_id: UUID | None,
        quantity: int,
        movement_type: InventoryMovementType | None = None,
        reference: str | None = None,
        sale_id: UUID | None = None,
        order_id: UUID | None = None,
        sale_change_id: UUID | None = None,
        created_by: UUID | None = None,
    ) -> Inventory | None:
        """Libera reserva: decrementa `reserved_quantity` sin tocar `quantity`.

        Inversa de `reserve_stock`. Se invoca al cancelar un pedido reservado
        antes de la entrega (los items vuelven fisicamente de la estanteria
        de encargos a la de ventas). NO afecta `quantity` porque el stock
        nunca salio de la tienda.

        Atomic: garantiza `reserved_quantity - quantity >= 0`.

        Tipos de movimiento inferidos:
            - `order_id` presente => `ORDER_CANCEL`
            - ninguno => `ADJUSTMENT_IN`

        Side effects:
            - Decremento atomico de `reserved_quantity`.
            - Registra log.

        Args:
            sale_change_id: FK opcional para vincular a una solicitud de cambio.

        Returns:
            `Inventory` refrescado.

        Raises:
            ValueError: Si `quantity <= 0` o si la reserva actual es menor
                que la cantidad a liberar (probable bug de doble cancelacion).
        """
        if quantity <= 0:
            raise ValueError("Quantity must be positive")

        inventory = await self.get_by_product(product_id, school_id)
        if not inventory:
            raise ValueError(
                f"No inventory record for product {product_id} (school={school_id})"
            )

        new_reserved = await self._atomic_adjust_reserved(inventory.id, -quantity)
        if new_reserved is None:
            await self.db.refresh(inventory)
            raise ValueError(
                f"Cannot release more than reserved. "
                f"Currently reserved: {inventory.reserved_quantity}, Requested release: {quantity}"
            )

        await self.db.refresh(inventory)

        if movement_type is None:
            movement_type = (
                InventoryMovementType.ORDER_CANCEL if order_id
                else InventoryMovementType.ADJUSTMENT_IN
            )

        reason = "Released from cancelled order" if order_id else "Released"

        await self._safe_create_log(
            inventory_id=inventory.id,
            school_id=school_id,
            movement_type=movement_type,
            quantity_delta=quantity,
            quantity_after=inventory.quantity,
            description=reason,
            reference=reference,
            sale_id=sale_id,
            order_id=order_id,
            sale_change_id=sale_change_id,
            created_by=created_by,
            movement_date=get_colombia_date(),
        )

        return inventory

    async def consume_reserved_stock(
        self,
        product_id: UUID,
        school_id: UUID | None,
        quantity: int,
        movement_type: InventoryMovementType | None = None,
        reference: str | None = None,
        order_id: UUID | None = None,
        created_by: UUID | None = None,
    ) -> Inventory | None:
        """Consume reserva: decrementa `quantity` Y `reserved_quantity` juntos.

        Se invoca en la transicion `OrderItem.status = DELIVERED`: el cliente
        se lleva fisicamente las prendas de la estanteria de encargos, asi
        que el inventario total baja y la reserva se libera al mismo tiempo.

        Atomic: ambos decrementos en una sola query con check inline.

        Side effects:
            - Decremento atomico de `quantity` y `reserved_quantity`.
            - Registra log con `ORDER_DELIVER` (o el movement_type que pase
              el caller).
            - PUEDE disparar alerta low_stock al cruzar `min_stock_alert`.

        Returns:
            `Inventory` refrescado.

        Raises:
            ValueError: Si `quantity <= 0` o si no hay reserva suficiente
                (probable bug en el flow del Order: marcando DELIVERED un
                item que no estaba reservado).
        """
        if quantity <= 0:
            raise ValueError("Quantity must be positive")

        inventory = await self.get_by_product(product_id, school_id)
        if not inventory:
            raise ValueError(
                f"No inventory record for product {product_id} (school={school_id})"
            )

        old_quantity = inventory.quantity
        result = await self._atomic_consume_reserved(inventory.id, quantity)
        if result is None:
            await self.db.refresh(inventory)
            raise ValueError(
                f"Cannot consume reserved stock. "
                f"Currently reserved: {inventory.reserved_quantity}, "
                f"Quantity: {inventory.quantity}, Requested: {quantity}"
            )
        new_quantity, _ = result
        await self.db.refresh(inventory)

        if movement_type is None:
            movement_type = InventoryMovementType.ORDER_DELIVER

        reason = "Delivered from reserved" if order_id else "Consumed from reserved"

        await self._safe_create_log(
            inventory_id=inventory.id,
            school_id=school_id,
            movement_type=movement_type,
            quantity_delta=-quantity,
            quantity_after=new_quantity,
            description=reason,
            reference=reference,
            order_id=order_id,
            created_by=created_by,
            movement_date=get_colombia_date(),
        )

        if (
            new_quantity < inventory.min_stock_alert
            and old_quantity >= inventory.min_stock_alert
        ):
            await self._notify_low_stock(
                product_id, school_id, new_quantity, inventory.min_stock_alert
            )

        return inventory
