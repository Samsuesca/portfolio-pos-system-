/**
 * Format a number as Colombian Pesos (COP)
 * Uses manual formatting to ensure consistent output across all environments
 * (WebView in Tauri may not support es-CO locale properly)
 * @param amount - The amount to format
 * @param showDecimals - Whether to show decimal places (default: false)
 * @returns Formatted currency string like "$150.000"
 */
export function formatCurrency(amount: number | null | undefined, showDecimals: boolean = false): string {
  if (amount === null || amount === undefined || isNaN(amount)) return '$0';

  // Round the number based on decimal preference
  const rounded = showDecimals ? Math.round(amount * 100) / 100 : Math.round(amount);

  // Handle negative numbers
  const isNegative = rounded < 0;
  const absValue = Math.abs(rounded);

  // Split into integer and decimal parts
  const [intPart, decPart] = absValue.toFixed(showDecimals ? 2 : 0).split('.');

  // Add thousand separators (dots for Colombian format)
  const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

  // Build final string
  let result = '$' + formattedInt;
  if (showDecimals && decPart) {
    result += ',' + decPart; // Colombian uses comma for decimals
  }

  return isNegative ? '-' + result : result;
}

/**
 * Format a number as compact Colombian Pesos for tight spaces (chart axes,
 * stat cards): "$11.2M", "-$45.0M", "$250K". Falls back to full
 * `formatCurrency` under 1.000. Guards null/undefined/NaN -> "$0".
 */
export function formatCompactCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(amount)) return '$0';
  const sign = amount < 0 ? '-' : '';
  const abs = Math.abs(amount);
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(0)}K`;
  return formatCurrency(amount);
}

/**
 * Format a date in Spanish format (Colombia timezone)
 * @param date - Date string or Date object
 * @returns Formatted date like "15 de enero de 2024"
 */
export function formatDateSpanish(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('es-CO', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'America/Bogota',
  });
}

/**
 * Format a datetime in Colombia timezone
 * @param date - Date string or Date object
 * @returns Formatted datetime like "23/01/2024 15:30"
 */
export function formatDateTimeColombia(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('es-CO', {
    timeZone: 'America/Bogota',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Get current date string in Colombia timezone (YYYY-MM-DD format for API)
 * @returns Date string in format "2024-01-23"
 */
export function getColombiaDateString(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
}

/**
 * Get the current instant.
 *
 * El instante es independiente de la zona horaria: ``new Date()`` ya representa
 * "ahora". El ajuste a Colombia se hace en el momento de FORMATEAR (los callers
 * usan ``toLocaleDateString(..., { timeZone: 'America/Bogota' })``). El patrón
 * anterior (re-parsear el string localizado) corrompía el epoch en entornos
 * que no estuvieran en UTC-5 (p. ej. CI corre en UTC → quedaba 5h atrás).
 */
export function getColombiaNow(): Date {
  return new Date();
}
