import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        chalar: {
          50: '#f2f8f4',
          100: '#dfefe4',
          200: '#c0dfcb',
          300: '#94c7a8',
          400: '#62a87f',
          500: '#3d8b5f',
          600: '#2b6f4a',
          700: '#22593c',
          800: '#1d4732',
          900: '#183b2a',
          950: '#0d2117',
        },
        /* Warm accent ramp derived from the terracotta/clay tone (#EA9072) used by
           premium food-brand sites such as eatnaked.co — used sparingly for kickers,
           active indicators and numeric highlights against the Chalar greens. */
        clay: {
          50: '#fdf6f2',
          100: '#fae9e0',
          200: '#f5d0be',
          300: '#eeb095',
          400: '#ea9072',
          500: '#dd7553',
          600: '#c25c3d',
          700: '#a04832',
          800: '#823c2c',
          900: '#6a3427',
          950: '#391912',
        },
        /* Brand colours sampled from the Chalar Farms logo artwork */
        rust: {
          300: '#c9785f',
          400: '#b0583d',
          500: '#943f28',
          600: '#7a3220',
          700: '#5f2618',
          800: '#451c12',
        },
        leaf: {
          200: '#c7f2bd',
          300: '#97e486',
          400: '#6fcf5f',
          500: '#4da745',
          600: '#3a8a35',
          700: '#2c6a29',
        },
        /* Warm off-white used for light sections (eatnaked.co-style editorial cream) */
        cream: {
          50: '#fcfaf6',
          100: '#f7f2ea',
          200: '#efe6d8',
          300: '#e2d4bf',
        },
        ink: {
          50: '#f6f7f6',
          100: '#e7e9e7',
          200: '#cfd3cf',
          300: '#a9b0a9',
          400: '#7d877e',
          500: '#5d675e',
          600: '#48514a',
          700: '#3a423c',
          800: '#262c28',
          900: '#191d1a',
          950: '#0f120f',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)'],
        serif: ['var(--font-display)'],
        display: ['var(--font-display)'],
      },
      letterSpacing: {
        kicker: '0.28em',
      },
      boxShadow: {
        card: '0 1px 2px rgba(16,24,20,0.04), 0 8px 24px -12px rgba(16,24,20,0.12)',
        lift: '0 2px 4px rgba(16,24,20,0.05), 0 22px 44px -22px rgba(16,24,20,0.28)',
        inset: 'inset 0 1px 0 rgba(255,255,255,0.6)',
        glow: '0 0 0 1px rgba(111,207,95,0.18), 0 0 32px -6px rgba(111,207,95,0.45)',
      },
      transitionTimingFunction: {
        editorial: 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
      keyframes: {
        'marquee-x': {
          to: { transform: 'translate3d(-50%, 0, 0)' },
        },
        drift: {
          '0%, 100%': { transform: 'translate3d(0, 0, 0)' },
          '50%': { transform: 'translate3d(0, -10px, 0)' },
        },
        kenburns: {
          '0%': { transform: 'scale(1.02) translate3d(0, 0, 0)' },
          '100%': { transform: 'scale(1.12) translate3d(0, -1.5%, 0)' },
        },
      },
      animation: {
        'marquee-x': 'marquee-x var(--marquee-duration, 48s) linear infinite',
        drift: 'drift 7s ease-in-out infinite',
        kenburns: 'kenburns 22s ease-in-out infinite alternate',
      },
    },
  },
  plugins: [],
};

export default config;
