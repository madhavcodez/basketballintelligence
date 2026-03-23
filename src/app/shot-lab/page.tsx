'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  ArrowLeft,
  Search,
  Flame,
  Circle,
  Target,
} from 'lucide-react';
import GlassCard from '@/components/ui/GlassCard';
import MetricChip from '@/components/ui/MetricChip';
import SectionHeader from '@/components/ui/SectionHeader';
import SkeletonLoader from '@/components/ui/SkeletonLoader';
import PlayerAvatar from '@/components/ui/PlayerAvatar';

// ── Types ────────────────────────────────────────────────────────────────────

interface ShotData {
  readonly x: number;
  readonly y: number;
  readonly made: number;
  readonly zoneBasic: string;
  readonly zoneArea: string;
  readonly zoneRange: string;
  readonly distance: number;
  readonly actionType: string;
  readonly shotType: string;
  readonly period: number;
  readonly gameDate: string;
  readonly teamName: string;
  readonly season: string;
}

interface ZoneStat {
  readonly zone: string;
  readonly area: string;
  readonly attempts: number;
  readonly makes: number;
  readonly fgPct: number;
  readonly avgDistance: number;
}

interface ShotSeason {
  readonly season: string;
}

interface SearchResult {
  readonly id: number;
  readonly name: string;
  readonly position: string;
  readonly active: number;
}

// ── Constants ────────────────────────────────────────────────────────────────

const VB_W = 500;
const VB_H = 470;
const BX = 250;
const BY = 52.5;

const NBA_X_RANGE = 500; // -250 to 250
const NBA_Y_RANGE = 470; // -47.5 to 422.5

const ZONE_FILTERS = [
  { key: 'Restricted Area', label: 'Restricted' },
  { key: 'In The Paint (Non-RA)', label: 'Paint' },
  { key: 'Mid-Range', label: 'Mid-Range' },
  { key: 'Left Corner 3', label: 'Corner 3 (L)' },
  { key: 'Right Corner 3', label: 'Corner 3 (R)' },
  { key: 'Above the Break 3', label: 'Above Break 3' },
] as const;

// ── Court SVG constants ──────────────────────────────────────────────────────

const KEY_W = 160;
const KEY_H = 190;
const KEY_LEFT = BX - KEY_W / 2;
const FT_RADIUS = 60;
const THREE_RADIUS = 237.5;
const THREE_SIDE_Y = 140;
const CORNER_3_X = 30;
const RESTRICTED_RADIUS = 40;
const BACKBOARD_W = 60;
const BACKBOARD_Y = 40;
const RIM_RADIUS = 9;
const LINE_COLOR = 'rgba(255,255,255,0.44)';
const LINE_W = 1.5;

// ── Coordinate mapping ──────────────────────────────────────────────────────

