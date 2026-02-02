/**
 * Shared Utilities for Admin Portal
 *
 * Centralized formatting and helper functions to avoid code duplication.
 *
 * IMPORTANT: All date/time functions use Colombia timezone (America/Bogota)
 * as specified in CLAUDE.md
 */

// ============================================
// Currency Formatting
// ============================================

/**
 * Format a number as Colombian Pesos (COP)
 * @param value - The amount to format (accepts number or string from API)
 * @param options - Formatting options
 * @returns Formatted currency string like "$ 150.000"
 */
export function formatCurrency(
  value: number | string | null | undefined,
  options?: { showDecimals?: boolean }
): string {
  // Handle string values from API (decimal strings)
  const numValue = typeof value === 'string' ? parseFloat(value) : value;

  if (numValue === null || numValue === undefined || isNaN(numValue)) return '$ 0';

  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: options?.showDecimals ? 2 : 0,
    maximumFractionDigits: options?.showDecimals ? 2 : 0,
  }).format(numValue);
}

/**
 * Format a number with thousand separators (no currency symbol)
 * @param value - The number to format
 * @returns Formatted number string like "150.000"
 */
export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) return '0';

  return new Intl.NumberFormat('es-CO', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

// ============================================
// Date Formatting (Colombia Timezone)
// ============================================

/**
 * Format date for display (e.g., "23 ene 2024")
 * Uses Colombia timezone as required by CLAUDE.md
 */
export function formatDate(dateStr: string | Date | null | undefined): string {
  if (!dateStr) return '-';
  const d = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  if (isNaN(d.getTime())) return '-';

  return d.toLocaleDateString('es-CO', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'America/Bogota',
  });
}

/**
 * Format datetime for display (e.g., "23 ene 2024, 15:30")
 * Uses Colombia timezone
 */
export function formatDateTime(dateStr: string | Date | null | undefined): string {
  if (!dateStr) return '-';
  const d = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  if (isNaN(d.getTime())) return '-';

  return d.toLocaleDateString('es-CO', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Bogota',
  });
}

/**
 * Format time only (e.g., "15:30")
 * Uses Colombia timezone
 */
export function formatTime(dateStr: string | Date | null | undefined): string {
  if (!dateStr) return '-';
  const d = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  if (isNaN(d.getTime())) return '-';

  return d.toLocaleTimeString('es-CO', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Bogota',
  });
}

/**
 * Format date for API calls (YYYY-MM-DD format)
 * Uses Colombia timezone to ensure correct date
 */
export function formatDateForAPI(date: Date): string {
  return date.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
}

/**
 * Get relative time description (e.g., "hace 5 minutos")
 */
export function getRelativeTime(dateStr: string | Date | null | undefined): string {
  if (!dateStr) return '-';
  const d = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  if (isNaN(d.getTime())) return '-';

  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'ahora';
  if (diffMins < 60) return `hace ${diffMins} min`;
  if (diffHours < 24) return `hace ${diffHours}h`;
  if (diffDays < 7) return `hace ${diffDays}d`;

  return formatDate(d);
}

// ============================================
// Error Handling
// ============================================

/**
 * Extract user-friendly error message from API error responses
 * Handles FastAPI/Pydantic validation errors consistently
 *
 * @param err - The error object (usually from catch block)
 * @param fallback - Fallback message if extraction fails
 * @returns User-friendly error message
 */
export function getErrorMessage(err: unknown, fallback: string): string {
  if (!err || typeof err !== 'object') return fallback;

  const error = err as Record<string, unknown>;

  // Handle Axios error structure
  const response = error.response as Record<string, unknown> | undefined;
  const data = response?.data as Record<string, unknown> | undefined;
  const detail = data?.detail;

  // String detail (most common)
  if (typeof detail === 'string') return detail;

  // Array of validation errors (Pydantic)
  if (Array.isArray(detail) && detail.length > 0) {
    return detail
      .map((d: Record<string, unknown>) => {
        const msg = d.msg || d.message;
        if (typeof msg === 'string') return msg;
        return JSON.stringify(d);
      })
      .join(', ');
  }

  // Object with msg/message property
  if (typeof detail === 'object' && detail !== null) {
    const d = detail as Record<string, unknown>;
    const msg = d.msg || d.message;
    if (typeof msg === 'string') return msg;
    return JSON.stringify(detail);
  }

  // Check for direct message property
  if (typeof error.message === 'string') return error.message;

  return fallback;
}

// ============================================
// String Utilities
// ============================================

/**
 * Truncate text with ellipsis
 */
export function truncate(text: string | null | undefined, maxLength: number): string {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

/**
 * Capitalize first letter of each word
 */
export function capitalize(text: string | null | undefined): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Generate initials from a name (e.g., "Juan Perez" -> "JP")
 */
export function getInitials(name: string | null | undefined, maxChars: number = 2): string {
  if (!name) return '';
  return name
    .split(' ')
    .filter((word) => word.length > 0)
    .map((word) => word[0].toUpperCase())
    .slice(0, maxChars)
    .join('');
}

// ============================================
// Validation Utilities
// ============================================

/**
 * Check if a string is a valid email
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Check if a string is a valid Colombian phone number
 */
export function isValidPhone(phone: string): boolean {
  // Remove spaces and dashes
  const cleaned = phone.replace(/[\s-]/g, '');
  // Colombian numbers: 10 digits starting with 3, or with country code
  return /^(\+57)?3\d{9}$/.test(cleaned);
}

// ============================================
// CSS Utilities
// ============================================

/**
 * Merge class names conditionally (simple cn utility)
 */
export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

// ============================================
// Re-exports from productGrouping
// ============================================

export {
  compareSizes,
  formatPriceRange,
  getEmojiForCategory,
  groupProductsByGarmentType,
  groupGlobalProductsByGarmentType,
  findVariant,
  getVariantsForSize,
  getColorsForSize,
} from './productGrouping';

export type { ProductVariant, ProductGroup } from './productGrouping';
