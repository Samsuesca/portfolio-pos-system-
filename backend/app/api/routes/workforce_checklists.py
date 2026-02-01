"""
Workforce Checklists Routes - Checklist templates and daily checklists
"""
from uuid import UUID
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, status, Query

from app.api.dependencies import DatabaseSession, CurrentUser, require_global_permission
from app.services.workforce.checklists import checklist_service
from app.schemas.workforce import (
    ChecklistTemplateCreate,
    ChecklistTemplateUpdate,
    ChecklistTemplateResponse,
    ChecklistTemplateItemCreate,
    ChecklistTemplateItemUpdate,
    ChecklistTemplateItemResponse,
    DailyChecklistResponse,
    ChecklistItemStatusUpdate,
    DailyChecklistItemResponse,
    ChecklistVerifyRequest,
)

router = APIRouter(prefix="/global/workforce", tags=["Workforce - Checklists"])


# ============================================
# Checklist Templates
# ============================================

@router.get(
    "/checklist-templates",
    response_model=list[ChecklistTemplateResponse],
    dependencies=[Depends(require_global_permission("workforce.view_checklists"))],
)
async def list_checklist_templates(
    db: DatabaseSession,
    current_user: CurrentUser,
    position: str | None = Query(None),
    assignment_type: str | None = Query(None, description="Filter by assignment_type: 'position' or 'employee'"),
    employee_id: UUID | None = Query(None, description="Filter by specific employee (for individual assignments)"),
    is_active: bool | None = Query(None),
):
    """List checklist templates"""
    templates = await checklist_service.get_templates(
        db, position=position, assignment_type=assignment_type,
        employee_id=employee_id, is_active=is_active
    )
    return [_template_to_response(t) for t in templates]


@router.post(
    "/checklist-templates",
    response_model=ChecklistTemplateResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_global_permission("workforce.manage_checklists"))],
)
async def create_checklist_template(
    data: ChecklistTemplateCreate,
    db: DatabaseSession,
    current_user: CurrentUser,
):
    """Create a checklist template with items"""
    return await checklist_service.create_template(
        db, data, created_by=current_user.id
    )


@router.get(
    "/checklist-templates/{template_id}",
    response_model=ChecklistTemplateResponse,
    dependencies=[Depends(require_global_permission("workforce.view_checklists"))],
)
async def get_checklist_template(
    template_id: UUID,
    db: DatabaseSession,
    current_user: CurrentUser,
):
    """Get a checklist template with its items"""
    template = await checklist_service.get_template(db, template_id)
    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Plantilla de checklist no encontrada",
        )
    return _template_to_response(template)


@router.patch(
    "/checklist-templates/{template_id}",
    response_model=ChecklistTemplateResponse,
    dependencies=[Depends(require_global_permission("workforce.manage_checklists"))],
)
async def update_checklist_template(
    template_id: UUID,
    data: ChecklistTemplateUpdate,
    db: DatabaseSession,
    current_user: CurrentUser,
):
    """Update a checklist template"""
    try:
        return await checklist_service.update_template(db, template_id, data)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


# ============================================
# Checklist Template Items
# ============================================

@router.post(
    "/checklist-templates/{template_id}/items",
    response_model=ChecklistTemplateItemResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_global_permission("workforce.manage_checklists"))],
)
async def add_template_item(
    template_id: UUID,
    data: ChecklistTemplateItemCreate,
    db: DatabaseSession,
    current_user: CurrentUser,
):
    """Add an item to a checklist template"""
    try:
        return await checklist_service.add_template_item(db, template_id, data)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.patch(
    "/checklist-templates/items/{item_id}",
    response_model=ChecklistTemplateItemResponse,
    dependencies=[Depends(require_global_permission("workforce.manage_checklists"))],
)
async def update_template_item(
    item_id: UUID,
    data: ChecklistTemplateItemUpdate,
    db: DatabaseSession,
    current_user: CurrentUser,
):
    """Update a checklist template item"""
    try:
        return await checklist_service.update_template_item(db, item_id, data)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete(
    "/checklist-templates/items/{item_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_global_permission("workforce.manage_checklists"))],
)
async def delete_template_item(
    item_id: UUID,
    db: DatabaseSession,
    current_user: CurrentUser,
):
    """Delete a checklist template item"""
    if not await checklist_service.delete_template_item(db, item_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Item de plantilla no encontrado",
        )


# ============================================
# Daily Checklists
# ============================================

