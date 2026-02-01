"""
Employee Service - Business logic for employee management
"""
from uuid import UUID
from decimal import Decimal
from datetime import date
from sqlalchemy import select, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.utils.timezone import get_colombia_date
from app.models.payroll import Employee, EmployeeBonus, BonusType
from app.schemas.payroll import (
    EmployeeCreate,
    EmployeeUpdate,
    EmployeeBonusCreate,
    EmployeeBonusUpdate,
)


class EmployeeService:
    """Service for employee operations"""

    # ============================================
    # Employee CRUD
    # ============================================

    async def get_employees(
        self,
        db: AsyncSession,
        *,
        skip: int = 0,
        limit: int = 100,
        is_active: bool | None = None,
    ) -> list[Employee]:
        """Get all employees with optional filters"""
        stmt = select(Employee).options(selectinload(Employee.bonuses))

        if is_active is not None:
            stmt = stmt.where(Employee.is_active == is_active)

        stmt = stmt.order_by(Employee.full_name).offset(skip).limit(limit)
        result = await db.execute(stmt)
        return list(result.scalars().all())

    async def get_employee(
        self,
        db: AsyncSession,
        employee_id: UUID,
    ) -> Employee | None:
        """Get a single employee by ID"""
        stmt = (
            select(Employee)
            .options(selectinload(Employee.bonuses))
            .where(Employee.id == employee_id)
        )
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_user_id(
        self,
        db: AsyncSession,
        user_id: UUID,
    ) -> Employee | None:
        """Get the employee record linked to a user"""
        stmt = (
            select(Employee)
            .options(selectinload(Employee.bonuses))
            .where(Employee.user_id == user_id, Employee.is_active == True)
        )
        result = await db.execute(stmt)
        return result.scalars().first()

    async def get_employee_by_document(
        self,
        db: AsyncSession,
        document_id: str,
    ) -> Employee | None:
        """Get employee by document ID"""
        stmt = select(Employee).where(Employee.document_id == document_id)
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    async def create_employee(
        self,
        db: AsyncSession,
        data: EmployeeCreate,
        *,
        created_by: UUID | None = None,
    ) -> Employee:
        """Create a new employee"""
        # Check for duplicate document_id
        existing = await self.get_employee_by_document(db, data.document_id)
        if existing:
            raise ValueError(f"Ya existe un empleado con el documento {data.document_id}")

        # Check for user_id uniqueness (a user can only be linked to one active employee)
        if data.user_id is not None:
            existing_with_user = await self.get_by_user_id(db, data.user_id)
            if existing_with_user:
                raise ValueError(f"Este usuario ya está vinculado a otro empleado ({existing_with_user.full_name})")

        employee = Employee(
            **data.model_dump(),
            created_by=created_by,
        )
        db.add(employee)
        await db.commit()
        await db.refresh(employee)
        return employee

    async def update_employee(
        self,
        db: AsyncSession,
        employee_id: UUID,
        data: EmployeeUpdate,
    ) -> Employee:
        """Update an employee"""
        employee = await self.get_employee(db, employee_id)
        if not employee:
            raise ValueError("Empleado no encontrado")

        update_data = data.model_dump(exclude_unset=True)

        # Check for document_id uniqueness if being updated
        if "document_id" in update_data and update_data["document_id"] != employee.document_id:
            existing = await self.get_employee_by_document(db, update_data["document_id"])
            if existing:
                raise ValueError(f"Ya existe un empleado con el documento {update_data['document_id']}")

        # Check for user_id uniqueness if being updated (a user can only be linked to one active employee)
        if "user_id" in update_data and update_data["user_id"] is not None:
            new_user_id = update_data["user_id"]
            if new_user_id != employee.user_id:
                existing_with_user = await self.get_by_user_id(db, new_user_id)
                if existing_with_user and existing_with_user.id != employee_id:
                    raise ValueError(f"Este usuario ya está vinculado a otro empleado ({existing_with_user.full_name})")

        for field, value in update_data.items():
            setattr(employee, field, value)

        await db.commit()
        await db.refresh(employee)
        return employee

    async def delete_employee(
        self,
        db: AsyncSession,
        employee_id: UUID,
    ) -> bool:
        """Soft delete an employee (set is_active to False)"""
        employee = await self.get_employee(db, employee_id)
        if not employee:
            return False

        employee.is_active = False
        employee.termination_date = get_colombia_date()
        await db.commit()
        return True

    # ============================================
    # Employee Bonus CRUD
    # ============================================

    async def get_employee_bonuses(
        self,
        db: AsyncSession,
        employee_id: UUID,
        *,
        is_active: bool | None = None,
    ) -> list[EmployeeBonus]:
        """Get all bonuses for an employee"""
        stmt = select(EmployeeBonus).where(EmployeeBonus.employee_id == employee_id)

        if is_active is not None:
            stmt = stmt.where(EmployeeBonus.is_active == is_active)

        stmt = stmt.order_by(EmployeeBonus.name)
        result = await db.execute(stmt)
        return list(result.scalars().all())

    async def get_bonus(
        self,
        db: AsyncSession,
        bonus_id: UUID,
    ) -> EmployeeBonus | None:
        """Get a single bonus by ID"""
        stmt = select(EmployeeBonus).where(EmployeeBonus.id == bonus_id)
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    async def create_bonus(
        self,
        db: AsyncSession,
        employee_id: UUID,
        data: EmployeeBonusCreate,
    ) -> EmployeeBonus:
        """Create a bonus for an employee"""
        # Verify employee exists
        employee = await self.get_employee(db, employee_id)
        if not employee:
            raise ValueError("Empleado no encontrado")

        bonus = EmployeeBonus(
            employee_id=employee_id,
            **data.model_dump(),
        )
        db.add(bonus)
        await db.commit()
        await db.refresh(bonus)
        return bonus

    async def update_bonus(
        self,
        db: AsyncSession,
        bonus_id: UUID,
        data: EmployeeBonusUpdate,
    ) -> EmployeeBonus:
        """Update a bonus"""
        bonus = await self.get_bonus(db, bonus_id)
        if not bonus:
            raise ValueError("Bono no encontrado")

        update_data = data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(bonus, field, value)

        await db.commit()
        await db.refresh(bonus)
        return bonus

    async def delete_bonus(
        self,
        db: AsyncSession,
        bonus_id: UUID,
    ) -> bool:
        """Soft delete a bonus"""
        bonus = await self.get_bonus(db, bonus_id)
        if not bonus:
            return False

        bonus.is_active = False
        await db.commit()
        return True

    # ============================================
    # Helper Methods
    # ============================================

    async def get_active_bonuses_for_date(
        self,
        db: AsyncSession,
        employee_id: UUID,
        target_date: date,
    ) -> list[EmployeeBonus]:
        """Get active bonuses for an employee on a specific date"""
        stmt = select(EmployeeBonus).where(
            and_(
                EmployeeBonus.employee_id == employee_id,
                EmployeeBonus.is_active == True,
                EmployeeBonus.start_date <= target_date,
                or_(
                    EmployeeBonus.end_date == None,
                    EmployeeBonus.end_date >= target_date,
                ),
            )
        )
        result = await db.execute(stmt)
        return list(result.scalars().all())

    async def calculate_employee_totals(
        self,
        db: AsyncSession,
        employee_id: UUID,
        target_date: date | None = None,
    ) -> dict:
        """Calculate total bonuses and deductions for an employee"""
        if target_date is None:
            target_date = get_colombia_date()

        employee = await self.get_employee(db, employee_id)
        if not employee:
            raise ValueError("Empleado no encontrado")

        # Get active bonuses
        bonuses = await self.get_active_bonuses_for_date(db, employee_id, target_date)

        total_bonuses = sum(b.amount for b in bonuses if b.is_recurring or b.bonus_type == BonusType.ONE_TIME)
        total_deductions = (
            employee.health_deduction +
            employee.pension_deduction +
            employee.other_deductions
        )

        bonus_breakdown = [
            {"name": b.name, "amount": float(b.amount)}
            for b in bonuses
            if b.is_recurring or b.bonus_type == BonusType.ONE_TIME
        ]

        deduction_breakdown = []
        if employee.health_deduction > 0:
            deduction_breakdown.append({"name": "Salud", "amount": float(employee.health_deduction)})
        if employee.pension_deduction > 0:
            deduction_breakdown.append({"name": "Pensión", "amount": float(employee.pension_deduction)})
        if employee.other_deductions > 0:
            deduction_breakdown.append({"name": "Otras deducciones", "amount": float(employee.other_deductions)})

        net_amount = employee.base_salary + total_bonuses - total_deductions

        return {
            "base_salary": employee.base_salary,
            "total_bonuses": total_bonuses,
            "total_deductions": total_deductions,
            "net_amount": net_amount,
            "bonus_breakdown": bonus_breakdown,
            "deduction_breakdown": deduction_breakdown,
        }


# Create singleton instance
employee_service = EmployeeService()
