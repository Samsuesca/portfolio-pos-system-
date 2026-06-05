import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import apiClient from '../../utils/api-client';
import { schoolService } from '../schoolService';
import type { School, SchoolSummary } from '../schoolService';
import type { PaginatedResponse } from '../../types/api';

vi.mock('../../utils/api-client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

const apiMock = vi.mocked(apiClient);

function paginatedOf<T>(items: T[]): PaginatedResponse<T> {
  return { items, total: items.length, skip: 0, limit: 100, page: 1, total_pages: 1, has_more: false };
}

const mockSchool: School = {
  id: 'school-1',
  code: 'COL1',
  name: 'Colegio Test',
  slug: 'col1',
  email: 'colegio@test.com',
  phone: '3001234567',
  address: 'Calle 123',
  logo_url: null,
  primary_color: '#1E40AF',
  secondary_color: null,
  settings: null,
  is_active: true,
  created_at: '2026-01-01T00:00:00',
  updated_at: null,
};

describe('schoolService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getSchools', () => {
    it('fetches active schools by default', async () => {
      (apiMock.get as Mock).mockResolvedValueOnce({ data: paginatedOf([mockSchool]) });

      const result = await schoolService.getSchools();

      expect(apiMock.get).toHaveBeenCalledWith('/schools', { params: { active_only: true } });
      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('can fetch all schools including inactive', async () => {
      (apiMock.get as Mock).mockResolvedValueOnce({ data: paginatedOf([]) });

      await schoolService.getSchools(false);

      expect(apiMock.get).toHaveBeenCalledWith('/schools', { params: { active_only: false } });
    });

    it('wraps legacy array response into PaginatedResponse', async () => {
      (apiMock.get as Mock).mockResolvedValueOnce({ data: [mockSchool] });

      const result = await schoolService.getSchools();

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.has_more).toBe(false);
    });
  });

  describe('getSchool', () => {
    it('fetches a single school by ID', async () => {
      (apiMock.get as Mock).mockResolvedValueOnce({ data: mockSchool });

      const result = await schoolService.getSchool('school-1');

      expect(apiMock.get).toHaveBeenCalledWith('/schools/school-1');
      expect(result.id).toBe('school-1');
    });
  });

  describe('getSchoolSummary', () => {
    it('fetches school summary with stats', async () => {
      const summary: SchoolSummary = {
        ...mockSchool,
        products_count: 50,
        sales_count: 120,
        orders_count: 30,
        clients_count: 80,
      };
      (apiMock.get as Mock).mockResolvedValueOnce({ data: summary });

      const result = await schoolService.getSchoolSummary('school-1');

      expect(apiMock.get).toHaveBeenCalledWith('/schools/school-1/summary');
      expect(result.products_count).toBe(50);
      expect(result.clients_count).toBe(80);
    });
  });

  describe('searchSchools', () => {
    it('searches by name with default limit', async () => {
      (apiMock.get as Mock).mockResolvedValueOnce({ data: paginatedOf([mockSchool]) });

      const result = await schoolService.searchSchools('Colegio');

      expect(apiMock.get).toHaveBeenCalledWith('/schools/search/by-name', {
        params: { name: 'Colegio', limit: 10 }
      });
      expect(result.items[0].name).toBe('Colegio Test');
    });

    it('uses custom limit', async () => {
      (apiMock.get as Mock).mockResolvedValueOnce({ data: paginatedOf([]) });

      await schoolService.searchSchools('Test', 5);

      expect(apiMock.get).toHaveBeenCalledWith('/schools/search/by-name', {
        params: { name: 'Test', limit: 5 }
      });
    });
  });

  describe('createSchool', () => {
    it('posts new school data', async () => {
      (apiMock.post as Mock).mockResolvedValueOnce({ data: mockSchool });

      const schoolData = { code: 'COL1', name: 'Colegio Test' };
      const result = await schoolService.createSchool(schoolData);

      expect(apiMock.post).toHaveBeenCalledWith('/schools', schoolData);
      expect(result.id).toBe('school-1');
    });
  });

  describe('updateSchool', () => {
    it('puts updated school data', async () => {
      const updated = { ...mockSchool, name: 'Colegio Actualizado' };
      (apiMock.put as Mock).mockResolvedValueOnce({ data: updated });

      const result = await schoolService.updateSchool('school-1', { name: 'Colegio Actualizado' });

      expect(apiMock.put).toHaveBeenCalledWith('/schools/school-1', { name: 'Colegio Actualizado' });
      expect(result.name).toBe('Colegio Actualizado');
    });
  });

  describe('deleteSchool', () => {
    it('deletes (deactivates) a school', async () => {
      (apiMock.delete as Mock).mockResolvedValueOnce({ data: undefined });

      await schoolService.deleteSchool('school-1');

      expect(apiMock.delete).toHaveBeenCalledWith('/schools/school-1');
    });
  });

  describe('activateSchool', () => {
    it('posts to activate endpoint', async () => {
      const activated = { ...mockSchool, is_active: true };
      (apiMock.post as Mock).mockResolvedValueOnce({ data: activated });

      const result = await schoolService.activateSchool('school-1');

      expect(apiMock.post).toHaveBeenCalledWith('/schools/school-1/activate');
      expect(result.is_active).toBe(true);
    });
  });

  describe('deleteLogo', () => {
    it('deletes school logo', async () => {
      (apiMock.delete as Mock).mockResolvedValueOnce({ data: undefined });

      await schoolService.deleteLogo('school-1');

      expect(apiMock.delete).toHaveBeenCalledWith('/schools/school-1/logo');
    });
  });

  describe('error propagation', () => {
    it('propagates errors from getSchools', async () => {
      (apiMock.get as Mock).mockRejectedValueOnce(new Error('Network Error'));

      await expect(schoolService.getSchools()).rejects.toThrow('Network Error');
    });

    it('propagates errors from getSchool', async () => {
      (apiMock.get as Mock).mockRejectedValueOnce(new Error('HTTP 404'));

      await expect(schoolService.getSchool('nonexistent')).rejects.toThrow('HTTP 404');
    });
  });
});
