"""
Document Service - Business logic for document management
"""
import os
import uuid as uuid_module
from pathlib import Path
from typing import Any
from uuid import UUID

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.document import DocumentFolder, BusinessDocument
from app.services.base import BaseService
from app.core.config import settings

# Allowed MIME types and extensions
ALLOWED_MIME_TYPES = {
    'application/pdf': '.pdf',
    'image/png': '.png',
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
    'application/vnd.ms-excel': '.xls',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
    'application/msword': '.doc',
}

# Max file size: 50MB
MAX_FILE_SIZE = 50 * 1024 * 1024

# Max total storage: 2GB
MAX_TOTAL_STORAGE = 2 * 1024 * 1024 * 1024


def get_documents_upload_path() -> Path:
    """Get the path for document uploads"""
    if settings.ENV == "production":
        return Path("/var/www/uniformes-system-v2/uploads/documents")
    return Path(__file__).parent.parent.parent / "uploads" / "documents"


class DocumentFolderService(BaseService[DocumentFolder]):
    """Service for document folder operations"""

    def __init__(self, db: AsyncSession):
        super().__init__(DocumentFolder, db)

    async def get_folder_tree(self) -> list[DocumentFolder]:
        """
        Get all folders as a flat list (frontend will build tree)
        Includes counts for children and documents
        """
        result = await self.db.execute(
            select(DocumentFolder)
            .options(selectinload(DocumentFolder.children))
            .order_by(DocumentFolder.order_index, DocumentFolder.name)
        )
        folders = list(result.scalars().unique().all())

        # Get document counts for each folder
        for folder in folders:
            doc_count = await self.db.execute(
                select(func.count(BusinessDocument.id))
                .where(
                    BusinessDocument.folder_id == folder.id,
                    BusinessDocument.is_active == True
                )
            )
            folder.documents_count = doc_count.scalar_one()
            folder.children_count = len(folder.children)

        return folders

    async def get_root_folders(self) -> list[DocumentFolder]:
        """Get only root-level folders (no parent)"""
        result = await self.db.execute(
            select(DocumentFolder)
            .where(DocumentFolder.parent_id.is_(None))
            .order_by(DocumentFolder.order_index, DocumentFolder.name)
        )
        return list(result.scalars().all())

    async def get_children(self, folder_id: UUID) -> list[DocumentFolder]:
        """Get child folders of a folder"""
        result = await self.db.execute(
            select(DocumentFolder)
            .where(DocumentFolder.parent_id == folder_id)
            .order_by(DocumentFolder.order_index, DocumentFolder.name)
        )
        return list(result.scalars().all())

    async def create_folder(
        self,
        data: dict[str, Any],
        created_by_id: UUID
    ) -> DocumentFolder:
        """Create a new folder"""
        data["created_by"] = created_by_id
        return await self.create(data)

    async def update_folder(
        self,
        folder_id: UUID,
        data: dict[str, Any]
    ) -> DocumentFolder | None:
        """Update folder metadata"""
        return await self.update(folder_id, data)

    async def delete_folder(self, folder_id: UUID) -> bool:
        """
        Delete folder (only if empty - no documents or subfolders)
        Returns False if folder has content
        """
        folder = await self.get(folder_id)
        if not folder:
            return False

        # Check for subfolders
        children = await self.get_children(folder_id)
        if children:
            raise ValueError("No se puede eliminar una carpeta con subcarpetas")

        # Check for documents
        doc_count = await self.db.execute(
            select(func.count(BusinessDocument.id))
            .where(
                BusinessDocument.folder_id == folder_id,
                BusinessDocument.is_active == True
            )
        )
        if doc_count.scalar_one() > 0:
            raise ValueError("No se puede eliminar una carpeta con documentos")

        return await super().delete(folder_id)

    async def can_move_to_parent(
        self,
        folder_id: UUID,
        new_parent_id: UUID | None
    ) -> bool:
        """
        Check if a folder can be moved to a new parent
        (prevents circular references)
        """
        if new_parent_id is None:
            return True

        if folder_id == new_parent_id:
            return False

        # Check if new_parent is a descendant of folder_id
        current = await self.get(new_parent_id)
        while current:
            if current.id == folder_id:
                return False
            if current.parent_id:
                current = await self.get(current.parent_id)
            else:
                break

        return True


