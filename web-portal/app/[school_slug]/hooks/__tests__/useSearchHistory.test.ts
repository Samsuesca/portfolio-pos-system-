/**
 * Tests for useSearchHistory hook
 * Tests localStorage persistence and history management
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSearchHistory } from '../useSearchHistory';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    get store() {
      return store;
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

describe('useSearchHistory', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  it('returns empty history initially', () => {
    const { result } = renderHook(() => useSearchHistory('test-school'));
    expect(result.current.history).toEqual([]);
  });

  it('loads history from localStorage on mount', () => {
    const savedHistory = ['query1', 'query2'];
    localStorageMock.setItem(
      'search_history_test-school',
      JSON.stringify(savedHistory)
    );

    const { result } = renderHook(() => useSearchHistory('test-school'));

    // Wait for useEffect to run
    expect(result.current.history).toEqual(savedHistory);
  });

  it('uses school-specific storage key', () => {
    renderHook(() => useSearchHistory('school-a'));
    renderHook(() => useSearchHistory('school-b'));

    expect(localStorageMock.getItem).toHaveBeenCalledWith('search_history_school-a');
    expect(localStorageMock.getItem).toHaveBeenCalledWith('search_history_school-b');
  });

  describe('addToHistory', () => {
    it('adds query to history', () => {
      const { result } = renderHook(() => useSearchHistory('test-school'));

      act(() => {
        result.current.addToHistory('new query');
      });

      expect(result.current.history).toContain('new query');
    });

    it('adds new queries to front', () => {
      const { result } = renderHook(() => useSearchHistory('test-school'));

      act(() => {
        result.current.addToHistory('first');
        result.current.addToHistory('second');
      });

      expect(result.current.history[0]).toBe('second');
      expect(result.current.history[1]).toBe('first');
    });

    it('removes duplicates when adding', () => {
      const { result } = renderHook(() => useSearchHistory('test-school'));

      act(() => {
        result.current.addToHistory('query');
        result.current.addToHistory('other');
        result.current.addToHistory('query'); // duplicate
      });

      const queryCount = result.current.history.filter((q) => q === 'query').length;
      expect(queryCount).toBe(1);
      expect(result.current.history[0]).toBe('query'); // Should be at front
    });

    it('persists to localStorage', () => {
      const { result } = renderHook(() => useSearchHistory('test-school'));

      act(() => {
        result.current.addToHistory('saved query');
      });

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'search_history_test-school',
        expect.stringContaining('saved query')
      );
    });

    it('limits history to 10 items', () => {
      const { result } = renderHook(() => useSearchHistory('test-school'));

      act(() => {
        for (let i = 1; i <= 15; i++) {
          result.current.addToHistory(`query${i}`);
        }
      });

      expect(result.current.history.length).toBe(10);
      // Most recent should be first
      expect(result.current.history[0]).toBe('query15');
      // Oldest should be pushed out
      expect(result.current.history).not.toContain('query1');
    });

    it('ignores empty queries', () => {
      const { result } = renderHook(() => useSearchHistory('test-school'));

      act(() => {
        result.current.addToHistory('');
        result.current.addToHistory('   ');
      });

      expect(result.current.history).toEqual([]);
    });
  });

  describe('clearHistory', () => {
    it('clears all history', () => {
      const { result } = renderHook(() => useSearchHistory('test-school'));

      act(() => {
        result.current.addToHistory('query1');
        result.current.addToHistory('query2');
        result.current.clearHistory();
      });

      expect(result.current.history).toEqual([]);
    });

    it('removes from localStorage', () => {
      const { result } = renderHook(() => useSearchHistory('test-school'));

      act(() => {
        result.current.addToHistory('query');
        result.current.clearHistory();
      });

      expect(localStorageMock.removeItem).toHaveBeenCalledWith(
        'search_history_test-school'
      );
    });
  });

  describe('removeFromHistory', () => {
    it('removes specific query', () => {
      const { result } = renderHook(() => useSearchHistory('test-school'));

      act(() => {
        result.current.addToHistory('keep');
        result.current.addToHistory('remove');
        result.current.removeFromHistory('remove');
      });

      expect(result.current.history).toContain('keep');
      expect(result.current.history).not.toContain('remove');
    });

    it('does nothing for non-existent query', () => {
      const { result } = renderHook(() => useSearchHistory('test-school'));

      act(() => {
        result.current.addToHistory('exists');
        result.current.removeFromHistory('nonexistent');
      });

      expect(result.current.history).toEqual(['exists']);
    });

    it('updates localStorage', () => {
      const { result } = renderHook(() => useSearchHistory('test-school'));

      act(() => {
        result.current.addToHistory('query');
        result.current.removeFromHistory('query');
      });

      expect(localStorageMock.setItem).toHaveBeenLastCalledWith(
        'search_history_test-school',
        '[]'
      );
    });
  });

  describe('error handling', () => {
    it('handles localStorage.getItem errors gracefully', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      localStorageMock.getItem.mockImplementationOnce(() => {
        throw new Error('Storage error');
      });

      const { result } = renderHook(() => useSearchHistory('test-school'));

      expect(result.current.history).toEqual([]);
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('handles invalid JSON in localStorage', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      localStorageMock.getItem.mockReturnValueOnce('invalid json{');

      const { result } = renderHook(() => useSearchHistory('test-school'));

      expect(result.current.history).toEqual([]);

      consoleSpy.mockRestore();
    });

    it('handles localStorage.setItem errors gracefully', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      localStorageMock.setItem.mockImplementationOnce(() => {
        throw new Error('Quota exceeded');
      });

      const { result } = renderHook(() => useSearchHistory('test-school'));

      act(() => {
        result.current.addToHistory('test');
      });

      // Should still update state even if storage fails
      expect(result.current.history).toContain('test');
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });
});
