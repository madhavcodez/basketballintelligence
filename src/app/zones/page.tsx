'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { Search, Flame, X, ChevronRight, Trophy } from 'lucide-react';
import HotZoneChart from '@/components/court/HotZoneChart';
import Court3DWrapper from '@/components/court/Court3DWrapper';
import CourtLegend from '@/components/court/CourtLegend';
import GlassCard from '@/components/ui/GlassCard';
import MetricChip from '@/components/ui/MetricChip';
import SectionHeader from '@/components/ui/SectionHeader';
import SkeletonLoader from '@/components/ui/SkeletonLoader';
import Badge from '@/components/ui/Badge';
import PlayerAvatar from '@/components/ui/PlayerAvatar';
import { type ZoneName, ZONES } from '@/lib/shot-constants';
import { type ZoneAggregation } from '@/lib/zone-engine';
import { colors, motionPresets } from '@/lib/design-tokens';

// ── Types ────────────────────────────────────────────────────────────────────

interface PlayerZoneData {
  player: string;
  personId?: string | number | null;
  season: string;
  totalShots: number;
  zones: ZoneAggregation[];
  topZone: { zone: string; fgPct: number } | null;
  coldestZone: { zone: string; fgPct: number } | null;
  shotSignature: string;
}

interface LeagueData {
  season: string;
  zones: ZoneAggregation[];
  leagueAvgFgPct: number;
}

interface HeatmapData {
  player: string;
  season: string;
  shots: Array<{ x: number; y: number; made: number; zone: string }>;
  totalShots: number;
}

interface SearchResult {
  id: number;
  name: string;
  position: string;
  active: number;
  personId?: string | number | null;
}

interface LeaderEntry {
  player: string;
  personId?: string | number | null;
  fgPct: number;
  attempts: number;
  makes: number;
  rank: number;
}

// ── Zone tab config ──────────────────────────────────────────────────────────

const LEADER_ZONES: Array<{ zone: string; label: string }> = [
  { zone: 'Restricted Area', label: 'Restricted' },
  { zone: 'In The Paint (Non-RA)', label: 'Paint' },
  { zone: 'Mid-Range', label: 'Mid-Range' },
  { zone: 'Left Corner 3', label: 'Corner 3' },
  { zone: 'Above the Break 3', label: 'Above Break 3' },
];

// ── Component ────────────────────────────────────────────────────────────────

