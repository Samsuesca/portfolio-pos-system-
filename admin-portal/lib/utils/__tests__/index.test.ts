import { describe, it, expect } from 'vitest';
import {
  formatCurrency,
  formatNumber,
  formatDate,
  formatDateTime,
  formatTime,
  formatDateForAPI,
  getRelativeTime,
  getErrorMessage,
  truncate,
  capitalize,
  getInitials,
  isValidEmail,
  isValidPhone,
  cn,
} from '../index';

// ============================================
// Currency Formatting Tests
// ============================================

describe('formatCurrency', () => {
  it('formats positive numbers correctly', () => {
    const result = formatCurrency(150000);
    expect(result).toMatch(/150[.,]000/);
    expect(result).toContain('$');
  });

  it('formats zero correctly', () => {
    expect(formatCurrency(0)).toContain('0');
  });

  it('handles null', () => {
    expect(formatCurrency(null)).toBe('$ 0');
  });

  it('handles undefined', () => {
    expect(formatCurrency(undefined)).toBe('$ 0');
  });

  it('handles NaN', () => {
    expect(formatCurrency(NaN)).toBe('$ 0');
  });

  it('handles negative numbers', () => {
    const result = formatCurrency(-50000);
    expect(result).toMatch(/-.*50[.,]000/);
  });

  it('shows decimals when option is set', () => {
    const result = formatCurrency(1500.5, { showDecimals: true });
    expect(result).toMatch(/1[.,]500[.,]50/);
  });

  it('handles string values from API', () => {
    const result = formatCurrency('150000.50');
    expect(result).toMatch(/150[.,]001/);
  });

  it('handles invalid string values', () => {
    expect(formatCurrency('not-a-number')).toBe('$ 0');
  });
});

describe('formatNumber', () => {
  it('formats positive numbers with thousand separators', () => {
    const result = formatNumber(1500000);
    expect(result).toMatch(/1[.,]500[.,]000/);
  });

  it('handles null', () => {
    expect(formatNumber(null)).toBe('0');
  });

  it('handles undefined', () => {
    expect(formatNumber(undefined)).toBe('0');
  });
});

// ============================================
// Date Formatting Tests
// ============================================

describe('formatDate', () => {
  it('formats ISO date strings', () => {
    const result = formatDate('2024-01-15T12:00:00Z');
    // Should contain day, month abbreviation, and year
    expect(result).toMatch(/15/);
    expect(result).toMatch(/2024/);
  });

  it('formats Date objects', () => {
    const date = new Date('2024-06-20T10:30:00Z');
    const result = formatDate(date);
    expect(result).toMatch(/20/);
    expect(result).toMatch(/2024/);
  });

  it('handles null', () => {
    expect(formatDate(null)).toBe('-');
  });

  it('handles undefined', () => {
    expect(formatDate(undefined)).toBe('-');
  });

  it('handles invalid date strings', () => {
    expect(formatDate('not-a-date')).toBe('-');
  });

  it('handles empty string', () => {
    expect(formatDate('')).toBe('-');
  });
});

describe('formatDateTime', () => {
  it('includes time in the output', () => {
    const result = formatDateTime('2024-01-15T14:30:00Z');
    // Should contain date and time
    expect(result).toMatch(/15/);
    expect(result).toMatch(/2024/);
    // Time should be present (format may vary)
    expect(result.length).toBeGreaterThan(formatDate('2024-01-15T14:30:00Z').length);
  });

  it('handles null', () => {
    expect(formatDateTime(null)).toBe('-');
  });
});

describe('formatTime', () => {
  it('formats time correctly', () => {
    const result = formatTime('2024-01-15T14:30:00Z');
    // Should contain hour and minute
    expect(result).toMatch(/\d{1,2}:\d{2}/);
  });

  it('handles null', () => {
    expect(formatTime(null)).toBe('-');
  });
});

