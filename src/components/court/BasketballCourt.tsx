'use client';

import { useMemo } from 'react';
import clsx from 'clsx';
import { colors } from '@/lib/design-tokens';

// ── Zone identifiers ──────────────────────────────────────────────
export type ShotZone =
  | 'Restricted Area'
  | 'In The Paint'
  | 'Mid-Range'
  | 'Left Corner 3'
  | 'Right Corner 3'
  | 'Above the Break 3'
  | 'Backcourt';

// ── Props ─────────────────────────────────────────────────────────
export interface BasketballCourtProps {
  /** Rendered width in px (default 500) */
  width?: number;
  /** Rendered height in px (default 470) */
  height?: number;
  /** Whether to show zone overlays */
  showZones?: boolean;
  /** Map of zone -> fill colour */
  zoneColors?: Partial<Record<ShotZone, string>>;
  /** Additional CSS class names */
  className?: string;
}

// ── NBA half-court dimensions (feet) ──────────────────────────────
// Court is 50 ft wide, half-court is 47 ft deep.
// Origin at basket center; basket at (25, 5.25).
// We work in a 500 x 470 viewBox (10 px/ft).

const COURT_W = 500; // 50 ft * 10
const COURT_H = 470; // 47 ft * 10

// Basket center
const BX = 250;
const BY = 52.5; // 5.25 ft from baseline * 10

// Key / paint
const KEY_W = 160; // 16 ft
const KEY_H = 190; // 19 ft
const KEY_LEFT = BX - KEY_W / 2;

// Free-throw circle radius
const FT_RADIUS = 60; // 6 ft

// 3-point arc
const THREE_RADIUS = 237.5; // 23.75 ft * 10
const THREE_SIDE_Y = 140; // corner 3 extends 14 ft from baseline
const CORNER_3_X = 30; // 3 ft from sideline * 10

// Restricted area arc
const RESTRICTED_RADIUS = 40; // 4 ft

// Backboard
const BACKBOARD_W = 60; // 6 ft
const BACKBOARD_Y = 40; // 4 ft from baseline

// Rim
const RIM_RADIUS = 9; // 0.75 ft (18-inch diameter)

const LINE = colors.chromeDim;
const LINE_WIDTH = 1.5;

// ── Zone paths (SVG clip paths for overlays) ──────────────────────

function restrictedAreaPath(): string {
  const startAngle = Math.PI;
  const endAngle = 0;
  const steps = 60;
  let d = `M ${BX - RESTRICTED_RADIUS} ${BY}`;
  for (let i = 0; i <= steps; i++) {
    const angle = startAngle + (endAngle - startAngle) * (i / steps);
    const px = BX + RESTRICTED_RADIUS * Math.cos(angle);
    const py = BY - RESTRICTED_RADIUS * Math.sin(angle);
    d += ` L ${px} ${py}`;
  }
  d += ' Z';
  return d;
}

function paintPath(): string {
  // Paint minus restricted area
  return `M ${KEY_LEFT} 0 L ${KEY_LEFT} ${KEY_H} L ${KEY_LEFT + KEY_W} ${KEY_H} L ${KEY_LEFT + KEY_W} 0 Z`;
}

function threePointArcPath(): string {
  const steps = 80;
  // Start from left corner
  let d = `M ${CORNER_3_X} 0 L ${CORNER_3_X} ${THREE_SIDE_Y}`;
  // Arc
  for (let i = 0; i <= steps; i++) {
    const angle = Math.PI - Math.acos((CORNER_3_X - BX) / THREE_RADIUS)
      + (2 * Math.acos((CORNER_3_X - BX) / THREE_RADIUS)) * (i / steps);
    const px = BX + THREE_RADIUS * Math.cos(angle);
    const py = BY - THREE_RADIUS * Math.sin(angle);
    if (py >= 0) {
      d += ` L ${px} ${py}`;
    }
  }
  d += ` L ${COURT_W - CORNER_3_X} ${THREE_SIDE_Y}`;
  d += ` L ${COURT_W - CORNER_3_X} 0`;
  d += ' Z';
  return d;
}

