/**
 * Tests for web-portal/lib/utils.ts
 * Tests all utility functions for formatting, error handling, and strings
 */
import { describe, it, expect } from 'vitest';
import {
  formatPrice,
  formatCurrency,
  formatNumber,
  formatDate,
  formatDateTime,
  getErrorMessage,
  truncate,
  cn,
} from '../utils';

describe('Currency Formatting', () => {
  describe('formatPrice', () => {
    it('formats positive numbers as Colombian Pesos', () => {
      expect(formatPrice(50000)).toMatch(/\$\s?50[.,]000/);
    });

    it('formats zero', () => {
      expect(formatPrice(0)).toMatch(/\$\s?0/);
    });

    it('formats large numbers with thousand separators', () => {
      expect(formatPrice(1500000)).toMatch(/\$\s?1[.,]500[.,]000/);
    });

    it('removes decimals', () => {
      const result = formatPrice(50000.99);
      // Should not contain decimal separator followed by digits
      expect(result).not.toMatch(/[.,]\d{2}$/);
    });
  });

  describe('formatCurrency', () => {
    it('formats numbers', () => {
      expect(formatCurrency(50000)).toMatch(/\$\s?50[.,]000/);
    });

    it('formats string numbers', () => {
      expect(formatCurrency('75000')).toMatch(/\$\s?75[.,]000/);
    });

    it('handles null', () => {
      expect(formatCurrency(null)).toBe('$ 0');
    });

    it('handles undefined', () => {
      expect(formatCurrency(undefined)).toBe('$ 0');
    });

    it('handles invalid string', () => {
      expect(formatCurrency('not-a-number')).toBe('$ 0');
    });

    it('handles NaN', () => {
      expect(formatCurrency(NaN)).toBe('$ 0');
    });

    it('handles empty string', () => {
      expect(formatCurrency('')).toBe('$ 0');
    });
  });

  describe('formatNumber', () => {
    it('formats numbers with thousand separators', () => {
      const result = formatNumber(1500000);
      expect(result).toMatch(/1[.,]500[.,]000/);
    });

    it('handles null', () => {
      expect(formatNumber(null)).toBe('0');
    });

    it('handles undefined', () => {
      expect(formatNumber(undefined)).toBe('0');
    });

    it('handles NaN', () => {
      expect(formatNumber(NaN)).toBe('0');
    });

    it('handles zero', () => {
      expect(formatNumber(0)).toBe('0');
    });

    it('formats small numbers without separators', () => {
      expect(formatNumber(500)).toBe('500');
    });
  });
});

describe('Date Formatting', () => {
  describe('formatDate', () => {
    it('formats date string', () => {
      // Use a mid-month date to avoid timezone edge cases
      const result = formatDate('2024-06-15T12:00:00Z');
      expect(result).toMatch(/15/);
      expect(result).toMatch(/2024/);
    });

    it('formats Date object', () => {
      const date = new Date('2024-06-15T12:00:00Z');
      const result = formatDate(date);
      expect(result).toMatch(/2024/);
    });

    it('handles null', () => {
      expect(formatDate(null)).toBe('-');
    });

    it('handles undefined', () => {
      expect(formatDate(undefined)).toBe('-');
    });

    it('handles invalid date string', () => {
      expect(formatDate('not-a-date')).toBe('-');
    });

    it('handles empty string', () => {
      expect(formatDate('')).toBe('-');
    });
  });

  describe('formatDateTime', () => {
    it('formats datetime with time component', () => {
      const result = formatDateTime('2024-06-15T14:30:00Z');
      expect(result).toMatch(/2024/);
      // Should contain time (hour:minute format varies by locale)
      expect(result).toMatch(/\d{1,2}:\d{2}/);
    });

    it('formats Date object with time', () => {
      const date = new Date('2024-06-15T14:30:00Z');
      const result = formatDateTime(date);
      expect(result).toMatch(/2024/);
    });

    it('handles null', () => {
      expect(formatDateTime(null)).toBe('-');
    });

    it('handles undefined', () => {
      expect(formatDateTime(undefined)).toBe('-');
    });

    it('handles invalid date', () => {
      expect(formatDateTime('invalid')).toBe('-');
    });
  });
});

describe('Error Handling', () => {
  describe('getErrorMessage', () => {
    it('returns fallback for null', () => {
      expect(getErrorMessage(null, 'Fallback')).toBe('Fallback');
    });

    it('returns fallback for undefined', () => {
      expect(getErrorMessage(undefined, 'Fallback')).toBe('Fallback');
    });

    it('returns fallback for non-object', () => {
      expect(getErrorMessage('string error', 'Fallback')).toBe('Fallback');
      expect(getErrorMessage(123, 'Fallback')).toBe('Fallback');
    });

    it('extracts detail string from API response', () => {
      const error = {
        response: {
          data: {
            detail: 'User not found',
          },
        },
      };
      expect(getErrorMessage(error, 'Fallback')).toBe('User not found');
    });

    it('extracts detail array from API response', () => {
      const error = {
        response: {
          data: {
            detail: [
              { msg: 'Field required' },
              { msg: 'Invalid email' },
            ],
          },
        },
      };
      expect(getErrorMessage(error, 'Fallback')).toBe('Field required, Invalid email');
    });

    it('handles detail array with message property', () => {
      const error = {
        response: {
          data: {
            detail: [{ message: 'Error message' }],
          },
        },
      };
      expect(getErrorMessage(error, 'Fallback')).toBe('Error message');
    });

    it('extracts message from error object', () => {
      const error = { message: 'Network error' };
      expect(getErrorMessage(error, 'Fallback')).toBe('Network error');
    });

    it('handles detail object with msg', () => {
      const error = {
        response: {
          data: {
            detail: { msg: 'Detailed error' },
          },
        },
      };
      expect(getErrorMessage(error, 'Fallback')).toBe('Detailed error');
    });

    it('returns fallback when no message found', () => {
      const error = { response: { data: {} } };
      expect(getErrorMessage(error, 'Fallback')).toBe('Fallback');
    });
  });
});

describe('String Utilities', () => {
  describe('truncate', () => {
    it('returns original text if shorter than maxLength', () => {
      expect(truncate('hello', 10)).toBe('hello');
    });

    it('truncates with ellipsis', () => {
      expect(truncate('hello world', 8)).toBe('hello...');
    });

    it('handles exact length', () => {
      expect(truncate('hello', 5)).toBe('hello');
    });

    it('handles null', () => {
      expect(truncate(null, 10)).toBe('');
    });

    it('handles undefined', () => {
      expect(truncate(undefined, 10)).toBe('');
    });

    it('handles empty string', () => {
      expect(truncate('', 10)).toBe('');
    });

    it('handles maxLength of 3', () => {
      // With ellipsis, nothing remains
      expect(truncate('hello', 3)).toBe('...');
    });
  });

  describe('cn', () => {
    it('joins multiple class names', () => {
      expect(cn('class1', 'class2', 'class3')).toBe('class1 class2 class3');
    });

    it('filters out falsy values', () => {
      expect(cn('class1', false, 'class2', null, undefined, '')).toBe('class1 class2');
    });

    it('handles conditional classes', () => {
      const isActive = true;
      const isDisabled = false;
      expect(cn('base', isActive && 'active', isDisabled && 'disabled')).toBe('base active');
    });

    it('returns empty string for all falsy', () => {
      expect(cn(false, null, undefined)).toBe('');
    });

    it('handles single class', () => {
      expect(cn('single')).toBe('single');
    });
  });
});
