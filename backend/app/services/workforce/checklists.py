"""
Checklist Service - Checklist templates and daily checklist management
"""
from uuid import UUID
from decimal import Decimal
from datetime import date
from sqlalchemy import select, and_, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.utils.timezone import get_colombia_date, get_colombia_now_naive
from app.models.workforce import (
    ChecklistTemplate, ChecklistTemplateItem,
    DailyChecklist, DailyChecklistItem,
    ChecklistItemStatus,
)
from app.models.payroll import Employee
from app.schemas.workforce import (
    ChecklistTemplateCreate, ChecklistTemplateUpdate,
    ChecklistTemplateItemCreate, ChecklistTemplateItemUpdate,
    ChecklistItemStatusUpdate,
)


class ChecklistService:
    """Service for checklist template and daily checklist operations"""

    # ============================================
    # Checklist Template CRUD
    # ============================================

    async def get_templates(
        self,
        db: AsyncSession,
        *,
        position: str | None = None,
        assignment_type: str | None = None,
        employee_id: UUID | None = None,
        is_active: bool | None = None,
    ) -> list[ChecklistTemplate]:
        """Get checklist templates with optional filters"""
        stmt = select(ChecklistTemplate).options(
            selectinload(ChecklistTemplate.items),
            selectinload(ChecklistTemplate.assigned_employee)
        )
        if position is not None:
            stmt = stmt.where(ChecklistTemplate.position == position)
        if assignment_type is not None:
            stmt = stmt.where(ChecklistTemplate.assignment_type == assignment_type)
        if employee_id is not None:
            stmt = stmt.where(ChecklistTemplate.employee_id == employee_id)
        if is_active is not None:
            stmt = stmt.where(ChecklistTemplate.is_active == is_active)
        stmt = stmt.order_by(ChecklistTemplate.assignment_type, ChecklistTemplate.position, ChecklistTemplate.name)
        result = await db.execute(stmt)
        return list(result.scalars().all())

    async def get_template(
        self,
        db: AsyncSession,
        template_id: UUID,
    ) -> ChecklistTemplate | None:
        """Get a single checklist template with items"""
        stmt = (
            select(ChecklistTemplate)
            .options(
                selectinload(ChecklistTemplate.items),
                selectinload(ChecklistTemplate.assigned_employee)
            )
            .where(ChecklistTemplate.id == template_id)
        )
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    async def create_template(
        self,
        db: AsyncSession,
        data: ChecklistTemplateCreate,
        *,
        created_by: UUID | None = None,
    ) -> ChecklistTemplate:
        """Create a checklist template with items"""
        items_data = data.items
        template_data = data.model_dump(exclude={"items"})

        template = ChecklistTemplate(
            **template_data,
            created_by=created_by,
        )
        db.add(template)
        await db.flush()

        for item_data in items_data:
            item = ChecklistTemplateItem(
                template_id=template.id,
                **item_data.model_dump(),
            )
            db.add(item)

        await db.commit()
        await db.refresh(template)
        return template

    async def update_template(
        self,
        db: AsyncSession,
        template_id: UUID,
        data: ChecklistTemplateUpdate,
    ) -> ChecklistTemplate:
        """Update a checklist template"""
        template = await self.get_template(db, template_id)
        if not template:
            raise ValueError("Plantilla de checklist no encontrada")

        update_data = data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(template, field, value)

        await db.commit()
        await db.refresh(template)
        return template

    # ============================================
    # Template Item CRUD
    # ============================================

    async def add_template_item(
        self,
        db: AsyncSession,
        template_id: UUID,
        data: ChecklistTemplateItemCreate,
    ) -> ChecklistTemplateItem:
        """Add an item to a checklist template"""
        template = await self.get_template(db, template_id)
        if not template:
            raise ValueError("Plantilla de checklist no encontrada")

        item = ChecklistTemplateItem(
            template_id=template_id,
            **data.model_dump(),
        )
        db.add(item)
        await db.commit()
        await db.refresh(item)
        return item

    async def update_template_item(
        self,
        db: AsyncSession,
        item_id: UUID,
        data: ChecklistTemplateItemUpdate,
    ) -> ChecklistTemplateItem:
        """Update a template item"""
        stmt = select(ChecklistTemplateItem).where(ChecklistTemplateItem.id == item_id)
        result = await db.execute(stmt)
        item = result.scalar_one_or_none()
        if not item:
            raise ValueError("Item de plantilla no encontrado")

        update_data = data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(item, field, value)

        await db.commit()
        await db.refresh(item)
        return item

    async def delete_template_item(
        self,
        db: AsyncSession,
        item_id: UUID,
    ) -> bool:
        """Delete a template item"""
        stmt = select(ChecklistTemplateItem).where(ChecklistTemplateItem.id == item_id)
        result = await db.execute(stmt)
        item = result.scalar_one_or_none()
        if not item:
            return False
        await db.delete(item)
        await db.commit()
        return True

    # ============================================
    # Daily Checklist Operations
    # ============================================

    async def get_checklists(
        self,
        db: AsyncSession,
        *,
        checklist_date: date | None = None,
        employee_id: UUID | None = None,
    ) -> list[DailyChecklist]:
        """Get daily checklists"""
        stmt = select(DailyChecklist).options(
            selectinload(DailyChecklist.employee),
            selectinload(DailyChecklist.items),
        )
        if checklist_date is not None:
            stmt = stmt.where(DailyChecklist.checklist_date == checklist_date)
        if employee_id is not None:
            stmt = stmt.where(DailyChecklist.employee_id == employee_id)

        stmt = stmt.order_by(DailyChecklist.checklist_date.desc())
        result = await db.execute(stmt)
        return list(result.scalars().all())

    async def get_checklist(
        self,
        db: AsyncSession,
        checklist_id: UUID,
    ) -> DailyChecklist | None:
        """Get a single daily checklist with items"""
        stmt = (
            select(DailyChecklist)
            .options(
                selectinload(DailyChecklist.employee),
                selectinload(DailyChecklist.items),
            )
            .where(DailyChecklist.id == checklist_id)
        )
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    async def generate_daily_checklists(
        self,
        db: AsyncSession,
        target_date: date | None = None,
    ) -> list[DailyChecklist]:
        """
        Generate daily checklists for all active employees.

        Priority logic:
        1. Individual assignment (assignment_type='employee') takes priority
        2. Falls back to position-based assignment (assignment_type='position')
        """
        if target_date is None:
            target_date = get_colombia_date()

        # Get all active employees
        emp_stmt = select(Employee).where(Employee.is_active == True)
        emp_result = await db.execute(emp_stmt)
        employees = list(emp_result.scalars().all())

        # Get all active templates
        templates = await self.get_templates(db, is_active=True)

        # Separate templates by assignment type
        # Individual templates (by employee_id)
        templates_by_employee: dict[UUID, ChecklistTemplate] = {}
        # Position-based templates (by position name)
        templates_by_position: dict[str, ChecklistTemplate] = {}

        for t in templates:
            if t.assignment_type == "employee" and t.employee_id:
                templates_by_employee[t.employee_id] = t
            elif t.assignment_type == "position" and t.position:
                templates_by_position[t.position.lower()] = t

        created = []
        for employee in employees:
            # Check if checklist already exists for this employee/date
            existing_stmt = select(DailyChecklist).where(
                and_(
                    DailyChecklist.employee_id == employee.id,
                    DailyChecklist.checklist_date == target_date,
                )
            )
            existing_result = await db.execute(existing_stmt)
            if existing_result.scalar_one_or_none():
                continue  # Already has checklist

            # Priority: Individual assignment > Position-based assignment
            template = templates_by_employee.get(employee.id)
            if not template and employee.position:
                template = templates_by_position.get(employee.position.lower())

            if not template:
                continue  # No template for this employee

            # Create daily checklist
            checklist = DailyChecklist(
                employee_id=employee.id,
                template_id=template.id,
                checklist_date=target_date,
                total_items=len(template.items),
                completed_items=0,
                completion_rate=Decimal("0"),
            )
            db.add(checklist)
            await db.flush()

            # Copy template items
            for template_item in template.items:
                daily_item = DailyChecklistItem(
                    checklist_id=checklist.id,
                    description=template_item.description,
                    sort_order=template_item.sort_order,
                    is_required=template_item.is_required,
                    status=ChecklistItemStatus.PENDING.value,
                )
                db.add(daily_item)

            created.append(checklist)

        await db.commit()
        for c in created:
            await db.refresh(c)
        return created

    async def update_item_status(
        self,
        db: AsyncSession,
        item_id: UUID,
        data: ChecklistItemStatusUpdate,
        *,
        completed_by: UUID | None = None,
    ) -> DailyChecklistItem:
        """Update the status of a daily checklist item"""
        stmt = select(DailyChecklistItem).where(DailyChecklistItem.id == item_id)
        result = await db.execute(stmt)
        item = result.scalar_one_or_none()
        if not item:
            raise ValueError("Item de checklist no encontrado")

        item.status = data.status.value if hasattr(data.status, 'value') else data.status
        item.notes = data.notes

        if item.status == ChecklistItemStatus.COMPLETED.value:
            item.completed_at = get_colombia_now_naive()
            item.completed_by = completed_by
        elif item.status == ChecklistItemStatus.PENDING.value:
            item.completed_at = None
            item.completed_by = None

        await db.flush()

        # Recalculate completion rate on parent checklist
        await self._recalculate_completion(db, item.checklist_id)

        await db.commit()
        await db.refresh(item)
        return item

    async def verify_checklist(
        self,
        db: AsyncSession,
        checklist_id: UUID,
        *,
        verified_by: UUID,
        notes: str | None = None,
    ) -> DailyChecklist:
        """Mark a daily checklist as verified by supervisor"""
        checklist = await self.get_checklist(db, checklist_id)
        if not checklist:
            raise ValueError("Checklist no encontrado")

        checklist.verified_by = verified_by
        checklist.verified_at = get_colombia_now_naive()
        if notes:
            checklist.notes = notes

        await db.commit()
        await db.refresh(checklist)
        return checklist

    # ============================================
    # Metrics
    # ============================================

    async def get_completion_rate(
        self,
        db: AsyncSession,
        employee_id: UUID,
        period_start: date,
        period_end: date,
    ) -> Decimal:
        """Get average checklist completion rate for an employee in a period"""
        stmt = select(func.avg(DailyChecklist.completion_rate)).where(
            and_(
                DailyChecklist.employee_id == employee_id,
                DailyChecklist.checklist_date >= period_start,
                DailyChecklist.checklist_date <= period_end,
            )
        )
        result = await db.execute(stmt)
        avg_rate = result.scalar()
        return Decimal(str(round(float(avg_rate or 0), 2)))

    # ============================================
    # Helpers
    # ============================================

    async def _recalculate_completion(
        self,
        db: AsyncSession,
        checklist_id: UUID,
    ) -> None:
        """Recalculate completion stats for a daily checklist"""
        stmt = select(DailyChecklistItem).where(
            DailyChecklistItem.checklist_id == checklist_id
        )
        result = await db.execute(stmt)
        items = list(result.scalars().all())

        total = len(items)
        completed = sum(
            1 for i in items if i.status == ChecklistItemStatus.COMPLETED.value
        )

        checklist_stmt = select(DailyChecklist).where(DailyChecklist.id == checklist_id)
        checklist_result = await db.execute(checklist_stmt)
        checklist = checklist_result.scalar_one_or_none()
        if checklist:
            checklist.total_items = total
            checklist.completed_items = completed
            checklist.completion_rate = (
                Decimal(str(round(completed / total * 100, 2))) if total > 0 else Decimal("0")
            )


# Singleton
checklist_service = ChecklistService()
