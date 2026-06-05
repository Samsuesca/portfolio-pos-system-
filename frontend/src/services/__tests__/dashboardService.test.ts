import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import apiClient from '../../utils/api-client';
import { dashboardService } from '../dashboardService';

vi.mock('../../utils/api-client', () => ({
  default: { get: vi.fn() },
}));

const apiMock = vi.mocked(apiClient);

const mockSummary = {
  id: 'school-1', name: 'Test', code: 'T1',
  total_products: 50, total_clients: 80, total_sales: 120, total_orders: 30,
};

describe('dashboardService', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  describe('getSchoolSummary', () => {
    it('fetches school summary', async () => {
      (apiMock.get as Mock).mockResolvedValueOnce({ data: mockSummary });
      const result = await dashboardService.getSchoolSummary('school-1');
      expect(apiMock.get).toHaveBeenCalledWith('/schools/school-1/summary');
      expect(result.total_products).toBe(50);
    });
  });

  describe('getStats', () => {
    it('returns simplified stats from summary', async () => {
      (apiMock.get as Mock).mockResolvedValueOnce({ data: mockSummary });
      const result = await dashboardService.getStats('school-1');
      expect(result).toEqual({
        total_products: 50, total_clients: 80, total_sales: 120, total_orders: 30,
      });
    });

    it('defaults total_orders to 0 if missing', async () => {
      (apiMock.get as Mock).mockResolvedValueOnce({ data: { ...mockSummary, total_orders: undefined } });
      const result = await dashboardService.getStats('school-1');
      expect(result.total_orders).toBe(0);
    });
  });

  describe('getAggregatedStats', () => {
    it('aggregates stats for multiple schools', async () => {
      (apiMock.get as Mock)
        .mockResolvedValueOnce({ data: { ...mockSummary, total_products: 30 } })
        .mockResolvedValueOnce({ data: { ...mockSummary, total_products: 20 } });

      const result = await dashboardService.getAggregatedStats([
        { id: 's1', name: 'School 1', code: 'S1' },
        { id: 's2', name: 'School 2', code: 'S2' },
      ]);

      expect(result.school_count).toBe(2);
      expect(result.totals.total_products).toBe(50);
      expect(result.by_school).toHaveLength(2);
    });

    it('returns zeros for failed school fetches', async () => {
      (apiMock.get as Mock)
        .mockResolvedValueOnce({ data: mockSummary })
        .mockRejectedValueOnce(new Error('Failed'));

      const result = await dashboardService.getAggregatedStats([
        { id: 's1', name: 'School 1', code: 'S1' },
        { id: 's2', name: 'School 2', code: 'S2' },
      ]);

      expect(result.by_school[1].total_products).toBe(0);
      expect(result.totals.total_products).toBe(50);
    });

    it('handles empty schools list', async () => {
      const result = await dashboardService.getAggregatedStats([]);
      expect(result.school_count).toBe(0);
      expect(result.totals.total_products).toBe(0);
    });
  });

  describe('getGlobalStats', () => {
    it('fetches global dashboard stats', async () => {
      const mockGlobal = { totals: { total_sales: 500 }, schools_summary: [], school_count: 3 };
      (apiMock.get as Mock).mockResolvedValueOnce({ data: mockGlobal });
      const result = await dashboardService.getGlobalStats();
      expect(apiMock.get).toHaveBeenCalledWith('/global/dashboard/stats');
      expect(result.school_count).toBe(3);
    });
  });
});
