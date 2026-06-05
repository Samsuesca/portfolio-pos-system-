import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as tauriShell from '@tauri-apps/plugin-shell';
import {
  formatPhoneForWhatsApp,
  isValidColombianPhone,
  formatPhoneDisplay,
  openWhatsApp,
  DEFAULT_WHATSAPP_MESSAGE,
} from './whatsapp';

vi.mock('@tauri-apps/plugin-shell', () => ({
  open: vi.fn().mockResolvedValue(undefined),
}));

describe('formatPhoneForWhatsApp', () => {
  it('adds country code 57 to a bare 10-digit number', () => {
    expect(formatPhoneForWhatsApp('3001234567')).toBe('573001234567');
  });

  it('does not add country code if already has 57 prefix (12 digits)', () => {
    expect(formatPhoneForWhatsApp('573001234567')).toBe('573001234567');
  });

  it('strips non-digit characters before formatting', () => {
    expect(formatPhoneForWhatsApp('+57 300-123-4567')).toBe('573001234567');
  });

  it('strips parentheses and spaces', () => {
    expect(formatPhoneForWhatsApp('(300) 123 4567')).toBe('573001234567');
  });

  it('adds 57 prefix to a short number that starts with 57 but is not 12 digits', () => {
    // '578' is only 3 digits, not 12 — should get prefix added
    expect(formatPhoneForWhatsApp('578')).toBe('57578');
  });
});

describe('isValidColombianPhone', () => {
  it('returns true for a valid Colombian mobile number', () => {
    expect(isValidColombianPhone('3001234567')).toBe(true);
  });

  it('returns true for a number with formatting characters', () => {
    expect(isValidColombianPhone('300 123 4567')).toBe(true);
  });

  it('returns false for a number not starting with 3', () => {
    expect(isValidColombianPhone('4001234567')).toBe(false);
  });

  it('returns false for a number with fewer than 10 digits', () => {
    expect(isValidColombianPhone('300123456')).toBe(false);
  });

  it('returns false for a number with more than 10 digits', () => {
    expect(isValidColombianPhone('30012345678')).toBe(false);
  });

  it('returns false for an empty string', () => {
    expect(isValidColombianPhone('')).toBe(false);
  });

  it('returns false for a non-numeric string', () => {
    expect(isValidColombianPhone('abcdefghij')).toBe(false);
  });
});

describe('formatPhoneDisplay', () => {
  it('formats a 10-digit number with spaces', () => {
    expect(formatPhoneDisplay('3001234567')).toBe('300 123 4567');
  });

  it('strips non-digit characters before formatting', () => {
    expect(formatPhoneDisplay('300-123-4567')).toBe('300 123 4567');
  });

  it('returns original string if not 10 digits after stripping', () => {
    expect(formatPhoneDisplay('573001234567')).toBe('573001234567');
  });

  it('returns original string for short input', () => {
    expect(formatPhoneDisplay('300')).toBe('300');
  });
});

describe('DEFAULT_WHATSAPP_MESSAGE', () => {
  it('is a non-empty string', () => {
    expect(typeof DEFAULT_WHATSAPP_MESSAGE).toBe('string');
    expect(DEFAULT_WHATSAPP_MESSAGE.length).toBeGreaterThan(0);
  });
});

describe('openWhatsApp', () => {
  const openMock = vi.mocked(tauriShell.open);

  beforeEach(() => {
    vi.clearAllMocks();
    delete (window as any).__TAURI_INTERNALS__;
  });

  it('uses window.open in non-Tauri environment without message', async () => {
    const windowOpenSpy = vi.spyOn(window, 'open').mockReturnValue(null);
    await openWhatsApp('3001234567');
    expect(windowOpenSpy).toHaveBeenCalledWith(
      'https://wa.me/573001234567',
      '_blank'
    );
    windowOpenSpy.mockRestore();
  });

  it('uses window.open in non-Tauri environment with message', async () => {
    const windowOpenSpy = vi.spyOn(window, 'open').mockReturnValue(null);
    await openWhatsApp('3001234567', 'Hola');
    expect(windowOpenSpy).toHaveBeenCalledWith(
      expect.stringContaining('Hola'),
      '_blank'
    );
    windowOpenSpy.mockRestore();
  });

  it('encodes message in the URL', async () => {
    const windowOpenSpy = vi.spyOn(window, 'open').mockReturnValue(null);
    await openWhatsApp('3001234567', 'Hola mundo');
    const calledUrl = windowOpenSpy.mock.calls[0][0] as string;
    expect(calledUrl).toContain(encodeURIComponent('Hola mundo'));
    windowOpenSpy.mockRestore();
  });

  it('uses Tauri open in Tauri environment', async () => {
    (window as any).__TAURI_INTERNALS__ = {};
    await openWhatsApp('3001234567');
    expect(openMock).toHaveBeenCalledWith('https://wa.me/573001234567');
  });

  it('falls back to window.open if Tauri open throws', async () => {
    (window as any).__TAURI_INTERNALS__ = {};
    openMock.mockRejectedValueOnce(new Error('Tauri error'));
    const windowOpenSpy = vi.spyOn(window, 'open').mockReturnValue(null);
    await openWhatsApp('3001234567');
    expect(windowOpenSpy).toHaveBeenCalled();
    windowOpenSpy.mockRestore();
  });
});
