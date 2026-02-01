/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        display: ['Outfit', 'sans-serif'],
      },
      colors: {
        // Gold Palette - Brand Colors (from logo)
        brand: {
          50: '#fefce8',
          100: '#fef9c3',
          200: '#fef08a',
          300: '#fde047',
          400: '#facc15',
          500: '#D4AF37', // Gold
          600: '#C9A227', // Main Brand Color (logo gold)
          700: '#A78B1F',
          800: '#854d0e',
          900: '#713f12',
          950: '#422006',
        },
        // Deep Black for Sidebar/Headers (from logo)
        primary: {
          DEFAULT: '#1A1A1A', // Rich Black
          light: '#2D2D2D',   // Lighter Black
          dark: '#0D0D0D',    // Darker Black
        },
        // Surface colors for backgrounds
        surface: {
          50: '#fafafa',
          100: '#f5f5f5',
          200: '#e5e5e5',
        },
        // Accent gold for highlights
        gold: {
          light: '#E8D48A',
          DEFAULT: '#C9A227',
          dark: '#8B7019',
        }
      }
    },
  },
  plugins: [],
}
