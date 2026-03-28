'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  FlaskConical,
  GitCompareArrows,
  Target,
  Shield,
  BookOpen,
  Gamepad2,
  ChevronRight,
  Trophy,
  TrendingUp,
  Database,
  Flame,
  Swords,
  Film,
} from 'lucide-react';
import Link from 'next/link';
import GlassCard from '@/components/ui/GlassCard';
import MetricChip from '@/components/ui/MetricChip';
import SectionHeader from '@/components/ui/SectionHeader';
import SkeletonLoader from '@/components/ui/SkeletonLoader';
import Badge from '@/components/ui/Badge';
import PlayerAvatar from '@/components/ui/PlayerAvatar';
import TeamLogo from '@/components/ui/TeamLogo';
import PlayoffBracket from '@/components/ui/PlayoffBracket';
import { useSeasonType } from '@/lib/season-context';
import { NBA_TEAM_IDS } from '@/lib/nba-assets';

// ── Types ────────────────────────────────────────────────────────────────────

interface TopScorer {
  readonly name: string;
  readonly team: string;
  readonly position: string;
  readonly points: number;
  readonly rebounds: number;
  readonly assists: number;
  readonly personId?: number;
}

interface CareerLeader {
  readonly rank: number;
  readonly name: string;
  readonly value: number;
  readonly hof: number;
  readonly active: number;
}

interface StandingTeam {
  readonly conference: string;
  readonly rank: number;
  readonly team: string;
  readonly wins: number;
  readonly losses: number;
  readonly pct: number;
  readonly teamId?: number;
}

interface DataEdition {
  readonly shotCount: number;
  readonly playerCount: number;
  readonly earliestSeason: string;
  readonly latestSeason: string;
  readonly edition: string;
  readonly lastUpdated: string;
}

interface SearchResult {
  readonly id: number;
  readonly name: string;
  readonly position: string;
  readonly active: number;
  readonly personId?: number;
}

interface ExploreData {
  readonly topScorers: readonly TopScorer[];
  readonly allTimeScorers: readonly CareerLeader[];
  readonly standings: readonly StandingTeam[];
  readonly edition: DataEdition;
}

// ── Quick link definitions ───────────────────────────────────────────────────

const QUICK_LINKS = [
  {
    href: '/explore',
    icon: FlaskConical,
    title: 'Player Lab',
    description: 'Deep-dive into any player\'s stats, shot charts, and career trends.',
    color: '#FF6B35',
  },
  {
    href: '/compare',
    icon: GitCompareArrows,
    title: 'Compare Studio',
    description: 'Head-to-head comparison of any two players across every stat.',
    color: '#0071E3',
  },
  {
    href: '/shot-lab',
    icon: Target,
    title: 'Shot Lab',
    description: 'Interactive shot charts with zone breakdowns and heat maps.',
    color: '#34D399',
  },
  {
    href: '/team/LAL',
    icon: Shield,
    title: 'Team DNA',
    description: 'Team stats, rosters, advanced metrics, and game logs.',
    color: '#A78BFA',
  },
  {
    href: '/stories',
    icon: BookOpen,
    title: 'Stories',
    description: 'Auto-generated narratives about players, seasons, and rivalries.',
    color: '#FBBF24',
  },
  {
    href: '/zones',
    icon: Flame,
    title: 'Hot Zones',
    description: 'Hexbin heatmaps and zone-by-zone shooting efficiency for every player.',
    color: '#ef4444',
  },
  {
    href: '/matchup',
    icon: Swords,
    title: 'Head-to-Head',
    description: 'Compare how any two players performed in their actual games against each other.',
    color: '#F87171',
  },
  {
    href: '/film',
    icon: Film,
    title: 'Film Room',
    description: 'Video clip analysis with AI tagging, event detection, and play-by-play alignment.',
    color: '#60a5fa',
  },
  {
    href: '/play',
    icon: Gamepad2,
    title: 'Play Mode',
    description: 'Test your basketball IQ with stat-based quizzes and challenges.',
    color: '#F87171',
  },
] as const;

// ── Animation variants ───────────────────────────────────────────────────────

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.04 } },
};

const fadeSlideUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.4, 0, 0.2, 1] as const } },
};

// ── Helper to resolve team abbreviation to team ID ──────────────────────────

function teamAbbrToId(abbr: string): number | undefined {
  return NBA_TEAM_IDS[abbr.toUpperCase()];
}

// ── Component ────────────────────────────────────────────────────────────────

