"""
Document API Routes - Enterprise document management

All endpoints require superuser access.
"""
import logging
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form

logger = logging.getLogger(__name__)
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_superuser, get_db
from app.models.user import User
from app.services.document import (
    DocumentFolderService,
    BusinessDocumentService,
    ALLOWED_MIME_TYPES,
    MAX_FILE_SIZE,
)
from app.schemas.document import (
    DocumentFolderCreate,
    DocumentFolderUpdate,
    DocumentFolderResponse,
    BusinessDocumentCreate,
    BusinessDocumentUpdate,
    BusinessDocumentResponse,
    BusinessDocumentListItem,
    DocumentStorageStats,
)

router = APIRouter(
    prefix="/documents",
    tags=["documents"],
    dependencies=[Depends(get_current_superuser)]  # ALL endpoints require superuser
)

# Type aliases for cleaner code
DatabaseSession = Annotated[AsyncSession, Depends(get_db)]
CurrentSuperuser = Annotated[User, Depends(get_current_superuser)]


# ======================
# Folder Endpoints
# ======================

@router.post(
    "/folders",
    response_model=DocumentFolderResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new folder"
)
async def create_folder(
    folder_data: DocumentFolderCreate,
    db: DatabaseSession,
    current_user: CurrentSuperuser
):
    """Create a new document folder"""
    folder_service = DocumentFolderService(db)

    # Validate parent exists if provided
    if folder_data.parent_id:
        parent = await folder_service.get(folder_data.parent_id)
        if not parent:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Carpeta padre no encontrada"
            )

    folder = await folder_service.create_folder(
        folder_data.model_dump(),
        created_by_id=current_user.id
    )
    await db.commit()

    # Add counts for response
    folder.children_count = 0
    folder.documents_count = 0

    return DocumentFolderResponse.model_validate(folder)


@router.get(
    "/folders",
    response_model=list[DocumentFolderResponse],
    summary="Get all folders"
)
async def get_folders(
    db: DatabaseSession,
    current_user: CurrentSuperuser
):
    """Get all folders (flat list - frontend builds tree)"""
    folder_service = DocumentFolderService(db)
    folders = await folder_service.get_folder_tree()
    return [DocumentFolderResponse.model_validate(f) for f in folders]


@router.get(
    "/folders/{folder_id}",
    response_model=DocumentFolderResponse,
    summary="Get folder by ID"
)
async def get_folder(
    folder_id: UUID,
    db: DatabaseSession,
    current_user: CurrentSuperuser
):
    """Get a specific folder"""
    folder_service = DocumentFolderService(db)
    folder = await folder_service.get(folder_id)

    if not folder:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Carpeta no encontrada"
        )

    # Get counts
    doc_service = BusinessDocumentService(db)
    docs = await doc_service.get_documents(folder_id=folder_id)
    folder.documents_count = len(docs)

    children = await folder_service.get_children(folder_id)
    folder.children_count = len(children)

    return DocumentFolderResponse.model_validate(folder)


@router.put(
    "/folders/{folder_id}",
    response_model=DocumentFolderResponse,
    summary="Update folder"
)
async def update_folder(
    folder_id: UUID,
    folder_data: DocumentFolderUpdate,
    db: DatabaseSession,
    current_user: CurrentSuperuser
):
    """Update folder metadata"""
    folder_service = DocumentFolderService(db)

    # Check folder exists
    folder = await folder_service.get(folder_id)
    if not folder:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Carpeta no encontrada"
        )

    # Validate new parent if changing
    if folder_data.parent_id is not None:
        can_move = await folder_service.can_move_to_parent(folder_id, folder_data.parent_id)
        if not can_move:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No se puede mover la carpeta a esa ubicación"
            )

    updated = await folder_service.update_folder(
        folder_id,
        folder_data.model_dump(exclude_unset=True)
    )
    await db.commit()

    return DocumentFolderResponse.model_validate(updated)


@router.delete(
    "/folders/{folder_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete folder"
)
async def delete_folder(
    folder_id: UUID,
    db: DatabaseSession,
    current_user: CurrentSuperuser
):
    """Delete folder (must be empty)"""
    folder_service = DocumentFolderService(db)

    try:
        deleted = await folder_service.delete_folder(folder_id)
        if not deleted:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Carpeta no encontrada"
            )
        await db.commit()
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


# ======================
# Document Endpoints
# ======================

