"""
Unit Tests for Document Services

Tests DocumentFolderService and BusinessDocumentService including
file validation, storage stats, folder tree operations, and document CRUD.
"""
import uuid
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch, PropertyMock

import pytest

from app.services.document import (
    BusinessDocumentService,
    DocumentFolderService,
    get_documents_upload_path,
    ALLOWED_MIME_TYPES,
    MAX_FILE_SIZE,
    MAX_TOTAL_STORAGE,
)
from app.services.base import BaseService


# ============================================================================
# Helpers
# ============================================================================


def _make_folder(**overrides):
    defaults = {
        "id": uuid.uuid4(),
        "name": "Legal",
        "parent_id": None,
        "order_index": 0,
        "children": [],
    }
    defaults.update(overrides)
    folder = MagicMock()
    for k, v in defaults.items():
        setattr(folder, k, v)
    return folder


def _make_document(**overrides):
    defaults = {
        "id": uuid.uuid4(),
        "name": "Contract",
        "folder_id": uuid.uuid4(),
        "file_path": "documents/abc123.pdf",
        "original_filename": "contract.pdf",
        "file_size": 1024,
        "mime_type": "application/pdf",
        "is_active": True,
    }
    defaults.update(overrides)
    doc = MagicMock()
    for k, v in defaults.items():
        setattr(doc, k, v)
    return doc


# ============================================================================
# TEST: get_documents_upload_path
# ============================================================================


class TestGetDocumentsUploadPath:

    @patch("app.services.document.settings")
    def test_production_path(self, mock_settings):
        mock_settings.ENV = "production"
        result = get_documents_upload_path()
        assert result == Path("/var/www/uniformes-system-v2/uploads/documents")

    @patch("app.services.document.settings")
    def test_non_production_path(self, mock_settings):
        mock_settings.ENV = "development"
        result = get_documents_upload_path()
        assert "uploads" in str(result)
        assert "documents" in str(result)
        assert str(result) != "/var/www/uniformes-system-v2/uploads/documents"


# ============================================================================
# TEST: DocumentFolderService
# ============================================================================


class TestDocumentFolderServiceGetFolderTree:

    @pytest.mark.asyncio
    async def test_returns_folders_with_counts(self, mock_db_session):
        folder = _make_folder(children=[_make_folder()])

        unique_mock = MagicMock()
        unique_mock.all.return_value = [folder]
        scalars_mock = MagicMock()
        scalars_mock.unique.return_value = unique_mock

        doc_count_result = MagicMock()
        doc_count_result.scalar_one.return_value = 3

        mock_db_session.execute = AsyncMock(
            side_effect=[
                MagicMock(scalars=MagicMock(return_value=scalars_mock)),
                doc_count_result,
            ]
        )

        svc = DocumentFolderService(mock_db_session)
        result = await svc.get_folder_tree()

        assert len(result) == 1
        assert result[0].documents_count == 3
        assert result[0].children_count == 1


class TestDocumentFolderServiceGetRootFolders:

    @pytest.mark.asyncio
    async def test_returns_only_root_folders(self, mock_db_session):
        root1 = _make_folder(name="Root1")
        root2 = _make_folder(name="Root2")
        scalars_mock = MagicMock()
        scalars_mock.all.return_value = [root1, root2]
        mock_db_session.execute = AsyncMock(
            return_value=MagicMock(scalars=MagicMock(return_value=scalars_mock))
        )

        svc = DocumentFolderService(mock_db_session)
        result = await svc.get_root_folders()

        assert len(result) == 2


class TestDocumentFolderServiceGetChildren:

    @pytest.mark.asyncio
    async def test_returns_children_of_folder(self, mock_db_session):
        parent_id = uuid.uuid4()
        child = _make_folder(parent_id=parent_id)
        scalars_mock = MagicMock()
        scalars_mock.all.return_value = [child]
        mock_db_session.execute = AsyncMock(
            return_value=MagicMock(scalars=MagicMock(return_value=scalars_mock))
        )

        svc = DocumentFolderService(mock_db_session)
        result = await svc.get_children(parent_id)

        assert len(result) == 1
        assert result[0].parent_id == parent_id