export default function ZonesExplorerPage() {
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Zone of the Day
  const [spotlight, setSpotlight] = useState<{ text: string; zone: string; player: string } | null>(null);

  // Min attempt filter for leaderboards
  const [minAttempts, setMinAttempts] = useState(50);

  // Featured player
  const [featuredPlayer, setFeaturedPlayer] = useState('Stephen Curry');
  const [playerData, setPlayerData] = useState<PlayerZoneData | null>(null);
  const [heatmapData, setHeatmapData] = useState<HeatmapData | null>(null);
  const [leagueData, setLeagueData] = useState<LeagueData | null>(null);
  const [playerLoading, setPlayerLoading] = useState(true);

  // Compare state
  const [compareP1, setCompareP1] = useState('Stephen Curry');
  const [compareP2, setCompareP2] = useState('LeBron James');
  const [compareData, setCompareData] = useState<{
    player1: PlayerZoneData;
    player2: PlayerZoneData;
    heatmap1: HeatmapData;
    heatmap2: HeatmapData;
  } | null>(null);
  const [compareLoading, setCompareLoading] = useState(false);

  // Leaders state
  const [activeLeaderZone, setActiveLeaderZone] = useState(LEADER_ZONES[0].zone);
  const [leaders, setLeaders] = useState<LeaderEntry[]>([]);
  const [leadersLoading, setLeadersLoading] = useState(false);

  // ── League baseline ──────────────────────────────────────────────────────

  const leagueBaseline = useMemo(() => {
    if (!leagueData) return {};
    const map: Record<string, number> = {};
    for (const z of leagueData.zones) {
      map[z.zone] = z.fgPct;
    }
    return map;
  }, [leagueData]);

  // ── Spotlight fetch ───────────────────────────────────────────────────────

  useEffect(() => {
    fetch('/api/zones/spotlight')
      .then((r) => r.json())
      .then((d) => { if (d.spotlight) setSpotlight(d.spotlight); })
      .catch(() => {});
  }, []);

  // ── Data fetching ────────────────────────────────────────────────────────

  useEffect(() => {
    fetch('/api/zones/league')
      .then((r) => r.json())
      .then((d) => setLeagueData(d))
      .catch(() => {});
  }, []);

  const loadFeaturedPlayer = useCallback(async (name: string) => {
    setPlayerLoading(true);
    try {
      const [zoneRes, heatRes] = await Promise.all([
        fetch(`/api/zones/player/${encodeURIComponent(name)}`),
        fetch(`/api/zones/heatmap/${encodeURIComponent(name)}?limit=5000`),
      ]);
      const zoneJson = await zoneRes.json();
      const heatJson = await heatRes.json();

      if (!zoneRes.ok || !heatRes.ok) throw new Error('fetch failed');

      setPlayerData(zoneJson);
      setHeatmapData(heatJson);
    } catch {
      setPlayerData(null);
      setHeatmapData(null);
    } finally {
      setPlayerLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFeaturedPlayer(featuredPlayer);
  }, [featuredPlayer, loadFeaturedPlayer]);

  // ── Leaders loading ──────────────────────────────────────────────────────

  useEffect(() => {
    setLeadersLoading(true);
    fetch(`/api/zones/leaders?zone=${encodeURIComponent(activeLeaderZone)}&limit=10&minAttempts=${minAttempts}`)
      .then((r) => r.json())
      .then((d) => setLeaders(d.leaders ?? []))
      .catch(() => setLeaders([]))
      .finally(() => setLeadersLoading(false));
  }, [activeLeaderZone, minAttempts]);

  // ── Compare loading ──────────────────────────────────────────────────────

  const loadCompare = useCallback(async () => {
    setCompareLoading(true);
    try {
      const [z1, z2, h1, h2] = await Promise.all([
        fetch(`/api/zones/player/${encodeURIComponent(compareP1)}`).then((r) => r.json()),
        fetch(`/api/zones/player/${encodeURIComponent(compareP2)}`).then((r) => r.json()),
        fetch(`/api/zones/heatmap/${encodeURIComponent(compareP1)}?limit=3000`).then((r) => r.json()),
        fetch(`/api/zones/heatmap/${encodeURIComponent(compareP2)}?limit=3000`).then((r) => r.json()),
      ]);
      setCompareData({ player1: z1, player2: z2, heatmap1: h1, heatmap2: h2 });
    } catch {
      setCompareData(null);
    } finally {
      setCompareLoading(false);
    }
  }, [compareP1, compareP2]);

  useEffect(() => {
    loadCompare();
  }, [loadCompare]);

  // ── Search ───────────────────────────────────────────────────────────────

  const handleSearch = useCallback((value: string) => {
    setSearchQuery(value);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);

    if (value.trim().length < 2) {
      setSearchResults([]);
      setSearchOpen(false);
      return;
    }

    searchTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/players/search?q=${encodeURIComponent(value)}&limit=8`);
        const data = await res.json();
        setSearchResults(data.players ?? data ?? []);
        setSearchOpen(true);
      } catch {
        setSearchResults([]);
      }
    }, 250);
  }, []);

  const selectPlayer = useCallback((name: string) => {
    setFeaturedPlayer(name);
    setSearchQuery('');
    setSearchResults([]);
    setSearchOpen(false);
  }, []);

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen pb-32">
      {/* ── Hero Section ─────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden pt-8 pb-12 px-4 sm:px-6 lg:px-8">
        <div className="relative mx-auto max-w-6xl">
          <motion.div {...motionPresets.fadeInUp}>
            <div className="flex items-center gap-3 mb-2">
              <Flame size={28} className="text-[#FF6B35]" />
              <h1 className="font-display font-extrabold text-3xl sm:text-4xl tracking-tight text-[#1D1D1F]">
                Hot Zones
              </h1>
            </div>
            <p className="text-[#6E6E73] text-sm sm:text-base max-w-xl mb-4">
              See where every player scores — and where they don&apos;t. Explore shooting efficiency across every zone on the court.
            </p>

            {/* Zone of the Day spotlight */}
            {spotlight && (
              <motion.div
                className="flex items-center gap-2 mb-8 max-w-lg"
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3, type: 'spring', stiffness: 200, damping: 20 }}
              >
                <Flame size={14} className="text-accent-gold shrink-0" />
                <p className="text-xs text-accent-gold/90 font-medium">
                  <button
                    type="button"
                    onClick={() => selectPlayer(spotlight.player)}
                    className="underline decoration-accent-gold/30 hover:decoration-accent-gold/60 transition-colors"
                  >
                    {spotlight.text}
                  </button>
                </p>
              </motion.div>
            )}
          </motion.div>

          {/* Search */}
          <motion.div
            className="relative max-w-md"
            {...motionPresets.fadeInUp}
            transition={{ ...motionPresets.fadeInUp.transition, delay: 0.1 }}
          >
            <div className="relative flex items-center rounded-full bg-white border border-black/[0.06] transition-all duration-200 focus-within:border-[#FF6B35]/40 focus-within:shadow-[0_0_16px_rgba(255,107,53,0.12)]">
              <Search size={16} className="ml-4 shrink-0 text-[#86868B]" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Search player..."
                aria-label="Search for a player"
                className="flex-1 bg-transparent px-3 py-3 text-sm text-[#1D1D1F] placeholder:text-[#86868B] outline-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => { setSearchQuery(''); setSearchResults([]); setSearchOpen(false); }}
                  className="mr-3 flex items-center justify-center h-6 w-6 rounded-full bg-[#86868B]/20 text-[#6E6E73] hover:bg-[#86868B]/30 hover:text-[#1D1D1F] transition-colors"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Search dropdown */}
            {searchOpen && searchResults.length > 0 && (
              <div className="absolute top-full mt-2 w-full rounded-2xl border border-black/[0.06] bg-white shadow-[0_8px_40px_rgba(0,0,0,0.08)] z-50 py-2 max-h-64 overflow-y-auto">
                {searchResults.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => selectPlayer(r.name)}
                    className="w-full text-left px-4 py-2.5 hover:bg-[#F5F5F7] transition-colors flex items-center gap-3"
                  >
                    <PlayerAvatar name={r.name} playerId={r.personId} size="sm" />
                    <span className="text-sm font-medium text-[#1D1D1F]">{r.name}</span>
                    <span className="text-xs text-[#86868B]">{r.position}</span>
                    {r.active === 1 && <Badge variant="success">Active</Badge>}
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        </div>
      </section>

      {/* ── Featured Player Section ──────────────────────────────────────── */}
      <section className="px-4 sm:px-6 lg:px-8 mb-16">
        <div className="mx-auto max-w-6xl">
          <GlassCard className="p-6 sm:p-8">
            {playerLoading ? (
              <div className="flex flex-col lg:flex-row gap-8 items-center">
                <SkeletonLoader width={500} height={470} rounded="lg" />
                <div className="flex-1 space-y-4">
                  <SkeletonLoader width={200} height={32} />
                  <SkeletonLoader width={150} height={20} />
                  <div className="flex gap-3">
                    <SkeletonLoader width={80} height={60} count={4} className="inline-block" />
                  </div>
                </div>
              </div>
            ) : playerData && heatmapData ? (
              <div className="flex flex-col lg:flex-row gap-8 items-start">
                {/* Heatmap with 3D effect — responsive: full width on mobile */}
                <div className="shrink-0 w-full lg:w-auto max-w-[500px] mx-auto lg:mx-0">
                  <Court3DWrapper showHoop showFloor interactive>
                    <HotZoneChart
                      shots={heatmapData.shots}
                      leagueBaseline={leagueBaseline}
                      mode="efficiency"
                      showHexbin
                      showZoneFills
                      showZoneLabels
                      animated
                      size="lg"
                      className="mx-auto"
                    />
                  </Court3DWrapper>
                  <div className="mt-8">
                    <CourtLegend />
                  </div>
                </div>

                {/* Player info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <PlayerAvatar name={playerData.player} playerId={playerData.personId} size="lg" />
                    <h2 className="font-display font-extrabold text-2xl sm:text-3xl tracking-tight text-[#1D1D1F]">
                      {playerData.player}
                    </h2>
                    <Link
                      href={`/zones/${encodeURIComponent(playerData.player)}`}
                      className="text-[#FF6B35] hover:text-[#FF6B35]/80 transition-colors"
                    >
                      <ChevronRight size={20} />
                    </Link>
                  </div>

                  <Badge variant="accent" className="mb-6">
                    {playerData.shotSignature}
                  </Badge>

                  <p className="text-[#86868B] text-xs uppercase tracking-wider mb-2">
                    {playerData.season} &middot; {playerData.totalShots.toLocaleString()} shots
                  </p>

                  {/* Zone metrics */}
                  <div className="flex flex-wrap gap-2 mb-6">
                    {playerData.zones.slice(0, 6).map((z) => {
                      const diff = z.fgPct - (leagueBaseline[z.zone] ?? 0.45);
                      return (
                        <MetricChip
                          key={z.zone}
                          label={ZONES[z.zone as ZoneName]?.shortLabel ?? z.zone}
                          value={`${(z.fgPct * 100).toFixed(1)}%`}
                          size="sm"
                          trend={diff > 0.02 ? 'up' : diff < -0.02 ? 'down' : 'neutral'}
                          highlight={z.zone === playerData.topZone?.zone}
                        />
                      );
                    })}
                  </div>

                  {/* Top/Coldest zones */}
                  {playerData.topZone && (
                    <div className="space-y-2 text-sm">
                      <p className="text-[#6E6E73]">
                        <span className="text-[#22C55E] font-semibold">Hottest:</span>{' '}
                        {playerData.topZone.zone} — {(playerData.topZone.fgPct * 100).toFixed(1)}%
                      </p>
                      {playerData.coldestZone && (
                        <p className="text-[#6E6E73]">
                          <span className="text-[#0071E3] font-semibold">Coldest:</span>{' '}
                          {playerData.coldestZone.zone} — {(playerData.coldestZone.fgPct * 100).toFixed(1)}%
                        </p>
                      )}
                    </div>
                  )}

                  <Link
                    href={`/zones/${encodeURIComponent(playerData.player)}`}
                    className="inline-flex items-center gap-1.5 mt-6 text-sm font-medium text-[#FF6B35] hover:text-[#FF6B35]/80 transition-colors"
                  >
                    View Full Profile
                    <ChevronRight size={14} />
                  </Link>
                </div>
              </div>
            ) : (
              <div className="text-center py-16">
                <p className="text-[#86868B] text-sm">No data available for this player</p>
              </div>
            )}
          </GlassCard>
        </div>
      </section>

      {/* ── Zone Spotlight (animated rings) ────────────────────────────── */}
      {playerData && !playerLoading && (
        <section className="px-4 sm:px-6 lg:px-8 mb-16">
          <div className="mx-auto max-w-6xl">
            <SectionHeader
              eyebrow="Breakdown"
              title="Zone Distribution"
              className="mb-6"
            />
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {playerData.zones
                .filter((z) => z.zone !== 'Backcourt')
                .map((z, i) => {
                  const pct = z.fgPct * 100;
                  const avg = (leagueBaseline[z.zone] ?? 0.45) * 100;
                  const diff = pct - avg;
                  const isHot = diff > 2;
                  const isCold = diff < -2;
                  const ringPct = Math.min(100, pct);
                  const circumference = 2 * Math.PI * 36;
                  const strokeDashoffset = circumference - (ringPct / 100) * circumference;

                  return (
                    <motion.div
                      key={z.zone}
                      className="flex flex-col items-center"
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: i * 0.08, type: 'spring', stiffness: 200, damping: 18 }}
                    >
                      <GlassCard className="w-full p-3 flex flex-col items-center" hoverable>
                        {/* Ring */}
                        <div className="relative w-20 h-20 mb-2">
                          <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90">
                            <circle
                              cx="40" cy="40" r="36"
                              fill="none"
                              stroke="rgba(0,0,0,0.06)"
                              strokeWidth="5"
                            />
                            <motion.circle
                              cx="40" cy="40" r="36"
                              fill="none"
                              stroke={isHot ? colors.accentGreen : isCold ? colors.accentRed : colors.accentGold}
                              strokeWidth="5"
                              strokeLinecap="round"
                              strokeDasharray={circumference}
                              initial={{ strokeDashoffset: circumference }}
                              animate={{ strokeDashoffset }}
                              transition={{ delay: i * 0.08 + 0.3, duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
                            />
                          </svg>
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span className={`text-sm font-bold tabular-nums ${isHot ? 'text-[#22C55E]' : isCold ? 'text-[#EF4444]' : 'text-[#1D1D1F]'}`}>
                              {pct.toFixed(1)}%
                            </span>
                          </div>
                        </div>
                        <span className="text-[10px] font-semibold text-[#6E6E73] text-center leading-tight">
                          {ZONES[z.zone as ZoneName]?.label ?? z.zone}
                        </span>
                        <span className="text-[9px] text-[#86868B] mt-0.5 tabular-nums">
                          {z.attempts} att ({(z.attPct * 100).toFixed(0)}%)
                        </span>
                        <span className={`text-[9px] font-bold mt-0.5 tabular-nums ${isHot ? 'text-[#22C55E]' : isCold ? 'text-[#EF4444]' : 'text-[#86868B]'}`}>
                          {diff >= 0 ? '+' : ''}{diff.toFixed(1)}% vs avg
                        </span>
                      </GlassCard>
                    </motion.div>
                  );
                })}
            </div>
          </div>
        </section>
      )}

      {/* ── Zone Leaderboards ────────────────────────────────────────────── */}
      <section className="px-4 sm:px-6 lg:px-8 mb-16">
        <div className="mx-auto max-w-6xl">
          <SectionHeader
            eyebrow="Leaderboards"
            title="Zone Leaders"
            className="mb-6"
          />

          {/* Zone tabs + min attempt filter */}
          <div className="flex flex-wrap items-center gap-2 mb-6">
            {LEADER_ZONES.map((lz) => (
              <button
                key={lz.zone}
                type="button"
                onClick={() => setActiveLeaderZone(lz.zone)}
                className={`px-4 py-2 rounded-full text-xs font-semibold transition-all duration-200 border ${
                  activeLeaderZone === lz.zone
                    ? 'bg-[#FF6B35]/10 border-[#FF6B35]/30 text-[#FF6B35]'
                    : 'bg-white border-black/[0.06] text-[#6E6E73] hover:text-[#1D1D1F] hover:border-black/[0.12]'
                }`}
              >
                {lz.label}
              </button>
            ))}

            {/* Separator */}
            <div className="h-5 w-px bg-black/[0.06] mx-1" />

            {/* Min attempts toggle */}
            <span className="text-[10px] text-[#86868B] uppercase tracking-wider">Min:</span>
            {[50, 100, 200].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setMinAttempts(n)}
                className={`px-2.5 py-1 rounded-full text-[10px] font-semibold transition-all duration-200 border ${
                  minAttempts === n
                    ? 'bg-white border-black/[0.12] text-[#1D1D1F]'
                    : 'border-transparent text-[#86868B] hover:text-[#6E6E73]'
                }`}
              >
                {n}+
              </button>
            ))}
          </div>

          {/* Leaders list */}
          <GlassCard className="p-0 overflow-hidden">
            {leadersLoading ? (
              <div className="p-6 space-y-3">
                <SkeletonLoader width="100%" height={44} count={5} className="block" />
              </div>
            ) : leaders.length > 0 ? (
              <div className="divide-y divide-black/[0.06]">
                {leaders.map((leader, i) => (
                  <motion.button
                    type="button"
                    key={leader.player}
                    aria-label={`Select ${leader.player}`}
                    className={`w-full text-left flex items-center gap-4 px-5 py-3.5 hover:bg-[#F5F5F7] focus:bg-[#F5F5F7] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B35]/40 transition-colors cursor-pointer ${i % 2 === 1 ? 'bg-[#F5F5F7]' : 'bg-white'}`}
                    onClick={() => selectPlayer(leader.player)}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04, type: 'spring', stiffness: 200, damping: 20 }}
                  >
                    <span className={`text-sm font-bold w-6 text-center ${i < 3 ? 'text-accent-gold' : 'text-[#86868B]'}`}>
                      {i + 1}
                    </span>
                    {i === 0 && <Trophy size={14} className="text-accent-gold -ml-1" />}
                    <PlayerAvatar name={leader.player} playerId={leader.personId} size="sm" />
                    <span className="flex-1 text-sm font-medium text-[#1D1D1F] truncate">
                      {leader.player}
                    </span>
                    <span className="text-sm font-bold text-[#1D1D1F] tabular-nums">
                      {typeof leader.fgPct === 'number' && leader.fgPct < 1
                        ? `${(leader.fgPct * 100).toFixed(1)}%`
                        : `${leader.fgPct}%`
                      }
                    </span>
                    <span className="text-xs text-[#86868B] tabular-nums w-16 text-right">
                      {leader.attempts} att
                    </span>
                  </motion.button>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-[#86868B] text-sm">
                No leaders data available
              </div>
            )}
          </GlassCard>
        </div>
      </section>

      {/* ── Zone Showdown (Compare) ──────────────────────────────────────── */}
      <section className="px-4 sm:px-6 lg:px-8 mb-16">
        <div className="mx-auto max-w-6xl">
          <SectionHeader
            eyebrow="Showdown"
            title="Zone Comparison"
            className="mb-6"
          />

          {/* Player selectors */}
          <div className="flex flex-col sm:flex-row items-center gap-4 mb-8">
            <CompareSearch
              value={compareP1}
              onChange={setCompareP1}
              placeholder="Player 1"
            />
            <span className="text-[#86868B] font-bold text-lg">vs</span>
            <CompareSearch
              value={compareP2}
              onChange={setCompareP2}
              placeholder="Player 2"
            />
          </div>

          {compareLoading ? (
            <div className="flex flex-col lg:flex-row gap-6 justify-center">
              <SkeletonLoader width={360} height={339} rounded="lg" />
              <SkeletonLoader width={360} height={339} rounded="lg" />
            </div>
          ) : compareData ? (
            <div className="space-y-6">
              {/* Side-by-side heatmaps */}
              <div className="flex flex-col lg:flex-row gap-6 items-start">
                {/* Player 1 heatmap */}
                <div className="flex-1 min-w-0">
                  <GlassCard className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-2 h-2 rounded-full" style={{ background: colors.accentOrange }} />
                      <PlayerAvatar name={compareData.player1.player} playerId={compareData.player1.personId} size="sm" />
                      <h3 className="text-lg font-bold text-[#1D1D1F] truncate">
                        {compareData.player1.player}
                      </h3>
                      <Badge variant="accent">{compareData.player1.shotSignature}</Badge>
                    </div>
                    <HotZoneChart
                      shots={compareData.heatmap1.shots}
                      leagueBaseline={leagueBaseline}
                      mode="efficiency"
                      showHexbin
                      showZoneFills
                      showZoneLabels
                      animated
                      size="md"
                      className="mx-auto"
                    />
                  </GlassCard>
                </div>

                {/* Player 2 heatmap */}
                <div className="flex-1 min-w-0">
                  <GlassCard className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-2 h-2 rounded-full" style={{ background: colors.accentBlue }} />
                      <PlayerAvatar name={compareData.player2.player} playerId={compareData.player2.personId} size="sm" />
                      <h3 className="text-lg font-bold text-[#1D1D1F] truncate">
                        {compareData.player2.player}
                      </h3>
                      <Badge variant="accent">{compareData.player2.shotSignature}</Badge>
                    </div>
                    <HotZoneChart
                      shots={compareData.heatmap2.shots}
                      leagueBaseline={leagueBaseline}
                      mode="efficiency"
                      showHexbin
                      showZoneFills
                      showZoneLabels
                      animated
                      size="md"
                      className="mx-auto"
                    />
                  </GlassCard>
                </div>
              </div>

              {/* Zone-by-zone comparison bars */}
              <GlassCard className="p-5">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-[#86868B] mb-4">
                  Zone-by-Zone Breakdown
                </h4>
                <div className="space-y-3">
                  {compareData.player1.zones
                    .filter((z: ZoneAggregation) => z.zone !== 'Backcourt' && z.attempts > 0)
                    .map((p1Zone: ZoneAggregation, i: number) => {
                      const p2Zone = compareData.player2.zones.find(
                        (z: ZoneAggregation) => z.zone === p1Zone.zone
                      );
                      const p1Pct = p1Zone.fgPct * 100;
                      const p2Pct = (p2Zone?.fgPct ?? 0) * 100;
                      const maxPct = Math.max(p1Pct, p2Pct, 1);
                      const p1Wins = p1Pct > p2Pct;

                      return (
                        <motion.div
                          key={p1Zone.zone}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.06, type: 'spring', stiffness: 200, damping: 20 }}
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-xs font-medium text-[#6E6E73]">
                              {ZONES[p1Zone.zone as ZoneName]?.label ?? p1Zone.zone}
                            </span>
                            <div className="flex items-center gap-4">
                              <span className={`text-xs font-bold tabular-nums ${p1Wins ? 'text-[#FF6B35]' : 'text-[#86868B]'}`}>
                                {p1Pct.toFixed(1)}%
                              </span>
                              <span className={`text-xs font-bold tabular-nums ${!p1Wins ? 'text-[#0071E3]' : 'text-[#86868B]'}`}>
                                {p2Pct.toFixed(1)}%
                              </span>
                            </div>
                          </div>
                          <div className="flex gap-1 h-2 rounded-full overflow-hidden">
                            <div className="flex-1 flex justify-end bg-[#F5F5F7] rounded-l-full overflow-hidden">
                              <motion.div
                                className="h-full rounded-l-full"
                                style={{ background: p1Wins ? colors.accentOrange : 'rgba(0,0,0,0.08)' }}
                                initial={{ width: 0 }}
                                animate={{ width: `${(p1Pct / maxPct) * 100}%` }}
                                transition={{ delay: i * 0.06 + 0.2, duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
                              />
                            </div>
                            <div className="flex-1 bg-[#F5F5F7] rounded-r-full overflow-hidden">
                              <motion.div
                                className="h-full rounded-r-full"
                                style={{ background: !p1Wins ? colors.accentBlue : 'rgba(0,0,0,0.08)' }}
                                initial={{ width: 0 }}
                                animate={{ width: `${(p2Pct / maxPct) * 100}%` }}
                                transition={{ delay: i * 0.06 + 0.2, duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
                              />
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                </div>
                {/* Legend */}
                <div className="flex justify-between mt-4 pt-3 border-t border-black/[0.06]">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: colors.accentOrange }} />
                    <span className="text-[10px] text-[#86868B]">{compareData.player1.player}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-[#86868B]">{compareData.player2.player}</span>
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: colors.accentBlue }} />
                  </div>
                </div>
              </GlassCard>
            </div>
          ) : (
            <div className="text-center py-12 text-[#86868B] text-sm">
              Select two players to compare
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

// ── Compare Search Sub-component ─────────────────────────────────────────────

function CompareSearch({
  value,
  onChange,
  placeholder,
}: {
  readonly value: string;
  readonly onChange: (name: string) => void;
  readonly placeholder: string;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const handleInput = useCallback((val: string) => {
    setQuery(val);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (val.trim().length < 2) { setResults([]); setOpen(false); return; }

    timerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/players/search?q=${encodeURIComponent(val)}&limit=6`);
        const data = await res.json();
        setResults(data.players ?? data ?? []);
        setOpen(true);
      } catch {
        setResults([]);
      }
    }, 250);
  }, []);

  return (
    <div className="relative flex-1 w-full max-w-xs">
      <div className="flex items-center rounded-full bg-white border border-black/[0.06] px-4 py-2.5 text-sm">
        <Search size={14} className="text-[#86868B] mr-2 shrink-0" />
        <input
          type="text"
          value={query || value}
          onChange={(e) => handleInput(e.target.value)}
          onFocus={() => { if (results.length > 0) setOpen(true); }}
          placeholder={placeholder}
          aria-label={placeholder}
          className="flex-1 bg-transparent text-[#1D1D1F] placeholder:text-[#86868B] outline-none"
        />
      </div>
      {open && results.length > 0 && (
        <div className="absolute top-full mt-1 w-full rounded-xl border border-black/[0.06] bg-white shadow-[0_8px_40px_rgba(0,0,0,0.08)] z-50 py-1 max-h-48 overflow-y-auto">
          {results.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => { onChange(r.name); setQuery(''); setResults([]); setOpen(false); }}
              className="w-full text-left px-3 py-2 text-sm text-[#1D1D1F] hover:bg-[#F5F5F7] transition-colors flex items-center gap-2"
            >
              <PlayerAvatar name={r.name} playerId={r.personId} size="sm" />
              {r.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
