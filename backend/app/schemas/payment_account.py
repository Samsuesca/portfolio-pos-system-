"""
Payment Account Schemas

Pydantic schemas for PaymentAccount model validation and serialization.
"""
from pydantic import BaseModel, Field, ConfigDict
from uuid import UUID
from datetime import datetime
from typing import Optional


class PaymentAccountBase(BaseModel):
    """Base schema for PaymentAccount"""
    method_type: str = Field(..., max_length=50)
    account_name: str = Field(..., min_length=2, max_length=200)
    account_number: str = Field(..., min_length=1, max_length=100)
    account_holder: str = Field(..., min_length=2, max_length=200)
    bank_name: Optional[str] = Field(None, max_length=100)
    account_type: Optional[str] = Field(None, max_length=50)
    qr_code_url: Optional[str] = Field(None, max_length=500)
    instructions: Optional[str] = None
    display_order: int = Field(default=0, ge=0)
    is_active: bool = True


class PaymentAccountCreate(PaymentAccountBase):
    """Schema for creating a new payment account"""
    pass


class PaymentAccountUpdate(BaseModel):
    """Schema for updating payment account (all fields optional)"""
    method_type: Optional[str] = Field(None, max_length=50)
    account_name: Optional[str] = Field(None, min_length=2, max_length=200)
    account_number: Optional[str] = Field(None, min_length=1, max_length=100)
    account_holder: Optional[str] = Field(None, min_length=2, max_length=200)
    bank_name: Optional[str] = Field(None, max_length=100)
    account_type: Optional[str] = Field(None, max_length=50)
    qr_code_url: Optional[str] = Field(None, max_length=500)
    instructions: Optional[str] = None
    display_order: Optional[int] = Field(None, ge=0)
    is_active: Optional[bool] = None


class PaymentAccountResponse(PaymentAccountBase):
    """Schema for payment account response"""
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    created_at: datetime
    updated_at: datetime


class PaymentAccountPublic(BaseModel):
    """Public schema for payment account (for web portal)"""
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    method_type: str
    account_name: str
    account_number: str
    account_holder: str
    bank_name: Optional[str]
    account_type: Optional[str]
    qr_code_url: Optional[str]
    instructions: Optional[str]
    display_order: int