class TestDocumentFolderServiceDeleteFolder:

    @pytest.mark.asyncio
    async def test_delete_empty_folder_succeeds(self, mock_db_session):
        folder_id = uuid.uuid4()
        folder = _make_folder(id=folder_id)

        scalars_mock = MagicMock()
        scalars_mock.all.return_value = []
        children_result = MagicMock(scalars=MagicMock(return_value=scalars_mock))

        doc_count_result = MagicMock()
        doc_count_result.scalar_one.return_value = 0

        delete_result = MagicMock()
        delete_result.rowcount = 1

        mock_db_session.execute = AsyncMock(
            side_effect=[
                MagicMock(scalar_one_or_none=MagicMock(return_value=folder)),
                children_result,
                doc_count_result,
                delete_result,
            ]
        )

        svc = DocumentFolderService(mock_db_session)
        result = await svc.delete_folder(folder_id)

        assert result is True

    @pytest.mark.asyncio
    async def test_delete_folder_with_subfolders_raises(self, mock_db_session):
        folder_id = uuid.uuid4()
        folder = _make_folder(id=folder_id)

        scalars_mock = MagicMock()
        scalars_mock.all.return_value = [_make_folder()]
        children_result = MagicMock(scalars=MagicMock(return_value=scalars_mock))

        mock_db_session.execute = AsyncMock(
            side_effect=[
                MagicMock(scalar_one_or_none=MagicMock(return_value=folder)),
                children_result,
            ]
        )

        svc = DocumentFolderService(mock_db_session)
        with pytest.raises(ValueError, match="subcarpetas"):
            await svc.delete_folder(folder_id)

    @pytest.mark.asyncio
    async def test_delete_folder_with_documents_raises(self, mock_db_session):
        folder_id = uuid.uuid4()
        folder = _make_folder(id=folder_id)

        scalars_mock = MagicMock()
        scalars_mock.all.return_value = []
        children_result = MagicMock(scalars=MagicMock(return_value=scalars_mock))

        doc_count_result = MagicMock()
        doc_count_result.scalar_one.return_value = 5

        mock_db_session.execute = AsyncMock(
            side_effect=[
                MagicMock(scalar_one_or_none=MagicMock(return_value=folder)),
                children_result,
                doc_count_result,
            ]
        )

        svc = DocumentFolderService(mock_db_session)
        with pytest.raises(ValueError, match="documentos"):
            await svc.delete_folder(folder_id)

    @pytest.mark.asyncio
    async def test_delete_folder_not_found(self, mock_db_session):
        mock_db_session.execute = AsyncMock(
            return_value=MagicMock(
                scalar_one_or_none=MagicMock(return_value=None)
            )
        )

        svc = DocumentFolderService(mock_db_session)
        result = await svc.delete_folder(uuid.uuid4())

        assert result is False


class TestDocumentFolderServiceCanMoveToParent:

    @pytest.mark.asyncio
    async def test_none_parent_always_valid(self, mock_db_session):
        svc = DocumentFolderService(mock_db_session)
        result = await svc.can_move_to_parent(uuid.uuid4(), None)
        assert result is True

    @pytest.mark.asyncio
    async def test_self_reference_invalid(self, mock_db_session):
        folder_id = uuid.uuid4()
        svc = DocumentFolderService(mock_db_session)
        result = await svc.can_move_to_parent(folder_id, folder_id)
        assert result is False

    @pytest.mark.asyncio
    async def test_circular_reference_detected(self, mock_db_session):
        folder_a = uuid.uuid4()
        folder_b = uuid.uuid4()

        parent_obj = MagicMock()
        parent_obj.id = folder_a
        parent_obj.parent_id = None

        mock_db_session.execute = AsyncMock(
            return_value=MagicMock(
                scalar_one_or_none=MagicMock(return_value=parent_obj)
            )
        )

        svc = DocumentFolderService(mock_db_session)
        result = await svc.can_move_to_parent(folder_a, folder_b)

        assert result is False

    @pytest.mark.asyncio
    async def test_valid_move_succeeds(self, mock_db_session):
        folder_a = uuid.uuid4()
        folder_b = uuid.uuid4()

        target = MagicMock()
        target.id = folder_b
        target.parent_id = None

        mock_db_session.execute = AsyncMock(
            return_value=MagicMock(
                scalar_one_or_none=MagicMock(return_value=target)
            )
        )

        svc = DocumentFolderService(mock_db_session)
        result = await svc.can_move_to_parent(folder_a, folder_b)

        assert result is True


# ============================================================================
# TEST: BusinessDocumentService — validate_file
# ============================================================================


