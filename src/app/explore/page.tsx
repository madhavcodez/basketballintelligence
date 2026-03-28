'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Users,
  Shield,
  Star,
  X,
  ChevronRight,
  SlidersHorizontal,
} from 'lucide-react';
import Link from 'next/link';
import GlassCard from '@/components/ui/GlassCard';
import PlayerAvatar from '@/components/ui/PlayerAvatar';
import TeamLogo from '@/components/ui/TeamLogo';
import Badge from '@/components/ui/Badge';
import SectionHeader from '@/components/ui/SectionHeader';
import SkeletonLoader from '@/components/ui/SkeletonLoader';

// ── Types ────────────────────────────────────────────────────────────────────

interface FeaturedPlayer {
  readonly name: string;
  readonly position: string;
  readonly team: string;
  readonly season: number | string;
  readonly points?: number;
  readonly rebounds?: number;
  readonly assists?: number;
  readonly personId?: number;
}

interface SearchResult {
  readonly id: number;
  readonly name: string;
  readonly position: string;
  readonly active: number;
  readonly personId?: number;
}

interface Team {
  readonly abbreviation: string;
  readonly full_name: string;
  readonly city: string;
  readonly nickname: string;
  readonly conference?: string;
  readonly division?: string;
  readonly teamId?: number;
}

interface ExploreData {
  readonly featured: readonly FeaturedPlayer[];
  readonly topScorers: readonly FeaturedPlayer[];
  readonly edition: {
    readonly playerCount: number;
    readonly shotCount: number;
    readonly earliestSeason: string;
    readonly latestSeason: string;
  };
}

// ── Animation variants ───────────────────────────────────────────────────────

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.05 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.4, 0, 0.2, 1] as const } },
};

const POSITIONS = ['All', 'PG', 'SG', 'SF', 'PF', 'C'] as const;
type PositionFilter = (typeof POSITIONS)[number];

// ── Component ────────────────────────────────────────────────────────────────

