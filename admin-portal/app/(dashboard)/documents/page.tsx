'use client';

import { useState, useEffect, useRef } from 'react';
import {
  FolderOpen,
  FolderPlus,
  Upload,
  Search,
  Home,
  ChevronRight,
  Loader2,
  AlertCircle,
  X,
  File,
  FileText,
  Image,
  Download,
  Eye,
  Trash2,
  Pencil,
  Folder,
  HardDrive,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  MoreVertical,
} from 'lucide-react';
import { useAdminAuth } from '@/lib/adminAuth';
import documentService, {
  DocumentFolder,
  DocumentFolderTree,
  BusinessDocumentListItem,
  DocumentStorageStats,
  DocumentFolderCreate,
  DocumentFolderUpdate,
  buildFolderTree,
  getFolderPath,
  formatFileSize,
  getFileTypeName,
  FOLDER_COLORS,
} from '@/lib/services/documentService';

// Helper to extract error message
const getErrorMessage = (err: any, defaultMsg: string): string => {
  const detail = err.response?.data?.detail;
  if (!detail) return defaultMsg;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return detail.map((e: any) => e.msg || e.message || JSON.stringify(e)).join(', ');
  }
  if (typeof detail === 'object' && detail.msg) return detail.msg;
  return defaultMsg;
};

// File icon component based on mime type
const FileIcon = ({ mimeType, size = 'md' }: { mimeType: string; size?: 'sm' | 'md' | 'lg' }) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
  };

  if (mimeType === 'application/pdf') {
    return <FileText className={`${sizeClasses[size]} text-red-500`} />;
  }
  if (mimeType.startsWith('image/')) {
    return <Image className={`${sizeClasses[size]} text-blue-500`} />;
  }
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) {
    return <FileText className={`${sizeClasses[size]} text-green-500`} />;
  }
  if (mimeType.includes('word') || mimeType.includes('document')) {
    return <FileText className={`${sizeClasses[size]} text-blue-600`} />;
  }
  return <File className={`${sizeClasses[size]} text-slate-400`} />;
};

