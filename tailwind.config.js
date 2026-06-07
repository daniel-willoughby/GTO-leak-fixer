/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: '#f5f2ea',
        paper2: '#fcfaf4',
        ink: '#221f19',
        ink2: '#6b675c',
        ink3: '#9a968a',
        line: '#e6e0d3',
        sage: { DEFAULT: '#5b7461', dark: '#435448', light: '#6f8a76' },
        clay: '#b16a52',
        heartred: '#b1422c',
        dblue: '#3a5a8c',
      },
      fontFamily: {
        sans: ['Inter Variable', 'system-ui', '-apple-system', 'sans-serif'],
        serif: ['Fraunces Variable', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [],
}
