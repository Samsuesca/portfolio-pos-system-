import { describe, it, expect } from 'vitest';
import {
  ESC, GS, LF, COMMANDS,
  formatCurrency, formatDate,
  generateTestReceipt, generateOpenDrawerCommand,
} from '../escpos';

describe('escpos', () => {
  describe('constants', () => {
    it('ESC is 0x1b', () => {
      expect(ESC).toBe(0x1b);
    });

    it('GS is 0x1d', () => {
      expect(GS).toBe(0x1d);
    });

    it('LF is 0x0a', () => {
      expect(LF).toBe(0x0a);
    });
  });

  describe('COMMANDS', () => {
    it('INIT is ESC @', () => {
      expect(COMMANDS.INIT).toEqual([0x1b, 0x40]);
    });

    it('ALIGN_CENTER is ESC a 1', () => {
      expect(COMMANDS.ALIGN_CENTER).toEqual([0x1b, 0x61, 0x01]);
    });

    it('BOLD_ON is ESC E 1', () => {
      expect(COMMANDS.BOLD_ON).toEqual([0x1b, 0x45, 0x01]);
    });

    it('FEED_LINES generates correct command', () => {
      expect(COMMANDS.FEED_LINES(3)).toEqual([0x1b, 0x64, 3]);
    });

    it('CUT_PARTIAL is GS V 1', () => {
      expect(COMMANDS.CUT_PARTIAL).toEqual([0x1d, 0x56, 0x01]);
    });

    it('OPEN_DRAWER is ESC p 0 25 250', () => {
      expect(COMMANDS.OPEN_DRAWER).toEqual([0x1b, 0x70, 0x00, 0x19, 0xfa]);
    });
  });

  describe('formatCurrency', () => {
    it('formats positive integers with dot separators', () => {
      expect(formatCurrency(150000)).toBe('$150.000');
    });

    it('formats zero', () => {
      expect(formatCurrency(0)).toBe('$0');
    });

    it('formats negative amounts', () => {
      expect(formatCurrency(-50000)).toBe('-$50.000');
    });

    it('rounds to integer', () => {
      expect(formatCurrency(99.99)).toBe('$100');
      expect(formatCurrency(99.49)).toBe('$99');
    });

    it('handles string input', () => {
      expect(formatCurrency('150000')).toBe('$150.000');
    });

    it('handles null/undefined', () => {
      expect(formatCurrency(null)).toBe('$0');
      expect(formatCurrency(undefined)).toBe('$0');
    });

    it('handles large amounts (millions)', () => {
      expect(formatCurrency(5000000)).toBe('$5.000.000');
    });

    it('handles small amounts (no separator)', () => {
      expect(formatCurrency(500)).toBe('$500');
    });
  });

  describe('formatDate', () => {
    it('formats Date object to Colombian locale', () => {
      const date = new Date('2026-01-15T10:30:00');
      const result = formatDate(date);
      expect(result).toContain('15');
      expect(result).toContain('01');
      expect(result).toContain('2026');
    });

    it('formats string date to Colombian locale', () => {
      const result = formatDate('2026-01-15T10:30:00');
      expect(result).toContain('15');
      expect(result).toContain('2026');
    });
  });

  describe('generateTestReceipt', () => {
    it('returns an array of bytes', () => {
      const result = generateTestReceipt('USB001');
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });

    it('starts with INIT command', () => {
      const result = generateTestReceipt('USB001');
      expect(result[0]).toBe(ESC);
      expect(result[1]).toBe(0x40);
    });

    it('contains the port name in output', () => {
      const result = generateTestReceipt('COM3');
      const text = String.fromCharCode(...result.filter(b => b >= 32 && b < 127));
      expect(text).toContain('COM3');
    });
  });

  describe('generateOpenDrawerCommand', () => {
    it('returns drawer open bytes', () => {
      const result = generateOpenDrawerCommand();
      expect(Array.isArray(result)).toBe(true);
      // Should contain the OPEN_DRAWER command
      const commandStr = result.join(',');
      const drawerStr = COMMANDS.OPEN_DRAWER.join(',');
      expect(commandStr).toContain(drawerStr);
    });
  });
});
