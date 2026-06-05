"""
Cost Change Log Schemas — para serializar entries del audit trail de costos.
"""
from uuid import UUID
from datetime import datetime
from decimal import Decimal

from app.schemas.base import BaseSchema, IDModelSchema, PaginatedResponse
from app.models.cost_change_log import CostChangeType


class CostChangeLogResponse(IDModelSchema):
    """Una entry del historial de cambios de costo, con campos denormalizados
    para evitar fetches extra en el frontend."""
    product_id: UUID
    template_id: UUID | None = None
    template_name: str | None = None
    template_code: str | None = None
    product_cost_component_id: UUID | None = None
    school_id: UUID | None = None
    change_type: CostChangeType
    amount_before: Decimal | None = None
    amount_after: Decimal | None = None
    notes_before: str | None = None
    notes_after: str | None = None
    reason: str | None = None
    changed_by: UUID | None = None
    changed_by_name: str | None = None
    created_at: datetime


__all__ = ["CostChangeLogResponse"]
