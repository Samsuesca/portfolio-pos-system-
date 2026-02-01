"""
School Endpoints
"""
import os
import shutil
import uuid as uuid_lib
from pathlib import Path
from uuid import UUID
from fastapi import APIRouter, HTTPException, status, Query, UploadFile, File

from app.api.dependencies import DatabaseSession, CurrentSuperuser

# Constants for logo uploads
ALLOWED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
MAX_IMAGE_SIZE = 2 * 1024 * 1024  # 2MB

from app.core.config import settings
from app.schemas.school import (
    SchoolCreate,
    SchoolUpdate,
    SchoolResponse,
    SchoolListResponse,
    SchoolSummary,
    SchoolReorderRequest
)
from app.services.school import SchoolService


router = APIRouter(prefix="/schools", tags=["Schools"])


@router.post("", response_model=SchoolResponse, status_code=status.HTTP_201_CREATED)
async def create_school(
    school_data: SchoolCreate,
    db: DatabaseSession,
    _: CurrentSuperuser  # Only superusers can create schools
):
    """
    Create a new school (superuser only)
    """
    school_service = SchoolService(db)

    try:
        school = await school_service.create_school(school_data)
        await db.commit()
        return SchoolResponse.model_validate(school)

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get("", response_model=list[SchoolListResponse])
async def list_schools(
    db: DatabaseSession,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    active_only: bool = Query(True)
):
    """
    List all schools with pagination
    """
    school_service = SchoolService(db)

    if active_only:
        schools = await school_service.get_active_schools(skip=skip, limit=limit)
    else:
        schools = await school_service.get_multi(skip=skip, limit=limit)

    return [SchoolListResponse.model_validate(s) for s in schools]


@router.get("/{school_id}", response_model=SchoolResponse)
async def get_school(
    school_id: UUID,
    db: DatabaseSession
):
    """
    Get school by ID
    """
    school_service = SchoolService(db)
    school = await school_service.get(school_id)

    if not school:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="School not found"
        )

    return SchoolResponse.model_validate(school)


@router.get("/{school_id}/summary", response_model=SchoolSummary)
async def get_school_summary(
    school_id: UUID,
    db: DatabaseSession
):
    """
    Get school with statistics
    """
    school_service = SchoolService(db)
    summary = await school_service.get_school_summary(school_id)

    if not summary:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="School not found"
        )

    return summary


@router.get("/slug/{slug}", response_model=SchoolResponse)
async def get_school_by_slug(
    slug: str,
    db: DatabaseSession
):
    """
    Get school by slug (URL-friendly identifier)
    Public endpoint - no authentication required
    """
    school_service = SchoolService(db)
    school = await school_service.get_by_slug(slug)

    if not school:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"School with slug '{slug}' not found"
        )

    return SchoolResponse.model_validate(school)


@router.put("/{school_id}", response_model=SchoolResponse)
async def update_school(
    school_id: UUID,
    school_data: SchoolUpdate,
    db: DatabaseSession,
    _: CurrentSuperuser  # Only superusers can update schools
):
    """
    Update school information (superuser only)
    """
    school_service = SchoolService(db)
    school = await school_service.update_school(school_id, school_data)

    if not school:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="School not found"
        )

    await db.commit()
    return SchoolResponse.model_validate(school)


@router.delete("/{school_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_school(
    school_id: UUID,
    db: DatabaseSession,
    _: CurrentSuperuser  # Only superusers can delete schools
):
    """
    Deactivate school (soft delete, superuser only)
    """
    school_service = SchoolService(db)
    school = await school_service.deactivate_school(school_id)

    if not school:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="School not found"
        )

    await db.commit()


@router.post("/{school_id}/activate", response_model=SchoolResponse)
async def activate_school(
    school_id: UUID,
    db: DatabaseSession,
    _: CurrentSuperuser
):
    """
    Reactivate a deactivated school (superuser only)
    """
    school_service = SchoolService(db)
    school = await school_service.activate_school(school_id)

    if not school:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="School not found"
        )

    await db.commit()
    return SchoolResponse.model_validate(school)


