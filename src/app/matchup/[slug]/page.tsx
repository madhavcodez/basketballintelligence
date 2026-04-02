'use client';

import { useState, useEffect, useCallback, use } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { ArrowLeft, Swords, Trophy, Users, Calendar, AlertTriangle } from 'lucide-react';
import clsx from 'clsx';
import GlassCard from '@/components/ui/GlassCard';
import SectionHeader from '@/components/ui/SectionHeader';
import MetricChip from '@/components/ui/MetricChip';
import SkeletonLoader from '@/components/ui/SkeletonLoader';
import Badge from '@/components/ui/Badge';
import PlayerAvatar from '@/components/ui/PlayerAvatar';
import TeamLogo from '@/components/ui/TeamLogo';
import MatchupHero from '@/components/matchup/MatchupHero';
import MatchupStatBar from '@/components/matchup/MatchupStatBar';
import MatchupGameLog from '@/components/matchup/MatchupGameLog';
import { colors } from '@/lib/design-tokens';

// ── Slug helpers (pure, no DB — safe for client) ────────────────────────────

function deslugifyName(slug: string): string {
  return slug
    .split('-')
    .map((word) => {
      if (/^(i{2,3}|iv|vi{0,3}|ix|xi{0,3})$/i.test(word)) {
        return word.toUpperCase();
      }
      if (/^(jr|sr)$/i.test(word)) {
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase() + '.';
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}

function fromMatchupSlug(
  slug: string,
): { readonly player1: string; readonly player2: string } | null {
  const parts = slug.split('-vs-');
  if (parts.length !== 2) return null;
  return {
    player1: deslugifyName(parts[0]),
    player2: deslugifyName(parts[1]),
  };
}

function slugifyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/['.]/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function toMatchupSlug(p1: string, p2: string): string {
  return `${slugifyName(p1)}-vs-${slugifyName(p2)}`;
}

// ── Shared types (mirror matchup-engine interfaces for client use) ──────────

interface GameStats {
  readonly pts: number;
  readonly reb: number;
  readonly ast: number;
  readonly stl: number;
  readonly blk: number;
  readonly fgPct: number;
  readonly fg3Pct: number;
  readonly ftPct: number;
  readonly min: number;
  readonly plusMinus: number;
  readonly fgm: number;
  readonly fga: number;
  readonly fg3m: number;
  readonly fg3a: number;
  readonly ftm: number;
  readonly fta: number;
  readonly tov: number;
}

interface MatchupGame {
  readonly gameId: number;
  readonly gameDate: string;
  readonly p1Team: string;
  readonly p2Team: string;
  readonly p1Won: boolean;
  readonly p2Won: boolean;
  readonly matchupStr: string;
  readonly p1Stats: GameStats;
  readonly p2Stats: GameStats;
}

interface MatchupSummary {
  readonly player1: string;
  readonly player2: string;
  readonly totalGames: number;
  readonly p1Wins: number;
  readonly p2Wins: number;
  readonly p1Averages: GameStats;
  readonly p2Averages: GameStats;
  readonly bestP1Game: MatchupGame | null;
  readonly bestP2Game: MatchupGame | null;
  readonly lastMeeting: MatchupGame | null;
  readonly headToHeadRecord: string;
  readonly p1PersonId?: string | number | null;
  readonly p2PersonId?: string | number | null;
}

interface RivalRecord {
  readonly rival: string;
  readonly sharedGames: number;
  readonly wins: number;
  readonly losses: number;
}

// ── Types ────────────────────────────────────────────────────────────────────

interface GamesResponse {
  readonly games: readonly MatchupGame[];
  readonly total: number;
}

interface RivalsResponse {
  readonly player: string;
  readonly rivals: readonly RivalRecord[];
}

// ── Season Record for Head-to-Head by Era ────────────────────────────────────

interface SeasonRecord {
  readonly season: string;
  readonly p1Wins: number;
  readonly p2Wins: number;
}

function computeSeasonRecords(games: readonly MatchupGame[]): SeasonRecord[] {
  const map = new Map<string, { p1: number; p2: number }>();
  for (const g of games) {
    const year = new Date(g.gameDate).getFullYear();
    const month = new Date(g.gameDate).getMonth();
    // NBA season: Oct-Jun. If month >= 9 (Oct), it's the start year
    const startYear = month >= 9 ? year : year - 1;
    const season = `${startYear}-${String(startYear + 1).slice(2)}`;
    const existing = map.get(season) ?? { p1: 0, p2: 0 };
    map.set(season, {
      p1: existing.p1 + (g.p1Won ? 1 : 0),
      p2: existing.p2 + (g.p1Won ? 0 : 1),
    });
  }
  return Array.from(map.entries())
    .map(([season, { p1, p2 }]) => ({ season, p1Wins: p1, p2Wins: p2 }))
    .sort((a, b) => a.season.localeCompare(b.season));
}

// ── Animation variants ──────────────────────────────────────────────────────

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring' as const, stiffness: 120, damping: 14 },
  },
};

// ── Stat Bar Config ─────────────────────────────────────────────────────────

interface StatBarConfig {
  readonly label: string;
  readonly key: string;
  readonly format: 'number' | 'percentage';
}

const STAT_BARS: readonly StatBarConfig[] = [
  { label: 'Points', key: 'pts', format: 'number' },
  { label: 'Rebounds', key: 'reb', format: 'number' },
  { label: 'Assists', key: 'ast', format: 'number' },
  { label: 'Steals', key: 'stl', format: 'number' },
  { label: 'Blocks', key: 'blk', format: 'number' },
  { label: 'FG%', key: 'fgPct', format: 'percentage' },
  { label: '3P%', key: 'fg3Pct', format: 'percentage' },
  { label: 'FT%', key: 'ftPct', format: 'percentage' },
  { label: '+/-', key: 'plusMinus', format: 'number' },
];

// ── Helpers ─────────────────────────────────────────────────────────────────

function getStatValue(
  averages: Record<string, number>,
  key: string,
): number {
  return averages[key] ?? 0;
}

function formatGameStatLine(game: MatchupGame, player: 'p1' | 'p2'): string {
  const stats = player === 'p1' ? game.p1Stats : game.p2Stats;
  return `${stats.pts} PTS / ${stats.reb} REB / ${stats.ast} AST`;
}

function formatGameDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function detectTeammates(games: readonly MatchupGame[]): boolean {
  if (games.length === 0) return false;
  let sameTeamCount = 0;
  for (const g of games) {
    if (g.p1Team === g.p2Team) {
      sameTeamCount += 1;
    }
  }
  return sameTeamCount > games.length * 0.3;
}

// ── Page Size ───────────────────────────────────────────────────────────────

const GAMES_PAGE_SIZE = 20;

// ── Era Bar Chart Row ───────────────────────────────────────────────────────

interface EraBarRowProps {
  readonly record: SeasonRecord;
  readonly maxGames: number;
  readonly index: number;
}

function EraBarRow({ record, maxGames, index }: EraBarRowProps) {
  const p1Width = maxGames > 0 ? (record.p1Wins / maxGames) * 100 : 0;
  const p2Width = maxGames > 0 ? (record.p2Wins / maxGames) * 100 : 0;

  return (
    <motion.div
      className="flex items-center gap-3"
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{
        type: 'spring' as const,
        stiffness: 100,
        damping: 16,
        delay: index * 0.08,
      }}
    >
      <span className="text-xs text-[#86868B] font-mono w-14 shrink-0 text-right">
        {record.season}
      </span>

      <div className="flex-1 flex items-center gap-0.5 h-6">
        <motion.div
          className="h-full rounded-l-md"
          style={{ backgroundColor: colors.accentOrange }}
          initial={{ width: 0 }}
          animate={{ width: `${p1Width}%` }}
          transition={{
            type: 'spring' as const,
            stiffness: 80,
            damping: 14,
            delay: index * 0.08 + 0.15,
          }}
        />
        <motion.div
          className="h-full rounded-r-md"
          style={{ backgroundColor: colors.accentBlue }}
          initial={{ width: 0 }}
          animate={{ width: `${p2Width}%` }}
          transition={{
            type: 'spring' as const,
            stiffness: 80,
            damping: 14,
            delay: index * 0.08 + 0.2,
          }}
        />
      </div>

      <span className="text-xs text-[#6E6E73] font-bold tabular-nums w-10 shrink-0">
        {record.p1Wins}-{record.p2Wins}
      </span>
    </motion.div>
  );
}

