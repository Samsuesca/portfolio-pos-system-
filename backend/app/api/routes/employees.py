"""
Employee Routes - Employee management endpoints
"""
from uuid import UUID
from fastapi import APIRouter, HTTPException, status, Query

from app.api.dependencies import DatabaseSession, CurrentUser
from app.services.employee_service import employee_service
from app.schemas.payroll import (
    EmployeeCreate,
    EmployeeUpdate,
    EmployeeResponse,
    EmployeeListResponse,
    EmployeeBonusCreate,
    EmployeeBonusUpdate,
    EmployeeBonusResponse,
)

router = APIRouter(prefix="/global/employees", tags=["Employees"])


# ============================================
# Employee CRUD
# ============================================

@router.get("", response_model=list[EmployeeListResponse])
async def list_employees(
    db: DatabaseSession,
    current_user: CurrentUser,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    is_active: bool | None = Query(None),
):
    """List all employees"""
    employees = await employee_service.get_employees(
        db, skip=skip, limit=limit, is_active=is_active
    )
    return employees


@router.get("/me", response_model=EmployeeResponse)
async def get_my_employee(
    db: DatabaseSession,
    current_user: CurrentUser,
):
    """Get the employee record linked to the current authenticated user"""
    employee = await employee_service.get_by_user_id(db, current_user.id)
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No tienes un registro de empleado vinculado"
        )
    return employee


@router.get("/{employee_id}", response_model=EmployeeResponse)
async def get_employee(
    employee_id: UUID,
    db: DatabaseSession,
    current_user: CurrentUser,
):
    """Get a single employee by ID"""
    employee = await employee_service.get_employee(db, employee_id)
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Empleado no encontrado"
        )
    return employee


@router.post("", response_model=EmployeeResponse, status_code=status.HTTP_201_CREATED)
async def create_employee(
    data: EmployeeCreate,
    db: DatabaseSession,
    current_user: CurrentUser,
):
    """Create a new employee"""
    try:
        employee = await employee_service.create_employee(
            db, data, created_by=current_user.id
        )
        return employee
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.patch("/{employee_id}", response_model=EmployeeResponse)
async def update_employee(
    employee_id: UUID,
    data: EmployeeUpdate,
    db: DatabaseSession,
    current_user: CurrentUser,
):
    """Update an employee"""
    try:
        employee = await employee_service.update_employee(db, employee_id, data)
        return employee
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.delete("/{employee_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_employee(
    employee_id: UUID,
    db: DatabaseSession,
    current_user: CurrentUser,
):
    """Soft delete an employee (deactivate)"""
    success = await employee_service.delete_employee(db, employee_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Empleado no encontrado"
        )


# ============================================
# Employee Bonus CRUD
# ============================================

@router.get("/{employee_id}/bonuses", response_model=list[EmployeeBonusResponse])
async def list_employee_bonuses(
    employee_id: UUID,
    db: DatabaseSession,
    current_user: CurrentUser,
    is_active: bool | None = Query(None),
):
    """List all bonuses for an employee"""
    bonuses = await employee_service.get_employee_bonuses(
        db, employee_id, is_active=is_active
    )
    return bonuses


@router.post(
    "/{employee_id}/bonuses",
    response_model=EmployeeBonusResponse,
    status_code=status.HTTP_201_CREATED
)
async def create_employee_bonus(
    employee_id: UUID,
    data: EmployeeBonusCreate,
    db: DatabaseSession,
    current_user: CurrentUser,
):
    """Create a bonus for an employee"""
    try:
        bonus = await employee_service.create_bonus(db, employee_id, data)
        return bonus
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.patch("/bonuses/{bonus_id}", response_model=EmployeeBonusResponse)
async def update_bonus(
    bonus_id: UUID,
    data: EmployeeBonusUpdate,
    db: DatabaseSession,
    current_user: CurrentUser,
):
    """Update a bonus"""
    try:
        bonus = await employee_service.update_bonus(db, bonus_id, data)
        return bonus
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.delete("/bonuses/{bonus_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_bonus(
    bonus_id: UUID,
    db: DatabaseSession,
    current_user: CurrentUser,
):
    """Soft delete a bonus (deactivate)"""
    success = await employee_service.delete_bonus(db, bonus_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bono no encontrado"
        )


# ============================================
# Helper Endpoints
# ============================================

@router.get("/{employee_id}/totals")
async def get_employee_totals(
    employee_id: UUID,
    db: DatabaseSession,
    current_user: CurrentUser,
):
    """Get calculated totals for an employee (bonuses, deductions, net)"""
    try:
        totals = await employee_service.calculate_employee_totals(db, employee_id)
        return totals
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
