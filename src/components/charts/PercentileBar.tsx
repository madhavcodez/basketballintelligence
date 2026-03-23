'use client';

import { motion } from 'framer-motion';
import clsx from 'clsx';
import { colors, animation } from '@/lib/design-tokens';

// ── Types ─────────────────────────────────────────────────────────

export interface PercentileBarProps {
  /** The raw stat value */
  value: number;
  /** Percentile rank (0-100) */
  percentile: number;
  /** Stat label (e.g. "PTS/G") */
  label: string;
  /** Optional league average value (shown as a marker) */
  leagueAvg?: number;
  /** Additional CSS class names */
  className?: string;
}

// ── Colour by percentile ──────────────────────────────────────────

function percentileColor(pct: number): string {
  if (pct < 25) return colors.accentRed;
  if (pct < 50) return colors.accentGold;
  if (pct < 75) return colors.accentGreen;
  return colors.accentBlue;
}

// ── Constants ─────────────────────────────────────────────────────

const BAR_HEIGHT = 10;
const TRACK_HEIGHT = 10;

// ── Component ─────────────────────────────────────────────────────

export default function PercentileBar({
  value,
  percentile,
  label,
  leagueAvg,
  className,
}: PercentileBarProps) {
  const clampedPct = Math.max(0, Math.min(100, percentile));
  const fillColor = percentileColor(clampedPct);

  // League avg position (use same percentile scale – assumes league avg maps
  // to ~50th percentile if no better info).  When both value and leagueAvg are
  // provided we place the marker proportionally.  A more accurate placement
  // would need the full distribution, so we approximate here.
  const leagueAvgPct = leagueAvg != null ? 50 : undefined;

  return (
    <div className={clsx('w-full', className)}>
      {/* Top row: label + value + percentile */}
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-xs font-medium" style={{ color: colors.chromeMedium }}>
          {label}
        </span>
        <span className="flex items-baseline gap-2">
          <span className="text-sm font-bold" style={{ color: colors.chromeLight }}>
            {typeof value === 'number' ? value.toLocaleString(undefined, { maximumFractionDigits: 1 }) : value}
          </span>
          <span
            className="text-xs font-semibold rounded px-1.5 py-0.5"
            style={{
              color: fillColor,
              background: `${fillColor}18`,
            }}
          >
            {Math.round(clampedPct)}th
          </span>
        </span>
      </div>

      {/* Bar track */}
      <div
        className="relative w-full overflow-hidden rounded-full"
        style={{
          height: TRACK_HEIGHT,
          background: colors.glassBg,
        }}
      >
        {/* Filled bar */}
        <motion.div
          className="absolute top-0 left-0 rounded-full"
          style={{
            height: BAR_HEIGHT,
            background: `linear-gradient(90deg, ${fillColor}90, ${fillColor})`,
          }}
          initial={{ width: '0%' }}
          animate={{ width: `${clampedPct}%` }}
          transition={animation.spring.gentle}
        />

        {/* Glass overlay on filled portion */}
        <motion.div
          className="absolute top-0 left-0 rounded-full"
          style={{
            height: BAR_HEIGHT / 2,
            background: 'rgba(255,255,255,0.12)',
          }}
          initial={{ width: '0%' }}
          animate={{ width: `${clampedPct}%` }}
          transition={animation.spring.gentle}
        />

        {/* League average marker */}
        {leagueAvg != null && leagueAvgPct != null && (
          <div
            className="absolute top-0"
            style={{
              left: `${leagueAvgPct}%`,
              width: 2,
              height: TRACK_HEIGHT,
              background: colors.chromeLight,
              borderRadius: 1,
              transform: 'translateX(-50%)',
            }}
            title={`League Avg: ${leagueAvg}`}
          />
        )}
      </div>

      {/* League average label */}
      {leagueAvg != null && (
        <div className="flex justify-center mt-0.5">
          <span className="text-[9px]" style={{ color: colors.chromeDim }}>
            Lg Avg: {leagueAvg.toLocaleString(undefined, { maximumFractionDigits: 1 })}
          </span>
        </div>
      )}
    </div>
  );
}
