/**
 * Document Service - API calls for enterprise document management
 * Only accessible by superusers.
 */
import apiClient from '../api';

const BASE_URL = '/documents';

// ======================
// Types
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

export interface DocumentFolderTree extends DocumentFolder {
  children: DocumentFolderTree[];
}

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

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${units[i]}`;
}

export function getFileIcon(mimeType: string): string {
  if (mimeType === 'application/pdf') return 'file-text';
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return 'file-spreadsheet';
  if (mimeType.includes('word') || mimeType.includes('document')) return 'file-text';
  return 'file';
}

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

export function buildFolderTree(folders: DocumentFolder[]): DocumentFolderTree[] {
  const folderMap = new Map<string, DocumentFolderTree>();
  const rootFolders: DocumentFolderTree[] = [];

  folders.forEach(folder => {
    folderMap.set(folder.id, { ...folder, children: [] });
  });

  folders.forEach(folder => {
    const treeFolder = folderMap.get(folder.id)!;
    if (folder.parent_id && folderMap.has(folder.parent_id)) {
      folderMap.get(folder.parent_id)!.children.push(treeFolder);
    } else {
      rootFolders.push(treeFolder);
    }
  });

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

// ======================
// API Functions
// ======================

const documentService = {
  // Folder Operations
  getFolders: async (): Promise<DocumentFolder[]> => {
    const response = await apiClient.get<DocumentFolder[]>(`${BASE_URL}/folders`);
    return response.data;
  },

  getFolder: async (folderId: string): Promise<DocumentFolder> => {
    const response = await apiClient.get<DocumentFolder>(`${BASE_URL}/folders/${folderId}`);
    return response.data;
  },

  createFolder: async (data: DocumentFolderCreate): Promise<DocumentFolder> => {
    const response = await apiClient.post<DocumentFolder>(`${BASE_URL}/folders`, data);
    return response.data;
  },

  updateFolder: async (folderId: string, data: DocumentFolderUpdate): Promise<DocumentFolder> => {
    const response = await apiClient.put<DocumentFolder>(`${BASE_URL}/folders/${folderId}`, data);
    return response.data;
  },

  deleteFolder: async (folderId: string): Promise<void> => {
    await apiClient.delete(`${BASE_URL}/folders/${folderId}`);
  },

  // Document Operations
  getDocuments: async (params?: {
    folder_id?: string | null;
    search?: string;
    skip?: number;
    limit?: number;
  }): Promise<BusinessDocumentListItem[]> => {
    const searchParams = new URLSearchParams();

    if (params?.folder_id) {
      searchParams.append('folder_id', params.folder_id);
    }
    if (params?.search) {
      searchParams.append('search', params.search);
    }
    if (params?.skip !== undefined) {
      searchParams.append('skip', String(params.skip));
    }
    if (params?.limit !== undefined) {
      searchParams.append('limit', String(params.limit));
    }

    const queryString = searchParams.toString();
    const url = queryString ? `${BASE_URL}?${queryString}` : BASE_URL;

    const response = await apiClient.get<BusinessDocumentListItem[]>(url);
    return response.data;
  },

  getDocument: async (documentId: string): Promise<BusinessDocument> => {
    const response = await apiClient.get<BusinessDocument>(`${BASE_URL}/${documentId}`);
    return response.data;
  },

  uploadDocument: async (
    file: File,
    data: {
      name: string;
      description?: string | null;
      folder_id?: string | null;
    }
  ): Promise<BusinessDocument> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('name', data.name);

    if (data.description) {
      formData.append('description', data.description);
    }
    if (data.folder_id) {
      formData.append('folder_id', data.folder_id);
    }

    const response = await apiClient.post<BusinessDocument>(BASE_URL, formData);
    return response.data;
  },

  updateDocument: async (
    documentId: string,
    data: {
      name?: string;
      description?: string | null;
      folder_id?: string | null;
    },
    newFile?: File
  ): Promise<BusinessDocument> => {
    const formData = new FormData();

    if (data.name !== undefined) {
      formData.append('name', data.name);
    }
    if (data.description !== undefined) {
      formData.append('description', data.description || '');
    }
    if (data.folder_id !== undefined) {
      formData.append('folder_id', data.folder_id || '');
    }
    if (newFile) {
      formData.append('file', newFile);
    }

    const response = await apiClient.put<BusinessDocument>(`${BASE_URL}/${documentId}`, formData);
    return response.data;
  },

  deleteDocument: async (documentId: string, hardDelete: boolean = false): Promise<void> => {
    await apiClient.delete(`${BASE_URL}/${documentId}?hard_delete=${hardDelete}`);
  },

  getDownloadUrl: (documentId: string): string => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
    return `${apiUrl}/api/v1${BASE_URL}/${documentId}/download`;
  },

  downloadDocument: async (documentId: string, filename: string): Promise<void> => {
    const url = documentService.getDownloadUrl(documentId);
    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': token ? `Bearer ${token}` : '',
      },
    });

    if (!response.ok) {
      throw new Error(`Download failed: ${response.status}`);
    }

    const blob = await response.blob();

    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(downloadUrl);
  },

  // Stats
  getStorageStats: async (): Promise<DocumentStorageStats> => {
    const response = await apiClient.get<DocumentStorageStats>(`${BASE_URL}/stats`);
    return response.data;
  },
};

export default documentService;
