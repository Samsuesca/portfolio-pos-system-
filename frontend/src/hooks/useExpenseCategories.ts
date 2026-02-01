/**
 * useExpenseCategories - Custom hook for expense category management
 *
 * Provides state management for expense categories with caching.
 * Used by ExpenseCategoryManager and ExpenseFilters components.
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  globalAccountingService,
  type ExpenseCategoryListItem,
  type ExpenseCategoryFull,
  type ExpenseCategoryCreate,
  type ExpenseCategoryUpdate
} from '../services/globalAccountingService';

// Default category colors for the color picker
export const DEFAULT_CATEGORY_COLORS = [
  '#EF4444', // Red
  '#F59E0B', // Amber
  '#10B981', // Emerald
  '#3B82F6', // Blue
  '#8B5CF6', // Violet
  '#EC4899', // Pink
  '#6366F1', // Indigo
  '#14B8A6', // Teal
  '#F97316', // Orange
  '#64748B', // Slate
  '#9CA3AF', // Gray
  '#22C55E', // Green
  '#06B6D4', // Cyan
  '#A855F7', // Purple
  '#84CC16', // Lime
];

// Category icons (lucide-react icon names)
export const CATEGORY_ICONS = [
  'home',
  'zap',
  'users',
  'package',
  'box',
  'truck',
  'wrench',
  'megaphone',
  'receipt',
  'credit-card',
  'more-horizontal',
  'shopping-cart',
  'building-2',
  'phone',
  'wifi',
  'car',
  'tool',
  'folder',
  'file-text',
  'dollar-sign',
];

// Hook options
export interface UseExpenseCategoriesOptions {
  includeInactive?: boolean;
  autoLoad?: boolean;
}

// Hook return type
export interface UseExpenseCategoriesReturn {
  // Data
  categories: ExpenseCategoryListItem[];
  loading: boolean;
  error: string | null;

  // Actions
  refresh: () => Promise<void>;
  createCategory: (data: ExpenseCategoryCreate) => Promise<ExpenseCategoryFull>;
  updateCategory: (id: string, data: ExpenseCategoryUpdate) => Promise<ExpenseCategoryFull>;
  deleteCategory: (id: string) => Promise<void>;
  permanentDeleteCategory: (id: string) => Promise<void>;

  // Helpers
  getCategoryByCode: (code: string) => ExpenseCategoryListItem | undefined;
  getCategoryById: (id: string) => ExpenseCategoryListItem | undefined;
  getCategoryLabel: (code: string) => string;
  getCategoryColor: (code: string) => string;
  activeCategories: ExpenseCategoryListItem[];
  systemCategories: ExpenseCategoryListItem[];
  customCategories: ExpenseCategoryListItem[];
}

// Cache for categories
let cachedCategories: ExpenseCategoryListItem[] | null = null;
let cacheTimestamp: number = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Helper to get error message
const getErrorMessage = (err: unknown, defaultMessage: string): string => {
  if (err && typeof err === 'object' && 'response' in err) {
    const response = (err as { response?: { data?: { detail?: string } } }).response;
    if (response?.data?.detail) return response.data.detail;
  }
  if (err instanceof Error) return err.message;
  return defaultMessage;
};

/**
 * useExpenseCategories hook
 */
export function useExpenseCategories(
  options: UseExpenseCategoriesOptions = {}
): UseExpenseCategoriesReturn {
  const { includeInactive = false, autoLoad = true } = options;

  const [categories, setCategories] = useState<ExpenseCategoryListItem[]>(
    cachedCategories || []
  );
  const [loading, setLoading] = useState(!cachedCategories);
  const [error, setError] = useState<string | null>(null);

  // Load categories
  const loadCategories = useCallback(async (forceRefresh = false) => {
    // Check cache first (if not including inactive and not forcing refresh)
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

      const data = await globalAccountingService.getExpenseCategories(includeInactive);
      setCategories(data);

      // Update cache only for active categories
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

  // Initial load
  useEffect(() => {
    if (autoLoad) {
      loadCategories();
    }
  }, [autoLoad, loadCategories]);

  // Refresh (force reload)
  const refresh = useCallback(async () => {
    await loadCategories(true);
  }, [loadCategories]);

  // Create category
  const createCategory = useCallback(async (data: ExpenseCategoryCreate) => {
    const created = await globalAccountingService.createExpenseCategory(data);
    // Invalidate cache and reload
    cachedCategories = null;
    await loadCategories(true);
    return created;
  }, [loadCategories]);

  // Update category
  const updateCategory = useCallback(async (id: string, data: ExpenseCategoryUpdate) => {
    const updated = await globalAccountingService.updateExpenseCategory(id, data);
    // Invalidate cache and reload
    cachedCategories = null;
    await loadCategories(true);
    return updated;
  }, [loadCategories]);

  // Delete category
  const deleteCategory = useCallback(async (id: string) => {
    await globalAccountingService.deleteExpenseCategory(id);
    // Invalidate cache and reload
    cachedCategories = null;
    await loadCategories(true);
  }, [loadCategories]);

  // Permanent delete category (for inactive categories)
  const permanentDeleteCategory = useCallback(async (id: string): Promise<void> => {
    await globalAccountingService.permanentDeleteExpenseCategory(id);
    cachedCategories = null;
    cacheTimestamp = 0;
    await loadCategories(true);
  }, [loadCategories]);

  // Helper: Get category by code
  const getCategoryByCode = useCallback(
    (code: string) => categories.find((c) => c.code === code),
    [categories]
  );

  // Helper: Get category by ID
  const getCategoryById = useCallback(
    (id: string) => categories.find((c) => c.id === id),
    [categories]
  );

  // Helper: Get category label
  const getCategoryLabel = useCallback(
    (code: string) => {
      const category = categories.find((c) => c.code === code);
      return category?.name || code;
    },
    [categories]
  );

  // Helper: Get category color
  const getCategoryColor = useCallback(
    (code: string) => {
      const category = categories.find((c) => c.code === code);
      return category?.color || '#9CA3AF';
    },
    [categories]
  );

  // Computed: Active categories only
  const activeCategories = useMemo(
    () => categories.filter((c) => c.is_active),
    [categories]
  );

  // Computed: System categories
  const systemCategories = useMemo(
    () => categories.filter((c) => c.is_system),
    [categories]
  );

  // Computed: Custom (non-system) categories
  const customCategories = useMemo(
    () => categories.filter((c) => !c.is_system),
    [categories]
  );

  return {
    // Data
    categories,
    loading,
    error,

    // Actions
    refresh,
    createCategory,
    updateCategory,
    deleteCategory,
    permanentDeleteCategory,

    // Helpers
    getCategoryByCode,
    getCategoryById,
    getCategoryLabel,
    getCategoryColor,
    activeCategories,
    systemCategories,
    customCategories,
  };
}

/**
 * Invalidate the categories cache
 * Call this when categories might have changed externally
 */
export function invalidateExpenseCategoriesCache(): void {
  cachedCategories = null;
  cacheTimestamp = 0;
}

export default useExpenseCategories;
