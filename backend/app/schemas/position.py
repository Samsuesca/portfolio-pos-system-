"""
Position Schemas
"""
from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, field_validator


class PositionBase(BaseModel):
    code: str
    name: str
    description: str | None = None

    @field_validator('code')
    @classmethod
    def normalize_code(cls, v: str) -> str:
        return v.strip().lower()


class PositionCreate(PositionBase):
    pass


class PositionUpdate(BaseModel):
    code: str | None = None
    name: str | None = None
    description: str | None = None
    is_active: bool | None = None
    sort_order: int | None = None

    @field_validator('code')
    @classmethod
    def normalize_code(cls, v: str | None) -> str | None:
        if v is not None:
            return v.strip().lower()
        return v


class PositionResponse(BaseModel):
    id: UUID
    code: str
    name: str
    description: str | None
    is_active: bool
    sort_order: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
