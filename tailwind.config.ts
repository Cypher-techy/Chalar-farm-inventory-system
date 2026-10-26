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
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        serif: ['Georgia', 'Cambria', 'Times New Roman', 'Times', 'serif'],
      },
    },
  },
  plugins: [],
};

export default config;