export default function DocumentsPage() {
  const { user } = useAdminAuth();

  // State
  const [folders, setFolders] = useState<DocumentFolder[]>([]);
  const [folderTree, setFolderTree] = useState<DocumentFolderTree[]>([]);
  const [documents, setDocuments] = useState<BusinessDocumentListItem[]>([]);
  const [stats, setStats] = useState<DocumentStorageStats | null>(null);

  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingDocs, setIsLoadingDocs] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modal state
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [editingFolder, setEditingFolder] = useState<DocumentFolder | null>(null);
  const [newFolderParentId, setNewFolderParentId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Folder form
  const [folderForm, setFolderForm] = useState({
    name: '',
    description: '',
    color: FOLDER_COLORS[0],
  });

  // Upload form
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadName, setUploadName] = useState('');
  const [uploadDescription, setUploadDescription] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Delete confirmation
  const [deleteConfirm, setDeleteConfirm] = useState<{
    type: 'folder' | 'document';
    id: string;
    name: string;
  } | null>(null);

  // Context menu for mobile
  const [contextMenu, setContextMenu] = useState<{
    type: 'folder' | 'document';
    item: any;
  } | null>(null);

  // Check superuser access
  const isSuperuser = user?.is_superuser;

  useEffect(() => {
    if (isSuperuser) {
      loadFolders();
      loadStats();
    }
  }, [isSuperuser]);

  useEffect(() => {
    if (isSuperuser) {
      loadDocuments();
    }
  }, [selectedFolderId, searchTerm, isSuperuser]);

  const loadFolders = async () => {
    try {
      const data = await documentService.getFolders();
      setFolders(data);
      setFolderTree(buildFolderTree(data));
    } catch (err) {
      setError(getErrorMessage(err, 'Error al cargar carpetas'));
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
      setError(getErrorMessage(err, 'Error al cargar documentos'));
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
    setFolderForm({ name: '', description: '', color: FOLDER_COLORS[0] });
    setIsFolderModalOpen(true);
  };

  const handleEditFolder = (folder: DocumentFolderTree) => {
    setEditingFolder(folder);
    setNewFolderParentId(null);
    setFolderForm({
      name: folder.name,
      description: folder.description || '',
      color: folder.color || FOLDER_COLORS[0],
    });
    setIsFolderModalOpen(true);
  };

  const handleFolderSubmit = async () => {
    if (!folderForm.name.trim()) return;

    setIsSubmitting(true);
    try {
      if (editingFolder) {
        await documentService.updateFolder(editingFolder.id, {
          name: folderForm.name,
          description: folderForm.description || null,
          color: folderForm.color,
        });
      } else {
        await documentService.createFolder({
          name: folderForm.name,
          description: folderForm.description || null,
          color: folderForm.color,
          parent_id: newFolderParentId,
        });
      }
      await loadFolders();
      setIsFolderModalOpen(false);
    } catch (err) {
      setError(getErrorMessage(err, 'Error al guardar carpeta'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Upload operations
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadFile(file);
      setUploadName(file.name.replace(/\.[^/.]+$/, '')); // Remove extension
    }
  };

  const handleUpload = async () => {
    if (!uploadFile || !uploadName.trim()) return;

    setIsSubmitting(true);
    try {
      await documentService.uploadDocument(uploadFile, {
        name: uploadName,
        description: uploadDescription || null,
        folder_id: selectedFolderId,
      });
      await loadDocuments();
      await loadStats();
      setIsUploadModalOpen(false);
      setUploadFile(null);
      setUploadName('');
      setUploadDescription('');
    } catch (err) {
      setError(getErrorMessage(err, 'Error al subir archivo'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownload = async (doc: BusinessDocumentListItem) => {
    try {
      await documentService.downloadDocument(doc.id, doc.original_filename);
    } catch (err) {
      setError(getErrorMessage(err, 'Error al descargar archivo'));
    }
  };

  const handlePreview = (doc: BusinessDocumentListItem) => {
    const url = documentService.getDownloadUrl(doc.id);
    window.open(url, '_blank');
  };

  // Delete operations
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
      setError(getErrorMessage(err, 'Error al eliminar'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle folder expansion
  const toggleFolderExpansion = (folderId: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(folderId)) {
      newExpanded.delete(folderId);
    } else {
      newExpanded.add(folderId);
    }
    setExpandedFolders(newExpanded);
  };

  // Render folder tree recursively
  const renderFolderTree = (folders: DocumentFolderTree[], depth = 0) => {
    return folders.map((folder) => {
      const hasChildren = folder.children.length > 0;
      const isExpanded = expandedFolders.has(folder.id);
      const isSelected = selectedFolderId === folder.id;

      return (
        <div key={folder.id}>
          <div
            className={`flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-slate-100 rounded-lg transition group ${
              isSelected ? 'bg-brand-50 text-brand-700' : ''
            }`}
            style={{ paddingLeft: `${12 + depth * 16}px` }}
          >
            {hasChildren ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleFolderExpansion(folder.id);
                }}
                className="p-0.5 hover:bg-slate-200 rounded"
              >
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                )}
              </button>
            ) : (
              <div className="w-5" />
            )}

            <div
              className="flex items-center gap-2 flex-1"
              onClick={() => setSelectedFolderId(folder.id)}
            >
              <Folder
                className="w-5 h-5"
                style={{ color: folder.color || FOLDER_COLORS[0] }}
              />
              <span className="text-sm truncate">{folder.name}</span>
              <span className="text-xs text-slate-400">({folder.documents_count})</span>
            </div>

            <button
              onClick={(e) => {
                e.stopPropagation();
                setContextMenu({ type: 'folder', item: folder });
              }}
              className="p-1 opacity-0 group-hover:opacity-100 hover:bg-slate-200 rounded transition"
            >
              <MoreVertical className="w-4 h-4 text-slate-400" />
            </button>
          </div>

          {hasChildren && isExpanded && renderFolderTree(folder.children, depth + 1)}
        </div>
      );
    });
  };

  // Breadcrumb path
  const breadcrumbPath = getFolderPath(folders, selectedFolderId);

  // Access check
  if (!isSuperuser) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6">
        <div className="flex items-start">
          <AlertCircle className="w-6 h-6 text-yellow-600 mr-3 flex-shrink-0" />
          <div>
            <h3 className="text-sm font-medium text-yellow-800">Acceso Restringido</h3>
            <p className="mt-1 text-sm text-yellow-700">
              Solo superusuarios pueden acceder a los documentos empresariales.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-140px)]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <FolderOpen className="w-7 h-7 text-brand-500" />
            Documentos Empresariales
          </h1>
          <p className="text-slate-500 mt-1">Gestiona documentos del negocio</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleCreateFolder(selectedFolderId)}
            className="flex items-center gap-2 px-3 py-2 text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition"
          >
            <FolderPlus className="w-5 h-5" />
            <span className="hidden sm:inline">Nueva carpeta</span>
          </button>
          <button
            onClick={() => setIsUploadModalOpen(true)}
            className="flex items-center gap-2 px-3 py-2 text-white bg-brand-600 rounded-lg hover:bg-brand-700 transition"
          >
            <Upload className="w-5 h-5" />
            <span className="hidden sm:inline">Subir archivo</span>
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4 flex items-center justify-between text-red-700">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            {error}
          </div>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden bg-white rounded-xl shadow-sm border border-slate-200">
        {/* Sidebar - Folder tree */}
        <div className="w-64 border-r flex-shrink-0 hidden md:flex flex-col">
          <div className="p-3 border-b">
            <button
              onClick={() => setSelectedFolderId(null)}
              className={`flex items-center gap-2 w-full px-3 py-2 rounded-lg transition ${
                selectedFolderId === null
                  ? 'bg-brand-50 text-brand-700'
                  : 'hover:bg-slate-100 text-slate-700'
              }`}
            >
              <Home className="w-5 h-5" />
              <span className="text-sm font-medium">Todos los documentos</span>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-2">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-brand-500" />
              </div>
            ) : (
              renderFolderTree(folderTree)
            )}
          </div>
        </div>

        {/* Content area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Toolbar */}
          <div className="flex items-center gap-4 px-4 py-3 border-b">
            {/* Breadcrumb */}
            <div className="flex items-center gap-1 text-sm flex-1 overflow-x-auto">
              <button
                className="flex items-center gap-1 text-slate-500 hover:text-slate-700 whitespace-nowrap"
                onClick={() => setSelectedFolderId(null)}
              >
                <Home className="w-4 h-4" />
                <span>Inicio</span>
              </button>
              {breadcrumbPath.map((folder) => (
                <div key={folder.id} className="flex items-center whitespace-nowrap">
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                  <button
                    className="text-slate-500 hover:text-slate-700"
                    onClick={() => setSelectedFolderId(folder.id)}
                  >
                    {folder.name}
                  </button>
                </div>
              ))}
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none w-40"
              />
            </div>

            <button
              onClick={() => {
                loadFolders();
                loadDocuments();
                loadStats();
              }}
              className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {/* Document grid */}
          <div className="flex-1 overflow-y-auto p-4">
            {isLoadingDocs ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
              </div>
            ) : documents.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                <File className="w-12 h-12 text-slate-300 mb-4" />
                <p>No hay documentos en esta carpeta</p>
                <button
                  onClick={() => setIsUploadModalOpen(true)}
                  className="mt-4 text-brand-600 hover:text-brand-700 font-medium"
                >
                  Subir un archivo
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="bg-white border border-slate-200 rounded-lg p-4 hover:shadow-md transition group"
                  >
                    <div className="flex items-start gap-3">
                      <FileIcon mimeType={doc.mime_type} />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-800 truncate">{doc.name}</p>
                        <p className="text-xs text-slate-500">
                          {getFileTypeName(doc.mime_type)} - {formatFileSize(doc.file_size)}
                        </p>
                        <p className="text-xs text-slate-400 mt-1">
                          {new Date(doc.created_at).toLocaleDateString('es-CO')}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 mt-3 pt-3 border-t opacity-0 group-hover:opacity-100 transition">
                      <button
                        onClick={() => handlePreview(doc)}
                        className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded transition"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Ver
                      </button>
                      <button
                        onClick={() => handleDownload(doc)}
                        className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded transition"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Descargar
                      </button>
                      <button
                        onClick={() =>
                          setDeleteConfirm({ type: 'document', id: doc.id, name: doc.name })
                        }
                        className="p-1.5 text-red-500 hover:bg-red-50 rounded transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Storage indicator */}
          {stats && (
            <div className="px-4 py-3 border-t bg-slate-50">
              <div className="flex items-center gap-3">
                <HardDrive className="w-5 h-5 text-slate-400" />
                <div className="flex-1">
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-slate-600">
                      {formatFileSize(stats.total_size_bytes)} de {formatFileSize(stats.max_size_bytes)} usados
                    </span>
                    <span className="text-slate-500">{stats.usage_percentage.toFixed(1)}%</span>
                  </div>
                  <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        stats.usage_percentage > 80 ? 'bg-red-500' : 'bg-brand-500'
                      }`}
                      style={{ width: `${stats.usage_percentage}%` }}
                    />
                  </div>
                </div>
                <div className="text-sm text-slate-500">
                  {stats.total_documents} docs | {stats.total_folders} carpetas
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ===================== MODALS ===================== */}

      {/* Folder Modal */}
      {isFolderModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50" onClick={() => setIsFolderModalOpen(false)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h3 className="text-lg font-semibold text-slate-800">
                {editingFolder ? 'Editar Carpeta' : 'Nueva Carpeta'}
              </h3>
              <button
                onClick={() => setIsFolderModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nombre *</label>
                <input
                  type="text"
                  value={folderForm.name}
                  onChange={(e) => setFolderForm({ ...folderForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none"
                  placeholder="Nombre de la carpeta"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Descripcion</label>
                <textarea
                  value={folderForm.description}
                  onChange={(e) => setFolderForm({ ...folderForm, description: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none"
                  rows={2}
                  placeholder="Descripcion opcional"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Color</label>
                <div className="flex gap-2 flex-wrap">
                  {FOLDER_COLORS.map((color) => (
                    <button
                      key={color}
                      onClick={() => setFolderForm({ ...folderForm, color })}
                      className={`w-8 h-8 rounded-lg transition ${
                        folderForm.color === color ? 'ring-2 ring-offset-2 ring-brand-500' : ''
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t bg-slate-50">
              <button
                onClick={() => setIsFolderModalOpen(false)}
                className="px-4 py-2 text-slate-600 hover:text-slate-800"
              >
                Cancelar
              </button>
              <button
                onClick={handleFolderSubmit}
                disabled={isSubmitting || !folderForm.name.trim()}
                className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg disabled:opacity-50 flex items-center gap-2"
              >
                {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                {editingFolder ? 'Guardar' : 'Crear'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload Modal */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50" onClick={() => setIsUploadModalOpen(false)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h3 className="text-lg font-semibold text-slate-800">Subir Archivo</h3>
              <button
                onClick={() => setIsUploadModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* File drop zone */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-200 rounded-lg p-8 text-center cursor-pointer hover:border-brand-400 transition"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                {uploadFile ? (
                  <div className="flex flex-col items-center">
                    <FileIcon mimeType={uploadFile.type} size="lg" />
                    <p className="mt-2 font-medium text-slate-800">{uploadFile.name}</p>
                    <p className="text-sm text-slate-500">{formatFileSize(uploadFile.size)}</p>
                  </div>
                ) : (
                  <>
                    <Upload className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                    <p className="text-slate-600">Haz clic para seleccionar un archivo</p>
                    <p className="text-sm text-slate-400 mt-1">PDF, Word, Excel, Imagenes</p>
                  </>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nombre *</label>
                <input
                  type="text"
                  value={uploadName}
                  onChange={(e) => setUploadName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none"
                  placeholder="Nombre del documento"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Descripcion</label>
                <textarea
                  value={uploadDescription}
                  onChange={(e) => setUploadDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none"
                  rows={2}
                  placeholder="Descripcion opcional"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t bg-slate-50">
              <button
                onClick={() => {
                  setIsUploadModalOpen(false);
                  setUploadFile(null);
                  setUploadName('');
                  setUploadDescription('');
                }}
                className="px-4 py-2 text-slate-600 hover:text-slate-800"
              >
                Cancelar
              </button>
              <button
                onClick={handleUpload}
                disabled={isSubmitting || !uploadFile || !uploadName.trim()}
                className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg disabled:opacity-50 flex items-center gap-2"
              >
                {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                Subir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50" onClick={() => setDeleteConfirm(null)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-2">
              Eliminar {deleteConfirm.type === 'folder' ? 'carpeta' : 'documento'}
            </h3>
            <p className="text-slate-600 mb-4">
              ¿Estas seguro de eliminar &quot;{deleteConfirm.name}&quot;?
              {deleteConfirm.type === 'document' && ' El archivo sera eliminado permanentemente.'}
            </p>
            <div className="flex justify-end gap-2">
              <button
                className="px-4 py-2 text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200"
                onClick={() => setDeleteConfirm(null)}
                disabled={isSubmitting}
              >
                Cancelar
              </button>
              <button
                className="px-4 py-2 text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
                onClick={confirmDelete}
                disabled={isSubmitting}
              >
                {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Context menu for folders */}
      {contextMenu && contextMenu.type === 'folder' && (
        <div className="fixed inset-0 z-50" onClick={() => setContextMenu(null)}>
          <div
            className="absolute bg-white rounded-lg shadow-xl border border-slate-200 py-1 w-40"
            style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}
          >
            <button
              onClick={() => {
                handleEditFolder(contextMenu.item);
                setContextMenu(null);
              }}
              className="flex items-center gap-2 w-full px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
            >
              <Pencil className="w-4 h-4" />
              Editar
            </button>
            <button
              onClick={() => {
                handleCreateFolder(contextMenu.item.id);
                setContextMenu(null);
              }}
              className="flex items-center gap-2 w-full px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
            >
              <FolderPlus className="w-4 h-4" />
              Nueva subcarpeta
            </button>
            <button
              onClick={() => {
                setDeleteConfirm({
                  type: 'folder',
                  id: contextMenu.item.id,
                  name: contextMenu.item.name,
                });
                setContextMenu(null);
              }}
              className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50"
            >
              <Trash2 className="w-4 h-4" />
              Eliminar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
