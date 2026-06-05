import { describe, it, expect } from 'vitest';
import {
  formatCurrency,
  formatDateSpanish,
  formatDateTimeColombia,
  getColombiaDateString,
  getColombiaNow,
} from './formatting';

describe('formatCurrency', () => {
  it('returns $0 for null', () => {
    expect(formatCurrency(null)).toBe('$0');
  });

  it('returns $0 for undefined', () => {
    expect(formatCurrency(undefined)).toBe('$0');
  });

  it('returns $0 for NaN', () => {
    expect(formatCurrency(NaN)).toBe('$0');
  });

  it('formats zero', () => {
    expect(formatCurrency(0)).toBe('$0');
  });

  it('formats a simple amount without separators', () => {
    expect(formatCurrency(500)).toBe('$500');
  });

  it('formats thousands with dot separator', () => {
    expect(formatCurrency(150000)).toBe('$150.000');
  });

  it('formats millions with multiple separators', () => {
    expect(formatCurrency(1234567)).toBe('$1.234.567');
  });

  it('formats negative amounts with leading minus', () => {
    expect(formatCurrency(-150000)).toBe('-$150.000');
  });

  it('formats negative zero as $0', () => {
    expect(formatCurrency(-0)).toBe('$0');
  });

  it('rounds decimals by default (no decimals)', () => {
    expect(formatCurrency(1500.9)).toBe('$1.501');
  });

  it('shows decimals when showDecimals is true', () => {
    expect(formatCurrency(1500.5, true)).toBe('$1.500,50');
  });

  it('shows two decimal places with trailing zero', () => {
    expect(formatCurrency(1000.1, true)).toBe('$1.000,10');
  });

  it('formats negative with decimals', () => {
    expect(formatCurrency(-1500.5, true)).toBe('-$1.500,50');
  });

  it('formats large amount without decimals', () => {
    expect(formatCurrency(1000000)).toBe('$1.000.000');
  });
});

describe('formatDateSpanish', () => {
  it('accepts a Date object and returns a Spanish date string', () => {
    const date = new Date('2024-01-15T12:00:00Z');
    const result = formatDateSpanish(date);
    expect(result).toContain('enero');
    expect(result).toContain('2024');
    expect(result).toMatch(/15/);
  });

  it('accepts a date string and returns a Spanish date string', () => {
    const result = formatDateSpanish('2024-06-20T00:00:00Z');
    expect(result).toContain('2024');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('formats month names in Spanish', () => {
    const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
      'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    const result = formatDateSpanish(new Date('2024-03-15T12:00:00Z'));
    const hasSpanishMonth = months.some(m => result.includes(m));
    expect(hasSpanishMonth).toBe(true);
  });
});

describe('formatDateTimeColombia', () => {
  it('accepts a Date object and returns a datetime string', () => {
    const date = new Date('2024-01-15T18:00:00Z');
    const result = formatDateTimeColombia(date);
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('accepts a date string', () => {
    const result = formatDateTimeColombia('2024-06-20T15:00:00Z');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('includes time information (hour and minute)', () => {
    const result = formatDateTimeColombia(new Date('2024-01-15T18:30:00Z'));
    // Should contain numbers that could represent time
    expect(result).toMatch(/\d/);
  });
});

describe('getColombiaDateString', () => {
  it('returns a string in YYYY-MM-DD format', () => {
    const result = getColombiaDateString();
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('returns a valid date string', () => {
    const result = getColombiaDateString();
    const parsed = new Date(result);
    expect(isNaN(parsed.getTime())).toBe(false);
  });
});

describe('getColombiaNow', () => {
  it('returns a Date instance', () => {
    const result = getColombiaNow();
    expect(result).toBeInstanceOf(Date);
  });

  it('returns a valid non-NaN date', () => {
    const result = getColombiaNow();
    expect(isNaN(result.getTime())).toBe(false);
  });

  it('returns a date close to the current time (within 5 seconds)', () => {
    const before = Date.now();
    const result = getColombiaNow();
    const after = Date.now();
    expect(result.getTime()).toBeGreaterThanOrEqual(before - 5000);
    expect(result.getTime()).toBeLessThanOrEqual(after + 5000);
  });
});
