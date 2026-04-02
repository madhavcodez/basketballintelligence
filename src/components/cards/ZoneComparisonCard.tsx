'use client';

import { useState, useEffect, useMemo } from 'react';
import clsx from 'clsx';
import MiniCourt from '@/components/court/MiniCourt';
import Badge from '@/components/ui/Badge';
import { ZONES, LEAGUE_BASELINE, type ZoneName } from '@/lib/shot-constants';
import { type ZoneAggregation } from '@/lib/zone-engine';
import { colors } from '@/lib/design-tokens';

// ── Types ────────────────────────────────────────────────────────────────────

interface ZoneComparisonCardProps {
  readonly player1: string;
  readonly player2: string;
  readonly season?: string;
  readonly className?: string;
}

interface CompareResponse {
  player1: {
    name: string;
    zones: ZoneAggregation[];
    signature: string;
  };
  player2: {
    name: string;
    zones: ZoneAggregation[];
    signature: string;
  };
  league: { zones: ZoneAggregation[] };
  comparison: Array<{
    zone: string;
    player1FgPct: number;
    player2FgPct: number;
    leagueFgPct: number;
    winner: 'p1' | 'p2' | 'tie';
  }>;
}


// ── Component ────────────────────────────────────────────────────────────────

export default function ZoneComparisonCard({
  player1,
  player2,
  season,
  className,
}: ZoneComparisonCardProps) {
  const [data, setData] = useState<CompareResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const seasonQ = season ? `&season=${encodeURIComponent(season)}` : '';
    const url = `/api/zones/compare?p1=${encodeURIComponent(player1)}&p2=${encodeURIComponent(player2)}${seasonQ}`;

    let cancelled = false;
    fetch(url)
      .then((r) => r.json())
      .then((d) => { if (!cancelled && d.comparison) setData(d); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [player1, player2, season]);

  const leagueBaseline = useMemo(() => {
    if (!data?.league?.zones) return LEAGUE_BASELINE;
    const map: Record<string, number> = {};
    for (const z of data.league.zones) {
      map[z.zone] = z.fgPct;
    }
    return { ...LEAGUE_BASELINE, ...map };
  }, [data]);

  if (loading) {
    return (
      <div className={clsx('rounded-[20px] bg-white border border-black/[0.06] p-4 animate-pulse', className)}>
        <div className="flex gap-4 justify-center">
          <div className="w-[120px] h-[113px] rounded-xl bg-[#F5F5F7]" />
          <div className="w-[120px] h-[113px] rounded-xl bg-[#F5F5F7]" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className={clsx('rounded-[20px] bg-white border border-black/[0.06] p-4', className)}>
        <p className="text-center text-[#86868B] text-xs">No comparison data</p>
      </div>
    );
  }

  return (
    <div className={clsx('rounded-[20px] bg-white border border-black/[0.06] p-5', className)}>
      {/* Header with mini courts */}
      <div className="flex items-start gap-4 mb-5">
        {/* Player 1 */}
        <div className="flex-1 text-center">
          <MiniCourt
            zoneStats={data.player1.zones}
            leagueBaseline={leagueBaseline}
            className="w-[120px] h-auto mx-auto mb-2"
          />
          <p className="text-sm font-bold text-[#1D1D1F] truncate">{data.player1.name}</p>
          <Badge variant="accent" className="text-[8px] mt-0.5">{data.player1.signature}</Badge>
        </div>

        <span className="text-[#86868B] font-bold text-lg mt-12">vs</span>

        {/* Player 2 */}
        <div className="flex-1 text-center">
          <MiniCourt
            zoneStats={data.player2.zones}
            leagueBaseline={leagueBaseline}
            className="w-[120px] h-auto mx-auto mb-2"
          />
          <p className="text-sm font-bold text-[#1D1D1F] truncate">{data.player2.name}</p>
          <Badge variant="accent" className="text-[8px] mt-0.5">{data.player2.signature}</Badge>
        </div>
      </div>

      {/* Zone-by-zone bars */}
      <div className="space-y-2.5">
        {data.comparison
          .filter((c) => c.zone !== 'Backcourt')
          .map((c) => {
            const maxPct = Math.max(c.player1FgPct, c.player2FgPct, 0.01);
            const p1Width = (c.player1FgPct / maxPct) * 100;
            const p2Width = (c.player2FgPct / maxPct) * 100;

            return (
              <div key={c.zone}>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[10px] text-[#86868B]">
                    {ZONES[c.zone as ZoneName]?.shortLabel ?? c.zone}
                  </span>
                  <div className="flex gap-3">
                    <span className={clsx(
                      'text-[10px] font-bold tabular-nums',
                      c.winner === 'p1' ? 'text-[#22C55E]' : 'text-[#6E6E73]',
                    )}>
                      {(c.player1FgPct * 100).toFixed(1)}%
                    </span>
                    <span className={clsx(
                      'text-[10px] font-bold tabular-nums',
                      c.winner === 'p2' ? 'text-[#22C55E]' : 'text-[#6E6E73]',
                    )}>
                      {(c.player2FgPct * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
                <div className="flex gap-1 h-1.5">
                  <div className="flex-1 rounded-full bg-[#F5F5F7] overflow-hidden flex justify-end">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${p1Width}%`,
                        background: c.winner === 'p1' ? colors.accentOrange : '#86868B',
                      }}
                    />
                  </div>
                  <div className="flex-1 rounded-full bg-[#F5F5F7] overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${p2Width}%`,
                        background: c.winner === 'p2' ? colors.accentBlue : '#86868B',
                      }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
}
