/**
 * Document Types - Types for enterprise document management
 */

// ======================
// Folder Types
// ======================

export interface DocumentFolder {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  icon: string | null;
  parent_id: string | null;
  order_index: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  children_count: number;
  documents_count: number;
}

export interface DocumentFolderCreate {
  name: string;
  description?: string | null;
  color?: string | null;
  icon?: string | null;
  parent_id?: string | null;
  order_index?: number;
}

export interface DocumentFolderUpdate {
  name?: string;
  description?: string | null;
  color?: string | null;
  icon?: string | null;
  parent_id?: string | null;
  order_index?: number;
}

// Folder with nested children for tree view
export interface DocumentFolderTree extends DocumentFolder {
  children: DocumentFolderTree[];
}

// ======================
// Document Types
// ======================

export interface BusinessDocument {
  id: string;
  name: string;
  description: string | null;
  folder_id: string | null;
  file_path: string;
  original_filename: string;
  file_size: number;
  mime_type: string;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface BusinessDocumentListItem {
  id: string;
  name: string;
  original_filename: string;
  file_size: number;
  mime_type: string;
  folder_id: string | null;
  created_at: string;
}

export interface BusinessDocumentCreate {
  name: string;
  description?: string | null;
  folder_id?: string | null;
}

export interface BusinessDocumentUpdate {
  name?: string;
  description?: string | null;
  folder_id?: string | null;
}

// ======================
// Storage Stats
// ======================

export interface DocumentStorageStats {
  total_documents: number;
  total_folders: number;
  total_size_bytes: number;
  max_size_bytes: number;
  usage_percentage: number;
}

// ======================
// Helper Functions
// ======================

/**
 * Format file size to human-readable string
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${units[i]}`;
}

/**
 * Get file type icon based on MIME type
 */
export function getFileIcon(mimeType: string): string {
  if (mimeType === 'application/pdf') return 'file-text';
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return 'file-spreadsheet';
  if (mimeType.includes('word') || mimeType.includes('document')) return 'file-text';
  return 'file';
}

/**
 * Get file type display name based on MIME type
 */
export function getFileTypeName(mimeType: string): string {
  const types: Record<string, string> = {
    'application/pdf': 'PDF',
    'image/png': 'PNG',
    'image/jpeg': 'JPEG',
    'image/jpg': 'JPG',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'Excel',
    'application/vnd.ms-excel': 'Excel',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word',
    'application/msword': 'Word',
  };
  return types[mimeType] || 'Archivo';
}

/**
 * Check if a MIME type is an image
 */
export function isImageMimeType(mimeType: string): boolean {
  return mimeType.startsWith('image/');
}

/**
 * Check if a MIME type is a PDF
 */
export function isPdfMimeType(mimeType: string): boolean {
  return mimeType === 'application/pdf';
}

/**
 * Build folder tree from flat list
 */
export function buildFolderTree(folders: DocumentFolder[]): DocumentFolderTree[] {
  const folderMap = new Map<string, DocumentFolderTree>();
  const rootFolders: DocumentFolderTree[] = [];

  // Create map of folders with empty children arrays
  folders.forEach(folder => {
    folderMap.set(folder.id, { ...folder, children: [] });
  });

  // Build tree structure
  folders.forEach(folder => {
    const treeFolder = folderMap.get(folder.id)!;
    if (folder.parent_id && folderMap.has(folder.parent_id)) {
      folderMap.get(folder.parent_id)!.children.push(treeFolder);
    } else {
      rootFolders.push(treeFolder);
    }
  });

  // Sort children by order_index and name
  const sortFolders = (folders: DocumentFolderTree[]) => {
    folders.sort((a, b) => {
      if (a.order_index !== b.order_index) return a.order_index - b.order_index;
      return a.name.localeCompare(b.name);
    });
    folders.forEach(folder => sortFolders(folder.children));
  };

  sortFolders(rootFolders);
  return rootFolders;
}

/**
 * Get folder path (breadcrumb) from root to folder
 */
export function getFolderPath(folders: DocumentFolder[], folderId: string | null): DocumentFolder[] {
  if (!folderId) return [];

  const path: DocumentFolder[] = [];
  let currentId: string | null = folderId;

  while (currentId) {
    const folder = folders.find(f => f.id === currentId);
    if (folder) {
      path.unshift(folder);
      currentId = folder.parent_id;
    } else {
      break;
    }
  }

  return path;
}

// Default colors for folder icons
export const FOLDER_COLORS = [
  '#3B82F6', // Blue
  '#10B981', // Green
  '#F59E0B', // Amber
  '#EF4444', // Red
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#06B6D4', // Cyan
  '#84CC16', // Lime
];

// Folder icons options
export const FOLDER_ICONS = [
  { value: 'folder', label: 'Carpeta' },
  { value: 'folder-open', label: 'Carpeta abierta' },
  { value: 'file-text', label: 'Documento' },
  { value: 'scale', label: 'Legal' },
  { value: 'dollar-sign', label: 'Precios' },
  { value: 'qr-code', label: 'QR' },
  { value: 'megaphone', label: 'Marketing' },
  { value: 'settings', label: 'Configuración' },
];
