/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Outfit', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      colors: {
        // Brand - True Warm Gold (cohesive scale)
        brand: {
          50:  '#FBF6EA',
          100: '#F5ECD4',
          200: '#EBDAAB',
          300: '#DFC67E',
          400: '#D4AF37', // Logo gold
          500: '#B8860B', // Primary CTA (DarkGoldenrod)
          600: '#9A7209', // Hover
          700: '#7C5B07',
          800: '#5E4505',
          900: '#3D2D03',
        },
        // Neutral - Warm Stone
        stone: {
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
        },
        // Primary
        primary: {
          DEFAULT: '#1C1917',
          light: '#292524',
          dark: '#0D0D0D',
        },
        // Surface - Warm Light Backgrounds
        surface: {
          50:  '#FFFFFF',
          100: '#F8F7F4',
          200: '#F1EFE9',
        },
        // Gold accent (legacy compat)
        gold: {
          light: '#EBDAAB',
          DEFAULT: '#B8860B',
          dark: '#7C5B07',
        },
      }
    },
  },
  plugins: [],
}
