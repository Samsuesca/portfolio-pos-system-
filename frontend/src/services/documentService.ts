/**
 * Document Service - API calls for enterprise document management
 *
 * Only accessible by superusers.
 * Endpoints: /api/v1/documents
 */
import apiClient from '../utils/api-client';
import { useConfigStore } from '../stores/configStore';
import type {
  DocumentFolder,
  DocumentFolderCreate,
  DocumentFolderUpdate,
  BusinessDocument,
  BusinessDocumentListItem,
  DocumentStorageStats,
} from '../types/document';

const BASE_URL = '/documents';

export const documentService = {
  // ======================
  // Folder Operations
  // ======================

  /**
   * Get all folders (flat list)
   */
  async getFolders(): Promise<DocumentFolder[]> {
    const response = await apiClient.get<DocumentFolder[]>(`${BASE_URL}/folders`);
    return response.data;
  },

  /**
   * Get a single folder by ID
   */
  async getFolder(folderId: string): Promise<DocumentFolder> {
    const response = await apiClient.get<DocumentFolder>(`${BASE_URL}/folders/${folderId}`);
    return response.data;
  },

  /**
   * Create a new folder
   */
  async createFolder(data: DocumentFolderCreate): Promise<DocumentFolder> {
    const response = await apiClient.post<DocumentFolder>(`${BASE_URL}/folders`, data);
    return response.data;
  },

  /**
   * Update a folder
   */
  async updateFolder(folderId: string, data: DocumentFolderUpdate): Promise<DocumentFolder> {
    const response = await apiClient.put<DocumentFolder>(`${BASE_URL}/folders/${folderId}`, data);
    return response.data;
  },

  /**
   * Delete a folder (must be empty)
   */
  async deleteFolder(folderId: string): Promise<void> {
    await apiClient.delete(`${BASE_URL}/folders/${folderId}`);
  },

  // ======================
  // Document Operations
  // ======================

  /**
   * Get documents with optional filtering
   */
  async getDocuments(params?: {
    folder_id?: string | null;
    search?: string;
    skip?: number;
    limit?: number;
  }): Promise<BusinessDocumentListItem[]> {
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

  /**
   * Get a single document by ID
   */
  async getDocument(documentId: string): Promise<BusinessDocument> {
    const response = await apiClient.get<BusinessDocument>(`${BASE_URL}/${documentId}`);
    return response.data;
  },

  /**
   * Upload a new document
   */
  async uploadDocument(
    file: File,
    data: {
      name: string;
      description?: string | null;
      folder_id?: string | null;
    }
  ): Promise<BusinessDocument> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('name', data.name);

    if (data.description) {
      formData.append('description', data.description);
    }
    if (data.folder_id) {
      formData.append('folder_id', data.folder_id);
    }

    // Don't set Content-Type manually - let axios/browser set it with proper boundary
    const response = await apiClient.post<BusinessDocument>(BASE_URL, formData);
    return response.data;
  },

  /**
   * Update document metadata (optionally replace file)
   */
  async updateDocument(
    documentId: string,
    data: {
      name?: string;
      description?: string | null;
      folder_id?: string | null;
    },
    newFile?: File
  ): Promise<BusinessDocument> {
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

    // Don't set Content-Type manually - let axios/browser set it with proper boundary
    const response = await apiClient.put<BusinessDocument>(
      `${BASE_URL}/${documentId}`,
      formData
    );
    return response.data;
  },

  /**
   * Delete a document
   * @param hardDelete - If true, permanently deletes the file
   */
  async deleteDocument(documentId: string, hardDelete: boolean = false): Promise<void> {
    await apiClient.delete(`${BASE_URL}/${documentId}?hard_delete=${hardDelete}`);
  },

  /**
   * Get document download URL
   */
  getDownloadUrl(documentId: string): string {
    const apiUrl = useConfigStore.getState().apiUrl;
    return `${apiUrl}/api/v1${BASE_URL}/${documentId}/download`;
  },

  /**
   * Download document file
   * Note: Uses fetch directly since apiClient doesn't support blob responses
   */
  async downloadDocument(documentId: string, filename: string): Promise<void> {
    const url = this.getDownloadUrl(documentId);
    const token = localStorage.getItem('access_token');

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

    // Create blob link and trigger download
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(downloadUrl);
  },

  // ======================
  // Stats
  // ======================

  /**
   * Get storage statistics
   */
  async getStorageStats(): Promise<DocumentStorageStats> {
    const response = await apiClient.get<DocumentStorageStats>(`${BASE_URL}/stats`);
    return response.data;
  },
};
