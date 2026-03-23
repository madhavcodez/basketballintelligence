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
        dark: {
          base: '#0a0a12',
          surface: '#12121e',
          elevated: '#1a1a2e',
        },
        glass: {
          bg: 'rgba(255,255,255,0.06)',
          border: 'rgba(255,255,255,0.12)',
          frosted: 'rgba(255,255,255,0.10)',
        },
        chrome: {
          light: 'rgba(255,255,255,0.94)',
          medium: 'rgba(255,255,255,0.70)',
          dim: 'rgba(255,255,255,0.44)',
          faint: 'rgba(255,255,255,0.24)',
        },
        accent: {
          orange: '#FF6B35',
          blue: '#4DA6FF',
          green: '#34D399',
          red: '#F87171',
          gold: '#FBBF24',
          violet: '#A78BFA',
        },
      },
      fontFamily: {
        body: ["'Inter'", 'system-ui', '-apple-system', 'sans-serif'],
        display: ['system-ui', '-apple-system', "'SF Pro Rounded'", "'Inter'", 'sans-serif'],
      },
      backdropBlur: {
        xs: '4px',
        '2xl': '64px',
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
