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

interface ZoneOverlayProps {
  readonly zoneStats: readonly ZoneAggregation[];
  readonly leagueBaseline: Record<string, number>;
  readonly highlightZone?: ZoneName | null;
  readonly showLabels?: boolean;
  readonly onZoneClick?: (zone: ZoneName) => void;
  readonly onZoneHover?: (zone: ZoneName | null) => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatPct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ZoneOverlay({
  zoneStats,
  leagueBaseline,
  highlightZone = null,
  showLabels = true,
  onZoneClick,
  onZoneHover,
}: ZoneOverlayProps) {
  const zones = useMemo(() => {
    return zoneStats.map((stat) => {
      const path = getZonePolygonPath(stat.zone);
      const labelPos = getZoneLabelPosition(stat.zone);
      const baseline = leagueBaseline[stat.zone] ?? 0.45;
      const fill = efficiencyColor(stat.fgPct, baseline);
      const isHighlighted = highlightZone === stat.zone;

      return {
        ...stat,
        path,
        labelPos,
        fill,
        isHighlighted,
      };
    });
  }, [zoneStats, leagueBaseline, highlightZone]);

  return (
    <g aria-label="Zone overlay">
      {/* Glow filter for highlighted zones */}
      <defs>
        <filter id="zone-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {zones.map((zone) => {
        const isActive = zone.isHighlighted;

        return (
          <g key={zone.zone}>
            {/* Zone fill path */}
            <path
              d={zone.path}
              fill={zone.fill}
              fillOpacity={isActive ? 0.6 : 0.4}
              stroke="rgba(0,0,0,0.06)"
              strokeWidth={isActive ? 1.5 : 0.75}
              strokeOpacity={isActive ? 0.2 : 0.08}
              cursor="pointer"
              filter={isActive ? 'url(#zone-glow)' : undefined}
              style={{
                transition: 'fill-opacity 200ms ease, stroke-opacity 200ms ease',
              }}
              onPointerEnter={() => onZoneHover?.(zone.zone)}
              onPointerLeave={() => onZoneHover?.(null)}
              onClick={() => onZoneClick?.(zone.zone)}
            >
              <title>{`${zone.zone}: ${formatPct(zone.fgPct)}`}</title>
            </path>

            {/* FG% label */}
            {showLabels && zone.attempts > 0 && (
              <text
                x={zone.labelPos.x}
                y={zone.labelPos.y}
                textAnchor="middle"
                dominantBaseline="central"
                fill={colors.chromeLight}
                fontSize={11}
                fontWeight={600}
                fontFamily="Inter, system-ui, sans-serif"
                style={{
                  pointerEvents: 'none',
                  textShadow: '0 1px 3px rgba(0,0,0,0.8)',
                  userSelect: 'none',
                }}
              >
                {formatPct(zone.fgPct)}
              </text>
            )}
          </g>
        );
      })}
    </g>
  );
}
