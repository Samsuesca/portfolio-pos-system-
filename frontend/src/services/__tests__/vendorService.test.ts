import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import apiClient from '../../utils/api-client';
import { vendorService } from '../vendorService';
import type { VendorListItem, VendorResponse, VendorSearchResult } from '../vendorService';
import type { PaginatedResponse } from '../../types/api';

vi.mock('../../utils/api-client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

const apiMock = vi.mocked(apiClient);

function paginatedOf<T>(items: T[]): PaginatedResponse<T> {
  return { items, total: items.length, skip: 0, limit: 100, page: 1, total_pages: 1, has_more: false };
}

const mockVendorListItem: VendorListItem = {
  id: 'v-1',
  name: 'Textiles ABC',
  type: 'business',
  is_active: true,
  is_system: false,
};

const mockVendorResponse: VendorResponse = {
  id: 'v-1',
  name: 'Textiles ABC',
  normalized_name: 'textiles abc',
  type: 'business',
  phone: '3001234567',
  email: 'contacto@abc.com',
  notes: null,
  is_system: false,
  is_active: true,
  created_by: 'user-1',
  created_at: '2026-01-01T00:00:00',
  updated_at: '2026-01-01T00:00:00',
};

describe('vendorService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getVendors', () => {
    it('fetches vendors with no params', async () => {
      (apiMock.get as Mock).mockResolvedValueOnce({ data: paginatedOf([mockVendorListItem]) });

      const result = await vendorService.getVendors();

      expect(apiMock.get).toHaveBeenCalledWith('/vendors', { params: undefined });
      expect(result.items).toEqual([mockVendorListItem]);
      expect(result.total).toBe(1);
    });

    it('passes search and pagination params', async () => {
      const params = { search: 'textil', skip: 0, limit: 20 };
      (apiMock.get as Mock).mockResolvedValueOnce({ data: paginatedOf([mockVendorListItem]) });

      await vendorService.getVendors(params);

      expect(apiMock.get).toHaveBeenCalledWith('/vendors', { params });
    });

    it('unwraps raw array response into PaginatedResponse', async () => {
      (apiMock.get as Mock).mockResolvedValueOnce({ data: [mockVendorListItem] });

      const result = await vendorService.getVendors();

      expect(result.items).toEqual([mockVendorListItem]);
      expect(result.has_more).toBe(false);
    });

    it('includes inactive vendors when requested', async () => {
      (apiMock.get as Mock).mockResolvedValueOnce({ data: paginatedOf([]) });

      await vendorService.getVendors({ include_inactive: true });

      expect(apiMock.get).toHaveBeenCalledWith('/vendors', {
        params: { include_inactive: true },
      });
    });
  });

  describe('searchVendors', () => {
    it('searches vendors with query and default limit', async () => {
      const searchResult: VendorSearchResult = { id: 'v-1', name: 'Textiles ABC', type: 'business' };
      (apiMock.get as Mock).mockResolvedValueOnce({ data: [searchResult] });

      const result = await vendorService.searchVendors('textil');

      expect(apiMock.get).toHaveBeenCalledWith('/vendors/search', {
        params: { q: 'textil', limit: 10 },
      });
      expect(result).toEqual([searchResult]);
    });

    it('searches with custom limit', async () => {
      (apiMock.get as Mock).mockResolvedValueOnce({ data: [] });

      await vendorService.searchVendors('abc', 5);

      expect(apiMock.get).toHaveBeenCalledWith('/vendors/search', {
        params: { q: 'abc', limit: 5 },
      });
    });
  });

  describe('getVendor', () => {
    it('fetches a single vendor by id', async () => {
      (apiMock.get as Mock).mockResolvedValueOnce({ data: mockVendorResponse });

      const result = await vendorService.getVendor('v-1');

      expect(apiMock.get).toHaveBeenCalledWith('/vendors/v-1');
      expect(result).toEqual(mockVendorResponse);
    });
  });

  describe('createVendor', () => {
    it('creates a vendor with required fields', async () => {
      const input = { name: 'Nuevo Proveedor' };
      (apiMock.post as Mock).mockResolvedValueOnce({ data: { ...mockVendorResponse, ...input, id: 'v-2' } });

      const result = await vendorService.createVendor(input);

      expect(apiMock.post).toHaveBeenCalledWith('/vendors', input);
      expect(result.name).toBe('Nuevo Proveedor');
    });
  });

  describe('updateVendor', () => {
    it('patches a vendor with partial data', async () => {
      const update = { name: 'Textiles XYZ', phone: '3009999999' };
      (apiMock.patch as Mock).mockResolvedValueOnce({ data: { ...mockVendorResponse, ...update } });

      const result = await vendorService.updateVendor('v-1', update);

      expect(apiMock.patch).toHaveBeenCalledWith('/vendors/v-1', update);
      expect(result.name).toBe('Textiles XYZ');
    });
  });

  describe('deactivateVendor', () => {
    it('soft-deletes a vendor via DELETE', async () => {
      const deactivated = { ...mockVendorResponse, is_active: false };
      (apiMock.delete as Mock).mockResolvedValueOnce({ data: deactivated });

      const result = await vendorService.deactivateVendor('v-1');

      expect(apiMock.delete).toHaveBeenCalledWith('/vendors/v-1');
      expect(result.is_active).toBe(false);
    });
  });

  describe('mergeVendors', () => {
    it('merges multiple source vendors into a target', async () => {
      (apiMock.post as Mock).mockResolvedValueOnce({ data: { merged: 3 } });

      const result = await vendorService.mergeVendors(['v-2', 'v-3', 'v-4'], 'v-1');

      expect(apiMock.post).toHaveBeenCalledWith('/vendors/merge', {
        source_ids: ['v-2', 'v-3', 'v-4'],
        target_id: 'v-1',
      });
      expect(result.merged).toBe(3);
    });
  });
});
