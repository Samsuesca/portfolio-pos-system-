/**
 * Shared Utilities for Web Portal
 *
 * IMPORTANT: All date/time functions use Colombia timezone (America/Bogota)
 * as specified in CLAUDE.md
 */

// ============================================
// Currency Formatting
// ============================================

/**
 * Format currency without decimals for Colombian Peso
 */
export function formatPrice(price: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price);
}

/**
 * Format a number as Colombian Pesos (COP)
 * Alias for formatPrice with additional null handling
 */
export function formatCurrency(
  value: number | string | null | undefined
): string {
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  if (numValue === null || numValue === undefined || isNaN(numValue)) return '$ 0';

  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(numValue);
}

/**
 * Format price as simple number with thousand separators (no currency symbol)
 */
export function formatNumber(num: number | null | undefined): string {
  if (num === null || num === undefined || isNaN(num)) return '0';
  return new Intl.NumberFormat('es-CO').format(num);
}

// ============================================
// Date Formatting (Colombia Timezone)
// ============================================

/**
 * Format date for display (e.g., "23 ene 2024")
 * Uses Colombia timezone
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

// ============================================
// Error Handling
// ============================================

/**
 * Extract user-friendly error message from API error responses
 */
export function getErrorMessage(err: unknown, fallback: string): string {
  if (!err || typeof err !== 'object') return fallback;

  const error = err as Record<string, unknown>;
  const response = error.response as Record<string, unknown> | undefined;
  const data = response?.data as Record<string, unknown> | undefined;
  const detail = data?.detail;

  if (typeof detail === 'string') return detail;

  if (Array.isArray(detail) && detail.length > 0) {
    return detail
      .map((d: Record<string, unknown>) => {
        const msg = d.msg || d.message;
        if (typeof msg === 'string') return msg;
        return JSON.stringify(d);
      })
      .join(', ');
  }

  if (typeof detail === 'object' && detail !== null) {
    const d = detail as Record<string, unknown>;
    const msg = d.msg || d.message;
    if (typeof msg === 'string') return msg;
  }

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
 * Merge class names conditionally (simple cn utility)
 */
export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}
