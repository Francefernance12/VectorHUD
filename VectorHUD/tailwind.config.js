/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        overlay: 'rgba(0, 0, 0, 0.4)',
        surface: 'rgba(15, 15, 15, 0.8)',
        terminal: '#4AF626',
        warning: '#FFB000',
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'monospace'],
        sans: ['Inter', 'Geist', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
