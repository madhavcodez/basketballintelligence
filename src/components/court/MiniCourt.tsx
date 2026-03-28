'use client';

import { useMemo } from 'react';
import { type ZoneName } from '@/lib/shot-constants';
import {
  type ZoneAggregation,
  efficiencyColor,
  getZonePolygonPath,
  getZoneLabelPosition,
} from '@/lib/zone-engine';
import { colors } from '@/lib/design-tokens';

// ── Props ─────────────────────────────────────────────────────────────────────

interface MiniCourtProps {
  readonly zoneStats: readonly ZoneAggregation[];
  readonly leagueBaseline: Record<string, number>;
  readonly highlightZones?: ZoneName[];
  readonly className?: string;
}

// ── Court geometry constants (matching BasketballCourt.tsx) ────────────────────

const VB_W = 500;
const VB_H = 470;
const BX = 250;
const BY = 52.5;
const CORNER_3_X = 30;
const THREE_SIDE_Y = 140;
const THREE_RADIUS = 237.5;
const RESTRICTED_RADIUS = 40;
const KEY_W = 160;
const KEY_H = 190;
const KEY_LEFT = BX - KEY_W / 2;

// ── Simplified court line paths ───────────────────────────────────────────────

function buildThreePointArc(): string {
  const steps = 60;
  const startAngle = Math.PI - Math.acos((CORNER_3_X - BX) / THREE_RADIUS);
  const endAngle = Math.acos((CORNER_3_X - BX) / THREE_RADIUS);
  const points: string[] = [];

  for (let i = 0; i <= steps; i++) {
    const angle = startAngle + (endAngle - startAngle) * (i / steps);
    const px = BX + THREE_RADIUS * Math.cos(angle);
    const py = BY + THREE_RADIUS * Math.sin(angle);
    if (py <= VB_H) {
      points.push(`${px.toFixed(1)},${py.toFixed(1)}`);
    }
  }

  return points.join(' ');
}

function buildRestrictedArc(): string {
  const steps = 40;
  const points: string[] = [];

  for (let i = 0; i <= steps; i++) {
    const angle = Math.PI + (0 - Math.PI) * (i / steps);
    const px = BX + RESTRICTED_RADIUS * Math.cos(angle);
    const py = BY + RESTRICTED_RADIUS * Math.sin(angle);
    points.push(`${px.toFixed(1)},${py.toFixed(1)}`);
  }

  return points.join(' ');
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function MiniCourt({
  zoneStats,
  leagueBaseline,
  highlightZones = [],
  className,
}: MiniCourtProps) {
  const threePointArc = useMemo(() => buildThreePointArc(), []);
  const restrictedArc = useMemo(() => buildRestrictedArc(), []);

  // Sort zones by FG% descending to find top 2
  const topZones = useMemo(() => {
    const sorted = [...zoneStats]
      .filter((z) => z.attempts > 0)
      .sort((a, b) => b.fgPct - a.fgPct);
    return sorted.slice(0, 2);
  }, [zoneStats]);

  const topZoneNames = useMemo(
    () => new Set(topZones.map((z) => z.zone)),
    [topZones],
  );

  const highlightSet = useMemo(
    () => new Set(highlightZones),
    [highlightZones],
  );

  const lineColor = colors.chromeDim;
  const lineWidth = 0.5;

  return (
    <svg
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      preserveAspectRatio="xMidYMid meet"
      className={className}
      style={{ width: 120, height: 113 }}
      role="img"
      aria-label="Mini court heatmap"
    >
      {/* Zone fills */}
      {zoneStats.map((stat) => {
        if (stat.attempts === 0) return null;

        const path = getZonePolygonPath(stat.zone);
        const baseline = leagueBaseline[stat.zone] ?? 0.45;
        const fill = efficiencyColor(stat.fgPct, baseline);
        const isHighlighted = highlightSet.has(stat.zone);

        return (
          <path
            key={stat.zone}
            d={path}
            fill={fill}
            fillOpacity={isHighlighted ? 0.55 : 0.35}
            stroke="none"
          />
        );
      })}

      {/* Court boundary */}
      <rect
        x={0}
        y={0}
        width={VB_W}
        height={VB_H}
        fill="none"
        stroke={lineColor}
        strokeWidth={lineWidth * 2}
      />

      {/* Paint outline */}
      <rect
        x={KEY_LEFT}
        y={0}
        width={KEY_W}
        height={KEY_H}
        fill="none"
        stroke={lineColor}
        strokeWidth={lineWidth}
      />

      {/* 3-point arc */}
      <line
        x1={CORNER_3_X}
        y1={0}
        x2={CORNER_3_X}
        y2={THREE_SIDE_Y}
        stroke={lineColor}
        strokeWidth={lineWidth}
      />
      <polyline
        points={threePointArc}
        fill="none"
        stroke={lineColor}
        strokeWidth={lineWidth}
      />
      <line
        x1={VB_W - CORNER_3_X}
        y1={0}
        x2={VB_W - CORNER_3_X}
        y2={THREE_SIDE_Y}
        stroke={lineColor}
        strokeWidth={lineWidth}
      />

      {/* Restricted area */}
      <polyline
        points={restrictedArc}
        fill="none"
        stroke={lineColor}
        strokeWidth={lineWidth}
      />

      {/* Top 2 zone FG% labels */}
      {topZones.map((stat) => {
        const pos = getZoneLabelPosition(stat.zone);
        return (
          <text
            key={`label-${stat.zone}`}
            x={pos.x}
            y={pos.y}
            textAnchor="middle"
            dominantBaseline="central"
            fill={colors.chromeLight}
            fontSize={24}
            fontWeight={700}
            fontFamily="Inter, system-ui, sans-serif"
            style={{
              pointerEvents: 'none',
              userSelect: 'none',
            }}
          >
            {`${(stat.fgPct * 100).toFixed(0)}%`}
          </text>
        );
      })}
    </svg>
  );
}
