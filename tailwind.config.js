/** @type {import('tailwindcss').Config} */
// Palette lives in CSS variables (src/index.css) so dark mode can swap it.
// Values are RGB triplets to keep Tailwind's opacity modifiers working.
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        paper: v('c-paper'),
        paper2: v('c-paper2'),
        ink: v('c-ink'),
        ink2: v('c-ink2'),
        ink3: v('c-ink3'),
        line: v('c-line'),
        sage: { DEFAULT: v('c-sage'), dark: v('c-sage-dark'), light: v('c-sage-light') },
        clay: v('c-clay'),
        heartred: v('c-heartred'),
        dblue: v('c-dblue'),
      },
      fontFamily: {
        sans: ['Inter Variable', 'system-ui', '-apple-system', 'sans-serif'],
        serif: ['Fraunces Variable', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [],
}
