/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        campo: { 50: '#f0f7f3', 500: '#2e7d5b', 700: '#1f5c45', 900: '#12382b' },
      },
    },
  },
  plugins: [],
}
