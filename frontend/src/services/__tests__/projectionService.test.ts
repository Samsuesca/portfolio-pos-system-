import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { apiClient } from '../../utils/api-client';
import { projectionService, type ProjectionAssumptions, type ProjectionRunResponse } from '../projectionService';

vi.mock('../../utils/api-client', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

const BASE = '/global/accounting/projections';

function buildAssumptions(overrides: Partial<ProjectionAssumptions> = {}): ProjectionAssumptions {
  return {
    name: 'Test',
    start_year: 2026,
    start_month: 5,
    months: 12,
    base_revenue_monthly: 7_500_000,
    seasonality: { 1: 1.0, 2: 1.0 },
    growth_rate_monthly: 0,
    cogs_pct: 0.62,
    fixed_costs_monthly: 1_100_000,
    payroll_monthly_base: 5_600_000,
    hiring_plan: [],
    new_branches: [],
    debts: [],
    formalization_layer: null,
    inflation_annual: 0.06,
    initial_cash: 12_000_000,
    ...overrides,
  };
}

describe('projectionService', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  describe('runProjection', () => {
    it('posts assumptions to /run with persist=true by default', async () => {
      const response: ProjectionRunResponse = {
        id: 'abc123', name: 'Test', assumptions: buildAssumptions(),
        months: [], summary: {} as ProjectionRunResponse['summary'],
        generated_at: '2026-05-03T10:00:00',
      };
      (apiClient.post as Mock).mockResolvedValue({ data: response });

      const assumptions = buildAssumptions();
      const result = await projectionService.runProjection(assumptions);

      expect(apiClient.post).toHaveBeenCalledWith(
        `${BASE}/run`,
        assumptions,
        { params: { persist: true } },
      );
      expect(result.id).toBe('abc123');
    });

    it('respects persist=false when provided', async () => {
      (apiClient.post as Mock).mockResolvedValue({
        data: { id: null, name: 'Test', assumptions: buildAssumptions(), months: [], summary: {}, generated_at: '' },
      });

      await projectionService.runProjection(buildAssumptions(), { persist: false });

      expect(apiClient.post).toHaveBeenCalledWith(
        `${BASE}/run`,
        expect.any(Object),
        { params: { persist: false } },
      );
    });
  });

  describe('listProjections', () => {
    it('lists with default params', async () => {
      (apiClient.get as Mock).mockResolvedValue({ data: [] });

      const result = await projectionService.listProjections();

      expect(apiClient.get).toHaveBeenCalledWith(BASE, { params: undefined });
      expect(result).toEqual([]);
    });

    it('forwards scenario filter', async () => {
      (apiClient.get as Mock).mockResolvedValue({ data: [] });

      await projectionService.listProjections({ scenario: 'B', limit: 10 });

      expect(apiClient.get).toHaveBeenCalledWith(BASE, { params: { scenario: 'B', limit: 10 } });
    });
  });

  describe('getProjection', () => {
    it('fetches detail by id', async () => {
      const detail = {
        id: 'xyz', name: 'Saved', scenario_label: 'B',
        months_count: 12, start_year: 2026, start_month: 5,
        assumptions: buildAssumptions(), results: [],
        summary: {}, created_at: '2026-05-03T10:00:00',
      };
      (apiClient.get as Mock).mockResolvedValue({ data: detail });

      const result = await projectionService.getProjection('xyz');

      expect(apiClient.get).toHaveBeenCalledWith(`${BASE}/xyz`);
      expect(result.id).toBe('xyz');
      expect(result.scenario_label).toBe('B');
    });
  });

  describe('decimal coercion', () => {
    // Backend serializes Pydantic Decimal as JSON strings. The service must
    // coerce them to numbers so `+`, `===`, and `.toFixed()` behave correctly
    // in components.
    it('coerces summary Decimal strings to numbers in runProjection', async () => {
      const stringifiedSummary = {
        total_revenue: '92739826.00',
        total_cogs: '57498492.00',
        total_gross_profit: '35241334.00',
        avg_gross_margin_pct: 38.0,
        total_opex: '126639740.00',
        total_formalization_one_time: '17150000.00',
        total_formalization_recurring: '26902000.00',
        total_operating_profit: '-91398406.00',
        avg_operating_margin_pct: -98.6,
        total_interest_expense: '6600000.00',
        total_debt_capital_paid: '0.00',
        total_net_profit: '-97998406.00',
        avg_net_margin_pct: -105.7,
        ending_cash: '-85918606.00',
        min_cash: '-85918606.00',
        months_cash_negative: 11,
        months_below_breakeven: 12,
        breakeven_revenue_monthly_avg: '24010908.00',
      };
      (apiClient.post as Mock).mockResolvedValue({
        data: { id: 'x', name: 'B', assumptions: buildAssumptions(), months: [], summary: stringifiedSummary, generated_at: '' },
      });

      const result = await projectionService.runProjection(buildAssumptions());

      expect(typeof result.summary.total_revenue).toBe('number');
      expect(typeof result.summary.total_formalization_one_time).toBe('number');
      expect(typeof result.summary.ending_cash).toBe('number');
      // Critical: arithmetic must work after coercion
      const totalForm = result.summary.total_formalization_one_time + result.summary.total_formalization_recurring;
      expect(totalForm).toBe(44_052_000);
      // Critical: strict equality for ProjectionsList highlight
      expect(result.summary.ending_cash).toBe(-85_918_606);
    });

    it('coerces month Decimal strings to numbers', async () => {
      const stringifiedMonth = {
        year: 2026, month: 5, period_label: 'Mayo 2026',
        revenue: '4350000.00', cogs: '2697000.00', gross_profit: '1653000.00',
        gross_margin_pct: 38.0,
        fixed_costs: '1100000.00', payroll: '5600000.00',
        formalization_cost_one_time: '5000000.00',
        formalization_cost_recurring: '586000.00',
        total_opex: '12286000.00',
        operating_profit: '-10633000.00', operating_margin_pct: -244.4,
        interest_expense: '550000.00', debt_capital_payment: '0.00',
        net_profit: '-11183000.00', net_margin_pct: -257.1,
        cash_inflow: '4350000.00', cash_outflow: '15533000.00',
        net_cash_flow: '-11183000.00', cumulative_cash: '897000.00',
        headcount: 4, below_breakeven: true, cash_negative: false,
      };
      (apiClient.post as Mock).mockResolvedValue({
        data: { id: 'x', name: 'B', assumptions: buildAssumptions(), months: [stringifiedMonth], summary: {}, generated_at: '' },
      });

      const result = await projectionService.runProjection(buildAssumptions());

      const m = result.months[0];
      expect(typeof m.revenue).toBe('number');
      expect(typeof m.cumulative_cash).toBe('number');
      // String fields stay strings
      expect(typeof m.period_label).toBe('string');
      // Arithmetic works
      expect(m.revenue - m.cogs).toBe(1_653_000);
    });

    it('coerces summary in listProjections items', async () => {
      (apiClient.get as Mock).mockResolvedValue({
        data: [
          {
            id: 'a', name: 'A', scenario_label: 'A',
            months_count: 12, start_year: 2026, start_month: 5,
            summary: { total_revenue: '145000000.00', ending_cash: '3000000.00', total_net_profit: '-9961531.00' },
            created_at: '',
          },
          {
            id: 'b', name: 'B', scenario_label: 'B',
            months_count: 12, start_year: 2026, start_month: 5,
            summary: { total_revenue: '92000000.00', ending_cash: '-85000000.00', total_net_profit: '-97998606.00' },
            created_at: '',
          },
        ],
      });

      const items = await projectionService.listProjections();

      // Critical: Math.max returns a number, and === must match coerced values
      const maxCash = Math.max(...items.map((i) => i.summary.ending_cash));
      expect(items[0].summary.ending_cash === maxCash).toBe(true);
      expect(items[1].summary.ending_cash === maxCash).toBe(false);
    });

    it('coerces summary and months in getProjection detail', async () => {
      (apiClient.get as Mock).mockResolvedValue({
        data: {
          id: 'x', name: 'X', scenario_label: 'B',
          months_count: 1, start_year: 2026, start_month: 5,
          assumptions: buildAssumptions(),
          results: [{ year: 2026, month: 5, period_label: 'May 26', revenue: '4350000.00' }],
          summary: { total_revenue: '4350000.00' },
          created_at: '',
        },
      });

      const detail = await projectionService.getProjection('x');

      expect(typeof detail.results[0].revenue).toBe('number');
      expect(typeof detail.summary.total_revenue).toBe('number');
    });
  });

  describe('deleteProjection', () => {
    it('calls delete and resolves to void', async () => {
      (apiClient.delete as Mock).mockResolvedValue({ data: {} });

      await projectionService.deleteProjection('xyz');

      expect(apiClient.delete).toHaveBeenCalledWith(`${BASE}/xyz`);
    });

    it('propagates errors from the API client', async () => {
      (apiClient.delete as Mock).mockRejectedValue(new Error('Proyección no encontrada'));

      await expect(projectionService.deleteProjection('missing')).rejects.toThrow('Proyección no encontrada');
    });
  });
});
