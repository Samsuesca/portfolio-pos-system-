import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import apiClient from '../../utils/api-client';
import businessInfoService, { DEFAULT_BUSINESS_INFO } from '../businessInfoService';
import type { BusinessInfo } from '../businessInfoService';

vi.mock('../../utils/api-client', () => ({
  default: { get: vi.fn(), put: vi.fn() },
}));

const apiMock = vi.mocked(apiClient);

const mockInfo: BusinessInfo = { ...DEFAULT_BUSINESS_INFO, business_name: 'Test Business' };

describe('businessInfoService', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  describe('getInfo', () => {
    it('fetches business info from API', async () => {
      (apiMock.get as Mock).mockResolvedValueOnce({ data: mockInfo });
      const result = await businessInfoService.getInfo();
      expect(apiMock.get).toHaveBeenCalledWith('/business-info');
      expect(result.business_name).toBe('Test Business');
    });

    it('returns defaults when API fails', async () => {
      (apiMock.get as Mock).mockRejectedValueOnce(new Error('Network'));
      const result = await businessInfoService.getInfo();
      expect(result).toEqual(DEFAULT_BUSINESS_INFO);
    });
  });

  describe('updateInfo', () => {
    it('puts partial updates', async () => {
      (apiMock.put as Mock).mockResolvedValueOnce({ data: { ...mockInfo, tagline: 'New Tagline' } });
      const result = await businessInfoService.updateInfo({ tagline: 'New Tagline' });
      expect(apiMock.put).toHaveBeenCalledWith('/business-info', { tagline: 'New Tagline' });
      expect(result.tagline).toBe('New Tagline');
    });
  });

  describe('getFullAddress', () => {
    it('joins address parts with commas', () => {
      const result = businessInfoService.getFullAddress(DEFAULT_BUSINESS_INFO);
      expect(result).toContain('Calle 56 D #26 BE 04');
      expect(result).toContain('Medellín');
      expect(result).toContain('Colombia');
    });

    it('filters empty parts', () => {
      const info = { ...DEFAULT_BUSINESS_INFO, address_line2: '', state: '' };
      const result = businessInfoService.getFullAddress(info);
      expect(result).not.toContain(', ,');
    });
  });

  describe('getWhatsAppLink', () => {
    it('returns basic link without message', () => {
      const result = businessInfoService.getWhatsAppLink(DEFAULT_BUSINESS_INFO);
      expect(result).toBe('https://wa.me/573001234567');
    });

    it('appends encoded message when provided', () => {
      const result = businessInfoService.getWhatsAppLink(DEFAULT_BUSINESS_INFO, 'Hola, necesito info');
      expect(result).toContain('?text=');
      expect(result).toContain('Hola');
    });
  });

  describe('getPhoneLink', () => {
    it('cleans phone number and returns tel: link', () => {
      expect(businessInfoService.getPhoneLink('+57 300 123 4567')).toBe('tel:+573001234567');
    });

    it('removes non-numeric characters except +', () => {
      expect(businessInfoService.getPhoneLink('(310) 599-7451')).toBe('tel:3001234567');
    });
  });

  describe('getEmailLink', () => {
    it('returns basic mailto link', () => {
      expect(businessInfoService.getEmailLink('test@test.com')).toBe('mailto:test@test.com');
    });

    it('appends encoded subject when provided', () => {
      const result = businessInfoService.getEmailLink('test@test.com', 'Consulta uniformes');
      expect(result).toContain('?subject=');
      expect(result).toContain('Consulta');
    });
  });
});