class TestValidateFile:

    def _svc(self, mock_db_session):
        with patch.object(BusinessDocumentService, "__init__", lambda self, db: None):
            svc = BusinessDocumentService.__new__(BusinessDocumentService)
            svc.db = mock_db_session
            svc.model = MagicMock()
            svc.upload_path = Path("/tmp/test-uploads/documents")
            return svc

    def test_valid_pdf(self, mock_db_session):
        svc = self._svc(mock_db_session)
        result = svc.validate_file("report.pdf", "application/pdf", 1024)
        assert result is None

    def test_invalid_mime_type(self, mock_db_session):
        svc = self._svc(mock_db_session)
        result = svc.validate_file("script.sh", "application/x-sh", 100)
        assert result is not None
        assert "no permitido" in result

    def test_file_too_large(self, mock_db_session):
        svc = self._svc(mock_db_session)
        result = svc.validate_file("big.pdf", "application/pdf", MAX_FILE_SIZE + 1)
        assert result is not None
        assert "50MB" in result

    def test_extension_mismatch(self, mock_db_session):
        svc = self._svc(mock_db_session)
        result = svc.validate_file("image.png", "application/pdf", 1024)
        assert result is not None
        assert "no coincide" in result

    def test_jpeg_accepts_jpg_extension(self, mock_db_session):
        svc = self._svc(mock_db_session)
        result = svc.validate_file("photo.jpg", "image/jpeg", 2048)
        assert result is None

    def test_jpeg_accepts_jpeg_extension(self, mock_db_session):
        svc = self._svc(mock_db_session)
        result = svc.validate_file("photo.jpeg", "image/jpeg", 2048)
        assert result is None

    def test_image_jpg_mime_accepts_jpeg_extension(self, mock_db_session):
        svc = self._svc(mock_db_session)
        result = svc.validate_file("photo.jpeg", "image/jpg", 2048)
        assert result is None

    def test_valid_xlsx(self, mock_db_session):
        svc = self._svc(mock_db_session)
        result = svc.validate_file(
            "data.xlsx",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            5000,
        )
        assert result is None


# ============================================================================
# TEST: BusinessDocumentService — get_storage_stats
# ============================================================================


class TestGetStorageStats:

    @pytest.mark.asyncio
    async def test_correct_calculation(self, mock_db_session):
        total_docs_result = MagicMock()
        total_docs_result.scalar_one.return_value = 25

        total_folders_result = MagicMock()
        total_folders_result.scalar_one.return_value = 5

        total_size_bytes = 1024 * 1024 * 100  # 100MB
        total_size_result = MagicMock()
        total_size_result.scalar_one.return_value = total_size_bytes

        mock_db_session.execute = AsyncMock(
            side_effect=[total_docs_result, total_folders_result, total_size_result]
        )

        with patch.object(BusinessDocumentService, "__init__", lambda self, db: None):
            svc = BusinessDocumentService.__new__(BusinessDocumentService)
            svc.db = mock_db_session
            svc.model = MagicMock()
            svc.upload_path = Path("/tmp/test")

        stats = await svc.get_storage_stats()

        assert stats["total_documents"] == 25
        assert stats["total_folders"] == 5
        assert stats["total_size_bytes"] == total_size_bytes
        assert stats["max_size_bytes"] == MAX_TOTAL_STORAGE
        expected_pct = round((total_size_bytes / MAX_TOTAL_STORAGE) * 100, 2)
        assert stats["usage_percentage"] == expected_pct


# ============================================================================
# TEST: BusinessDocumentService — check_storage_available
# ============================================================================


class TestCheckStorageAvailable:

    @pytest.mark.asyncio
    async def test_within_limit(self, mock_db_session):
        with patch.object(BusinessDocumentService, "__init__", lambda self, db: None):
            svc = BusinessDocumentService.__new__(BusinessDocumentService)
            svc.db = mock_db_session
            svc.model = MagicMock()
            svc.upload_path = Path("/tmp/test")

        svc.get_storage_stats = AsyncMock(
            return_value={"total_size_bytes": 1024, "max_size_bytes": MAX_TOTAL_STORAGE}
        )

        result = await svc.check_storage_available(1024)
        assert result is True

    @pytest.mark.asyncio
    async def test_exceeds_limit(self, mock_db_session):
        with patch.object(BusinessDocumentService, "__init__", lambda self, db: None):
            svc = BusinessDocumentService.__new__(BusinessDocumentService)
            svc.db = mock_db_session
            svc.model = MagicMock()
            svc.upload_path = Path("/tmp/test")

        svc.get_storage_stats = AsyncMock(
            return_value={
                "total_size_bytes": MAX_TOTAL_STORAGE - 100,
                "max_size_bytes": MAX_TOTAL_STORAGE,
            }
        )

        result = await svc.check_storage_available(200)
        assert result is False


# ============================================================================
# TEST: BusinessDocumentService — create_document
# ============================================================================


