import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        navy:  { DEFAULT: '#0a0e1a', 2: '#0f1729', 3: '#162040' },
        gold:  { DEFAULT: '#d4af37', light: '#f5e06e', dark: '#a08829' },
        even:  { DEFAULT: '#2563eb', light: '#dbeafe', dark: '#1d4ed8' },
        odd:   { DEFAULT: '#d97706', light: '#fef3c7', dark: '#b45309' },
      },
      fontFamily: {
        sans:  ['Sarabun', 'Inter', 'system-ui', 'sans-serif'],
        mono:  ['JetBrains Mono', 'monospace'],
      },
      boxShadow: {
        'premium': '0 4px 20px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.06)',
        'gold':    '0 0 30px rgba(212,175,55,0.4)',
        'even':    '0 4px 20px rgba(37,99,235,0.35)',
        'odd':     '0 4px 20px rgba(217,119,6,0.35)',
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.25rem',
        '4xl': '1.5rem',
      },
      animation: {
        'float':       'float 3s ease-in-out infinite',
        'glow-pulse':  'glow-pulse 2s ease-in-out infinite',
        'shimmer':     'shimmer 2s linear infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%':       { transform: 'translateY(-6px)' },
        },
        'glow-pulse': {
          '0%, 100%': { opacity: '1' },
          '50%':       { opacity: '.7' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
    },
  },
  plugins: [],
}

export default config
