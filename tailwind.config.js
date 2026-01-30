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
        couple: {
          pink: '#FF2D55',
          rose: '#FF375F',
          soft: '#FFEFF4',
          gold: '#FFD700',
          deep: '#8E24AA',
          background: '#FFF5F7',
          card: '#FFFFFF',
          text: '#4A148C',
          secondary: '#7B1FA2',
        }
      },
      fontFamily: {
        'love': ['"Outfit"', '"Plus Jakarta Sans"', 'sans-serif'],
      },
      borderRadius: {
        'love': '24px',
        'love-lg': '32px',
        'love-pill': '9999px',
      },
      boxShadow: {
        'love': '0 10px 30px -5px rgba(255, 45, 85, 0.15)',
        'love-lg': '0 20px 40px -10px rgba(255, 45, 85, 0.25)',
      },
      animation: {
        'float': 'float 3s ease-in-out infinite',
        'heartbeat': 'heartbeat 1.5s ease-in-out infinite',
        'fade-up': 'fade-up 0.5s ease-out forwards',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        heartbeat: {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.1)' },
        },
        'fade-up': {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        }
      },
    },
  },
  plugins: [],
}