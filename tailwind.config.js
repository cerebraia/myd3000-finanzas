export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        myd: {
          navy: '#0f2040',
          blue: '#1a3a6b',
          'blue-hover': '#152f5a',
          bg: '#f4f6f9',
          surface: '#ffffff',
          border: '#e2e6ed',
          text: '#1a2332',
          muted: '#6b7a90',
          success: '#16a34a',
          warning: '#d97706',
          danger: '#dc2626',
        },
      },
      fontFamily: {
        sans: ['Helvetica', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
