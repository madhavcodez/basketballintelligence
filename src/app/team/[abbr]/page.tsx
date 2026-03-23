'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  Shield,
  Users,
  BarChart3,
  ArrowUpDown,
  GitCompareArrows,
  ChevronUp,
  ChevronDown,
  ExternalLink,
  Crosshair,
} from 'lucide-react';
import clsx from 'clsx';
import GlassCard from '@/components/ui/GlassCard';
import SectionHeader from '@/components/ui/SectionHeader';
import MetricChip from '@/components/ui/MetricChip';
import SkeletonLoader from '@/components/ui/SkeletonLoader';
import Badge from '@/components/ui/Badge';

// ── Types ────────────────────────────────────────────────────────────────────

interface TeamSeason {
  readonly seasonId: string;
  readonly teamName: string;
  readonly games: number;
  readonly wins: number;
  readonly losses: number;
  readonly ppg: number;
  readonly rpg: number;
  readonly apg: number;
  readonly spg: number;
  readonly bpg: number;
  readonly fgPct: number;
  readonly fg3Pct: number;
  readonly ftPct: number;
}

interface RosterPlayer {
  readonly name: string;
  readonly position: string;
  readonly age: number;
  readonly games: number;
  readonly gamesStarted: number;
  readonly minutes: number;
  readonly points: number;
  readonly rebounds: number;
  readonly assists: number;
  readonly steals: number;
  readonly blocks: number;
  readonly fgPct: number;
  readonly fg3Pct: number;
  readonly ftPct: number;
}

interface Lineup {
  readonly players: string;
  readonly gp: number;
  readonly wins: number;
  readonly losses: number;
  readonly minutes: number;
  readonly points: number;
  readonly assists: number;
  readonly rebounds: number;
  readonly steals: number;
  readonly blocks: number;
  readonly turnovers: number;
  readonly fgPct: number;
  readonly fg3Pct: number;
  readonly ftPct: number;
  readonly plusMinus: number;
  readonly season: string;
}

interface TeamAdvanced {
  readonly season: string;
  readonly teamName: string;
  readonly gp: number;
  readonly wins: number;
  readonly losses: number;
  readonly offRating: number;
  readonly defRating: number;
  readonly netRating: number;
  readonly pace: number;
  readonly tsPct: number;
  readonly efgPct: number;
  readonly astPct: number;
  readonly orebPct: number;
  readonly drebPct: number;
  readonly tovPct: number;
  readonly pie: number;
}

interface ShotZone {
  readonly zone: string;
  readonly area: string;
  readonly attempts: number;
  readonly makes: number;
  readonly fgPct: number;
  readonly avgDistance: number;
}

interface TeamData {
  readonly stats: readonly TeamSeason[];
  readonly roster: readonly RosterPlayer[];
  readonly lineups: readonly Lineup[];
  readonly advanced: readonly TeamAdvanced[];
}

type SortField = 'name' | 'position' | 'age' | 'points' | 'rebounds' | 'assists' | 'fgPct';
type SortDir = 'asc' | 'desc';

// ── Animation Variants ───────────────────────────────────────────────────────

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring' as const, stiffness: 120, damping: 14 },
  },
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatPct(val: number | null | undefined): string {
  if (val == null || isNaN(val)) return '--';
  return val < 1 ? (val * 100).toFixed(1) : val.toFixed(1);
}

function formatNum(val: number | null | undefined): string {
  if (val == null || isNaN(val)) return '--';
  return String(val);
}

// ── Rating Bar (inline SVG) ──────────────────────────────────────────────────

