/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './app/**/*.{js,jsx}',
    './components/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          primary: '#0a0a0f',
          card: '#12121a',
          hover: '#1a1a27',
          deep: '#0e0e15',
        },
        border: {
          DEFAULT: '#1e1e2e',
          light: '#2a2a3e',
        },
        text: {
          primary: '#e4e4e7',
          secondary: '#71717a',
          muted: '#52525b',
        },
      },
      spacing: {
        sidebar: '16rem',
      },
    },
  },
  plugins: [],
}
