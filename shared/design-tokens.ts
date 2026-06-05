/**
 * UCR Design Tokens — Canonical source of truth
 *
 * Each platform mirrors these values in its own config format:
 *   - frontend/tailwind.config.js (Tailwind v3)
 *   - web-portal/app/globals.css (@theme inline, Tailwind v4)
 *   - admin-portal/app/globals.css (@theme inline, Tailwind v4)
 *   - mobile/tailwind.config.js (NativeWind)
 *   - mobile/src/constants/brand.ts (native props)
 */

// ─── Brand Gold ──────────────────────────────────────────────
export const brand = {
  50:  '#FBF6EA',
  100: '#F5ECD4',
  200: '#EBDAAB',
  300: '#DFC67E',
  400: '#D4AF37', // logo gold, focus ring, active indicator
  500: '#B8860B', // primary CTA
  600: '#9A7209', // hover
  700: '#7C5B07', // pressed
  800: '#5E4505',
  900: '#3D2D03',
} as const;

// ─── Warm Stone Neutrals ────────────────────────────────────
export const stone = {
  50:  '#FAFAF9',
  100: '#F5F5F4',
  200: '#E7E5E4',
  300: '#D6D3D1',
  400: '#A8A29E',
  500: '#78716C',
  600: '#57534E',
  700: '#44403C',
  800: '#292524',
  900: '#1C1917',
} as const;

// ─── Surface ────────────────────────────────────────────────
export const surface = {
  50:  '#FFFFFF',  // cards
  100: '#F8F7F4', // page background
  200: '#F1EFE9', // hover
} as const;

// ─── Primary ────────────────────────────────────────────────
export const primary = {
  DEFAULT: '#1C1917',
  light:   '#292524',
  dark:    '#0D0D0D',
} as const;

// ─── Semantic ───────────────────────────────────────────────
export const semantic = {
  success: '#16A34A',
  warning: '#D97706',
  error:   '#DC2626',
  info:    '#2563EB',
} as const;

// ─── Semantic Surface/Text/Border ───────────────────────────
export const tokens = {
  surface: {
    base:     surface[100],
    card:     surface[50],
    elevated: surface[50],
    hover:    surface[200],
    active:   'rgba(212,175,55, 0.08)', // brand-400 tinted
    overlay:  'rgba(28,25,23, 0.6)',
  },
  text: {
    primary:   stone[900],
    secondary: stone[600],
    tertiary:  stone[400],
    muted:     stone[300],
    onBrand:   '#FFFFFF',
  },
  border: {
    subtle:  'rgba(28,25,23, 0.06)',
    default: 'rgba(28,25,23, 0.10)',
    strong:  'rgba(28,25,23, 0.16)',
    focus:   brand[400],
  },
} as const;

// ─── Shadows (multi-layer, warm tone) ───────────────────────
export const shadows = {
  xs: '0 1px 2px rgba(28,25,23, 0.04)',
  sm: '0 1px 3px rgba(28,25,23, 0.06), 0 1px 2px rgba(28,25,23, 0.04)',
  md: '0 4px 12px rgba(28,25,23, 0.07), 0 1px 3px rgba(28,25,23, 0.05)',
  lg: '0 12px 40px rgba(28,25,23, 0.08), 0 4px 12px rgba(28,25,23, 0.04)',
  xl: '0 24px 64px rgba(28,25,23, 0.12), 0 8px 24px rgba(28,25,23, 0.06)',
} as const;

// ─── Motion ─────────────────────────────────────────────────
export const duration = {
  instant:  '80ms',
  fast:     '150ms',
  base:     '200ms',
  moderate: '300ms',
  slow:     '400ms',
} as const;

export const easing = {
  out:    'cubic-bezier(0.16, 1, 0.3, 1)',
  in:     'cubic-bezier(0.55, 0, 1, 0.45)',
  inOut:  'cubic-bezier(0.65, 0, 0.35, 1)',
  spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
} as const;

// ─── Typography ─────────────────────────────────────────────
export const fonts = {
  sans:    "'Inter', system-ui, sans-serif",
  display: "'Outfit', system-ui, sans-serif",
  mono:    "'JetBrains Mono', ui-monospace, monospace",
} as const;

export const typeScale = {
  display:  { size: '28px', weight: 700, tracking: '-0.025em', font: 'display' },
  title1:   { size: '22px', weight: 700, tracking: '-0.02em',  font: 'display' },
  title2:   { size: '18px', weight: 600, tracking: '-0.01em',  font: 'display' },
  title3:   { size: '15px', weight: 600, tracking: '-0.01em',  font: 'display' },
  body:     { size: '14px', weight: 400, tracking: '0',        font: 'sans' },
  bodySm:   { size: '13px', weight: 400, tracking: '0',        font: 'sans' },
  caption:  { size: '11px', weight: 600, tracking: '0.06em',   font: 'sans' },
  mono:     { size: '10px', weight: 700, tracking: '0.1em',    font: 'mono' },
} as const;

// ─── Border Radius ──────────────────────────────────────────
export const radius = {
  sm:   '6px',
  md:   '8px',
  lg:   '12px',
  xl:   '16px',
  '2xl': '20px',
  full: '9999px',
} as const;
