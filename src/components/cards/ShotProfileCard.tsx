'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import MiniCourt from '@/components/court/MiniCourt';
import Badge from '@/components/ui/Badge';
import { ZONES, LEAGUE_BASELINE, type ZoneName } from '@/lib/shot-constants';
import { type ZoneAggregation } from '@/lib/zone-engine';
import { colors } from '@/lib/design-tokens';

// ── Types ────────────────────────────────────────────────────────────────────

interface ShotProfileCardProps {
  readonly playerName: string;
  readonly season?: string;
  readonly size?: 'sm' | 'md';
  readonly showSignature?: boolean;
  readonly hoverable?: boolean;
  readonly onClick?: () => void;
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

// ── Component ────────────────────────────────────────────────────────────────

export default function ShotProfileCard({
  playerName,
  season,
  size = 'md',
  showSignature = true,
  hoverable = true,
  onClick,
}: ShotProfileCardProps) {
  const [data, setData] = useState<PlayerZoneResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const url = season
      ? `/api/zones/player/${encodeURIComponent(playerName)}?season=${encodeURIComponent(season)}`
      : `/api/zones/player/${encodeURIComponent(playerName)}`;

    fetch(url)
      .then((r) => r.json())
      .then((d) => { if (!cancelled && d.zones) setData(d); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [playerName, season]);

  const leagueBaseline = LEAGUE_BASELINE;

  const topZones = useMemo(() => {
    if (!data) return [];
    return [...data.zones]
      .sort((a, b) => b.attempts - a.attempts)
      .slice(0, 3);
  }, [data]);

  const tintColor = useMemo(() => {
    if (!data?.topZone) return colors.accentOrange;
    const fgPct = data.topZone.fgPct;
    if (fgPct >= 0.5) return colors.accentGreen;
    if (fgPct >= 0.4) return colors.accentOrange;
    return colors.accentBlue;
  }, [data]);

  const isSm = size === 'sm';

  return (
    <motion.div
      className={clsx(
        'relative overflow-hidden rounded-[20px]',
        'bg-white border border-black/[0.06]',
        hoverable && 'cursor-pointer transition-all duration-300 hover:border-black/[0.12] hover:shadow-[0_8px_40px_rgba(0,0,0,0.08)]',
        isSm ? 'p-3' : 'p-4',
      )}
      whileHover={hoverable ? { y: -2, transition: { type: 'spring', stiffness: 300, damping: 20 } } : undefined}
      onClick={onClick}
    >
      {/* Tint overlay */}
      <div
        className="pointer-events-none absolute inset-0 rounded-[20px] opacity-[0.06]"
        style={{
          background: `radial-gradient(ellipse at top left, ${tintColor}, transparent 70%)`,
        }}
      />

      <div className={clsx('relative z-10', isSm ? 'flex items-center gap-2' : 'flex items-start gap-3')}>
        {/* Mini court */}
        {loading ? (
          <div
            className={clsx(
              'rounded-xl bg-white animate-pulse shrink-0',
              isSm ? 'w-16 h-15' : 'w-[120px] h-[113px]',
            )}
          />
        ) : data ? (
          <div className="shrink-0">
            <MiniCourt
              zoneStats={data.zones}
              leagueBaseline={leagueBaseline}
              className={isSm ? 'w-16 h-auto' : 'w-[120px] h-auto'}
            />
          </div>
        ) : null}

        {/* Info */}
        <div className="flex-1 min-w-0">
          <Link
            href={`/zones/${encodeURIComponent(playerName)}`}
            className="block"
            onClick={(e) => { if (onClick) e.preventDefault(); }}
          >
            <h3 className={clsx(
              'font-bold text-[#1D1D1F] truncate font-display',
              isSm ? 'text-xs' : 'text-sm',
            )}>
              {playerName}
            </h3>
          </Link>

          {data && (
            <>
              <p className={clsx('text-[#86868B]', isSm ? 'text-[9px]' : 'text-[10px]')}>
                {data.season}
              </p>

              {showSignature && !isSm && (
                <Badge variant="accent" className="mt-1 text-[9px]">
                  {data.shotSignature}
                </Badge>
              )}

              {/* Top zone bars */}
              <div className={clsx('mt-2 space-y-1', isSm && 'hidden')}>
                {topZones.map((z) => {
                  const pct = z.fgPct * 100;
                  const avg = (leagueBaseline[z.zone] ?? 0.45) * 100;
                  const isHot = pct > avg + 2;
                  const isCold = pct < avg - 2;

                  return (
                    <div key={z.zone} className="flex items-center gap-2">
                      <span className="text-[9px] text-[#86868B] w-7 text-right shrink-0">
                        {ZONES[z.zone as ZoneName]?.shortLabel ?? ''}
                      </span>
                      <div className="flex-1 h-1.5 rounded-full bg-white overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${Math.min(100, pct)}%`,
                            background: isHot
                              ? colors.accentGreen
                              : isCold
                                ? colors.accentRed
                                : colors.accentGold,
                          }}
                        />
                      </div>
                      <span className={clsx(
                        'text-[10px] font-bold tabular-nums w-10 text-right',
                        isHot ? 'text-[#22C55E]' : isCold ? 'text-[#EF4444]' : 'text-[#6E6E73]',
                      )}>
                        {pct.toFixed(1)}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {loading && (
            <div className="space-y-1.5 mt-1">
              <div className="h-2.5 w-20 rounded bg-white animate-pulse" />
              <div className="h-2 w-16 rounded bg-white animate-pulse" />
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
