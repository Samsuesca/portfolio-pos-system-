"""
Branch & School Identity Pydantic schemas (v3.1 — Sucursales).
"""
from datetime import datetime
from uuid import UUID

from app.schemas.base import BaseSchema


# ---------------------------------------------------------------------------
# Branch
# ---------------------------------------------------------------------------


class BranchBase(BaseSchema):
    name: str
    code: str
    address: str | None = None
    city: str | None = None
    phone: str | None = None
    is_headquarters: bool = False
    is_active: bool = True


class BranchCreate(BranchBase):
    pass


class BranchUpdate(BaseSchema):
    name: str | None = None
    code: str | None = None
    address: str | None = None
    city: str | None = None
    phone: str | None = None
    is_headquarters: bool | None = None
    is_active: bool | None = None


class BranchResponse(BranchBase):
    id: UUID
    created_at: datetime
    updated_at: datetime


# ---------------------------------------------------------------------------
# School Identity
# ---------------------------------------------------------------------------


class SchoolIdentityBase(BaseSchema):
    name: str
    logo_url: str | None = None
    city: str | None = None
    notes: str | None = None
    is_active: bool = True


class SchoolIdentityCreate(SchoolIdentityBase):
    pass


class SchoolIdentityUpdate(BaseSchema):
    name: str | None = None
    logo_url: str | None = None
    city: str | None = None
    notes: str | None = None
    is_active: bool | None = None


class SchoolIdentityResponse(SchoolIdentityBase):
    id: UUID
    created_at: datetime
    updated_at: datetime