@router.post(
    "",
    response_model=BusinessDocumentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Upload a new document"
)
async def upload_document(
    db: DatabaseSession,
    current_user: CurrentSuperuser,
    file: UploadFile = File(...),
    name: str = Form(...),
    description: str | None = Form(None),
    folder_id: UUID | None = Form(None)
):
    """
    Upload a new document.

    Allowed types: PDF, PNG, JPG, XLSX, XLS, DOCX, DOC
    Max size: 50MB
    """
    doc_service = BusinessDocumentService(db)

    # Read file content
    content = await file.read()

    # Log upload attempt for debugging
    logger.info(f"Upload attempt: filename={file.filename}, content_type={file.content_type}, size={len(content)}")

    try:
        document = await doc_service.create_document(
            name=name,
            description=description,
            folder_id=folder_id,
            file_content=content,
            original_filename=file.filename or "unknown",
            content_type=file.content_type or "application/octet-stream",
            created_by_id=current_user.id
        )
        await db.commit()
        logger.info(f"Document uploaded successfully: {document.id}")
        return BusinessDocumentResponse.model_validate(document)
    except ValueError as e:
        logger.error(f"Document upload validation error: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.exception(f"Unexpected error during document upload: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error interno: {str(e)}"
        )


@router.get(
    "",
    response_model=list[BusinessDocumentListItem],
    summary="Get documents"
)
async def get_documents(
    db: DatabaseSession,
    current_user: CurrentSuperuser,
    folder_id: UUID | None = None,
    search: str | None = None,
    skip: int = 0,
    limit: int = 100
):
    """
    Get documents with optional filtering.

    - folder_id: Filter by folder (use 'null' for root documents)
    - search: Search in name, filename, and description
    """
    doc_service = BusinessDocumentService(db)
    documents = await doc_service.get_documents(
        folder_id=folder_id,
        search=search,
        skip=skip,
        limit=limit
    )
    return [BusinessDocumentListItem.model_validate(d) for d in documents]


@router.get(
    "/stats",
    response_model=DocumentStorageStats,
    summary="Get storage statistics"
)
async def get_storage_stats(
    db: DatabaseSession,
    current_user: CurrentSuperuser
):
    """Get storage usage statistics"""
    doc_service = BusinessDocumentService(db)
    stats = await doc_service.get_storage_stats()
    return DocumentStorageStats(**stats)


@router.get(
    "/{document_id}",
    response_model=BusinessDocumentResponse,
    summary="Get document metadata"
)
async def get_document(
    document_id: UUID,
    db: DatabaseSession,
    current_user: CurrentSuperuser
):
    """Get document metadata"""
    doc_service = BusinessDocumentService(db)
    document = await doc_service.get(document_id)

    if not document or not document.is_active:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Documento no encontrado"
        )

    return BusinessDocumentResponse.model_validate(document)


@router.get(
    "/{document_id}/download",
    summary="Download document file"
)
async def download_document(
    document_id: UUID,
    db: DatabaseSession,
    current_user: CurrentSuperuser
):
    """Download the document file"""
    doc_service = BusinessDocumentService(db)
    document = await doc_service.get(document_id)

    if not document or not document.is_active:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Documento no encontrado"
        )

    file_path = doc_service.get_download_path(document)

    if not file_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Archivo no encontrado en el servidor"
        )

    return FileResponse(
        path=str(file_path),
        filename=document.original_filename,
        media_type=document.mime_type
    )


@router.put(
    "/{document_id}",
    response_model=BusinessDocumentResponse,
    summary="Update document"
)
async def update_document(
    document_id: UUID,
    db: DatabaseSession,
    current_user: CurrentSuperuser,
    name: str | None = Form(None),
    description: str | None = Form(None),
    folder_id: UUID | None = Form(None),
    file: UploadFile | None = File(None)
):
    """
    Update document metadata and optionally replace the file.

    To move to root folder, set folder_id to null.
    """
    doc_service = BusinessDocumentService(db)

    # Check document exists
    document = await doc_service.get(document_id)
    if not document or not document.is_active:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Documento no encontrado"
        )

    # Build update data
    update_data = {}
    if name is not None:
        update_data["name"] = name
    if description is not None:
        update_data["description"] = description
    if folder_id is not None:
        update_data["folder_id"] = folder_id

    # Handle file replacement
    new_content = None
    new_filename = None
    new_content_type = None

    if file:
        new_content = await file.read()
        new_filename = file.filename
        new_content_type = file.content_type

    try:
        updated = await doc_service.update_document(
            document_id,
            update_data,
            new_file_content=new_content,
            new_filename=new_filename,
            new_content_type=new_content_type
        )
        await db.commit()
        return BusinessDocumentResponse.model_validate(updated)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.delete(
    "/{document_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete document"
)
async def delete_document(
    document_id: UUID,
    db: DatabaseSession,
    current_user: CurrentSuperuser,
    hard_delete: bool = False
):
    """
    Delete document.

    By default, performs soft delete (keeps file).
    Set hard_delete=true to permanently delete the file.
    """
    doc_service = BusinessDocumentService(db)

    deleted = await doc_service.delete_document(document_id, hard_delete=hard_delete)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Documento no encontrado"
        )

    await db.commit()
