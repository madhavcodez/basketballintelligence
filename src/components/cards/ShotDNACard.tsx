'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import clsx from 'clsx';
import { colors } from '@/lib/design-tokens';
import { ZONES, ZONE_LIST, type ZoneName } from '@/lib/shot-constants';
import { type ZoneAggregation, efficiencyColor } from '@/lib/zone-engine';

// ── Types ────────────────────────────────────────────────────────────────────

interface ShotDNACardProps {
  readonly playerName: string;
  readonly season?: string;
  readonly className?: string;
  readonly compact?: boolean;
}

interface PlayerZoneResponse {
  readonly player: string;
  readonly season: string;
  readonly totalShots: number;
  readonly zones: readonly ZoneAggregation[];
  readonly topZone: { readonly zone: string; readonly fgPct: number } | null;
  readonly coldestZone: { readonly zone: string; readonly fgPct: number } | null;
  readonly shotSignature: string;
}

// ── League baseline FG% by zone ──────────────────────────────────────────────

const LEAGUE_BASELINE: Readonly<Record<ZoneName, number>> = {
  'Restricted Area': 0.63,
  'In The Paint (Non-RA)': 0.40,
  'Mid-Range': 0.41,
  'Left Corner 3': 0.39,
  'Right Corner 3': 0.39,
  'Above the Break 3': 0.36,
  'Backcourt': 0.05,
};

// ── Circle sizing helpers ────────────────────────────────────────────────────

function computeCircleSize(attPct: number, isCompact: boolean): number {
  if (isCompact) {
    return Math.round(8 + attPct * 50);
  }
  return Math.round(12 + attPct * 80);
}

function clampCircleSize(size: number, isCompact: boolean): number {
  if (isCompact) {
    return Math.max(8, Math.min(28, size));
  }
  return Math.max(12, Math.min(44, size));
}

// ── Summary text generation ──────────────────────────────────────────────────

function generateSummary(zones: readonly ZoneAggregation[]): string {
  if (zones.length === 0) return '';

  const sorted = [...zones].sort((a, b) => b.attPct - a.attPct);
  const dominant = sorted[0];
  const dominantLabel = ZONES[dominant.zone].label;
  const dominantPct = (dominant.attPct * 100).toFixed(0);
  const dominantFg = (dominant.fgPct * 100).toFixed(0);

  // Identify if player is 3pt heavy
  const threeZones = zones.filter(
    (z) => z.zone === 'Left Corner 3' || z.zone === 'Right Corner 3' || z.zone === 'Above the Break 3',
  );
  const threePct = threeZones.reduce((sum, z) => sum + z.attPct, 0);
  const threeAttempts = threeZones.reduce((sum, z) => sum + z.attempts, 0);
  const threeMakes = threeZones.reduce((sum, z) => sum + z.makes, 0);
  const threeFg = threeAttempts > 0 ? threeMakes / threeAttempts : 0;

  // Identify if player is paint heavy
  const paintZones = zones.filter(
    (z) => z.zone === 'Restricted Area' || z.zone === 'In The Paint (Non-RA)',
  );
  const paintPct = paintZones.reduce((sum, z) => sum + z.attPct, 0);
  const paintAttempts = paintZones.reduce((sum, z) => sum + z.attempts, 0);
  const paintMakes = paintZones.reduce((sum, z) => sum + z.makes, 0);
  const paintFg = paintAttempts > 0 ? paintMakes / paintAttempts : 0;

  if (paintPct > 0.40) {
    return `Paint-heavy scorer \u2014 ${(paintFg * 100).toFixed(0)}% at rim, ${(threeFg * 100).toFixed(0)}% from 3`;
  }

  if (threePct > 0.45) {
    return `${(threePct * 100).toFixed(0)}% from 3PT, ${(threeFg * 100).toFixed(0)}% 3FG \u2014 lethal range`;
  }

  return `${dominantLabel}-heavy \u2014 ${dominantFg}% FG on ${dominantPct}% of shots`;
}

// ── Signature badge color ────────────────────────────────────────────────────

function getBadgeColor(signature: string): string {
  if (signature.includes('Sniper') || signature.includes('Corner')) return colors.accentBlue;
  if (signature.includes('Paint') || signature.includes('Dominator')) return colors.accentRed;
  if (signature.includes('Mid-Range')) return colors.accentGold;
  if (signature.includes('Three-Level')) return colors.accentViolet;
  return colors.accentOrange;
}

// ── Loading skeleton ─────────────────────────────────────────────────────────

function LoadingSkeleton({ compact, className }: { readonly compact: boolean; readonly className?: string }) {
  return (
    <div
      className={clsx(
        'rounded-[20px] bg-white border border-black/[0.06]',
        compact ? 'p-3' : 'p-4',
        className,
      )}
    >
      <div className="flex items-center justify-center gap-2">
        {ZONE_LIST.map((zone) => (
          <div
            key={zone}
            className="rounded-full bg-[#F5F5F7] animate-pulse"
            style={{
              width: compact ? 14 : 20,
              height: compact ? 14 : 20,
            }}
          />
        ))}
      </div>
    </div>
  );
}

// ── DNA Circle ───────────────────────────────────────────────────────────────

interface DNACircleProps {
  readonly zone: ZoneAggregation;
  readonly isCompact: boolean;
  readonly index: number;
}

