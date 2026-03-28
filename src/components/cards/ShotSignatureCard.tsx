'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import { Target, TrendingUp, TrendingDown } from 'lucide-react';
import { ZONES, type ZoneName } from '@/lib/shot-constants';
import { type ZoneAggregation, generateSignatureNarrative } from '@/lib/zone-engine';
import { colors, motionPresets } from '@/lib/design-tokens';

// ── Types ────────────────────────────────────────────────────────────────────

interface ShotSignatureCardProps {
  readonly playerName: string;
  readonly season?: string;
  readonly className?: string;
}

interface PlayerZoneResponse {
  player: string;
  season: string;
  totalShots: number;
  zones: ZoneAggregation[];
  topZone: { zone: string; fgPct: number } | null;
  coldestZone: { zone: string; fgPct: number } | null;
  shotSignature: string;
}

// ── Signature icon/color mapping ─────────────────────────────────────────────

function getSignatureStyle(sig: string): { color: string; icon: 'target' | 'flame' } {
  if (sig.includes('Sniper') || sig.includes('Corner')) return { color: colors.accentBlue, icon: 'target' };
  if (sig.includes('Paint') || sig.includes('Dominator')) return { color: colors.accentRed, icon: 'flame' };
  if (sig.includes('Mid-Range')) return { color: colors.accentGold, icon: 'target' };
  return { color: colors.accentOrange, icon: 'target' };
}

// ── Component ────────────────────────────────────────────────────────────────

export default function ShotSignatureCard({
  playerName,
  season,
  className,
}: ShotSignatureCardProps) {
  const [data, setData] = useState<PlayerZoneResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const url = season
      ? `/api/zones/player/${encodeURIComponent(playerName)}?season=${encodeURIComponent(season)}`
      : `/api/zones/player/${encodeURIComponent(playerName)}`;

    setLoading(true);
    fetch(url)
      .then((r) => r.json())
      .then((d) => { if (d.zones) setData(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [playerName, season]);

  const narrative = useMemo(() => {
    if (!data) return '';
    return generateSignatureNarrative(data.player, data.shotSignature, data.zones, data.totalShots);
  }, [data]);

  const sigStyle = useMemo(
    () => getSignatureStyle(data?.shotSignature ?? ''),
    [data?.shotSignature],
  );

  if (loading) {
    return (
      <div className={clsx('rounded-[20px] bg-white border border-black/[0.06] p-5 animate-pulse', className)}>
        <div className="h-5 w-32 rounded bg-[#F5F5F7] mb-3" />
        <div className="h-7 w-48 rounded bg-[#F5F5F7] mb-3" />
        <div className="space-y-2">
          <div className="h-3 w-full rounded bg-[#F5F5F7]" />
          <div className="h-3 w-3/4 rounded bg-[#F5F5F7]" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className={clsx('rounded-[20px] bg-white border border-black/[0.06] p-5', className)}>
        <p className="text-[#86868B] text-sm text-center">No data available</p>
      </div>
    );
  }

  return (
    <motion.div
      className={clsx(
        'relative overflow-hidden rounded-[20px]',
        'bg-white border border-black/[0.06]',
        'p-5',
        className,
      )}
      {...motionPresets.fadeInUp}
    >
      {/* Tint overlay */}
      <div
        className="pointer-events-none absolute inset-0 rounded-[20px] opacity-[0.08]"
        style={{
          background: `radial-gradient(ellipse at top left, ${sigStyle.color}, transparent 70%)`,
        }}
      />

      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-center gap-2 mb-3">
          <Target size={18} style={{ color: sigStyle.color }} />
          <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: sigStyle.color }}>
            Shot Signature
          </span>
        </div>

        {/* Signature title */}
        <h3 className="text-xl font-extrabold text-[#1D1D1F] font-display uppercase tracking-wide mb-3">
          &ldquo;{data.shotSignature}&rdquo;
        </h3>

        {/* Narrative */}
        <p className="text-sm text-[#6E6E73] leading-relaxed mb-5">
          {narrative}
        </p>

        {/* Stats row */}
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          {data.topZone && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-[#86868B] mb-0.5 flex items-center gap-1">
                <TrendingUp size={10} className="text-[#22C55E]" />
                Hottest Zone
              </p>
              <p className="text-sm font-bold text-[#22C55E]">
                {data.topZone.zone} ({(data.topZone.fgPct * 100).toFixed(1)}%)
              </p>
            </div>
          )}

          {data.coldestZone && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-[#86868B] mb-0.5 flex items-center gap-1">
                <TrendingDown size={10} className="text-[#0071E3]" />
                Coldest Zone
              </p>
              <p className="text-sm font-bold text-[#0071E3]">
                {data.coldestZone.zone} ({(data.coldestZone.fgPct * 100).toFixed(1)}%)
              </p>
            </div>
          )}

          <div>
            <p className="text-[10px] uppercase tracking-wider text-[#86868B] mb-0.5">
              Volume
            </p>
            <p className="text-sm font-bold text-[#1D1D1F] tabular-nums">
              {data.totalShots.toLocaleString()} attempts
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
