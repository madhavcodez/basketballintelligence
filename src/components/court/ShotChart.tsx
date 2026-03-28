'use client';

import { useMemo, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as d3Scale from 'd3-scale';
import { hexbin as d3Hexbin } from 'd3-hexbin';
import clsx from 'clsx';
import BasketballCourt, { type ShotZone } from './BasketballCourt';
import { animation } from '@/lib/design-tokens';

// ── Types ─────────────────────────────────────────────────────────

export interface Shot {
  /** NBA x coord: -250 to 250 (in tenths of feet, 0 = basket) */
  x: number;
  /** NBA y coord: -47.5 to 422.5 (in tenths of feet, 0 = basket) */
  y: number;
  /** Whether the shot was made */
  made: boolean;
  /** Player name (for tooltip) */
  playerName?: string;
  /** Distance in feet */
  distance?: number;
  /** Shot type (e.g. "Layup", "3PT") */
  shotType?: string;
}

export type ColorByMode = 'result' | 'zone' | 'frequency';

export interface ShotChartProps {
  /** Array of shot data */
  shots: Shot[];
  /** How to colour the shots */
  colorBy?: ColorByMode;
  /** Enable hexbin heatmap overlay */
  showHeatmap?: boolean;
  /** Highlight a specific zone */
  filterZone?: ShotZone;
  /** Season label (informational) */
  season?: string;
  /** Additional CSS class names */
  className?: string;
}

// ── Constants ─────────────────────────────────────────────────────

// SVG viewBox matches BasketballCourt: 500 x 470
const VB_W = 500;
const VB_H = 470;
// Basket center in SVG space
const BX = 250;
const BY = 52.5;

// NBA coord system ranges (in tenths of feet)
const NBA_X_MIN = -250;
const NBA_X_MAX = 250;
const NBA_Y_MIN = -47.5;
const NBA_Y_MAX = 422.5;

// Shot dot sizing
const DOT_RADIUS = 4;
const HEXBIN_RADIUS = 16;

// ── Coordinate mapping ────────────────────────────────────────────

function nbaToSvg(nx: number, ny: number): { sx: number; sy: number } {
  // NBA x: -250..250 -> SVG x: 0..500 (basket at center = 250)
  const sx = BX + (nx / (NBA_X_MAX - NBA_X_MIN)) * VB_W;
  // NBA y: -47.5..422.5 -> SVG y: basket baseline..court top
  // Higher NBA y = farther from basket = larger SVG y
  const sy = BY + (ny / (NBA_Y_MAX - NBA_Y_MIN)) * VB_H;
  return { sx, sy };
}

// ── Zone classifier ───────────────────────────────────────────────

function classifyZone(nx: number, ny: number): ShotZone {
  const dist = Math.sqrt(nx * nx + ny * ny);
  if (dist <= 40) return 'Restricted Area';
  // Corner 3: behind 3-pt line lateral, but close to baseline
  const isCorner3Left = nx <= -220 && ny <= 92.5;
  const isCorner3Right = nx >= 220 && ny <= 92.5;
  if (isCorner3Left) return 'Left Corner 3';
  if (isCorner3Right) return 'Right Corner 3';
  if (dist >= 237.5) return 'Above the Break 3';
  // Paint: within key area (8 ft each side of basket, 19 ft deep)
  if (Math.abs(nx) <= 80 && ny <= 190) return 'In The Paint';
  return 'Mid-Range';
}

// ── Zone colours ──────────────────────────────────────────────────

const ZONE_COLORS: Record<ShotZone, string> = {
  'Restricted Area': '#EF4444',
  'In The Paint': '#F97316',
  'Mid-Range': '#F59E0B',
  'Left Corner 3': '#22C55E',
  'Right Corner 3': '#22C55E',
  'Above the Break 3': '#3B82F6',
  'Backcourt': '#86868B',
};

// ── Component ─────────────────────────────────────────────────────

export default function ShotChart({
  shots,
  colorBy = 'result',
  showHeatmap = false,
  filterZone,
  season,
  className,
}: ShotChartProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Map shots to SVG coordinates
  const mapped = useMemo(
    () =>
      shots.map((s) => {
        const { sx, sy } = nbaToSvg(s.x, s.y);
        const zone = classifyZone(s.x, s.y);
        return { ...s, sx, sy, zone };
      }),
    [shots],
  );

  // Filtered shots
  const filtered = useMemo(
    () => (filterZone ? mapped.filter((s) => s.zone === filterZone) : mapped),
    [mapped, filterZone],
  );

  // Zone aggregates for zone colouring mode
  const zoneStats = useMemo(() => {
    const acc: Record<string, { made: number; total: number }> = {};
    for (const s of mapped) {
      const entry = acc[s.zone] ?? { made: 0, total: 0 };
      entry.total += 1;
      if (s.made) entry.made += 1;
      acc[s.zone] = entry;
    }
    return acc;
  }, [mapped]);

  // Hexbin data
  const hexbinData = useMemo(() => {
    if (!showHeatmap) return [];
    const hex = d3Hexbin<(typeof filtered)[number]>()
      .x((d) => d.sx)
      .y((d) => d.sy)
      .radius(HEXBIN_RADIUS)
      .extent([
        [0, 0],
        [VB_W, VB_H],
      ]);
    return hex(filtered);
  }, [filtered, showHeatmap]);

  const maxBinLen = useMemo(
    () => Math.max(1, ...hexbinData.map((b) => b.length)),
    [hexbinData],
  );

  const hexOpacityScale = useMemo(
    () => d3Scale.scaleLinear().domain([0, maxBinLen]).range([0.1, 0.85]),
    [maxBinLen],
  );

  // Shot colour
  const shotColor = useCallback(
    (s: (typeof mapped)[number]) => {
      switch (colorBy) {
        case 'result':
          return s.made ? '#22C55E' : '#EF4444';
        case 'zone':
          return ZONE_COLORS[s.zone];
        case 'frequency':
          return '#FF6B35';
        default:
          return '#86868B';
      }
    },
    [colorBy],
  );

  const handlePointerEnter = useCallback(
    (idx: number, sx: number, sy: number) => {
      setHoveredIdx(idx);
      setTooltipPos({ x: sx, y: sy });
    },
    [],
  );

  const handlePointerLeave = useCallback(() => {
    setHoveredIdx(null);
  }, []);

  // Empty state
  if (shots.length === 0) {
    return (
      <div className={clsx('relative flex items-center justify-center', className)}>
        <BasketballCourt showZones />
        <p className="absolute text-sm text-[#86868B]">
          No shot data available
        </p>
      </div>
    );
  }

  const hoveredShot = hoveredIdx !== null ? filtered[hoveredIdx] : null;

  return (
    <div className={clsx('relative', className)}>
      {/* Season label */}
      {season && (
        <p className="absolute top-2 left-3 z-10 text-xs font-medium text-[#6E6E73]">
          {season}
        </p>
      )}

      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        preserveAspectRatio="xMidYMid meet"
        className="w-full h-auto"
      >
        {/* Court as background */}
        <BasketballCourtSVG showZones={colorBy === 'zone'} />

        {/* Hexbin heatmap */}
        {showHeatmap &&
          hexbinData.map((bin, i) => (
            <path
              key={i}
              d={hexagonPath(bin.x, bin.y, HEXBIN_RADIUS)}
              fill="#FF6B35"
              opacity={hexOpacityScale(bin.length)}
            />
          ))}

        {/* Shot dots */}
        <AnimatePresence>
          {filtered.map((s, i) => (
            <motion.circle
              key={`${s.x}-${s.y}-${i}`}
              cx={s.sx}
              cy={s.sy}
              r={hoveredIdx === i ? DOT_RADIUS * 1.8 : DOT_RADIUS}
              fill={shotColor(s)}
              fillOpacity={showHeatmap ? 0.5 : 0.85}
              stroke={hoveredIdx === i ? '#1D1D1F' : 'none'}
              strokeWidth={hoveredIdx === i ? 1 : 0}
              initial={{ r: 0, opacity: 0 }}
              animate={{
                r: hoveredIdx === i ? DOT_RADIUS * 1.8 : DOT_RADIUS,
                opacity: 1,
              }}
              exit={{ r: 0, opacity: 0 }}
              transition={{
                ...animation.spring.gentle,
                delay: Math.min(i * 0.008, 1.5),
              }}
              onPointerEnter={() => handlePointerEnter(i, s.sx, s.sy)}
              onPointerLeave={handlePointerLeave}
              style={{ cursor: 'pointer' }}
            />
          ))}
        </AnimatePresence>

        {/* Zone FG% labels */}
        {colorBy === 'zone' &&
          !showHeatmap &&
          Object.entries(zoneStats).map(([zone, stat]) => {
            const label = `${((stat.made / stat.total) * 100).toFixed(1)}%`;
            const center = zoneLabelPosition(zone as ShotZone);
            return (
              <text
                key={zone}
                x={center.x}
                y={center.y}
                textAnchor="middle"
                dominantBaseline="central"
                fill="#1D1D1F"
                fontSize={12}
                fontWeight={600}
              >
                {label}
              </text>
            );
          })}
      </svg>

      {/* Tooltip */}
      {hoveredShot && (
        <div
          className="pointer-events-none absolute z-20 rounded-lg px-3 py-2 text-xs"
          style={{
            left: `${(tooltipPos.x / VB_W) * 100}%`,
            top: `${(tooltipPos.y / VB_H) * 100}%`,
            transform: 'translate(-50%, -120%)',
            background: '#FFFFFF',
            border: '1px solid rgba(0,0,0,0.12)',
            color: '#1D1D1F',
            boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
          }}
        >
          {hoveredShot.playerName && (
            <p className="font-semibold">{hoveredShot.playerName}</p>
          )}
          <p>
            {hoveredShot.made ? 'Made' : 'Missed'}
            {hoveredShot.shotType ? ` - ${hoveredShot.shotType}` : ''}
          </p>
          {hoveredShot.distance != null && <p>{hoveredShot.distance} ft</p>}
          <p className="opacity-60">{hoveredShot.zone}</p>
        </div>
      )}
    </div>
  );
}

// ── Internal helpers ──────────────────────────────────────────────

/** Re-render the court lines inline (avoids nested SVG elements). */
function BasketballCourtSVG({
  showZones,
}: {
  showZones: boolean;
}) {
  // We delegate to the court component via a foreignObject-free approach:
  // just render the BasketballCourt as a nested <g>. The simplest way in React
  // is to simply render the court SVG as a nested <svg>.
  return (
    <foreignObject x={0} y={0} width={VB_W} height={VB_H}>
      <BasketballCourt
        width={VB_W}
        height={VB_H}
        showZones={showZones}
      />
    </foreignObject>
  );
}

/** Build a hexagon path centred at (cx, cy). */
function hexagonPath(cx: number, cy: number, radius: number): string {
  const angles = [0, 60, 120, 180, 240, 300];
  const pts = angles.map((a) => {
    const rad = (a * Math.PI) / 180;
    return `${cx + radius * Math.cos(rad)},${cy + radius * Math.sin(rad)}`;
  });
  return `M ${pts.join(' L ')} Z`;
}

/** Approximate label positions for zone FG% overlay. */
function zoneLabelPosition(zone: ShotZone): { x: number; y: number } {
  switch (zone) {
    case 'Restricted Area':
      return { x: 250, y: 78 };
    case 'In The Paint':
      return { x: 250, y: 140 };
    case 'Mid-Range':
      return { x: 250, y: 220 };
    case 'Left Corner 3':
      return { x: 25, y: 60 };
    case 'Right Corner 3':
      return { x: 475, y: 60 };
    case 'Above the Break 3':
      return { x: 250, y: 330 };
    case 'Backcourt':
      return { x: 250, y: 455 };
    default:
      return { x: 250, y: 235 };
  }
}