@router.get(
    "/checklists",
    response_model=list[DailyChecklistResponse],
    dependencies=[Depends(require_global_permission("workforce.view_checklists"))],
)
async def list_daily_checklists(
    db: DatabaseSession,
    current_user: CurrentUser,
    checklist_date: date | None = Query(None),
    employee_id: UUID | None = Query(None),
):
    """List daily checklists"""
    checklists = await checklist_service.get_checklists(
        db, checklist_date=checklist_date, employee_id=employee_id
    )
    return [_checklist_to_response(c) for c in checklists]


@router.post(
    "/checklists/generate",
    response_model=list[DailyChecklistResponse],
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_global_permission("workforce.manage_checklists"))],
)
async def generate_daily_checklists(
    db: DatabaseSession,
    current_user: CurrentUser,
    target_date: date | None = Query(None),
):
    """Generate daily checklists for all employees from templates"""
    checklists = await checklist_service.generate_daily_checklists(db, target_date)
    return [_checklist_to_response(c) for c in checklists]


@router.get(
    "/checklists/{checklist_id}",
    response_model=DailyChecklistResponse,
    dependencies=[Depends(require_global_permission("workforce.view_checklists"))],
)
async def get_daily_checklist(
    checklist_id: UUID,
    db: DatabaseSession,
    current_user: CurrentUser,
):
    """Get a daily checklist with items"""
    checklist = await checklist_service.get_checklist(db, checklist_id)
    if not checklist:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Checklist no encontrado",
        )
    return _checklist_to_response(checklist)


@router.patch(
    "/checklists/items/{item_id}",
    response_model=DailyChecklistItemResponse,
    dependencies=[Depends(require_global_permission("workforce.manage_checklists"))],
)
async def update_checklist_item_status(
    item_id: UUID,
    data: ChecklistItemStatusUpdate,
    db: DatabaseSession,
    current_user: CurrentUser,
):
    """Update the status of a checklist item (mark completed/skipped)"""
    try:
        return await checklist_service.update_item_status(
            db, item_id, data, completed_by=current_user.id
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post(
    "/checklists/{checklist_id}/verify",
    response_model=DailyChecklistResponse,
    dependencies=[Depends(require_global_permission("workforce.manage_checklists"))],
)
async def verify_checklist(
    checklist_id: UUID,
    db: DatabaseSession,
    current_user: CurrentUser,
    data: ChecklistVerifyRequest | None = None,
):
    """Mark a daily checklist as verified by supervisor"""
    try:
        checklist = await checklist_service.verify_checklist(
            db,
            checklist_id,
            verified_by=current_user.id,
            notes=data.notes if data else None,
        )
        return _checklist_to_response(checklist)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


# ============================================
# Helpers
# ============================================

def _template_to_response(template: object) -> dict:
    """Convert checklist template ORM to response with employee name"""
    return {
        "id": template.id,
        "name": template.name,
        "assignment_type": template.assignment_type,
        "position": template.position,
        "employee_id": template.employee_id,
        "employee_name": template.assigned_employee.full_name if template.assigned_employee else None,
        "description": template.description,
        "is_active": template.is_active,
        "items": [
            {
                "id": item.id,
                "template_id": item.template_id,
                "description": item.description,
                "sort_order": item.sort_order,
                "is_required": item.is_required,
                "created_at": item.created_at,
            }
            for item in (template.items or [])
        ],
        "created_at": template.created_at,
    }


def _checklist_to_response(checklist: object) -> dict:
    """Convert daily checklist ORM to response with employee name"""
    return {
        "id": checklist.id,
        "employee_id": checklist.employee_id,
        "employee_name": checklist.employee.full_name if checklist.employee else None,
        "template_id": checklist.template_id,
        "checklist_date": checklist.checklist_date,
        "total_items": checklist.total_items,
        "completed_items": checklist.completed_items,
        "completion_rate": checklist.completion_rate,
        "verified_by": checklist.verified_by,
        "verified_at": checklist.verified_at,
        "notes": checklist.notes,
        "items": [
            {
                "id": item.id,
                "checklist_id": item.checklist_id,
                "description": item.description,
                "sort_order": item.sort_order,
                "is_required": item.is_required,
                "status": item.status,
                "completed_at": item.completed_at,
                "completed_by": item.completed_by,
                "notes": item.notes,
            }
            for item in (checklist.items or [])
        ],
        "created_at": checklist.created_at,
    }
