"""
Responsibility Service - Position and employee responsibilities management
"""
from uuid import UUID
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.workforce import PositionResponsibility
from app.models.payroll import Employee
from app.schemas.workforce import (
    PositionResponsibilityCreate,
    PositionResponsibilityUpdate,
)


class ResponsibilityService:
    """Service for position and employee responsibility operations"""

    async def get_all(
        self,
        db: AsyncSession,
        *,
        position: str | None = None,
        assignment_type: str | None = None,
        employee_id: UUID | None = None,
        is_active: bool | None = None,
    ) -> list[PositionResponsibility]:
        """Get responsibilities with optional filters"""
        stmt = select(PositionResponsibility).options(
            selectinload(PositionResponsibility.assigned_employee)
        )
        if position is not None:
            stmt = stmt.where(PositionResponsibility.position == position)
        if assignment_type is not None:
            stmt = stmt.where(PositionResponsibility.assignment_type == assignment_type)
        if employee_id is not None:
            stmt = stmt.where(PositionResponsibility.employee_id == employee_id)
        if is_active is not None:
            stmt = stmt.where(PositionResponsibility.is_active == is_active)
        stmt = stmt.order_by(
            PositionResponsibility.assignment_type,
            PositionResponsibility.position,
            PositionResponsibility.sort_order
        )
        result = await db.execute(stmt)
        return list(result.scalars().all())

    async def get_by_id(
        self,
        db: AsyncSession,
        responsibility_id: UUID,
    ) -> PositionResponsibility | None:
        result = await db.execute(
            select(PositionResponsibility)
            .options(selectinload(PositionResponsibility.assigned_employee))
            .where(PositionResponsibility.id == responsibility_id)
        )
        return result.scalars().first()

    async def get_employee_responsibilities(
        self,
        db: AsyncSession,
        employee_id: UUID,
    ) -> list[PositionResponsibility]:
        """
        Get all responsibilities for a specific employee.

        Returns both:
        1. Individual assignments (assignment_type='employee', employee_id matches)
        2. Position-based assignments (assignment_type='position', position matches employee's position)
        """
        # Get employee to find their position
        emp_result = await db.execute(
            select(Employee).where(Employee.id == employee_id)
        )
        employee = emp_result.scalar_one_or_none()
        if not employee:
            return []

        # Get responsibilities: individual OR matching position
        stmt = select(PositionResponsibility).options(
            selectinload(PositionResponsibility.assigned_employee)
        ).where(
            PositionResponsibility.is_active == True,
            or_(
                # Individual assignment for this employee
                (PositionResponsibility.assignment_type == "employee") &
                (PositionResponsibility.employee_id == employee_id),
                # Position-based assignment matching employee's position
                (PositionResponsibility.assignment_type == "position") &
                (PositionResponsibility.position == employee.position)
            )
        ).order_by(
            PositionResponsibility.assignment_type.desc(),  # 'position' before 'employee' alphabetically, but we want individual first
            PositionResponsibility.sort_order
        )
        result = await db.execute(stmt)
        responsibilities = list(result.scalars().all())

        # Sort: individual first, then by position
        return sorted(
            responsibilities,
            key=lambda r: (0 if r.assignment_type == "employee" else 1, r.sort_order)
        )

    async def create(
        self,
        db: AsyncSession,
        data: PositionResponsibilityCreate,
        created_by: UUID | None = None,
    ) -> PositionResponsibility:
        responsibility = PositionResponsibility(
            **data.model_dump(),
            created_by=created_by,
        )
        db.add(responsibility)
        await db.commit()
        await db.refresh(responsibility)
        return responsibility

    async def update(
        self,
        db: AsyncSession,
        responsibility_id: UUID,
        data: PositionResponsibilityUpdate,
    ) -> PositionResponsibility | None:
        responsibility = await self.get_by_id(db, responsibility_id)
        if not responsibility:
            return None
        update_data = data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(responsibility, field, value)
        await db.commit()
        await db.refresh(responsibility)
        return responsibility

    async def delete(
        self,
        db: AsyncSession,
        responsibility_id: UUID,
    ) -> bool:
        responsibility = await self.get_by_id(db, responsibility_id)
        if not responsibility:
            return False
        await db.delete(responsibility)
        await db.commit()
        return True


responsibility_service = ResponsibilityService()
