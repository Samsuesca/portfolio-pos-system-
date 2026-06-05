import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import apiClient from '../../utils/api-client';
import { cashDrawerService } from '../cashDrawerService';

vi.mock('../../utils/api-client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

const apiMock = vi.mocked(apiClient);

describe('cashDrawerService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('canOpenDirectly', () => {
    it('returns true for superuser', async () => {
      const mockResponse = { can_open_directly: true, reason: 'superuser' };
      (apiMock.get as Mock).mockResolvedValueOnce({ data: mockResponse });

      const result = await cashDrawerService.canOpenDirectly();

      expect(apiMock.get).toHaveBeenCalledWith('/cash-drawer/can-open');
      expect(result.can_open_directly).toBe(true);
      expect(result.reason).toBe('superuser');
    });

    it('returns false for no_permission', async () => {
      const mockResponse = { can_open_directly: false, reason: 'no_permission' };
      (apiMock.get as Mock).mockResolvedValueOnce({ data: mockResponse });

      const result = await cashDrawerService.canOpenDirectly();

      expect(result.can_open_directly).toBe(false);
    });

    it('propagates API errors', async () => {
      (apiMock.get as Mock).mockRejectedValueOnce(new Error('Unauthorized'));

      await expect(cashDrawerService.canOpenDirectly()).rejects.toThrow('Unauthorized');
    });
  });

  describe('requestAccess', () => {
    it('requests an access code', async () => {
      const mockResponse = { message: 'Code sent', expires_in: 300, expires_at: '2026-03-01T10:05:00' };
      (apiMock.post as Mock).mockResolvedValueOnce({ data: mockResponse });

      const result = await cashDrawerService.requestAccess();

      expect(apiMock.post).toHaveBeenCalledWith('/cash-drawer/request-access');
      expect(result.expires_in).toBe(300);
    });
  });

  describe('validateAccess', () => {
    it('validates a correct code', async () => {
      const mockResponse = { valid: true, message: 'Access granted' };
      (apiMock.post as Mock).mockResolvedValueOnce({ data: mockResponse });

      const result = await cashDrawerService.validateAccess('123456');

      expect(apiMock.post).toHaveBeenCalledWith('/cash-drawer/validate-access', { code: '123456' });
      expect(result.valid).toBe(true);
    });

    it('validates an incorrect code', async () => {
      const mockResponse = { valid: false, message: 'Invalid code' };
      (apiMock.post as Mock).mockResolvedValueOnce({ data: mockResponse });

      const result = await cashDrawerService.validateAccess('000000');

      expect(result.valid).toBe(false);
    });
  });

  describe('openDirect', () => {
    it('opens the drawer directly', async () => {
      const mockResponse = { authorized: true, reason: 'has_permission' };
      (apiMock.post as Mock).mockResolvedValueOnce({ data: mockResponse });

      const result = await cashDrawerService.openDirect();

      expect(apiMock.post).toHaveBeenCalledWith('/cash-drawer/open');
      expect(result.authorized).toBe(true);
    });
  });
});
