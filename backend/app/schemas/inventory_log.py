"""
Inventory Log Schemas

Schemas for inventory movement logs - similar to BalanceEntry for accounting.
"""
from uuid import UUID
from datetime import datetime, date
from pydantic import Field
from app.schemas.base import BaseSchema, IDModelSchema
from app.models.inventory_log import InventoryMovementType


# ============================================
# Filter Schemas
# ============================================

class InventoryLogFilter(BaseSchema):
    """Filter schema for querying inventory logs"""
    start_date: date | None = None
    end_date: date | None = None
    movement_type: InventoryMovementType | None = None
    product_id: UUID | None = None
    sale_id: UUID | None = None
    order_id: UUID | None = None
    skip: int = Field(default=0, ge=0)
    limit: int = Field(default=100, ge=1, le=500)


# ============================================
# Response Schemas
# ============================================

class InventoryLogResponse(IDModelSchema):
    """Inventory log for API responses"""
    inventory_id: UUID | None = None
    global_inventory_id: UUID | None = None
    school_id: UUID | None = None
    movement_type: InventoryMovementType
    movement_date: date
    quantity_delta: int
    quantity_after: int
    description: str
    reference: str | None = None
    sale_id: UUID | None = None
    order_id: UUID | None = None
    sale_change_id: UUID | None = None
    created_by: UUID | None = None
    created_at: datetime


class InventoryLogWithProduct(InventoryLogResponse):
    """Inventory log with product details for richer responses"""
    product_code: str | None = None
    product_name: str | None = None
    product_size: str | None = None
    is_global_product: bool = False
    created_by_name: str | None = None


# ============================================
# Create Schema (for internal use)
# ============================================

class InventoryLogCreate(BaseSchema):
    """Schema for creating inventory log (internal use by services)"""
    inventory_id: UUID | None = None
    global_inventory_id: UUID | None = None
    school_id: UUID | None = None
    movement_type: InventoryMovementType
    movement_date: date
    quantity_delta: int
    quantity_after: int
    description: str = Field(..., max_length=500)
    reference: str | None = Field(None, max_length=100)
    sale_id: UUID | None = None
    order_id: UUID | None = None
    sale_change_id: UUID | None = None
    created_by: UUID | None = None


# ============================================
# List Response Schemas
# ============================================

class InventoryLogListResponse(BaseSchema):
    """Paginated list of inventory logs"""
    items: list[InventoryLogWithProduct]
    total: int
    skip: int
    limit: int
