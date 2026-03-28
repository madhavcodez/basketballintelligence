// Basketball Intelligence Design Tokens
// Apple.com-inspired premium light mode design system

// ─── Color System ────────────────────────────────────────────────────────────

export const colors = {
  // Base surfaces (new)
  bgBase: '#FAFAFA',
  bgCard: '#FFFFFF',
  bgSecondary: '#F5F5F7',

  // Text hierarchy (new)
  textPrimary: '#1D1D1F',
  textSecondary: '#6E6E73',
  textTertiary: '#86868B',

  // Borders (new)
  borderSubtle: 'rgba(0,0,0,0.06)',
  borderMedium: 'rgba(0,0,0,0.12)',

  // Accent palette
  accentOrange: '#FF6B35',
  accentBlue: '#0071E3',
  accentGreen: '#34D399',
  accentRed: '#F87171',
  accentGold: '#FBBF24',
  accentViolet: '#A78BFA',

  // Backward-compatible aliases (old dark → light equivalents)
  darkBase: '#FAFAFA',
  darkSurface: '#FFFFFF',
  darkElevated: '#F5F5F7',
  glassBg: 'rgba(0,0,0,0.03)',
  glassBorder: 'rgba(0,0,0,0.06)',
  glassFrosted: 'rgba(0,0,0,0.02)',
  chromeLight: '#1D1D1F',
  chromeMedium: '#6E6E73',
  chromeDim: '#86868B',
  chromeFaint: 'rgba(0,0,0,0.12)',
} as const;

export type ColorToken = keyof typeof colors;

// ─── Spacing ─────────────────────────────────────────────────────────────────

export const spacing = {
  '1': 4,
  '2': 8,
  '3': 12,
  '4': 16,
  '5': 20,
  '6': 24,
  '8': 32,
  '12': 48,
  '16': 64,
} as const;

export type SpacingToken = keyof typeof spacing;

// ─── Border Radii ────────────────────────────────────────────────────────────

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
} as const;

export type RadiusToken = keyof typeof radii;

// ─── Typography ──────────────────────────────────────────────────────────────

export const fontFamily = {
  body: "var(--font-inter), 'Inter', system-ui, -apple-system, sans-serif",
  display: "var(--font-syne), 'Syne', system-ui, sans-serif",
  mono: "var(--font-jetbrains), 'JetBrains Mono', 'SF Mono', monospace",
} as const;

export const fontSize = {
  xs: { size: '0.6875rem', lineHeight: '1rem' },       // 11px
  sm: { size: '0.75rem', lineHeight: '1.125rem' },     // 12px
  base: { size: '0.875rem', lineHeight: '1.375rem' },  // 14px
  lg: { size: '1rem', lineHeight: '1.5rem' },          // 16px
  xl: { size: '1.25rem', lineHeight: '1.75rem' },      // 20px
  '2xl': { size: '1.5rem', lineHeight: '2rem' },       // 24px
  '3xl': { size: '2rem', lineHeight: '2.5rem' },       // 32px
  '4xl': { size: '2.5rem', lineHeight: '3rem' },       // 40px
  '5xl': { size: '3rem', lineHeight: '3.5rem' },       // 48px
  '6xl': { size: '4rem', lineHeight: '4.5rem' },       // 64px
} as const;

export const fontWeight = {
  regular: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
  extrabold: 800,
} as const;

export const letterSpacing = {
  tight: '-0.02em',
  normal: '0em',
  wide: '0.04em',
  wider: '0.08em',
} as const;

export type FontSizeToken = keyof typeof fontSize;
export type FontWeightToken = keyof typeof fontWeight;

// ─── Animations ──────────────────────────────────────────────────────────────

export const animation = {
  duration: {
    fast: 150,
    normal: 250,
    slow: 400,
    slower: 600,
  },
  easing: {
    default: 'cubic-bezier(0.4, 0, 0.2, 1)',
    spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
    decelerate: 'cubic-bezier(0, 0, 0.2, 1)',
    accelerate: 'cubic-bezier(0.4, 0, 1, 1)',
  },
  spring: {
    gentle: { type: 'spring' as const, stiffness: 120, damping: 14 },
    snappy: { type: 'spring' as const, stiffness: 300, damping: 20 },
    bouncy: { type: 'spring' as const, stiffness: 400, damping: 10 },
  },
} as const;

// ─── Shadows ─────────────────────────────────────────────────────────────────

export const shadows = {
  card: '0 2px 8px rgba(0, 0, 0, 0.04), 0 12px 40px rgba(0, 0, 0, 0.08)',
  hover: '0 4px 16px rgba(0, 0, 0, 0.06), 0 20px 60px rgba(0, 0, 0, 0.12)',
  subtle: '0 1px 3px rgba(0, 0, 0, 0.04)',
  elevated: '0 8px 30px rgba(0, 0, 0, 0.1)',
  nav: '0 1px 0 rgba(0, 0, 0, 0.06)',
} as const;

// ─── Motion Presets (Framer Motion) ────────────────────────────────────────

export const motionPresets = {
  fadeInUp: {
    initial: { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0 },
    transition: { type: 'spring' as const, stiffness: 120, damping: 14 },
  },
  scaleIn: {
    initial: { opacity: 0, scale: 0.95 },
    animate: { opacity: 1, scale: 1 },
    transition: { type: 'spring' as const, stiffness: 200, damping: 20 },
  },
  hoverLift: {
    whileHover: { y: -2 },
    transition: { type: 'spring' as const, stiffness: 300, damping: 20 },
  },
  staggerContainer: {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.06, delayChildren: 0.1 },
    },
  },
  staggerItem: {
    hidden: { opacity: 0, y: 16 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { type: 'spring' as const, stiffness: 120, damping: 14 },
    },
  },
} as const;

// ─── Z-Index Scale ───────────────────────────────────────────────────────────

export const zIndex = {
  base: 0,
  elevated: 10,
  sticky: 20,
  overlay: 30,
  modal: 40,
  toast: 50,
  nav: 60,
} as const;
