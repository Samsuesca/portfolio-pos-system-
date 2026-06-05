"""
Base Pydantic schemas with common functionality
"""
from math import ceil
from typing import TypeVar, Generic
from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, ConfigDict, computed_field


class TimestampSchema(BaseModel):
    """Schema with timestamp fields"""
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class BaseSchema(BaseModel):
    """Base schema with common configuration"""
    model_config = ConfigDict(
        from_attributes=True,  # Allow ORM mode (SQLAlchemy models)
        populate_by_name=True,
        use_enum_values=True,
        str_strip_whitespace=True,
    )


class IDModelSchema(BaseSchema):
    """Schema for models with UUID id"""
    id: UUID


class SchoolIsolatedSchema(BaseSchema):
    """Schema for models isolated by school_id (multi-tenant)"""
    school_id: UUID


class ErrorResponse(BaseSchema):
    detail: str


T = TypeVar("T")


class PaginatedResponse(BaseSchema, Generic[T]):
    items: list[T]
    total: int
    skip: int
    limit: int

    @computed_field
    @property
    def page(self) -> int:
        if self.limit <= 0:
            return 1
        return (self.skip // self.limit) + 1

    @computed_field
    @property
    def total_pages(self) -> int:
        if self.limit <= 0 or self.total <= 0:
            return 0
        return ceil(self.total / self.limit)

    @computed_field
    @property
    def has_more(self) -> bool:
        if self.limit <= 0:
            return False
        return (self.skip + self.limit) < self.total


def paginate(items: list, total: int, skip: int, limit: int) -> dict:
    return {"items": items, "total": total, "skip": skip, "limit": limit}
