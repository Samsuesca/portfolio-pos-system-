import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import apiClient from '../../utils/api-client';
import {
  getPayrollSummary,
  getPayrollRuns,
  getPayrollRun,
  createPayrollRun,
  updatePayrollRun,
  approvePayrollRun,
  payPayrollRun,
  cancelPayrollRun,
  payPayrollItem,
  getPayrollStatusLabel,
  getPayrollStatusColor,
  formatPeriodRange,
} from '../payrollService';
import type {
  PayrollSummary,
  PayrollRunListItem,
  PayrollRunDetailResponse,
  PayrollRunResponse,
  PayrollItemResponse,
} from '../payrollService';

vi.mock('../../utils/api-client', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

const apiMock = vi.mocked(apiClient);

function paginatedOf<T>(items: T[]) {
  return { items, total: items.length, skip: 0, limit: 100, page: 1, total_pages: 1, has_more: false };
}

const BASE_URL = '/global/payroll';

const sampleRunListItem: PayrollRunListItem = {
  id: 'pr-1',
  period_start: '2026-04-01',
  period_end: '2026-04-15',
  payment_date: null,
  status: 'draft',
  total_net: 5_000_000,
  employee_count: 4,
  created_at: '2026-04-10T10:00:00',
};

const sampleRunResponse: PayrollRunResponse = {
  id: 'pr-1',
  period_start: '2026-04-01',
  period_end: '2026-04-15',
  payment_date: null,
  status: 'draft',
  total_base_salary: 5_200_000,
  total_bonuses: 400_000,
  total_deductions: 600_000,
  total_net: 5_000_000,
  employee_count: 4,
  expense_id: null,
  notes: null,
  approved_by: null,
  approved_at: null,
  paid_at: null,
  created_by: 'admin-1',
  created_at: '2026-04-10T10:00:00',
};

const sampleItem: PayrollItemResponse = {
  id: 'pi-1',
  payroll_run_id: 'pr-1',
  employee_id: 'emp-1',
  base_salary: 1_300_000,
  total_bonuses: 100_000,
  total_deductions: 104_000,
  net_amount: 1_296_000,
  bonus_breakdown: [{ name: 'Transporte', amount: 100_000 }],
  deduction_breakdown: [{ name: 'Salud', amount: 52_000 }],
  worked_days: null,
  daily_rate: null,
  is_paid: false,
  paid_at: null,
  payment_method: null,
  payment_reference: null,
  employee_name: 'Maria Lopez',
  employee_payment_frequency: 'monthly',
};

describe('payrollService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getPayrollSummary', () => {
    it('fetches payroll summary', async () => {
      const summary: PayrollSummary = {
        active_employees: 4,
        total_monthly_payroll: 5_000_000,
        pending_payroll_runs: 1,
        last_payroll_date: '2026-03-31',
        fixed_expense_integration: null,
      };
      (apiMock.get as Mock).mockResolvedValueOnce({ data: summary });

      const result = await getPayrollSummary();

      expect(apiMock.get).toHaveBeenCalledWith(`${BASE_URL}/summary`);
      expect(result.active_employees).toBe(4);
    });
  });

  describe('getPayrollRuns', () => {
    it('fetches paginated list with status filter', async () => {
      (apiMock.get as Mock).mockResolvedValueOnce({ data: paginatedOf([sampleRunListItem]) });

      const result = await getPayrollRuns({ status: 'draft' });

      expect(apiMock.get).toHaveBeenCalledWith(BASE_URL, { params: { status: 'draft' } });
      expect(result.items).toHaveLength(1);
      expect(result.items[0].status).toBe('draft');
    });

    it('wraps plain array into paginated response', async () => {
      (apiMock.get as Mock).mockResolvedValueOnce({ data: [sampleRunListItem] });

      const result = await getPayrollRuns();

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });

  describe('getPayrollRun', () => {
    it('fetches single payroll run with items', async () => {
      const detail: PayrollRunDetailResponse = {
        ...sampleRunResponse,
        items: [sampleItem],
      };
      (apiMock.get as Mock).mockResolvedValueOnce({ data: detail });

      const result = await getPayrollRun('pr-1');

      expect(apiMock.get).toHaveBeenCalledWith(`${BASE_URL}/pr-1`);
      expect(result.items).toHaveLength(1);
      expect(result.items[0].employee_name).toBe('Maria Lopez');
    });
  });

  describe('createPayrollRun', () => {
    it('posts new payroll run', async () => {
      (apiMock.post as Mock).mockResolvedValueOnce({ data: sampleRunResponse });

      const result = await createPayrollRun({
        period_start: '2026-04-01',
        period_end: '2026-04-15',
      });

      expect(apiMock.post).toHaveBeenCalledWith(BASE_URL, expect.objectContaining({ period_start: '2026-04-01' }));
      expect(result.id).toBe('pr-1');
    });
  });

  describe('updatePayrollRun', () => {
    it('patches payroll run by id', async () => {
      const updated = { ...sampleRunResponse, notes: 'Updated notes' };
      (apiMock.patch as Mock).mockResolvedValueOnce({ data: updated });

      const result = await updatePayrollRun('pr-1', { notes: 'Updated notes' });

      expect(apiMock.patch).toHaveBeenCalledWith(`${BASE_URL}/pr-1`, { notes: 'Updated notes' });
      expect(result.notes).toBe('Updated notes');
    });
  });

  describe('approvePayrollRun', () => {
    it('posts approve action', async () => {
      const approved = { ...sampleRunResponse, status: 'approved' as const, approved_by: 'admin-1' };
      (apiMock.post as Mock).mockResolvedValueOnce({ data: approved });

      const result = await approvePayrollRun('pr-1');

      expect(apiMock.post).toHaveBeenCalledWith(`${BASE_URL}/pr-1/approve`);
      expect(result.status).toBe('approved');
    });
  });

  describe('payPayrollRun', () => {
    it('posts pay action', async () => {
      const paid = { ...sampleRunResponse, status: 'paid' as const, paid_at: '2026-04-15T12:00:00' };
      (apiMock.post as Mock).mockResolvedValueOnce({ data: paid });

      const result = await payPayrollRun('pr-1');

      expect(apiMock.post).toHaveBeenCalledWith(`${BASE_URL}/pr-1/pay`);
      expect(result.status).toBe('paid');
    });
  });

  describe('cancelPayrollRun', () => {
    it('posts cancel action', async () => {
      const cancelled = { ...sampleRunResponse, status: 'cancelled' as const };
      (apiMock.post as Mock).mockResolvedValueOnce({ data: cancelled });

      const result = await cancelPayrollRun('pr-1');

      expect(apiMock.post).toHaveBeenCalledWith(`${BASE_URL}/pr-1/cancel`);
      expect(result.status).toBe('cancelled');
    });
  });

  describe('payPayrollItem', () => {
    it('posts pay action for single item', async () => {
      const paidItem: PayrollItemResponse = {
        ...sampleItem,
        is_paid: true,
        paid_at: '2026-04-15T12:00:00',
        payment_method: 'transfer',
        payment_reference: 'REF-001',
      };
      (apiMock.post as Mock).mockResolvedValueOnce({ data: paidItem });

      const result = await payPayrollItem('pr-1', 'pi-1', {
        payment_method: 'transfer',
        payment_reference: 'REF-001',
      });

      expect(apiMock.post).toHaveBeenCalledWith(`${BASE_URL}/pr-1/items/pi-1/pay`, {
        payment_method: 'transfer',
        payment_reference: 'REF-001',
      });
      expect(result.is_paid).toBe(true);
    });
  });

  describe('error propagation', () => {
    it('propagates API errors from createPayrollRun', async () => {
      (apiMock.post as Mock).mockRejectedValueOnce(new Error('Validation error'));

      await expect(
        createPayrollRun({ period_start: '2026-04-01', period_end: '2026-04-15' })
      ).rejects.toThrow('Validation error');
    });
  });

  describe('helper functions', () => {
    describe('getPayrollStatusLabel', () => {
      it('returns correct labels', () => {
        expect(getPayrollStatusLabel('draft')).toBe('Borrador');
        expect(getPayrollStatusLabel('approved')).toBe('Aprobado');
        expect(getPayrollStatusLabel('paid')).toBe('Pagado');
        expect(getPayrollStatusLabel('cancelled')).toBe('Cancelado');
      });
    });

    describe('getPayrollStatusColor', () => {
      it('returns correct color classes', () => {
        expect(getPayrollStatusColor('draft')).toContain('stone');
        expect(getPayrollStatusColor('approved')).toContain('brand');
        expect(getPayrollStatusColor('paid')).toContain('emerald');
        expect(getPayrollStatusColor('cancelled')).toContain('red');
      });
    });

    describe('formatPeriodRange', () => {
      it('formats date range in Spanish', () => {
        const result = formatPeriodRange('2026-04-01', '2026-04-15');
        expect(result).toContain('-');
        expect(result).toContain('abr');
      });
    });
  });
});
