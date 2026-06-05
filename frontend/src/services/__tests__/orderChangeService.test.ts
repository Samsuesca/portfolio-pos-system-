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

import { orderChangeService } from '../orderChangeService';

const schoolId = 'school-1';
const orderId = 'order-1';
const changeId = 'change-1';

const mockChange = { id: changeId, status: 'pending', change_type: 'size_change' };

describe('orderChangeService', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  describe('getAllChanges', () => {
    it('fetches without filters', async () => {
      (apiMock.get as Mock).mockResolvedValue({ data: paginatedOf([mockChange]) });
      const result = await orderChangeService.getAllChanges();
      expect(apiMock.get).toHaveBeenCalledWith('/order-changes');
      expect(result.items).toEqual([mockChange]);
    });

    it('appends query params from filters', async () => {
      (apiMock.get as Mock).mockResolvedValue({ data: paginatedOf([]) });
      await orderChangeService.getAllChanges({ status: 'approved', change_type: 'return', limit: 10 });
      const url = (apiMock.get as Mock).mock.calls[0][0] as string;
      expect(url).toContain('status=approved');
      expect(url).toContain('change_type=return');
      expect(url).toContain('limit=10');
    });

    it('wraps plain array response via unwrapPaginated', async () => {
      (apiMock.get as Mock).mockResolvedValue({ data: [mockChange] });
      const result = await orderChangeService.getAllChanges();
      expect(result.items).toEqual([mockChange]);
      expect(result.total).toBe(1);
      expect(result.has_more).toBe(false);
    });

    it('propagates errors', async () => {
      (apiMock.get as Mock).mockRejectedValue(new Error('Network error'));
      await expect(orderChangeService.getAllChanges()).rejects.toThrow('Network error');
    });
  });

  describe('createChange', () => {
    it('posts to the correct URL', async () => {
      const data = { change_type: 'size_change', items: [] };
      (apiMock.post as Mock).mockResolvedValue({ data: mockChange });
      const result = await orderChangeService.createChange(schoolId, orderId, data as never);
      expect(apiMock.post).toHaveBeenCalledWith(
        `/schools/${schoolId}/orders/${orderId}/changes`,
        data
      );
      expect(result).toEqual(mockChange);
    });
  });

  describe('getOrderChanges', () => {
    it('fetches changes for a specific order', async () => {
      (apiMock.get as Mock).mockResolvedValue({ data: [mockChange] });
      const result = await orderChangeService.getOrderChanges(schoolId, orderId);
      expect(apiMock.get).toHaveBeenCalledWith(`/schools/${schoolId}/orders/${orderId}/changes`);
      expect(result).toEqual([mockChange]);
    });
  });

  describe('approveChange', () => {
    it('patches with payment method when provided', async () => {
      (apiMock.patch as Mock).mockResolvedValue({ data: mockChange });
      await orderChangeService.approveChange(schoolId, orderId, changeId, 'cash');
      expect(apiMock.patch).toHaveBeenCalledWith(
        `/schools/${schoolId}/orders/${orderId}/changes/${changeId}/approve`,
        { payment_method: 'cash' }
      );
    });

    it('patches with undefined body when no payment method', async () => {
      (apiMock.patch as Mock).mockResolvedValue({ data: mockChange });
      await orderChangeService.approveChange(schoolId, orderId, changeId);
      expect(apiMock.patch).toHaveBeenCalledWith(
        `/schools/${schoolId}/orders/${orderId}/changes/${changeId}/approve`,
        undefined
      );
    });
  });

  describe('rejectChange', () => {
    it('patches with rejection reason', async () => {
      (apiMock.patch as Mock).mockResolvedValue({ data: mockChange });
      await orderChangeService.rejectChange(schoolId, orderId, changeId, 'Out of stock');
      expect(apiMock.patch).toHaveBeenCalledWith(
        `/schools/${schoolId}/orders/${orderId}/changes/${changeId}/reject`,
        { rejection_reason: 'Out of stock' }
      );
    });
  });
});
