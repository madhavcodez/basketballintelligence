'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { colors } from '@/lib/design-tokens';

// ── Types ─────────────────────────────────────────────────────────

interface SeasonData {
  readonly season: string;
  readonly totalShots: number;
  readonly zones: Record<string, number>;
}

interface ApiResponse {
  readonly player: string;
  readonly seasons: readonly SeasonData[];
  readonly error?: string;
}

interface ChartDatum {
  readonly season: string;
  readonly RA_pct: number;
  readonly PT_pct: number;
  readonly MR_pct: number;
  readonly LC3_pct: number;
  readonly RC3_pct: number;
  readonly AB3_pct: number;
}

interface ZoneTrendChartProps {
  readonly playerName: string;
  readonly className?: string;
  readonly height?: number;
}

// ── Zone Config ───────────────────────────────────────────────────

const ZONE_CONFIG = [
  { key: 'RA_pct', label: 'Restricted Area', apiKey: 'Restricted Area', color: '#F87171' },
  { key: 'PT_pct', label: 'In The Paint', apiKey: 'In The Paint (Non-RA)', color: '#FF6B35' },
  { key: 'MR_pct', label: 'Mid-Range', apiKey: 'Mid-Range', color: '#FBBF24' },
  { key: 'LC3_pct', label: 'Left Corner 3', apiKey: 'Left Corner 3', color: '#34D399' },
  { key: 'RC3_pct', label: 'Right Corner 3', apiKey: 'Right Corner 3', color: '#22D3EE' },
  { key: 'AB3_pct', label: 'Above the Break 3', apiKey: 'Above the Break 3', color: '#4DA6FF' },
] as const;

// ── Custom Tooltip ────────────────────────────────────────────────

interface TooltipPayloadEntry {
  readonly name: string;
  readonly value: number;
  readonly color: string;
  readonly dataKey: string;
}

interface CustomTooltipProps {
  readonly active?: boolean;
  readonly payload?: readonly TooltipPayloadEntry[];
  readonly label?: string;
}

function ZoneTrendTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  return (
    <div
      style={{
        background: 'rgba(10,10,18,0.92)',
        border: '1px solid rgba(255,255,255,0.12)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderRadius: 12,
        padding: '12px 16px',
        minWidth: 180,
      }}
    >
      <p
        style={{
          color: colors.chromeLight,
          fontSize: 13,
          fontWeight: 600,
          marginBottom: 8,
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          paddingBottom: 6,
        }}
      >
        {label}
      </p>
      {[...payload].reverse().map((entry) => {
        const config = ZONE_CONFIG.find((z) => z.key === entry.dataKey);
        return (
          <div
            key={entry.dataKey}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 12,
              padding: '2px 0',
            }}
          >
            <span
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 12,
                color: colors.chromeMedium,
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  backgroundColor: entry.color,
                  display: 'inline-block',
                  flexShrink: 0,
                }}
              />
              {config?.label ?? entry.name}
            </span>
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: colors.chromeLight,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {entry.value.toFixed(1)}%
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Skeleton Loader ───────────────────────────────────────────────

function SkeletonLoader({ height }: { readonly height: number }) {
  return (
    <div
      style={{
        width: '100%',
        height,
        borderRadius: 12,
        background: `linear-gradient(90deg, ${colors.darkSurface} 25%, ${colors.darkElevated} 50%, ${colors.darkSurface} 75%)`,
        backgroundSize: '200% 100%',
        animation: 'shimmer 1.5s ease-in-out infinite',
      }}
    >
      <style>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────

export default function ZoneTrendChart({
  playerName,
  className,
  height = 280,
}: ZoneTrendChartProps) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchTrend() {
      setLoading(true);
      setError(null);

      try {
        const encoded = encodeURIComponent(playerName);
        const res = await fetch(`/api/zones/trend/${encoded}`);

        if (!res.ok) {
          const body = await res.json().catch(() => ({ error: 'Request failed' }));
          throw new Error(body.error ?? `HTTP ${res.status}`);
        }

        const json: ApiResponse = await res.json();

        if (!cancelled) {
          setData(json);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : 'Failed to load trend data';
          setError(message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchTrend();

    return () => {
      cancelled = true;
    };
  }, [playerName]);

  // Transform API data into Recharts format
  const chartData: readonly ChartDatum[] = useMemo(() => {
    if (!data?.seasons) return [];

    return data.seasons.map((s) => ({
      season: s.season,
      RA_pct: (s.zones['Restricted Area'] ?? 0) * 100,
      PT_pct: (s.zones['In The Paint (Non-RA)'] ?? 0) * 100,
      MR_pct: (s.zones['Mid-Range'] ?? 0) * 100,
      LC3_pct: (s.zones['Left Corner 3'] ?? 0) * 100,
      RC3_pct: (s.zones['Right Corner 3'] ?? 0) * 100,
      AB3_pct: (s.zones['Above the Break 3'] ?? 0) * 100,
    }));
  }, [data]);

  if (loading) {
    return (
      <div className={className}>
        <SkeletonLoader height={height} />
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={className}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height,
          color: colors.chromeDim,
          fontSize: 13,
        }}
      >
        {error}
      </div>
    );
  }

  if (chartData.length === 0) {
    return (
      <div
        className={className}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height,
          color: colors.chromeDim,
          fontSize: 13,
        }}
      >
        No trend data available
      </div>
    );
  }

  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart
          data={chartData as ChartDatum[]}
          margin={{ top: 8, right: 8, left: 0, bottom: 4 }}
        >
          <XAxis
            dataKey="season"
            tick={{ fill: colors.chromeDim, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis hide domain={[0, 100]} />
          <Tooltip
            content={<ZoneTrendTooltip />}
            cursor={false}
          />
          {ZONE_CONFIG.map((zone) => (
            <Area
              key={zone.key}
              type="monotone"
              dataKey={zone.key}
              stackId="zones"
              fill={zone.color}
              fillOpacity={0.7}
              stroke={lighten(zone.color, 0.2)}
              strokeWidth={1.5}
              name={zone.label}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Utilities ─────────────────────────────────────────────────────

/** Lighten a hex color by a factor (0-1). Returns a hex string. */
function lighten(hex: string, factor: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);

  const lr = Math.min(255, Math.round(r + (255 - r) * factor));
  const lg = Math.min(255, Math.round(g + (255 - g) * factor));
  const lb = Math.min(255, Math.round(b + (255 - b) * factor));

  return `#${lr.toString(16).padStart(2, '0')}${lg.toString(16).padStart(2, '0')}${lb.toString(16).padStart(2, '0')}`;
}
