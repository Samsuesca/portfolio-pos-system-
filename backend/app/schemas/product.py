"""
Product, GarmentType, and Inventory Schemas
"""
from uuid import UUID
from decimal import Decimal
from datetime import datetime
from pydantic import ConfigDict, Field, field_validator
from app.schemas.base import BaseSchema, IDModelSchema, TimestampSchema, SchoolIsolatedSchema


# ============================================
# GarmentType Schemas
# ============================================

class GarmentTypeBase(BaseSchema):
    """Base garment type schema"""
    name: str = Field(..., min_length=3, max_length=100, example="Falda Plisada")
    description: str | None = Field(None, example="Falda plisada con pretina ajustable")
    category: str | None = Field(None, max_length=50, example="faldas")
    requires_embroidery: bool = False
    has_custom_measurements: bool = False
    cost_type: str = Field(default="manufactured", example="manufactured")


class GarmentTypeCreate(GarmentTypeBase):
    """Schema for creating garment type
    Note: school_id is optional because it's taken from the URL path parameter
    """
    school_id: UUID | None = Field(None, example="550e8400-e29b-41d4-a716-446655440000")


class GarmentTypeUpdate(BaseSchema):
    """Schema for updating garment type"""
    name: str | None = Field(None, min_length=3, max_length=100, example="Falda Plisada Corta")
    description: str | None = Field(None, example="Falda plisada corta con pretina elástica")
    category: str | None = Field(None, max_length=50, example="faldas")
    requires_embroidery: bool | None = None
    has_custom_measurements: bool | None = None
    cost_type: str | None = Field(None, example="manufactured")
    is_active: bool | None = None


class GarmentTypeInDB(GarmentTypeBase, SchoolIsolatedSchema, IDModelSchema, TimestampSchema):
    """GarmentType as stored in database"""
    is_active: bool


class GarmentTypeResponse(GarmentTypeInDB):
    """GarmentType for API responses"""
    school_id: UUID | None = None
    is_global: bool = False

    model_config = ConfigDict(
        from_attributes=True,
        json_schema_extra={
            "example": {
                "id": "cc0e8400-e29b-41d4-a716-446655440030",
                "school_id": "770e8400-e29b-41d4-a716-446655440002",
                "name": "Falda Plisada",
                "description": "Falda plisada con pretina ajustable",
                "category": "faldas",
                "requires_embroidery": False,
                "has_custom_measurements": True,
                "cost_type": "manufactured",
                "is_active": True,
                "is_global": False,
                "created_at": "2026-04-12T10:30:00",
                "updated_at": "2026-04-12T10:30:00",
            }
        },
    )


# ============================================
# GarmentTypeImage Schemas
# ============================================

class GarmentTypeImageBase(BaseSchema):
    """Base garment type image schema"""
    display_order: int = Field(default=0, ge=0)
    is_primary: bool = False


class GarmentTypeImageCreate(GarmentTypeImageBase):
    """Schema for creating garment type image (used internally after upload)"""
    pass


class GarmentTypeImageResponse(GarmentTypeImageBase, IDModelSchema):
    """GarmentTypeImage for API responses"""
    image_url: str
    garment_type_id: UUID
    school_id: UUID | None = None
    created_at: datetime


class GarmentTypeImageReorder(BaseSchema):
    """Schema for reordering images"""
    image_ids: list[UUID]  # New order of image IDs


class CatalogReorder(BaseSchema):
    """Nuevo orden de los tipos de prenda en el catalogo de un colegio."""
    garment_type_ids: list[UUID]  # Orden deseado (indice 0 = primero)


class CatalogOrderEntry(BaseSchema):
    """Orden persistido de un tipo de prenda para un colegio."""
    garment_type_id: UUID
    display_order: int


class GarmentTypeWithImages(GarmentTypeResponse):
    """GarmentType with images for API responses"""
    images: list[GarmentTypeImageResponse] = []
    primary_image_url: str | None = None  # Convenience field

    # Aggregated catalog stats (populated only when the endpoint is called
    # with_stats=True; otherwise these stay at their zero/None defaults so the
    # schema is non-breaking for existing callers).
    product_count: int = 0
    total_stock: int = 0
    min_price: Decimal | None = None
    max_price: Decimal | None = None
    has_images: bool = False


