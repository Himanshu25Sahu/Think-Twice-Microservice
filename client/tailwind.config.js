/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './app/**/*.{js,jsx}',
    './components/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#FCFBF7',     // warm ivory canvas
        card: '#FFFFFF',        // surface
        hover: '#F2EEE4',       // subtle hover surface
        deep: '#F2EEE4',
        border: '#E7E2D6',      // warm hairline
        'border-light': '#D0C9BA',
        accent: '#2563EB',      // cobalt
        'accent-hover': '#1D4ED8',
      },
      textColor: {
        primary: '#18181B',     // ink
        secondary: '#52525B',
        muted: '#71717A',
      },
      spacing: {
        sidebar: '16rem',
      },
    },
  },
  plugins: [],
}
