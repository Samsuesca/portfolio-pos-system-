import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import apiClient from '../../utils/api-client';

vi.mock('../../utils/api-client', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

const apiMock = vi.mocked(apiClient);

function paginatedOf<T>(items: T[]): {
  items: T[];
  total: number;
  skip: number;
  limit: number;
  page: number;
  total_pages: number;
  has_more: boolean;
} {
  return { items, total: items.length, skip: 0, limit: 100, page: 1, total_pages: 1, has_more: false };
}

import { saleChangeService } from '../saleChangeService';

const schoolId = 'school-1';
const saleId = 'sale-1';
const changeId = 'change-1';

const mockChange = { id: changeId, status: 'pending', change_type: 'return' };

describe('saleChangeService', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  describe('getAllChanges', () => {
    it('fetches without filters', async () => {
      (apiMock.get as Mock).mockResolvedValue({ data: paginatedOf([mockChange]) });
      const result = await saleChangeService.getAllChanges();
      expect(apiMock.get).toHaveBeenCalledWith('/sale-changes');
      expect(result.items).toEqual([mockChange]);
    });

    it('appends query params from filters', async () => {
      (apiMock.get as Mock).mockResolvedValue({ data: paginatedOf([]) });
      await saleChangeService.getAllChanges({ status: 'rejected', change_type: 'defect', limit: 25 });
      const url = (apiMock.get as Mock).mock.calls[0][0] as string;
      expect(url).toContain('status=rejected');
      expect(url).toContain('change_type=defect');
      expect(url).toContain('limit=25');
    });

    it('wraps plain array response via unwrapPaginated', async () => {
      (apiMock.get as Mock).mockResolvedValue({ data: [mockChange] });
      const result = await saleChangeService.getAllChanges();
      expect(result.items).toEqual([mockChange]);
      expect(result.total).toBe(1);
      expect(result.has_more).toBe(false);
    });

    it('propagates errors', async () => {
      (apiMock.get as Mock).mockRejectedValue(new Error('Server error'));
      await expect(saleChangeService.getAllChanges()).rejects.toThrow('Server error');
    });
  });

  describe('createChange', () => {
    it('posts to the correct URL', async () => {
      const data = { change_type: 'return', items: [] };
      (apiMock.post as Mock).mockResolvedValue({ data: mockChange });
      const result = await saleChangeService.createChange(schoolId, saleId, data as never);
      expect(apiMock.post).toHaveBeenCalledWith(
        `/schools/${schoolId}/sales/${saleId}/changes`,
        data
      );
      expect(result).toEqual(mockChange);
    });
  });

  describe('getSaleChanges', () => {
    it('fetches changes for a specific sale', async () => {
      (apiMock.get as Mock).mockResolvedValue({ data: [mockChange] });
      const result = await saleChangeService.getSaleChanges(schoolId, saleId);
      expect(apiMock.get).toHaveBeenCalledWith(`/schools/${schoolId}/sales/${saleId}/changes`);
      expect(result).toEqual([mockChange]);
    });
  });

  describe('approveChange', () => {
    it('patches with payment method when provided', async () => {
      (apiMock.patch as Mock).mockResolvedValue({ data: mockChange });
      await saleChangeService.approveChange(schoolId, saleId, changeId, 'nequi');
      expect(apiMock.patch).toHaveBeenCalledWith(
        `/schools/${schoolId}/sales/${saleId}/changes/${changeId}/approve`,
        { payment_method: 'nequi' }
      );
    });

    it('patches with undefined body when no payment method', async () => {
      (apiMock.patch as Mock).mockResolvedValue({ data: mockChange });
      await saleChangeService.approveChange(schoolId, saleId, changeId);
      expect(apiMock.patch).toHaveBeenCalledWith(
        `/schools/${schoolId}/sales/${saleId}/changes/${changeId}/approve`,
        undefined
      );
    });
  });

  describe('rejectChange', () => {
    it('patches with rejection reason', async () => {
      (apiMock.patch as Mock).mockResolvedValue({ data: mockChange });
      await saleChangeService.rejectChange(schoolId, saleId, changeId, 'Damaged item');
      expect(apiMock.patch).toHaveBeenCalledWith(
        `/schools/${schoolId}/sales/${saleId}/changes/${changeId}/reject`,
        { rejection_reason: 'Damaged item' }
      );
    });
  });

  describe('completeFromOrder', () => {
    it('patches the complete-from-order endpoint', async () => {
      (apiMock.patch as Mock).mockResolvedValue({ data: mockChange });
      const result = await saleChangeService.completeFromOrder(schoolId, saleId, changeId);
      expect(apiMock.patch).toHaveBeenCalledWith(
        `/schools/${schoolId}/sales/${saleId}/changes/${changeId}/complete-from-order`
      );
      expect(result).toEqual(mockChange);
    });
  });

  describe('getChangeDetails', () => {
    it('fetches details by changeId', async () => {
      const details = { id: changeId, transactions: [], inventory_movements: [] };
      (apiMock.get as Mock).mockResolvedValue({ data: details });
      const result = await saleChangeService.getChangeDetails(changeId);
      expect(apiMock.get).toHaveBeenCalledWith(`/sale-changes/${changeId}/details`);
      expect(result).toEqual(details);
    });
  });
});
