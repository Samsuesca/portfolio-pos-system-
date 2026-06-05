"""
Cost Component Service

Manages cost breakdown templates (per GarmentType) and
cost component values (per Product). Keeps Product.cost
synchronized as the sum of its components.
"""
from uuid import UUID
from decimal import Decimal
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.product import (
    CostComponentTemplate, ProductCostComponent,
    Product, GarmentType
)
from app.models.cost_change_log import CostChangeType
from app.services.cost_change_log import CostChangeLogService
from app.utils.timezone import get_colombia_now_naive


class CostComponentService:

    def __init__(self, db: AsyncSession):
        self.db = db
        self.log_service = CostChangeLogService(db)

    # ============================================
    # Templates
    # ============================================

    async def get_templates(
        self,
        garment_type_id: UUID,
        include_inactive: bool = False,
    ) -> list[CostComponentTemplate]:
        stmt = select(CostComponentTemplate).where(
            CostComponentTemplate.garment_type_id == garment_type_id,
        )
        if not include_inactive:
            stmt = stmt.where(CostComponentTemplate.is_active == True)
        stmt = stmt.order_by(CostComponentTemplate.display_order)

        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def create_template(
        self, garment_type_id: UUID, name: str, code: str,
        is_variable: bool = False, display_order: int = 0,
    ) -> CostComponentTemplate:
        now = get_colombia_now_naive()
        template = CostComponentTemplate(
            garment_type_id=garment_type_id,
            name=name,
            code=code,
            is_variable=is_variable,
            display_order=display_order,
            created_at=now,
            updated_at=now,
        )
        self.db.add(template)
        await self.db.flush()
        await self.db.refresh(template)
        return template

    async def update_template(
        self, template_id: UUID, changed_by: UUID | None = None, **kwargs
    ) -> CostComponentTemplate | None:
        result = await self.db.execute(
            select(CostComponentTemplate).where(CostComponentTemplate.id == template_id)
        )
        template = result.scalar_one_or_none()
        if not template:
            return None

        # Detectar cambio de is_active para auditar (template_activated / deactivated).
        was_active = template.is_active
        new_active = kwargs.get('is_active')

        for key, value in kwargs.items():
            if value is not None and hasattr(template, key):
                setattr(template, key, value)

        await self.db.flush()

        # Si is_active cambió, emitir N logs (uno por producto+componente afectado)
        if new_active is not None and new_active != was_active:
            await self._log_template_active_toggle(
                template_id=template_id,
                new_active=new_active,
                changed_by=changed_by,
                reason=f"Template '{template.name}' "
                       f"{'reactivated' if new_active else 'deactivated'}",
            )

        await self.db.refresh(template)
        return template

    async def deactivate_template(
        self, template_id: UUID, changed_by: UUID | None = None,
    ) -> bool:
        result = await self.db.execute(
            select(CostComponentTemplate).where(CostComponentTemplate.id == template_id)
        )
        template = result.scalar_one_or_none()
        if not template:
            return False

        if template.is_active:
            template.is_active = False
            await self.db.flush()
            await self._log_template_active_toggle(
                template_id=template_id,
                new_active=False,
                changed_by=changed_by,
                reason=f"Template '{template.name}' deactivated",
            )
        return True

    async def _log_template_active_toggle(
        self,
        template_id: UUID,
        new_active: bool,
        changed_by: UUID | None,
        reason: str,
    ):
        """
        Emite N logs (uno por producto+componente afectado) cuando un template
        se desactiva o reactiva. Crítico para que el historial explique las
        caídas/subidas de Product.cost.
        """
        change_type = (
            CostChangeType.TEMPLATE_ACTIVATED if new_active
            else CostChangeType.TEMPLATE_DEACTIVATED
        )
        rows = await self.db.execute(
            select(ProductCostComponent, Product.school_id)
            .join(Product, ProductCostComponent.product_id == Product.id)
            .where(ProductCostComponent.template_id == template_id)
        )
        for pcc, school_id in rows.all():
            await self.log_service.log_change(
                product_id=pcc.product_id,
                template_id=template_id,
                product_cost_component_id=pcc.id,
                school_id=school_id,
                change_type=change_type,
                # Semántica: el componente "deja de contar / vuelve a contar".
                amount_before=pcc.amount if not new_active else None,
                amount_after=pcc.amount if new_active else None,
                reason=reason,
                changed_by=changed_by,
            )
            # Recalcular product.cost del producto afectado
            await self._recalculate_product_cost(pcc.product_id)

    # ============================================
    # Cost Breakdown (per Product)
    # ============================================

    async def get_breakdown(
        self, product_id: UUID
    ) -> dict:
        product_result = await self.db.execute(
            select(Product).where(Product.id == product_id)
        )
        product = product_result.scalar_one_or_none()
        if not product:
            raise ValueError(f"Producto {product_id} no encontrado")

        stmt = (
            select(ProductCostComponent)
            .options(selectinload(ProductCostComponent.template))
            .where(ProductCostComponent.product_id == product_id)
        )

        result = await self.db.execute(stmt)
        all_components = result.scalars().all()
        # Filtra components cuyo template fue desactivado: la data se preserva
        # en DB pero no se muestra ni suma en el costo derivado.
        components = [c for c in all_components if c.template and c.template.is_active]

        total_cost = sum(c.amount for c in components) if components else Decimal("0")
        has_estimates = any(c.template.is_variable for c in components if c.template)

        return {
            "product_id": str(product.id),
            "product_code": product.code,
            "product_name": product.name,
            "size": product.size,
            "price": float(product.price),
            "total_cost": float(total_cost),
            "margin_percent": float(
                (product.price - total_cost) / product.price * 100
            ) if product.price > 0 else 0,
            "components": [
                {
                    "id": str(c.id),
                    "template_id": str(c.template_id),
                    "template_name": c.template.name if c.template else "",
                    "template_code": c.template.code if c.template else "",
                    "is_variable": c.template.is_variable if c.template else False,
                    "amount": float(c.amount),
                    "notes": c.notes,
                }
                for c in components
            ],
            "has_estimates": has_estimates,
        }

    async def upsert_breakdown(
        self,
        product_id: UUID,
        components: list[dict],
        changed_by: UUID | None = None,
        reason: str | None = "manual edit",
    ) -> dict:
        now = get_colombia_now_naive()

        # Cargar producto (school_id para denormalizar en el log)
        product = (await self.db.execute(
            select(Product).where(Product.id == product_id)
        )).scalar_one_or_none()
        if not product:
            raise ValueError(f"Producto {product_id} no encontrado")

        for comp_data in components:
            template_id = comp_data["template_id"]
            amount = Decimal(str(comp_data["amount"]))
            notes = comp_data.get("notes")

            filter_cond = (
                ProductCostComponent.product_id == product_id,
                ProductCostComponent.template_id == template_id,
            )

            result = await self.db.execute(
                select(ProductCostComponent).where(*filter_cond)
            )
            existing = result.scalar_one_or_none()

            if existing:
                amount_changed = existing.amount != amount
                notes_changed = (existing.notes or None) != (notes or None)
                if amount_changed or notes_changed:
                    await self.log_service.log_change(
                        product_id=product_id,
                        template_id=template_id,
                        product_cost_component_id=existing.id,
                        school_id=product.school_id,
                        change_type=CostChangeType.UPDATED,
                        amount_before=existing.amount if amount_changed else None,
                        amount_after=amount if amount_changed else None,
                        notes_before=existing.notes if notes_changed else None,
                        notes_after=notes if notes_changed else None,
                        reason=reason,
                        changed_by=changed_by,
                    )
                existing.amount = amount
                existing.notes = notes
                existing.updated_at = now
            else:
                new_comp = ProductCostComponent(
                    product_id=product_id,
                    template_id=template_id,
                    amount=amount,
                    notes=notes,
                    created_at=now,
                    updated_at=now,
                )
                self.db.add(new_comp)
                await self.db.flush()  # para tener new_comp.id en el log
                await self.log_service.log_change(
                    product_id=product_id,
                    template_id=template_id,
                    product_cost_component_id=new_comp.id,
                    school_id=product.school_id,
                    change_type=CostChangeType.CREATED,
                    amount_before=None,
                    amount_after=amount,
                    notes_before=None,
                    notes_after=notes,
                    reason=reason,
                    changed_by=changed_by,
                )

        await self.db.flush()
        await self._recalculate_product_cost(product_id)

        return await self.get_breakdown(product_id)

    async def bulk_apply_component(
        self,
        garment_type_id: UUID,
        code: str,
        amount: Decimal,
        notes: str | None = None,
        size_deltas: list[dict] | None = None,
        changed_by: UUID | None = None,
    ) -> dict:
        template_result = await self.db.execute(
            select(CostComponentTemplate).where(
                CostComponentTemplate.garment_type_id == garment_type_id,
                CostComponentTemplate.code == code,
                CostComponentTemplate.is_active == True,
            )
        )

        template = template_result.scalar_one_or_none()
        if not template:
            raise ValueError(f"Componente de costo '{code}' no encontrado para este tipo de prenda")

        products_result = await self.db.execute(
            select(Product).where(
                Product.garment_type_id == garment_type_id,
                Product.is_active == True,
            )
        )

        products = products_result.scalars().all()

        delta_map = {}
        if size_deltas:
            for sd in size_deltas:
                for size in sd["sizes"]:
                    delta_map[size] = Decimal(str(sd["delta"]))

        now = get_colombia_now_naive()
        updated = 0
        reason = f"Bulk apply: {template.name}"

        for product in products:
            product_amount = amount + delta_map.get(product.size, Decimal("0"))

            filter_cond = (
                ProductCostComponent.product_id == product.id,
                ProductCostComponent.template_id == template.id,
            )

            result = await self.db.execute(
                select(ProductCostComponent).where(*filter_cond)
            )
            existing = result.scalar_one_or_none()

            if existing:
                amount_changed = existing.amount != product_amount
                notes_changed = (existing.notes or None) != (notes or None)
                if amount_changed or notes_changed:
                    await self.log_service.log_change(
                        product_id=product.id,
                        template_id=template.id,
                        product_cost_component_id=existing.id,
                        school_id=product.school_id,
                        change_type=CostChangeType.BULK_APPLY,
                        amount_before=existing.amount if amount_changed else None,
                        amount_after=product_amount if amount_changed else None,
                        notes_before=existing.notes if notes_changed else None,
                        notes_after=notes if notes_changed else None,
                        reason=reason,
                        changed_by=changed_by,
                    )
                existing.amount = product_amount
                existing.notes = notes
                existing.updated_at = now
            else:
                new_comp = ProductCostComponent(
                    product_id=product.id,
                    template_id=template.id,
                    amount=product_amount,
                    notes=notes,
                    created_at=now,
                    updated_at=now,
                )
                self.db.add(new_comp)
                await self.db.flush()
                await self.log_service.log_change(
                    product_id=product.id,
                    template_id=template.id,
                    product_cost_component_id=new_comp.id,
                    school_id=product.school_id,
                    change_type=CostChangeType.BULK_APPLY,
                    amount_before=None,
                    amount_after=product_amount,
                    notes_before=None,
                    notes_after=notes,
                    reason=reason,
                    changed_by=changed_by,
                )

            updated += 1

        await self.db.flush()

        recalculated = 0
        for product in products:
            await self._recalculate_product_cost(product.id)
            recalculated += 1

        return {"updated": updated, "total_cost_recalculated": recalculated}

    # ============================================
    # Internal
    # ============================================

    async def _recalculate_product_cost(
        self, product_id: UUID
    ):
        # Solo suma componentes cuyo template está activo. Los inactivos
        # preservan su data pero no afectan el costo derivado del producto.
        sum_result = await self.db.execute(
            select(func.sum(ProductCostComponent.amount))
            .join(CostComponentTemplate, ProductCostComponent.template_id == CostComponentTemplate.id)
            .where(
                ProductCostComponent.product_id == product_id,
                CostComponentTemplate.is_active == True,
            )
        )
        total = sum_result.scalar() or Decimal("0")

        product_result = await self.db.execute(
            select(Product).where(Product.id == product_id)
        )
        product = product_result.scalar_one_or_none()

        if product:
            product.cost = total
            await self.db.flush()
