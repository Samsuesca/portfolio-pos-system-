/**
 * useExpenses - Custom hook for expense management
 *
 * Provides state management, filtering, pagination, and actions for expenses.
 * Used by the ExpensesTab component.
 */
import { useState, useEffect, useMemo, useCallback } from 'react';
import { globalAccountingService } from '../services/globalAccountingService';
import type { ExpenseListItem, ExpenseCategory } from '../types/api';
import type { CashBalancesResponse } from '../services/accountingService';
import { formatCurrency } from '../utils/formatting';
import { useExpenseCategories } from './useExpenseCategories';

// Expense categories list
export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  'rent', 'utilities', 'payroll', 'supplies', 'inventory',
  'transport', 'maintenance', 'marketing', 'taxes', 'bank_fees', 'other'
];

// Category colors for chart
export const CATEGORY_COLORS: Record<ExpenseCategory, string> = {
  rent: '#EF4444',
  utilities: '#F59E0B',
  payroll: '#10B981',
  supplies: '#3B82F6',
  inventory: '#8B5CF6',
  transport: '#EC4899',
  maintenance: '#6366F1',
  marketing: '#14B8A6',
  taxes: '#F97316',
  bank_fees: '#64748B',
  other: '#9CA3AF'
};

// Filter state type
export interface ExpenseFilterState {
  startDate: string;
  endDate: string;
  category: ExpenseCategory | '';
  minAmount: number;
  maxAmount: number;
  paymentAccountId: string;
  vendor: string;
}

// Category chart data type
export interface CategoryChartData {
  category: ExpenseCategory;
  label: string;
  amount: number;
  count: number;
  color: string;
}

// Statistics type
export interface ExpenseStats {
  totalAmount: number;
  totalCount: number;
  pendingAmount: number;
  pendingCount: number;
  paidAmount: number;
  paidCount: number;
  averageAmount: number;
  byCategory: CategoryChartData[];
  maxCategoryAmount: number;
}

// Hook options
export interface UseExpensesOptions {
  initialFilter?: 'all' | 'pending' | 'paid';
  cashBalances?: CashBalancesResponse | null;
  pageSize?: number;
}

// Hook return type
export interface UseExpensesReturn {
  // Data
  expenses: ExpenseListItem[];
  filteredExpenses: ExpenseListItem[];
  stats: ExpenseStats;
  loading: boolean;
  error: string | null;

  // Filters
  statusFilter: 'all' | 'pending' | 'paid';
  setStatusFilter: (filter: 'all' | 'pending' | 'paid') => void;
  filters: ExpenseFilterState;
  setFilters: React.Dispatch<React.SetStateAction<ExpenseFilterState>>;
  clearFilters: () => void;
  hasActiveFilters: boolean;

  // Pagination
  hasMore: boolean;
  loadingMore: boolean;
  loadMore: () => Promise<void>;

  // Actions
  refresh: () => Promise<void>;
  exportCSV: () => void;
}

// Initial filter state
const initialFilterState: ExpenseFilterState = {
  startDate: '',
  endDate: '',
  category: '',
  minAmount: 0,
  maxAmount: 0,
  paymentAccountId: '',
  vendor: ''
};

// Re-export formatCurrency for backwards compatibility
export { formatCurrency };

// Get error message helper
export const getErrorMessage = (err: unknown, defaultMessage: string): string => {
  if (err && typeof err === 'object' && 'response' in err) {
    const response = (err as { response?: { data?: { detail?: string } } }).response;
    if (response?.data?.detail) return response.data.detail;
  }
  if (err instanceof Error) return err.message;
  return defaultMessage;
};

/**
 * useExpenses hook
 */
