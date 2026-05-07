/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
      },
      colors: {
        ink:  '#09090B',
        zinc: {
          25:  '#FAFAFA',
          150: '#ECECEE',
        },
        brand: {
          50:  '#EFF6FF',
          100: '#DBEAFE',
          500: '#3B82F6',
          600: '#2563EB',
          700: '#1D4ED8',
          800: '#1E40AF',
        },
      },
      boxShadow: {
        card: '0 1px 2px rgba(15,23,42,0.04), 0 1px 6px rgba(15,23,42,0.04)',
        cta:  '0 4px 14px rgba(37,99,235,0.28)',
      },
    },
  },
  plugins: [],
};