export default function ExplorePage() {
  const { seasonType } = useSeasonType();
  const [data, setData] = useState<ExploreData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search state
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<readonly SearchResult[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  // Fetch explore data
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    async function load() {
      try {
        const res = await fetch(`/api/v2/explore?seasonType=${seasonType}`);
        if (!res.ok) throw new Error('Failed to load explore data');
        const json = await res.json();
        if (!cancelled) {
          setData({
            topScorers: json.topScorers.data,
            allTimeScorers: json.careerLeaders,
            standings: json.standings.data,
            edition: json.dataEdition,
          });
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unknown error');
          setLoading(false);
        }
      }
    }
    load();
    return () => { cancelled = true; };
  }, [seasonType]);

  // Debounced player search
  const handleSearch = useCallback((value: string) => {
    setQuery(value);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (value.trim().length < 2) {
      setResults([]);
      setSearchOpen(false);
      return;
    }
    searchTimeout.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/players/search?q=${encodeURIComponent(value)}&limit=8`);
        if (res.ok) {
          const json = await res.json();
          setResults(json);
          setSearchOpen(true);
        }
      } catch {
        // silently fail search
      }
    }, 250);
  }, []);

  // Close search on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // ── Error state ──────────────────────────────────────────────────────────

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-6">
        <GlassCard className="p-8 text-center max-w-md">
          <Database size={40} className="mx-auto mb-4 text-accent-red" />
          <h2 className="text-lg font-bold text-text-primary mb-2">Something went wrong</h2>
          <p className="text-sm text-text-secondary">{error}</p>
        </GlassCard>
      </div>
    );
  }

  // ── Derived data ─────────────────────────────────────────────────────────

  const eastTeams = data?.standings
    .filter((t) => t.conference === 'East')
    .slice(0, 5) ?? [];
  const westTeams = data?.standings
    .filter((t) => t.conference === 'West')
    .slice(0, 5) ?? [];

  return (
    <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 pb-8">
      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <motion.section
        className="pt-10 sm:pt-16 pb-8 text-center"
        initial="hidden"
        animate="visible"
        variants={stagger}
      >
        <motion.div variants={fadeSlideUp}>
          {data?.edition && (
            <Badge variant="default" className="mb-4">
              <Database size={10} className="mr-1" />
              {data.edition.playerCount.toLocaleString()} players &middot;{' '}
              {data.edition.shotCount.toLocaleString()} shots &middot;{' '}
              {data.edition.earliestSeason}&ndash;{data.edition.latestSeason}
            </Badge>
          )}
        </motion.div>

        <motion.h1
          variants={fadeSlideUp}
          className="text-4xl sm:text-6xl font-extrabold tracking-tight leading-tight font-display mb-3 text-text-primary"
        >
          Basketball Intelligence
          <br />
          <span className="text-text-secondary font-bold">Playground</span>
        </motion.h1>

        <motion.p
          variants={fadeSlideUp}
          className="text-sm sm:text-base text-text-secondary max-w-xl mx-auto leading-relaxed"
        >
          The most beautiful way to explore how basketball players and teams actually play.
        </motion.p>

        {/* Search bar */}
        <motion.div
          variants={fadeSlideUp}
          className="mt-8 max-w-lg mx-auto relative"
          ref={searchRef}
        >
          <div className="group relative flex items-center rounded-full bg-white border border-black/[0.12] transition-all duration-200 focus-within:border-accent-blue/40 focus-within:shadow-[0_0_0_3px_rgba(0,113,227,0.1)]">
            <Search
              size={16}
              className="ml-4 shrink-0 text-text-tertiary transition-colors group-focus-within:text-accent-blue"
            />
            <input
              type="text"
              aria-label="Search players, teams, or stats"
              value={query}
              onChange={(e) => handleSearch(e.target.value)}
              onFocus={() => { if (results.length > 0) setSearchOpen(true); }}
              placeholder="Search players, teams, stats..."
              className="flex-1 bg-transparent px-3 py-3 sm:py-3.5 text-sm text-text-primary placeholder:text-text-tertiary outline-none"
            />
          </div>

          {/* Search results dropdown */}
          {searchOpen && results.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="absolute z-30 mt-2 w-full rounded-2xl bg-white border border-black/[0.08] shadow-[0_8px_40px_rgba(0,0,0,0.12)] overflow-hidden"
            >
              {results.map((r) => (
                <Link
                  key={r.id}
                  href={`/player/${encodeURIComponent(r.name)}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-bg-secondary transition-colors no-underline"
                  onClick={() => setSearchOpen(false)}
                >
                  <PlayerAvatar name={r.name} playerId={r.personId} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary truncate">{r.name}</p>
                    <p className="text-xs text-text-tertiary">{r.position}</p>
                  </div>
                  {r.active === 1 && (
                    <Badge variant="success" className="text-[9px]">Active</Badge>
                  )}
                </Link>
              ))}
            </motion.div>
          )}
        </motion.div>
      </motion.section>

      {/* ── Featured Rivalry — storytelling hero ──────────────────────── */}
      {!loading && data && data.topScorers.length >= 2 && (
        <motion.section
          className="mb-10"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-40px' }}
          variants={stagger}
        >
          <motion.div variants={fadeSlideUp}>
            <Link href={`/matchup/${encodeURIComponent(data.topScorers[0].name.toLowerCase().replace(/\s+/g, '-'))}-vs-${encodeURIComponent(data.topScorers[1].name.toLowerCase().replace(/\s+/g, '-'))}`} className="no-underline">
              <GlassCard hoverable className="p-6 overflow-hidden relative">
                <div className="absolute top-3 left-4">
                  <Badge variant="default" className="text-[9px]">
                    <Swords size={9} className="mr-1" /> Featured Rivalry
                  </Badge>
                </div>
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 mt-6">
                  {/* Player 1 */}
                  <div className="flex flex-col items-center text-center gap-2">
                    <PlayerAvatar name={data.topScorers[0].name} playerId={data.topScorers[0].personId} size="xl" />
                    <div>
                      <p className="text-sm sm:text-base font-bold text-text-primary font-display">{data.topScorers[0].name}</p>
                      <div className="flex items-center justify-center gap-1.5 mt-0.5">
                        <TeamLogo teamAbbr={data.topScorers[0].team} size="sm" />
                        <p className="text-[11px] text-text-secondary">{data.topScorers[0].team} &middot; {data.topScorers[0].position}</p>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-1">
                      <MetricChip label="PPG" value={Number(data.topScorers[0].points).toFixed(1)} highlight size="sm" />
                      <MetricChip label="RPG" value={Number(data.topScorers[0].rebounds).toFixed(1)} size="sm" />
                      <MetricChip label="APG" value={Number(data.topScorers[0].assists).toFixed(1)} size="sm" />
                    </div>
                  </div>

                  {/* VS badge */}
                  <div className="flex flex-col items-center gap-1">
                    <div className="h-10 w-10 rounded-full bg-accent-orange/10 flex items-center justify-center">
                      <span className="text-sm font-extrabold text-accent-orange">VS</span>
                    </div>
                    <span className="text-[9px] text-text-tertiary uppercase tracking-widest">Head to Head</span>
                  </div>

                  {/* Player 2 */}
                  <div className="flex flex-col items-center text-center gap-2">
                    <PlayerAvatar name={data.topScorers[1].name} playerId={data.topScorers[1].personId} size="xl" />
                    <div>
                      <p className="text-sm sm:text-base font-bold text-text-primary font-display">{data.topScorers[1].name}</p>
                      <div className="flex items-center justify-center gap-1.5 mt-0.5">
                        <TeamLogo teamAbbr={data.topScorers[1].team} size="sm" />
                        <p className="text-[11px] text-text-secondary">{data.topScorers[1].team} &middot; {data.topScorers[1].position}</p>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-1">
                      <MetricChip label="PPG" value={Number(data.topScorers[1].points).toFixed(1)} highlight size="sm" />
                      <MetricChip label="RPG" value={Number(data.topScorers[1].rebounds).toFixed(1)} size="sm" />
                      <MetricChip label="APG" value={Number(data.topScorers[1].assists).toFixed(1)} size="sm" />
                    </div>
                  </div>
                </div>
                {/* Narrative callout */}
                <p className="text-center text-xs text-text-secondary mt-4 italic">
                  {Number(data.topScorers[0].points) > Number(data.topScorers[1].points)
                    ? `${data.topScorers[0].name.split(' ').pop()} leads by ${(Number(data.topScorers[0].points) - Number(data.topScorers[1].points)).toFixed(1)} PPG this season`
                    : `Separated by just ${Math.abs(Number(data.topScorers[0].points) - Number(data.topScorers[1].points)).toFixed(1)} PPG this season`}
                  {' — tap to see their full head-to-head history'}
                </p>
              </GlassCard>
            </Link>
          </motion.div>
        </motion.section>
      )}

      {/* ── Top Scorers Carousel ──────────────────────────────────────── */}
      <AnimatePresence mode="wait">
      <motion.div key={seasonType} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
      <motion.section
        className="mb-10"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-40px' }}
        variants={stagger}
      >
        <motion.div variants={fadeSlideUp}>
          <SectionHeader
            title="Top Scorers"
            eyebrow="Current Season"
            action={
              <Link href="/explore" className="text-xs text-accent-blue flex items-center gap-0.5 hover:underline no-underline">
                See all <ChevronRight size={12} />
              </Link>
            }
            className="mb-4"
          />
        </motion.div>

        <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
          {loading
            ? Array.from({ length: 6 }, (_, i) => (
                <div key={i} className="shrink-0 w-[180px]">
                  <SkeletonLoader height={160} rounded="xl" className="w-full" />
                </div>
              ))
            : data?.topScorers.map((player, i) => (
                <motion.div
                  key={player.name}
                  variants={fadeSlideUp}
                  className="shrink-0"
                >
                  <Link href={`/player/${encodeURIComponent(player.name)}`} className="no-underline">
                    <GlassCard hoverable className="w-[180px] p-4">
                      {/* Rank badge */}
                      {i < 3 && (
                        <div className="flex items-center gap-1 mb-2">
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                            i === 0 ? 'bg-accent-gold/15 text-accent-gold' :
                            i === 1 ? 'bg-[#C0C0C0]/15 text-[#8E8E93]' :
                            'bg-accent-orange/10 text-accent-orange'
                          }`}>
                            #{i + 1}
                          </span>
                          {i === 0 && <Flame size={10} className="text-accent-gold" />}
                        </div>
                      )}
                      <div className="flex items-center gap-2 mb-3">
                        <PlayerAvatar name={player.name} playerId={player.personId} size="sm" />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-text-primary truncate">
                            {player.name}
                          </p>
                          <div className="flex items-center gap-1">
                            <TeamLogo teamAbbr={player.team} size="sm" />
                            <p className="text-[10px] text-text-tertiary uppercase tracking-wide">
                              {player.team} &middot; {player.position}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-1">
                        <MetricChip
                          label="PPG"
                          value={Number(player.points).toFixed(1)}
                          highlight={i === 0}
                          size="sm"
                        />
                        <MetricChip label="RPG" value={Number(player.rebounds).toFixed(1)} size="sm" />
                        <MetricChip label="APG" value={Number(player.assists).toFixed(1)} size="sm" />
                      </div>
                    </GlassCard>
                  </Link>
                </motion.div>
              ))}
        </div>
      </motion.section>

      {/* ── All-Time Leaders + Standings ──────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
        {/* All-Time Leaders */}
        <motion.section
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-40px' }}
          variants={stagger}
        >
          <motion.div variants={fadeSlideUp}>
            <SectionHeader
              title="All-Time Scoring Leaders"
              eyebrow="Career"
              className="mb-4"
            />
          </motion.div>
          <GlassCard className="p-4">
            {loading ? (
              <div className="flex flex-col gap-3">
                <SkeletonLoader height={32} count={5} rounded="md" className="w-full" />
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                {data?.allTimeScorers.slice(0, 10).map((leader, i) => {
                  const maxVal = data.allTimeScorers[0]?.value ?? 1;
                  const pct = (Number(leader.value) / Number(maxVal)) * 100;
                  return (
                    <motion.div key={leader.name} variants={fadeSlideUp}>
                      <Link
                        href={`/player/${encodeURIComponent(leader.name)}`}
                        className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-bg-secondary transition-colors no-underline relative overflow-hidden"
                      >
                        {/* Visual ranking bar background */}
                        <div
                          className="absolute inset-y-0 left-0 rounded-xl opacity-[0.04]"
                          style={{ width: `${pct}%`, background: i === 0 ? '#FF6B35' : '#0071E3' }}
                        />
                        <span className="relative w-7 text-right text-sm font-bold text-text-tertiary font-mono">
                          {leader.rank}
                        </span>
                        <div className="relative"><PlayerAvatar name={leader.name} size="sm" /></div>
                        <span className="relative flex-1 text-sm font-medium text-text-primary truncate">
                          {leader.name}
                        </span>
                        <div className="relative flex items-center gap-2">
                          {leader.hof === 1 && (
                            <Trophy size={12} className="text-accent-gold" />
                          )}
                          {leader.active === 1 && (
                            <Badge variant="success" className="text-[9px]">Active</Badge>
                          )}
                          <span className="text-sm font-bold text-text-primary font-mono">
                            {Number(leader.value).toLocaleString()}
                          </span>
                        </div>
                      </Link>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </GlassCard>
        </motion.section>

        {/* Standings / Playoff Bracket */}
        {seasonType === 'playoffs' ? (
          <motion.section
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-40px' }}
            variants={stagger}
          >
            <motion.div variants={fadeSlideUp}>
              <SectionHeader
                title="Playoff Bracket"
                eyebrow="Postseason"
                className="mb-4"
              />
            </motion.div>
            <motion.div variants={fadeSlideUp}>
              <PlayoffBracket />
            </motion.div>
          </motion.section>
        ) : (
          <motion.section
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-40px' }}
            variants={stagger}
          >
            <motion.div variants={fadeSlideUp}>
              <SectionHeader
                title="Standings"
                eyebrow="Current Season"
                action={
                  <Link href="/explore" className="text-xs text-accent-blue flex items-center gap-0.5 hover:underline no-underline">
                    Full standings <ChevronRight size={12} />
                  </Link>
                }
                className="mb-4"
              />
            </motion.div>
            <div className="grid grid-cols-2 gap-3">
              {/* East */}
              <GlassCard className="p-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-accent-blue mb-3">
                  Eastern
                </h3>
                {loading ? (
                  <div className="flex flex-col gap-2">
                    <SkeletonLoader height={24} count={5} rounded="sm" className="w-full" />
                  </div>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {eastTeams.map((t, i) => (
                      <motion.div
                        key={t.team}
                        variants={fadeSlideUp}
                        className="flex items-center gap-2 text-xs"
                      >
                        <span className="w-4 text-right font-bold text-text-tertiary">{i + 1}</span>
                        <TeamLogo teamAbbr={t.team} size="sm" />
                        <span className="flex-1 text-text-primary truncate">{t.team}</span>
                        <span className="text-text-secondary font-mono">
                          {t.wins}-{t.losses}
                        </span>
                      </motion.div>
                    ))}
                  </div>
                )}
              </GlassCard>

              {/* West */}
              <GlassCard className="p-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-accent-orange mb-3">
                  Western
                </h3>
                {loading ? (
                  <div className="flex flex-col gap-2">
                    <SkeletonLoader height={24} count={5} rounded="sm" className="w-full" />
                  </div>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {westTeams.map((t, i) => (
                      <motion.div
                        key={t.team}
                        variants={fadeSlideUp}
                        className="flex items-center gap-2 text-xs"
                      >
                        <span className="w-4 text-right font-bold text-text-tertiary">{i + 1}</span>
                        <TeamLogo teamAbbr={t.team} size="sm" />
                        <span className="flex-1 text-text-primary truncate">{t.team}</span>
                        <span className="text-text-secondary font-mono">
                          {t.wins}-{t.losses}
                        </span>
                      </motion.div>
                    ))}
                  </div>
                )}
              </GlassCard>
            </div>
          </motion.section>
        )}
      </div>
      </motion.div>
      </AnimatePresence>

      {/* ── Quick Links Grid ──────────────────────────────────────────── */}
      <motion.section
        className="mb-10"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-40px' }}
        variants={stagger}
      >
        <motion.div variants={fadeSlideUp}>
          <SectionHeader title="Explore" eyebrow="Surfaces" className="mb-4" />
        </motion.div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {QUICK_LINKS.map((link) => {
            const Icon = link.icon;
            return (
              <motion.div key={link.title} variants={fadeSlideUp}>
                <Link href={link.href} className="no-underline">
                  <GlassCard
                    hoverable
                    tintColor={link.color}
                    className="p-5 h-full"
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className="flex items-center justify-center h-10 w-10 rounded-xl shrink-0"
                        style={{ background: `${link.color}12` }}
                      >
                        <Icon size={20} style={{ color: link.color }} />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-sm font-bold text-text-primary mb-1">
                          {link.title}
                        </h3>
                        <p className="text-xs text-text-secondary leading-relaxed">
                          {link.description}
                        </p>
                      </div>
                    </div>
                  </GlassCard>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </motion.section>

      {/* ── Footer ────────────────────────────────────────────────────── */}
      <motion.footer
        className="text-center py-6 border-t border-black/[0.06]"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ delay: 0.2 }}
      >
        <div className="flex items-center justify-center gap-2 text-xs text-text-tertiary">
          <TrendingUp size={12} />
          <span>
            Basketball Intelligence &middot; Data Edition: {data?.edition?.edition ?? '...'} &middot; Updated {data?.edition?.lastUpdated ?? '...'}
          </span>
        </div>
      </motion.footer>
    </div>
  );
}