// ── Component ────────────────────────────────────────────────────────────────

export default function MatchupSlugPage({
  params,
}: {
  readonly params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);

  // State
  const [summary, setSummary] = useState<MatchupSummary | null>(null);
  const [games, setGames] = useState<readonly MatchupGame[]>([]);
  const [totalGames, setTotalGames] = useState(0);
  const [p1Rivals, setP1Rivals] = useState<readonly RivalRecord[]>([]);
  const [p2Rivals, setP2Rivals] = useState<readonly RivalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [gamesOffset, setGamesOffset] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);

  // Fetch all data
  useEffect(() => {
    const matchup = fromMatchupSlug(slug);
    if (!matchup) {
      setError('Invalid matchup URL');
      setLoading(false);
      return;
    }

    const { player1: p1Name, player2: p2Name } = matchup;
    let cancelled = false;

    async function fetchData() {
      setLoading(true);
      setError(null);

      const p1Encoded = encodeURIComponent(p1Name);
      const p2Encoded = encodeURIComponent(p2Name);

      try {
        const [summaryRes, gamesRes, p1RivalsRes, p2RivalsRes] =
          await Promise.all([
            fetch(`/api/matchup?p1=${p1Encoded}&p2=${p2Encoded}`),
            fetch(
              `/api/matchup/games?p1=${p1Encoded}&p2=${p2Encoded}&limit=${GAMES_PAGE_SIZE}&offset=0`,
            ),
            fetch(`/api/matchup/rivals/${p1Encoded}?limit=5`),
            fetch(`/api/matchup/rivals/${p2Encoded}?limit=5`),
          ]);

        if (cancelled) return;

        if (!summaryRes.ok) {
          const errorData = await summaryRes.json();
          setError(
            errorData.error ?? 'Failed to load matchup data',
          );
          setLoading(false);
          return;
        }

        const summaryData: MatchupSummary = await summaryRes.json();
        setSummary(summaryData);

        if (gamesRes.ok) {
          const gamesData: GamesResponse = await gamesRes.json();
          setGames(gamesData.games);
          setTotalGames(gamesData.total);
          setGamesOffset(GAMES_PAGE_SIZE);
        }

        if (p1RivalsRes.ok) {
          const rivalsData: RivalsResponse = await p1RivalsRes.json();
          setP1Rivals(rivalsData.rivals);
        }

        if (p2RivalsRes.ok) {
          const rivalsData: RivalsResponse = await p2RivalsRes.json();
          setP2Rivals(rivalsData.rivals);
        }

        setLoading(false);
      } catch {
        if (!cancelled) {
          setError('Failed to connect to the server');
          setLoading(false);
        }
      }
    }

    fetchData();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  // Load more games
  const handleLoadMore = useCallback(async () => {
    if (!summary || loadingMore) return;

    setLoadingMore(true);

    const p1Encoded = encodeURIComponent(summary.player1);
    const p2Encoded = encodeURIComponent(summary.player2);

    try {
      const res = await fetch(
        `/api/matchup/games?p1=${p1Encoded}&p2=${p2Encoded}&limit=${GAMES_PAGE_SIZE}&offset=${gamesOffset}`,
      );

      if (res.ok) {
        const data: GamesResponse = await res.json();
        setGames((prev) => [...prev, ...data.games]);
        setGamesOffset((prev) => prev + GAMES_PAGE_SIZE);
      }
    } catch {
      /* network error */
    } finally {
      setLoadingMore(false);
    }
  }, [summary, gamesOffset, loadingMore]);

  // ── Loading State ──────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 pt-4 pb-8 space-y-6">
        <SkeletonLoader height={16} width={80} rounded="full" />
        <SkeletonLoader height={180} rounded="xl" className="w-full" />
        <SkeletonLoader height={300} rounded="xl" className="w-full" />
        <SkeletonLoader height={200} rounded="xl" className="w-full" />
      </div>
    );
  }

  // ── Error State ────────────────────────────────────────────────────────────

  if (error || !summary) {
    const isNeverPlayed =
      error === 'No shared games found between these players';
    const isDifferentEra =
      typeof error === 'string' &&
      (error.toLowerCase().includes('different era') ||
        error.toLowerCase().includes('careers didn\'t overlap') ||
        error.toLowerCase().includes('no overlap'));

    return (
      <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 pt-4 pb-8">
        <Link
          href="/matchup"
          className="inline-flex items-center gap-1 text-xs text-[#86868B] hover:text-[#6E6E73] transition-colors mb-6"
        >
          <ArrowLeft size={12} /> Back to Matchups
        </Link>

        <GlassCard className="p-8 text-center">
          {isDifferentEra ? (
            <>
              <Calendar
                size={40}
                className="mx-auto mb-3 text-accent-gold"
              />
              <h3 className="text-lg font-bold text-[#1D1D1F] mb-1">
                Careers Didn&apos;t Overlap
              </h3>
              <p className="text-sm text-[#86868B] max-w-md mx-auto">
                These players competed in different eras and never faced each other on the court.
              </p>
            </>
          ) : (
            <>
              <Swords
                size={40}
                className={clsx(
                  'mx-auto mb-3',
                  isNeverPlayed ? 'text-[#86868B]' : 'text-[#EF4444]',
                )}
              />
              <h3 className="text-lg font-bold text-[#1D1D1F] mb-1">
                {isNeverPlayed ? 'Never Played Each Other' : 'Unable to Load Matchup'}
              </h3>
              <p className="text-sm text-[#86868B] max-w-md mx-auto">
                {isNeverPlayed
                  ? 'These players have no recorded shared games in our database.'
                  : error ?? 'An unexpected error occurred.'}
              </p>
            </>
          )}
          <Link
            href="/matchup"
            className="inline-flex items-center gap-1.5 mt-4 px-4 py-2 rounded-full bg-white border border-black/[0.06] text-xs text-[#6E6E73] hover:text-[#1D1D1F] transition-colors"
          >
            <ArrowLeft size={12} />
            Try Another Matchup
          </Link>
        </GlassCard>
      </div>
    );
  }

  // ── Computed Values ────────────────────────────────────────────────────────

  const p1Avgs = summary.p1Averages as unknown as Record<string, number>;
  const p2Avgs = summary.p2Averages as unknown as Record<string, number>;
  const hasMoreGames = games.length < totalGames;

  // Win Streak Tracker — compute from the first 10 games
  const recentGames = games.slice(0, 10).map((g) => ({ p1Won: g.p1Won }));

  // Head-to-Head by Era — season records
  const seasonRecords = computeSeasonRecords(games);
  const maxGamesInSeason = seasonRecords.reduce(
    (max, r) => Math.max(max, r.p1Wins + r.p2Wins),
    0,
  );

  // Teammate detection
  const areTeammates = detectTeammates(games);

  // ── Main Render ────────────────────────────────────────────────────────────

  return (
    <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 pt-4 pb-12">
      <motion.div initial="hidden" animate="visible" variants={stagger}>
        {/* Back Button */}
        <motion.div variants={fadeUp} className="mb-4">
          <Link
            href="/matchup"
            className="inline-flex items-center gap-1 text-xs text-[#86868B] hover:text-[#6E6E73] transition-colors"
          >
            <ArrowLeft size={12} /> Back to Matchups
          </Link>
        </motion.div>

        {/* Teammate Notice */}
        {areTeammates && (
          <motion.div variants={fadeUp} className="mb-4">
            <div className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-accent-gold/[0.08] border border-accent-gold/20">
              <AlertTriangle size={14} className="text-accent-gold shrink-0" />
              <p className="text-xs text-[#6E6E73]">
                These players were teammates — showing games where they faced each other on different teams.
              </p>
            </div>
          </motion.div>
        )}

        {/* Hero */}
        <motion.div variants={fadeUp} className="mb-8">
          <MatchupHero
            player1={summary.player1}
            player2={summary.player2}
            p1Wins={summary.p1Wins}
            p2Wins={summary.p2Wins}
            totalGames={summary.totalGames}
            headToHeadRecord={summary.headToHeadRecord}
            p1Team={summary.lastMeeting?.p1Team ?? ''}
            p2Team={summary.lastMeeting?.p2Team ?? ''}
            recentGames={recentGames}
            p1PersonId={summary.p1PersonId}
            p2PersonId={summary.p2PersonId}
          />
        </motion.div>

        {/* Stat Comparison Bars */}
        <motion.div variants={fadeUp} className="mb-8">
          <SectionHeader
            title="Average Stats"
            eyebrow="Head to Head"
            className="mb-4"
          />
          <GlassCard className="p-4 sm:p-6">
            <div className="space-y-4">
              {STAT_BARS.map((bar, index) => (
                <MatchupStatBar
                  key={bar.key}
                  label={bar.label}
                  p1Value={getStatValue(p1Avgs, bar.key)}
                  p2Value={getStatValue(p2Avgs, bar.key)}
                  format={bar.format}
                  delay={index * 0.08}
                />
              ))}
            </div>
          </GlassCard>
        </motion.div>

        {/* Head-to-Head by Era */}
        {seasonRecords.length > 1 && (
          <motion.div variants={fadeUp} className="mb-8">
            <SectionHeader
              title="Head to Head by Era"
              eyebrow="Season Breakdown"
              className="mb-4"
            />
            <GlassCard className="p-4 sm:p-6">
              {/* Legend */}
              <div className="flex items-center gap-4 mb-5">
                <div className="flex items-center gap-1.5">
                  <div
                    className="w-3 h-3 rounded-sm"
                    style={{ backgroundColor: colors.accentOrange }}
                  />
                  <span className="text-[10px] text-[#86868B] font-medium">
                    {summary.player1.split(' ').pop()}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div
                    className="w-3 h-3 rounded-sm"
                    style={{ backgroundColor: colors.accentBlue }}
                  />
                  <span className="text-[10px] text-[#86868B] font-medium">
                    {summary.player2.split(' ').pop()}
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                {seasonRecords.map((record, index) => (
                  <EraBarRow
                    key={record.season}
                    record={record}
                    maxGames={maxGamesInSeason}
                    index={index}
                  />
                ))}
              </div>
            </GlassCard>
          </motion.div>
        )}

        {/* Game Log */}
        <motion.div variants={fadeUp} className="mb-8">
          <SectionHeader
            title={`Game Log (${totalGames})`}
            eyebrow="History"
            className="mb-4"
          />
          <GlassCard className="p-3 sm:p-4">
            <MatchupGameLog
              player1={summary.player1}
              player2={summary.player2}
              games={games}
              onLoadMore={handleLoadMore}
              hasMore={hasMoreGames}
            />
          </GlassCard>
        </motion.div>

        {/* Best Games */}
        {(summary.bestP1Game || summary.bestP2Game) && (
          <motion.div variants={fadeUp} className="mb-8">
            <SectionHeader
              title="Best Performances"
              eyebrow="Highlights"
              className="mb-4"
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Best P1 Game */}
              {summary.bestP1Game && (
                <GlassCard tintColor="#FF6B35" className="p-4 sm:p-5 bg-white border border-black/[0.06]">
                  <div className="flex items-center gap-2 mb-3">
                    <Trophy size={14} className="text-accent-gold" />
                    <span className="text-xs font-bold text-[#FF6B35] uppercase tracking-wider">
                      Best{' '}
                      {summary.player1.split(' ').pop()} Game
                    </span>
                  </div>
                  <p className="text-[10px] text-[#86868B] mb-1 flex items-center gap-1">
                    {formatGameDate(summary.bestP1Game.gameDate)} &middot;{' '}
                    <TeamLogo teamAbbr={summary.bestP1Game.p1Team} size="sm" />
                    {summary.bestP1Game.p1Team} vs{' '}
                    <TeamLogo teamAbbr={summary.bestP1Game.p2Team} size="sm" />
                    {summary.bestP1Game.p2Team}
                  </p>
                  <p className="text-xs font-bold text-[#1D1D1F] mb-2">
                    {summary.bestP1Game.p1Team} {summary.bestP1Game.p1Stats.pts + summary.bestP1Game.p1Stats.reb},{' '}
                    {summary.bestP1Game.p2Team} {summary.bestP1Game.p2Stats.pts + summary.bestP1Game.p2Stats.reb}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    <MetricChip
                      label="PTS"
                      value={summary.bestP1Game.p1Stats.pts}
                      highlight
                      size="sm"
                    />
                    <MetricChip
                      label="REB"
                      value={summary.bestP1Game.p1Stats.reb}
                      size="sm"
                    />
                    <MetricChip
                      label="AST"
                      value={summary.bestP1Game.p1Stats.ast}
                      size="sm"
                    />
                    <MetricChip
                      label="STL"
                      value={summary.bestP1Game.p1Stats.stl}
                      size="sm"
                    />
                    <MetricChip
                      label="BLK"
                      value={summary.bestP1Game.p1Stats.blk}
                      size="sm"
                    />
                  </div>
                  <p className="mt-2 text-[10px] text-[#86868B]">
                    {summary.bestP1Game.p1Won ? 'Won' : 'Lost'} &middot;{' '}
                    {formatGameStatLine(summary.bestP1Game, 'p2')} (
                    {summary.player2.split(' ').pop()})
                  </p>
                </GlassCard>
              )}

              {/* Best P2 Game */}
              {summary.bestP2Game && (
                <GlassCard tintColor="#4DA6FF" className="p-4 sm:p-5 bg-white border border-black/[0.06]">
                  <div className="flex items-center gap-2 mb-3">
                    <Trophy size={14} className="text-accent-gold" />
                    <span className="text-xs font-bold text-[#0071E3] uppercase tracking-wider">
                      Best{' '}
                      {summary.player2.split(' ').pop()} Game
                    </span>
                  </div>
                  <p className="text-[10px] text-[#86868B] mb-1 flex items-center gap-1">
                    {formatGameDate(summary.bestP2Game.gameDate)} &middot;{' '}
                    <TeamLogo teamAbbr={summary.bestP2Game.p1Team} size="sm" />
                    {summary.bestP2Game.p1Team} vs{' '}
                    <TeamLogo teamAbbr={summary.bestP2Game.p2Team} size="sm" />
                    {summary.bestP2Game.p2Team}
                  </p>
                  <p className="text-xs font-bold text-[#1D1D1F] mb-2">
                    {summary.bestP2Game.p1Team} {summary.bestP2Game.p1Stats.pts + summary.bestP2Game.p1Stats.reb},{' '}
                    {summary.bestP2Game.p2Team} {summary.bestP2Game.p2Stats.pts + summary.bestP2Game.p2Stats.reb}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    <MetricChip
                      label="PTS"
                      value={summary.bestP2Game.p2Stats.pts}
                      highlight
                      size="sm"
                    />
                    <MetricChip
                      label="REB"
                      value={summary.bestP2Game.p2Stats.reb}
                      size="sm"
                    />
                    <MetricChip
                      label="AST"
                      value={summary.bestP2Game.p2Stats.ast}
                      size="sm"
                    />
                    <MetricChip
                      label="STL"
                      value={summary.bestP2Game.p2Stats.stl}
                      size="sm"
                    />
                    <MetricChip
                      label="BLK"
                      value={summary.bestP2Game.p2Stats.blk}
                      size="sm"
                    />
                  </div>
                  <p className="mt-2 text-[10px] text-[#86868B]">
                    {summary.bestP2Game.p2Won ? 'Won' : 'Lost'} &middot;{' '}
                    {formatGameStatLine(summary.bestP2Game, 'p1')} (
                    {summary.player1.split(' ').pop()})
                  </p>
                </GlassCard>
              )}
            </div>
          </motion.div>
        )}

        {/* Top Rivals */}
        {(p1Rivals.length > 0 || p2Rivals.length > 0) && (
          <motion.div variants={fadeUp} className="mb-8">
            <SectionHeader
              title="Top Rivals"
              eyebrow="Frequent Opponents"
              className="mb-4"
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* P1 Rivals */}
              {p1Rivals.length > 0 && (
                <GlassCard className="p-4 sm:p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Users size={14} className="text-[#FF6B35]" />
                    <span className="text-xs font-bold text-[#FF6B35] uppercase tracking-wider">
                      {summary.player1.split(' ').pop()}&apos;s Rivals
                    </span>
                  </div>
                  <div className="space-y-2">
                    {p1Rivals.map((rival) => (
                      <Link
                        key={rival.rival}
                        href={`/matchup/${toMatchupSlug(summary.player1, rival.rival)}`}
                        className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl hover:bg-[#F5F5F7] transition-colors group"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <PlayerAvatar name={rival.rival} size="sm" />
                          <span className="text-xs text-[#1D1D1F] font-medium group-hover:text-[#FF6B35] transition-colors truncate">
                            {rival.rival}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge variant="default">
                            {rival.wins}W-{rival.losses}L
                          </Badge>
                          <span className="text-[10px] text-[#86868B]">
                            {rival.sharedGames}G
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                </GlassCard>
              )}

              {/* P2 Rivals */}
              {p2Rivals.length > 0 && (
                <GlassCard className="p-4 sm:p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Users size={14} className="text-[#0071E3]" />
                    <span className="text-xs font-bold text-[#0071E3] uppercase tracking-wider">
                      {summary.player2.split(' ').pop()}&apos;s Rivals
                    </span>
                  </div>
                  <div className="space-y-2">
                    {p2Rivals.map((rival) => (
                      <Link
                        key={rival.rival}
                        href={`/matchup/${toMatchupSlug(summary.player2, rival.rival)}`}
                        className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl hover:bg-[#F5F5F7] transition-colors group"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <PlayerAvatar name={rival.rival} size="sm" />
                          <span className="text-xs text-[#1D1D1F] font-medium group-hover:text-[#0071E3] transition-colors truncate">
                            {rival.rival}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge variant="default">
                            {rival.wins}W-{rival.losses}L
                          </Badge>
                          <span className="text-[10px] text-[#86868B]">
                            {rival.sharedGames}G
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                </GlassCard>
              )}
            </div>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
