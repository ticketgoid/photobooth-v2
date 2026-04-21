/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        retro: {
          bg: '#a8a4e6',     // Pastel Lavender
          window: '#fbe9d0', // Pale yellow/beige
          header: '#f26d6d', // Soft Red/Pink
          success: '#6ebf9f',// Mint Green
          border: '#333333'  // Garis tegas 8-bit
        }
      },
      fontFamily: {
        pixel: ['"Press Start 2P"', 'cursive'],
        sys: ['"VT323"', 'monospace']
      }
    },
  },
  plugins: [],
}