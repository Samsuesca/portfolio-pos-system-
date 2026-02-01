"""
Base Pydantic schemas with common functionality
"""
from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, ConfigDict


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
