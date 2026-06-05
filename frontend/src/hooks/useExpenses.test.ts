/**
 * Tests for useExpenses hook.
 *
 * Critical regression: stats (totalAmount, paid/pending amount, byCategory)
 * MUST come from the backend /expenses/stats and /expenses/summary-by-category
 * endpoints, not from a client-side reduce over the paginated rows.
 *
 * The original bug showed $17.5M / 100 records on a DB with $105M / 407.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useExpenses } from './useExpenses';

// ---- Mocks ------------------------------------------------------------------

const mockGetGlobalExpenses = vi.fn();
const mockGetGlobalExpensesStats = vi.fn();
const mockGetExpensesSummaryByCategory = vi.fn();

vi.mock('../services/globalAccountingService', () => ({
  globalAccountingService: {
    getGlobalExpenses: (...args: unknown[]) => mockGetGlobalExpenses(...args),
    getGlobalExpensesStats: (...args: unknown[]) => mockGetGlobalExpensesStats(...args),
    getExpensesSummaryByCategory: (...args: unknown[]) =>
      mockGetExpensesSummaryByCategory(...args),
  },
}));

// useExpenseCategories must not hit the real service or other hooks.
vi.mock('./useExpenseCategories', () => ({
  useExpenseCategories: () => ({
    getCategoryLabel: (code: string) => {
      const labels: Record<string, string> = {
        rent: 'Arriendo',
        payroll: 'Nómina',
        utilities: 'Servicios Públicos',
      };
      return labels[code] ?? code;
    },
    getCategoryColor: () => '#3B82F6',
  }),
}));

// ---- Helpers ----------------------------------------------------------------

function paginated<T>(items: T[], total = items.length) {
  return {
    items,
    total,
    skip: 0,
    limit: 100,
    page: 1,
    total_pages: 1,
    has_more: false,
  };
}

const fakeExpense = {
  id: 'e1',
  category: 'rent',
  description: 'Test expense',
  amount: 1000,
  amount_paid: 0,
  is_paid: false,
  expense_date: '2026-05-01',
  due_date: null,
  vendor_id: null,
  vendor_name: null,
  is_recurring: false,
  balance: 1000,
  payment_method: null,
  payment_account_name: null,
  paid_at: null,
};

const serverStats = {
  total_amount: 105_000_000,
  total_count: 407,
  paid_amount: 100_000_000,
  paid_count: 380,
  pending_amount: 5_000_000,
  pending_count: 27,
  average_amount: 258_059,
};

const categorySummary = [
  {
    category: 'rent',
    category_label: 'rent',
    total_amount: 30_000_000,
    paid_amount: 28_000_000,
    pending_amount: 2_000_000,
    count: 14,
    percentage: 28.5,
  },
  {
    category: 'payroll',
    category_label: 'payroll',
    total_amount: 50_000_000,
    paid_amount: 50_000_000,
    pending_amount: 0,
    count: 200,
    percentage: 47.6,
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  mockGetGlobalExpenses.mockResolvedValue(paginated([fakeExpense], 407));
  mockGetGlobalExpensesStats.mockResolvedValue(serverStats);
  mockGetExpensesSummaryByCategory.mockResolvedValue(paginated(categorySummary));
});

// ---- Tests ------------------------------------------------------------------

describe('useExpenses', () => {
  it('loads expenses, stats and category summary in parallel on mount', async () => {
    renderHook(() => useExpenses());

    await waitFor(() => {
      expect(mockGetGlobalExpenses).toHaveBeenCalled();
      expect(mockGetGlobalExpensesStats).toHaveBeenCalled();
      expect(mockGetExpensesSummaryByCategory).toHaveBeenCalled();
    });
  });

  it('top-card stats reflect server-aggregated values, NOT a client sum', async () => {
    const { result } = renderHook(() => useExpenses());

    await waitFor(() => expect(result.current.loading).toBe(false));

    // Server says 407 records / $105M; the loaded page has only 1 expense.
    // If the hook regressed to client-side reduce, totalAmount would be 1000.
    expect(result.current.stats.totalAmount).toBe(105_000_000);
    expect(result.current.stats.totalCount).toBe(407);
    expect(result.current.stats.paidAmount).toBe(100_000_000);
    expect(result.current.stats.pendingAmount).toBe(5_000_000);
    expect(result.current.stats.averageAmount).toBe(258_059);
  });

  it('byCategory reflects the server summary (full catalog), not loaded items', async () => {
    const { result } = renderHook(() => useExpenses());

    await waitFor(() => expect(result.current.loading).toBe(false));

    // Two categories from the summary, sorted by amount desc.
    expect(result.current.stats.byCategory).toHaveLength(2);
    expect(result.current.stats.byCategory[0].category).toBe('payroll');
    expect(result.current.stats.byCategory[0].amount).toBe(50_000_000);
    expect(result.current.stats.byCategory[0].count).toBe(200);
    expect(result.current.stats.byCategory[1].category).toBe('rent');
  });

  it('uses getCategoryLabel from the dynamic categories hook (not server label)', async () => {
    const { result } = renderHook(() => useExpenses());

    await waitFor(() => expect(result.current.loading).toBe(false));

    // The mocked getCategoryLabel maps 'rent' -> 'Arriendo'. Server returned
    // category_label: 'rent' (the raw code), but the hook overrides it.
    const rent = result.current.stats.byCategory.find(c => c.category === 'rent');
    expect(rent?.label).toBe('Arriendo');
  });

  it('falls back to client-side stats when server stats endpoint fails', async () => {
    mockGetGlobalExpensesStats.mockRejectedValueOnce(new Error('500'));
    mockGetExpensesSummaryByCategory.mockResolvedValueOnce(paginated([]));

    const { result } = renderHook(() => useExpenses());

    await waitFor(() => expect(result.current.loading).toBe(false));

    // With no serverStats, totals come from the loaded items (1 expense, 1000 amount).
    expect(result.current.stats.totalAmount).toBe(1000);
    // serverTotal is still set (407), so totalCount uses it.
    expect(result.current.stats.totalCount).toBe(407);
  });

  it('requests the page with the configured pageSize (default 100)', async () => {
    renderHook(() => useExpenses());

    await waitFor(() => {
      expect(mockGetGlobalExpenses).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 100, skip: 0 })
      );
    });
  });

  it('respects a custom pageSize', async () => {
    renderHook(() => useExpenses({ pageSize: 50 }));

    await waitFor(() => {
      expect(mockGetGlobalExpenses).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 50 })
      );
    });
  });

  it('exposes the loaded expenses for the table', async () => {
    const { result } = renderHook(() => useExpenses());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.expenses).toHaveLength(1);
  });

  it('handles a fetch error and surfaces it via the error state', async () => {
    mockGetGlobalExpenses.mockRejectedValueOnce(new Error('Network failure'));

    const { result } = renderHook(() => useExpenses());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.error).toMatch(/network failure|error al cargar gastos/i);
  });
});
