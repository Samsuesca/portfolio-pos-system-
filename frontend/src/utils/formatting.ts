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
 * Get current datetime in Colombia timezone
 * @returns Date object adjusted to Colombia time
 */
export function getColombiaNow(): Date {
  const now = new Date();
  return new Date(now.toLocaleString('en-US', { timeZone: 'America/Bogota' }));
}
