'use client';

import { useState, useEffect, useCallback } from 'react';

const MAX_HISTORY_ITEMS = 10;

/**
 * Hook for managing search history in localStorage
 * Persists search queries per school for quick access
 */
export function useSearchHistory(schoolSlug: string) {
  const [history, setHistory] = useState<string[]>([]);

  const storageKey = `search_history_${schoolSlug}`;

  // Load history from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setHistory(parsed);
        }
      }
    } catch (error) {
      console.error('Failed to load search history:', error);
    }
  }, [storageKey]);

  // Add a query to history
  const addToHistory = useCallback(
    (query: string) => {
      if (!query.trim()) return;

      setHistory((prev) => {
        // Remove duplicate and add to front
        const newHistory = [query, ...prev.filter((q) => q !== query)].slice(
          0,
          MAX_HISTORY_ITEMS
        );

        // Persist to localStorage
        try {
          localStorage.setItem(storageKey, JSON.stringify(newHistory));
        } catch (error) {
          console.error('Failed to save search history:', error);
        }

        return newHistory;
      });
    },
    [storageKey]
  );

  // Clear all history
  const clearHistory = useCallback(() => {
    setHistory([]);
    try {
      localStorage.removeItem(storageKey);
    } catch (error) {
      console.error('Failed to clear search history:', error);
    }
  }, [storageKey]);

  // Remove a specific item from history
  const removeFromHistory = useCallback(
    (query: string) => {
      setHistory((prev) => {
        const newHistory = prev.filter((q) => q !== query);
        try {
          localStorage.setItem(storageKey, JSON.stringify(newHistory));
        } catch (error) {
          console.error('Failed to update search history:', error);
        }
        return newHistory;
      });
    },
    [storageKey]
  );

  return {
    history,
    addToHistory,
    clearHistory,
    removeFromHistory,
  };
}
