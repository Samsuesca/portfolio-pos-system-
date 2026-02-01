/**
 * Business Info - Server-side utilities for Next.js
 *
 * Fetches business information from API with caching.
 */
import { unstable_cache } from 'next/cache';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

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

// Default values for fallback
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

/**
 * Fetch business info from API (server-side, cached)
 */
async function fetchBusinessInfo(): Promise<BusinessInfo> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/business-info`, {
      next: { revalidate: 300 }, // Cache for 5 minutes
    });

    if (!response.ok) {
      console.warn('[BusinessInfo] API returned non-OK status:', response.status);
      return DEFAULT_BUSINESS_INFO;
    }

    return await response.json();
  } catch (error) {
    console.warn('[BusinessInfo] Failed to fetch, using defaults:', error);
    return DEFAULT_BUSINESS_INFO;
  }
}

/**
 * Get business info with Next.js caching
 */
export const getBusinessInfo = unstable_cache(
  fetchBusinessInfo,
  ['business-info'],
  {
    revalidate: 300, // 5 minutes
    tags: ['business-info'],
  }
);

/**
 * Helper: Get formatted full address
 */
export function getFullAddress(info: BusinessInfo): string {
  const parts = [
    info.address_line1,
    info.address_line2,
    info.city,
    info.state,
    info.country,
  ].filter(Boolean);
  return parts.join(', ');
}

/**
 * Helper: Get WhatsApp link with optional message
 */
export function getWhatsAppLink(info: BusinessInfo, message?: string): string {
  const base = `https://wa.me/${info.whatsapp_number}`;
  if (message) {
    return `${base}?text=${encodeURIComponent(message)}`;
  }
  return base;
}

/**
 * Helper: Get phone link (tel:)
 */
export function getPhoneLink(phone: string): string {
  const cleaned = phone.replace(/[^\d+]/g, '');
  return `tel:${cleaned}`;
}

/**
 * Helper: Get email link (mailto:)
 */
export function getEmailLink(email: string, subject?: string): string {
  const base = `mailto:${email}`;
  if (subject) {
    return `${base}?subject=${encodeURIComponent(subject)}`;
  }
  return base;
}
