/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#e8fafa',
          100: '#b5e8e8',
          200: '#82d8d6',
          300: '#4fc8c5',
          400: '#26b8b4',
          500: '#0fc6c2',
          600: '#0bada9',
          700: '#099490',
          800: '#087b78',
          900: '#076461',
        },
      },
    },
  },
  plugins: [],
}
