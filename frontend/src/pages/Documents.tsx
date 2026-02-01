/**
 * Documents Page - Enterprise document management
 *
 * Mini file manager for superusers to manage business documents.
 * Features: folder hierarchy, file upload/download, search, storage indicator
 */
import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import {
  FolderTree,
  DocumentGrid,
  FolderModal,
  DocumentUploadModal,
  StorageIndicator,
} from '../components/documents';
import { documentService } from '../services/documentService';
import { extractErrorMessage } from '../utils/api-client';
import { useAuthStore } from '../stores/authStore';
import { useNavigate } from 'react-router-dom';
import {
  FolderPlus,
  Upload,
  Search,
  Home,
  ChevronRight,
  AlertTriangle,
} from 'lucide-react';
import type {
  DocumentFolder,
  DocumentFolderTree,
  BusinessDocumentListItem,
  DocumentStorageStats,
  DocumentFolderCreate,
  DocumentFolderUpdate,
} from '../types/document';
import { buildFolderTree, getFolderPath } from '../types/document';

export default function Documents() {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  // Check superuser access
  useEffect(() => {
    if (user && !user.is_superuser) {
      navigate('/');
    }
  }, [user, navigate]);

  // State
  const [folders, setFolders] = useState<DocumentFolder[]>([]);
  const [folderTree, setFolderTree] = useState<DocumentFolderTree[]>([]);
  const [documents, setDocuments] = useState<BusinessDocumentListItem[]>([]);
  const [stats, setStats] = useState<DocumentStorageStats | null>(null);

  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingDocs, setIsLoadingDocs] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modal state
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [editingFolder, setEditingFolder] = useState<DocumentFolder | null>(null);
  const [newFolderParentId, setNewFolderParentId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Delete confirmation
  const [deleteConfirm, setDeleteConfirm] = useState<{
    type: 'folder' | 'document';
    id: string;
    name: string;
  } | null>(null);

  // Load initial data
  useEffect(() => {
    loadFolders();
    loadStats();
  }, []);

  // Load documents when folder or search changes
  useEffect(() => {
    loadDocuments();
  }, [selectedFolderId, searchTerm]);

  const loadFolders = async () => {
    try {
      const data = await documentService.getFolders();
      setFolders(data);
      setFolderTree(buildFolderTree(data));
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  const loadDocuments = async () => {
    setIsLoadingDocs(true);
    try {
      const data = await documentService.getDocuments({
        folder_id: selectedFolderId,
        search: searchTerm || undefined,
      });
      setDocuments(data);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setIsLoadingDocs(false);
    }
  };

  const loadStats = async () => {
    try {
      const data = await documentService.getStorageStats();
      setStats(data);
    } catch (err) {
      console.error('Error loading stats:', err);
    }
  };

  // Folder operations
  const handleCreateFolder = (parentId: string | null) => {
    setNewFolderParentId(parentId);
    setEditingFolder(null);
    setIsFolderModalOpen(true);
  };

  const handleEditFolder = (folder: DocumentFolderTree) => {
    setEditingFolder(folder);
    setNewFolderParentId(null);
    setIsFolderModalOpen(true);
  };

  const handleDeleteFolder = (folder: DocumentFolderTree) => {
    setDeleteConfirm({
      type: 'folder',
      id: folder.id,
      name: folder.name,
    });
  };

  const handleFolderSubmit = async (data: DocumentFolderCreate | DocumentFolderUpdate) => {
    setIsSubmitting(true);
    try {
      if (editingFolder) {
        await documentService.updateFolder(editingFolder.id, data);
      } else {
        await documentService.createFolder({
          ...data,
          parent_id: newFolderParentId,
        } as DocumentFolderCreate);
      }
      await loadFolders();
      setIsFolderModalOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Document operations
  const handleUpload = async (file: File, data: { name: string; description?: string }) => {
    setIsSubmitting(true);
    try {
      await documentService.uploadDocument(file, {
        ...data,
        folder_id: selectedFolderId,
      });
      await loadDocuments();
      await loadStats();
      setIsUploadModalOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownload = async (doc: BusinessDocumentListItem) => {
    try {
      await documentService.downloadDocument(doc.id, doc.original_filename);
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  };

  const handlePreview = (doc: BusinessDocumentListItem) => {
    // Open in new tab for preview
    const url = documentService.getDownloadUrl(doc.id);
    window.open(url, '_blank');
  };

  const handleEditDocument = (_doc: BusinessDocumentListItem) => {
    // For now, just show an alert - could implement a full edit modal later
    alert('Funcion de edicion en desarrollo');
  };

  const handleDeleteDocument = (doc: BusinessDocumentListItem) => {
    setDeleteConfirm({
      type: 'document',
      id: doc.id,
      name: doc.name,
    });
  };

  const confirmDelete = async () => {
    if (!deleteConfirm) return;

    setIsSubmitting(true);
    try {
      if (deleteConfirm.type === 'folder') {
        await documentService.deleteFolder(deleteConfirm.id);
        await loadFolders();
        if (selectedFolderId === deleteConfirm.id) {
          setSelectedFolderId(null);
        }
      } else {
        await documentService.deleteDocument(deleteConfirm.id, true);
        await loadDocuments();
        await loadStats();
      }
      setDeleteConfirm(null);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Breadcrumb
  const breadcrumbPath = getFolderPath(folders, selectedFolderId);

  // If not superuser, show access denied
  if (user && !user.is_superuser) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center h-96">
          <AlertTriangle className="w-16 h-16 text-red-500 mb-4" />
          <h2 className="text-xl font-semibold text-gray-900">Acceso denegado</h2>
          <p className="text-gray-500">Solo superusuarios pueden acceder a esta seccion.</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="flex flex-col h-[calc(100vh-140px)]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-white border-b">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Documentos Empresariales</h1>
            <p className="text-sm text-gray-500">Gestiona documentos del negocio</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="flex items-center gap-2 px-3 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              onClick={() => handleCreateFolder(selectedFolderId)}
            >
              <FolderPlus className="w-5 h-5" />
              <span className="hidden sm:inline">Nueva carpeta</span>
            </button>
            <button
              className="flex items-center gap-2 px-3 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700"
              onClick={() => setIsUploadModalOpen(true)}
            >
              <Upload className="w-5 h-5" />
              <span className="hidden sm:inline">Subir archivo</span>
            </button>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="mx-4 mt-2 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm flex justify-between items-center">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">
              &times;
            </button>
          </div>
        )}

        {/* Main content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar - Folder tree */}
          <div className="w-64 bg-white border-r flex-shrink-0 hidden md:flex flex-col">
            <FolderTree
              folders={folderTree}
              selectedFolderId={selectedFolderId}
              onSelectFolder={setSelectedFolderId}
              onCreateFolder={handleCreateFolder}
              onEditFolder={handleEditFolder}
              onDeleteFolder={handleDeleteFolder}
            />
          </div>

          {/* Content area */}
          <div className="flex-1 flex flex-col overflow-hidden bg-gray-50">
            {/* Toolbar */}
            <div className="flex items-center gap-4 px-4 py-2 bg-white border-b">
              {/* Breadcrumb */}
              <div className="flex items-center gap-1 text-sm">
                <button
                  className="flex items-center gap-1 text-gray-500 hover:text-gray-700"
                  onClick={() => setSelectedFolderId(null)}
                >
                  <Home className="w-4 h-4" />
                  <span>Inicio</span>
                </button>
                {breadcrumbPath.map((folder) => (
                  <div key={folder.id} className="flex items-center">
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                    <button
                      className="text-gray-500 hover:text-gray-700"
                      onClick={() => setSelectedFolderId(folder.id)}
                    >
                      {folder.name}
                    </button>
                  </div>
                ))}
              </div>

              {/* Spacer */}
              <div className="flex-1" />

              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar documentos..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 pr-3 py-1.5 border rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-48"
                />
              </div>
            </div>

            {/* Document grid */}
            <div className="flex-1 overflow-y-auto p-4">
              <DocumentGrid
                documents={documents}
                onDownload={handleDownload}
                onPreview={handlePreview}
                onEdit={handleEditDocument}
                onDelete={handleDeleteDocument}
                isLoading={isLoadingDocs}
              />
            </div>
          </div>
        </div>

        {/* Storage indicator */}
        <StorageIndicator stats={stats} isLoading={isLoading} />

        {/* Modals */}
        <FolderModal
          isOpen={isFolderModalOpen}
          onClose={() => setIsFolderModalOpen(false)}
          onSubmit={handleFolderSubmit}
          folder={editingFolder}
          parentId={newFolderParentId}
          isLoading={isSubmitting}
        />

        <DocumentUploadModal
          isOpen={isUploadModalOpen}
          onClose={() => setIsUploadModalOpen(false)}
          onUpload={handleUpload}
          isLoading={isSubmitting}
        />

        {/* Delete confirmation modal */}
        {deleteConfirm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Eliminar {deleteConfirm.type === 'folder' ? 'carpeta' : 'documento'}
              </h3>
              <p className="text-gray-600 mb-4">
                Estas seguro de eliminar "{deleteConfirm.name}"?
                {deleteConfirm.type === 'document' && ' El archivo sera eliminado permanentemente.'}
              </p>
              <div className="flex justify-end gap-2">
                <button
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                  onClick={() => setDeleteConfirm(null)}
                  disabled={isSubmitting}
                >
                  Cancelar
                </button>
                <button
                  className="px-4 py-2 text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50"
                  onClick={confirmDelete}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Eliminando...' : 'Eliminar'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
