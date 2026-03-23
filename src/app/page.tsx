'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
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
} from 'lucide-react';
import Link from 'next/link';
import GlassCard from '@/components/ui/GlassCard';
import MetricChip from '@/components/ui/MetricChip';
import SectionHeader from '@/components/ui/SectionHeader';
import SkeletonLoader from '@/components/ui/SkeletonLoader';
import Badge from '@/components/ui/Badge';
import PlayerAvatar from '@/components/ui/PlayerAvatar';

// ── Types ────────────────────────────────────────────────────────────────────

interface TopScorer {
  readonly name: string;
  readonly team: string;
  readonly position: string;
  readonly points: number;
  readonly rebounds: number;
  readonly assists: number;
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
    color: '#4DA6FF',
  },
  {
    href: '/shot-lab',
    icon: Target,
    title: 'Shot Lab',
    description: 'Interactive shot charts with zone breakdowns and heat maps.',
    color: '#34D399',
  },
  {
    href: '/explore',
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

// ── Component ────────────────────────────────────────────────────────────────

export default function ExplorePage() {
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
    async function load() {
      try {
        const res = await fetch('/api/explore');
        if (!res.ok) throw new Error('Failed to load explore data');
        const json = await res.json();
        if (!cancelled) {
          setData(json);
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
  }, []);

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
          <h2 className="text-lg font-bold text-chrome-light mb-2">Something went wrong</h2>
          <p className="text-sm text-chrome-dim">{error}</p>
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
            <Badge variant="accent" className="mb-4">
              <Database size={10} className="mr-1" />
              {data.edition.playerCount.toLocaleString()} players &middot;{' '}
              {data.edition.shotCount.toLocaleString()} shots &middot;{' '}
              {data.edition.earliestSeason}&ndash;{data.edition.latestSeason}
            </Badge>
          )}
        </motion.div>

        <motion.h1
          variants={fadeSlideUp}
          className="text-3xl sm:text-5xl font-extrabold tracking-tight leading-tight font-display mb-3"
        >
          <span
            className="bg-clip-text text-transparent"
            style={{
              backgroundImage: 'linear-gradient(135deg, #FF6B35, #FBBF24)',
            }}
          >
            Basketball Intelligence
          </span>
          <br />
          <span className="text-chrome-light">Playground</span>
        </motion.h1>

        <motion.p
          variants={fadeSlideUp}
          className="text-sm sm:text-base text-chrome-medium max-w-xl mx-auto leading-relaxed"
        >
          The most beautiful way to explore how basketball players and teams actually play.
        </motion.p>

        {/* Search bar */}
        <motion.div
          variants={fadeSlideUp}
          className="mt-8 max-w-lg mx-auto relative"
          ref={searchRef}
        >
          <div className="group relative flex items-center rounded-full bg-glass-frosted backdrop-blur-xl border border-glass-border transition-all duration-200 focus-within:border-accent-orange/40 focus-within:shadow-[0_0_16px_rgba(255,107,53,0.12)]">
            <Search
              size={16}
              className="ml-4 shrink-0 text-chrome-dim transition-colors group-focus-within:text-accent-orange"
            />
            <input
              type="text"
              aria-label="Search players, teams, or stats"
              value={query}
              onChange={(e) => handleSearch(e.target.value)}
              onFocus={() => { if (results.length > 0) setSearchOpen(true); }}
              placeholder="Search players, teams, stats..."
              className="flex-1 bg-transparent px-3 py-3 sm:py-3.5 text-sm text-chrome-light placeholder:text-chrome-dim outline-none"
            />
          </div>

          {/* Search results dropdown */}
          {searchOpen && results.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="absolute z-30 mt-2 w-full rounded-2xl bg-dark-elevated/95 backdrop-blur-xl border border-glass-border shadow-[0_8px_40px_rgba(0,0,0,0.4)] overflow-hidden"
            >
              {results.map((r) => (
                <Link
                  key={r.id}
                  href={`/player/${encodeURIComponent(r.name)}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-glass-frosted transition-colors"
                  onClick={() => setSearchOpen(false)}
                >
                  <PlayerAvatar name={r.name} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-chrome-light truncate">{r.name}</p>
                    <p className="text-xs text-chrome-dim">{r.position}</p>
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

      {/* ── Top Scorers Carousel ──────────────────────────────────────── */}
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
              <Link href="/explore" className="text-xs text-accent-orange flex items-center gap-0.5 hover:underline">
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
                  <Link href={`/player/${encodeURIComponent(player.name)}`}>
                    <GlassCard hoverable className="w-[180px] p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <PlayerAvatar name={player.name} size="sm" />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-chrome-light truncate">
                            {player.name}
                          </p>
                          <p className="text-[10px] text-chrome-dim uppercase tracking-wide">
                            {player.team} &middot; {player.position}
                          </p>
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
                {data?.allTimeScorers.slice(0, 10).map((leader) => (
                  <motion.div key={leader.name} variants={fadeSlideUp}>
                    <Link
                      href={`/player/${encodeURIComponent(leader.name)}`}
                      className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-glass-frosted transition-colors"
                    >
                      <span className="w-7 text-right text-sm font-bold text-chrome-dim font-mono">
                        {leader.rank}
                      </span>
                      <PlayerAvatar name={leader.name} size="sm" />
                      <span className="flex-1 text-sm font-medium text-chrome-light truncate">
                        {leader.name}
                      </span>
                      <div className="flex items-center gap-2">
                        {leader.hof === 1 && (
                          <Trophy size={12} className="text-accent-gold" />
                        )}
                        {leader.active === 1 && (
                          <Badge variant="success" className="text-[9px]">Active</Badge>
                        )}
                        <span className="text-sm font-bold text-chrome-light font-mono">
                          {Number(leader.value).toLocaleString()}
                        </span>
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </div>
            )}
          </GlassCard>
        </motion.section>

        {/* Standings */}
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
                <Link href="/explore" className="text-xs text-accent-orange flex items-center gap-0.5 hover:underline">
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
                      <span className="w-4 text-right font-bold text-chrome-dim">{i + 1}</span>
                      <span className="flex-1 text-chrome-light truncate">{t.team}</span>
                      <span className="text-chrome-medium font-mono">
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
                      <span className="w-4 text-right font-bold text-chrome-dim">{i + 1}</span>
                      <span className="flex-1 text-chrome-light truncate">{t.team}</span>
                      <span className="text-chrome-medium font-mono">
                        {t.wins}-{t.losses}
                      </span>
                    </motion.div>
                  ))}
                </div>
              )}
            </GlassCard>
          </div>
        </motion.section>
      </div>

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
              <motion.div key={link.href} variants={fadeSlideUp}>
                <Link href={link.href}>
                  <GlassCard
                    hoverable
                    tintColor={link.color}
                    className="p-5 h-full"
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className="flex items-center justify-center h-10 w-10 rounded-xl shrink-0"
                        style={{ background: `${link.color}18` }}
                      >
                        <Icon size={20} style={{ color: link.color }} />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-sm font-bold text-chrome-light mb-1">
                          {link.title}
                        </h3>
                        <p className="text-xs text-chrome-dim leading-relaxed">
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
        className="text-center py-6 border-t border-glass-border"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ delay: 0.2 }}
      >
        <div className="flex items-center justify-center gap-2 text-xs text-chrome-dim">
          <TrendingUp size={12} />
          <span>
            Basketball Intelligence &middot; Data Edition: {data?.edition?.edition ?? '...'} &middot; Updated {data?.edition?.lastUpdated ?? '...'}
          </span>
        </div>
      </motion.footer>
    </div>
  );
}
