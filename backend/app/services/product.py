"""
Product and GarmentType Service (unified — school_id=NULL means global)
"""
from uuid import UUID
from sqlalchemy import select, func, delete as sa_delete, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload, selectinload

from app.models.product import (
    GarmentType,
    GarmentTypeImage,
    Product,
    Inventory,
    SchoolGlobalGarmentTypeExclusion,
    SchoolGarmentTypeOrder,
)
from app.models.sale import SaleItem, SaleChange
from app.models.order import Order, OrderItem, OrderStatus, OrderChange
from app.schemas.product import (
    CatalogOrderEntry,
    GarmentTypeCreate,
    GarmentTypeImageResponse,
    GarmentTypeUpdate,
    ProductCreate,
    ProductUpdate,
    ProductWithInventory,
)
from app.services.base import SchoolIsolatedService


class GarmentTypeService(SchoolIsolatedService[GarmentType]):

    def __init__(self, db: AsyncSession):
        super().__init__(GarmentType, db)

    async def create_garment_type(
        self,
        garment_data: GarmentTypeCreate
    ) -> GarmentType:
        existing = await self.db.execute(
            select(GarmentType).where(
                GarmentType.school_id == garment_data.school_id,
                GarmentType.name == garment_data.name
            )
        )
        if existing.scalar_one_or_none():
            raise ValueError(f"Garment type '{garment_data.name}' already exists in this school")

        return await self.create(garment_data.model_dump())

    async def create_global_garment_type(self, name: str, **kwargs) -> GarmentType:
        existing = await self.db.execute(
            select(GarmentType).where(
                GarmentType.school_id.is_(None),
                GarmentType.name == name
            )
        )
        if existing.scalar_one_or_none():
            raise ValueError(f"Global garment type '{name}' already exists")

        data = {"school_id": None, "name": name, **kwargs}
        garment_type = GarmentType(**data)
        self.db.add(garment_type)
        await self.db.flush()
        await self.db.refresh(garment_type)
        return garment_type

    async def get_global_garment_type(self, garment_type_id: UUID) -> GarmentType | None:
        result = await self.db.execute(
            select(GarmentType).where(
                GarmentType.id == garment_type_id,
                GarmentType.school_id.is_(None)
            )
        )
        return result.scalar_one_or_none()

    async def get_global_garment_type_by_name(self, name: str) -> GarmentType | None:
        result = await self.db.execute(
            select(GarmentType).where(
                GarmentType.school_id.is_(None),
                GarmentType.name == name
            )
        )
        return result.scalar_one_or_none()

    async def get_all_global_garment_types(self, active_only: bool = True) -> list[GarmentType]:
        query = (
            select(GarmentType)
            .options(selectinload(GarmentType.images))
            .where(GarmentType.school_id.is_(None))
        )
        if active_only:
            query = query.where(GarmentType.is_active == True)
        query = query.order_by(GarmentType.name)
        result = await self.db.execute(query)
        return list(result.unique().scalars().all())

    async def update_global_garment_type(
        self, garment_type_id: UUID, **kwargs
    ) -> GarmentType | None:
        garment_type = await self.get_global_garment_type(garment_type_id)
        if not garment_type:
            return None
        for field, value in kwargs.items():
            if value is not None and hasattr(garment_type, field):
                setattr(garment_type, field, value)
        await self.db.flush()
        await self.db.refresh(garment_type)
        return garment_type

    async def get_global_gt_hidden_school_ids(self, garment_type_id: UUID) -> list[UUID]:
        """Colegios donde este garment_type global esta OCULTO del catalogo publico."""
        result = await self.db.execute(
            select(SchoolGlobalGarmentTypeExclusion.school_id).where(
                SchoolGlobalGarmentTypeExclusion.global_garment_type_id == garment_type_id
            )
        )
        return list(result.scalars().all())

    async def set_global_gt_hidden_school_ids(
        self, garment_type_id: UUID, hidden_school_ids: list[UUID]
    ) -> None:
        """Reemplaza el set de exclusiones de un garment_type global.

        Borra las exclusiones que ya no estan e inserta las nuevas. No hace commit
        (lo hace la ruta). Asume que `garment_type_id` ya fue validado como global.
        """
        desired = set(hidden_school_ids)
        current = set(await self.get_global_gt_hidden_school_ids(garment_type_id))

        to_remove = current - desired
        to_add = desired - current

        if to_remove:
            await self.db.execute(
                sa_delete(SchoolGlobalGarmentTypeExclusion).where(
                    SchoolGlobalGarmentTypeExclusion.global_garment_type_id == garment_type_id,
                    SchoolGlobalGarmentTypeExclusion.school_id.in_(to_remove),
                )
            )
        for school_id in to_add:
            self.db.add(
                SchoolGlobalGarmentTypeExclusion(
                    school_id=school_id,
                    global_garment_type_id=garment_type_id,
                )
            )
        await self.db.flush()

    async def _visible_garment_type_ids(self, school_id: UUID) -> set[UUID]:
        """Tipos de prenda que aparecen en el catalogo del colegio: propios + globales no excluidos."""
        excluded = select(SchoolGlobalGarmentTypeExclusion.global_garment_type_id).where(
            SchoolGlobalGarmentTypeExclusion.school_id == school_id
        )
        result = await self.db.execute(
            select(GarmentType.id).where(
                or_(
                    GarmentType.school_id == school_id,
                    GarmentType.school_id.is_(None),
                ),
                GarmentType.id.not_in(excluded),
            )
        )
        return set(result.scalars().all())

    async def get_school_catalog_order(self, school_id: UUID) -> list[CatalogOrderEntry]:
        """Orden persistido de los tipos de prenda en el catalogo del colegio."""
        result = await self.db.execute(
            select(SchoolGarmentTypeOrder)
            .where(SchoolGarmentTypeOrder.school_id == school_id)
            .order_by(SchoolGarmentTypeOrder.display_order)
        )
        return [
            CatalogOrderEntry(garment_type_id=row.garment_type_id, display_order=row.display_order)
            for row in result.scalars().all()
        ]

    async def reorder_school_catalog(
        self, school_id: UUID, garment_type_ids: list[UUID]
    ) -> list[CatalogOrderEntry]:
        """Reescribe el orden del catalogo del colegio. No hace commit (lo hace la ruta).

        Valida que cada id sea un tipo visible para el colegio (propio o global no
        excluido). Upsert idempotente por (school_id, garment_type_id); los tipos no
        incluidos conservan su fila pero caen al final en los frontends.
        """
        # Dedupe preservando el primer orden de aparicion.
        seen: list[UUID] = []
        for gt_id in garment_type_ids:
            if gt_id not in seen:
                seen.append(gt_id)

        valid_ids = await self._visible_garment_type_ids(school_id)
        for gt_id in seen:
            if gt_id not in valid_ids:
                raise ValueError(f"Tipo de prenda {gt_id} no visible para este colegio")

        existing_result = await self.db.execute(
            select(SchoolGarmentTypeOrder).where(
                SchoolGarmentTypeOrder.school_id == school_id
            )
        )
        existing = {row.garment_type_id: row for row in existing_result.scalars().all()}

        for order, gt_id in enumerate(seen):
            row = existing.get(gt_id)
            if row is not None:
                row.display_order = order
            else:
                self.db.add(
                    SchoolGarmentTypeOrder(
                        school_id=school_id,
                        garment_type_id=gt_id,
                        display_order=order,
                    )
                )
        await self.db.flush()
        return await self.get_school_catalog_order(school_id)

    async def delete_global_garment_type(self, garment_type_id: UUID) -> dict[str, str]:
        garment_type = await self.get_global_garment_type(garment_type_id)
        if not garment_type:
            raise ValueError("Tipo de prenda global no encontrado")

        active_products = await self.db.execute(
            select(func.count(Product.id)).where(
                Product.garment_type_id == garment_type_id,
                Product.is_active == True
            )
        )
        active_count = active_products.scalar() or 0
        if active_count > 0:
            raise ValueError(
                f"No se puede eliminar: tiene {active_count} producto(s) activo(s) asociado(s). "
                "Desactive o elimine los productos primero."
            )

        any_products = await self.db.execute(
            select(func.count(Product.id)).where(
                Product.garment_type_id == garment_type_id
            )
        )
        has_any_products = (any_products.scalar() or 0) > 0

        order_items_count = await self.db.execute(
            select(func.count(OrderItem.id)).where(
                OrderItem.garment_type_id == garment_type_id,
            )
        )
        has_order_refs = (order_items_count.scalar() or 0) > 0

        if has_any_products or has_order_refs:
            garment_type.is_active = False
            await self.db.flush()
            return {"mode": "deactivated", "message": "Tipo de prenda global desactivado (tiene historial asociado)"}

        await self.db.execute(
            sa_delete(GarmentTypeImage).where(
                GarmentTypeImage.garment_type_id == garment_type_id
            )
        )
        await self.db.execute(
            sa_delete(GarmentType).where(GarmentType.id == garment_type_id)
        )
        await self.db.flush()
        return {"mode": "deleted", "message": "Tipo de prenda global eliminado permanentemente"}

    async def update_garment_type(
        self,
        garment_id: UUID,
        school_id: UUID,
        garment_data: GarmentTypeUpdate
    ) -> GarmentType | None:
        update_dict = garment_data.model_dump(exclude_unset=True)
        return await self.update(garment_id, school_id, update_dict)

    async def get_active_garment_types(
        self,
        school_id: UUID,
        skip: int = 0,
        limit: int = 100
    ) -> list[GarmentType]:
        return await self.get_multi(
            school_id=school_id,
            skip=skip,
            limit=limit,
            filters={"is_active": True}
        )

    async def delete_garment_type(
        self,
        garment_type_id: UUID,
        school_id: UUID
    ) -> dict[str, str]:
        garment_type = await self.get(garment_type_id, school_id)
        if not garment_type:
            raise ValueError("Tipo de prenda no encontrado")

        active_products = await self.db.execute(
            select(func.count(Product.id)).where(
                Product.garment_type_id == garment_type_id,
                Product.school_id == school_id,
                Product.is_active == True
            )
        )
        active_count = active_products.scalar() or 0
        if active_count > 0:
            raise ValueError(
                f"No se puede eliminar: tiene {active_count} producto(s) activo(s) asociado(s). "
                "Desactive o elimine los productos primero."
            )

        inactive_products = await self.db.execute(
            select(func.count(Product.id)).where(
                Product.garment_type_id == garment_type_id,
                Product.school_id == school_id,
            )
        )
        has_any_products = (inactive_products.scalar() or 0) > 0

        order_items_count = await self.db.execute(
            select(func.count(OrderItem.id)).where(
                OrderItem.garment_type_id == garment_type_id,
            )
        )
        has_order_refs = (order_items_count.scalar() or 0) > 0

        if has_any_products or has_order_refs:
            await self.soft_delete(garment_type_id, school_id)
            return {"mode": "deactivated", "message": "Tipo de prenda desactivado (tiene historial asociado)"}

        await self.delete(garment_type_id, school_id)
        return {"mode": "deleted", "message": "Tipo de prenda eliminado permanentemente"}

    async def get_by_category(
        self,
        school_id: UUID,
        category: str
    ) -> list[GarmentType]:
        result = await self.db.execute(
            select(GarmentType).where(
                GarmentType.school_id == school_id,
                GarmentType.category == category,
                GarmentType.is_active == True
            )
        )
        return list(result.scalars().all())