class TestCreateDocument:

    def _setup_svc(self, mock_db_session):
        with patch.object(BusinessDocumentService, "__init__", lambda self, db: None):
            svc = BusinessDocumentService.__new__(BusinessDocumentService)
            svc.db = mock_db_session
            svc.model = MagicMock()
            svc.upload_path = Path("/tmp/test-uploads/documents")
        return svc

    @pytest.mark.asyncio
    async def test_happy_path(self, mock_db_session):
        svc = self._setup_svc(mock_db_session)
        created_doc = _make_document()

        svc.validate_file = MagicMock(return_value=None)
        svc.check_storage_available = AsyncMock(return_value=True)
        svc.save_file = AsyncMock(return_value=("documents/new.pdf", 512))
        svc.create = AsyncMock(return_value=created_doc)

        result = await svc.create_document(
            name="Invoice",
            description="Monthly invoice",
            folder_id=uuid.uuid4(),
            file_content=b"PDF content",
            original_filename="invoice.pdf",
            content_type="application/pdf",
            created_by_id=uuid.uuid4(),
        )

        assert result == created_doc
        svc.validate_file.assert_called_once()
        svc.check_storage_available.assert_awaited_once()
        svc.save_file.assert_awaited_once()
        svc.create.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_invalid_file_raises(self, mock_db_session):
        svc = self._setup_svc(mock_db_session)
        svc.validate_file = MagicMock(return_value="Tipo de archivo no permitido: text/plain")

        with pytest.raises(ValueError, match="no permitido"):
            await svc.create_document(
                name="Bad",
                description=None,
                folder_id=None,
                file_content=b"text",
                original_filename="bad.txt",
                content_type="text/plain",
                created_by_id=uuid.uuid4(),
            )

    @pytest.mark.asyncio
    async def test_storage_full_raises(self, mock_db_session):
        svc = self._setup_svc(mock_db_session)
        svc.validate_file = MagicMock(return_value=None)
        svc.check_storage_available = AsyncMock(return_value=False)

        with pytest.raises(ValueError, match="almacenamiento"):
            await svc.create_document(
                name="Big",
                description=None,
                folder_id=None,
                file_content=b"x" * 1024,
                original_filename="big.pdf",
                content_type="application/pdf",
                created_by_id=uuid.uuid4(),
            )


# ============================================================================
# TEST: BusinessDocumentService — delete_document
# ============================================================================


class TestDeleteDocument:

    def _setup_svc(self, mock_db_session):
        with patch.object(BusinessDocumentService, "__init__", lambda self, db: None):
            svc = BusinessDocumentService.__new__(BusinessDocumentService)
            svc.db = mock_db_session
            svc.model = MagicMock()
            svc.upload_path = Path("/tmp/test-uploads/documents")
        return svc

    @pytest.mark.asyncio
    async def test_soft_delete_default(self, mock_db_session):
        svc = self._setup_svc(mock_db_session)
        doc = _make_document()
        svc.get = AsyncMock(return_value=doc)
        svc.soft_delete = AsyncMock(return_value=doc)

        result = await svc.delete_document(doc.id)

        assert result is True
        svc.soft_delete.assert_awaited_once_with(doc.id)

    @pytest.mark.asyncio
    async def test_hard_delete_removes_file(self, mock_db_session):
        svc = self._setup_svc(mock_db_session)
        doc = _make_document()
        svc.get = AsyncMock(return_value=doc)
        svc.delete_file = MagicMock(return_value=True)

        with patch.object(BaseService, "delete", new_callable=AsyncMock, return_value=True):
            result = await svc.delete_document(doc.id, hard_delete=True)

        assert result is True
        svc.delete_file.assert_called_once_with(doc.file_path)

    @pytest.mark.asyncio
    async def test_not_found_returns_false(self, mock_db_session):
        svc = self._setup_svc(mock_db_session)
        svc.get = AsyncMock(return_value=None)

        result = await svc.delete_document(uuid.uuid4())

        assert result is False


# ============================================================================
# TEST: BusinessDocumentService — move_document
# ============================================================================


class TestMoveDocument:

    @pytest.mark.asyncio
    async def test_moves_to_new_folder(self, mock_db_session):
        with patch.object(BusinessDocumentService, "__init__", lambda self, db: None):
            svc = BusinessDocumentService.__new__(BusinessDocumentService)
            svc.db = mock_db_session
            svc.model = MagicMock()
            svc.upload_path = Path("/tmp/test")

        new_folder_id = uuid.uuid4()
        doc_id = uuid.uuid4()
        updated_doc = _make_document(id=doc_id, folder_id=new_folder_id)
        svc.update = AsyncMock(return_value=updated_doc)

        result = await svc.move_document(doc_id, new_folder_id)

        svc.update.assert_awaited_once_with(doc_id, {"folder_id": new_folder_id})
        assert result.folder_id == new_folder_id

    @pytest.mark.asyncio
    async def test_moves_to_root(self, mock_db_session):
        with patch.object(BusinessDocumentService, "__init__", lambda self, db: None):
            svc = BusinessDocumentService.__new__(BusinessDocumentService)
            svc.db = mock_db_session
            svc.model = MagicMock()
            svc.upload_path = Path("/tmp/test")

        doc_id = uuid.uuid4()
        updated_doc = _make_document(id=doc_id, folder_id=None)
        svc.update = AsyncMock(return_value=updated_doc)

        result = await svc.move_document(doc_id, None)

        svc.update.assert_awaited_once_with(doc_id, {"folder_id": None})
        assert result.folder_id is None
