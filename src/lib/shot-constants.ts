// ── Court dimensions in NBA coordinate system ──────────────────────────────
// NBA shot data uses: x = -250..250, y = -47.5..422.5 (tenths of feet)
// Origin at basket center.

export const COURT = {
  WIDTH: 500,               // full x range: -250 to 250
  HEIGHT: 470,              // full y range: -47.5 to 422.5
  BASKET_X: 0,
  BASKET_Y: 0,
  THREE_PT_RADIUS: 237.5,
  RESTRICTED_RADIUS: 40,
  PAINT_LEFT: -80,
  PAINT_RIGHT: 80,
  PAINT_TOP: 190,           // 19 ft from baseline
  CORNER_THREE_Y: 92.5,
  CORNER_THREE_X: 220,
} as const;

// SVG viewBox mapping (matches BasketballCourt.tsx exactly)
export const SVG = {
  WIDTH: 500,
  HEIGHT: 470,
  BASKET_X: 250,
  BASKET_Y: 52.5,
} as const;

// NBA coordinate ranges
export const NBA = {
  X_MIN: -250,
  X_MAX: 250,
  Y_MIN: -47.5,
  Y_MAX: 422.5,
} as const;

// Size presets for HotZoneChart
export const CHART_SIZES = {
  sm: { width: 240, height: 226, hexRadius: 5 },
  md: { width: 360, height: 339, hexRadius: 6 },
  lg: { width: 500, height: 470, hexRadius: 8 },
  xl: { width: 700, height: 658, hexRadius: 10 },
} as const;

export type ChartSize = keyof typeof CHART_SIZES;

// Zone definitions with display names and point values
export const ZONES = {
  'Restricted Area': { label: 'Restricted', shortLabel: 'RA', pointValue: 2 },
  'In The Paint (Non-RA)': { label: 'Paint', shortLabel: 'PT', pointValue: 2 },
  'Mid-Range': { label: 'Mid-Range', shortLabel: 'MR', pointValue: 2 },
  'Left Corner 3': { label: 'Left Corner 3', shortLabel: 'LC3', pointValue: 3 },
  'Right Corner 3': { label: 'Right Corner 3', shortLabel: 'RC3', pointValue: 3 },
  'Above the Break 3': { label: 'Above Break 3', shortLabel: 'AB3', pointValue: 3 },
  'Backcourt': { label: 'Backcourt', shortLabel: 'BC', pointValue: 2 },
} as const;

export type ZoneName = keyof typeof ZONES;

export const ZONE_LIST: ZoneName[] = [
  'Restricted Area',
  'In The Paint (Non-RA)',
  'Mid-Range',
  'Left Corner 3',
  'Right Corner 3',
  'Above the Break 3',
  'Backcourt',
];

// Efficiency color stops (FG% diff from league avg)
export const EFFICIENCY_STOPS = {
  deepCold: '#1e3a5f',   // -15% or worse
  cold: '#2563eb',       // -10%
  cool: '#60a5fa',       // -5%
  neutral: '#fbbf24',    //  0% (league avg)
  warm: '#f97316',       // +5%
  hot: '#ef4444',        // +10%
  fire: '#dc2626',       // +15% or better
} as const;

// League average FG% by zone (default baselines)
export const LEAGUE_BASELINE: Record<string, number> = {
  'Restricted Area': 0.63,
  'In The Paint (Non-RA)': 0.40,
  'Mid-Range': 0.41,
  'Left Corner 3': 0.39,
  'Right Corner 3': 0.39,
  'Above the Break 3': 0.36,
  'Backcourt': 0.05,
};

// Shot signature thresholds
export const SIGNATURES = {
  PAINT_DOMINATOR: { minPaintPct: 0.40, minPaintFg: 0.55, label: 'Paint Dominator' },
  PERIMETER_SNIPER: { minThreePct: 0.50, minThreeFg: 0.37, label: 'Perimeter Sniper' },
  MID_RANGE_MAESTRO: { minMidPct: 0.30, minMidFg: 0.42, label: 'Mid-Range Maestro' },
  CORNER_SPECIALIST: { minCornerPct: 0.20, minCornerFg: 0.38, label: 'Corner Specialist' },
  THREE_LEVEL: { minEachPct: 0.15, label: 'Three-Level Scorer' },
  VOLUME_SCORER: { minAttempts: 1500, label: 'Volume Scorer' },
  BALANCED: { maxZonePct: 0.35, label: 'Balanced Attack' },
} as const;