# ============================================
# Product Schemas
# ============================================

class ProductBase(BaseSchema):
    """Base product schema"""
    name: str | None = Field(None, max_length=255, example="Falda Plisada Azul T12")
    size: str = Field(..., max_length=10, example="12")
    color: str | None = Field(None, max_length=50, example="Azul")
    gender: str | None = Field(None, max_length=10, example="female")
    price: Decimal = Field(..., ge=0, example=55000.00)
    cost: Decimal | None = Field(None, ge=0, example=28000.00)
    description: str | None = Field(None, example="Falda plisada azul oscuro talla 12")
    image_url: str | None = Field(None, max_length=500, example="https://yourdomain.com/img/falda-12.jpg")

    @field_validator('gender')
    @classmethod
    def validate_gender(cls, v: str | None) -> str | None:
        """Validate gender field"""
        if v and v not in ['unisex', 'male', 'female']:
            raise ValueError('Gender must be: unisex, male, or female')
        return v


class ProductCreate(ProductBase):
    """Schema for creating product
    Note: school_id is optional because it's taken from the URL path parameter
    """
    garment_type_id: UUID = Field(..., example="550e8400-e29b-41d4-a716-446655440000")
    school_id: UUID | None = Field(None, example="550e8400-e29b-41d4-a716-446655440001")
    # code will be auto-generated


class ProductUpdate(BaseSchema):
    """Schema for updating product"""
    name: str | None = Field(None, max_length=255, example="Falda Plisada Azul T14")
    size: str | None = Field(None, max_length=10, example="14")
    color: str | None = Field(None, max_length=50, example="Azul Oscuro")
    gender: str | None = Field(None, max_length=10, example="female")
    price: Decimal | None = Field(None, ge=0, example=58000.00)
    cost: Decimal | None = Field(None, ge=0, example=30000.00)
    description: str | None = Field(None, example="Falda plisada azul oscuro talla 14")
    image_url: str | None = Field(None, max_length=500, example="https://yourdomain.com/img/falda-14.jpg")
    is_active: bool | None = None


class ProductInDB(ProductBase, SchoolIsolatedSchema, IDModelSchema, TimestampSchema):
    """Product as stored in database"""
    code: str
    garment_type_id: UUID
    is_active: bool


class ProductResponse(ProductInDB):
    """Product for API responses"""
    school_id: UUID | None = None
    is_global: bool = False

    model_config = ConfigDict(
        from_attributes=True,
        json_schema_extra={
            "example": {
                "id": "dd0e8400-e29b-41d4-a716-446655440040",
                "code": "PRD-0123",
                "school_id": "770e8400-e29b-41d4-a716-446655440002",
                "garment_type_id": "cc0e8400-e29b-41d4-a716-446655440030",
                "name": "Falda Plisada Azul T12",
                "size": "12",
                "color": "azul",
                "gender": "female",
                "price": 55000.00,
                "cost": 28000.00,
                "description": None,
                "image_url": None,
                "is_active": True,
                "is_global": False,
                "created_at": "2026-04-12T10:30:00",
                "updated_at": "2026-04-12T10:30:00",
            }
        },
    )


class ProductWithInventory(ProductResponse):
    """Product with inventory information"""
    inventory_quantity: int = 0
    inventory_reserved: int = 0
    inventory_available: int = 0
    inventory_min_stock: int = 5
    # Garment-type metadata para que el web-portal pueda agrupar/renderizar globales
    # sin un round-trip extra. Pobladas por service.get_global_products_with_inventory().
    garment_type_name: str | None = None
    garment_type_images: list["GarmentTypeImageResponse"] = []
    garment_type_primary_image_url: str | None = None