export default function ExplorePage() {
  const [exploreData, setExploreData] = useState<ExploreData | null>(null);
  const [teams, setTeams] = useState<readonly Team[]>([]);
  const [loading, setLoading] = useState(true);

  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<readonly SearchResult[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [positionFilter, setPositionFilter] = useState<PositionFilter>('All');
  const [activeTab, setActiveTab] = useState<'players' | 'teams'>('players');

  const searchRef = useRef<HTMLDivElement>(null);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch data
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch('/api/explore').then((r) => r.json()).catch(() => null),
      fetch('/api/teams').then((r) => r.json()).catch(() => []),
    ]).then(([explore, teamsData]) => {
      if (!cancelled) {
        if (explore) setExploreData(explore);
        if (Array.isArray(teamsData)) setTeams(teamsData);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, []);

  // Debounced search
  const handleSearch = useCallback((value: string) => {
    setQuery(value);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (value.trim().length < 2) {
      setSearchResults([]);
      setSearchOpen(false);
      return;
    }
    searchTimeout.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/players/search?q=${encodeURIComponent(value)}&limit=10`);
        if (res.ok) {
          const json = await res.json();
          setSearchResults(json);
          setSearchOpen(true);
        }
      } catch { /* silent */ }
    }, 250);
  }, []);

  // Close search dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Filtered featured players
  const featuredPlayers = exploreData?.featured ?? [];
  const filteredPlayers = positionFilter === 'All'
    ? featuredPlayers
    : featuredPlayers.filter((p) => p.position === positionFilter);

  return (
    <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 pb-12">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <motion.div
        className="pt-10 sm:pt-14 pb-6"
        initial="hidden"
        animate="visible"
        variants={stagger}
      >
        <motion.div variants={fadeUp} className="mb-1">
          <Badge variant="default">
            <Star size={10} className="mr-1" />
            Browse All
          </Badge>
        </motion.div>
        <motion.h1
          variants={fadeUp}
          className="text-3xl sm:text-4xl font-extrabold tracking-tight text-text-primary mb-2 font-display"
        >
          Explore the Database
        </motion.h1>
        <motion.p variants={fadeUp} className="text-text-secondary text-sm sm:text-base">
          {loading ? 'Loading...' : (
            exploreData?.edition
              ? `${exploreData.edition.playerCount.toLocaleString()} players · ${exploreData.edition.shotCount.toLocaleString()} shots · ${exploreData.edition.earliestSeason}–${exploreData.edition.latestSeason}`
              : 'Search players and teams across all seasons'
          )}
        </motion.p>
      </motion.div>

      {/* ── Search ──────────────────────────────────────────────────────── */}
      <motion.div
        ref={searchRef}
        className="relative mb-8"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.1 }}
      >
        <div className="relative">
          <Search
            size={18}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-text-tertiary pointer-events-none"
          />
          <input
            type="text"
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search players by name..."
            className="w-full h-12 pl-11 pr-10 rounded-xl bg-white border border-black/[0.12] text-text-primary placeholder:text-text-tertiary text-sm focus:outline-none focus:border-accent-blue/40 focus:shadow-[0_0_0_3px_rgba(0,113,227,0.1)] transition-all"
            aria-label="Search players"
          />
          {query && (
            <button
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-primary transition-colors"
              onClick={() => { setQuery(''); setSearchResults([]); setSearchOpen(false); }}
              aria-label="Clear search"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Search results dropdown */}
        <AnimatePresence>
          {searchOpen && searchResults.length > 0 && (
            <motion.div
              className="absolute top-full left-0 right-0 mt-2 z-40 bg-white border border-black/[0.08] rounded-xl overflow-hidden shadow-[0_8px_40px_rgba(0,0,0,0.12)]"
              initial={{ opacity: 0, y: -8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.98 }}
              transition={{ duration: 0.15 }}
            >
              {searchResults.map((player) => (
                <Link
                  key={player.id}
                  href={`/player/${encodeURIComponent(player.name)}`}
                  onClick={() => setSearchOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-bg-secondary transition-colors group no-underline"
                >
                  <PlayerAvatar name={player.name} playerId={player.personId} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-text-primary group-hover:text-text-primary truncate">
                      {player.name}
                    </div>
                    <div className="text-xs text-text-tertiary">{player.position}</div>
                  </div>
                  <Badge variant={player.active ? 'accent' : 'default'} className="shrink-0">
                    {player.active ? 'Active' : 'Retired'}
                  </Badge>
                  <ChevronRight size={14} className="text-text-tertiary group-hover:text-text-secondary transition-colors" />
                </Link>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* ── Tabs ────────────────────────────────────────────────────────── */}
      <motion.div
        className="flex gap-2 mb-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.15 }}
      >
        {(['players', 'teams'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab
                ? 'bg-accent-orange text-white'
                : 'bg-bg-secondary border border-black/[0.06] text-text-secondary hover:text-text-primary hover:bg-white'
            }`}
          >
            {tab === 'players' ? <Users size={15} /> : <Shield size={15} />}
            {tab === 'players' ? 'Players' : 'Teams'}
          </button>
        ))}
      </motion.div>

      {/* ── Players Tab ─────────────────────────────────────────────────── */}
      {activeTab === 'players' && (
        <motion.div
          key="players"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.25 }}
        >
          {/* Position filter chips */}
          <div className="flex items-center gap-2 mb-5 flex-wrap">
            <SlidersHorizontal size={14} className="text-text-tertiary shrink-0" />
            {POSITIONS.map((pos) => (
              <button
                key={pos}
                onClick={() => setPositionFilter(pos)}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                  positionFilter === pos
                    ? 'bg-accent-orange/10 text-accent-orange border border-accent-orange/30'
                    : 'bg-bg-secondary border border-black/[0.06] text-text-secondary hover:text-text-primary'
                }`}
              >
                {pos}
              </button>
            ))}
          </div>

          {/* Featured players grid */}
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {Array.from({ length: 12 }).map((_, i) => (
                <SkeletonLoader key={i} className="h-28 rounded-xl" />
              ))}
            </div>
          ) : filteredPlayers.length === 0 ? (
            <div className="text-center py-16 text-text-tertiary">
              <Users size={32} className="mx-auto mb-3 opacity-40" />
              <p className="text-sm">No players found for this position filter.</p>
            </div>
          ) : (
            <motion.div
              className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3"
              variants={stagger}
              initial="hidden"
              animate="visible"
            >
              {filteredPlayers.map((player) => (
                <motion.div key={`${player.name}-${player.season}`} variants={fadeUp}>
                  <Link href={`/player/${encodeURIComponent(player.name)}`} className="no-underline">
                    <GlassCard hoverable pressable className="p-4 h-full">
                      <div className="flex flex-col gap-2">
                        <PlayerAvatar name={player.name} playerId={player.personId} size="md" />
                        <div>
                          <div className="text-sm font-semibold text-text-primary leading-tight truncate">
                            {player.name}
                          </div>
                          <div className="text-xs text-text-tertiary mt-0.5">
                            {player.position} · {player.team}
                          </div>
                        </div>
                        {(player.points !== undefined || player.assists !== undefined) && (
                          <div className="flex gap-2 mt-1">
                            {player.points !== undefined && (
                              <span className="text-xs text-accent-orange font-bold font-mono">
                                {Number(player.points).toFixed(1)} PPG
                              </span>
                            )}
                            {player.assists !== undefined && (
                              <span className="text-xs text-text-tertiary font-mono">
                                {Number(player.assists).toFixed(1)} APG
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </GlassCard>
                  </Link>
                </motion.div>
              ))}
            </motion.div>
          )}

          {/* Top scorers section */}
          {!loading && exploreData?.topScorers && exploreData.topScorers.length > 0 && (
            <div className="mt-10">
              <SectionHeader
                title="Top Scorers"
                eyebrow="Current season leaders"
              />
              <div className="space-y-2 mt-4">
                {exploreData.topScorers.slice(0, 8).map((player, idx) => (
                  <motion.div
                    key={`scorer-${player.name}-${idx}`}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.04 }}
                  >
                    <Link href={`/player/${encodeURIComponent(player.name)}`} className="no-underline">
                      <GlassCard hoverable className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-bold text-text-tertiary w-5 text-right shrink-0 font-mono">
                            {idx + 1}
                          </span>
                          <PlayerAvatar name={player.name} playerId={player.personId} size="sm" />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-text-primary truncate">
                              {player.name}
                            </div>
                            <div className="text-xs text-text-tertiary">
                              {player.position} · {player.team}
                            </div>
                          </div>
                          {player.points !== undefined && (
                            <div className="text-right shrink-0">
                              <div className="text-base font-bold text-accent-orange font-mono">
                                {Number(player.points).toFixed(1)}
                              </div>
                              <div className="text-xs text-text-tertiary">PPG</div>
                            </div>
                          )}
                          <ChevronRight size={14} className="text-text-tertiary shrink-0" />
                        </div>
                      </GlassCard>
                    </Link>
                  </motion.div>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* ── Teams Tab ───────────────────────────────────────────────────── */}
      {activeTab === 'teams' && (
        <motion.div
          key="teams"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.25 }}
        >
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <SkeletonLoader key={i} className="h-24 rounded-xl" />
              ))}
            </div>
          ) : teams.length === 0 ? (
            <div className="text-center py-16 text-text-tertiary">
              <Shield size={32} className="mx-auto mb-3 opacity-40" />
              <p className="text-sm">No teams found.</p>
            </div>
          ) : (
            <motion.div
              className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3"
              variants={stagger}
              initial="hidden"
              animate="visible"
            >
              {teams.map((team) => (
                <motion.div key={team.abbreviation} variants={fadeUp}>
                  <Link href={`/team/${team.abbreviation}`} className="no-underline">
                    <GlassCard hoverable pressable className="p-4 h-full">
                      <div className="flex flex-col gap-2">
                        <TeamLogo teamAbbr={team.abbreviation} teamId={team.teamId} size="lg" />
                        <div>
                          <div className="text-sm font-semibold text-text-primary leading-tight">
                            {team.nickname}
                          </div>
                          <div className="text-xs text-text-tertiary mt-0.5">
                            {team.city}
                          </div>
                          {team.conference && (
                            <div className="text-xs text-text-tertiary mt-0.5">
                              {team.conference} · {team.division}
                            </div>
                          )}
                        </div>
                      </div>
                    </GlassCard>
                  </Link>
                </motion.div>
              ))}
            </motion.div>
          )}
        </motion.div>
      )}
    </div>
  );
}
