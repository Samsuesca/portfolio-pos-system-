"""
Shift Service - Shift templates and employee schedule management
"""
from uuid import UUID
from datetime import date
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.workforce import ShiftTemplate, EmployeeSchedule
from app.models.payroll import Employee
from app.schemas.workforce import (
    ShiftTemplateCreate,
    ShiftTemplateUpdate,
    ScheduleCreate,
    ScheduleUpdate,
)


class ShiftService:
    """Service for shift template and schedule operations"""

    # ============================================
    # Shift Template CRUD
    # ============================================

    async def get_shift_templates(
        self,
        db: AsyncSession,
        *,
        is_active: bool | None = None,
    ) -> list[ShiftTemplate]:
        """Get all shift templates"""
        stmt = select(ShiftTemplate)
        if is_active is not None:
            stmt = stmt.where(ShiftTemplate.is_active == is_active)
        stmt = stmt.order_by(ShiftTemplate.name)
        result = await db.execute(stmt)
        return list(result.scalars().all())

    async def get_shift_template(
        self,
        db: AsyncSession,
        template_id: UUID,
    ) -> ShiftTemplate | None:
        """Get a single shift template"""
        stmt = select(ShiftTemplate).where(ShiftTemplate.id == template_id)
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    async def create_shift_template(
        self,
        db: AsyncSession,
        data: ShiftTemplateCreate,
        *,
        created_by: UUID | None = None,
    ) -> ShiftTemplate:
        """Create a new shift template"""
        template = ShiftTemplate(
            **data.model_dump(),
            created_by=created_by,
        )
        db.add(template)
        await db.commit()
        await db.refresh(template)
        return template

    async def update_shift_template(
        self,
        db: AsyncSession,
        template_id: UUID,
        data: ShiftTemplateUpdate,
    ) -> ShiftTemplate:
        """Update a shift template"""
        template = await self.get_shift_template(db, template_id)
        if not template:
            raise ValueError("Plantilla de turno no encontrada")

        update_data = data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(template, field, value)

        await db.commit()
        await db.refresh(template)
        return template

    async def delete_shift_template(
        self,
        db: AsyncSession,
        template_id: UUID,
    ) -> bool:
        """Soft delete a shift template"""
        template = await self.get_shift_template(db, template_id)
        if not template:
            return False
        template.is_active = False
        await db.commit()
        return True

    # ============================================
    # Schedule CRUD
    # ============================================

    async def get_schedules(
        self,
        db: AsyncSession,
        *,
        date_from: date | None = None,
        date_to: date | None = None,
        employee_id: UUID | None = None,
    ) -> list[EmployeeSchedule]:
        """Get schedules with optional filters"""
        stmt = (
            select(EmployeeSchedule)
            .options(
                selectinload(EmployeeSchedule.employee),
                selectinload(EmployeeSchedule.shift_template),
            )
        )

        if date_from is not None:
            stmt = stmt.where(EmployeeSchedule.schedule_date >= date_from)
        if date_to is not None:
            stmt = stmt.where(EmployeeSchedule.schedule_date <= date_to)
        if employee_id is not None:
            stmt = stmt.where(EmployeeSchedule.employee_id == employee_id)

        stmt = stmt.order_by(EmployeeSchedule.schedule_date, EmployeeSchedule.start_time)
        result = await db.execute(stmt)
        return list(result.scalars().all())

    async def get_employee_schedule(
        self,
        db: AsyncSession,
        employee_id: UUID,
        *,
        date_from: date,
        date_to: date,
    ) -> list[EmployeeSchedule]:
        """Get schedule for a specific employee in a date range"""
        return await self.get_schedules(
            db, date_from=date_from, date_to=date_to, employee_id=employee_id
        )

    async def get_schedule(
        self,
        db: AsyncSession,
        schedule_id: UUID,
    ) -> EmployeeSchedule | None:
        """Get a single schedule entry"""
        stmt = (
            select(EmployeeSchedule)
            .options(
                selectinload(EmployeeSchedule.employee),
                selectinload(EmployeeSchedule.shift_template),
            )
            .where(EmployeeSchedule.id == schedule_id)
        )
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    async def check_schedule_conflict(
        self,
        db: AsyncSession,
        employee_id: UUID,
        schedule_date: date,
        *,
        exclude_id: UUID | None = None,
    ) -> bool:
        """Check if an employee already has a schedule for a given date"""
        stmt = select(EmployeeSchedule).where(
            and_(
                EmployeeSchedule.employee_id == employee_id,
                EmployeeSchedule.schedule_date == schedule_date,
            )
        )
        if exclude_id is not None:
            stmt = stmt.where(EmployeeSchedule.id != exclude_id)
        result = await db.execute(stmt)
        return result.scalar_one_or_none() is not None

    async def create_schedule(
        self,
        db: AsyncSession,
        data: ScheduleCreate,
        *,
        created_by: UUID | None = None,
    ) -> EmployeeSchedule:
        """Create a single schedule entry"""
        # Check for conflict
        if await self.check_schedule_conflict(db, data.employee_id, data.schedule_date):
            raise ValueError(
                f"El empleado ya tiene un horario asignado para {data.schedule_date}"
            )

        schedule = EmployeeSchedule(
            **data.model_dump(),
            created_by=created_by,
        )
        db.add(schedule)
        await db.commit()
        await db.refresh(schedule)
        # Re-fetch with relationships loaded
        return await self.get_schedule(db, schedule.id)

    async def create_bulk_schedules(
        self,
        db: AsyncSession,
        schedules_data: list[ScheduleCreate],
        *,
        created_by: UUID | None = None,
    ) -> list[EmployeeSchedule]:
        """Create multiple schedule entries"""
        created = []
        for data in schedules_data:
            if await self.check_schedule_conflict(db, data.employee_id, data.schedule_date):
                continue  # Skip conflicts in bulk mode
            schedule = EmployeeSchedule(
                **data.model_dump(),
                created_by=created_by,
            )
            db.add(schedule)
            created.append(schedule)

        await db.commit()
        # Re-fetch all with relationships loaded
        result = []
        for s in created:
            await db.refresh(s)
            loaded = await self.get_schedule(db, s.id)
            if loaded:
                result.append(loaded)
        return result

    async def update_schedule(
        self,
        db: AsyncSession,
        schedule_id: UUID,
        data: ScheduleUpdate,
    ) -> EmployeeSchedule:
        """Update a schedule entry"""
        schedule = await self.get_schedule(db, schedule_id)
        if not schedule:
            raise ValueError("Horario no encontrado")

        update_data = data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(schedule, field, value)

        await db.commit()
        await db.refresh(schedule)
        return schedule

    async def delete_schedule(
        self,
        db: AsyncSession,
        schedule_id: UUID,
    ) -> bool:
        """Delete a schedule entry"""
        schedule = await self.get_schedule(db, schedule_id)
        if not schedule:
            return False
        await db.delete(schedule)
        await db.commit()
        return True

    async def get_schedule_for_employee_date(
        self,
        db: AsyncSession,
        employee_id: UUID,
        target_date: date,
    ) -> EmployeeSchedule | None:
        """Get the schedule for a specific employee on a specific date"""
        stmt = select(EmployeeSchedule).where(
            and_(
                EmployeeSchedule.employee_id == employee_id,
                EmployeeSchedule.schedule_date == target_date,
            )
        )
        result = await db.execute(stmt)
        return result.scalar_one_or_none()


# Singleton
shift_service = ShiftService()
