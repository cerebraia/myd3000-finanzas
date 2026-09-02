import type { Config } from 'tailwindcss'
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        base: { DEFAULT: '#F4F6FA', surface: '#FFFFFF', elevated: '#EEF2F8', border: '#DDE3EE', hover: '#E8EDF8' },
        navy: { DEFAULT: '#0F2244', hover: '#16305E', active: '#1A3A70', border: '#192E54' },
        brand: {
          50: '#EFF6FF', 100: '#DBEAFE', 200: '#BFDBFE', 300: '#93C5FD',
          400: '#60A5FA', 500: '#3B82F6', 600: '#1D4ED8', 700: '#1E40AF',
          800: '#1E3A8A', 900: '#172A6E',
        },
        content: { primary: '#0F172A', secondary: '#334155', muted: '#64748B', disabled: '#94A3B8' },
      },
      fontFamily: {
        sans: ['Helvetica', 'Arial', 'sans-serif'],
        mono: ['ui-monospace', 'monospace'],
      },
      borderRadius: { xl: '0.5rem', '2xl': '0.75rem' },
      boxShadow: {
        card: '0 1px 3px rgba(15,34,68,0.06),0 1px 2px rgba(15,34,68,0.04)',
        modal: '0 4px 16px rgba(15,34,68,0.10)',
      },
    },
  },
  plugins: [],
} satisfies Config
