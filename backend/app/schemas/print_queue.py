"""
Print Queue Schemas

Pydantic schemas for the print queue system.
"""
from uuid import UUID
from decimal import Decimal
from datetime import datetime
from pydantic import Field
from app.schemas.base import BaseSchema
from app.models.print_queue import PrintQueueStatus


class PrintQueueItemBase(BaseSchema):
    """Base fields for print queue items"""
    sale_code: str
    sale_total: Decimal
    client_name: str | None = None
    school_name: str | None = None
    print_receipt: bool = True
    open_drawer: bool = True


class PrintQueueItemCreate(PrintQueueItemBase):
    """Schema for creating a print queue item"""
    sale_id: UUID
    school_id: UUID
    source_device: str | None = None


class PrintQueueItemResponse(PrintQueueItemBase):
    """Print queue item for API responses"""
    id: UUID
    sale_id: UUID
    school_id: UUID
    status: PrintQueueStatus
    source_device: str | None
    created_at: datetime
    processed_at: datetime | None
    error_message: str | None
    retry_count: int

    model_config = {"from_attributes": True}


class PrintQueueItemUpdate(BaseSchema):
    """Schema for updating a print queue item status"""
    status: PrintQueueStatus
    error_message: str | None = None


class PrintQueueSSEEvent(BaseSchema):
    """Event sent via SSE to subscribed clients"""
    event_type: str  # "new_sale", "item_updated", "initial"
    data: dict


class PrintQueueStats(BaseSchema):
    """Statistics for the print queue"""
    pending_count: int = Field(description="Total items pending print")
    printed_today: int = Field(description="Items printed today")
    skipped_today: int = Field(description="Items skipped today")
    failed_today: int = Field(description="Items that failed today")
