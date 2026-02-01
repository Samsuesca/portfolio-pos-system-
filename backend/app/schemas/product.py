"""
Product, GarmentType, and Inventory Schemas
"""
from uuid import UUID
from decimal import Decimal
from datetime import datetime
from pydantic import Field, field_validator
from app.schemas.base import BaseSchema, IDModelSchema, TimestampSchema, SchoolIsolatedSchema


# ============================================
# GarmentType Schemas
# ============================================

class GarmentTypeBase(BaseSchema):
    """Base garment type schema"""
    name: str = Field(..., min_length=3, max_length=100)
    description: str | None = None
    category: str | None = Field(None, max_length=50)
    requires_embroidery: bool = False
    has_custom_measurements: bool = False


class GarmentTypeCreate(GarmentTypeBase):
    """Schema for creating garment type
    Note: school_id is optional because it's taken from the URL path parameter
    """
    school_id: UUID | None = None


class GarmentTypeUpdate(BaseSchema):
    """Schema for updating garment type"""
    name: str | None = Field(None, min_length=3, max_length=100)
    description: str | None = None
    category: str | None = Field(None, max_length=50)
    requires_embroidery: bool | None = None
    has_custom_measurements: bool | None = None
    is_active: bool | None = None


class GarmentTypeInDB(GarmentTypeBase, SchoolIsolatedSchema, IDModelSchema, TimestampSchema):
    """GarmentType as stored in database"""
    is_active: bool


class GarmentTypeResponse(GarmentTypeInDB):
    """GarmentType for API responses"""
    pass


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
    school_id: UUID
    created_at: datetime


class GarmentTypeImageReorder(BaseSchema):
    """Schema for reordering images"""
    image_ids: list[UUID]  # New order of image IDs


class GarmentTypeWithImages(GarmentTypeResponse):
    """GarmentType with images for API responses"""
    images: list[GarmentTypeImageResponse] = []
    primary_image_url: str | None = None  # Convenience field


# ============================================
# Product Schemas
# ============================================

class ProductBase(BaseSchema):
    """Base product schema"""
    name: str | None = Field(None, max_length=255)
    size: str = Field(..., max_length=10)
    color: str | None = Field(None, max_length=50)
    gender: str | None = Field(None, max_length=10)
    price: Decimal = Field(..., ge=0)
    cost: Decimal | None = Field(None, ge=0)
    description: str | None = None
    image_url: str | None = Field(None, max_length=500)

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
    garment_type_id: UUID
    school_id: UUID | None = None  # Optional - set from path parameter
    # code will be auto-generated


class ProductUpdate(BaseSchema):
    """Schema for updating product"""
    name: str | None = Field(None, max_length=255)
    size: str | None = Field(None, max_length=10)
    color: str | None = Field(None, max_length=50)
    gender: str | None = Field(None, max_length=10)
    price: Decimal | None = Field(None, ge=0)
    cost: Decimal | None = Field(None, ge=0)
    description: str | None = None
    image_url: str | None = Field(None, max_length=500)
    is_active: bool | None = None


class ProductInDB(ProductBase, SchoolIsolatedSchema, IDModelSchema, TimestampSchema):
    """Product as stored in database"""
    code: str
    garment_type_id: UUID
    is_active: bool


class ProductResponse(ProductInDB):
    """Product for API responses"""
    pass


class ProductWithInventory(ProductResponse):
    """Product with inventory information"""
    inventory_quantity: int = 0
    inventory_min_stock: int = 5


class ProductListResponse(BaseSchema):
    """Simplified product response for multi-school listings"""
    id: UUID
    code: str
    name: str | None
    size: str
    color: str | None
    gender: str | None
    price: Decimal
    is_active: bool
    garment_type_id: UUID
    garment_type_name: str | None = None
    school_id: UUID
    school_name: str | None = None
    stock: int | None = None  # Only populated when with_stock=True
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
    min_stock_alert: int = Field(default=5, ge=0)


class InventoryCreate(InventoryBase, SchoolIsolatedSchema):
    """Schema for creating inventory"""
    product_id: UUID


class InventoryUpdate(BaseSchema):
    """Schema for updating inventory"""
    quantity: int | None = Field(None, ge=0)
    min_stock_alert: int | None = Field(None, ge=0)


class InventoryAdjust(BaseSchema):
    """Schema for adjusting inventory quantity"""
    adjustment: int  # Can be positive or negative
    reason: str | None = Field(None, max_length=255)


class InventoryInDB(InventoryBase, SchoolIsolatedSchema, IDModelSchema):
    """Inventory as stored in database"""
    product_id: UUID
    last_updated: datetime


class InventoryResponse(InventoryInDB):
    """Inventory for API responses"""
    pass


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