class ProductListResponse(BaseSchema):
    """Simplified product response for multi-school listings"""
    id: UUID
    code: str
    name: str | None
    size: str
    color: str | None
    gender: str | None
    price: Decimal
    cost: Decimal | None = None  # Solo poblado si el usuario tiene inventory.view_cost
    cost_type: str | None = None  # 'manufactured' | 'purchased' — para distinguir UI de costos
    description: str | None = None  # Nota visible en la web (ej. "a preferencia del padre")
    is_active: bool
    garment_type_id: UUID
    garment_type_name: str | None = None
    school_id: UUID | None = None
    school_name: str | None = None
    is_global: bool = False
    stock: int | None = None  # Only populated when with_stock=True (quantity total)
    reserved: int | None = None  # Stock reservado a Orders pendientes/READY
    available: int | None = None  # stock - reserved (lo que se puede vender directo)
    min_stock: int | None = None  # Minimum stock alert level
    pending_orders_qty: int | None = None  # Quantity in pending orders
    pending_orders_count: int | None = None  # Number of pending orders
    # Garment type images for catalog display
    garment_type_images: list["GarmentTypeImageResponse"] = []
    garment_type_primary_image_url: str | None = None


# ============================================
# Inventory Schemas
# ============================================

class InventoryBase(BaseSchema):
    """Base inventory schema"""
    quantity: int = Field(..., ge=0)
    reserved_quantity: int = Field(default=0, ge=0)
    min_stock_alert: int = Field(default=5, ge=0)


class InventoryCreate(InventoryBase, SchoolIsolatedSchema):
    """Schema for creating inventory"""
    product_id: UUID


class InventoryUpdate(BaseSchema):
    """Schema for updating inventory metadata.

    Solo permite cambiar `min_stock_alert`. Para mover stock real (entradas,
    salidas, ajustes) usar `POST /inventory/product/{id}/adjust` que pasa
    por `adjust_quantity` (escribe inventory_logs y dispara alertas).
    """
    min_stock_alert: int | None = Field(None, ge=0, example=5)


class InventoryAdjust(BaseSchema):
    """Schema for adjusting inventory quantity"""
    adjustment: int = Field(..., example=10)
    reason: str | None = Field(None, max_length=255, example="Ingreso de mercancía del proveedor")


class InventoryInDB(InventoryBase, SchoolIsolatedSchema, IDModelSchema):
    """Inventory as stored in database"""
    # Global inventory rows (for products without a school owner) have
    # ``school_id=None``; override the multi-tenant base's required UUID so the
    # response serializer doesn't reject them with a ValidationError.
    school_id: UUID | None = None  # type: ignore[assignment]
    product_id: UUID
    last_updated: datetime


class InventoryResponse(InventoryInDB):
    """Inventory for API responses.

    Incluye `available` computado a partir de `quantity - reserved_quantity`
    para que el frontend tome decisiones de "puedo vender" sin recalcular.
    """
    available: int = Field(..., description="quantity - reserved_quantity (stock libre para venta)")

    model_config = ConfigDict(
        from_attributes=True,
        json_schema_extra={
            "example": {
                "id": "ff0e8400-e29b-41d4-a716-446655440060",
                "school_id": "770e8400-e29b-41d4-a716-446655440002",
                "product_id": "dd0e8400-e29b-41d4-a716-446655440040",
                "quantity": 25,
                "reserved_quantity": 3,
                "available": 22,
                "min_stock_alert": 5,
                "last_updated": "2026-04-12T10:30:00",
            }
        },
    )


class LowStockProduct(BaseSchema):
    """Product with low stock alert"""
    product_id: UUID
    product_code: str
    product_name: str | None
    size: str
    color: str | None
    current_quantity: int
    min_stock_alert: int
    difference: int  # How many units below minimum


class InventoryReport(BaseSchema):
    """Inventory summary report"""
    total_products: int
    total_stock_value: Decimal
    low_stock_count: int
    out_of_stock_count: int
    low_stock_products: list[LowStockProduct]


class ProductStatsResponse(BaseSchema):
    """Aggregated product/inventory KPIs across the catalog."""
    total_products: int
    total_stock: int
    out_of_stock_count: int
    low_stock_count: int
    with_orders_count: int
    total_pending_orders: int


class GlobalGtVisibility(BaseSchema):
    """Visibilidad de un garment_type global por colegio (modelo de exclusion).

    `hidden_school_ids` = colegios donde el global esta OCULTO del catalogo publico.
    Vacio = visible en todos (default).
    """
    hidden_school_ids: list[UUID] = Field(default_factory=list)
