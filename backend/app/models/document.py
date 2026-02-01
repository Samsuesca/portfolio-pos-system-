"""
Business Document Models - Document folders and file management for enterprise documents.
"""
from datetime import datetime
from sqlalchemy import String, Boolean, DateTime, Integer, Text, ForeignKey, BigInteger
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
import uuid

from app.db.base import Base
from app.utils.timezone import get_colombia_now_naive


class DocumentFolder(Base):
    """
    Document folder for organizing business documents.

    Supports hierarchical structure through parent_id for nested folders.
    """
    __tablename__ = "document_folders"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )

    # Folder details
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    color: Mapped[str | None] = mapped_column(String(20))  # Hex color for UI, e.g., #3B82F6
    icon: Mapped[str | None] = mapped_column(String(50))   # Icon name, e.g., folder, legal, price

    # Hierarchical structure
    parent_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("document_folders.id", ondelete="CASCADE"),
        nullable=True,
        index=True
    )
    order_index: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Audit
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=get_colombia_now_naive,
        nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=get_colombia_now_naive,
        onupdate=get_colombia_now_naive,
        nullable=False
    )

    # Relationships
    parent: Mapped["DocumentFolder | None"] = relationship(
        "DocumentFolder",
        remote_side=[id],
        back_populates="children"
    )
    children: Mapped[list["DocumentFolder"]] = relationship(
        "DocumentFolder",
        back_populates="parent",
        cascade="all, delete-orphan"
    )
    documents: Mapped[list["BusinessDocument"]] = relationship(
        back_populates="folder",
        cascade="all, delete-orphan"
    )
    created_by_user: Mapped["User | None"] = relationship()

    def __repr__(self) -> str:
        return f"<DocumentFolder({self.name})>"


class BusinessDocument(Base):
    """
    Business document - files stored on the server for enterprise use.

    Supports PDF, images, Excel files, and Word documents.
    Only accessible by superusers.
    """
    __tablename__ = "business_documents"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )

    # Folder relationship (nullable for root level documents)
    folder_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("document_folders.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )

    # Document details
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)

    # File information
    file_path: Mapped[str] = mapped_column(String(500), nullable=False)  # Path on server
    original_filename: Mapped[str] = mapped_column(String(255), nullable=False)  # Original uploaded name
    file_size: Mapped[int] = mapped_column(BigInteger, nullable=False)  # Size in bytes
    mime_type: Mapped[str] = mapped_column(String(100), nullable=False)  # MIME type

    # Status
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Audit
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=get_colombia_now_naive,
        nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=get_colombia_now_naive,
        onupdate=get_colombia_now_naive,
        nullable=False
    )

    # Relationships
    folder: Mapped["DocumentFolder | None"] = relationship(back_populates="documents")
    created_by_user: Mapped["User | None"] = relationship()

    @property
    def file_size_formatted(self) -> str:
        """Return human-readable file size"""
        size = self.file_size
        for unit in ['B', 'KB', 'MB', 'GB']:
            if size < 1024:
                return f"{size:.1f} {unit}"
            size /= 1024
        return f"{size:.1f} TB"

    @property
    def file_extension(self) -> str:
        """Return file extension from original filename"""
        if '.' in self.original_filename:
            return self.original_filename.rsplit('.', 1)[1].lower()
        return ''

    def __repr__(self) -> str:
        return f"<BusinessDocument({self.name}: {self.original_filename})>"