function nbaToSvg(nx: number, ny: number): { sx: number; sy: number } {
  const sx = BX + (nx / NBA_X_RANGE) * VB_W;
  const sy = BY + (ny / NBA_Y_RANGE) * VB_H;
  return { sx, sy };
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

// ── Arc builders ─────────────────────────────────────────────────────────────

function buildArc(
  cx: number, cy: number, radius: number,
  startAngle: number, endAngle: number, steps: number,
): string {
  const pts: string[] = [];
  for (let i = 0; i <= steps; i++) {
    const angle = startAngle + (endAngle - startAngle) * (i / steps);
    const px = cx + radius * Math.cos(angle);
    const py = cy - radius * Math.sin(angle);
    if (py >= 0) pts.push(`${px},${py}`);
  }
  return pts.join(' ');
}

// ── Component ────────────────────────────────────────────────────────────────

export default function ShotLabPage() {
  // State
  const [playerName, setPlayerName] = useState('');
  const [selectedSeason, setSelectedSeason] = useState('');
  const [shots, setShots] = useState<readonly ShotData[]>([]);
  const [zones, setZones] = useState<readonly ZoneStat[]>([]);
  const [seasons, setSeasons] = useState<readonly ShotSeason[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'dots' | 'heatmap'>('dots');
  const [activeZones, setActiveZones] = useState<Set<string>>(new Set());

  // Search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<readonly SearchResult[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  // Fetch shot data
  useEffect(() => {
    if (!playerName) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const url = new URL('/api/shots', window.location.origin);
        url.searchParams.set('player', playerName);
        if (selectedSeason) url.searchParams.set('season', selectedSeason);

        const res = await fetch(url.toString());
        if (!res.ok) throw new Error('Failed to load shots');
        const json = await res.json();
        if (cancelled) return;

        setShots(json.shots ?? []);
        setZones(json.zones ?? []);
        setSeasons(json.seasons ?? []);

        // Auto-select latest season if not set
        if (!selectedSeason && json.seasons?.length > 0) {
          setSelectedSeason(json.seasons[0].season);
        }

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
  }, [playerName, selectedSeason]);

  // Debounced search
  const handleSearchInput = useCallback((value: string) => {
    setSearchQuery(value);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (value.trim().length < 2) {
      setSearchResults([]);
      setSearchOpen(false);
      return;
    }
    searchTimeout.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/players/search?q=${encodeURIComponent(value)}&limit=6`);
        if (res.ok) {
          const json = await res.json();
          setSearchResults(json);
          setSearchOpen(true);
        }
      } catch { /* silent */ }
    }, 250);
  }, []);

  const selectPlayer = useCallback((name: string) => {
    setPlayerName(name);
    setSearchQuery(name);
    setSearchResults([]);
    setSearchOpen(false);
    setSelectedSeason('');
    setActiveZones(new Set());
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Toggle zone filter
  const toggleZone = useCallback((zone: string) => {
    setActiveZones((prev) => {
      const next = new Set(prev);
      if (next.has(zone)) next.delete(zone);
      else next.add(zone);
      return next;
    });
  }, []);

  // Filtered shots
  const filteredShots = useMemo(() => {
    if (activeZones.size === 0) return shots;
    return shots.filter((s) => activeZones.has(s.zoneBasic));
  }, [shots, activeZones]);

  // Shot summary stats
  const summary = useMemo(() => {
    if (filteredShots.length === 0) return null;
    const total = filteredShots.length;
    const made = filteredShots.filter((s) => s.made === 1).length;
    const threes = filteredShots.filter((s) => s.shotType?.includes('3PT'));
    const threesMade = threes.filter((s) => s.made === 1).length;
    const twos = filteredShots.filter((s) => !s.shotType?.includes('3PT'));
    const twosMade = twos.filter((s) => s.made === 1).length;
    const paint = filteredShots.filter(
      (s) => s.zoneBasic === 'Restricted Area' || s.zoneBasic === 'In The Paint (Non-RA)',
    );
    const paintMade = paint.filter((s) => s.made === 1).length;
    const midRange = filteredShots.filter((s) => s.zoneBasic === 'Mid-Range');
    const midMade = midRange.filter((s) => s.made === 1).length;

    return {
      fga: total,
      fgPct: ((made / total) * 100).toFixed(1),
      twoPct: twos.length > 0 ? ((twosMade / twos.length) * 100).toFixed(1) : '--',
      threePct: threes.length > 0 ? ((threesMade / threes.length) * 100).toFixed(1) : '--',
      paintPct: paint.length > 0 ? ((paintMade / paint.length) * 100).toFixed(1) : '--',
      midPct: midRange.length > 0 ? ((midMade / midRange.length) * 100).toFixed(1) : '--',
    };
  }, [filteredShots]);

  // Action type breakdown
  const actionBreakdown = useMemo(() => {
    if (filteredShots.length === 0) return [];
    const map = new Map<string, { attempts: number; makes: number }>();
    for (const s of filteredShots) {
      const key = s.actionType || 'Unknown';
      const entry = map.get(key) ?? { attempts: 0, makes: 0 };
      entry.attempts += 1;
      if (s.made === 1) entry.makes += 1;
      map.set(key, entry);
    }
    return Array.from(map.entries())
      .map(([label, { attempts, makes }]) => ({
        label,
        attempts,
        makes,
        fgPct: ((makes / attempts) * 100).toFixed(1),
      }))
      .sort((a, b) => b.attempts - a.attempts)
      .slice(0, 8);
  }, [filteredShots]);

  const maxAttempts = useMemo(
    () => Math.max(1, ...actionBreakdown.map((a) => a.attempts)),
    [actionBreakdown],
  );

  // Hexbin data (simple grid-based)
  const hexbinData = useMemo(() => {
    if (viewMode !== 'heatmap' || filteredShots.length === 0) return [];
    const gridSize = 20;
    const bins = new Map<string, { x: number; y: number; count: number; made: number }>();
    for (const s of filteredShots) {
      const { sx, sy } = nbaToSvg(s.x, s.y);
      const gx = Math.round(sx / gridSize) * gridSize;
      const gy = Math.round(sy / gridSize) * gridSize;
      const key = `${gx}-${gy}`;
      const bin = bins.get(key) ?? { x: gx, y: gy, count: 0, made: 0 };
      bin.count += 1;
      if (s.made === 1) bin.made += 1;
      bins.set(key, bin);
    }
    return Array.from(bins.values());
  }, [filteredShots, viewMode]);

  const maxBinCount = useMemo(
    () => Math.max(1, ...hexbinData.map((b) => b.count)),
    [hexbinData],
  );

  // Court arcs (computed once)
  const threePointArc = useMemo(() => {
    const startAngle = Math.PI - Math.acos((CORNER_3_X - BX) / THREE_RADIUS);
    const endAngle = Math.acos((CORNER_3_X - BX) / THREE_RADIUS);
    return buildArc(BX, BY, THREE_RADIUS, startAngle, endAngle, 120);
  }, []);

  const restrictedArc = useMemo(
    () => buildArc(BX, BY, RESTRICTED_RADIUS, Math.PI, 0, 60),
    [],
  );

  const ftSemiTop = useMemo(
    () => buildArc(BX, KEY_H, FT_RADIUS, 0, Math.PI, 60),
    [],
  );

  const ftSemiBottom = useMemo(
    () => buildArc(BX, KEY_H, FT_RADIUS, Math.PI, 2 * Math.PI, 60),
    [],
  );

  return (
    <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 pt-4 pb-8">
      {/* Back link */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-4">
        <Link
          href="/explore"
          className="inline-flex items-center gap-1 text-xs text-chrome-dim hover:text-chrome-medium transition-colors"
        >
          <ArrowLeft size={12} /> Explore
        </Link>
      </motion.div>

      <motion.div initial="hidden" animate="visible" variants={stagger}>
        <motion.div variants={fadeUp}>
          <SectionHeader title="Shot Lab" eyebrow="Interactive" className="mb-6" />
        </motion.div>

        {/* ── Player Search ───────────────────────────────────────────── */}
        <motion.div variants={fadeUp} className="mb-6 max-w-lg" ref={searchRef}>
          <label className="text-[10px] uppercase tracking-wider text-chrome-dim font-medium mb-1 block">
            Player
          </label>
          <div className="relative">
            <div className="group relative flex items-center rounded-full bg-glass-frosted backdrop-blur-xl border border-glass-border transition-all focus-within:border-accent-green/40 focus-within:shadow-[0_0_16px_rgba(52,211,153,0.12)]">
              <Search size={14} className="ml-3 shrink-0 text-chrome-dim group-focus-within:text-accent-green" />
              <input
                type="text"
                aria-label="Search player for shot chart"
                value={searchQuery}
                onChange={(e) => handleSearchInput(e.target.value)}
                onFocus={() => { if (searchResults.length > 0) setSearchOpen(true); }}
                placeholder="Search for a player..."
                className="flex-1 bg-transparent px-2 py-2.5 text-sm text-chrome-light placeholder:text-chrome-dim outline-none"
              />
            </div>
            {searchOpen && searchResults.length > 0 && (
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

        {/* ── Season Selector ─────────────────────────────────────────── */}
        {seasons.length > 0 && (
          <motion.div variants={fadeUp} className="mb-6">
            <label className="text-[10px] uppercase tracking-wider text-chrome-dim font-medium mb-1 block">
              Season
            </label>
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
              {seasons.map(({ season }) => (
                <button
                  key={season}
                  type="button"
                  onClick={() => setSelectedSeason(season)}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${
                    selectedSeason === season
                      ? 'bg-accent-green/20 text-accent-green border border-accent-green/30'
                      : 'bg-glass-bg text-chrome-dim border border-glass-border hover:text-chrome-medium'
                  }`}
                >
                  {season}
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {/* ── Loading ─────────────────────────────────────────────────── */}
        {loading && (
          <div className="space-y-4">
            <SkeletonLoader height={400} rounded="xl" className="w-full" />
            <SkeletonLoader height={200} rounded="xl" className="w-full" />
          </div>
        )}

        {/* ── Error ───────────────────────────────────────────────────── */}
        {error && (
          <GlassCard className="p-6 text-center">
            <p className="text-sm text-accent-red">{error}</p>
          </GlassCard>
        )}

        {/* ── Empty state ─────────────────────────────────────────────── */}
        {!loading && !error && !playerName && (
          <GlassCard className="p-8 text-center">
            <Target size={40} className="mx-auto mb-3 text-chrome-dim" />
            <h3 className="text-lg font-bold text-chrome-light mb-1">Select a Player</h3>
            <p className="text-sm text-chrome-dim">
              Search for a player above to explore their shot chart.
            </p>
          </GlassCard>
        )}

        {/* ── Shot Chart + Controls ────────────────────────────────────── */}
        {!loading && !error && playerName && shots.length > 0 && (
          <>
            {/* View mode + Zone filters */}
            <motion.div variants={fadeUp} className="flex flex-wrap items-center gap-2 mb-4">
              {/* View mode toggle */}
              <div className="flex rounded-full bg-glass-bg border border-glass-border overflow-hidden">
                <button
                  type="button"
                  onClick={() => setViewMode('dots')}
                  className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium transition-colors ${
                    viewMode === 'dots'
                      ? 'bg-accent-green/20 text-accent-green'
                      : 'text-chrome-dim hover:text-chrome-medium'
                  }`}
                >
                  <Circle size={10} /> Dots
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('heatmap')}
                  className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium transition-colors ${
                    viewMode === 'heatmap'
                      ? 'bg-accent-orange/20 text-accent-orange'
                      : 'text-chrome-dim hover:text-chrome-medium'
                  }`}
                >
                  <Flame size={10} /> Heat Map
                </button>
              </div>

              {/* Zone toggles */}
              <div className="flex flex-wrap gap-1.5">
                {ZONE_FILTERS.map((zf) => (
                  <button
                    key={zf.key}
                    type="button"
                    onClick={() => toggleZone(zf.key)}
                    className={`px-2.5 py-1 rounded-full text-[10px] font-medium border transition-all ${
                      activeZones.has(zf.key)
                        ? 'bg-accent-green/20 text-accent-green border-accent-green/30'
                        : activeZones.size > 0
                          ? 'bg-glass-bg text-chrome-faint border-glass-border'
                          : 'bg-glass-bg text-chrome-dim border-glass-border hover:text-chrome-medium'
                    }`}
                  >
                    {zf.label}
                  </button>
                ))}
              </div>
            </motion.div>

            {/* Court SVG */}
            <motion.div variants={fadeUp} className="mb-6">
              <GlassCard className="p-4 sm:p-6">
                <div className="flex justify-center">
                  <svg
                    viewBox={`0 0 ${VB_W} ${VB_H}`}
                    preserveAspectRatio="xMidYMid meet"
                    className="w-full max-w-[560px] h-auto"
                    role="img"
                    aria-label="Shot chart"
                  >
                    {/* Court lines */}
                    <rect x={0} y={0} width={VB_W} height={VB_H} fill="none" stroke={LINE_COLOR} strokeWidth={LINE_W * 1.5} />
                    <rect x={KEY_LEFT} y={0} width={KEY_W} height={KEY_H} fill="none" stroke={LINE_COLOR} strokeWidth={LINE_W} />
                    <polyline points={ftSemiTop} fill="none" stroke={LINE_COLOR} strokeWidth={LINE_W} />
                    <polyline points={ftSemiBottom} fill="none" stroke={LINE_COLOR} strokeWidth={LINE_W} strokeDasharray="6 6" />
                    <line x1={CORNER_3_X} y1={0} x2={CORNER_3_X} y2={THREE_SIDE_Y} stroke={LINE_COLOR} strokeWidth={LINE_W} />
                    <polyline points={threePointArc} fill="none" stroke={LINE_COLOR} strokeWidth={LINE_W} />
                    <line x1={VB_W - CORNER_3_X} y1={0} x2={VB_W - CORNER_3_X} y2={THREE_SIDE_Y} stroke={LINE_COLOR} strokeWidth={LINE_W} />
                    <polyline points={restrictedArc} fill="none" stroke={LINE_COLOR} strokeWidth={LINE_W} />
                    <line x1={BX - BACKBOARD_W / 2} y1={BACKBOARD_Y} x2={BX + BACKBOARD_W / 2} y2={BACKBOARD_Y} stroke={LINE_COLOR} strokeWidth={LINE_W * 1.5} />
                    <circle cx={BX} cy={BY} r={RIM_RADIUS} fill="none" stroke={LINE_COLOR} strokeWidth={LINE_W} />
                    <line x1={0} y1={VB_H} x2={VB_W} y2={VB_H} stroke={LINE_COLOR} strokeWidth={LINE_W * 1.5} />
                    <path d={`M ${BX - FT_RADIUS} ${VB_H} A ${FT_RADIUS} ${FT_RADIUS} 0 0 0 ${BX + FT_RADIUS} ${VB_H}`} fill="none" stroke={LINE_COLOR} strokeWidth={LINE_W} />

                    {/* Heatmap mode */}
                    {viewMode === 'heatmap' && hexbinData.map((bin, i) => {
                      const opacity = 0.15 + (bin.count / maxBinCount) * 0.7;
                      const fgPct = bin.count > 0 ? bin.made / bin.count : 0;
                      const color = fgPct >= 0.5 ? '#34D399' : fgPct >= 0.35 ? '#FBBF24' : '#F87171';
                      return (
                        <circle
                          key={i}
                          cx={bin.x}
                          cy={bin.y}
                          r={10 + (bin.count / maxBinCount) * 8}
                          fill={color}
                          fillOpacity={opacity}
                        />
                      );
                    })}

                    {/* Dot mode */}
                    {viewMode === 'dots' && filteredShots.map((s, i) => {
                      const { sx, sy } = nbaToSvg(s.x, s.y);
                      return (
                        <motion.circle
                          key={`${s.x}-${s.y}-${i}`}
                          cx={sx}
                          cy={sy}
                          r={3.5}
                          fill={s.made === 1 ? '#34D399' : '#F87171'}
                          fillOpacity={0.8}
                          initial={{ r: 0, opacity: 0 }}
                          animate={{ r: 3.5, opacity: 0.8 }}
                          transition={{
                            type: 'spring',
                            stiffness: 120,
                            damping: 14,
                            delay: Math.min(i * 0.002, 1),
                          }}
                        />
                      );
                    })}
                  </svg>
                </div>

                {/* Legend */}
                <div className="flex items-center justify-center gap-4 mt-3">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-accent-green" />
                    <span className="text-[10px] text-chrome-dim">Made</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-accent-red" />
                    <span className="text-[10px] text-chrome-dim">Missed</span>
                  </div>
                </div>
              </GlassCard>
            </motion.div>

            {/* ── Summary Stats ────────────────────────────────────────── */}
            {summary && (
              <motion.div variants={fadeUp} className="mb-6">
                <SectionHeader title="Summary" eyebrow={selectedSeason || 'All'} className="mb-3" />
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                  <GlassCard className="flex items-center justify-center p-3">
                    <MetricChip label="FGA" value={summary.fga.toLocaleString()} size="md" />
                  </GlassCard>
                  <GlassCard className="flex items-center justify-center p-3">
                    <MetricChip label="FG%" value={`${summary.fgPct}`} highlight size="md" />
                  </GlassCard>
                  <GlassCard className="flex items-center justify-center p-3">
                    <MetricChip label="2PT%" value={`${summary.twoPct}`} size="md" />
                  </GlassCard>
                  <GlassCard className="flex items-center justify-center p-3">
                    <MetricChip label="3PT%" value={`${summary.threePct}`} size="md" />
                  </GlassCard>
                  <GlassCard className="flex items-center justify-center p-3">
                    <MetricChip label="Paint%" value={`${summary.paintPct}`} size="md" />
                  </GlassCard>
                  <GlassCard className="flex items-center justify-center p-3">
                    <MetricChip label="Mid%" value={`${summary.midPct}`} size="md" />
                  </GlassCard>
                </div>
              </motion.div>
            )}

            {/* ── Zone Stats Table ─────────────────────────────────────── */}
            {zones.length > 0 && (
              <motion.div variants={fadeUp} className="mb-6">
                <SectionHeader title="Zone Breakdown" eyebrow="By Area" className="mb-3" />
                <GlassCard className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-glass-border">
                        <th className="text-left px-3 py-2 text-chrome-dim font-medium">Zone</th>
                        <th className="text-left px-3 py-2 text-chrome-dim font-medium">Area</th>
                        <th className="text-right px-3 py-2 text-chrome-dim font-medium">FG%</th>
                        <th className="text-right px-3 py-2 text-chrome-dim font-medium">Makes</th>
                        <th className="text-right px-3 py-2 text-chrome-dim font-medium">Att</th>
                        <th className="text-right px-3 py-2 text-chrome-dim font-medium">Avg Dist</th>
                      </tr>
                    </thead>
                    <tbody>
                      {zones.map((z) => (
                        <tr key={`${z.zone}-${z.area}`} className="border-b border-glass-border/30 hover:bg-glass-frosted transition-colors">
                          <td className="px-3 py-2 text-chrome-light">{z.zone}</td>
                          <td className="px-3 py-2 text-chrome-medium">{z.area}</td>
                          <td className="text-right px-3 py-2 font-mono font-bold" style={{ color: Number(z.fgPct) >= 50 ? '#34D399' : Number(z.fgPct) >= 35 ? '#FBBF24' : '#F87171' }}>
                            {z.fgPct}%
                          </td>
                          <td className="text-right px-3 py-2 text-chrome-medium font-mono">{z.makes}</td>
                          <td className="text-right px-3 py-2 text-chrome-medium font-mono">{z.attempts}</td>
                          <td className="text-right px-3 py-2 text-chrome-medium font-mono">{z.avgDistance} ft</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </GlassCard>
              </motion.div>
            )}

            {/* ── Shot Type Breakdown ──────────────────────────────────── */}
            {actionBreakdown.length > 0 && (
              <motion.div variants={fadeUp} className="mb-6">
                <SectionHeader title="Shot Type Breakdown" eyebrow="By Action" className="mb-3" />
                <GlassCard className="p-4 sm:p-6">
                  <div className="flex flex-col gap-2.5">
                    {actionBreakdown.map((action, i) => {
                      const barPct = (action.attempts / maxAttempts) * 100;
                      const fgVal = Number(action.fgPct);
                      const barColor = fgVal >= 50 ? '#34D399' : fgVal >= 35 ? '#FBBF24' : '#F87171';
                      return (
                        <div key={action.label} className="flex items-center gap-3">
                          <span className="text-[10px] text-chrome-medium w-36 truncate text-right shrink-0">
                            {action.label}
                          </span>
                          <div className="flex-1 h-4 rounded-full bg-glass-bg overflow-hidden relative">
                            <motion.div
                              className="h-full rounded-full"
                              style={{ background: barColor }}
                              initial={{ width: 0 }}
                              animate={{ width: `${barPct}%` }}
                              transition={{ duration: 0.6, delay: i * 0.04, ease: [0.4, 0, 0.2, 1] }}
                            />
                          </div>
                          <span className="text-[10px] text-chrome-light font-mono font-bold w-10 text-right shrink-0">
                            {action.fgPct}%
                          </span>
                          <span className="text-[10px] text-chrome-dim font-mono w-8 text-right shrink-0">
                            ({action.attempts})
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </GlassCard>
              </motion.div>
            )}
          </>
        )}

        {/* No shots found state */}
        {!loading && !error && playerName && shots.length === 0 && !loading && (
          <GlassCard className="p-8 text-center">
            <Target size={40} className="mx-auto mb-3 text-chrome-dim" />
            <h3 className="text-lg font-bold text-chrome-light mb-1">No Shot Data</h3>
            <p className="text-sm text-chrome-dim">
              No shot data found for {playerName}{selectedSeason ? ` (${selectedSeason})` : ''}.
            </p>
          </GlassCard>
        )}
      </motion.div>
    </div>
  );
}
