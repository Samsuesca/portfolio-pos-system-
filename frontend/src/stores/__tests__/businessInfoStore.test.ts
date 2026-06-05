import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useBusinessInfoStore } from '../businessInfoStore';
import { businessInfoService, DEFAULT_BUSINESS_INFO } from '../../services/businessInfoService';

vi.mock('../../services/businessInfoService', () => ({
  businessInfoService: {
    getInfo: vi.fn(),
    updateInfo: vi.fn(),
    getFullAddress: vi.fn().mockReturnValue('Calle 1, Medellin, Colombia'),
    getWhatsAppLink: vi.fn().mockReturnValue('https://wa.me/123'),
    getPhoneLink: vi.fn().mockReturnValue('tel:+57123'),
    getEmailLink: vi.fn().mockReturnValue('mailto:test@test.com'),
  },
  DEFAULT_BUSINESS_INFO: {
    business_name: 'Uniformes Consuelo Rios',
    business_name_short: 'UCR',
    tagline: 'Sistema de Gestión',
    phone_main: '+57 300 123 4567',
    phone_support: '+57 301 568 7810',
    whatsapp_number: '573001234567',
    email_contact: 'contact@example.com',
    email_noreply: 'noreply@yourdomain.com',
    address_line1: 'Calle 56 D #26 BE 04',
    address_line2: 'Villas de San José',
    city: 'Medellín',
    state: 'Antioquia',
    country: 'Colombia',
    maps_url: '',
    hours_weekday: 'L-V: 8-6',
    hours_saturday: 'S: 9-2',
    hours_sunday: 'D: Cerrado',
    website_url: 'https://yourdomain.com',
    social_facebook: '',
    social_instagram: '',
  },
}));

describe('businessInfoStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useBusinessInfoStore.setState({
      info: DEFAULT_BUSINESS_INFO,
      isLoading: false,
      isLoaded: false,
      error: null,
      lastFetched: null,
    });
  });

  describe('fetchInfo', () => {
    it('fetches info from API and stores it', async () => {
      const newInfo = { ...DEFAULT_BUSINESS_INFO, business_name: 'Updated Name' };
      vi.mocked(businessInfoService.getInfo).mockResolvedValueOnce(newInfo);

      await useBusinessInfoStore.getState().fetchInfo();

      const state = useBusinessInfoStore.getState();
      expect(state.info.business_name).toBe('Updated Name');
      expect(state.isLoaded).toBe(true);
      expect(state.isLoading).toBe(false);
      expect(state.lastFetched).not.toBeNull();
    });

    it('skips fetch if already loading', async () => {
      useBusinessInfoStore.setState({ isLoading: true });

      await useBusinessInfoStore.getState().fetchInfo();

      expect(businessInfoService.getInfo).not.toHaveBeenCalled();
    });

    it('skips fetch if cache is still valid', async () => {
      useBusinessInfoStore.setState({ lastFetched: Date.now() });

      await useBusinessInfoStore.getState().fetchInfo();

      expect(businessInfoService.getInfo).not.toHaveBeenCalled();
    });

    it('fetches if cache is expired', async () => {
      useBusinessInfoStore.setState({ lastFetched: Date.now() - 6 * 60 * 1000 });
      vi.mocked(businessInfoService.getInfo).mockResolvedValueOnce(DEFAULT_BUSINESS_INFO);

      await useBusinessInfoStore.getState().fetchInfo();

      expect(businessInfoService.getInfo).toHaveBeenCalled();
    });

    it('sets error on fetch failure', async () => {
      vi.mocked(businessInfoService.getInfo).mockRejectedValueOnce(new Error('Network'));

      await useBusinessInfoStore.getState().fetchInfo();

      const state = useBusinessInfoStore.getState();
      expect(state.error).toBe('No se pudo cargar la información del negocio');
      expect(state.isLoading).toBe(false);
    });
  });

  describe('updateInfo', () => {
    it('updates info and stores result', async () => {
      const updated = { ...DEFAULT_BUSINESS_INFO, tagline: 'New tagline' };
      vi.mocked(businessInfoService.updateInfo).mockResolvedValueOnce(updated);

      await useBusinessInfoStore.getState().updateInfo({ tagline: 'New tagline' });

      expect(businessInfoService.updateInfo).toHaveBeenCalledWith({ tagline: 'New tagline' });
      expect(useBusinessInfoStore.getState().info.tagline).toBe('New tagline');
    });

    it('sets error and rethrows on failure', async () => {
      vi.mocked(businessInfoService.updateInfo).mockRejectedValueOnce(new Error('Forbidden'));

      await expect(useBusinessInfoStore.getState().updateInfo({ tagline: 'x' })).rejects.toThrow('Forbidden');

      expect(useBusinessInfoStore.getState().error).toBe('No se pudo actualizar la información del negocio');
    });
  });

  describe('clearError', () => {
    it('sets error to null', () => {
      useBusinessInfoStore.setState({ error: 'some error' });
      useBusinessInfoStore.getState().clearError();
      expect(useBusinessInfoStore.getState().error).toBeNull();
    });
  });

  describe('helpers', () => {
    it('getFullAddress delegates to service', () => {
      const result = useBusinessInfoStore.getState().getFullAddress();
      expect(businessInfoService.getFullAddress).toHaveBeenCalled();
      expect(result).toBe('Calle 1, Medellin, Colombia');
    });

    it('getWhatsAppLink delegates to service', () => {
      const result = useBusinessInfoStore.getState().getWhatsAppLink('Hola');
      expect(businessInfoService.getWhatsAppLink).toHaveBeenCalledWith(expect.anything(), 'Hola');
      expect(result).toBe('https://wa.me/123');
    });

    it('getPhoneLink uses phone_main by default', () => {
      useBusinessInfoStore.getState().getPhoneLink();
      expect(businessInfoService.getPhoneLink).toHaveBeenCalledWith(DEFAULT_BUSINESS_INFO.phone_main);
    });

    it('getPhoneLink uses custom phone when provided', () => {
      useBusinessInfoStore.getState().getPhoneLink('+57 300 000 0000');
      expect(businessInfoService.getPhoneLink).toHaveBeenCalledWith('+57 300 000 0000');
    });

    it('getEmailLink delegates to service', () => {
      useBusinessInfoStore.getState().getEmailLink('Consulta');
      expect(businessInfoService.getEmailLink).toHaveBeenCalledWith(DEFAULT_BUSINESS_INFO.email_contact, 'Consulta');
    });
  });
});
