"""
Delivery Zone Schemas
"""
from uuid import UUID
from decimal import Decimal
from datetime import datetime
from pydantic import Field

from app.schemas.base import BaseSchema, IDModelSchema, TimestampSchema


class DeliveryZoneBase(BaseSchema):
    """Base delivery zone schema"""
    name: str = Field(..., max_length=100)
    description: str | None = None
    delivery_fee: Decimal = Field(default=Decimal("0"), ge=0)
    estimated_days: int = Field(default=1, ge=0)  # 0 = immediate/pickup


class DeliveryZoneCreate(DeliveryZoneBase):
    """Schema for creating delivery zone"""
    pass


class DeliveryZoneUpdate(BaseSchema):
    """Schema for updating delivery zone"""
    name: str | None = Field(None, max_length=100)
    description: str | None = None
    delivery_fee: Decimal | None = Field(None, ge=0)
    estimated_days: int | None = Field(None, ge=0)  # 0 = immediate/pickup
    is_active: bool | None = None


class DeliveryZoneInDB(DeliveryZoneBase, IDModelSchema, TimestampSchema):
    """Delivery zone as stored in database"""
    is_active: bool = True


class DeliveryZoneResponse(DeliveryZoneInDB):
    """Delivery zone for API responses"""
    pass


class DeliveryZonePublic(BaseSchema):
    """Public delivery zone response (for web portal - no auth required)"""
    id: UUID
    name: str
    description: str | None = None
    delivery_fee: Decimal
    estimated_days: int