class ProductService(SchoolIsolatedService[Product]):

    def __init__(self, db: AsyncSession):
        super().__init__(Product, db)

    async def create_product(
        self,
        product_data: ProductCreate
    ) -> Product:
        code = await self._generate_product_code(product_data.school_id)

        product_dict = product_data.model_dump()
        product_dict['code'] = code

        product = await self.create(product_dict)

        inventory = Inventory(
            product_id=product.id,
            school_id=product_data.school_id,
            quantity=0,
            min_stock_alert=5
        )
        self.db.add(inventory)
        await self.db.flush()

        return product

    async def create_global_product(
        self,
        garment_type_id: UUID,
        size: str,
        price,
        name: str | None = None,
        color: str | None = None,
        gender: str | None = None,
        cost=None,
        description: str | None = None,
        image_url: str | None = None,
    ) -> Product:
        garment_type_result = await self.db.execute(
            select(GarmentType).where(
                GarmentType.id == garment_type_id,
                GarmentType.school_id.is_(None)
            )
        )
        garment_type = garment_type_result.scalar_one_or_none()
        if not garment_type:
            raise ValueError("Global garment type not found")

        code = await self._generate_global_product_code(garment_type.name)

        if not name:
            name = f"{garment_type.name} {size}"
            if color:
                name += f" {color}"

        product = Product(
            school_id=None,
            garment_type_id=garment_type_id,
            code=code,
            name=name,
            size=size,
            color=color,
            gender=gender,
            price=price,
            cost=cost,
            description=description,
            image_url=image_url,
        )
        self.db.add(product)
        await self.db.flush()
        await self.db.refresh(product)

        inventory = Inventory(
            product_id=product.id,
            school_id=None,
            quantity=0,
            min_stock_alert=5
        )
        self.db.add(inventory)
        await self.db.flush()

        return product

    async def get_global_product(self, product_id: UUID) -> Product | None:
        result = await self.db.execute(
            select(Product).where(
                Product.id == product_id,
                Product.school_id.is_(None)
            )
        )
        return result.scalar_one_or_none()

    async def get_global_product_by_code(self, code: str) -> Product | None:
        result = await self.db.execute(
            select(Product).where(
                Product.code == code,
                Product.school_id.is_(None)
            )
        )
        return result.scalar_one_or_none()

    async def get_all_global_products(
        self,
        skip: int = 0,
        limit: int = 100,
        active_only: bool = True
    ) -> list[Product]:
        query = select(Product).where(Product.school_id.is_(None))
        if active_only:
            query = query.where(Product.is_active == True)
        query = query.order_by(Product.code).offset(skip).limit(limit)
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def get_global_products_with_inventory(
        self,
        skip: int = 0,
        limit: int = 500,
        with_images: bool = True,
        school_id: UUID | None = None,
    ) -> list[ProductWithInventory]:
        """Lista productos globales con inventario.

        Si `school_id` viene, excluye los globales cuyo garment_type esta marcado
        como oculto para ese colegio (tabla school_global_gt_exclusions). Sin
        school_id devuelve todos (uso de gestion interna).
        """
        options = [joinedload(Product.inventory)]
        if with_images:
            options.append(
                selectinload(Product.garment_type).selectinload(GarmentType.images)
            )
        else:
            options.append(selectinload(Product.garment_type))

        query = (
            select(Product)
            .options(*options)
            .where(
                Product.school_id.is_(None),
                Product.is_active == True
            )
        )
        if school_id is not None:
            excluded = select(SchoolGlobalGarmentTypeExclusion.global_garment_type_id).where(
                SchoolGlobalGarmentTypeExclusion.school_id == school_id
            )
            query = query.where(Product.garment_type_id.not_in(excluded))
        query = query.order_by(Product.code).offset(skip).limit(limit)
        result = await self.db.execute(query)
        products = result.unique().scalars().all()

        responses = []
        for p in products:
            inv = p.inventory
            # Para globales las imagenes viven en garment_type_images con school_id IS NULL.
            # Solo poblamos si with_images=True (sino la relacion no esta cargada).
            gt_images: list = []
            primary_url: str | None = None
            if with_images and p.garment_type and p.garment_type.images is not None:
                global_imgs = [img for img in p.garment_type.images if img.school_id is None]
                gt_images = [GarmentTypeImageResponse.model_validate(img) for img in global_imgs]
                primary = next((img for img in global_imgs if img.is_primary), None) or (global_imgs[0] if global_imgs else None)
                primary_url = primary.image_url if primary else None

            product_dict = {
                'id': p.id,
                'school_id': p.school_id,
                'code': p.code,
                'garment_type_id': p.garment_type_id,
                'garment_type_name': p.garment_type.name if p.garment_type else None,
                'name': p.name,
                'size': p.size,
                'color': p.color,
                'gender': p.gender,
                'price': p.price,
                'cost': p.cost,
                'description': p.description,
                'image_url': p.image_url,
                'is_active': p.is_active,
                'is_global': p.school_id is None,
                'created_at': p.created_at,
                'updated_at': p.updated_at,
                'inventory_quantity': inv.quantity if inv else 0,
                'inventory_reserved': inv.reserved_quantity if inv else 0,
                'inventory_available': (inv.quantity - inv.reserved_quantity) if inv else 0,
                'inventory_min_stock': inv.min_stock_alert if inv else 5,
                'garment_type_images': gt_images,
                'garment_type_primary_image_url': primary_url,
            }
            responses.append(ProductWithInventory(**product_dict))

        return responses

    async def get_global_products_by_garment_type(
        self,
        garment_type_id: UUID,
        active_only: bool = True
    ) -> list[Product]:
        query = select(Product).where(
            Product.garment_type_id == garment_type_id,
            Product.school_id.is_(None)
        )
        if active_only:
            query = query.where(Product.is_active == True)
        query = query.order_by(Product.size)
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def update_global_product(
        self, product_id: UUID, **kwargs
    ) -> Product | None:
        product = await self.get_global_product(product_id)
        if not product:
            return None

        for field, value in kwargs.items():
            if value is not None and hasattr(product, field):
                setattr(product, field, value)

        await self.db.flush()
        await self.db.refresh(product)
        return product

    async def delete_global_product(self, product_id: UUID) -> dict[str, str]:
        product = await self.get_global_product(product_id)
        if not product:
            raise ValueError("Producto global no encontrado")

        pending_orders = await self.db.execute(
            select(func.count(OrderItem.id)).join(
                Order, OrderItem.order_id == Order.id
            ).where(
                OrderItem.product_id == product_id,
                Order.status.in_([
                    OrderStatus.PENDING,
                    OrderStatus.IN_PRODUCTION,
                    OrderStatus.READY,
                ])
            )
        )
        pending_count = pending_orders.scalar() or 0
        if pending_count > 0:
            raise ValueError(
                f"No se puede eliminar: tiene {pending_count} encargo(s) pendiente(s)"
            )

        sale_items_count = await self.db.execute(
            select(func.count(SaleItem.id)).where(
                SaleItem.product_id == product_id
            )
        )
        has_sales = (sale_items_count.scalar() or 0) > 0

        sale_changes_count = await self.db.execute(
            select(func.count(SaleChange.id)).where(
                SaleChange.new_product_id == product_id
            )
        )
        has_sale_changes = (sale_changes_count.scalar() or 0) > 0

        order_changes_count = await self.db.execute(
            select(func.count(OrderChange.id)).where(
                OrderChange.new_product_id == product_id
            )
        )
        has_order_changes = (order_changes_count.scalar() or 0) > 0

        if has_sales or has_sale_changes or has_order_changes:
            product.is_active = False
            await self.db.flush()
            return {"mode": "deactivated", "message": "Producto global desactivado (tiene historial de ventas/cambios)"}

        await self.db.execute(
            sa_delete(Inventory).where(Inventory.product_id == product_id)
        )
        await self.db.execute(
            sa_delete(Product).where(Product.id == product_id)
        )
        await self.db.flush()
        return {"mode": "deleted", "message": "Producto global eliminado permanentemente"}

    async def search_global_products(self, query: str, skip: int = 0, limit: int = 20) -> list[Product]:
        search_query = f"%{query}%"
        result = await self.db.execute(
            select(Product)
            .where(
                Product.school_id.is_(None),
                Product.is_active == True,
                (
                    Product.code.ilike(search_query) |
                    Product.name.ilike(search_query) |
                    Product.size.ilike(search_query) |
                    Product.color.ilike(search_query)
                )
            )
            .order_by(Product.code)
            .offset(skip)
            .limit(limit)
        )
        return list(result.scalars().all())

    async def count_global_products_search(self, query: str) -> int:
        search_query = f"%{query}%"
        result = await self.db.execute(
            select(func.count(Product.id)).where(
                Product.school_id.is_(None),
                Product.is_active == True,
                (
                    Product.code.ilike(search_query) |
                    Product.name.ilike(search_query) |
                    Product.size.ilike(search_query) |
                    Product.color.ilike(search_query)
                )
            )
        )
        return result.scalar_one()

    async def update_product(
        self,
        product_id: UUID,
        school_id: UUID,
        product_data: ProductUpdate
    ) -> Product | None:
        update_dict = product_data.model_dump(exclude_unset=True)
        return await self.update(product_id, school_id, update_dict)

    async def delete_product(
        self,
        product_id: UUID,
        school_id: UUID
    ) -> dict[str, str]:
        product = await self.get(product_id, school_id)
        if not product:
            raise ValueError("Producto no encontrado")

        pending_orders = await self.db.execute(
            select(func.count(OrderItem.id)).join(
                Order, OrderItem.order_id == Order.id
            ).where(
                OrderItem.product_id == product_id,
                Order.status.in_([
                    OrderStatus.PENDING,
                    OrderStatus.IN_PRODUCTION,
                    OrderStatus.READY,
                ])
            )
        )
        pending_count = pending_orders.scalar() or 0
        if pending_count > 0:
            raise ValueError(
                f"No se puede eliminar: tiene {pending_count} encargo(s) pendiente(s)"
            )

        sale_items_count = await self.db.execute(
            select(func.count(SaleItem.id)).where(
                SaleItem.product_id == product_id
            )
        )
        has_sales = (sale_items_count.scalar() or 0) > 0

        sale_changes_count = await self.db.execute(
            select(func.count(SaleChange.id)).where(
                SaleChange.new_product_id == product_id
            )
        )
        has_sale_changes = (sale_changes_count.scalar() or 0) > 0

        order_changes_count = await self.db.execute(
            select(func.count(OrderChange.id)).where(
                OrderChange.new_product_id == product_id
            )
        )
        has_order_changes = (order_changes_count.scalar() or 0) > 0

        if has_sales or has_sale_changes or has_order_changes:
            await self.soft_delete(product_id, school_id)
            return {"mode": "deactivated", "message": "Producto desactivado (tiene historial de ventas/cambios)"}

        await self.delete(product_id, school_id)
        return {"mode": "deleted", "message": "Producto eliminado permanentemente"}

    async def get_active_products(
        self,
        school_id: UUID,
        skip: int = 0,
        limit: int = 100
    ) -> list[Product]:
        return await self.get_multi(
            school_id=school_id,
            skip=skip,
            limit=limit,
            filters={"is_active": True}
        )

    async def get_by_garment_type(
        self,
        school_id: UUID,
        garment_type_id: UUID
    ) -> list[Product]:
        result = await self.db.execute(
            select(Product).where(
                Product.school_id == school_id,
                Product.garment_type_id == garment_type_id,
                Product.is_active == True
            ).order_by(Product.size, Product.color)
        )
        return list(result.scalars().all())

    async def get_products_with_inventory(
        self,
        school_id: UUID,
        skip: int = 0,
        limit: int = 100
    ) -> list[ProductWithInventory]:
        result = await self.db.execute(
            select(Product)
            .options(joinedload(Product.inventory))
            .where(
                Product.school_id == school_id,
                Product.is_active == True
            )
            .offset(skip)
            .limit(limit)
            .order_by(Product.code)
        )

        products = result.unique().scalars().all()

        products_with_inv = []
        for product in products:
            inv = product.inventory

            product_dict = {
                'id': product.id,
                'school_id': product.school_id,
                'code': product.code,
                'garment_type_id': product.garment_type_id,
                'name': product.name,
                'size': product.size,
                'color': product.color,
                'gender': product.gender,
                'price': product.price,
                'cost': product.cost,
                'description': product.description,
                'image_url': product.image_url,
                'is_active': product.is_active,
                'is_global': product.school_id is None,
                'created_at': product.created_at,
                'updated_at': product.updated_at,
                'inventory_quantity': inv.quantity if inv else 0,
                'inventory_min_stock': inv.min_stock_alert if inv else 5
            }

            products_with_inv.append(ProductWithInventory(**product_dict))

        return products_with_inv

    async def search_products(
        self,
        school_id: UUID,
        search_term: str,
        limit: int = 20
    ) -> list[Product]:
        result = await self.db.execute(
            select(Product).where(
                Product.school_id == school_id,
                Product.is_active == True,
                (
                    Product.code.ilike(f"%{search_term}%") |
                    Product.name.ilike(f"%{search_term}%") |
                    Product.size.ilike(f"%{search_term}%") |
                    Product.color.ilike(f"%{search_term}%")
                )
            ).limit(limit)
        )
        return list(result.scalars().all())

    async def _generate_product_code(self, school_id: UUID) -> str:
        count = await self.count(school_id)

        sequence = count + 1
        code = f"PRD-{sequence:04d}"

        existing = await self.get_by_code(code, school_id)
        if existing:
            result = await self.db.execute(
                select(func.max(Product.code)).where(
                    Product.school_id == school_id,
                    Product.code.like("PRD-%")
                )
            )
            max_code = result.scalar_one_or_none()

            if max_code:
                try:
                    last_num = int(max_code.split('-')[1])
                    code = f"PRD-{last_num + 1:04d}"
                except (IndexError, ValueError):
                    code = f"PRD-{sequence:04d}"

        return code

    async def _generate_global_product_code(self, garment_type_name: str) -> str:
        prefix = garment_type_name[:3].upper()
        result = await self.db.execute(
            select(func.count(Product.id)).where(
                Product.school_id.is_(None),
                Product.code.like(f"GLB-{prefix}-%")
            )
        )
        count = result.scalar() or 0
        return f"GLB-{prefix}-{count + 1:03d}"

    async def get_by_size_and_color(
        self,
        school_id: UUID,
        garment_type_id: UUID,
        size: str,
        color: str | None = None
    ) -> Product | None:
        query = select(Product).where(
            Product.school_id == school_id,
            Product.garment_type_id == garment_type_id,
            Product.size == size,
            Product.is_active == True
        )

        if color:
            query = query.where(Product.color == color)

        result = await self.db.execute(query)
        return result.scalar_one_or_none()
