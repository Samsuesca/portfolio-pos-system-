"""
Vendor Schemas - Normalized vendor/supplier catalog
"""
from uuid import UUID
from datetime import datetime
from pydantic import Field, field_validator
from app.schemas.base import BaseSchema, IDModelSchema
from app.models.vendor import VendorType


class VendorCreate(BaseSchema):
    name: str = Field(..., min_length=1, max_length=255, example="Hangar Textil")
    type: VendorType = VendorType.PERSON
    phone: str | None = Field(None, max_length=50, example="3001234567")
    email: str | None = Field(None, max_length=255, example="proveedor@email.com")
    notes: str | None = None

    @field_validator("name")
    @classmethod
    def strip_name(cls, v: str) -> str:
        return v.strip()


class VendorUpdate(BaseSchema):
    name: str | None = Field(None, min_length=1, max_length=255)
    type: VendorType | None = None
    phone: str | None = Field(None, max_length=50)
    email: str | None = Field(None, max_length=255)
    notes: str | None = None
    is_active: bool | None = None

    @field_validator("name")
    @classmethod
    def strip_name(cls, v: str | None) -> str | None:
        return v.strip() if v else v


class VendorResponse(IDModelSchema):
    name: str
    normalized_name: str
    type: VendorType
    phone: str | None
    email: str | None
    notes: str | None
    is_system: bool
    is_active: bool
    created_by: UUID | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class VendorListItem(BaseSchema):
    id: UUID
    name: str
    type: VendorType
    is_active: bool
    is_system: bool


class VendorSearchResult(BaseSchema):
    id: UUID
    name: str
    type: VendorType


class VendorMergeRequest(BaseSchema):
    source_ids: list[UUID] = Field(..., min_length=1)
    target_id: UUID
