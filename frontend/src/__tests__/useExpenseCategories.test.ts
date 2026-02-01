/**
 * Tests for useExpenseCategories hook
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useExpenseCategories, invalidateExpenseCategoriesCache } from '../hooks/useExpenseCategories';
import type { ExpenseCategoryListItem, ExpenseCategoryFull } from '../services/globalAccountingService';

// Create mock functions
const mockGetExpenseCategories = vi.fn();
const mockGetExpenseCategory = vi.fn();
const mockCreateExpenseCategory = vi.fn();
const mockUpdateExpenseCategory = vi.fn();
const mockDeleteExpenseCategory = vi.fn();

// Mock the globalAccountingService
vi.mock('../services/globalAccountingService', () => ({
  globalAccountingService: {
    getExpenseCategories: (...args: unknown[]) => mockGetExpenseCategories(...args),
    getExpenseCategory: (...args: unknown[]) => mockGetExpenseCategory(...args),
    createExpenseCategory: (...args: unknown[]) => mockCreateExpenseCategory(...args),
    updateExpenseCategory: (...args: unknown[]) => mockUpdateExpenseCategory(...args),
    deleteExpenseCategory: (...args: unknown[]) => mockDeleteExpenseCategory(...args),
  },
}));

// Sample test data
const mockCategories: ExpenseCategoryListItem[] = [
  {
    id: '1',
    code: 'rent',
    name: 'Arriendo',
    description: 'Pago de arriendo del local',
    color: '#EF4444',
    icon: 'home',
    is_system: true,
    is_active: true,
    display_order: 1,
  },
  {
    id: '2',
    code: 'utilities',
    name: 'Servicios Públicos',
    description: null,
    color: '#F59E0B',
    icon: 'zap',
    is_system: true,
    is_active: true,
    display_order: 2,
  },
  {
    id: '3',
    code: 'custom_cat',
    name: 'Categoría Custom',
    description: null,
    color: '#10B981',
    icon: null,
    is_system: false,
    is_active: true,
    display_order: 12,
  },
];

const mockInactiveCategory: ExpenseCategoryListItem = {
  id: '4',
  code: 'inactive_cat',
  name: 'Categoría Inactiva',
  description: null,
  color: '#9CA3AF',
  icon: null,
  is_system: false,
  is_active: false,
  display_order: 99,
};

describe('useExpenseCategories', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    invalidateExpenseCategoriesCache();
  });

  afterEach(() => {
    invalidateExpenseCategoriesCache();
  });

  describe('loading categories', () => {
    it('loads categories on mount by default', async () => {
      mockGetExpenseCategories.mockResolvedValue(mockCategories);

      const { result } = renderHook(() => useExpenseCategories());

      // Initially loading
      expect(result.current.loading).toBe(true);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.categories).toHaveLength(3);
      expect(result.current.error).toBeNull();
      expect(mockGetExpenseCategories).toHaveBeenCalledWith(false);
    });

    it('does not load automatically when autoLoad is false', async () => {
      // Clear any potential cache
      invalidateExpenseCategoriesCache();

      const { result } = renderHook(() => useExpenseCategories({ autoLoad: false }));

      // When autoLoad is false and no cache, loading should be false
      // (the hook only sets loading=true when it actually starts loading)
      await waitFor(() => {
        expect(result.current.categories).toHaveLength(0);
      });

      expect(mockGetExpenseCategories).not.toHaveBeenCalled();
    });

    it('includes inactive categories when includeInactive is true', async () => {
      mockGetExpenseCategories.mockResolvedValue([
        ...mockCategories,
        mockInactiveCategory,
      ]);

      const { result } = renderHook(() =>
        useExpenseCategories({ includeInactive: true })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.categories).toHaveLength(4);
      expect(mockGetExpenseCategories).toHaveBeenCalledWith(true);
    });

    it('handles API errors gracefully', async () => {
      mockGetExpenseCategories.mockRejectedValue(new Error('API Error'));

      const { result } = renderHook(() => useExpenseCategories());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBe('API Error');
      expect(result.current.categories).toHaveLength(0);
    });
  });

  describe('helper functions', () => {
    it('getCategoryByCode returns correct category', async () => {
      mockGetExpenseCategories.mockResolvedValue(mockCategories);

      const { result } = renderHook(() => useExpenseCategories());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const category = result.current.getCategoryByCode('rent');
      expect(category).toBeDefined();
      expect(category?.name).toBe('Arriendo');
    });

    it('getCategoryById returns correct category', async () => {
      mockGetExpenseCategories.mockResolvedValue(mockCategories);

      const { result } = renderHook(() => useExpenseCategories());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const category = result.current.getCategoryById('1');
      expect(category).toBeDefined();
      expect(category?.code).toBe('rent');
    });

    it('getCategoryLabel returns name or code as fallback', async () => {
      mockGetExpenseCategories.mockResolvedValue(mockCategories);

      const { result } = renderHook(() => useExpenseCategories());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.getCategoryLabel('rent')).toBe('Arriendo');
      expect(result.current.getCategoryLabel('unknown')).toBe('unknown');
    });

    it('getCategoryColor returns color or default gray', async () => {
      mockGetExpenseCategories.mockResolvedValue(mockCategories);

      const { result } = renderHook(() => useExpenseCategories());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.getCategoryColor('rent')).toBe('#EF4444');
      expect(result.current.getCategoryColor('unknown')).toBe('#9CA3AF');
    });
  });

  describe('computed properties', () => {
    it('activeCategories filters out inactive ones', async () => {
      mockGetExpenseCategories.mockResolvedValue([
        ...mockCategories,
        mockInactiveCategory,
      ]);

      const { result } = renderHook(() =>
        useExpenseCategories({ includeInactive: true })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.categories).toHaveLength(4);
      expect(result.current.activeCategories).toHaveLength(3);
    });

    it('systemCategories returns only system categories', async () => {
      mockGetExpenseCategories.mockResolvedValue(mockCategories);

      const { result } = renderHook(() => useExpenseCategories());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.systemCategories).toHaveLength(2);
      expect(result.current.systemCategories.every((c) => c.is_system)).toBe(true);
    });

    it('customCategories returns only non-system categories', async () => {
      mockGetExpenseCategories.mockResolvedValue(mockCategories);

      const { result } = renderHook(() => useExpenseCategories());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.customCategories).toHaveLength(1);
      expect(result.current.customCategories.every((c) => !c.is_system)).toBe(true);
    });
  });

  describe('CRUD operations', () => {
    it('createCategory calls API and refreshes', async () => {
      mockGetExpenseCategories.mockResolvedValue(mockCategories);

      const newCategory: ExpenseCategoryFull = {
        id: '5',
        code: 'new_cat',
        name: 'Nueva Categoría',
        description: 'Test',
        color: '#FF0000',
        icon: null,
        is_system: false,
        is_active: true,
        display_order: 13,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      mockCreateExpenseCategory.mockResolvedValue(newCategory);

      const { result } = renderHook(() => useExpenseCategories());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Create category
      await act(async () => {
        await result.current.createCategory({
          code: 'new_cat',
          name: 'Nueva Categoría',
          color: '#FF0000',
        });
      });

      expect(mockCreateExpenseCategory).toHaveBeenCalled();
      // Should have refreshed (called getExpenseCategories again)
      expect(mockGetExpenseCategories).toHaveBeenCalledTimes(2);
    });

    it('updateCategory calls API and refreshes', async () => {
      mockGetExpenseCategories.mockResolvedValue(mockCategories);

      const updatedCategory: ExpenseCategoryFull = {
        id: '3',
        code: 'custom_cat',
        name: 'Categoría Actualizada',
        description: null,
        color: '#00FF00',
        icon: null,
        is_system: false,
        is_active: true,
        display_order: 12,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z',
      };

      mockUpdateExpenseCategory.mockResolvedValue(updatedCategory);

      const { result } = renderHook(() => useExpenseCategories());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.updateCategory('3', {
          name: 'Categoría Actualizada',
          color: '#00FF00',
        });
      });

      expect(mockUpdateExpenseCategory).toHaveBeenCalledWith('3', {
        name: 'Categoría Actualizada',
        color: '#00FF00',
      });
    });

    it('deleteCategory calls API and refreshes', async () => {
      mockGetExpenseCategories.mockResolvedValue(mockCategories);
      mockDeleteExpenseCategory.mockResolvedValue(undefined);

      const { result } = renderHook(() => useExpenseCategories());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.deleteCategory('3');
      });

      expect(mockDeleteExpenseCategory).toHaveBeenCalledWith('3');
      // Should have refreshed
      expect(mockGetExpenseCategories).toHaveBeenCalledTimes(2);
    });
  });

  describe('refresh', () => {
    it('forces reload bypassing cache', async () => {
      mockGetExpenseCategories.mockResolvedValue(mockCategories);

      const { result } = renderHook(() => useExpenseCategories());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Call refresh
      await act(async () => {
        await result.current.refresh();
      });

      // Should have called API twice (initial + refresh)
      expect(mockGetExpenseCategories).toHaveBeenCalledTimes(2);
    });
  });
});
