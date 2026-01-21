import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}'
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['var(--font-display)', 'serif'],
        body: ['var(--font-body)', 'sans-serif']
      },
      colors: {
        ink: '#1b1f24',
        mist: '#f4f0e8',
        ember: '#f7b36a',
        lagoon: '#2b8c8c',
        dawn: '#f8dcb3',
        tide: '#a6d3c8'
      },
      boxShadow: {
        glow: '0 0 40px rgba(247, 179, 106, 0.35)',
        halo: '0 0 60px rgba(43, 140, 140, 0.25)'
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' }
        },
        drift: {
          '0%': { transform: 'translateX(0px)' },
          '50%': { transform: 'translateX(12px)' },
          '100%': { transform: 'translateX(0px)' }
        },
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(18px)' },
          '100%': { opacity: '1', transform: 'translateY(0px)' }
        }
      },
      animation: {
        float: 'float 8s ease-in-out infinite',
        drift: 'drift 10s ease-in-out infinite',
        fadeUp: 'fadeUp 0.8s ease-out forwards'
      }
    }
  },
  plugins: []
};

export default config;