@router.get("/search/by-name", response_model=list[SchoolListResponse])
async def search_schools_by_name(
    name: str = Query(..., min_length=1),
    db: DatabaseSession = None,
    limit: int = Query(10, ge=1, le=50)
):
    """
    Search schools by name (partial match)
    """
    school_service = SchoolService(db)
    schools = await school_service.search_by_name(name, limit=limit)

    return [SchoolListResponse.model_validate(s) for s in schools]


@router.put("/reorder", response_model=list[SchoolListResponse])
async def reorder_schools(
    reorder_data: SchoolReorderRequest,
    db: DatabaseSession,
    _: CurrentSuperuser  # Only superusers can reorder schools
):
    """
    Reorder schools for web portal display (superuser only)

    Updates the display_order field for each school in the request.
    Schools with lower display_order appear first.
    """
    school_service = SchoolService(db)

    # Convert to list of dicts for the service
    order_data = [{"id": item.id, "display_order": item.display_order} for item in reorder_data.schools]
    await school_service.reorder_schools(order_data)

    await db.commit()

    # Return updated schools list
    schools = await school_service.get_active_schools()
    return [SchoolListResponse.model_validate(s) for s in schools]


@router.post("/{school_id}/logo", response_model=SchoolResponse)
async def upload_school_logo(
    school_id: UUID,
    db: DatabaseSession,
    _: CurrentSuperuser,
    file: UploadFile = File(...)
):
    """
    Upload or replace a school's logo (superuser only).

    Supported formats: JPG, JPEG, PNG, WebP
    Max size: 2MB
    """
    school_service = SchoolService(db)

    # Check school exists
    school = await school_service.get(school_id)
    if not school:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="School not found"
        )

    # Validate file extension
    file_ext = os.path.splitext(file.filename or "")[1].lower()
    if file_ext not in ALLOWED_IMAGE_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Formato no permitido. Use: {', '.join(ALLOWED_IMAGE_EXTENSIONS)}"
        )

    # Read and validate file size
    content = await file.read()
    if len(content) > MAX_IMAGE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"El archivo excede el tamaño máximo de {MAX_IMAGE_SIZE // (1024*1024)}MB"
        )

    # Create upload directory (uses environment-aware path)
    uploads_base = Path(settings.uploads_path)
    upload_dir = uploads_base / "school-logos"
    upload_dir.mkdir(parents=True, exist_ok=True)

    # Generate unique filename
    filename = f"{school_id}{file_ext}"
    file_path = upload_dir / filename

    # Delete old logo if exists (with different extension)
    for ext in ALLOWED_IMAGE_EXTENSIONS:
        old_file = upload_dir / f"{school_id}{ext}"
        if old_file.exists() and old_file != file_path:
            old_file.unlink()

    # Save file
    with open(file_path, "wb") as f:
        f.write(content)

    # Update school with logo URL
    logo_url = f"/uploads/school-logos/{filename}"
    school = await school_service.update(school_id, {"logo_url": logo_url})
    await db.commit()

    return SchoolResponse.model_validate(school)


@router.delete("/{school_id}/logo", status_code=status.HTTP_204_NO_CONTENT)
async def delete_school_logo(
    school_id: UUID,
    db: DatabaseSession,
    _: CurrentSuperuser
):
    """
    Delete a school's logo (superuser only).
    """
    school_service = SchoolService(db)

    # Check school exists
    school = await school_service.get(school_id)
    if not school:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="School not found"
        )

    # Delete logo file if exists
    if school.logo_url:
        uploads_base = Path(settings.uploads_path)
        upload_dir = uploads_base / "school-logos"
        for ext in ALLOWED_IMAGE_EXTENSIONS:
            file_path = upload_dir / f"{school_id}{ext}"
            if file_path.exists():
                file_path.unlink()

    # Update school to remove logo URL
    await school_service.update(school_id, {"logo_url": None})
    await db.commit()
