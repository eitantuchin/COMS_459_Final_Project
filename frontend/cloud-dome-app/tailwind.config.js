/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
      "./src/**/*.{vue,js,ts,jsx,tsx}", // Scans all Vue and JS files in src
    ],
    theme: {
      extend: {
        fontFamily: {
          sans: ['Open Sans', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', 'sans-serif'],
        },
      },
    },
    plugins: [],
  }