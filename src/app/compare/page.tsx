'use client';

import { Suspense } from 'react';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  ArrowLeft,
  Search,
  Share2,
  Check,
  Swords,
} from 'lucide-react';
import GlassCard from '@/components/ui/GlassCard';
import SectionHeader from '@/components/ui/SectionHeader';
import SkeletonLoader from '@/components/ui/SkeletonLoader';
import Badge from '@/components/ui/Badge';
import PlayerAvatar from '@/components/ui/PlayerAvatar';
import BasketballCourt from '@/components/court/BasketballCourt';
import { useSeasonType } from '@/lib/season-context';

// ── Types ────────────────────────────────────────────────────────────────────

interface PlayerStats {
  readonly name: string;
  readonly season: string;
  readonly team?: string;
  readonly games: number;
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
}

interface ZoneStat {
  readonly zone: string;
  readonly area: string;
  readonly attempts: number;
  readonly makes: number;
  readonly fgPct: number;
}

interface CompareData {
  readonly player1: PlayerStats | null;
  readonly player2: PlayerStats | null;
  readonly zones1: readonly ZoneStat[];
  readonly zones2: readonly ZoneStat[];
}

interface SearchResult {
  readonly id: number;
  readonly name: string;
  readonly position: string;
  readonly active: number;
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

// ── Stat categories ──────────────────────────────────────────────────────────

const CATEGORIES = [
  { key: 'points', label: 'PPG', format: (v: number) => Number(v).toFixed(1), higherBetter: true },
  { key: 'rebounds', label: 'RPG', format: (v: number) => Number(v).toFixed(1), higherBetter: true },
  { key: 'assists', label: 'APG', format: (v: number) => Number(v).toFixed(1), higherBetter: true },
  { key: 'steals', label: 'SPG', format: (v: number) => Number(v).toFixed(1), higherBetter: true },
  { key: 'blocks', label: 'BPG', format: (v: number) => Number(v).toFixed(1), higherBetter: true },
  { key: 'fgPct', label: 'FG%', format: (v: number) => `${(Number(v) * 100).toFixed(1)}`, higherBetter: true },
  { key: 'fg3Pct', label: '3P%', format: (v: number) => `${(Number(v) * 100).toFixed(1)}`, higherBetter: true },
  { key: 'ftPct', label: 'FT%', format: (v: number) => `${(Number(v) * 100).toFixed(1)}`, higherBetter: true },
  { key: 'efgPct', label: 'EFG%', format: (v: number) => `${(Number(v) * 100).toFixed(1)}`, higherBetter: true },
] as const;

// ── Helper: zone color ───────────────────────────────────────────────────────

function zoneColor(fgPct: number): string {
  if (fgPct >= 55) return '#34D39940';
  if (fgPct >= 45) return '#FBBF2440';
  if (fgPct >= 35) return '#FF6B3540';
  return '#F8717140';
}

// ── Component ────────────────────────────────────────────────────────────────

function ComparePageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { seasonType } = useSeasonType();

  const p1Param = searchParams.get('p1') ?? '';
  const p2Param = searchParams.get('p2') ?? '';
  const seasonParam = searchParams.get('season') ?? '';

  // Player name state
  const [player1, setPlayer1] = useState(p1Param);
  const [player2, setPlayer2] = useState(p2Param);
  const [season, setSeason] = useState(seasonParam);

  // Data
  const [data, setData] = useState<CompareData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Search state for both inputs
  const [searchFocus, setSearchFocus] = useState<'p1' | 'p2' | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<readonly SearchResult[]>([]);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch comparison data
  useEffect(() => {
    if (!player1 || !player2) {
      setData(null);
      return;
    }

    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const url = new URL('/api/v2/compare', window.location.origin);
        url.searchParams.set('p1', player1);
        url.searchParams.set('p2', player2);
        url.searchParams.set('seasonType', seasonType);
        if (season) url.searchParams.set('season', season);

        const res = await fetch(url.toString());
        if (!res.ok) throw new Error('Failed to compare players');
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
  }, [player1, player2, season, seasonType]);

