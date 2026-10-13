import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#17231f',
        moss: '#175c48',
        mint: '#dff3eb',
        cream: '#f6f4ed',
        ember: '#d85b38',
      },
      boxShadow: {
        panel: '0 18px 45px rgba(23, 35, 31, 0.08)',
      },
    },
  },
  plugins: [],
} satisfies Config;
