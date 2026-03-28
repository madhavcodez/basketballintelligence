'use client';

import { colors } from '@/lib/design-tokens';
import { ZONES, type ZoneName } from '@/lib/shot-constants';
import { type ZoneAggregation } from '@/lib/zone-engine';

// ── Props ─────────────────────────────────────────────────────────────────────

interface ZoneTooltipProps {
  readonly zone: ZoneName;
  readonly stats: ZoneAggregation;
  readonly leagueAvg: number;
  readonly position: { x: number; y: number }; // percentage position (0-100)
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatPct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function formatDiff(playerPct: number, leaguePct: number): {
  text: string;
  color: string;
} {
  const diff = (playerPct - leaguePct) * 100;
  const sign = diff >= 0 ? '+' : '';
  const text = `${sign}${diff.toFixed(1)}%`;
  const color = diff >= 0 ? colors.accentGreen : colors.accentRed;
  return { text, color };
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ZoneTooltip({
  zone,
  stats,
  leagueAvg,
  position,
}: ZoneTooltipProps) {
  const diff = formatDiff(stats.fgPct, leagueAvg);
  const zoneDef = ZONES[zone];

  // Clamp position to keep tooltip visible within bounds
  const clampedX = Math.max(5, Math.min(70, position.x));
  const clampedY = Math.max(5, Math.min(75, position.y));

  return (
    <div
      className="absolute pointer-events-none"
      style={{
        left: `${clampedX}%`,
        top: `${clampedY}%`,
        zIndex: 50,
        transform: 'translate(-50%, -100%) translateY(-8px)',
        animation: 'tooltipScaleIn 150ms ease-out',
      }}
    >
      <div
        style={{
          background: 'rgba(10, 10, 18, 0.92)',
          border: `1px solid ${colors.glassBorder}`,
          backdropFilter: 'blur(20px)',
          borderRadius: 12,
          padding: '10px 14px',
          minWidth: 180,
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        }}
      >
        {/* Zone name */}
        <div
          style={{
            color: colors.chromeLight,
            fontSize: 13,
            fontWeight: 700,
            marginBottom: 8,
            letterSpacing: '-0.01em',
          }}
        >
          {zoneDef.label}
        </div>

        {/* Stats grid */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {/* FG% with diff */}
          <StatRow label="FG%">
            <span style={{ color: colors.chromeLight, fontWeight: 600 }}>
              {formatPct(stats.fgPct)}
            </span>
            {' '}
            <span style={{ color: diff.color, fontSize: 11, fontWeight: 500 }}>
              ({diff.text})
            </span>
          </StatRow>

          {/* Attempts */}
          <StatRow label="Attempts">
            <span style={{ color: colors.chromeLight }}>
              {stats.attempts}
            </span>
            {' '}
            <span style={{ color: colors.chromeDim, fontSize: 11 }}>
              ({formatPct(stats.attPct)})
            </span>
          </StatRow>

          {/* Makes */}
          <StatRow label="Makes">
            <span style={{ color: colors.chromeLight }}>
              {stats.makes}
            </span>
          </StatRow>

          {/* Avg Distance */}
          <StatRow label="Avg Distance">
            <span style={{ color: colors.chromeLight }}>
              {stats.avgDistance.toFixed(1)} ft
            </span>
          </StatRow>

          {/* ePts/Att */}
          <StatRow label="ePts/Att">
            <span style={{ color: colors.chromeLight }}>
              {stats.ePtsPerAttempt.toFixed(3)}
            </span>
          </StatRow>
        </div>
      </div>

      {/* Inline keyframes for scale-in animation */}
      <style>{`
        @keyframes tooltipScaleIn {
          from {
            opacity: 0;
            transform: translate(-50%, -100%) translateY(-8px) scale(0.92);
          }
          to {
            opacity: 1;
            transform: translate(-50%, -100%) translateY(-8px) scale(1);
          }
        }
      `}</style>
    </div>
  );
}

// ── Stat Row ──────────────────────────────────────────────────────────────────

function StatRow({
  label,
  children,
}: {
  readonly label: string;
  readonly children: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontSize: 12,
        lineHeight: '18px',
      }}
    >
      <span style={{ color: colors.chromeDim, fontWeight: 500 }}>
        {label}
      </span>
      <span>{children}</span>
    </div>
  );
}
