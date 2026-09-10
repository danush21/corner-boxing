/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Bebas Neue"', 'cursive'],
        mono:    ['"Share Tech Mono"', 'monospace'],
        body:    ['"Barlow Condensed"', 'sans-serif'],
      },
      colors: {
        red:    '#e01f1f',
        gold:   '#c9a84c',
        dark:   '#0a0a0a',
        panel:  '#111111',
        border: '#1e1e1e',
        dim:    '#555555',
        green:  '#39ff14',
      },
    },
  },
  plugins: [],
};
