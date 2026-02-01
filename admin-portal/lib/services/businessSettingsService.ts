/**
 * Business Settings Service - Admin Portal
 *
 * API client for business information management.
 */
import apiClient from '../api';

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

const businessSettingsService = {
  /**
   * Get business information
   */
  async getInfo(): Promise<BusinessInfo> {
    const response = await apiClient.get<BusinessInfo>('/business-info');
    return response.data;
  },

  /**
   * Update business information
   */
  async updateInfo(updates: BusinessInfoUpdate): Promise<BusinessInfo> {
    const response = await apiClient.put<BusinessInfo>('/business-info', updates);
    return response.data;
  },
};

export default businessSettingsService;
