"""
Product and GarmentType Service
"""
from uuid import UUID
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.product import GarmentType, Product, Inventory
from app.schemas.product import (
    GarmentTypeCreate,
    GarmentTypeUpdate,
    ProductCreate,
    ProductUpdate,
    ProductWithInventory,
)
from app.services.base import SchoolIsolatedService


class GarmentTypeService(SchoolIsolatedService[GarmentType]):
    """Service for GarmentType operations"""

    def __init__(self, db: AsyncSession):
        super().__init__(GarmentType, db)

    async def create_garment_type(
        self,
        garment_data: GarmentTypeCreate
    ) -> GarmentType:
        """
        Create a new garment type

        Args:
            garment_data: Garment type creation data

        Returns:
            Created garment type

        Raises:
            ValueError: If name already exists for this school
        """
        # Check if name exists in this school
        existing = await self.db.execute(
            select(GarmentType).where(
                GarmentType.school_id == garment_data.school_id,
                GarmentType.name == garment_data.name
            )
        )
        if existing.scalar_one_or_none():
            raise ValueError(f"Garment type '{garment_data.name}' already exists in this school")

        return await self.create(garment_data.model_dump())

    async def update_garment_type(
        self,
        garment_id: UUID,
        school_id: UUID,
        garment_data: GarmentTypeUpdate
    ) -> GarmentType | None:
        """
        Update garment type

        Args:
            garment_id: GarmentType UUID
            school_id: School UUID
            garment_data: Update data

        Returns:
            Updated garment type or None
        """
        update_dict = garment_data.model_dump(exclude_unset=True)
        return await self.update(garment_id, school_id, update_dict)

    async def get_active_garment_types(
        self,
        school_id: UUID,
        skip: int = 0,
        limit: int = 100
    ) -> list[GarmentType]:
        """
        Get active garment types for a school

        Args:
            school_id: School UUID
            skip: Pagination offset
            limit: Maximum results

        Returns:
            List of active garment types
        """
        return await self.get_multi(
            school_id=school_id,
            skip=skip,
            limit=limit,
            filters={"is_active": True}
        )

    async def get_by_category(
        self,
        school_id: UUID,
        category: str
    ) -> list[GarmentType]:
        """
        Get garment types by category

        Args:
            school_id: School UUID
            category: Category name

        Returns:
            List of garment types in category
        """
        result = await self.db.execute(
            select(GarmentType).where(
                GarmentType.school_id == school_id,
                GarmentType.category == category,
                GarmentType.is_active == True
            )
        )
        return list(result.scalars().all())


class ProductService(SchoolIsolatedService[Product]):
    """Service for Product operations"""

    def __init__(self, db: AsyncSession):
        super().__init__(Product, db)

    async def create_product(
        self,
        product_data: ProductCreate
    ) -> Product:
        """
        Create a new product with auto-generated code and inventory record

        Args:
            product_data: Product creation data

        Returns:
            Created product
        """
        # Generate product code
        code = await self._generate_product_code(product_data.school_id)

        product_dict = product_data.model_dump()
        product_dict['code'] = code

        product = await self.create(product_dict)

        # Create inventory record with initial quantity of 0
        inventory = Inventory(
            product_id=product.id,
            school_id=product_data.school_id,
            quantity=0,
            min_stock_alert=5
        )
        self.db.add(inventory)
        await self.db.flush()

        return product

    async def update_product(
        self,
        product_id: UUID,
        school_id: UUID,
        product_data: ProductUpdate
    ) -> Product | None:
        """
        Update product

        Args:
            product_id: Product UUID
            school_id: School UUID
            product_data: Update data

        Returns:
            Updated product or None
        """
        update_dict = product_data.model_dump(exclude_unset=True)
        return await self.update(product_id, school_id, update_dict)

    async def get_active_products(
        self,
        school_id: UUID,
        skip: int = 0,
        limit: int = 100
    ) -> list[Product]:
        """
        Get active products for a school

        Args:
            school_id: School UUID
            skip: Pagination offset
            limit: Maximum results

        Returns:
            List of active products
        """
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
        """
        Get products by garment type

        Args:
            school_id: School UUID
            garment_type_id: GarmentType UUID

        Returns:
            List of products
        """
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
        """
        Get products with inventory information

        Args:
            school_id: School UUID
            skip: Pagination offset
            limit: Maximum results

        Returns:
            List of products with inventory data
        """
        from app.models.product import Inventory
        from sqlalchemy.orm import joinedload

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

        # Convert to ProductWithInventory schema
        products_with_inv = []
        for product in products:
            inv = product.inventory  # inventory is a single object, not a list (uselist=False)

            # Create dict with product data
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
        """
        Search products by code, name, size, or color

        Args:
            school_id: School UUID
            search_term: Search term
            limit: Maximum results

        Returns:
            List of matching products
        """
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
        """
        Generate unique product code for school

        Format: PRD-{sequence:04d}
        Example: PRD-0001, PRD-0002, etc.

        Args:
            school_id: School UUID

        Returns:
            Generated product code
        """
        # Get count of products in school
        count = await self.count(school_id)

        # Generate code with padding
        sequence = count + 1
        code = f"PRD-{sequence:04d}"

        # Verify uniqueness (in case of deletions)
        existing = await self.get_by_code(code, school_id)
        if existing:
            # Find next available number
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

    async def get_by_size_and_color(
        self,
        school_id: UUID,
        garment_type_id: UUID,
        size: str,
        color: str | None = None
    ) -> Product | None:
        """
        Find product by garment type, size, and color

        Args:
            school_id: School UUID
            garment_type_id: GarmentType UUID
            size: Product size
            color: Product color (optional)

        Returns:
            Product or None
        """
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
