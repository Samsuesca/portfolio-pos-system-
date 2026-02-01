/**
 * WhatsApp Utilities
 *
 * Functions for opening WhatsApp with Colombian phone numbers.
 * Uses Tauri shell plugin when running in Tauri, falls back to window.open for web.
 */

import { open } from '@tauri-apps/plugin-shell';

/**
 * Check if running inside Tauri environment.
 */
function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

/**
 * Format phone number for WhatsApp API (Colombian format).
 * Adds country code 57 if not present.
 *
 * @param phone - Phone number (may be 10 digits or already have country code)
 * @returns Phone number with 57 prefix
 */
export function formatPhoneForWhatsApp(phone: string): string {
  // Remove all non-digit characters
  const clean = phone.replace(/\D/g, '');

  // If already has country code (57), return as-is
  if (clean.startsWith('57') && clean.length === 12) {
    return clean;
  }

  // Add Colombian country code
  return `57${clean}`;
}

/**
 * Open WhatsApp Web or app with pre-filled message.
 * Uses Tauri shell:open when in desktop app, window.open for web.
 *
 * @param phone - Phone number to message
 * @param message - Optional pre-filled message
 */
export async function openWhatsApp(phone: string, message?: string): Promise<void> {
  const formattedPhone = formatPhoneForWhatsApp(phone);

  const url = message
    ? `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`
    : `https://wa.me/${formattedPhone}`;

  if (isTauri()) {
    // Use Tauri shell plugin to open in default browser/app
    try {
      await open(url);
    } catch (error) {
      console.error('Error opening WhatsApp via Tauri:', error);
      // Fallback to window.open if Tauri fails
      window.open(url, '_blank');
    }
  } else {
    // Web environment - use standard window.open
    window.open(url, '_blank');
  }
}

/**
 * Default WhatsApp message template.
 */
export const DEFAULT_WHATSAPP_MESSAGE = 'Hola, me comunico de Uniformes Consuelo.';

/**
 * Validate Colombian phone number format.
 * Returns true if valid (10 digits starting with 3).
 *
 * @param phone - Phone number to validate
 * @returns True if valid Colombian mobile number
 */
export function isValidColombianPhone(phone: string): boolean {
  const clean = phone.replace(/\D/g, '');
  return /^3\d{9}$/.test(clean);
}

/**
 * Format phone for display with spaces.
 * Example: 3001234567 -> 300 123 4567
 *
 * @param phone - Phone number (10 digits)
 * @returns Formatted phone string
 */
export function formatPhoneDisplay(phone: string): string {
  const clean = phone.replace(/\D/g, '');
  if (clean.length !== 10) return phone;
  return `${clean.slice(0, 3)} ${clean.slice(3, 6)} ${clean.slice(6)}`;
}
