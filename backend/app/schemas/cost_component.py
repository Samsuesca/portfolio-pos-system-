"""
Cost Component Schemas
"""
from decimal import Decimal
from uuid import UUID
from pydantic import Field

from app.schemas.base import BaseSchema, IDModelSchema


# ============================================
# Cost Component Templates (per GarmentType)
# ============================================

class CostComponentTemplateCreate(BaseSchema):
    name: str = Field(..., max_length=100)
    code: str = Field(..., max_length=50)
    is_variable: bool = False
    display_order: int = 0


class CostComponentTemplateUpdate(BaseSchema):
    name: str | None = Field(None, max_length=100)
    is_variable: bool | None = None
    display_order: int | None = None
    is_active: bool | None = None


class CostComponentTemplateResponse(IDModelSchema):
    garment_type_id: UUID | None = None
    name: str
    code: str
    is_variable: bool
    display_order: int
    is_active: bool


# ============================================
# Product Cost Components (per Product)
# ============================================

class ProductCostComponentUpsert(BaseSchema):
    template_id: UUID
    amount: Decimal = Field(..., ge=0)
    notes: str | None = None


class ProductCostComponentResponse(IDModelSchema):
    template_id: UUID
    template_name: str = ""
    template_code: str = ""
    is_variable: bool = False
    amount: Decimal
    notes: str | None = None


class ProductCostBreakdownResponse(BaseSchema):
    product_id: UUID
    product_code: str
    product_name: str | None
    size: str
    price: Decimal
    total_cost: Decimal
    margin_percent: Decimal
    components: list[ProductCostComponentResponse]
    has_estimates: bool


class CostBreakdownUpsert(BaseSchema):
    """Upsert all cost components for a single product"""
    components: list[ProductCostComponentUpsert]


# ============================================
# Bulk Operations
# ============================================

class SizeDelta(BaseSchema):
    sizes: list[str]
    delta: Decimal


class BulkApplyComponentRequest(BaseSchema):
    """Apply a single component value to all products of a garment type"""
    code: str = Field(..., max_length=50)
    amount: Decimal = Field(..., ge=0)
    notes: str | None = None
    size_deltas: list[SizeDelta] = []


class BulkApplyComponentResponse(BaseSchema):
    updated: int
    total_cost_recalculated: int


# ============================================
# Cost Coverage Metrics
# ============================================

class CostCoverageResponse(BaseSchema):
    total_products: int
    products_with_full_cost: int
    products_with_partial_cost: int
    products_without_cost: int
    coverage_percent: Decimal
