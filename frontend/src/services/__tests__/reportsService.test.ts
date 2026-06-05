import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import apiClient from '../../utils/api-client';
import { reportsService } from '../reportsService';

vi.mock('../../utils/api-client', () => ({
  default: { get: vi.fn() },
}));

const apiMock = vi.mocked(apiClient);

describe('reportsService', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  describe('getDashboardSummary', () => {
    it('fetches summary with no filters', async () => {
      const mock = { today: { sales_count: 5, revenue: 100000 } };
      (apiMock.get as Mock).mockResolvedValueOnce({ data: mock });
      const result = await reportsService.getDashboardSummary('school-1');
      expect(apiMock.get).toHaveBeenCalledWith('/schools/school-1/reports/dashboard', { params: {} });
      expect(result.today.sales_count).toBe(5);
    });

    it('passes date filters', async () => {
      (apiMock.get as Mock).mockResolvedValueOnce({ data: {} });
      await reportsService.getDashboardSummary('school-1', { startDate: '2026-01-01', endDate: '2026-01-31' });
      expect(apiMock.get).toHaveBeenCalledWith('/schools/school-1/reports/dashboard', {
        params: { start_date: '2026-01-01', end_date: '2026-01-31' },
      });
    });
  });

  describe('getDailySales', () => {
    it('fetches daily sales without date', async () => {
      (apiMock.get as Mock).mockResolvedValueOnce({ data: { date: '2026-01-15', total_sales: 10 } });
      const result = await reportsService.getDailySales('school-1');
      expect(apiMock.get).toHaveBeenCalledWith('/schools/school-1/reports/sales/daily', { params: {} });
      expect(result.total_sales).toBe(10);
    });

    it('passes target_date when provided', async () => {
      (apiMock.get as Mock).mockResolvedValueOnce({ data: {} });
      await reportsService.getDailySales('school-1', '2026-01-15');
      expect(apiMock.get).toHaveBeenCalledWith('/schools/school-1/reports/sales/daily', { params: { target_date: '2026-01-15' } });
    });
  });

  describe('getSalesSummary', () => {
    it('fetches sales summary', async () => {
      (apiMock.get as Mock).mockResolvedValueOnce({ data: { total_sales: 100, total_revenue: 5000000 } });
      const result = await reportsService.getSalesSummary('school-1');
      expect(apiMock.get).toHaveBeenCalledWith('/schools/school-1/reports/sales/summary', { params: {} });
      expect(result.total_revenue).toBe(5000000);
    });
  });

  describe('getTopProducts', () => {
    it('fetches top products with default limit', async () => {
      (apiMock.get as Mock).mockResolvedValueOnce({ data: [{ product_id: 'p1', units_sold: 50 }] });
      const result = await reportsService.getTopProducts('school-1');
      expect(apiMock.get).toHaveBeenCalledWith('/schools/school-1/reports/sales/top-products', { params: { limit: 10 } });
      expect(result).toHaveLength(1);
    });

    it('passes custom limit and date filters', async () => {
      (apiMock.get as Mock).mockResolvedValueOnce({ data: [] });
      await reportsService.getTopProducts('school-1', 5, { startDate: '2026-01-01' });
      expect(apiMock.get).toHaveBeenCalledWith('/schools/school-1/reports/sales/top-products', {
        params: { limit: 5, start_date: '2026-01-01' },
      });
    });
  });

  describe('getLowStock', () => {
    it('fetches low stock with default threshold', async () => {
      (apiMock.get as Mock).mockResolvedValueOnce({ data: [] });
      await reportsService.getLowStock('school-1');
      expect(apiMock.get).toHaveBeenCalledWith('/schools/school-1/reports/inventory/low-stock', { params: { threshold: 5 } });
    });
  });

  describe('getInventoryValue', () => {
    it('fetches inventory value', async () => {
      (apiMock.get as Mock).mockResolvedValueOnce({ data: { total_value: 10000000 } });
      const result = await reportsService.getInventoryValue('school-1');
      expect(apiMock.get).toHaveBeenCalledWith('/schools/school-1/reports/inventory/value');
      expect(result.total_value).toBe(10000000);
    });
  });

  describe('getPendingOrders', () => {
    it('fetches pending orders', async () => {
      (apiMock.get as Mock).mockResolvedValueOnce({ data: [{ order_id: 'o1' }] });
      const result = await reportsService.getPendingOrders('school-1');
      expect(apiMock.get).toHaveBeenCalledWith('/schools/school-1/reports/orders/pending');
      expect(result).toHaveLength(1);
    });
  });

  describe('getTopClients', () => {
    it('fetches top clients', async () => {
      (apiMock.get as Mock).mockResolvedValueOnce({ data: [{ client_id: 'c1' }] });
      const result = await reportsService.getTopClients('school-1');
      expect(apiMock.get).toHaveBeenCalledWith('/schools/school-1/reports/clients/top', { params: { limit: 10 } });
      expect(result).toHaveLength(1);
    });
  });

  describe('global reports', () => {
    it('getGlobalSalesSummary fetches global summary', async () => {
      (apiMock.get as Mock).mockResolvedValueOnce({ data: { total_revenue: 50000000 } });
      const result = await reportsService.getGlobalSalesSummary({ startDate: '2026-01-01', schoolId: 'school-1' });
      expect(apiMock.get).toHaveBeenCalledWith('/global/reports/sales/summary', {
        params: { start_date: '2026-01-01', school_id: 'school-1' },
      });
      expect(result.total_revenue).toBe(50000000);
    });

    it('getGlobalTopProducts fetches global top products', async () => {
      (apiMock.get as Mock).mockResolvedValueOnce({ data: [] });
      await reportsService.getGlobalTopProducts(5);
      expect(apiMock.get).toHaveBeenCalledWith('/global/reports/sales/top-products', { params: { limit: 5 } });
    });

    it('getGlobalTopClients fetches global top clients', async () => {
      (apiMock.get as Mock).mockResolvedValueOnce({ data: [] });
      await reportsService.getGlobalTopClients(5);
      expect(apiMock.get).toHaveBeenCalledWith('/global/reports/sales/top-clients', { params: { limit: 5 } });
    });

    it('getMonthlySalesBreakdown fetches monthly data', async () => {
      (apiMock.get as Mock).mockResolvedValueOnce({ data: { months: [], totals: {} } });
      await reportsService.getMonthlySalesBreakdown({ startDate: '2026-01-01', endDate: '2026-06-30' });
      expect(apiMock.get).toHaveBeenCalledWith('/global/reports/sales/monthly', {
        params: { start_date: '2026-01-01', end_date: '2026-06-30' },
      });
    });

    it('getProfitabilityBySchool fetches profitability', async () => {
      (apiMock.get as Mock).mockResolvedValueOnce({ data: { schools: [], totals: {} } });
      await reportsService.getProfitabilityBySchool();
      expect(apiMock.get).toHaveBeenCalledWith('/global/reports/profitability/by-school', { params: {} });
    });
  });

  describe('error propagation', () => {
    it('propagates errors', async () => {
      (apiMock.get as Mock).mockRejectedValueOnce(new Error('Forbidden'));
      await expect(reportsService.getDashboardSummary('school-1')).rejects.toThrow('Forbidden');
    });
  });
});
