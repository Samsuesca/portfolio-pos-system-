import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import apiClient from '../../utils/api-client';
import { documentService } from '../documentService';

vi.mock('../../utils/api-client', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

vi.mock('../../stores/configStore', () => ({
  useConfigStore: { getState: () => ({ apiUrl: 'http://localhost:8001' }) },
}));

const apiMock = vi.mocked(apiClient);

const mockFolder = { id: 'f-1', name: 'Contratos', icon: 'folder', color: '#3B82F6' };
const mockDoc = { id: 'd-1', name: 'Contrato 2026', file_url: '/files/doc.pdf' };

describe('documentService', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  describe('folder operations', () => {
    it('getFolders fetches all folders', async () => {
      (apiMock.get as Mock).mockResolvedValueOnce({ data: [mockFolder] });
      const result = await documentService.getFolders();
      expect(apiMock.get).toHaveBeenCalledWith('/documents/folders');
      expect(result).toHaveLength(1);
    });

    it('getFolder fetches by ID', async () => {
      (apiMock.get as Mock).mockResolvedValueOnce({ data: mockFolder });
      const result = await documentService.getFolder('f-1');
      expect(apiMock.get).toHaveBeenCalledWith('/documents/folders/f-1');
      expect(result.id).toBe('f-1');
    });

    it('createFolder posts new folder', async () => {
      (apiMock.post as Mock).mockResolvedValueOnce({ data: mockFolder });
      await documentService.createFolder({ name: 'Contratos' } as any);
      expect(apiMock.post).toHaveBeenCalledWith('/documents/folders', { name: 'Contratos' });
    });

    it('updateFolder puts folder data', async () => {
      (apiMock.put as Mock).mockResolvedValueOnce({ data: mockFolder });
      await documentService.updateFolder('f-1', { name: 'Contratos 2026' } as any);
      expect(apiMock.put).toHaveBeenCalledWith('/documents/folders/f-1', { name: 'Contratos 2026' });
    });

    it('deleteFolder deletes by ID', async () => {
      (apiMock.delete as Mock).mockResolvedValueOnce({ data: undefined });
      await documentService.deleteFolder('f-1');
      expect(apiMock.delete).toHaveBeenCalledWith('/documents/folders/f-1');
    });
  });

  describe('document operations', () => {
    it('getDocuments fetches with no params', async () => {
      (apiMock.get as Mock).mockResolvedValueOnce({ data: [mockDoc] });
      const result = await documentService.getDocuments();
      expect(apiMock.get).toHaveBeenCalledWith('/documents');
      expect(result).toHaveLength(1);
    });

    it('getDocuments appends query params', async () => {
      (apiMock.get as Mock).mockResolvedValueOnce({ data: [] });
      await documentService.getDocuments({ folder_id: 'f-1', search: 'contrato', skip: 0, limit: 20 });
      expect(apiMock.get).toHaveBeenCalledWith('/documents?folder_id=f-1&search=contrato&skip=0&limit=20');
    });

    it('getDocument fetches by ID', async () => {
      (apiMock.get as Mock).mockResolvedValueOnce({ data: mockDoc });
      const result = await documentService.getDocument('d-1');
      expect(apiMock.get).toHaveBeenCalledWith('/documents/d-1');
      expect(result.id).toBe('d-1');
    });

    it('deleteDocument with soft delete', async () => {
      (apiMock.delete as Mock).mockResolvedValueOnce({ data: undefined });
      await documentService.deleteDocument('d-1');
      expect(apiMock.delete).toHaveBeenCalledWith('/documents/d-1?hard_delete=false');
    });

    it('deleteDocument with hard delete', async () => {
      (apiMock.delete as Mock).mockResolvedValueOnce({ data: undefined });
      await documentService.deleteDocument('d-1', true);
      expect(apiMock.delete).toHaveBeenCalledWith('/documents/d-1?hard_delete=true');
    });
  });

  describe('getDownloadUrl', () => {
    it('constructs download URL from config store', () => {
      const url = documentService.getDownloadUrl('d-1');
      expect(url).toBe('http://localhost:8001/api/v1/documents/d-1/download');
    });
  });

  describe('getStorageStats', () => {
    it('fetches storage stats', async () => {
      (apiMock.get as Mock).mockResolvedValueOnce({ data: { total_size_bytes: 1024 } });
      const result = await documentService.getStorageStats();
      expect(apiMock.get).toHaveBeenCalledWith('/documents/stats');
      expect(result.total_size_bytes).toBe(1024);
    });
  });
});
