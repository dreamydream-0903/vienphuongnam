/** @type {import('tailwindcss').Config} */
const defaultTheme = require('tailwindcss/defaultTheme')

module.exports = {
  content: [
    './src/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
    './pages/**/*.{js,ts,jsx,tsx}',
    './components/ui/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: 'hsl(220, 60%, 50%)',
          light: 'hsl(220, 60%, 65%)',
          dark: 'hsl(220, 60%, 35%)',
        },
        secondary: 'hsl(340, 80%, 60%)',
        accent: 'hsl(50, 100%, 50%)',
        neutral: {
          100: '#f5f5f5',
          200: '#eeeeee',
          300: '#cccccc',
          700: '#333333',
        },
      },
      container: {
        center: true,
        padding: {
          DEFAULT: '1rem',
          sm: '1rem',
          md: '2rem',
          lg: '2rem',
          xl: '2rem',
          '2xl': '2rem',
        },
        screens: { '2xl': '1400px' },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', ...defaultTheme.fontFamily.sans],
        mono: ['Fira Code', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [
    require('@tailwind/forms'),
    require('@tailwind/typography'),
  ],
}
