/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'lgc-blue': '#303d4f',
        'lgc-black': '#252724',
        'lgc-white': '#fcfcfc',
        'lgc-grey': '#e7e4dd',
        'lgc-orange': '#FF6B35',
      },
    },
  },
  plugins: [],
}