function buildZonePaths(): Record<ShotZone, string> {
  return {
    'Restricted Area': restrictedAreaPath(),
    'In The Paint': paintPath(),
    'Mid-Range': `M 0 0 L 0 ${COURT_H} L ${COURT_W} ${COURT_H} L ${COURT_W} 0 Z`,
    'Left Corner 3': `M 0 0 L 0 ${THREE_SIDE_Y} L ${CORNER_3_X} ${THREE_SIDE_Y} L ${CORNER_3_X} 0 Z`,
    'Right Corner 3': `M ${COURT_W - CORNER_3_X} 0 L ${COURT_W - CORNER_3_X} ${THREE_SIDE_Y} L ${COURT_W} ${THREE_SIDE_Y} L ${COURT_W} 0 Z`,
    'Above the Break 3': threePointArcPath(),
    'Backcourt': `M 0 ${COURT_H - 10} L 0 ${COURT_H} L ${COURT_W} ${COURT_H} L ${COURT_W} ${COURT_H - 10} Z`,
  };
}

// ── Component ─────────────────────────────────────────────────────

export default function BasketballCourt({
  width,
  height,
  showZones = false,
  zoneColors,
  className,
}: BasketballCourtProps) {
  const zonePaths = useMemo(() => buildZonePaths(), []);

  // Three-point arc line data
  const threePointArc = useMemo(() => {
    const steps = 120;
    const startAngle = Math.PI - Math.acos((CORNER_3_X - BX) / THREE_RADIUS);
    const endAngle = Math.acos((CORNER_3_X - BX) / THREE_RADIUS);
    const points: string[] = [];
    for (let i = 0; i <= steps; i++) {
      const angle = startAngle + (endAngle - startAngle) * (i / steps);
      const px = BX + THREE_RADIUS * Math.cos(angle);
      const py = BY - THREE_RADIUS * Math.sin(angle);
      if (py >= 0) {
        points.push(`${px},${py}`);
      }
    }
    return points.join(' ');
  }, []);

  // Restricted area arc
  const restrictedArc = useMemo(() => {
    const steps = 60;
    const points: string[] = [];
    for (let i = 0; i <= steps; i++) {
      const angle = Math.PI + (0 - Math.PI) * (i / steps);
      const px = BX + RESTRICTED_RADIUS * Math.cos(angle);
      const py = BY - RESTRICTED_RADIUS * Math.sin(angle);
      points.push(`${px},${py}`);
    }
    return points.join(' ');
  }, []);

  // Free throw semicircle (top half, toward half-court)
  const ftSemiTop = useMemo(() => {
    const steps = 60;
    const cy = KEY_H;
    const points: string[] = [];
    for (let i = 0; i <= steps; i++) {
      const angle = Math.PI * (i / steps);
      const px = BX + FT_RADIUS * Math.cos(angle);
      const py = cy - FT_RADIUS * Math.sin(angle);
      points.push(`${px},${py}`);
    }
    return points.join(' ');
  }, []);

  // Free throw semicircle (bottom half, dashed)
  const ftSemiBottom = useMemo(() => {
    const steps = 60;
    const cy = KEY_H;
    const points: string[] = [];
    for (let i = 0; i <= steps; i++) {
      const angle = Math.PI + Math.PI * (i / steps);
      const px = BX + FT_RADIUS * Math.cos(angle);
      const py = cy - FT_RADIUS * Math.sin(angle);
      points.push(`${px},${py}`);
    }
    return points.join(' ');
  }, []);

  const defaultZoneColors: Partial<Record<ShotZone, string>> = {
    'Restricted Area': `${colors.accentRed}18`,
    'In The Paint': `${colors.accentOrange}14`,
    'Mid-Range': `${colors.accentGold}10`,
    'Left Corner 3': `${colors.accentGreen}14`,
    'Right Corner 3': `${colors.accentGreen}14`,
    'Above the Break 3': `${colors.accentBlue}14`,
    'Backcourt': `${colors.accentViolet}0a`,
  };

  const mergedZoneColors = { ...defaultZoneColors, ...zoneColors };

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${COURT_W} ${COURT_H}`}
      preserveAspectRatio="xMidYMid meet"
      className={clsx('select-none', className)}
      role="img"
      aria-label="NBA half-court diagram"
    >
      {/* ── Zone overlays ───────────────────────────────── */}
      {showZones && (
        <g aria-label="Shot zones">
          {(Object.keys(zonePaths) as ShotZone[]).map((zone) => (
            <path
              key={zone}
              d={zonePaths[zone]}
              fill={mergedZoneColors[zone] ?? 'transparent'}
              stroke="none"
            />
          ))}
        </g>
      )}

      {/* ── Court boundary ──────────────────────────────── */}
      <rect
        x={0}
        y={0}
        width={COURT_W}
        height={COURT_H}
        fill="none"
        stroke={line}
        strokeWidth={LINE_WIDTH * 1.5}
      />

      {/* ── Paint / Key ─────────────────────────────────── */}
      <rect
        x={KEY_LEFT}
        y={0}
        width={KEY_W}
        height={KEY_H}
        fill="none"
        stroke={line}
        strokeWidth={LINE_WIDTH}
      />

      {/* ── Free throw circle (top half solid) ──────────── */}
      <polyline
        points={ftSemiTop}
        fill="none"
        stroke={line}
        strokeWidth={LINE_WIDTH}
      />

      {/* ── Free throw circle (bottom half dashed) ──────── */}
      <polyline
        points={ftSemiBottom}
        fill="none"
        stroke={line}
        strokeWidth={LINE_WIDTH}
        strokeDasharray="6 6"
      />

      {/* ── Three-point line ────────────────────────────── */}
      {/* Left corner */}
      <line
        x1={CORNER_3_X}
        y1={0}
        x2={CORNER_3_X}
        y2={THREE_SIDE_Y}
        stroke={line}
        strokeWidth={LINE_WIDTH}
      />
      {/* Arc */}
      <polyline
        points={threePointArc}
        fill="none"
        stroke={line}
        strokeWidth={LINE_WIDTH}
      />
      {/* Right corner */}
      <line
        x1={COURT_W - CORNER_3_X}
        y1={0}
        x2={COURT_W - CORNER_3_X}
        y2={THREE_SIDE_Y}
        stroke={line}
        strokeWidth={LINE_WIDTH}
      />

      {/* ── Restricted area ─────────────────────────────── */}
      <polyline
        points={restrictedArc}
        fill="none"
        stroke={line}
        strokeWidth={LINE_WIDTH}
      />

      {/* ── Backboard ───────────────────────────────────── */}
      <line
        x1={BX - BACKBOARD_W / 2}
        y1={BACKBOARD_Y}
        x2={BX + BACKBOARD_W / 2}
        y2={BACKBOARD_Y}
        stroke={line}
        strokeWidth={LINE_WIDTH * 1.5}
      />

      {/* ── Basket / Rim ────────────────────────────────── */}
      <circle
        cx={BX}
        cy={BY}
        r={RIM_RADIUS}
        fill="none"
        stroke={line}
        strokeWidth={LINE_WIDTH}
      />

      {/* ── Half-court line ─────────────────────────────── */}
      <line
        x1={0}
        y1={COURT_H}
        x2={COURT_W}
        y2={COURT_H}
        stroke={line}
        strokeWidth={LINE_WIDTH * 1.5}
      />

      {/* ── Center-court arc (partial) ──────────────────── */}
      <path
        d={`M ${BX - FT_RADIUS} ${COURT_H} A ${FT_RADIUS} ${FT_RADIUS} 0 0 0 ${BX + FT_RADIUS} ${COURT_H}`}
        fill="none"
        stroke={line}
        strokeWidth={LINE_WIDTH}
      />
    </svg>
  );
}

// Small helper to keep JSX cleaner – the stroke colour variable.
const line = LINE;
