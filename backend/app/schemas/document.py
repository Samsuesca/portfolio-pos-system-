"""
Document Schemas - Pydantic schemas for document management
"""
from datetime import datetime
from uuid import UUID
from pydantic import Field

from app.schemas.base import BaseSchema, IDModelSchema


# ======================
# Folder Schemas
# ======================

class DocumentFolderBase(BaseSchema):
    """Base schema for document folders"""
    name: str = Field(..., min_length=1, max_length=255)
    description: str | None = Field(None, max_length=1000)
    color: str | None = Field(None, max_length=20)  # Hex color, e.g., #3B82F6
    icon: str | None = Field(None, max_length=50)   # Icon name
    parent_id: UUID | None = None
    order_index: int = Field(default=0, ge=0)


class DocumentFolderCreate(DocumentFolderBase):
    """Schema for creating a folder"""
    pass


class DocumentFolderUpdate(BaseSchema):
    """Schema for updating a folder (all fields optional)"""
    name: str | None = Field(None, min_length=1, max_length=255)
    description: str | None = Field(None, max_length=1000)
    color: str | None = Field(None, max_length=20)
    icon: str | None = Field(None, max_length=50)
    parent_id: UUID | None = None
    order_index: int | None = Field(None, ge=0)


class DocumentFolderResponse(DocumentFolderBase, IDModelSchema):
    """Schema for folder response"""
    created_by: UUID | None
    created_at: datetime
    updated_at: datetime
    # Nested children and documents counts
    children_count: int = 0
    documents_count: int = 0


class DocumentFolderTree(DocumentFolderResponse):
    """Schema for folder with nested children (tree structure)"""
    children: list["DocumentFolderTree"] = []


# ======================
# Document Schemas
# ======================

class BusinessDocumentBase(BaseSchema):
    """Base schema for documents"""
    name: str = Field(..., min_length=1, max_length=255)
    description: str | None = Field(None, max_length=1000)
    folder_id: UUID | None = None


class BusinessDocumentCreate(BusinessDocumentBase):
    """Schema for creating a document (metadata only - file uploaded separately)"""
    pass


class BusinessDocumentUpdate(BaseSchema):
    """Schema for updating document metadata"""
    name: str | None = Field(None, min_length=1, max_length=255)
    description: str | None = Field(None, max_length=1000)
    folder_id: UUID | None = None


class BusinessDocumentResponse(BusinessDocumentBase, IDModelSchema):
    """Schema for document response"""
    file_path: str
    original_filename: str
    file_size: int
    mime_type: str
    is_active: bool
    created_by: UUID | None
    created_at: datetime
    updated_at: datetime

    @property
    def file_size_formatted(self) -> str:
        """Return human-readable file size"""
        size = self.file_size
        for unit in ['B', 'KB', 'MB', 'GB']:
            if size < 1024:
                return f"{size:.1f} {unit}"
            size /= 1024
        return f"{size:.1f} TB"


class BusinessDocumentListItem(IDModelSchema):
    """Simplified schema for document list"""
    name: str
    original_filename: str
    file_size: int
    mime_type: str
    folder_id: UUID | None
    created_at: datetime


# ======================
# Stats Schemas
# ======================

class DocumentStorageStats(BaseSchema):
    """Schema for storage statistics"""
    total_documents: int
    total_folders: int
    total_size_bytes: int
    max_size_bytes: int = 2 * 1024 * 1024 * 1024  # 2GB
    usage_percentage: float

    @property
    def total_size_formatted(self) -> str:
        """Return human-readable total size"""
        size = self.total_size_bytes
        for unit in ['B', 'KB', 'MB', 'GB']:
            if size < 1024:
                return f"{size:.1f} {unit}"
            size /= 1024
        return f"{size:.1f} TB"

    @property
    def max_size_formatted(self) -> str:
        """Return human-readable max size"""
        return "2.0 GB"


# Rebuild models to resolve forward references
DocumentFolderTree.model_rebuild()
