/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        dulang: {
          cream: '#FFF8E7',
          yellow: '#FFD700',
          black: '#111111',
          brown: '#5C3D2E',
          white: '#FFFFFF',
          gray: '#9CA3AF',
        }
      },
      fontFamily: {
        hand: ['Caveat', 'cursive'],
        sans: ['Plus Jakarta Sans', 'sans-serif'],
      },
      boxShadow: {
        'dulang-black': '8px 8px 0px #111111',
        'dulang-yellow': '8px 8px 0px #FFD700',
        'dulang-black-sm': '4px 4px 0px #111111',
        'dulang-yellow-sm': '4px 4px 0px #FFD700',
        'dulang-black-md': '6px 6px 0px #111111',
        'dulang-yellow-md': '6px 6px 0px #FFD700',
      }
    },
  },
  plugins: [],
}
