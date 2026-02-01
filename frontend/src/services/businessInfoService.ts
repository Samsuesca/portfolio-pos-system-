/**
 * Business Info Service - API calls for business settings
 *
 * Centralized business information (name, contact, address, hours, etc.)
 * GET is public, PUT requires admin/owner role.
 */
import apiClient from '../utils/api-client';

export interface BusinessInfo {
  // General Info
  business_name: string;
  business_name_short: string;
  tagline: string;

  // Contact
  phone_main: string;
  phone_support: string;
  whatsapp_number: string;
  email_contact: string;
  email_noreply: string;

  // Address
  address_line1: string;
  address_line2: string;
  city: string;
  state: string;
  country: string;
  maps_url: string;

  // Hours
  hours_weekday: string;
  hours_saturday: string;
  hours_sunday: string;

  // Web
  website_url: string;

  // Social Media
  social_facebook: string;
  social_instagram: string;
}

export type BusinessInfoUpdate = Partial<BusinessInfo>;

// Default values for fallback when API is unavailable
export const DEFAULT_BUSINESS_INFO: BusinessInfo = {
  business_name: 'Uniformes Consuelo Rios',
  business_name_short: 'UCR',
  tagline: 'Sistema de Gestión',
  phone_main: '+57 300 123 4567',
  phone_support: '+57 301 568 7810',
  whatsapp_number: '573001234567',
  email_contact: 'contact@example.com',
  email_noreply: 'noreply@yourdomain.com',
  address_line1: 'Calle 56 D #26 BE 04',
  address_line2: 'Villas de San José, Boston - Barrio Sucre',
  city: 'Medellín',
  state: 'Antioquia',
  country: 'Colombia',
  maps_url: 'https://www.google.com/maps/search/?api=1&query=Calle+56D+26BE+04+Villas+de+San+Jose+Boston+Medellin',
  hours_weekday: 'Lunes a Viernes: 8:00 AM - 6:00 PM',
  hours_saturday: 'Sábados: 9:00 AM - 2:00 PM',
  hours_sunday: 'Domingos: Cerrado',
  website_url: 'https://yourdomain.com',
  social_facebook: '',
  social_instagram: '',
};

export const businessInfoService = {
  /**
   * Get business information (public endpoint)
   */
  async getInfo(): Promise<BusinessInfo> {
    try {
      const response = await apiClient.get<BusinessInfo>('/business-info');
      return response.data;
    } catch (error) {
      console.warn('[BusinessInfo] Failed to fetch, using defaults:', error);
      return DEFAULT_BUSINESS_INFO;
    }
  },

  /**
   * Update business information (requires admin/owner)
   */
  async updateInfo(updates: BusinessInfoUpdate): Promise<BusinessInfo> {
    const response = await apiClient.put<BusinessInfo>('/business-info', updates);
    return response.data;
  },

  /**
   * Get formatted full address
   */
  getFullAddress(info: BusinessInfo): string {
    const parts = [
      info.address_line1,
      info.address_line2,
      info.city,
      info.state,
      info.country,
    ].filter(Boolean);
    return parts.join(', ');
  },

  /**
   * Get WhatsApp link with optional message
   */
  getWhatsAppLink(info: BusinessInfo, message?: string): string {
    const base = `https://wa.me/${info.whatsapp_number}`;
    if (message) {
      return `${base}?text=${encodeURIComponent(message)}`;
    }
    return base;
  },

  /**
   * Get phone link (tel:)
   */
  getPhoneLink(phone: string): string {
    // Remove spaces and non-numeric characters except +
    const cleaned = phone.replace(/[^\d+]/g, '');
    return `tel:${cleaned}`;
  },

  /**
   * Get email link (mailto:)
   */
  getEmailLink(email: string, subject?: string): string {
    const base = `mailto:${email}`;
    if (subject) {
      return `${base}?subject=${encodeURIComponent(subject)}`;
    }
    return base;
  },
};

export default businessInfoService;
