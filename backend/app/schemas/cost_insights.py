"""
Cost Insights Schemas — DTOs para el dashboard agregado de costos.
"""
from uuid import UUID
from decimal import Decimal

from app.schemas.base import BaseSchema


class CostInsightsSummary(BaseSchema):
    """KPIs globales del módulo de costos (multi-school)."""
    total_active_products: int
    manufactured_total: int
    purchased_total: int
    products_with_cost: int
    products_without_cost: int
    coverage_percent: Decimal
    avg_cost: Decimal | None = None
    avg_price: Decimal | None = None
    avg_margin_percent: Decimal | None = None
    underwater_count: int  # cost > price


class SchoolCostBreakdown(BaseSchema):
    """Resumen por colegio. school_id=None / school_code='GLOBAL' = productos globales."""
    school_id: UUID | None = None
    school_code: str
    school_name: str
    products_total: int
    products_with_cost: int
    coverage_percent: Decimal
    avg_cost: Decimal | None = None
    avg_margin_percent: Decimal | None = None
    underwater_count: int


class TopMarginProduct(BaseSchema):
    """Producto en ranking de mejor/peor margen."""
    product_id: UUID
    code: str
    name: str | None = None
    size: str
    school_id: UUID | None = None
    school_name: str | None = None  # "Global" cuando school_id IS NULL
    garment_type_name: str | None = None
    price: Decimal
    cost: Decimal
    margin: Decimal
    margin_percent: Decimal


class ComponentDistribution(BaseSchema):
    """Distribución del costo agregada por template (PieChart)."""
    template_code: str
    template_name: str
    total_amount: Decimal
    percent_of_total: Decimal


__all__ = [
    "CostInsightsSummary",
    "SchoolCostBreakdown",
    "TopMarginProduct",
    "ComponentDistribution",
]
