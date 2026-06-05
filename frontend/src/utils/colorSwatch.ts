/**
 * Best-effort mapping of a free-text color name (Spanish) to a CSS color,
 * used to render small color swatches next to variants. Falls back to a neutral
 * grey when the name isn't a recognizable color.
 */
const COLOR_MAP: Record<string, string> = {
  azul: '#2563eb',
  'azul rey': '#1d4ed8',
  'azul oscuro': '#1e3a8a',
  'azul claro': '#60a5fa',
  rojo: '#dc2626',
  verde: '#16a34a',
  amarillo: '#eab308',
  blanco: '#f8fafc',
  negro: '#1c1917',
  gris: '#9ca3af',
  'gris oscuro': '#4b5563',
  beige: '#e7d8b8',
  cafe: '#92400e',
  'café': '#92400e',
  marron: '#92400e',
  naranja: '#ea580c',
  morado: '#7c3aed',
  rosado: '#ec4899',
  rosa: '#ec4899',
  vinotinto: '#7f1d1d',
  fucsia: '#d946ef',
  turquesa: '#14b8a6',
};

export function colorToCss(name: string): string {
  return COLOR_MAP[name.trim().toLowerCase()] ?? '#d6d3d1';
}