  // Update URL when players change
  useEffect(() => {
    const params = new URLSearchParams();
    if (player1) params.set('p1', player1);
    if (player2) params.set('p2', player2);
    if (season) params.set('season', season);
    const qs = params.toString();
    const newUrl = qs ? `/compare?${qs}` : '/compare';
    router.replace(newUrl, { scroll: false });
  }, [player1, player2, season, router]);

  // Debounced search
  const handleSearchInput = useCallback((value: string) => {
    setSearchQuery(value);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (value.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    searchTimeout.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/players/search?q=${encodeURIComponent(value)}&limit=6`);
        if (res.ok) {
          const json = await res.json();
          setSearchResults(json);
        }
      } catch { /* silent */ }
    }, 250);
  }, []);

  const selectPlayer = useCallback((name: string) => {
    if (searchFocus === 'p1') setPlayer1(name);
    else if (searchFocus === 'p2') setPlayer2(name);
    setSearchQuery('');
    setSearchResults([]);
    setSearchFocus(null);
  }, [searchFocus]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setSearchFocus(null);
        setSearchResults([]);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Copy share URL
  const handleShare = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* silent */ }
  }, []);

  // Compute winner counts
  const { p1Wins, p2Wins } = (() => {
    if (!data?.player1 || !data?.player2) return { p1Wins: 0, p2Wins: 0 };
    let w1 = 0;
    let w2 = 0;
    for (const cat of CATEGORIES) {
      const v1 = Number((data.player1 as unknown as Record<string, unknown>)[cat.key] ?? 0);
      const v2 = Number((data.player2 as unknown as Record<string, unknown>)[cat.key] ?? 0);
      if (cat.higherBetter ? v1 > v2 : v1 < v2) w1++;
      else if (cat.higherBetter ? v2 > v1 : v2 < v1) w2++;
    }
    return { p1Wins: w1, p2Wins: w2 };
  })();

  const winner = p1Wins > p2Wins ? data?.player1?.name : p2Wins > p1Wins ? data?.player2?.name : null;

  return (
    <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 pt-4 pb-8" ref={dropdownRef}>
      {/* Back link */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-4">
        <Link
          href="/explore"
          className="inline-flex items-center gap-1 text-xs text-text-tertiary hover:text-text-secondary transition-colors no-underline"
        >
          <ArrowLeft size={12} /> Explore
        </Link>
      </motion.div>

      <motion.div initial="hidden" animate="visible" variants={stagger}>
        <motion.div variants={fadeUp}>
          <SectionHeader title="Compare Studio" eyebrow="Head to Head" className="mb-6" />
        </motion.div>

        {/* ── Player Selectors ────────────────────────────────────────── */}
        <motion.div variants={fadeUp} className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          {/* Player 1 */}
          <div className="relative">
            <label className="text-[10px] uppercase tracking-wider text-chrome-dim font-medium mb-1 block">
              Player 1
            </label>
            <div className="group relative flex items-center rounded-full bg-glass-frosted backdrop-blur-xl border border-glass-border transition-all focus-within:border-accent-orange/40">
              <Search size={14} className="ml-3 shrink-0 text-chrome-dim" />
              <input
                type="text"
                aria-label="Search player 1"
                value={searchFocus === 'p1' ? searchQuery : player1}
                onChange={(e) => handleSearchInput(e.target.value)}
                onFocus={() => { setSearchFocus('p1'); setSearchQuery(player1); }}
                placeholder="Search player..."
                className="flex-1 bg-transparent px-2 py-2.5 text-sm text-chrome-light placeholder:text-chrome-dim outline-none"
              />
            </div>
            {searchFocus === 'p1' && searchResults.length > 0 && (
              <div className="absolute z-30 mt-1 w-full rounded-xl bg-dark-elevated/95 backdrop-blur-xl border border-glass-border shadow-[0_8px_40px_rgba(0,0,0,0.4)] overflow-hidden">
                {searchResults.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => selectPlayer(r.name)}
                    className="flex items-center gap-2 w-full px-3 py-2 hover:bg-glass-frosted transition-colors text-left"
                  >
                    <PlayerAvatar name={r.name} size="sm" />
                    <span className="text-sm text-chrome-light truncate">{r.name}</span>
                    <span className="text-[10px] text-chrome-dim ml-auto">{r.position}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Player 2 */}
          <div className="relative">
            <label className="text-[10px] uppercase tracking-wider text-chrome-dim font-medium mb-1 block">
              Player 2
            </label>
            <div className="group relative flex items-center rounded-full bg-glass-frosted backdrop-blur-xl border border-glass-border transition-all focus-within:border-accent-blue/40">
              <Search size={14} className="ml-3 shrink-0 text-chrome-dim" />
              <input
                type="text"
                aria-label="Search player 2"
                value={searchFocus === 'p2' ? searchQuery : player2}
                onChange={(e) => handleSearchInput(e.target.value)}
                onFocus={() => { setSearchFocus('p2'); setSearchQuery(player2); }}
                placeholder="Search player..."
                className="flex-1 bg-transparent px-2 py-2.5 text-sm text-chrome-light placeholder:text-chrome-dim outline-none"
              />
            </div>
            {searchFocus === 'p2' && searchResults.length > 0 && (
              <div className="absolute z-30 mt-1 w-full rounded-xl bg-dark-elevated/95 backdrop-blur-xl border border-glass-border shadow-[0_8px_40px_rgba(0,0,0,0.4)] overflow-hidden">
                {searchResults.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => selectPlayer(r.name)}
                    className="flex items-center gap-2 w-full px-3 py-2 hover:bg-glass-frosted transition-colors text-left"
                  >
                    <PlayerAvatar name={r.name} size="sm" />
                    <span className="text-sm text-chrome-light truncate">{r.name}</span>
                    <span className="text-[10px] text-chrome-dim ml-auto">{r.position}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </motion.div>

        {/* Season selector + Share */}
        <motion.div variants={fadeUp} className="flex items-center gap-3 mb-6">
          <div>
            <label className="text-[10px] uppercase tracking-wider text-chrome-dim font-medium mb-1 block">
              Season (optional)
            </label>
            <input
              type="text"
              aria-label="Season filter (optional)"
              value={season}
              onChange={(e) => setSeason(e.target.value)}
              placeholder="e.g. 2024-25 or leave blank for career"
              className="bg-glass-frosted backdrop-blur-xl border border-glass-border rounded-full px-3 py-2 text-xs text-chrome-light placeholder:text-chrome-dim outline-none focus:border-accent-orange/40 w-52"
            />
          </div>
          {data?.player1 && data?.player2 && (
            <button
              type="button"
              onClick={handleShare}
              className="mt-auto flex items-center gap-1.5 px-3 py-2 rounded-full bg-glass-bg border border-glass-border text-xs text-chrome-medium hover:text-chrome-light transition-colors"
            >
              {copied ? <Check size={12} className="text-accent-green" /> : <Share2 size={12} />}
              {copied ? 'Copied!' : 'Share'}
            </button>
          )}
        </motion.div>

        {/* ── Loading ─────────────────────────────────────────────────── */}
        {loading && (
          <div className="space-y-4">
            <SkeletonLoader height={80} rounded="xl" className="w-full" />
            <SkeletonLoader height={300} rounded="xl" className="w-full" />
          </div>
        )}

        {/* ── Error ───────────────────────────────────────────────────── */}
        {error && (
          <GlassCard className="p-6 text-center">
            <p className="text-sm text-accent-red">{error}</p>
          </GlassCard>
        )}

        {/* ── Empty state ─────────────────────────────────────────────── */}
        {!loading && !error && (!player1 || !player2) && (
          <GlassCard className="p-8 text-center">
            <Swords size={40} className="mx-auto mb-3 text-chrome-dim" />
            <h3 className="text-lg font-bold text-chrome-light mb-1">Select Two Players</h3>
            <p className="text-sm text-chrome-dim">
              Search and select two players above to see a head-to-head comparison.
            </p>
          </GlassCard>
        )}

        {/* ── Comparison Results ───────────────────────────────────────── */}
        {!loading && data?.player1 && data?.player2 && (
          <>
            {/* Head-to-head hero */}
            <motion.div variants={fadeUp} className="mb-8">
              <GlassCard className="p-6">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <PlayerAvatar name={data.player1.name} size="lg" />
                    <div className="min-w-0">
                      <Link
                        href={`/player/${encodeURIComponent(data.player1.name)}`}
                        className="text-lg sm:text-xl font-extrabold text-chrome-light hover:text-accent-orange transition-colors truncate block"
                      >
                        {data.player1.name}
                      </Link>
                      <p className="text-xs text-chrome-dim">
                        {data.player1.team ?? 'Career'} &middot; {data.player1.season}
                      </p>
                    </div>
                  </div>

                  <div className="shrink-0">
                    <div className="flex items-center justify-center w-14 h-14 rounded-full bg-glass-frosted border border-glass-border">
                      <span className="text-sm font-extrabold text-chrome-medium">VS</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 flex-1 min-w-0 justify-end text-right">
                    <div className="min-w-0">
                      <Link
                        href={`/player/${encodeURIComponent(data.player2.name)}`}
                        className="text-lg sm:text-xl font-extrabold text-chrome-light hover:text-accent-blue transition-colors truncate block"
                      >
                        {data.player2.name}
                      </Link>
                      <p className="text-xs text-chrome-dim">
                        {data.player2.team ?? 'Career'} &middot; {data.player2.season}
                      </p>
                    </div>
                    <PlayerAvatar name={data.player2.name} size="lg" />
                  </div>
                </div>
              </GlassCard>
            </motion.div>

            {/* Category scorecards */}
            <motion.div variants={fadeUp} className="mb-8">
              <SectionHeader title="Category Breakdown" eyebrow="Stats" className="mb-4" />
              <GlassCard className="p-4 sm:p-6">
                <div className="flex flex-col gap-3">
                  {CATEGORIES.map((cat, i) => {
                    const v1 = Number((data.player1 as unknown as Record<string, unknown>)[cat.key] ?? 0);
                    const v2 = Number((data.player2 as unknown as Record<string, unknown>)[cat.key] ?? 0);
                    const p1IsWinner = cat.higherBetter ? v1 > v2 : v1 < v2;
                    const p2IsWinner = cat.higherBetter ? v2 > v1 : v2 < v1;
                    const maxVal = Math.max(v1, v2, 0.001);

                    return (
                      <motion.div
                        key={cat.key}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.04 }}
                        className="grid grid-cols-[1fr_auto_1fr] gap-3 items-center"
                      >
                        {/* Player 1 bar */}
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-sm font-bold font-mono min-w-[42px] text-right ${
                              p1IsWinner ? 'text-accent-orange' : 'text-chrome-medium'
                            }`}
                          >
                            {cat.format(v1)}
                          </span>
                          <div className="flex-1 h-3 rounded-full bg-glass-bg overflow-hidden flex justify-end">
                            <motion.div
                              className="h-full rounded-full"
                              style={{
                                background: p1IsWinner
                                  ? 'linear-gradient(90deg, #FF6B35, #FBBF24)'
                                  : 'rgba(255,255,255,0.15)',
                              }}
                              initial={{ width: 0 }}
                              animate={{ width: `${(v1 / maxVal) * 100}%` }}
                              transition={{ duration: 0.6, delay: i * 0.04, ease: [0.4, 0, 0.2, 1] }}
                            />
                          </div>
                        </div>

                        {/* Category label */}
                        <span className="text-[10px] uppercase tracking-wider text-chrome-dim font-semibold text-center w-10">
                          {cat.label}
                        </span>

                        {/* Player 2 bar */}
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-3 rounded-full bg-glass-bg overflow-hidden">
                            <motion.div
                              className="h-full rounded-full"
                              style={{
                                background: p2IsWinner
                                  ? 'linear-gradient(90deg, #4DA6FF, #6366F1)'
                                  : 'rgba(255,255,255,0.15)',
                              }}
                              initial={{ width: 0 }}
                              animate={{ width: `${(v2 / maxVal) * 100}%` }}
                              transition={{ duration: 0.6, delay: i * 0.04, ease: [0.4, 0, 0.2, 1] }}
                            />
                          </div>
                          <span
                            className={`text-sm font-bold font-mono min-w-[42px] ${
                              p2IsWinner ? 'text-accent-blue' : 'text-chrome-medium'
                            }`}
                          >
                            {cat.format(v2)}
                          </span>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </GlassCard>
            </motion.div>

            {/* Verdict */}
            <motion.div variants={fadeUp} className="mb-8 text-center">
              <GlassCard className="p-5 inline-block">
                <div className="flex items-center gap-3">
                  <Swords size={18} className="text-accent-gold" />
                  {winner ? (
                    <span className="text-sm font-bold text-chrome-light">
                      Edge:{' '}
                      <span className={winner === data.player1?.name ? 'text-accent-orange' : 'text-accent-blue'}>
                        {winner}
                      </span>{' '}
                      <span className="text-chrome-dim font-normal">
                        ({Math.max(p1Wins, p2Wins)}&ndash;{Math.min(p1Wins, p2Wins)} categories)
                      </span>
                    </span>
                  ) : (
                    <span className="text-sm font-bold text-chrome-light">
                      Dead Even <span className="text-chrome-dim font-normal">({p1Wins}&ndash;{p2Wins})</span>
                    </span>
                  )}
                </div>
              </GlassCard>
            </motion.div>

            {/* Shot zone comparison */}
            {(data.zones1.length > 0 || data.zones2.length > 0) && (
              <motion.div variants={fadeUp} className="mb-8">
                <SectionHeader title="Shot Zone Comparison" eyebrow="Shooting" className="mb-4" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Player 1 court */}
                  <GlassCard className="p-4">
                    <p className="text-xs font-semibold text-accent-orange mb-3 text-center">
                      {data.player1.name}
                    </p>
                    <div className="flex justify-center mb-3">
                      <BasketballCourt
                        showZones
                        zoneColors={Object.fromEntries(
                          data.zones1.map((z) => [z.zone, zoneColor(z.fgPct)])
                        )}
                        className="w-full max-w-[220px]"
                      />
                    </div>
                    <div className="flex flex-wrap gap-2 justify-center">
                      {data.zones1.map((z) => (
                        <Badge key={`${z.zone}-${z.area}`} variant="default">
                          {z.zone}: {z.fgPct}%
                        </Badge>
                      ))}
                    </div>
                  </GlassCard>

                  {/* Player 2 court */}
                  <GlassCard className="p-4">
                    <p className="text-xs font-semibold text-accent-blue mb-3 text-center">
                      {data.player2.name}
                    </p>
                    <div className="flex justify-center mb-3">
                      <BasketballCourt
                        showZones
                        zoneColors={Object.fromEntries(
                          data.zones2.map((z) => [z.zone, zoneColor(z.fgPct)])
                        )}
                        className="w-full max-w-[220px]"
                      />
                    </div>
                    <div className="flex flex-wrap gap-2 justify-center">
                      {data.zones2.map((z) => (
                        <Badge key={`${z.zone}-${z.area}`} variant="default">
                          {z.zone}: {z.fgPct}%
                        </Badge>
                      ))}
                    </div>
                  </GlassCard>
                </div>
              </motion.div>
            )}
            {/* Cross-link to matchup */}
            <motion.div variants={fadeUp} className="mt-6">
              <Link
                href={`/matchup/${encodeURIComponent(data.player1.name.toLowerCase().replace(/['.]/g, '').replace(/\s+/g, '-'))}-vs-${encodeURIComponent(data.player2.name.toLowerCase().replace(/['.]/g, '').replace(/\s+/g, '-'))}`}
                className="block"
              >
                <GlassCard hoverable tintColor="#FF6B35" className="p-4 text-center">
                  <p className="text-sm font-semibold text-chrome-light">
                    See their actual games against each other &rarr;
                  </p>
                  <p className="text-xs text-chrome-dim mt-1">Head-to-head matchup breakdown</p>
                </GlassCard>
              </Link>
            </motion.div>
          </>
        )}
      </motion.div>
    </div>
  );
}

export default function ComparePage() {
  return (
    <Suspense>
      <ComparePageInner />
    </Suspense>
  );
}
