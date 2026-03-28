'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  ArrowLeft,
  Trophy,
  Star,
  Ruler,
  Weight,
  GraduationCap,
  Calendar,
  Hash,
} from 'lucide-react';
import GlassCard from '@/components/ui/GlassCard';
import MetricChip from '@/components/ui/MetricChip';
import SectionHeader from '@/components/ui/SectionHeader';
import SkeletonLoader from '@/components/ui/SkeletonLoader';
import Badge from '@/components/ui/Badge';
import PlayerAvatar from '@/components/ui/PlayerAvatar';
import PlayoffAccolades from '@/components/ui/PlayoffAccolades';
import PlayoffEmptyState from '@/components/ui/PlayoffEmptyState';
import SeasonErrorBoundary from '@/components/ui/SeasonErrorBoundary';
import BasketballCourt from '@/components/court/BasketballCourt';
import { useSeasonType } from '@/lib/season-context';

// ── Types ────────────────────────────────────────────────────────────────────

interface PlayerInfo {
  readonly name: string;
  readonly position: string;
  readonly height: string;
  readonly weight: number;
  readonly college: string;
  readonly birthDate: string;
  readonly hof: number;
  readonly active: number;
  readonly fromYear: number;
  readonly toYear: number;
  readonly personId?: number;
}

interface SeasonStats {
  readonly season: string;
  readonly team: string;
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
  readonly turnovers: number;
  readonly fgPct: number;
  readonly fg3Pct: number;
  readonly ftPct: number;
  readonly efgPct: number;
  readonly fg: number;
  readonly fga: number;
  readonly fg3: number;
  readonly fg3a: number;
  readonly fg2: number;
  readonly fg2a: number;
  readonly ft: number;
  readonly fta: number;
  readonly orb: number;
  readonly drb: number;
  readonly fouls: number;
  readonly awards: string | null;
  readonly [key: string]: unknown;
}

interface AdvancedStats {
  readonly season: string;
  readonly team: string;
  readonly per: number;
  readonly tsPct: number;
  readonly usgPct: number;
  readonly ws48: number;
  readonly bpm: number;
  readonly vorp: number;
  readonly ows: number;
  readonly dws: number;
  readonly ws: number;
}

interface Award {
  readonly awardType: string;
  readonly season: string;
  readonly team: string;
}

interface DraftInfo {
  readonly year: number;
  readonly round: number;
  readonly pick: number;
  readonly team: string;
  readonly college: string;
}

interface ZoneStat {
  readonly zone: string;
  readonly area: string;
  readonly attempts: number;
  readonly makes: number;
  readonly fgPct: number;
  readonly avgDistance: number;
}

interface SimilarPlayer {
  readonly name: string;
  readonly team: string;
  readonly season: string;
  readonly points: number;
  readonly rebounds: number;
  readonly assists: number;
  readonly distance: number;
}

// ── Animation variants ───────────────────────────────────────────────────────

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.04 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.4, 0, 0.2, 1] as const } },
};

// ── Helper: zone color ───────────────────────────────────────────────────────

function zoneColor(fgPct: number): string {
  if (fgPct >= 55) return '#34D399';
  if (fgPct >= 45) return '#FBBF24';
  if (fgPct >= 35) return '#FF6B35';
  return '#F87171';
}

// ── Component ────────────────────────────────────────────────────────────────