function RatingBar({
  label,
  value,
  leagueAvg,
  color,
  min,
  max,
}: {
  readonly label: string;
  readonly value: number;
  readonly leagueAvg: number;
  readonly color: string;
  readonly min: number;
  readonly max: number;
}) {
  const range = max - min;
  const valuePct = Math.max(0, Math.min(100, ((value - min) / range) * 100));
  const avgPct = Math.max(0, Math.min(100, ((leagueAvg - min) / range) * 100));
  const isAbove = value >= leagueAvg;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-chrome-medium">{label}</span>
        <span className={clsx('text-sm font-bold font-display', isAbove ? 'text-accent-green' : 'text-accent-red')}>
          {value.toFixed(1)}
        </span>
      </div>
      <svg viewBox="0 0 300 16" className="w-full h-4" role="img" aria-label={`${label}: ${value}`}>
        {/* Background track */}
        <rect x="0" y="4" width="300" height="8" rx="4" fill="rgba(255,255,255,0.06)" />
        {/* Value bar */}
        <motion.rect
          x="0"
          y="4"
          height="8"
          rx="4"
          fill={color}
          fillOpacity={0.8}
          initial={{ width: 0 }}
          animate={{ width: (valuePct / 100) * 300 }}
          transition={{ type: 'spring', stiffness: 120, damping: 14, delay: 0.2 }}
        />
        {/* League average marker */}
        <line
          x1={(avgPct / 100) * 300}
          y1="1"
          x2={(avgPct / 100) * 300}
          y2="15"
          stroke="rgba(255,255,255,0.5)"
          strokeWidth="1.5"
          strokeDasharray="2 2"
        />
        <text
          x={(avgPct / 100) * 300}
          y="15"
          textAnchor="middle"
          fill="rgba(255,255,255,0.4)"
          fontSize="6"
          dy="6"
        >
          AVG
        </text>
      </svg>
    </div>
  );
}

// ── Season Trend Line (inline SVG) ──────────────────────────────────────────

function SeasonTrendLine({ data }: { readonly data: readonly { season: string; wins: number }[] }) {
  if (data.length < 2) return null;

  const width = 500;
  const height = 160;
  const padding = { top: 20, right: 40, bottom: 30, left: 40 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const maxWins = Math.max(...data.map((d) => d.wins));
  const minWins = Math.min(...data.map((d) => d.wins));
  const yRange = Math.max(maxWins - minWins, 10);

  const points = data.map((d, i) => {
    const x = padding.left + (i / (data.length - 1)) * chartW;
    const y = padding.top + chartH - ((d.wins - minWins) / yRange) * chartH;
    return { x, y, ...d };
  });

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaD = `${pathD} L ${points[points.length - 1].x} ${padding.top + chartH} L ${points[0].x} ${padding.top + chartH} Z`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" role="img" aria-label="Season wins trend">
      <defs>
        <linearGradient id="trend-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FF6B35" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#FF6B35" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Area fill */}
      <motion.path
        d={areaD}
        fill="url(#trend-grad)"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.6 }}
      />
      {/* Line */}
      <motion.path
        d={pathD}
        fill="none"
        stroke="#FF6B35"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1.2, ease: 'easeInOut' }}
      />
      {/* Data points */}
      {points.map((p) => (
        <motion.circle
          key={p.season}
          cx={p.x}
          cy={p.y}
          r="4"
          fill="#0a0a12"
          stroke="#FF6B35"
          strokeWidth="2"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.8, type: 'spring', stiffness: 300 }}
        />
      ))}
      {/* Labels */}
      {points.map((p) => (
        <g key={`label-${p.season}`}>
          <text
            x={p.x}
            y={padding.top + chartH + 16}
            textAnchor="middle"
            fill="rgba(255,255,255,0.44)"
            fontSize="8"
          >
            {p.season.replace(/-.+/, '')}
          </text>
          <text
            x={p.x}
            y={p.y - 10}
            textAnchor="middle"
            fill="rgba(255,255,255,0.7)"
            fontSize="8"
            fontWeight="600"
          >
            {p.wins}W
          </text>
        </g>
      ))}
    </svg>
  );
}

// ── Sort Icon ────────────────────────────────────────────────────────────────

function SortIcon({ field, sortField, sortDir }: { readonly field: SortField; readonly sortField: SortField; readonly sortDir: SortDir }) {
  if (field !== sortField) return <ArrowUpDown size={12} className="text-chrome-dim" />;
  return sortDir === 'asc' ? (
    <ChevronUp size={12} className="text-accent-orange" />
  ) : (
    <ChevronDown size={12} className="text-accent-orange" />
  );
}

// ── Loading Skeleton ─────────────────────────────────────────────────────────

