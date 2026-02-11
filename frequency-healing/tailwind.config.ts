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
        ink: '#172034',
        mist: '#f2f0f9',
        ember: '#c79b73',
        lagoon: '#6a92c2',
        dawn: '#eee0d1',
        tide: '#b9ccc4'
      },
      boxShadow: {
        glow: '0 18px 48px rgba(114, 92, 177, 0.28)',
        halo: '0 24px 60px rgba(77, 109, 159, 0.24)'
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
