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
 * Format price as simple number with thousand separators (no currency symbol)
 */
export function formatNumber(num: number): string {
  return new Intl.NumberFormat('es-CO').format(num);
}
