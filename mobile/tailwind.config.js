/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#FBF6EA',
          100: '#F5ECD4',
          200: '#EBDAAB',
          300: '#DFC67E',
          400: '#D4AF37',
          500: '#B8860B',
          600: '#9A7209',
          700: '#7C5B07',
          800: '#5E4505',
          900: '#3D2D03',
        },
        accent: {
          50: '#FBF6EA',
          100: '#F5ECD4',
          400: '#D4AF37',
          500: '#B8860B',
          600: '#9A7209',
        },
        stone: {
          50: '#FAFAF9',
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
        surface: {
          50: '#FFFFFF',
          100: '#F8F7F4',
          200: '#F1EFE9',
        },
      },
    },
  },
  plugins: [],
};