# ============================================
# Global GarmentType Schemas
# ============================================

class GlobalGarmentTypeBase(BaseSchema):
    """Base global garment type schema"""
    name: str = Field(..., min_length=2, max_length=100)
    description: str | None = None
    category: str | None = Field(None, max_length=50)


class GlobalGarmentTypeCreate(GlobalGarmentTypeBase):
    """Schema for creating global garment type"""
    pass


class GlobalGarmentTypeUpdate(BaseSchema):
    """Schema for updating global garment type"""
    name: str | None = Field(None, min_length=2, max_length=100)
    description: str | None = None
    category: str | None = Field(None, max_length=50)
    is_active: bool | None = None


class GlobalGarmentTypeResponse(GlobalGarmentTypeBase, IDModelSchema, TimestampSchema):
    """Global GarmentType for API responses"""
    is_active: bool


# ============================================
# Global GarmentType Image Schemas
# ============================================

class GlobalGarmentTypeImageBase(BaseSchema):
    """Base global garment type image schema"""
    display_order: int = Field(default=0, ge=0)
    is_primary: bool = False


class GlobalGarmentTypeImageCreate(GlobalGarmentTypeImageBase):
    """Schema for creating global garment type image (used internally after upload)"""
    pass


class GlobalGarmentTypeImageResponse(GlobalGarmentTypeImageBase, IDModelSchema):
    """GlobalGarmentTypeImage for API responses"""
    image_url: str
    garment_type_id: UUID
    created_at: datetime


class GlobalGarmentTypeImageReorder(BaseSchema):
    """Schema for reordering global garment type images"""
    image_ids: list[UUID]  # New order of image IDs


class GlobalGarmentTypeWithImages(GlobalGarmentTypeResponse):
    """Global GarmentType with images for API responses"""
    images: list[GlobalGarmentTypeImageResponse] = []
    primary_image_url: str | None = None  # Convenience field


# ============================================
# Global Product Schemas
# ============================================

class GlobalProductBase(BaseSchema):
    """Base global product schema"""
    name: str | None = Field(None, max_length=255)
    size: str = Field(..., max_length=20)
    color: str | None = Field(None, max_length=50)
    gender: str | None = Field(None, max_length=10)
    price: Decimal = Field(..., ge=0)
    cost: Decimal | None = Field(None, ge=0)
    description: str | None = None
    image_url: str | None = Field(None, max_length=500)

    @field_validator('gender')
    @classmethod
    def validate_gender(cls, v: str | None) -> str | None:
        """Validate gender field"""
        if v and v not in ['unisex', 'male', 'female']:
            raise ValueError('Gender must be: unisex, male, or female')
        return v


class GlobalProductCreate(GlobalProductBase):
    """Schema for creating global product"""
    garment_type_id: UUID


class GlobalProductUpdate(BaseSchema):
    """Schema for updating global product"""
    name: str | None = Field(None, max_length=255)
    size: str | None = Field(None, max_length=20)
    color: str | None = Field(None, max_length=50)
    gender: str | None = Field(None, max_length=10)
    price: Decimal | None = Field(None, ge=0)
    cost: Decimal | None = Field(None, ge=0)
    description: str | None = None
    image_url: str | None = Field(None, max_length=500)
    is_active: bool | None = None


class GlobalProductResponse(GlobalProductBase, IDModelSchema, TimestampSchema):
    """Global Product for API responses"""
    code: str
    garment_type_id: UUID
    is_active: bool


class GlobalProductWithInventory(GlobalProductResponse):
    """Global Product with inventory information"""
    inventory_quantity: int = 0
    inventory_min_stock: int = 5
    # Images from global garment type
    garment_type_images: list[GlobalGarmentTypeImageResponse] = []
    garment_type_primary_image_url: str | None = None


# ============================================
# Global Inventory Schemas
# ============================================

class GlobalInventoryBase(BaseSchema):
    """Base global inventory schema"""
    quantity: int = Field(..., ge=0)
    min_stock_alert: int = Field(default=5, ge=0)


class GlobalInventoryCreate(GlobalInventoryBase):
    """Schema for creating global inventory"""
    product_id: UUID


class GlobalInventoryUpdate(BaseSchema):
    """Schema for updating global inventory"""
    quantity: int | None = Field(None, ge=0)
    min_stock_alert: int | None = Field(None, ge=0)


class GlobalInventoryAdjust(BaseSchema):
    """Schema for adjusting global inventory quantity"""
    adjustment: int  # Can be positive or negative
    reason: str | None = Field(None, max_length=255)


class GlobalInventoryResponse(GlobalInventoryBase, IDModelSchema):
    """Global Inventory for API responses"""
    product_id: UUID
