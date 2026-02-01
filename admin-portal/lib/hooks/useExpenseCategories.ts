'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import accountingService from '@/lib/services/accountingService';
import type {
  ExpenseCategoryListItem,
  ExpenseCategoryFull,
  ExpenseCategoryCreate,
  ExpenseCategoryUpdate
} from '@/lib/services/accountingService';

export const DEFAULT_CATEGORY_COLORS = [
  '#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6',
  '#EC4899', '#6366F1', '#14B8A6', '#F97316', '#64748B',
  '#9CA3AF', '#22C55E', '#06B6D4', '#A855F7', '#84CC16',
];

export interface UseExpenseCategoriesOptions {
  includeInactive?: boolean;
  autoLoad?: boolean;
}

// Cache
let cachedCategories: ExpenseCategoryListItem[] | null = null;
let cacheTimestamp: number = 0;
const CACHE_TTL = 5 * 60 * 1000;

const getErrorMessage = (err: unknown, defaultMessage: string): string => {
  if (err && typeof err === 'object' && 'response' in err) {
    const response = (err as { response?: { data?: { detail?: string } } }).response;
    if (response?.data?.detail) return response.data.detail;
  }
  if (err instanceof Error) return err.message;
  return defaultMessage;
};

export function useExpenseCategories(options: UseExpenseCategoriesOptions = {}) {
  const { includeInactive = false, autoLoad = true } = options;

  const [categories, setCategories] = useState<ExpenseCategoryListItem[]>(cachedCategories || []);
  const [loading, setLoading] = useState(!cachedCategories);
  const [error, setError] = useState<string | null>(null);

  const loadCategories = useCallback(async (forceRefresh = false) => {
    if (
      !forceRefresh &&
      !includeInactive &&
      cachedCategories &&
      Date.now() - cacheTimestamp < CACHE_TTL
    ) {
      setCategories(cachedCategories);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await accountingService.getExpenseCategories(includeInactive);
      setCategories(data);
      if (!includeInactive) {
        cachedCategories = data;
        cacheTimestamp = Date.now();
      }
    } catch (err) {
      console.error('Error loading expense categories:', err);
      setError(getErrorMessage(err, 'Error al cargar categorías'));
    } finally {
      setLoading(false);
    }
  }, [includeInactive]);

  useEffect(() => {
    if (autoLoad) {
      loadCategories();
    }
  }, [autoLoad, loadCategories]);

  const refresh = useCallback(async () => {
    await loadCategories(true);
  }, [loadCategories]);

  const createCategory = useCallback(async (data: ExpenseCategoryCreate): Promise<ExpenseCategoryFull> => {
    const created = await accountingService.createExpenseCategory(data);
    cachedCategories = null;
    await loadCategories(true);
    return created;
  }, [loadCategories]);

  const updateCategory = useCallback(async (id: string, data: ExpenseCategoryUpdate): Promise<ExpenseCategoryFull> => {
    const updated = await accountingService.updateExpenseCategory(id, data);
    cachedCategories = null;
    await loadCategories(true);
    return updated;
  }, [loadCategories]);

  const deleteCategory = useCallback(async (id: string) => {
    await accountingService.deleteExpenseCategory(id);
    cachedCategories = null;
    await loadCategories(true);
  }, [loadCategories]);

  const permanentDeleteCategory = useCallback(async (id: string): Promise<void> => {
    await accountingService.permanentDeleteExpenseCategory(id);
    cachedCategories = null;
    cacheTimestamp = 0;
    await loadCategories(true);
  }, [loadCategories]);

  const getCategoryByCode = useCallback(
    (code: string) => categories.find((c) => c.code === code),
    [categories]
  );

  const getCategoryById = useCallback(
    (id: string) => categories.find((c) => c.id === id),
    [categories]
  );

  const getCategoryLabel = useCallback(
    (code: string) => {
      const category = categories.find((c) => c.code === code);
      return category?.name || code;
    },
    [categories]
  );

  const getCategoryColor = useCallback(
    (code: string) => {
      const category = categories.find((c) => c.code === code);
      return category?.color || '#9CA3AF';
    },
    [categories]
  );

  const activeCategories = useMemo(() => categories.filter((c) => c.is_active), [categories]);
  const systemCategories = useMemo(() => categories.filter((c) => c.is_system), [categories]);
  const customCategories = useMemo(() => categories.filter((c) => !c.is_system), [categories]);

  return {
    categories,
    loading,
    error,
    refresh,
    createCategory,
    updateCategory,
    deleteCategory,
    permanentDeleteCategory,
    getCategoryByCode,
    getCategoryById,
    getCategoryLabel,
    getCategoryColor,
    activeCategories,
    systemCategories,
    customCategories,
  };
}

export function invalidateExpenseCategoriesCache(): void {
  cachedCategories = null;
  cacheTimestamp = 0;
}

export default useExpenseCategories;