class BusinessDocumentService(BaseService[BusinessDocument]):
    """Service for business document operations"""

    def __init__(self, db: AsyncSession):
        super().__init__(BusinessDocument, db)
        self.upload_path = get_documents_upload_path()

    async def get_documents(
        self,
        folder_id: UUID | None = None,
        search: str | None = None,
        skip: int = 0,
        limit: int = 100,
        include_inactive: bool = False
    ) -> list[BusinessDocument]:
        """Get documents with optional folder filter and search"""
        query = select(BusinessDocument)

        if not include_inactive:
            query = query.where(BusinessDocument.is_active == True)

        if folder_id is not None:
            query = query.where(BusinessDocument.folder_id == folder_id)

        if search:
            search_term = f"%{search}%"
            query = query.where(
                BusinessDocument.name.ilike(search_term) |
                BusinessDocument.original_filename.ilike(search_term) |
                BusinessDocument.description.ilike(search_term)
            )

        query = query.order_by(BusinessDocument.created_at.desc())
        query = query.offset(skip).limit(limit)

        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def get_root_documents(self) -> list[BusinessDocument]:
        """Get documents at root level (no folder)"""
        return await self.get_documents(folder_id=None)

    async def get_storage_stats(self) -> dict:
        """Get storage usage statistics"""
        # Total documents count
        total_docs = await self.db.execute(
            select(func.count(BusinessDocument.id))
            .where(BusinessDocument.is_active == True)
        )

        # Total folders count
        total_folders = await self.db.execute(
            select(func.count(DocumentFolder.id))
        )

        # Total size
        total_size = await self.db.execute(
            select(func.coalesce(func.sum(BusinessDocument.file_size), 0))
            .where(BusinessDocument.is_active == True)
        )

        total_size_bytes = total_size.scalar_one()
        usage_percentage = (total_size_bytes / MAX_TOTAL_STORAGE) * 100

        return {
            "total_documents": total_docs.scalar_one(),
            "total_folders": total_folders.scalar_one(),
            "total_size_bytes": total_size_bytes,
            "max_size_bytes": MAX_TOTAL_STORAGE,
            "usage_percentage": round(usage_percentage, 2)
        }

    async def check_storage_available(self, file_size: int) -> bool:
        """Check if there's enough storage for a new file"""
        stats = await self.get_storage_stats()
        return (stats["total_size_bytes"] + file_size) <= MAX_TOTAL_STORAGE

    def validate_file(self, filename: str, content_type: str, file_size: int) -> str | None:
        """
        Validate file before upload
        Returns error message or None if valid
        """
        # Check MIME type
        if content_type not in ALLOWED_MIME_TYPES:
            return f"Tipo de archivo no permitido: {content_type}"

        # Check file size
        if file_size > MAX_FILE_SIZE:
            return f"El archivo excede el tamaño máximo de 50MB"

        # Check extension matches MIME type
        ext = Path(filename).suffix.lower()
        expected_ext = ALLOWED_MIME_TYPES[content_type]

        # For images, allow both .jpg and .jpeg
        valid_extensions = [expected_ext]
        if content_type in ['image/jpeg', 'image/jpg']:
            valid_extensions = ['.jpg', '.jpeg']

        if ext not in valid_extensions:
            return f"Extensión de archivo no coincide con el tipo: {ext}"

        return None

    async def save_file(
        self,
        file_content: bytes,
        original_filename: str,
        content_type: str
    ) -> tuple[str, int]:
        """
        Save file to disk and return (file_path, file_size)
        """
        # Create uploads directory if needed
        self.upload_path.mkdir(parents=True, exist_ok=True)

        # Generate unique filename
        ext = Path(original_filename).suffix.lower()
        unique_filename = f"{uuid_module.uuid4()}{ext}"
        file_path = self.upload_path / unique_filename

        # Write file
        file_path.write_bytes(file_content)

        # Return relative path (for URL generation)
        relative_path = f"documents/{unique_filename}"
        return relative_path, len(file_content)

    def delete_file(self, file_path: str) -> bool:
        """Delete file from disk"""
        try:
            # file_path is relative like "documents/uuid.ext"
            full_path = self.upload_path.parent / file_path
            if full_path.exists():
                full_path.unlink()
                return True
            return False
        except Exception:
            return False

    async def create_document(
        self,
        name: str,
        description: str | None,
        folder_id: UUID | None,
        file_content: bytes,
        original_filename: str,
        content_type: str,
        created_by_id: UUID
    ) -> BusinessDocument:
        """Create a new document with file upload"""
        # Validate file
        error = self.validate_file(original_filename, content_type, len(file_content))
        if error:
            raise ValueError(error)

        # Check storage
        if not await self.check_storage_available(len(file_content)):
            raise ValueError("No hay espacio de almacenamiento disponible. Límite: 2GB")

        # Save file
        file_path, file_size = await self.save_file(
            file_content, original_filename, content_type
        )

        # Create document record
        document = await self.create({
            "name": name,
            "description": description,
            "folder_id": folder_id,
            "file_path": file_path,
            "original_filename": original_filename,
            "file_size": file_size,
            "mime_type": content_type,
            "created_by": created_by_id,
        })

        return document

    async def update_document(
        self,
        document_id: UUID,
        data: dict[str, Any],
        new_file_content: bytes | None = None,
        new_filename: str | None = None,
        new_content_type: str | None = None
    ) -> BusinessDocument | None:
        """Update document metadata and optionally replace file"""
        document = await self.get(document_id)
        if not document:
            return None

        # If new file provided, replace it
        if new_file_content and new_filename and new_content_type:
            # Validate new file
            error = self.validate_file(new_filename, new_content_type, len(new_file_content))
            if error:
                raise ValueError(error)

            # Check storage (subtract old file size, add new)
            size_diff = len(new_file_content) - document.file_size
            if size_diff > 0 and not await self.check_storage_available(size_diff):
                raise ValueError("No hay espacio de almacenamiento disponible")

            # Delete old file
            self.delete_file(document.file_path)

            # Save new file
            file_path, file_size = await self.save_file(
                new_file_content, new_filename, new_content_type
            )

            data["file_path"] = file_path
            data["original_filename"] = new_filename
            data["file_size"] = file_size
            data["mime_type"] = new_content_type

        return await self.update(document_id, data)

    async def delete_document(self, document_id: UUID, hard_delete: bool = False) -> bool:
        """
        Delete document (soft delete by default)
        hard_delete=True will also delete the file from disk
        """
        document = await self.get(document_id)
        if not document:
            return False

        if hard_delete:
            # Delete file from disk
            self.delete_file(document.file_path)
            return await super().delete(document_id)
        else:
            # Soft delete (keep file)
            result = await self.soft_delete(document_id)
            return result is not None

    async def move_document(
        self,
        document_id: UUID,
        new_folder_id: UUID | None
    ) -> BusinessDocument | None:
        """Move document to a different folder"""
        return await self.update(document_id, {"folder_id": new_folder_id})

    def get_download_path(self, document: BusinessDocument) -> Path:
        """Get full path for downloading a document"""
        return self.upload_path.parent / document.file_path
