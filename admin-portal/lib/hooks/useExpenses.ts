'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import accountingService from '@/lib/services/accountingService';
import type { Expense, CashBalances } from '@/lib/services/accountingService';
import { useExpenseCategories } from './useExpenseCategories';

// Filter state type
export interface ExpenseFilterState {
  startDate: string;
  endDate: string;
  category: string;
  minAmount: number;
  maxAmount: number;
  paymentAccountId: string;
  vendor: string;
}

// Category chart data type
export interface CategoryChartData {
  category: string;
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

export interface UseExpensesOptions {
  initialFilter?: 'all' | 'pending' | 'paid';
  cashBalances?: CashBalances | null;
  pageSize?: number;
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

export const formatCurrency = (value: number | string): string => {
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(numValue || 0);
};

export const getErrorMessage = (err: unknown, defaultMessage: string): string => {
  if (err && typeof err === 'object' && 'response' in err) {
    const response = (err as { response?: { data?: { detail?: string } } }).response;
    if (response?.data?.detail) return response.data.detail;
  }
  if (err instanceof Error) return err.message;
  return defaultMessage;
};

export function useExpenses(options: UseExpensesOptions = {}) {
  const {
    initialFilter = 'all',
    cashBalances = null,
    pageSize = 100
  } = options;

  const { getCategoryLabel, getCategoryColor } = useExpenseCategories();

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);

  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'paid'>(initialFilter);
  const [filters, setFilters] = useState<ExpenseFilterState>(initialFilterState);

  const loadExpenses = useCallback(async (append = false, silent = false) => {
    try {
      if (append) {
        setLoadingMore(true);
      } else if (!silent) {
        setLoading(true);
      }
      setError(null);

      const skip = append ? expenses.length : 0;
      const data = await accountingService.listExpenses({
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

  useEffect(() => {
    loadExpenses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredExpenses = useMemo(() => {
    let filtered = expenses;

    if (statusFilter === 'pending') {
      filtered = filtered.filter(e => !e.is_paid);
    } else if (statusFilter === 'paid') {
      filtered = filtered.filter(e => e.is_paid);
    }

    if (filters.startDate) {
      filtered = filtered.filter(e => e.expense_date >= filters.startDate);
    }
    if (filters.endDate) {
      filtered = filtered.filter(e => e.expense_date <= filters.endDate);
    }
    if (filters.category) {
      filtered = filtered.filter(e => e.category === filters.category);
    }
    if (filters.minAmount > 0) {
      filtered = filtered.filter(e => Number(e.amount) >= filters.minAmount);
    }
    if (filters.maxAmount > 0) {
      filtered = filtered.filter(e => Number(e.amount) <= filters.maxAmount);
    }
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

  const stats = useMemo((): ExpenseStats => {
    const pending = filteredExpenses.filter(e => !e.is_paid);
    const paid = filteredExpenses.filter(e => e.is_paid);

    const categoryMap = new Map<string, { amount: number; count: number; label: string; color: string }>();

    for (const expense of filteredExpenses) {
      const cat = expense.category;
      const existing = categoryMap.get(cat);

      if (existing) {
        existing.amount += Number(expense.amount);
        existing.count += 1;
      } else {
        categoryMap.set(cat, {
          amount: Number(expense.amount),
          count: 1,
          label: getCategoryLabel(cat),
          color: getCategoryColor(cat)
        });
      }
    }

    const byCategory: CategoryChartData[] = Array.from(categoryMap.entries())
      .map(([category, data]) => ({
        category,
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

  const hasActiveFilters = useMemo(() => {
    return filters.startDate !== '' ||
           filters.endDate !== '' ||
           filters.category !== '' ||
           filters.minAmount > 0 ||
           filters.maxAmount > 0 ||
           filters.paymentAccountId !== '' ||
           filters.vendor !== '';
  }, [filters]);

  const clearFilters = useCallback(() => {
    setFilters(initialFilterState);
  }, []);

  const loadMore = useCallback(async () => {
    if (!loadingMore && hasMore) {
      await loadExpenses(true);
    }
  }, [loadingMore, hasMore, loadExpenses]);

  const refresh = useCallback(async () => {
    await loadExpenses(false, true);
  }, [loadExpenses]);

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
    expenses,
    filteredExpenses,
    stats,
    loading,
    error,
    statusFilter,
    setStatusFilter,
    filters,
    setFilters,
    clearFilters,
    hasActiveFilters,
    hasMore,
    loadingMore,
    loadMore,
    refresh,
    exportCSV
  };
}

export default useExpenses;
