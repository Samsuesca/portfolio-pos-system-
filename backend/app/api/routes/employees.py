"""
Employee Routes - Employee management endpoints
"""
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy import select, func

from app.api.dependencies import DatabaseSession, CurrentUser, require_global_permission
from app.api.error_responses import responses, AUTHENTICATED
from app.schemas.base import PaginatedResponse, paginate
from app.models.payroll import Employee, EmployeeBonus
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

@router.get("", response_model=PaginatedResponse[EmployeeListResponse], dependencies=[Depends(require_global_permission("employees.manage"))], responses=AUTHENTICATED, operation_id="listEmployees")
async def list_employees(
    db: DatabaseSession,
    current_user: CurrentUser,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    is_active: bool | None = Query(None),
):
    """
    List all employees.

    **Auth:** Bearer JWT (staff)
    **Permission:** `employees.manage` (global)
    """
    count_stmt = select(func.count(Employee.id))
    if is_active is not None:
        count_stmt = count_stmt.where(Employee.is_active == is_active)
    total = (await db.execute(count_stmt)).scalar_one()

    employees = await employee_service.get_employees(
        db, skip=skip, limit=limit, is_active=is_active
    )
    return paginate(employees, total, skip, limit)


@router.get("/me", response_model=EmployeeResponse, dependencies=[Depends(require_global_permission("employees.manage"))], responses=responses(404), operation_id="getMyEmployee")
async def get_my_employee(
    db: DatabaseSession,
    current_user: CurrentUser,
):
    """
    Get the employee record linked to the current authenticated user.

    **Auth:** Bearer JWT (staff)
    **Permission:** `employees.manage` (global)
    """
    employee = await employee_service.get_by_user_id(db, current_user.id)
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No tienes un registro de empleado vinculado"
        )
    return employee


@router.get("/{employee_id}", response_model=EmployeeResponse, dependencies=[Depends(require_global_permission("employees.manage"))], responses=responses(404), operation_id="getEmployee")
async def get_employee(
    employee_id: UUID,
    db: DatabaseSession,
    current_user: CurrentUser,
):
    """
    Get a single employee by ID.

    **Auth:** Bearer JWT (staff)
    **Permission:** `employees.manage` (global)
    """
    employee = await employee_service.get_employee(db, employee_id)
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Empleado no encontrado"
        )
    return employee


@router.post("", response_model=EmployeeResponse, status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_global_permission("employees.manage"))], responses=responses(400), operation_id="createEmployee")
async def create_employee(
    data: EmployeeCreate,
    db: DatabaseSession,
    current_user: CurrentUser,
):
    """
    Create a new employee.

    **Auth:** Bearer JWT (staff)
    **Permission:** `employees.manage` (global)
    """
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


@router.patch("/{employee_id}", response_model=EmployeeResponse, dependencies=[Depends(require_global_permission("employees.manage"))], responses=responses(400, 404), operation_id="updateEmployee")
async def update_employee(
    employee_id: UUID,
    data: EmployeeUpdate,
    db: DatabaseSession,
    current_user: CurrentUser,
):
    """
    Update an employee.

    **Auth:** Bearer JWT (staff)
    **Permission:** `employees.manage` (global)
    """
    try:
        employee = await employee_service.update_employee(db, employee_id, data)
        return employee
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.delete("/{employee_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(require_global_permission("employees.manage"))], responses=responses(404), operation_id="deleteEmployee")
async def delete_employee(
    employee_id: UUID,
    db: DatabaseSession,
    current_user: CurrentUser,
):
    """
    Soft delete an employee (deactivate).

    **Auth:** Bearer JWT (staff)
    **Permission:** `employees.manage` (global)
    """
    success = await employee_service.delete_employee(db, employee_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Empleado no encontrado"
        )


# ============================================
# Employee Bonus CRUD
# ============================================

@router.get("/{employee_id}/bonuses", response_model=PaginatedResponse[EmployeeBonusResponse], dependencies=[Depends(require_global_permission("employees.manage"))], responses=responses(404), operation_id="listEmployeeBonuses")
async def list_employee_bonuses(
    employee_id: UUID,
    db: DatabaseSession,
    current_user: CurrentUser,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    is_active: bool | None = Query(None),
):
    """
    List all bonuses for an employee.

    **Auth:** Bearer JWT (staff)
    **Permission:** `employees.manage` (global)
    """
    count_stmt = select(func.count(EmployeeBonus.id)).where(
        EmployeeBonus.employee_id == employee_id
    )
    if is_active is not None:
        count_stmt = count_stmt.where(EmployeeBonus.is_active == is_active)
    total = (await db.execute(count_stmt)).scalar_one()

    bonuses = await employee_service.get_employee_bonuses(
        db, employee_id, is_active=is_active
    )
    return paginate(bonuses[skip:skip + limit], total, skip, limit)


@router.post(
    "/{employee_id}/bonuses",
    response_model=EmployeeBonusResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_global_permission("employees.manage"))],
    responses=responses(400, 404),
    operation_id="createEmployeeBonus",
)
async def create_employee_bonus(
    employee_id: UUID,
    data: EmployeeBonusCreate,
    db: DatabaseSession,
    current_user: CurrentUser,
):
    """
    Create a bonus for an employee.

    **Auth:** Bearer JWT (staff)
    **Permission:** `employees.manage` (global)
    """
    try:
        bonus = await employee_service.create_bonus(db, employee_id, data)
        return bonus
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.patch("/bonuses/{bonus_id}", response_model=EmployeeBonusResponse, dependencies=[Depends(require_global_permission("employees.manage"))], responses=responses(400, 404), operation_id="updateEmployeeBonus")
async def update_bonus(
    bonus_id: UUID,
    data: EmployeeBonusUpdate,
    db: DatabaseSession,
    current_user: CurrentUser,
):
    """
    Update a bonus.

    **Auth:** Bearer JWT (staff)
    **Permission:** `employees.manage` (global)
    """
    try:
        bonus = await employee_service.update_bonus(db, bonus_id, data)
        return bonus
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.delete("/bonuses/{bonus_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(require_global_permission("employees.manage"))], responses=responses(404), operation_id="deleteEmployeeBonus")
async def delete_bonus(
    bonus_id: UUID,
    db: DatabaseSession,
    current_user: CurrentUser,
):
    """
    Soft delete a bonus (deactivate).

    **Auth:** Bearer JWT (staff)
    **Permission:** `employees.manage` (global)
    """
    success = await employee_service.delete_bonus(db, bonus_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bono no encontrado"
        )


# ============================================
# Helper Endpoints
# ============================================

@router.get("/{employee_id}/totals", dependencies=[Depends(require_global_permission("employees.manage"))], responses=responses(400, 404), operation_id="getEmployeeTotals")
async def get_employee_totals(
    employee_id: UUID,
    db: DatabaseSession,
    current_user: CurrentUser,
):
    """
    Get calculated totals for an employee (bonuses, deductions, net).

    **Auth:** Bearer JWT (staff)
    **Permission:** `employees.manage` (global)
    """
    try:
        totals = await employee_service.calculate_employee_totals(db, employee_id)
        return totals
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