describe('formatDateForAPI', () => {
  it('returns YYYY-MM-DD format', () => {
    const date = new Date('2024-06-15T10:00:00Z');
    const result = formatDateForAPI(date);
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('getRelativeTime', () => {
  it('returns "ahora" for very recent times', () => {
    const now = new Date();
    expect(getRelativeTime(now)).toBe('ahora');
  });

  it('handles null', () => {
    expect(getRelativeTime(null)).toBe('-');
  });

  it('handles old dates by returning formatted date', () => {
    // Use a date in the middle of the month to avoid timezone edge cases
    const oldDate = new Date('2020-06-15T12:00:00Z');
    const result = getRelativeTime(oldDate);
    expect(result).toMatch(/2020/);
  });
});

// ============================================
// Error Handling Tests
// ============================================

describe('getErrorMessage', () => {
  it('extracts string detail from axios error', () => {
    const error = {
      response: {
        data: {
          detail: 'Usuario no encontrado',
        },
      },
    };
    expect(getErrorMessage(error, 'fallback')).toBe('Usuario no encontrado');
  });

  it('handles Pydantic validation errors (array)', () => {
    const error = {
      response: {
        data: {
          detail: [
            { msg: 'field required', loc: ['body', 'name'] },
            { msg: 'invalid email', loc: ['body', 'email'] },
          ],
        },
      },
    };
    const result = getErrorMessage(error, 'fallback');
    expect(result).toContain('field required');
    expect(result).toContain('invalid email');
  });

  it('handles object detail with msg property', () => {
    const error = {
      response: {
        data: {
          detail: { msg: 'Custom error message' },
        },
      },
    };
    expect(getErrorMessage(error, 'fallback')).toBe('Custom error message');
  });

  it('returns fallback for null error', () => {
    expect(getErrorMessage(null, 'Error desconocido')).toBe('Error desconocido');
  });

  it('returns fallback for undefined error', () => {
    expect(getErrorMessage(undefined, 'Error desconocido')).toBe('Error desconocido');
  });

  it('returns fallback for empty object', () => {
    expect(getErrorMessage({}, 'Error desconocido')).toBe('Error desconocido');
  });

  it('handles error with direct message property', () => {
    const error = { message: 'Network error' };
    expect(getErrorMessage(error, 'fallback')).toBe('Network error');
  });

  it('returns fallback for primitive values', () => {
    expect(getErrorMessage('string error', 'fallback')).toBe('fallback');
    expect(getErrorMessage(123, 'fallback')).toBe('fallback');
  });
});

// ============================================
// String Utilities Tests
// ============================================

describe('truncate', () => {
  it('truncates long text with ellipsis', () => {
    const result = truncate('Este es un texto muy largo', 15);
    expect(result).toBe('Este es un t...');
    expect(result.length).toBe(15);
  });

  it('returns original text if shorter than maxLength', () => {
    expect(truncate('Corto', 10)).toBe('Corto');
  });

  it('handles exact length', () => {
    expect(truncate('12345', 5)).toBe('12345');
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
});

describe('capitalize', () => {
  it('capitalizes first letter of each word', () => {
    expect(capitalize('juan perez')).toBe('Juan Perez');
  });

  it('handles single word', () => {
    expect(capitalize('hola')).toBe('Hola');
  });

  it('handles already capitalized text', () => {
    expect(capitalize('JUAN PEREZ')).toBe('Juan Perez');
  });

  it('handles mixed case', () => {
    expect(capitalize('jUaN pErEz')).toBe('Juan Perez');
  });

  it('handles null', () => {
    expect(capitalize(null)).toBe('');
  });

  it('handles empty string', () => {
    expect(capitalize('')).toBe('');
  });
});

describe('getInitials', () => {
  it('returns initials from full name', () => {
    expect(getInitials('Juan Perez')).toBe('JP');
  });

  it('handles single name', () => {
    expect(getInitials('Juan')).toBe('J');
  });

  it('handles three names', () => {
    expect(getInitials('Juan Carlos Perez')).toBe('JC');
  });

  it('respects maxChars parameter', () => {
    expect(getInitials('Juan Carlos Perez', 3)).toBe('JCP');
  });

  it('handles null', () => {
    expect(getInitials(null)).toBe('');
  });

  it('handles empty string', () => {
    expect(getInitials('')).toBe('');
  });
});

// ============================================
// Validation Tests
// ============================================

describe('isValidEmail', () => {
  it('returns true for valid emails', () => {
    expect(isValidEmail('test@example.com')).toBe(true);
    expect(isValidEmail('user.name@domain.co')).toBe(true);
    expect(isValidEmail('user+tag@example.org')).toBe(true);
  });

  it('returns false for invalid emails', () => {
    expect(isValidEmail('notanemail')).toBe(false);
    expect(isValidEmail('missing@domain')).toBe(false);
    expect(isValidEmail('@nodomain.com')).toBe(false);
    expect(isValidEmail('spaces in@email.com')).toBe(false);
  });
});

describe('isValidPhone', () => {
  it('returns true for valid Colombian phones', () => {
    expect(isValidPhone('3001234567')).toBe(true);
    expect(isValidPhone('300 123 4567')).toBe(true);
    expect(isValidPhone('300-123-4567')).toBe(true);
    expect(isValidPhone('+573001234567')).toBe(true);
  });

  it('returns false for invalid phones', () => {
    expect(isValidPhone('1234567890')).toBe(false); // Doesn't start with 3
    expect(isValidPhone('300123')).toBe(false); // Too short
    expect(isValidPhone('30012345678901')).toBe(false); // Too long
  });
});

// ============================================
// CSS Utilities Tests
// ============================================

describe('cn', () => {
  it('merges class names', () => {
    expect(cn('class1', 'class2')).toBe('class1 class2');
  });

  it('filters out falsy values', () => {
    expect(cn('class1', false, 'class2', undefined, null, 'class3')).toBe(
      'class1 class2 class3'
    );
  });

  it('handles empty input', () => {
    expect(cn()).toBe('');
  });

  it('handles all falsy values', () => {
    expect(cn(false, undefined, null)).toBe('');
  });

  it('handles conditional classes', () => {
    const isActive = true;
    const isDisabled = false;
    expect(cn('base', isActive && 'active', isDisabled && 'disabled')).toBe('base active');
  });
});