function TeamSkeleton() {
  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col gap-3">
        <SkeletonLoader width="60%" height={40} rounded="lg" />
        <SkeletonLoader width="30%" height={20} rounded="md" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <SkeletonLoader key={i} height={80} rounded="xl" />
        ))}
      </div>
      <SkeletonLoader height={200} rounded="xl" />
      <SkeletonLoader height={300} rounded="xl" />
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function TeamDNAPage() {
  const params = useParams();
  const abbr = (params?.abbr as string)?.toUpperCase() ?? '';

  const [data, setData] = useState<TeamData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSeasonIdx, setSelectedSeasonIdx] = useState(0);
  const [sortField, setSortField] = useState<SortField>('points');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [shotZones, setShotZones] = useState<readonly ShotZone[] | null>(null);

  // Fetch team data
  useEffect(() => {
    if (!abbr) return;
    let cancelled = false;

    async function fetchTeam() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/teams/${encodeURIComponent(abbr)}`);
        if (!res.ok) throw new Error(`Failed to load team data (${res.status})`);
        const json: TeamData = await res.json();
        if (!cancelled) {
          setData(json);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'An unexpected error occurred');
          setLoading(false);
        }
      }
    }

    fetchTeam();
    return () => { cancelled = true; };
  }, [abbr]);

  // Current season derived data
  const currentSeason = data?.stats?.[selectedSeasonIdx] ?? null;
  const teamName = currentSeason?.teamName ?? abbr;
  const advancedForSeason = data?.advanced?.[selectedSeasonIdx] ?? null;

  // Season selector options
  const seasonOptions = useMemo(
    () => (data?.stats ?? []).map((s) => s.seasonId),
    [data?.stats],
  );

  // Sorted roster
  const sortedRoster = useMemo(() => {
    const roster = [...(data?.roster ?? [])];
    const dir = sortDir === 'asc' ? 1 : -1;
    roster.sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return dir * aVal.localeCompare(bVal);
      }
      return dir * (Number(aVal) - Number(bVal));
    });
    return roster;
  }, [data?.roster, sortField, sortDir]);

  const topScorer = useMemo(() => {
    if (!data?.roster?.length) return null;
    return [...data.roster].sort((a, b) => Number(b.points) - Number(a.points))[0];
  }, [data?.roster]);

  // Fetch shot zones for top scorer once we have the team data
  useEffect(() => {
    if (!topScorer?.name) return;
    let cancelled = false;
    fetch(`/api/players/${encodeURIComponent(topScorer.name)}/shots`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (!cancelled && json?.zones) {
          setShotZones(json.zones);
        }
      })
      .catch(() => { /* silently ignore */ });
    return () => { cancelled = true; };
  }, [topScorer?.name]);

  // Top lineups (top 5 by minutes)
  const topLineups = useMemo(() => {
    return (data?.lineups ?? []).slice(0, 5);
  }, [data?.lineups]);

  // Wins trend data
  const winsTrend = useMemo(() => {
    return (data?.stats ?? [])
      .map((s) => ({ season: s.seasonId, wins: s.wins }))
      .reverse()
      .slice(-8);
  }, [data?.stats]);

  // Sort handler
  const handleSort = useCallback((field: SortField) => {
    setSortField((prev) => {
      if (prev === field) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        return field;
      }
      setSortDir('desc');
      return field;
    });
  }, []);

  // League average placeholders (approximate NBA averages)
  const leagueAvg = { offRating: 112, defRating: 112, netRating: 0, pace: 100 };

  if (loading) return <TeamSkeleton />;

  if (error) {
    return (
      <div className="px-4 sm:px-6 lg:px-8 py-12 max-w-6xl mx-auto">
        <GlassCard className="p-8">
          <div className="flex flex-col items-center text-center gap-4">
            <Shield size={40} className="text-accent-red" />
            <h2 className="text-xl font-bold text-chrome-light font-display">Error Loading Team</h2>
            <p className="text-sm text-chrome-dim">{error}</p>
          </div>
        </GlassCard>
      </div>
    );
  }

  if (!data || !currentSeason) {
    return (
      <div className="px-4 sm:px-6 lg:px-8 py-12 max-w-6xl mx-auto">
        <GlassCard className="p-8">
          <div className="flex flex-col items-center text-center gap-4">
            <Shield size={40} className="text-chrome-dim" />
            <h2 className="text-xl font-bold text-chrome-light font-display">Team Not Found</h2>
            <p className="text-sm text-chrome-dim">No data found for team &quot;{abbr}&quot;</p>
          </div>
        </GlassCard>
      </div>
    );
  }

  return (
    <motion.div
      className="px-4 sm:px-6 lg:px-8 py-6 max-w-6xl mx-auto space-y-8"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* ── Team Hero ─────────────────────────────────────────────────────── */}
      <motion.div variants={itemVariants}>
        <GlassCard className="p-6 sm:p-8 shadow-[0_0_40px_rgba(255,107,53,0.06)]" tintColor="#FF6B35">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex items-center justify-center h-16 w-16 sm:h-20 sm:w-20 rounded-2xl bg-accent-orange/[0.12] border border-accent-orange/20">
              <Shield size={32} className="text-accent-orange" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-3xl sm:text-5xl font-extrabold tracking-[-0.02em] text-chrome-light font-display">
                  {teamName}
                </h1>
                <Badge variant="accent">{abbr}</Badge>
              </div>
              <p className="mt-1 text-sm text-chrome-medium">
                {currentSeason.wins}W - {currentSeason.losses}L
                <span className="text-chrome-dim ml-2">
                  ({currentSeason.games} games)
                </span>
              </p>
            </div>
          </div>
        </GlassCard>
      </motion.div>

      {/* ── Season Selector ───────────────────────────────────────────────── */}
      {seasonOptions.length > 1 && (
        <motion.div variants={itemVariants}>
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
            {seasonOptions.map((season, idx) => (
              <button
                key={season}
                type="button"
                onClick={() => setSelectedSeasonIdx(idx)}
                className={clsx(
                  'shrink-0 px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-200',
                  'border backdrop-blur-xl',
                  idx === selectedSeasonIdx
                    ? 'bg-accent-orange/[0.15] border-accent-orange/30 text-accent-orange'
                    : 'bg-white/[0.04] border-white/[0.08] text-chrome-dim hover:text-chrome-medium hover:border-white/[0.16]',
                )}
              >
                {season}
              </button>
            ))}
          </div>
        </motion.div>
      )}

      {/* ── Identity Snapshot ─────────────────────────────────────────────── */}
      <motion.div variants={itemVariants}>
        <SectionHeader title="Identity Snapshot" eyebrow="Team Averages" />
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-5 gap-4">
          <MetricChip label="PPG" value={formatNum(currentSeason.ppg)} size="lg" highlight />
          <MetricChip label="RPG" value={formatNum(currentSeason.rpg)} size="lg" />
          <MetricChip label="APG" value={formatNum(currentSeason.apg)} size="lg" />
          <MetricChip label="FG%" value={`${formatPct(currentSeason.fgPct)}%`} size="lg" />
          <MetricChip label="3P%" value={`${formatPct(currentSeason.fg3Pct)}%`} size="lg" />
        </div>
      </motion.div>

      {/* ── Style Profile ─────────────────────────────────────────────────── */}
      {advancedForSeason && (
        <motion.div variants={itemVariants}>
          <SectionHeader title="Style Profile" eyebrow="Ratings vs League" />
          <GlassCard className="mt-3 p-5 space-y-4">
            <RatingBar
              label="Offensive Rating"
              value={Number(advancedForSeason.offRating)}
              leagueAvg={leagueAvg.offRating}
              color="#FF6B35"
              min={95}
              max={125}
            />
            <RatingBar
              label="Defensive Rating"
              value={Number(advancedForSeason.defRating)}
              leagueAvg={leagueAvg.defRating}
              color="#4DA6FF"
              min={95}
              max={125}
            />
            <RatingBar
              label="Net Rating"
              value={Number(advancedForSeason.netRating)}
              leagueAvg={leagueAvg.netRating}
              color="#34D399"
              min={-15}
              max={15}
            />
            <RatingBar
              label="Pace"
              value={Number(advancedForSeason.pace)}
              leagueAvg={leagueAvg.pace}
              color="#A78BFA"
              min={90}
              max={110}
            />
          </GlassCard>
        </motion.div>
      )}

      {/* ── Roster Table ──────────────────────────────────────────────────── */}
      <motion.div variants={itemVariants}>
        <SectionHeader
          title="Roster"
          eyebrow="Current Season"
          action={
            <div className="flex items-center gap-1 text-xs text-chrome-dim">
              <Users size={14} />
              <span>{sortedRoster.length} players</span>
            </div>
          }
        />
        <GlassCard className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[640px] text-xs">
            <thead>
              <tr className="border-b border-glass-border">
                {([
                  ['name', 'Player'],
                  ['position', 'Pos'],
                  ['age', 'Age'],
                  ['points', 'PPG'],
                  ['rebounds', 'RPG'],
                  ['assists', 'APG'],
                  ['fgPct', 'FG%'],
                ] as [SortField, string][]).map(([field, label]) => (
                  <th
                    key={field}
                    className="px-3 py-3 text-left font-semibold text-chrome-dim uppercase tracking-wider cursor-pointer hover:text-chrome-medium transition-colors select-none"
                    onClick={() => handleSort(field)}
                  >
                    <div className="flex items-center gap-1">
                      {label}
                      <SortIcon field={field} sortField={sortField} sortDir={sortDir} />
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedRoster.map((player, idx) => {
                const isTopScorer = topScorer?.name === player.name;
                return (
                  <motion.tr
                    key={player.name}
                    className={clsx(
                      'border-b border-glass-border/50 hover:bg-white/[0.05] transition-colors',
                      isTopScorer && 'bg-accent-orange/[0.04]',
                      idx % 2 === 0 && 'bg-white/[0.015]',
                    )}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.02 }}
                  >
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/player/${encodeURIComponent(player.name)}`}
                          className={clsx(
                            'font-medium hover:underline underline-offset-2 transition-colors',
                            isTopScorer ? 'text-accent-orange hover:text-accent-orange/80' : 'text-chrome-light hover:text-white',
                          )}
                        >
                          {player.name}
                        </Link>
                        {isTopScorer && <Badge variant="accent">Top</Badge>}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-chrome-medium">{player.position}</td>
                    <td className="px-3 py-2.5 text-chrome-medium">{player.age}</td>
                    <td className={clsx('px-3 py-2.5 font-semibold', isTopScorer ? 'text-accent-orange' : 'text-chrome-light')}>
                      {formatNum(player.points)}
                    </td>
                    <td className="px-3 py-2.5 text-chrome-light">{formatNum(player.rebounds)}</td>
                    <td className="px-3 py-2.5 text-chrome-light">{formatNum(player.assists)}</td>
                    <td className="px-3 py-2.5 text-chrome-medium">{formatPct(player.fgPct)}</td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
          {sortedRoster.length === 0 && (
            <div className="p-8 text-center text-sm text-chrome-dim">No roster data available</div>
          )}
        </GlassCard>
      </motion.div>

      {/* ── Season Trends ─────────────────────────────────────────────────── */}
      {winsTrend.length >= 2 && (
        <motion.div variants={itemVariants}>
          <SectionHeader title="Season Trends" eyebrow="Win Progression" />
          <GlassCard className="mt-3 p-5">
            <SeasonTrendLine data={winsTrend} />
          </GlassCard>
        </motion.div>
      )}

      {/* ── Top Lineups ───────────────────────────────────────────────────── */}
      {topLineups.length > 0 && (
        <motion.div variants={itemVariants}>
          <SectionHeader
            title="Top Lineups"
            eyebrow="5-Man Units"
            action={
              <div className="flex items-center gap-1 text-xs text-chrome-dim">
                <BarChart3 size={14} />
                <span>By minutes</span>
              </div>
            }
          />
          <GlassCard className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[640px] text-xs">
              <thead>
                <tr className="border-b border-glass-border">
                  <th className="px-3 py-3 text-left font-semibold text-chrome-dim uppercase tracking-wider">Lineup</th>
                  <th className="px-3 py-3 text-right font-semibold text-chrome-dim uppercase tracking-wider">MIN</th>
                  <th className="px-3 py-3 text-right font-semibold text-chrome-dim uppercase tracking-wider">+/-</th>
                  <th className="px-3 py-3 text-right font-semibold text-chrome-dim uppercase tracking-wider">PTS</th>
                  <th className="px-3 py-3 text-right font-semibold text-chrome-dim uppercase tracking-wider">W-L</th>
                </tr>
              </thead>
              <tbody>
                {topLineups.map((lineup, idx) => {
                  const pm = Number(lineup.plusMinus);
                  return (
                    <motion.tr
                      key={lineup.players}
                      className={clsx(
                        'border-b border-glass-border/50 hover:bg-white/[0.05] transition-colors',
                        idx % 2 === 0 && 'bg-white/[0.015]',
                      )}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.04 }}
                    >
                      <td className="px-3 py-2.5 text-chrome-light font-medium max-w-xs">
                        <span className="line-clamp-1">{lineup.players}</span>
                      </td>
                      <td className="px-3 py-2.5 text-right text-chrome-medium">{formatNum(lineup.minutes)}</td>
                      <td className={clsx(
                        'px-3 py-2.5 text-right font-semibold',
                        pm > 0 ? 'text-accent-green' : pm < 0 ? 'text-accent-red' : 'text-chrome-dim',
                      )}>
                        {pm > 0 ? '+' : ''}{pm.toFixed(1)}
                      </td>
                      <td className="px-3 py-2.5 text-right text-chrome-light">{formatNum(lineup.points)}</td>
                      <td className="px-3 py-2.5 text-right text-chrome-medium">
                        {lineup.wins}-{lineup.losses}
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </GlassCard>
        </motion.div>
      )}

      {/* ── Advanced Metrics ──────────────────────────────────────────────── */}
      {advancedForSeason && (
        <motion.div variants={itemVariants}>
          <SectionHeader title="Advanced Metrics" eyebrow="Analytics" />
          <div className="mt-3 flex flex-wrap gap-2">
            <MetricChip label="TS%" value={`${formatPct(advancedForSeason.tsPct)}%`} />
            <MetricChip label="eFG%" value={`${formatPct(advancedForSeason.efgPct)}%`} />
            <MetricChip label="AST%" value={`${formatPct(advancedForSeason.astPct)}%`} />
            <MetricChip label="TOV%" value={`${formatPct(advancedForSeason.tovPct)}%`} />
            <MetricChip label="OREB%" value={`${formatPct(advancedForSeason.orebPct)}%`} />
            <MetricChip label="PIE" value={formatPct(advancedForSeason.pie)} />
          </div>
        </motion.div>
      )}

      {/* ── Team Shot Profile ─────────────────────────────────────────────── */}
      {topScorer && (
        <motion.div variants={itemVariants}>
          <SectionHeader
            title="Shot Profile"
            eyebrow={`${topScorer.name} — Top Scorer`}
            action={
              <Link
                href={`/player/${encodeURIComponent(topScorer.name)}`}
                className="flex items-center gap-1 text-xs text-chrome-dim hover:text-accent-orange transition-colors"
              >
                <ExternalLink size={12} />
                Full Profile
              </Link>
            }
          />
          <GlassCard className="mt-3 p-5">
            {shotZones ? (
              <div className="space-y-3">
                {shotZones
                  .filter((z) => z.attempts > 0)
                  .sort((a, b) => b.attempts - a.attempts)
                  .slice(0, 6)
                  .map((zone) => {
                    const maxAttempts = Math.max(...shotZones.map((z) => z.attempts), 1);
                    const pct = Math.max(0, Math.min(100, (zone.attempts / maxAttempts) * 100));
                    const efficiency = zone.fgPct < 1 ? zone.fgPct * 100 : zone.fgPct;
                    const isHot = efficiency >= 55;
                    return (
                      <div key={zone.zone + zone.area} className="flex items-center gap-3">
                        <div className="w-32 shrink-0">
                          <span className="text-xs text-chrome-medium truncate block">{zone.zone}</span>
                          {zone.area && zone.area !== zone.zone && (
                            <span className="text-[10px] text-chrome-dim">{zone.area}</span>
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                              <motion.div
                                className={clsx(
                                  'h-full rounded-full',
                                  isHot ? 'bg-accent-green' : 'bg-accent-orange',
                                )}
                                style={{ opacity: 0.75 }}
                                initial={{ width: 0 }}
                                animate={{ width: `${pct}%` }}
                                transition={{ type: 'spring', stiffness: 120, damping: 14, delay: 0.1 }}
                              />
                            </div>
                            <span className={clsx(
                              'text-xs font-semibold w-10 text-right shrink-0',
                              isHot ? 'text-accent-green' : 'text-chrome-medium',
                            )}>
                              {efficiency.toFixed(0)}%
                            </span>
                          </div>
                        </div>
                        <span className="text-[10px] text-chrome-dim w-12 text-right shrink-0">
                          {zone.attempts} FGA
                        </span>
                      </div>
                    );
                  })}
                <div className="pt-2 border-t border-glass-border flex items-center gap-2 text-[10px] text-chrome-dim">
                  <Crosshair size={10} className="text-chrome-dim" />
                  <span>Zone FG% — green = hot zone (55%+)</span>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center py-6 gap-2 text-sm text-chrome-dim">
                <Crosshair size={16} className="text-chrome-dim animate-pulse" />
                Loading shot data...
              </div>
            )}
          </GlassCard>
        </motion.div>
      )}

      {/* ── Compare Link ──────────────────────────────────────────────────── */}
      <motion.div variants={itemVariants}>
        <Link
          href="/compare"
          className={clsx(
            'flex items-center justify-center gap-2 w-full py-3 rounded-2xl',
            'bg-white/[0.04] border border-white/[0.08] backdrop-blur-xl',
            'text-sm font-semibold text-chrome-medium',
            'hover:bg-white/[0.08] hover:border-white/[0.16] transition-all duration-200',
          )}
        >
          <GitCompareArrows size={16} />
          Compare with Another Team
        </Link>
      </motion.div>
    </motion.div>
  );
}
