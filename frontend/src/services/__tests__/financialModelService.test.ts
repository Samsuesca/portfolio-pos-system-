import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { apiClient } from '../../utils/api-client';
import { financialModelService } from '../financialModelService';
import type {
  KPIDashboardResponse,
  ProfitabilityResponse,
  TrendAnalysisResponse,
  BudgetItem,
  BudgetVsActualResponse,
  CashForecastResponse,
  HealthAlertsResponse,
  ExecutiveSummaryResponse,
} from '../financialModelService';

vi.mock('../../utils/api-client', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

const BASE = '/global/accounting/financial-model';

describe('financialModelService', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  describe('getKPIs', () => {
    it('returns KPI dashboard data', async () => {
      const data: KPIDashboardResponse = {
        period: '2026-04', generated_at: '2026-04-10T10:00:00', kpis: [],
      };
      (apiClient.get as Mock).mockResolvedValue({ data });

      const result = await financialModelService.getKPIs({ period: 'monthly' });

      expect(apiClient.get).toHaveBeenCalledWith(`${BASE}/kpis`, { params: { period: 'monthly' } });
      expect(result.period).toBe('2026-04');
    });

    it('calls without params', async () => {
      (apiClient.get as Mock).mockResolvedValue({ data: { period: '', generated_at: '', kpis: [] } });
      await financialModelService.getKPIs();
      expect(apiClient.get).toHaveBeenCalledWith(`${BASE}/kpis`, { params: undefined });
    });
  });

  describe('getProfitabilityBySchool', () => {
    it('returns profitability data', async () => {
      const data: ProfitabilityResponse = {
        start_date: '2026-01-01', end_date: '2026-04-10', total_revenue: 10000000, schools: [],
      };
      (apiClient.get as Mock).mockResolvedValue({ data });

      const result = await financialModelService.getProfitabilityBySchool({ start_date: '2026-01-01' });

      expect(apiClient.get).toHaveBeenCalledWith(`${BASE}/profitability/by-school`, { params: { start_date: '2026-01-01' } });
      expect(result.total_revenue).toBe(10000000);
    });
  });

  describe('getTrends', () => {
    it('returns trend analysis', async () => {
      const data: TrendAnalysisResponse = {
        start_date: '2026-01-01', end_date: '2026-04-10', period: 'monthly', series: [], anomalies: [],
      };
      (apiClient.get as Mock).mockResolvedValue({ data });

      const result = await financialModelService.getTrends({ metrics: 'revenue', period: 'monthly' });

      expect(apiClient.get).toHaveBeenCalledWith(`${BASE}/trends`, { params: { metrics: 'revenue', period: 'monthly' } });
      expect(result.period).toBe('monthly');
    });
  });

  describe('getBudgets', () => {
    it('returns budget list', async () => {
      const budget: BudgetItem = {
        id: 'b-1', period_type: 'monthly', period_start: '2026-04-01', period_end: '2026-04-30',
        category: 'payroll', school_id: null, budgeted_amount: 3000000, notes: null,
        created_by: null, created_at: '2026-04-01T00:00:00', updated_at: '2026-04-01T00:00:00',
      };
      (apiClient.get as Mock).mockResolvedValue({ data: [budget] });

      const result = await financialModelService.getBudgets({ period_type: 'monthly' });

      expect(apiClient.get).toHaveBeenCalledWith(`${BASE}/budgets`, { params: { period_type: 'monthly' } });
      expect(result).toHaveLength(1);
      expect(result[0].category).toBe('payroll');
    });
  });

  describe('createBudget', () => {
    it('posts budget data', async () => {
      const budget: BudgetItem = {
        id: 'b-2', period_type: 'monthly', period_start: '2026-04-01', period_end: '2026-04-30',
        category: 'rent', school_id: null, budgeted_amount: 2000000, notes: null,
        created_by: null, created_at: '2026-04-10T10:00:00', updated_at: '2026-04-10T10:00:00',
      };
      (apiClient.post as Mock).mockResolvedValue({ data: budget });

      const result = await financialModelService.createBudget({
        period_type: 'monthly', period_start: '2026-04-01', period_end: '2026-04-30',
        category: 'rent', budgeted_amount: 2000000,
      });

      expect(apiClient.post).toHaveBeenCalledWith(`${BASE}/budgets`, expect.objectContaining({ category: 'rent' }));
      expect(result.id).toBe('b-2');
    });
  });

  describe('deleteBudget', () => {
    it('calls delete with correct URL', async () => {
      (apiClient.delete as Mock).mockResolvedValue({});
      await financialModelService.deleteBudget('b-1');
      expect(apiClient.delete).toHaveBeenCalledWith(`${BASE}/budgets/b-1`);
    });
  });

  describe('getBudgetVsActual', () => {
    it('returns budget vs actual comparison', async () => {
      const data: BudgetVsActualResponse = {
        period_type: 'monthly', period_start: '2026-04-01', period_end: '2026-04-30',
        items: [], total_budgeted: 5000000, total_actual: 4500000, total_variance: 500000,
      };
      (apiClient.get as Mock).mockResolvedValue({ data });

      const result = await financialModelService.getBudgetVsActual({ period_type: 'monthly', period_start: '2026-04-01' });

      expect(apiClient.get).toHaveBeenCalledWith(`${BASE}/budget-vs-actual`, {
        params: { period_type: 'monthly', period_start: '2026-04-01' },
      });
      expect(result.total_variance).toBe(500000);
    });
  });

  describe('getCashForecast', () => {
    it('returns cash forecast scenarios', async () => {
      const data: CashForecastResponse = {
        current_balance: 10000000, min_threshold: 1000000, runway_months: 8, scenarios: [],
      };
      (apiClient.get as Mock).mockResolvedValue({ data });

      const result = await financialModelService.getCashForecast({ months: 6 });

      expect(apiClient.get).toHaveBeenCalledWith(`${BASE}/cash-forecast`, { params: { months: 6 } });
      expect(result.runway_months).toBe(8);
    });
  });

  describe('getHealthAlerts', () => {
    it('returns financial health alerts', async () => {
      const data: HealthAlertsResponse = {
        generated_at: '2026-04-10T10:00:00', alerts: [], critical_count: 0, warning_count: 1, info_count: 2,
      };
      (apiClient.get as Mock).mockResolvedValue({ data });

      const result = await financialModelService.getHealthAlerts();

      expect(apiClient.get).toHaveBeenCalledWith(`${BASE}/health-alerts`);
      expect(result.warning_count).toBe(1);
    });
  });

  describe('getExecutiveSummary', () => {
    it('returns executive summary', async () => {
      const data: ExecutiveSummaryResponse = {
        period: '2026-04', period_label: 'Abril 2026', generated_at: '2026-04-10T10:00:00',
        revenue: 15000000, expenses: 8000000, net_profit: 7000000, cash_position: 10000000,
        revenue_vs_previous: 5.2, expenses_vs_previous: -2.1, profit_vs_previous: 12.3,
        top_schools: [], top_expense_categories: [], kpi_snapshot: [], active_alerts: [],
        forecast_summary: 'Positive outlook',
      };
      (apiClient.get as Mock).mockResolvedValue({ data });

      const result = await financialModelService.getExecutiveSummary({ period: '2026-04' });

      expect(apiClient.get).toHaveBeenCalledWith(`${BASE}/executive-summary`, { params: { period: '2026-04' } });
      expect(result.net_profit).toBe(7000000);
    });
  });

  describe('error propagation', () => {
    it('propagates errors from getKPIs', async () => {
      (apiClient.get as Mock).mockRejectedValue(new Error('Unauthorized'));
      await expect(financialModelService.getKPIs()).rejects.toThrow('Unauthorized');
    });

    it('propagates errors from createBudget', async () => {
      (apiClient.post as Mock).mockRejectedValue(new Error('Validation error'));
      await expect(financialModelService.createBudget({
        period_type: 'monthly', period_start: '2026-04-01', period_end: '2026-04-30',
        category: 'rent', budgeted_amount: 0,
      })).rejects.toThrow('Validation error');
    });

    it('propagates errors from deleteBudget', async () => {
      (apiClient.delete as Mock).mockRejectedValue(new Error('Not found'));
      await expect(financialModelService.deleteBudget('bad-id')).rejects.toThrow('Not found');
    });
  });
});
