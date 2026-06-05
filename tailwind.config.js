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
      boxShadow: {
        card: '0 1px 3px rgba(15, 198, 194, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06)',
        cardHover: '0 10px 15px -3px rgba(15, 198, 194, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
        dropdown: '0 10px 15px -3px rgba(15, 198, 194, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
      },
      borderRadius: {
        card: '12px',
        button: '8px',
      },
      spacing: {
        'card-padding': '1.5rem',
        'section-gap': '1.5rem',
      },
      transitionDuration: {
        'fast': '150ms',
        'normal': '250ms',
        'slow': '350ms',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
        'bounce-soft': 'bounceSoft 1s ease-in-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideDown: {
          '0%': { opacity: '0', transform: 'translateY(-10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
        bounceSoft: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-5px)' },
        },
      },
    },
  },
  plugins: [],
}
