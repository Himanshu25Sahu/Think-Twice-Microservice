/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './app/**/*.{js,jsx}',
    './components/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#0a0a0f',
        card: '#12121a',
        hover: '#1a1a27',
        deep: '#0e0e15',
        border: '#1e1e2e',
        'border-light': '#2a2a3e',
        accent: '#6366f1',
        'accent-hover': '#818cf8',
      },
      textColor: {
        primary: '#e4e4e7',
        secondary: '#71717a',
        muted: '#52525b',
      },
      spacing: {
        sidebar: '16rem',
      },
    },
  },
  plugins: [],
}
