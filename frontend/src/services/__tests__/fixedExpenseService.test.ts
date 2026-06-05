import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import apiClient from '../../utils/api-client';
import {
  getFixedExpenses,
  getFixedExpense,
  createFixedExpense,
  updateFixedExpense,
  deleteFixedExpense,
  getPendingGeneration,
  generateExpenses,
  generateSingleExpense,
  getExpenseHistory,
  getExpenseTypeLabel,
  getFrequencyLabel,
  getExpenseTypeColor,
  getStatusColor,
  formatAmountRange,
} from '../fixedExpenseService';
import type {
  FixedExpenseListItem,
  FixedExpenseWithStats,
  FixedExpenseResponse,
  PendingGenerationResponse,
  GenerateExpensesResponse,
  ExpenseHistoryItem,
} from '../fixedExpenseService';

vi.mock('../../utils/api-client', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

const apiMock = vi.mocked(apiClient);

function paginatedOf<T>(items: T[]) {
  return { items, total: items.length, skip: 0, limit: 100, page: 1, total_pages: 1, has_more: false };
}

const BASE_URL = '/global/fixed-expenses';

const sampleItem: FixedExpenseListItem = {
  id: 'fe-1',
  name: 'Arriendo Local',
  category: 'rent',
  expense_type: 'exact',
  amount: 2_000_000,
  min_amount: null,
  max_amount: null,
  frequency: 'monthly',
  day_of_month: 1,
  vendor_id: null,
  vendor_name: 'Propietario',
  auto_generate: true,
  next_generation_date: '2026-05-01',
  last_generated_date: '2026-04-01',
  is_active: true,
};

describe('fixedExpenseService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getFixedExpenses', () => {
    it('fetches paginated list with filters', async () => {
      const paginated = paginatedOf([sampleItem]);
      (apiMock.get as Mock).mockResolvedValueOnce({ data: paginated });

      const result = await getFixedExpenses({ is_active: true, category: 'rent' });

      expect(apiMock.get).toHaveBeenCalledWith(BASE_URL, { params: { is_active: true, category: 'rent' } });
      expect(result.items).toHaveLength(1);
      expect(result.items[0].name).toBe('Arriendo Local');
    });

    it('wraps plain array into paginated response', async () => {
      (apiMock.get as Mock).mockResolvedValueOnce({ data: [sampleItem] });

      const result = await getFixedExpenses();

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });

  describe('getFixedExpense', () => {
    it('fetches single fixed expense with stats', async () => {
      const detail: FixedExpenseWithStats = {
        ...sampleItem,
        description: 'Arriendo mensual',
        created_by: 'user-1',
        created_at: '2026-01-01T00:00:00',
        updated_at: '2026-04-01T00:00:00',
        total_generated: 4,
        total_amount_generated: 8_000_000,
        last_expense_id: 'exp-99',
      };
      (apiMock.get as Mock).mockResolvedValueOnce({ data: detail });

      const result = await getFixedExpense('fe-1');

      expect(apiMock.get).toHaveBeenCalledWith(`${BASE_URL}/fe-1`);
      expect(result.total_generated).toBe(4);
    });
  });

  describe('createFixedExpense', () => {
    it('posts new fixed expense', async () => {
      const created: FixedExpenseResponse = {
        ...sampleItem,
        description: null,
        created_by: 'user-1',
        created_at: '2026-04-12T10:00:00',
        updated_at: '2026-04-12T10:00:00',
      };
      (apiMock.post as Mock).mockResolvedValueOnce({ data: created });

      const result = await createFixedExpense({
        name: 'Arriendo Local',
        category: 'rent',
        expense_type: 'exact',
        amount: 2_000_000,
      });

      expect(apiMock.post).toHaveBeenCalledWith(BASE_URL, expect.objectContaining({ name: 'Arriendo Local' }));
      expect(result.id).toBe('fe-1');
    });
  });

  describe('updateFixedExpense', () => {
    it('patches fixed expense by id', async () => {
      const updated: FixedExpenseResponse = {
        ...sampleItem,
        amount: 2_500_000,
        description: null,
        created_by: 'user-1',
        created_at: '2026-01-01T00:00:00',
        updated_at: '2026-04-12T12:00:00',
      };
      (apiMock.patch as Mock).mockResolvedValueOnce({ data: updated });

      const result = await updateFixedExpense('fe-1', { amount: 2_500_000 });

      expect(apiMock.patch).toHaveBeenCalledWith(`${BASE_URL}/fe-1`, { amount: 2_500_000 });
      expect(result.amount).toBe(2_500_000);
    });
  });

  describe('deleteFixedExpense', () => {
    it('deletes by id', async () => {
      (apiMock.delete as Mock).mockResolvedValueOnce({});

      await deleteFixedExpense('fe-1');

      expect(apiMock.delete).toHaveBeenCalledWith(`${BASE_URL}/fe-1`);
    });
  });

  describe('getPendingGeneration', () => {
    it('fetches pending generation items', async () => {
      const response: PendingGenerationResponse = {
        pending_count: 2,
        overdue_count: 1,
        items: [],
      };
      (apiMock.get as Mock).mockResolvedValueOnce({ data: response });

      const result = await getPendingGeneration();

      expect(apiMock.get).toHaveBeenCalledWith(`${BASE_URL}/pending-generation`);
      expect(result.pending_count).toBe(2);
    });
  });

  describe('generateExpenses', () => {
    it('posts generate request with body', async () => {
      const response: GenerateExpensesResponse = {
        generated_count: 3,
        skipped_count: 0,
        generated_expenses: [],
        skipped_reasons: {},
      };
      (apiMock.post as Mock).mockResolvedValueOnce({ data: response });

      const result = await generateExpenses({ target_date: '2026-04-12' });

      expect(apiMock.post).toHaveBeenCalledWith(`${BASE_URL}/generate`, { target_date: '2026-04-12' });
      expect(result.generated_count).toBe(3);
    });

    it('sends empty object when no request provided', async () => {
      const response: GenerateExpensesResponse = {
        generated_count: 0,
        skipped_count: 0,
        generated_expenses: [],
        skipped_reasons: {},
      };
      (apiMock.post as Mock).mockResolvedValueOnce({ data: response });

      await generateExpenses();

      expect(apiMock.post).toHaveBeenCalledWith(`${BASE_URL}/generate`, {});
    });
  });

  describe('generateSingleExpense', () => {
    it('posts to generate single expense with params', async () => {
      const response = {
        message: 'Generated',
        expense_id: 'exp-100',
        amount: 2_000_000,
        expense_date: '2026-04-12',
        due_date: null,
      };
      (apiMock.post as Mock).mockResolvedValueOnce({ data: response });

      const result = await generateSingleExpense('fe-1', { amount: 2_000_000 });

      expect(apiMock.post).toHaveBeenCalledWith(`${BASE_URL}/fe-1/generate`, null, {
        params: { amount: 2_000_000 },
      });
      expect(result.expense_id).toBe('exp-100');
    });
  });

  describe('getExpenseHistory', () => {
    it('fetches history with default limit', async () => {
      const items: ExpenseHistoryItem[] = [
        {
          id: 'exp-1',
          description: 'Arriendo Abril',
          amount: 2_000_000,
          amount_paid: 2_000_000,
          balance: 0,
          is_paid: true,
          expense_date: '2026-04-01',
          due_date: null,
          payment_method: 'transfer',
          paid_at: '2026-04-01T10:00:00',
        },
      ];
      (apiMock.get as Mock).mockResolvedValueOnce({ data: items });

      const result = await getExpenseHistory('fe-1');

      expect(apiMock.get).toHaveBeenCalledWith(`${BASE_URL}/fe-1/history`, { params: { limit: 12 } });
      expect(result).toHaveLength(1);
    });
  });

  describe('error propagation', () => {
    it('propagates API errors from getFixedExpenses', async () => {
      (apiMock.get as Mock).mockRejectedValueOnce(new Error('Network error'));

      await expect(getFixedExpenses()).rejects.toThrow('Network error');
    });
  });

  describe('helper functions', () => {
    describe('getExpenseTypeLabel', () => {
      it('returns correct labels', () => {
        expect(getExpenseTypeLabel('exact')).toBe('Valor Fijo');
        expect(getExpenseTypeLabel('variable')).toBe('Valor Variable');
      });
    });

    describe('getFrequencyLabel', () => {
      it('returns correct labels', () => {
        expect(getFrequencyLabel('monthly')).toBe('Mensual');
        expect(getFrequencyLabel('weekly')).toBe('Semanal');
        expect(getFrequencyLabel('quarterly')).toBe('Trimestral');
      });
    });

    describe('getExpenseTypeColor', () => {
      it('returns correct color classes', () => {
        expect(getExpenseTypeColor('exact')).toContain('brand');
        expect(getExpenseTypeColor('variable')).toContain('amber');
      });
    });

    describe('getStatusColor', () => {
      it('returns stone for inactive', () => {
        expect(getStatusColor(false, 0)).toContain('stone');
      });

      it('returns red for overdue', () => {
        expect(getStatusColor(true, 5)).toContain('red');
      });

      it('returns emerald for active on-time', () => {
        expect(getStatusColor(true, 0)).toContain('emerald');
      });
    });

    describe('formatAmountRange', () => {
      it('returns range for variable expenses', () => {
        const result = formatAmountRange(100_000, 50_000, 150_000, 'variable');
        expect(result).toContain('50');
        expect(result).toContain('150');
      });

      it('returns single amount for exact expenses', () => {
        const result = formatAmountRange(100_000, null, null, 'exact');
        expect(result).toContain('100');
      });

      it('returns single amount when variable but min/max null', () => {
        const result = formatAmountRange(100_000, null, null, 'variable');
        expect(result).toContain('100');
      });
    });
  });
});
