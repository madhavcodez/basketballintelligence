import type { Config } from 'tailwindcss';

/**
 * Tailwind v4 uses CSS-based configuration via @theme in globals.css.
 * This file provides a JS fallback for tooling and plugins that still
 * read tailwind.config.ts. The primary token definitions live in
 * globals.css @theme blocks and src/lib/design-tokens.ts.
 */
const config: Config = {
  content: [
    './src/**/*.{ts,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          base: '#FAFAFA',
          card: '#FFFFFF',
          secondary: '#F5F5F7',
        },
        text: {
          primary: '#1D1D1F',
          secondary: '#6E6E73',
          tertiary: '#86868B',
        },
        border: {
          subtle: 'rgba(0,0,0,0.06)',
          medium: 'rgba(0,0,0,0.12)',
        },
        accent: {
          orange: '#FF6B35',
          blue: '#0071E3',
          green: '#34D399',
          red: '#F87171',
          gold: '#FBBF24',
          violet: '#A78BFA',
        },
      },
      fontFamily: {
        body: ['var(--font-inter)', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['var(--font-syne)', 'Syne', 'system-ui', 'sans-serif'],
        mono: ['var(--font-jetbrains)', 'JetBrains Mono', 'SF Mono', 'monospace'],
      },
      spacing: {
        '4.5': '18px',
        '13': '52px',
        '15': '60px',
        '18': '72px',
        '22': '88px',
      },
      borderRadius: {
        '2.5xl': '20px',
      },
      boxShadow: {
        card: '0 2px 8px rgba(0, 0, 0, 0.04), 0 12px 40px rgba(0, 0, 0, 0.08)',
        hover: '0 4px 16px rgba(0, 0, 0, 0.06), 0 20px 60px rgba(0, 0, 0, 0.12)',
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        scaleIn: {
          from: { opacity: '0', transform: 'scale(0.92)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
      },
      animation: {
        'fade-in': 'fadeIn 0.4s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
        shimmer: 'shimmer 2s ease-in-out infinite',
        'scale-in': 'scaleIn 0.3s ease-out',
      },
    },
  },
  plugins: [],
};

export default config;
