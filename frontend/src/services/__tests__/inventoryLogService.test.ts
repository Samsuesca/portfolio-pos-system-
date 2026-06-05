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

import inventoryLogService, { getMovementTypeInfo, isStockIn } from '../inventoryLogService';

const schoolId = 'school-1';
const productId = 'product-1';

const mockLog = {
  id: 'log-1',
  inventory_id: 'inv-1',
  global_inventory_id: null,
  school_id: schoolId,
  movement_type: 'sale',
  movement_date: '2026-01-15',
  quantity_delta: -2,
  quantity_after: 10,
  description: 'Venta',
  reference: null,
  sale_id: 'sale-1',
  order_id: null,
  sale_change_id: null,
  created_by: 'user-1',
  created_at: '2026-01-15T10:00:00',
};

describe('inventoryLogService', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  describe('getSchoolLogs', () => {
    it('fetches without filters', async () => {
      const response = { items: [mockLog], total: 1, skip: 0, limit: 100 };
      (apiMock.get as Mock).mockResolvedValue({ data: response });
      const result = await inventoryLogService.getSchoolLogs(schoolId);
      expect(apiMock.get).toHaveBeenCalledWith(`/schools/${schoolId}/inventory-logs`);
      expect(result).toEqual(response);
    });

    it('appends query params from filters', async () => {
      (apiMock.get as Mock).mockResolvedValue({ data: { items: [], total: 0, skip: 0, limit: 50 } });
      await inventoryLogService.getSchoolLogs(schoolId, {
        start_date: '2026-01-01',
        end_date: '2026-01-31',
        movement_type: 'sale',
        skip: 10,
        limit: 50,
      });
      const url = (apiMock.get as Mock).mock.calls[0][0] as string;
      expect(url).toContain('start_date=2026-01-01');
      expect(url).toContain('end_date=2026-01-31');
      expect(url).toContain('movement_type=sale');
      expect(url).toContain('skip=10');
      expect(url).toContain('limit=50');
    });

    it('handles skip=0 correctly', async () => {
      (apiMock.get as Mock).mockResolvedValue({ data: { items: [], total: 0, skip: 0, limit: 100 } });
      await inventoryLogService.getSchoolLogs(schoolId, { skip: 0 });
      const url = (apiMock.get as Mock).mock.calls[0][0] as string;
      expect(url).toContain('skip=0');
    });

    it('propagates errors', async () => {
      (apiMock.get as Mock).mockRejectedValue(new Error('Timeout'));
      await expect(inventoryLogService.getSchoolLogs(schoolId)).rejects.toThrow('Timeout');
    });
  });

  describe('getProductLogs', () => {
    it('fetches with default limit', async () => {
      (apiMock.get as Mock).mockResolvedValue({ data: paginatedOf([mockLog]) });
      const result = await inventoryLogService.getProductLogs(schoolId, productId);
      expect(apiMock.get).toHaveBeenCalledWith(
        `/schools/${schoolId}/inventory/${productId}/logs?limit=50`
      );
      expect(result.items).toEqual([mockLog]);
    });

    it('fetches with custom limit', async () => {
      (apiMock.get as Mock).mockResolvedValue({ data: paginatedOf([]) });
      await inventoryLogService.getProductLogs(schoolId, productId, 20);
      expect(apiMock.get).toHaveBeenCalledWith(
        `/schools/${schoolId}/inventory/${productId}/logs?limit=20`
      );
    });

    it('wraps plain array response via unwrapPaginated', async () => {
      (apiMock.get as Mock).mockResolvedValue({ data: [mockLog] });
      const result = await inventoryLogService.getProductLogs(schoolId, productId);
      expect(result.items).toEqual([mockLog]);
      expect(result.total).toBe(1);
      expect(result.has_more).toBe(false);
    });
  });

  describe('getGlobalProductLogs', () => {
    it('fetches with default limit', async () => {
      (apiMock.get as Mock).mockResolvedValue({ data: paginatedOf([mockLog]) });
      const result = await inventoryLogService.getGlobalProductLogs(productId);
      expect(apiMock.get).toHaveBeenCalledWith(
        `/global/inventory/${productId}/logs?limit=50`
      );
      expect(result.items).toEqual([mockLog]);
    });

    it('fetches with custom limit', async () => {
      (apiMock.get as Mock).mockResolvedValue({ data: paginatedOf([]) });
      await inventoryLogService.getGlobalProductLogs(productId, 100);
      expect(apiMock.get).toHaveBeenCalledWith(
        `/global/inventory/${productId}/logs?limit=100`
      );
    });

    it('wraps plain array response via unwrapPaginated', async () => {
      (apiMock.get as Mock).mockResolvedValue({ data: [mockLog] });
      const result = await inventoryLogService.getGlobalProductLogs(productId);
      expect(result.items).toEqual([mockLog]);
      expect(result.total).toBe(1);
    });
  });
});

describe('getMovementTypeInfo', () => {
  it('returns correct info for known types', () => {
    expect(getMovementTypeInfo('sale')).toEqual({
      label: 'Venta',
      color: 'text-red-700',
      bgColor: 'bg-red-100',
    });
    expect(getMovementTypeInfo('purchase')).toEqual({
      label: 'Compra',
      color: 'text-green-700',
      bgColor: 'bg-green-100',
    });
  });

  it('returns fallback for unknown types', () => {
    const result = getMovementTypeInfo('unknown_type');
    expect(result).toEqual({
      label: 'unknown_type',
      color: 'text-stone-700',
      bgColor: 'bg-stone-100',
    });
  });
});

describe('isStockIn', () => {
  it('returns true for stock-in movement types', () => {
    const stockInTypes = ['sale_cancel', 'order_cancel', 'change_return', 'adjustment_in', 'purchase', 'initial'];
    for (const type of stockInTypes) {
      expect(isStockIn(type)).toBe(true);
    }
  });

  it('returns false for stock-out movement types', () => {
    const stockOutTypes = ['sale', 'order_reserve', 'order_deliver', 'change_out', 'adjustment_out'];
    for (const type of stockOutTypes) {
      expect(isStockIn(type)).toBe(false);
    }
  });

  it('returns false for unknown types', () => {
    expect(isStockIn('random')).toBe(false);
  });
});
