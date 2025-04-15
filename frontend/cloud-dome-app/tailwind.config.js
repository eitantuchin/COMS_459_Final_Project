/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{vue,js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Open Sans', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', 'sans-serif'],
      },
      colors: {
        'brand-blue': '#006EDC',
        'brand-blue-light': 'rgba(42, 172, 234, 1)',
        'brand-dark': '#0d1b29',
        'brand-gray': '#f0f0f0',
        'brand-red': '#d32f2f',
        'brand-green': '#388e3c',
        'brand-light-gray': '#e0e0e0',
        'brand-hover-blue': '#005BB5',
        'brand-dropdown-hover': '#e6f3fa',
        'brand-bg': '#e5edfa',
      },
      boxShadow: {
        'custom': '0 4px 8px rgba(0, 0, 0, 0.2)',
        'custom-lg': '0 8px 16px rgba(0, 0, 0, 0.2)',
        'custom-xl': '0 6px 20px rgba(0, 0, 0, 0.15)',
      },
    },
  },
  plugins: [],
}