export function useExpenses(options: UseExpensesOptions = {}): UseExpensesReturn {
  const {
    initialFilter = 'all',
    cashBalances = null,
    pageSize = 100
  } = options;

  // Use expense categories hook for dynamic category labels/colors
  const { getCategoryLabel, getCategoryColor } = useExpenseCategories();

  // Data states
  const [expenses, setExpenses] = useState<ExpenseListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);

  // Filter states
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'paid'>(initialFilter);
  const [filters, setFilters] = useState<ExpenseFilterState>(initialFilterState);

  // Load expenses
  const loadExpenses = useCallback(async (append = false, silent = false) => {
    try {
      if (append) {
        setLoadingMore(true);
      } else if (!silent) {
        setLoading(true);
      }
      setError(null);

      const skip = append ? expenses.length : 0;
      const data = await globalAccountingService.getGlobalExpenses({
        limit: pageSize,
        skip
      });

      if (append) {
        setExpenses(prev => [...prev, ...data]);
      } else {
        setExpenses(data);
      }

      setHasMore(data.length === pageSize);
    } catch (err) {
      console.error('Error loading expenses:', err);
      setError(getErrorMessage(err, 'Error al cargar gastos'));
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [expenses.length, pageSize]);

  // Initial load
  useEffect(() => {
    loadExpenses();
  }, []);

  // Filter expenses
  const filteredExpenses = useMemo(() => {
    let filtered = expenses;

    // Status filter
    if (statusFilter === 'pending') {
      filtered = filtered.filter(e => !e.is_paid);
    } else if (statusFilter === 'paid') {
      filtered = filtered.filter(e => e.is_paid);
    }

    // Date range
    if (filters.startDate) {
      filtered = filtered.filter(e => e.expense_date >= filters.startDate);
    }
    if (filters.endDate) {
      filtered = filtered.filter(e => e.expense_date <= filters.endDate);
    }

    // Category
    if (filters.category) {
      filtered = filtered.filter(e => e.category === filters.category);
    }

    // Amount range
    if (filters.minAmount > 0) {
      filtered = filtered.filter(e => Number(e.amount) >= filters.minAmount);
    }
    if (filters.maxAmount > 0) {
      filtered = filtered.filter(e => Number(e.amount) <= filters.maxAmount);
    }

    // Payment account
    if (filters.paymentAccountId && cashBalances) {
      const accountNameMap: Record<string, string> = {};
      if (cashBalances.caja_menor?.id) accountNameMap[cashBalances.caja_menor.id] = 'Caja Menor';
      if (cashBalances.caja_mayor?.id) accountNameMap[cashBalances.caja_mayor.id] = 'Caja Mayor';
      if (cashBalances.nequi?.id) accountNameMap[cashBalances.nequi.id] = 'Nequi';
      if (cashBalances.banco?.id) accountNameMap[cashBalances.banco.id] = 'Banco';
      const targetName = accountNameMap[filters.paymentAccountId];
      if (targetName) {
        filtered = filtered.filter(e => e.payment_account_name === targetName);
      }
    }

    // Vendor/description/category search
    if (filters.vendor) {
      const searchTerm = filters.vendor.toLowerCase();
      filtered = filtered.filter(e => {
        // Search in vendor
        if (e.vendor?.toLowerCase().includes(searchTerm)) return true;
        // Search in description
        if (e.description.toLowerCase().includes(searchTerm)) return true;
        // Search in category code
        if (e.category.toLowerCase().includes(searchTerm)) return true;
        // Search in category label (using dynamic categories)
        const categoryLabel = getCategoryLabel(e.category);
        if (categoryLabel.toLowerCase().includes(searchTerm)) return true;
        return false;
      });
    }

    return filtered;
  }, [expenses, statusFilter, filters, cashBalances, getCategoryLabel]);

  // Calculate statistics - dynamically from actual expense categories
  const stats = useMemo((): ExpenseStats => {
    const pending = filteredExpenses.filter(e => !e.is_paid);
    const paid = filteredExpenses.filter(e => e.is_paid);

    // Build category stats dynamically from actual expenses
    const categoryMap = new Map<string, { amount: number; count: number; label: string; color: string }>();

    for (const expense of filteredExpenses) {
      const cat = expense.category;
      const existing = categoryMap.get(cat);

      if (existing) {
        existing.amount += Number(expense.amount);
        existing.count += 1;
      } else {
        // Use dynamic category helpers from useExpenseCategories hook
        const label = getCategoryLabel(cat);
        const color = getCategoryColor(cat);

        categoryMap.set(cat, {
          amount: Number(expense.amount),
          count: 1,
          label,
          color
        });
      }
    }

    const byCategory: CategoryChartData[] = Array.from(categoryMap.entries())
      .map(([category, data]) => ({
        category: category as ExpenseCategory,
        label: data.label,
        amount: data.amount,
        count: data.count,
        color: data.color
      }))
      .sort((a, b) => b.amount - a.amount);

    return {
      totalAmount: filteredExpenses.reduce((sum, e) => sum + Number(e.amount), 0),
      totalCount: filteredExpenses.length,
      pendingAmount: pending.reduce((sum, e) => sum + Number(e.balance), 0),
      pendingCount: pending.length,
      paidAmount: paid.reduce((sum, e) => sum + Number(e.amount), 0),
      paidCount: paid.length,
      averageAmount: filteredExpenses.length > 0
        ? filteredExpenses.reduce((sum, e) => sum + Number(e.amount), 0) / filteredExpenses.length
        : 0,
      byCategory,
      maxCategoryAmount: byCategory.length > 0 ? byCategory[0].amount : 0
    };
  }, [filteredExpenses, getCategoryLabel, getCategoryColor]);

  // Check if any filter is active
  const hasActiveFilters = useMemo(() => {
    return filters.startDate !== '' ||
           filters.endDate !== '' ||
           filters.category !== '' ||
           filters.minAmount > 0 ||
           filters.maxAmount > 0 ||
           filters.paymentAccountId !== '' ||
           filters.vendor !== '';
  }, [filters]);

  // Clear filters
  const clearFilters = useCallback(() => {
    setFilters(initialFilterState);
  }, []);

  // Load more
  const loadMore = useCallback(async () => {
    if (!loadingMore && hasMore) {
      await loadExpenses(true);
    }
  }, [loadingMore, hasMore, loadExpenses]);

  // Refresh (silent = no full-screen spinner, just update data in place)
  const refresh = useCallback(async () => {
    await loadExpenses(false, true);
  }, [loadExpenses]);

  // Export to CSV
  const exportCSV = useCallback(() => {
    const headers = ['Fecha', 'Categoria', 'Descripcion', 'Vendedor', 'Monto', 'Pagado', 'Pendiente', 'Estado', 'Metodo Pago', 'Cuenta'];

    const rows = filteredExpenses.map(e => [
      e.expense_date,
      getCategoryLabel(e.category),
      `"${e.description.replace(/"/g, '""')}"`,
      e.vendor || '',
      Number(e.amount),
      Number(e.amount_paid),
      Number(e.balance),
      e.is_paid ? 'Pagado' : 'Pendiente',
      e.payment_method || '',
      e.payment_account_name || ''
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `gastos_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  }, [filteredExpenses, getCategoryLabel]);

  return {
    // Data
    expenses,
    filteredExpenses,
    stats,
    loading,
    error,

    // Filters
    statusFilter,
    setStatusFilter,
    filters,
    setFilters,
    clearFilters,
    hasActiveFilters,

    // Pagination
    hasMore,
    loadingMore,
    loadMore,

    // Actions
    refresh,
    exportCSV
  };
}

export default useExpenses;
