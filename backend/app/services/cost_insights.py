"""
Cost Insights Service — queries agregadas para el dashboard de costos.

Cada método ejecuta una sola query SQL agregada (sin N+1). Filtra por
`user_school_ids` para respetar multi-tenancy excepto para superuser
(que se identifica con user_school_ids=None desde el route handler).
"""
from decimal import Decimal
from uuid import UUID

from sqlalchemy import select, func, case, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.product import (
    Product, GarmentType, CostComponentTemplate, ProductCostComponent,
)
from app.models.school import School
from app.schemas.cost_insights import (
    CostInsightsSummary,
    SchoolCostBreakdown,
    TopMarginProduct,
    ComponentDistribution,
)


class CostInsightsService:
    """Servicio para agregaciones del módulo de costos."""

    def __init__(self, db: AsyncSession):
        self.db = db

    def _scope_filter(self, user_school_ids: list[UUID] | None):
        """Filtro multi-tenant. None = superuser (todo). Incluye globals."""
        if user_school_ids is None:
            return None  # sin filtro
        # user puede ver: sus colegios + globales (school_id IS NULL)
        return Product.school_id.in_(user_school_ids) | Product.school_id.is_(None)

    async def get_summary(self, user_school_ids: list[UUID] | None) -> CostInsightsSummary:
        scope = self._scope_filter(user_school_ids)
        q = (
            select(
                func.count(Product.id).label("total"),
                func.count(Product.id).filter(GarmentType.cost_type == 'manufactured').label("mfg"),
                func.count(Product.id).filter(GarmentType.cost_type == 'purchased').label("purchased"),
                func.count(Product.id).filter(Product.cost > 0).label("with_cost"),
                func.count(Product.id).filter(
                    (Product.cost.is_(None)) | (Product.cost == 0)
                ).label("without_cost"),
                func.avg(Product.cost).filter(Product.cost > 0).label("avg_cost"),
                func.avg(Product.price).filter(Product.cost > 0).label("avg_price"),
                func.avg(
                    (Product.price - Product.cost) / func.nullif(Product.price, 0) * 100
                ).filter(Product.cost > 0).label("avg_margin"),
                func.count(Product.id).filter(
                    and_(Product.cost > 0, Product.cost > Product.price)
                ).label("underwater"),
            )
            .join(GarmentType, Product.garment_type_id == GarmentType.id)
            .where(Product.is_active == True)
        )
        if scope is not None:
            q = q.where(scope)

        row = (await self.db.execute(q)).one()
        total = row.total or 0
        with_cost = row.with_cost or 0
        coverage = (Decimal(with_cost) / Decimal(total) * 100) if total else Decimal("0")
        return CostInsightsSummary(
            total_active_products=total,
            manufactured_total=row.mfg or 0,
            purchased_total=row.purchased or 0,
            products_with_cost=with_cost,
            products_without_cost=row.without_cost or 0,
            coverage_percent=coverage.quantize(Decimal("0.01")),
            avg_cost=Decimal(row.avg_cost).quantize(Decimal("0.01")) if row.avg_cost else None,
            avg_price=Decimal(row.avg_price).quantize(Decimal("0.01")) if row.avg_price else None,
            avg_margin_percent=Decimal(row.avg_margin).quantize(Decimal("0.01")) if row.avg_margin else None,
            underwater_count=row.underwater or 0,
        )

    async def get_by_school(self, user_school_ids: list[UUID] | None) -> list[SchoolCostBreakdown]:
        scope = self._scope_filter(user_school_ids)
        q = (
            select(
                School.id.label("school_id"),
                School.code.label("school_code"),
                School.name.label("school_name"),
                func.count(Product.id).label("total"),
                func.count(Product.id).filter(Product.cost > 0).label("with_cost"),
                func.avg(Product.cost).filter(Product.cost > 0).label("avg_cost"),
                func.avg(
                    (Product.price - Product.cost) / func.nullif(Product.price, 0) * 100
                ).filter(Product.cost > 0).label("avg_margin"),
                func.count(Product.id).filter(
                    and_(Product.cost > 0, Product.cost > Product.price)
                ).label("underwater"),
            )
            .select_from(Product)
            .outerjoin(School, Product.school_id == School.id)
            .where(Product.is_active == True)
            .group_by(School.id, School.code, School.name)
        )
        if scope is not None:
            q = q.where(scope)
        q = q.order_by(School.name.nulls_first())

        rows = (await self.db.execute(q)).all()
        out: list[SchoolCostBreakdown] = []
        for r in rows:
            total = r.total or 0
            with_cost = r.with_cost or 0
            coverage = (Decimal(with_cost) / Decimal(total) * 100) if total else Decimal("0")
            out.append(SchoolCostBreakdown(
                school_id=r.school_id,
                school_code=r.school_code or "GLOBAL",
                school_name=r.school_name or "Productos Globales",
                products_total=total,
                products_with_cost=with_cost,
                coverage_percent=coverage.quantize(Decimal("0.01")),
                avg_cost=Decimal(r.avg_cost).quantize(Decimal("0.01")) if r.avg_cost else None,
                avg_margin_percent=Decimal(r.avg_margin).quantize(Decimal("0.01")) if r.avg_margin else None,
                underwater_count=r.underwater or 0,
            ))
        return out

    async def get_top_margin(
        self,
        user_school_ids: list[UUID] | None,
        direction: str = "best",
        limit: int = 10,
    ) -> list[TopMarginProduct]:
        margin_pct = (Product.price - Product.cost) / func.nullif(Product.price, 0) * 100
        order_by = margin_pct.desc() if direction == "best" else margin_pct.asc()

        scope = self._scope_filter(user_school_ids)
        q = (
            select(
                Product.id.label("product_id"),
                Product.code,
                Product.name,
                Product.size,
                Product.school_id,
                School.name.label("school_name"),
                GarmentType.name.label("garment_type_name"),
                Product.price,
                Product.cost,
                (Product.price - Product.cost).label("margin"),
                margin_pct.label("margin_pct"),
            )
            .select_from(Product)
            .join(GarmentType, Product.garment_type_id == GarmentType.id)
            .outerjoin(School, Product.school_id == School.id)
            .where(Product.is_active == True, Product.cost > 0, Product.price > 0)
            .order_by(order_by)
            .limit(limit)
        )
        if scope is not None:
            q = q.where(scope)

        rows = (await self.db.execute(q)).all()
        return [
            TopMarginProduct(
                product_id=r.product_id,
                code=r.code,
                name=r.name,
                size=r.size,
                school_id=r.school_id,
                school_name=r.school_name or "Global",
                garment_type_name=r.garment_type_name,
                price=r.price,
                cost=r.cost,
                margin=r.margin,
                margin_percent=Decimal(r.margin_pct).quantize(Decimal("0.01")),
            )
            for r in rows
        ]

    async def get_component_distribution(
        self, user_school_ids: list[UUID] | None,
    ) -> list[ComponentDistribution]:
        """Suma agregada del costo por template (solo activos), agrupada por code+name."""
        scope = self._scope_filter(user_school_ids)
        q = (
            select(
                CostComponentTemplate.code.label("code"),
                CostComponentTemplate.name.label("name"),
                func.sum(ProductCostComponent.amount).label("total_amount"),
            )
            .select_from(ProductCostComponent)
            .join(CostComponentTemplate, ProductCostComponent.template_id == CostComponentTemplate.id)
            .join(Product, ProductCostComponent.product_id == Product.id)
            .where(
                CostComponentTemplate.is_active == True,
                Product.is_active == True,
            )
            .group_by(CostComponentTemplate.code, CostComponentTemplate.name)
            .order_by(func.sum(ProductCostComponent.amount).desc())
        )
        if scope is not None:
            q = q.where(scope)

        rows = (await self.db.execute(q)).all()
        total_all = sum((r.total_amount or Decimal("0")) for r in rows) or Decimal("1")
        return [
            ComponentDistribution(
                template_code=r.code,
                template_name=r.name,
                total_amount=Decimal(r.total_amount).quantize(Decimal("0.01")),
                percent_of_total=(Decimal(r.total_amount) / total_all * 100).quantize(Decimal("0.01")),
            )
            for r in rows
            if r.total_amount and r.total_amount > 0
        ]