export default function PlayerLabPage() {
  const params = useParams();
  const playerName = decodeURIComponent(params.name as string);
  const { seasonType } = useSeasonType();

  // State
  const [player, setPlayer] = useState<PlayerInfo | null>(null);
  const [stats, setStats] = useState<readonly SeasonStats[]>([]);
  const [advanced, setAdvanced] = useState<readonly AdvancedStats[]>([]);
  const [awards, setAwards] = useState<readonly Award[]>([]);
  const [draft, setDraft] = useState<DraftInfo | null>(null);
  const [zones, setZones] = useState<readonly ZoneStat[]>([]);
  const [similar, setSimilar] = useState<readonly SimilarPlayer[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch player data
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/v2/players/${encodeURIComponent(playerName)}?seasonType=${seasonType}`);
        if (!res.ok) throw new Error(res.status === 404 ? 'Player not found' : 'Failed to load player');
        const json = await res.json();
        if (cancelled) return;

        setPlayer(json.player);
        setStats(json.stats?.data ?? []);
        setAdvanced(json.advanced?.data ?? []);
        setAwards(json.awards ?? []);
        setDraft(json.draft ?? null);

        // Default to latest season
        const statsData = json.stats?.data ?? [];
        const latestSeason = statsData.length > 0
          ? statsData[statsData.length - 1].season
          : '';
        setSelectedSeason(latestSeason);
        setLoading(false);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unknown error');
          setLoading(false);
        }
      }
    }
    load();
    return () => { cancelled = true; };
  }, [playerName, seasonType]);

  // Fetch shot zones + similar when season changes
  useEffect(() => {
    if (!selectedSeason || !playerName) return;
    let cancelled = false;

    async function loadShots() {
      try {
        const res = await fetch(
          `/api/v2/players/${encodeURIComponent(playerName)}/shots?season=${encodeURIComponent(selectedSeason)}&seasonType=${seasonType}&zones=true`
        );
        if (res.ok) {
          const json = await res.json();
          if (!cancelled) setZones(json.zones ?? []);
        }
      } catch { /* silently fail */ }
    }

    async function loadSimilar() {
      try {
        const res = await fetch(
          `/api/v2/players/${encodeURIComponent(playerName)}/similar?season=${encodeURIComponent(selectedSeason)}&seasonType=${seasonType}`
        );
        if (res.ok) {
          const json = await res.json();
          if (!cancelled) setSimilar(json ?? []);
        }
      } catch { /* silently fail */ }
    }

    loadShots();
    loadSimilar();
    return () => { cancelled = true; };
  }, [playerName, selectedSeason, seasonType]);

  // Derived
  const seasons = useMemo(() => stats.map((s) => s.season), [stats]);
  const currentStats = useMemo(
    () => stats.find((s) => s.season === selectedSeason),
    [stats, selectedSeason],
  );
  const currentAdvanced = useMemo(
    () => advanced.find((a) => a.season === selectedSeason),
    [advanced, selectedSeason],
  );

  // Unique award types
  const uniqueAwards = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of awards) {
      map.set(a.awardType, (map.get(a.awardType) ?? 0) + 1);
    }
    return Array.from(map.entries());
  }, [awards]);

  // ── Loading ──────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 pt-6 pb-8">
        <SkeletonLoader height={200} rounded="xl" className="w-full mb-6" />
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mb-6">
          <SkeletonLoader height={64} rounded="xl" count={6} className="w-full" />
        </div>
        <SkeletonLoader height={300} rounded="xl" className="w-full mb-6" />
        <SkeletonLoader height={300} rounded="xl" className="w-full" />
      </div>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────────

  if (error || !player) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-6">
        <GlassCard className="p-8 text-center max-w-md">
          <h2 className="text-lg font-bold text-text-primary mb-2">
            {error === 'Player not found' ? 'Player Not Found' : 'Error'}
          </h2>
          <p className="text-sm text-text-secondary mb-4">{error}</p>
          <Link
            href="/explore"
            className="inline-flex items-center gap-1 text-sm text-accent-orange hover:underline"
          >
            <ArrowLeft size={14} /> Back to Explore
          </Link>
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 pt-4 pb-8">
      {/* Back link */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-4">
        <Link
          href="/explore"
          className="inline-flex items-center gap-1 text-xs text-text-tertiary hover:text-text-secondary transition-colors no-underline"
        >
          <ArrowLeft size={12} /> Explore
        </Link>
      </motion.div>

      {/* ── Hero Banner ───────────────────────────────────────────────── */}
      <motion.section
        initial="hidden"
        animate="visible"
        variants={stagger}
        className="mb-8"
      >
        <GlassCard className="p-6 sm:p-8">
          <motion.div variants={fadeUp} className="flex flex-col sm:flex-row items-start gap-5">
            <PlayerAvatar name={player.name} playerId={player.personId} size="xl" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-text-primary font-display">
                  {player.name}
                </h1>
                {player.hof === 1 && (
                  <Badge variant="warning">
                    <Trophy size={10} className="mr-0.5" /> HOF
                  </Badge>
                )}
                {player.active === 1 && (
                  <Badge variant="success">Active</Badge>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-3 text-xs text-text-secondary mt-2">
                <span className="flex items-center gap-1">
                  <Star size={11} className="text-accent-orange" />
                  {player.position}
                </span>
                {player.height && (
                  <span className="flex items-center gap-1">
                    <Ruler size={11} /> {player.height}
                  </span>
                )}
                {player.weight && (
                  <span className="flex items-center gap-1">
                    <Weight size={11} /> {player.weight} lbs
                  </span>
                )}
                {player.college && (
                  <span className="flex items-center gap-1">
                    <GraduationCap size={11} /> {player.college}
                  </span>
                )}
                {draft && (
                  <span className="flex items-center gap-1">
                    <Hash size={11} /> {draft.year} Draft Rd {draft.round} Pick {draft.pick} ({draft.team})
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Calendar size={11} /> {player.fromYear}&ndash;{player.toYear}
                </span>
              </div>
            </div>
          </motion.div>

          {/* Awards row */}
          {uniqueAwards.length > 0 && (
            <motion.div variants={fadeUp} className="flex flex-wrap gap-2 mt-5">
              {uniqueAwards.map(([type, count]) => (
                <Badge key={type} variant="accent">
                  <Trophy size={9} className="mr-1" />
                  {count > 1 ? `${count}x ` : ''}{type}
                </Badge>
              ))}
            </motion.div>
          )}
        </GlassCard>
      </motion.section>

      {/* ── Playoff Accolades ─────────────────────────────────────────── */}
      {(seasonType === 'playoffs' || seasonType === 'combined') && (
        <motion.section className="mb-8" initial="hidden" animate="visible" variants={fadeUp}>
          <PlayoffAccolades
            playerName={playerName}
            awards={awards}
            playoffStats={
              seasonType === 'combined'
                ? stats.filter((s: Record<string, unknown>) => s.dataSource === 'playoffs')
                : stats
            }
          />
        </motion.section>
      )}

      {seasonType === 'playoffs' && stats.length === 0 && (
        <motion.section className="mb-8" initial="hidden" animate="visible" variants={fadeUp}>
          <PlayoffEmptyState
            title="No Playoff Data"
            message={`Playoff statistics for ${playerName} are not yet available.`}
          />
        </motion.section>
      )}

      {/* ── Data Sections (wrapped in error boundary) ─────────────────── */}
      <SeasonErrorBoundary>

      {/* ── Season Selector ───────────────────────────────────────────── */}
      <motion.div
        initial="hidden"
        animate="visible"
        variants={fadeUp}
        className="mb-6"
      >
        <SectionHeader title="Season Stats" eyebrow="Per Game" className="mb-3" />
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
          {seasons.map((season) => (
            <button
              key={season}
              type="button"
              onClick={() => setSelectedSeason(season)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${
                selectedSeason === season
                  ? 'bg-accent-orange/20 text-accent-orange border border-accent-orange/30'
                  : 'bg-glass-bg text-chrome-dim border border-glass-border hover:text-chrome-medium'
              }`}
            >
              {season}
            </button>
          ))}
        </div>
      </motion.div>

      {/* ── Stats Grid ────────────────────────────────────────────────── */}
      {currentStats && (
        <motion.div
          initial="hidden"
          animate="visible"
          variants={stagger}
          className="grid grid-cols-3 sm:grid-cols-6 gap-3 mb-8"
        >
          {[
            { label: 'PPG', value: Number(currentStats.points).toFixed(1), highlight: true },
            { label: 'RPG', value: Number(currentStats.rebounds).toFixed(1) },
            { label: 'APG', value: Number(currentStats.assists).toFixed(1) },
            { label: 'SPG', value: Number(currentStats.steals).toFixed(1) },
            { label: 'BPG', value: Number(currentStats.blocks).toFixed(1) },
            { label: 'FG%', value: currentStats.fgPct ? `${(Number(currentStats.fgPct) * 100).toFixed(1)}` : '--' },
          ].map((chip) => (
            <motion.div key={chip.label} variants={fadeUp}>
              <GlassCard className="flex items-center justify-center p-3">
                <MetricChip
                  label={chip.label}
                  value={chip.value}
                  highlight={chip.highlight}
                  size="lg"
                />
              </GlassCard>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* ── Career Trends Chart ───────────────────────────────────────── */}
      <motion.section
        className="mb-8"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        variants={stagger}
      >
        <motion.div variants={fadeUp}>
          <SectionHeader title="Career Trends" eyebrow="Per Game" className="mb-4" />
        </motion.div>
        <motion.div variants={fadeUp}>
          <GlassCard className="p-4 sm:p-6">
            <CareerTrendsChart stats={stats} selectedSeason={selectedSeason} />
          </GlassCard>
        </motion.div>
      </motion.section>

      {/* ── Shot Chart Section ─────────────────────────────────────────── */}
      {zones.length > 0 && (
        <motion.section
          className="mb-8"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={stagger}
        >
          <motion.div variants={fadeUp}>
            <SectionHeader
              title="Shot Zones"
              eyebrow={selectedSeason}
              className="mb-4"
            />
          </motion.div>
          <motion.div variants={fadeUp}>
            <GlassCard className="p-4 sm:p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Court with zone overlays */}
                <div className="flex items-center justify-center">
                  <BasketballCourt
                    showZones
                    zoneColors={Object.fromEntries(
                      zones.map((z) => [
                        z.zone,
                        `${zoneColor(z.fgPct)}40`,
                      ])
                    )}
                    className="w-full max-w-[320px]"
                  />
                </div>
                {/* Zone stats table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-glass-border">
                        <th className="text-left py-2 text-chrome-dim font-medium">Zone</th>
                        <th className="text-right py-2 text-chrome-dim font-medium">FG%</th>
                        <th className="text-right py-2 text-chrome-dim font-medium">Makes</th>
                        <th className="text-right py-2 text-chrome-dim font-medium">Att</th>
                      </tr>
                    </thead>
                    <tbody>
                      {zones.map((z) => (
                        <tr key={`${z.zone}-${z.area}`} className="border-b border-glass-border/40">
                          <td className="py-2 text-chrome-light">
                            <div className="flex items-center gap-2">
                              <span
                                className="w-2 h-2 rounded-full shrink-0"
                                style={{ backgroundColor: zoneColor(z.fgPct) }}
                              />
                              <span className="truncate">{z.zone}</span>
                            </div>
                          </td>
                          <td className="text-right py-2 font-mono font-bold" style={{ color: zoneColor(z.fgPct) }}>
                            {z.fgPct}%
                          </td>
                          <td className="text-right py-2 text-chrome-medium font-mono">{z.makes}</td>
                          <td className="text-right py-2 text-chrome-medium font-mono">{z.attempts}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </GlassCard>
          </motion.div>
        </motion.section>
      )}

      {/* ── Advanced Metrics ───────────────────────────────────────────── */}
      {currentAdvanced && (
        <motion.section
          className="mb-8"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={stagger}
        >
          <motion.div variants={fadeUp}>
            <SectionHeader title="Advanced Metrics" eyebrow={selectedSeason} className="mb-4" />
          </motion.div>
          <motion.div variants={fadeUp}>
            <GlassCard className="p-4 sm:p-6">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                {[
                  { label: 'PER', value: currentAdvanced.per, max: 35 },
                  { label: 'TS%', value: currentAdvanced.tsPct ? Number(currentAdvanced.tsPct) * 100 : null, max: 70 },
                  { label: 'USG%', value: currentAdvanced.usgPct ? Number(currentAdvanced.usgPct) * 100 : null, max: 40 },
                  { label: 'WS/48', value: currentAdvanced.ws48 ? Number(currentAdvanced.ws48) * 10 : null, max: 3.5 },
                  { label: 'BPM', value: currentAdvanced.bpm, max: 12 },
                  { label: 'VORP', value: currentAdvanced.vorp, max: 10 },
                ].map((metric) => {
                  const val = metric.value != null ? Number(metric.value) : 0;
                  const pct = Math.min(100, Math.max(0, (val / metric.max) * 100));
                  return (
                    <div key={metric.label} className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase tracking-wider text-chrome-dim font-medium">
                          {metric.label}
                        </span>
                        <span className="text-sm font-bold text-chrome-light font-mono">
                          {metric.value != null ? (
                            metric.label === 'WS/48'
                              ? Number(currentAdvanced.ws48).toFixed(3)
                              : metric.label === 'TS%' || metric.label === 'USG%'
                                ? `${val.toFixed(1)}%`
                                : val.toFixed(1)
                          ) : '--'}
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-glass-bg overflow-hidden">
                        <motion.div
                          className="h-full rounded-full"
                          style={{
                            background: pct > 70
                              ? 'linear-gradient(90deg, #34D399, #4DA6FF)'
                              : pct > 40
                                ? 'linear-gradient(90deg, #FBBF24, #FF6B35)'
                                : 'linear-gradient(90deg, #F87171, #FF6B35)',
                          }}
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1], delay: 0.2 }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </GlassCard>
          </motion.div>
        </motion.section>
      )}

      {/* ── Similar Players ────────────────────────────────────────────── */}
      {similar.length > 0 && (
        <motion.section
          className="mb-8"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={stagger}
        >
          <motion.div variants={fadeUp}>
            <SectionHeader title="Similar Players" eyebrow={selectedSeason} className="mb-4" />
          </motion.div>
          <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
            {similar.map((sp) => (
              <motion.div key={sp.name} variants={fadeUp} className="shrink-0">
                <Link href={`/player/${encodeURIComponent(sp.name)}`}>
                  <GlassCard hoverable className="w-[160px] p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <PlayerAvatar name={sp.name} size="sm" />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-chrome-light truncate">{sp.name}</p>
                        <p className="text-[9px] text-chrome-dim">{sp.team}</p>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <MetricChip label="PPG" value={Number(sp.points).toFixed(1)} size="sm" />
                      <MetricChip label="RPG" value={Number(sp.rebounds).toFixed(1)} size="sm" />
                      <MetricChip label="APG" value={Number(sp.assists).toFixed(1)} size="sm" />
                    </div>
                  </GlassCard>
                </Link>
              </motion.div>
            ))}
          </div>
        </motion.section>
      )}

      {/* ── Explore More ────────────────────────────────────────────────── */}
      <motion.section
        className="mb-8"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        variants={stagger}
      >
        <motion.div variants={fadeUp}>
          <SectionHeader title="Explore More" className="mb-4" />
        </motion.div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <motion.div variants={fadeUp}>
            <Link href={`/player/${encodeURIComponent(playerName)}/timeline`}>
              <GlassCard hoverable className="p-4">
                <p className="text-sm font-semibold text-chrome-light mb-1">Career Timeline</p>
                <p className="text-xs text-chrome-dim">Draft, trades, awards, milestones</p>
              </GlassCard>
            </Link>
          </motion.div>
          <motion.div variants={fadeUp}>
            <Link href={`/zones/${encodeURIComponent(playerName)}`}>
              <GlassCard hoverable className="p-4">
                <p className="text-sm font-semibold text-chrome-light mb-1">Hot Zones</p>
                <p className="text-xs text-chrome-dim">Shot heatmap and zone efficiency</p>
              </GlassCard>
            </Link>
          </motion.div>
          <motion.div variants={fadeUp}>
            <Link href={`/matchup`}>
              <GlassCard hoverable className="p-4">
                <p className="text-sm font-semibold text-chrome-light mb-1">Head-to-Head</p>
                <p className="text-xs text-chrome-dim">Matchup stats vs top rivals</p>
              </GlassCard>
            </Link>
          </motion.div>
        </div>
      </motion.section>

      {/* ── Season-by-Season Table ─────────────────────────────────────── */}
      <motion.section
        className="mb-8"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        variants={stagger}
      >
        <motion.div variants={fadeUp}>
          <SectionHeader title="Season Log" eyebrow="All Seasons" className="mb-4" />
        </motion.div>
        <motion.div variants={fadeUp}>
          <GlassCard className="overflow-x-auto">
            <table className="w-full text-xs whitespace-nowrap">
              <thead>
                <tr className="border-b border-glass-border">
                  {['Season', 'Team', 'Age', 'G', 'MPG', 'PPG', 'RPG', 'APG', 'SPG', 'BPG', 'FG%', '3P%', 'FT%'].map(
                    (h) => (
                      <th
                        key={h}
                        className="px-3 py-2.5 text-left text-chrome-dim font-medium uppercase tracking-wider text-[10px]"
                      >
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {stats.map((s) => {
                  const isSelected = s.season === selectedSeason;
                  return (
                    <tr
                      key={`${s.season}-${s.team}`}
                      className={`border-b border-glass-border/30 cursor-pointer transition-colors ${
                        isSelected ? 'bg-accent-orange/[0.06]' : 'hover:bg-glass-frosted'
                      }`}
                      onClick={() => setSelectedSeason(s.season)}
                    >
                      <td className="px-3 py-2 font-medium text-chrome-light">{s.season}</td>
                      <td className="px-3 py-2 text-chrome-medium">{s.team}</td>
                      <td className="px-3 py-2 text-chrome-medium">{s.age}</td>
                      <td className="px-3 py-2 text-chrome-medium">{s.games}</td>
                      <td className="px-3 py-2 text-chrome-medium font-mono">{Number(s.minutes).toFixed(1)}</td>
                      <td className="px-3 py-2 text-chrome-light font-mono font-bold">{Number(s.points).toFixed(1)}</td>
                      <td className="px-3 py-2 text-chrome-medium font-mono">{Number(s.rebounds).toFixed(1)}</td>
                      <td className="px-3 py-2 text-chrome-medium font-mono">{Number(s.assists).toFixed(1)}</td>
                      <td className="px-3 py-2 text-chrome-medium font-mono">{Number(s.steals).toFixed(1)}</td>
                      <td className="px-3 py-2 text-chrome-medium font-mono">{Number(s.blocks).toFixed(1)}</td>
                      <td className="px-3 py-2 text-chrome-medium font-mono">
                        {s.fgPct ? (Number(s.fgPct) * 100).toFixed(1) : '--'}
                      </td>
                      <td className="px-3 py-2 text-chrome-medium font-mono">
                        {s.fg3Pct ? (Number(s.fg3Pct) * 100).toFixed(1) : '--'}
                      </td>
                      <td className="px-3 py-2 text-chrome-medium font-mono">
                        {s.ftPct ? (Number(s.ftPct) * 100).toFixed(1) : '--'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </GlassCard>
        </motion.div>
      </motion.section>

      </SeasonErrorBoundary>
    </div>
  );
}

// ── Career Trends Chart (inline SVG) ─────────────────────────────────────────

function CareerTrendsChart({ stats, selectedSeason }: { readonly stats: readonly SeasonStats[]; readonly selectedSeason: string }) {
  if (stats.length === 0) {
    return <p className="text-sm text-chrome-dim text-center py-8">No career data available</p>;
  }

  const width = 600;
  const height = 200;
  const padding = { top: 20, right: 20, bottom: 40, left: 36 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const lines = [
    { key: 'points', label: 'PPG', color: '#FF6B35' },
    { key: 'rebounds', label: 'RPG', color: '#4DA6FF' },
    { key: 'assists', label: 'APG', color: '#34D399' },
  ] as const;

  const maxVal = Math.max(
    1,
    ...stats.flatMap((s) => [Number(s.points), Number(s.rebounds), Number(s.assists)]),
  );

  const xScale = (i: number) => padding.left + (i / Math.max(1, stats.length - 1)) * chartW;
  const yScale = (v: number) => padding.top + chartH - (v / maxVal) * chartH;

  function buildPath(key: 'points' | 'rebounds' | 'assists'): string {
    return stats
      .map((s, i) => {
        const x = xScale(i);
        const y = yScale(Number(s[key]));
        return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
      })
      .join(' ');
  }

  return (
    <div>
      {/* Legend */}
      <div className="flex items-center gap-4 mb-3">
        {lines.map((l) => (
          <div key={l.key} className="flex items-center gap-1.5">
            <span className="w-3 h-[2px] rounded-full" style={{ backgroundColor: l.color }} />
            <span className="text-[10px] text-chrome-dim font-medium">{l.label}</span>
          </div>
        ))}
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMid meet"
        className="w-full h-auto"
      >
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
          const y = padding.top + chartH * (1 - pct);
          const val = (maxVal * pct).toFixed(0);
          return (
            <g key={pct}>
              <line
                x1={padding.left}
                y1={y}
                x2={width - padding.right}
                y2={y}
                stroke="rgba(0,0,0,0.06)"
                strokeWidth={1}
              />
              <text
                x={padding.left - 6}
                y={y + 3}
                textAnchor="end"
                fill="rgba(0,0,0,0.3)"
                fontSize={9}
              >
                {val}
              </text>
            </g>
          );
        })}

        {/* X-axis labels */}
        {stats.map((s, i) => {
          // Only show every Nth label to avoid crowding
          const showLabel = stats.length <= 10 || i % Math.ceil(stats.length / 8) === 0 || i === stats.length - 1;
          if (!showLabel) return null;
          return (
            <text
              key={s.season}
              x={xScale(i)}
              y={height - 6}
              textAnchor="middle"
              fill="rgba(0,0,0,0.3)"
              fontSize={8}
            >
              {s.season.split('-')[0]}
            </text>
          );
        })}

        {/* Lines */}
        {lines.map((l) => (
          <motion.path
            key={l.key}
            d={buildPath(l.key)}
            fill="none"
            stroke={l.color}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 1.2, ease: [0.4, 0, 0.2, 1] as const }}
          />
        ))}

        {/* Dots for selected season */}
        {stats.map((s, i) => {
          if (s.season !== selectedSeason) return null;
          return lines.map((l) => (
            <circle
              key={`${l.key}-dot`}
              cx={xScale(i)}
              cy={yScale(Number(s[l.key]))}
              r={4}
              fill={l.color}
              stroke="#0a0a12"
              strokeWidth={2}
            />
          ));
        })}
      </svg>
    </div>
  );
}
