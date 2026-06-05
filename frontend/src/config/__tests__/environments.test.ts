import { describe, it, expect } from 'vitest';
import {
  ENVIRONMENTS, ENVIRONMENT_LABELS, ENVIRONMENT_DESCRIPTIONS,
  isValidApiUrl, getDefaultEnvironment,
} from '../environments';

describe('environments', () => {
  describe('ENVIRONMENTS constants', () => {
    it('LOCAL uses 127.0.0.1:8001', () => {
      expect(ENVIRONMENTS.LOCAL).toBe('http://127.0.0.1:8001');
    });

    it('CLOUD uses production domain', () => {
      expect(ENVIRONMENTS.CLOUD).toContain('yourdomain.com');
    });

    it('LAN uses local network IP', () => {
      expect(ENVIRONMENTS.LAN).toContain('192.168');
    });
  });

  describe('labels and descriptions', () => {
    it('has label for every environment key', () => {
      expect(ENVIRONMENT_LABELS.LOCAL).toBe('Mi computadora');
      expect(ENVIRONMENT_LABELS.LAN).toBe('Red de la tienda');
      expect(ENVIRONMENT_LABELS.CLOUD).toBe('Internet');
    });

    it('has description for every environment key', () => {
      expect(ENVIRONMENT_DESCRIPTIONS.LOCAL).toBeTruthy();
      expect(ENVIRONMENT_DESCRIPTIONS.LAN).toBeTruthy();
      expect(ENVIRONMENT_DESCRIPTIONS.CLOUD).toBeTruthy();
    });
  });

  describe('isValidApiUrl', () => {
    it('accepts http URLs', () => {
      expect(isValidApiUrl('http://localhost:8001')).toBe(true);
    });

    it('accepts https URLs', () => {
      expect(isValidApiUrl('https://api.example.com')).toBe(true);
    });

    it('rejects non-http protocols', () => {
      expect(isValidApiUrl('ftp://example.com')).toBe(false);
    });

    it('rejects malformed URLs', () => {
      expect(isValidApiUrl('not-a-url')).toBe(false);
    });

    it('rejects empty string', () => {
      expect(isValidApiUrl('')).toBe(false);
    });
  });

  describe('getDefaultEnvironment', () => {
    it('returns a valid URL', () => {
      const url = getDefaultEnvironment();
      expect(url.startsWith('http')).toBe(true);
    });
  });
});