function DNACircle({ zone, isCompact, index }: DNACircleProps) {
  const [hovered, setHovered] = useState(false);

  const rawSize = computeCircleSize(zone.attPct, isCompact);
  const size = clampCircleSize(rawSize, isCompact);
  const baseline = LEAGUE_BASELINE[zone.zone];
  const color = efficiencyColor(zone.fgPct, baseline);
  const shortLabel = ZONES[zone.zone].shortLabel;

  return (
    <div className="relative flex flex-col items-center">
      <motion.div
        className="rounded-full cursor-default"
        style={{
          width: size,
          height: size,
          backgroundColor: color,
          boxShadow: `0 0 ${Math.round(size * 0.4)}px ${color}66`,
        }}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{
          type: 'spring',
          stiffness: 260,
          damping: 20,
          delay: index * 0.05,
        }}
        whileHover={{ scale: 1.2 }}
        onHoverStart={() => setHovered(true)}
        onHoverEnd={() => setHovered(false)}
      />

      {/* Hover tooltip */}
      {hovered && !isCompact && (
        <motion.div
          className="absolute -top-8 whitespace-nowrap rounded-md bg-white px-2 py-0.5 text-[10px] font-semibold text-[#1D1D1F] shadow-lg pointer-events-none z-20"
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.12 }}
        >
          {ZONES[zone.zone].label} {(zone.fgPct * 100).toFixed(1)}%
        </motion.div>
      )}

      {/* Short label below circle (standard mode only) */}
      {!isCompact && (
        <span className="mt-1 text-[9px] font-medium text-[#86868B] tracking-wide select-none">
          {shortLabel}
        </span>
      )}
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function ShotDNACard({
  playerName,
  season,
  className,
  compact = false,
}: ShotDNACardProps) {
  const [data, setData] = useState<PlayerZoneResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const url = season
      ? `/api/zones/player/${encodeURIComponent(playerName)}?season=${encodeURIComponent(season)}`
      : `/api/zones/player/${encodeURIComponent(playerName)}`;

    setLoading(true);
    setError(false);

    fetch(url)
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then((payload: unknown) => {
        const d = payload as PlayerZoneResponse;
        if (d.zones && d.zones.length > 0) {
          setData(d);
        } else {
          setError(true);
        }
      })
      .catch(() => {
        setError(true);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [playerName, season]);

  // Ensure all 7 zones are represented, filling missing ones with zero values
  const allZones = useMemo((): readonly ZoneAggregation[] => {
    if (!data) return [];

    const zoneMap = new Map(data.zones.map((z) => [z.zone, z]));

    return ZONE_LIST.map((zoneName): ZoneAggregation => {
      const existing = zoneMap.get(zoneName);
      if (existing) return existing;

      return {
        zone: zoneName,
        attempts: 0,
        makes: 0,
        fgPct: 0,
        attPct: 0,
        avgDistance: 0,
        pointValue: ZONES[zoneName].pointValue,
        ePtsPerAttempt: 0,
      };
    });
  }, [data]);

  const signature = useMemo(() => {
    if (!data) return '';
    return data.shotSignature;
  }, [data]);

  const summary = useMemo(() => {
    if (!data) return '';
    return generateSummary(data.zones);
  }, [data]);

  const badgeColor = useMemo(() => getBadgeColor(signature), [signature]);

  // ── Loading state ────────────────────────────────────────────────────────

  if (loading) {
    return <LoadingSkeleton compact={compact} className={className} />;
  }

  // ── Error / empty state ──────────────────────────────────────────────────

  if (error || !data) {
    return (
      <div
        className={clsx(
          'rounded-[20px] bg-white border border-black/[0.06]',
          compact ? 'p-3' : 'p-4',
          className,
        )}
      >
        <p className="text-[#86868B] text-xs text-center">No shot data available</p>
      </div>
    );
  }

  // ── Compact mode ─────────────────────────────────────────────────────────

  if (compact) {
    return (
      <motion.div
        className={clsx(
          'rounded-[20px] bg-white border border-black/[0.06] p-3',
          className,
        )}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 120, damping: 14 }}
      >
        <div className="flex items-center gap-1.5 justify-center">
          {allZones.map((zone, i) => (
            <DNACircle key={zone.zone} zone={zone} isCompact index={i} />
          ))}
        </div>
      </motion.div>
    );
  }

  // ── Standard mode ────────────────────────────────────────────────────────

  return (
    <motion.div
      className={clsx(
        'relative overflow-hidden rounded-[20px]',
        'bg-white border border-black/[0.06]',
        'p-4',
        className,
      )}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 120, damping: 14 }}
    >
      {/* Subtle tint overlay */}
      <div
        className="pointer-events-none absolute inset-0 rounded-[20px] opacity-[0.06]"
        style={{
          background: `radial-gradient(ellipse at top left, ${badgeColor}, transparent 70%)`,
        }}
      />

      <div className="relative z-10">
        {/* Header: player name + signature badge */}
        <div className="flex items-center justify-between mb-4">
          <Link
            href={`/zones/${encodeURIComponent(playerName)}`}
            className="text-sm font-bold text-[#1D1D1F] font-display truncate hover:text-[#1D1D1F] transition-colors"
          >
            {playerName}
          </Link>

          <span
            className="shrink-0 ml-2 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full"
            style={{
              color: badgeColor,
              backgroundColor: `${badgeColor}1A`,
              border: `1px solid ${badgeColor}33`,
            }}
          >
            {signature}
          </span>
        </div>

        {/* DNA circles row */}
        <div className="flex items-end gap-2 justify-center mb-4">
          {allZones.map((zone, i) => (
            <DNACircle key={zone.zone} zone={zone} isCompact={false} index={i} />
          ))}
        </div>

        {/* Summary text */}
        <p className="text-xs text-[#6E6E73] text-center leading-relaxed truncate">
          {summary}
        </p>
      </div>
    </motion.div>
  );
}
