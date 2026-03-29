'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Flame, BarChart3, Target } from 'lucide-react';
import HotZoneChart from '@/components/court/HotZoneChart';
import Court3DWrapper from '@/components/court/Court3DWrapper';
import CourtLegend from '@/components/court/CourtLegend';
import ZoneTrendChart from '@/components/charts/ZoneTrendChart';
import ShotDNACard from '@/components/cards/ShotDNACard';
import GlassCard from '@/components/ui/GlassCard';
import MetricChip from '@/components/ui/MetricChip';
import SectionHeader from '@/components/ui/SectionHeader';
import SkeletonLoader from '@/components/ui/SkeletonLoader';
import Badge from '@/components/ui/Badge';
import PlayerAvatar from '@/components/ui/PlayerAvatar';
import { ZONES, type ZoneName } from '@/lib/shot-constants';
import { type ZoneAggregation, generateSignatureNarrative } from '@/lib/zone-engine';
import { colors, motionPresets } from '@/lib/design-tokens';
import { useSeasonType } from '@/lib/season-context';

// ── Types ────────────────────────────────────────────────────────────────────

interface PlayerZoneData {
  player: string;
  season: string;
  totalShots: number;
  zones: ZoneAggregation[];
  topZone: { zone: string; fgPct: number } | null;
  coldestZone: { zone: string; fgPct: number } | null;
  shotSignature: string;
}

interface HeatmapData {
  player: string;
  season: string;
  shots: Array<{ x: number; y: number; made: number; zone: string }>;
  totalShots: number;
}

interface LeagueData {
  season: string;
  zones: ZoneAggregation[];
  leagueAvgFgPct: number;
}

interface SimilarPlayer {
  player: string;
  similarity: number;
  signature: string;
  totalShots: number;
  topZone: string;
  topZoneFgPct: number;
}

type ViewMode = 'efficiency' | 'frequency' | 'makes';

// ── Component ────────────────────────────────────────────────────────────────

export default function PlayerZonePage() {
  const params = useParams();
  const playerName = decodeURIComponent(params.player as string);
  const { seasonType } = useSeasonType();

  const [playerData, setPlayerData] = useState<PlayerZoneData | null>(null);
  const [heatmapData, setHeatmapData] = useState<HeatmapData | null>(null);
  const [leagueData, setLeagueData] = useState<LeagueData | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<ViewMode>('efficiency');
  const [selectedSeason, setSelectedSeason] = useState<string | null>(null);
  const [similarPlayers, setSimilarPlayers] = useState<SimilarPlayer[]>([]);
  const [availableSeasons, setAvailableSeasons] = useState<string[]>([]);
  const [highlightZone, setHighlightZone] = useState<ZoneName | null>(null);

  // ── League baseline ──────────────────────────────────────────────────────

  const leagueBaseline = useMemo(() => {
    if (!leagueData) return {};
    const map: Record<string, number> = {};
    for (const z of leagueData.zones) {
      map[z.zone] = z.fgPct;
    }
    return map;
  }, [leagueData]);

  // ── Fetch data ───────────────────────────────────────────────────────────

  useEffect(() => {
    fetch('/api/zones/league')
      .then((r) => r.json())
      .then((d) => setLeagueData(d))
      .catch(() => {});
  }, []);

  useEffect(() => {
    // Get available seasons, then set the first one to trigger data load
    fetch(`/api/players/${encodeURIComponent(playerName)}/shots?zones=true&seasonType=${seasonType}`)
      .then((r) => r.json())
      .then((d) => {
        const seasons = (d.seasons ?? []).map((s: { season: string }) => s.season);
        setAvailableSeasons(seasons);
        if (seasons.length > 0) {
          setSelectedSeason(seasons[0]);
        } else {
          // No seasons found — load without season filter
          setSelectedSeason('all');
        }
      })
      .catch(() => {
        // On error, load without season filter
        setSelectedSeason('all');
      });
  }, [playerName, seasonType]);

  const loadPlayerData = useCallback(async () => {
    setLoading(true);
    try {
      const seasonQ = selectedSeason && selectedSeason !== 'all' ? `?season=${encodeURIComponent(selectedSeason)}` : '';
      const [zoneRes, heatRes] = await Promise.all([
        fetch(`/api/zones/player/${encodeURIComponent(playerName)}${seasonQ}`),
        fetch(`/api/zones/heatmap/${encodeURIComponent(playerName)}${seasonQ}${seasonQ ? '&' : '?'}limit=5000`),
      ]);

      const zoneJson = await zoneRes.json();
      const heatJson = await heatRes.json();

      if (zoneRes.ok) setPlayerData(zoneJson);
      if (heatRes.ok) setHeatmapData(heatJson);

      // Load similar players in background
      const simQ = selectedSeason ? `&season=${encodeURIComponent(selectedSeason)}` : '';
      fetch(`/api/zones/similar?player=${encodeURIComponent(playerName)}${simQ}&limit=5`)
        .then((r) => r.json())
        .then((d) => setSimilarPlayers(d.similar ?? []))
        .catch(() => setSimilarPlayers([]));
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [playerName, selectedSeason]);

  useEffect(() => {
    if (selectedSeason) loadPlayerData();
  }, [selectedSeason, loadPlayerData]);

  // ── Sorted zones for table ───────────────────────────────────────────────

  const sortedZones = useMemo(() => {
    if (!playerData) return [];
    return [...playerData.zones].sort((a, b) => b.attempts - a.attempts);
  }, [playerData]);

  // ── Narrative ────────────────────────────────────────────────────────────

  const narrative = useMemo(() => {
    if (!playerData) return '';
    return generateSignatureNarrative(
      playerData.player,
      playerData.shotSignature,
      playerData.zones,
      playerData.totalShots,
    );
  }, [playerData]);

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen pb-32">
      {/* Header */}
      <section className="relative pt-6 pb-4 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <Link
            href="/zones"
            className="inline-flex items-center gap-1.5 text-sm text-[#86868B] hover:text-[#1D1D1F] transition-colors mb-4"
          >
            <ArrowLeft size={14} />
            Back to Hot Zones
          </Link>

          <motion.div {...motionPresets.fadeInUp}>
            <div className="flex items-center gap-3 mb-1">
              <PlayerAvatar name={playerName} size="xl" />
              <h1 className="font-display font-extrabold text-3xl sm:text-4xl tracking-tight text-[#1D1D1F]">
                {playerName}
              </h1>
              {playerData && (
                <Badge variant="accent" className="text-xs">
                  {playerData.shotSignature}
                </Badge>
              )}
            </div>
            {playerData && (
              <p className="text-[#86868B] text-sm">
                {playerData.totalShots.toLocaleString()} shots &middot; {playerData.season}
              </p>
            )}
          </motion.div>
        </div>
      </section>

      {/* Controls */}
      <section className="px-4 sm:px-6 lg:px-8 mb-6">
        <div className="mx-auto max-w-6xl flex flex-wrap items-center gap-4">
          {/* Mode toggle */}
          <div className="flex rounded-full border border-black/[0.06] bg-white p-1 gap-0.5">
            {(['efficiency', 'frequency', 'makes'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
                  mode === m
                    ? 'bg-[#FF6B35]/10 text-[#FF6B35]'
                    : 'text-[#86868B] hover:text-[#1D1D1F]'
                }`}
              >
                {m === 'efficiency' ? 'Efficiency' : m === 'frequency' ? 'Frequency' : 'Makes'}
              </button>
            ))}
          </div>

          {/* Season selector */}
          {availableSeasons.length > 0 && (
            <div className="flex rounded-full border border-black/[0.06] bg-white px-3 py-1.5">
              <select
                value={selectedSeason ?? ''}
                onChange={(e) => setSelectedSeason(e.target.value)}
                className="bg-transparent text-xs font-semibold text-[#1D1D1F] outline-none cursor-pointer"
              >
                {availableSeasons.map((s) => (
                  <option key={s} value={s} className="bg-white text-[#1D1D1F]">
                    {s}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </section>

      {/* Main content */}
      <section className="px-4 sm:px-6 lg:px-8 mb-12">
        <div className="mx-auto max-w-6xl">
          {loading ? (
            <div className="flex flex-col xl:flex-row gap-8">
              <SkeletonLoader width={700} height={658} rounded="lg" />
              <div className="flex-1 space-y-4">
                <SkeletonLoader width="100%" height={200} rounded="lg" />
                <SkeletonLoader width="100%" height={300} rounded="lg" />
              </div>
            </div>
          ) : playerData && heatmapData ? (
            <div className="flex flex-col xl:flex-row gap-8 items-start">
              {/* Hero heatmap with 3D */}
              <motion.div className="shrink-0" {...motionPresets.scaleIn}>
                <Court3DWrapper showHoop showFloor interactive>
                  <HotZoneChart
                    shots={heatmapData.shots}
                    leagueBaseline={leagueBaseline}
                    mode={mode}
                    showHexbin
                    showZoneFills
                    showZoneLabels
                    highlightZone={highlightZone}
                    animated
                    size="xl"
                  />
                </Court3DWrapper>
                <div className="mt-8">
                  <CourtLegend />
                </div>
              </motion.div>

              {/* Right panel */}
              <div className="flex-1 min-w-0 space-y-6">
                {/* Shot Signature Card */}
                <motion.div {...motionPresets.fadeInUp} transition={{ ...motionPresets.fadeInUp.transition, delay: 0.1 }}>
                  <GlassCard tintColor={colors.accentOrange} className="p-5 bg-white border border-black/[0.06]">
                    <div className="flex items-center gap-2 mb-3">
                      <Target size={18} className="text-[#FF6B35]" />
                      <h3 className="text-sm font-semibold uppercase tracking-wider text-[#FF6B35]">
                        Shot Signature
                      </h3>
                    </div>
                    <p className="text-xl font-extrabold text-[#1D1D1F] font-display mb-2">
                      {playerData.shotSignature}
                    </p>
                    <p className="text-sm text-[#6E6E73] leading-relaxed">
                      {narrative}
                    </p>
                    <div className="flex gap-4 mt-4">
                      {playerData.topZone && (
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-[#86868B] mb-0.5">Hottest Zone</p>
                          <p className="text-sm font-bold text-[#22C55E]">
                            {playerData.topZone.zone} ({(playerData.topZone.fgPct * 100).toFixed(1)}%)
                          </p>
                        </div>
                      )}
                      {playerData.coldestZone && (
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-[#86868B] mb-0.5">Coldest Zone</p>
                          <p className="text-sm font-bold text-[#0071E3]">
                            {playerData.coldestZone.zone} ({(playerData.coldestZone.fgPct * 100).toFixed(1)}%)
                          </p>
                        </div>
                      )}
                    </div>
                  </GlassCard>
                </motion.div>

                {/* Quick stats */}
                <motion.div
                  className="flex flex-wrap gap-2"
                  {...motionPresets.fadeInUp}
                  transition={{ ...motionPresets.fadeInUp.transition, delay: 0.15 }}
                >
                  <MetricChip
                    label="Total Shots"
                    value={playerData.totalShots.toLocaleString()}
                    size="md"
                  />
                  <MetricChip
                    label="Overall FG%"
                    value={`${((playerData.zones.reduce((s, z) => s + z.makes, 0) / Math.max(1, playerData.totalShots)) * 100).toFixed(1)}%`}
                    size="md"
                    highlight
                  />
                  <MetricChip
                    label="ePts/Att"
                    value={(playerData.zones.reduce((s, z) => s + z.ePtsPerAttempt * z.attempts, 0) / Math.max(1, playerData.totalShots)).toFixed(3)}
                    size="md"
                  />
                </motion.div>

                {/* Shot Distribution stacked bar */}
                <motion.div
                  {...motionPresets.fadeInUp}
                  transition={{ ...motionPresets.fadeInUp.transition, delay: 0.18 }}
                >
                  <GlassCard className="p-4">
                    <p className="text-[10px] uppercase tracking-wider text-[#86868B] mb-3 font-semibold">
                      Shot Distribution
                    </p>
                    <div className="flex h-3 rounded-full overflow-hidden gap-[1px]">
                      {sortedZones
                        .filter((z) => z.zone !== 'Backcourt')
                        .map((z) => {
                          const zoneColors: Record<string, string> = {
                            'Restricted Area': colors.accentRed,
                            'In The Paint (Non-RA)': colors.accentOrange,
                            'Mid-Range': colors.accentGold,
                            'Left Corner 3': colors.accentGreen,
                            'Right Corner 3': '#34D399',
                            'Above the Break 3': colors.accentBlue,
                          };
                          return (
                            <motion.div
                              key={z.zone}
                              className="h-full first:rounded-l-full last:rounded-r-full"
                              style={{ background: zoneColors[z.zone] ?? colors.chromeDim }}
                              initial={{ width: 0 }}
                              animate={{ width: `${z.attPct * 100}%` }}
                              transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1], delay: 0.3 }}
                              title={`${ZONES[z.zone as ZoneName]?.label}: ${(z.attPct * 100).toFixed(1)}%`}
                            />
                          );
                        })}
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2.5">
                      {sortedZones
                        .filter((z) => z.zone !== 'Backcourt')
                        .map((z) => {
                          const zoneColors: Record<string, string> = {
                            'Restricted Area': colors.accentRed,
                            'In The Paint (Non-RA)': colors.accentOrange,
                            'Mid-Range': colors.accentGold,
                            'Left Corner 3': colors.accentGreen,
                            'Right Corner 3': '#34D399',
                            'Above the Break 3': colors.accentBlue,
                          };
                          return (
                            <div key={z.zone} className="flex items-center gap-1.5">
                              <div className="w-2 h-2 rounded-full" style={{ background: zoneColors[z.zone] ?? colors.chromeDim }} />
                              <span className="text-[9px] text-[#86868B]">
                                {ZONES[z.zone as ZoneName]?.shortLabel} {(z.attPct * 100).toFixed(0)}%
                              </span>
                            </div>
                          );
                        })}
                    </div>
                  </GlassCard>
                </motion.div>

                {/* Zone breakdown table */}
                <motion.div
                  {...motionPresets.fadeInUp}
                  transition={{ ...motionPresets.fadeInUp.transition, delay: 0.25 }}
                >
                  <GlassCard className="p-0 overflow-hidden">
                    <div className="px-5 py-3 border-b border-black/[0.06]">
                      <div className="flex items-center gap-2">
                        <BarChart3 size={16} className="text-[#FF6B35]" />
                        <h3 className="text-sm font-semibold text-[#1D1D1F]">Zone Breakdown</h3>
                      </div>
                    </div>

                    {/* Table header */}
                    <div className="grid grid-cols-[1fr_70px_60px_70px_60px_70px] gap-2 px-5 py-2 text-[10px] uppercase tracking-wider text-[#86868B] border-b border-black/[0.06]">
                      <span>Zone</span>
                      <span className="text-right">FG%</span>
                      <span className="text-right">Att</span>
                      <span className="text-right">Makes</span>
                      <span className="text-right">Att%</span>
                      <span className="text-right">ePts</span>
                    </div>

                    {/* Table rows */}
                    {sortedZones.map((z, i) => {
                      const avg = leagueBaseline[z.zone] ?? 0.45;
                      const diff = z.fgPct - avg;
                      const isHot = diff > 0.02;
                      const isCold = diff < -0.02;

                      return (
                        <div
                          key={z.zone}
                          className={`grid grid-cols-[1fr_70px_60px_70px_60px_70px] gap-2 px-5 py-2.5 border-b border-black/[0.04] hover:bg-[#F5F5F7] transition-colors cursor-pointer ${i % 2 === 1 ? 'bg-[#F5F5F7]' : 'bg-white'}`}
                          onPointerEnter={() => setHighlightZone(z.zone)}
                          onPointerLeave={() => setHighlightZone(null)}
                        >
                          <span className="text-sm text-[#1D1D1F] font-medium truncate">
                            {ZONES[z.zone as ZoneName]?.label ?? z.zone}
                          </span>
                          <span className={`text-sm font-bold text-right tabular-nums ${
                            isHot ? 'text-[#22C55E]' : isCold ? 'text-[#EF4444]' : 'text-[#1D1D1F]'
                          }`}>
                            {(z.fgPct * 100).toFixed(1)}%
                          </span>
                          <span className="text-sm text-[#6E6E73] text-right tabular-nums">
                            {z.attempts}
                          </span>
                          <span className="text-sm text-[#6E6E73] text-right tabular-nums">
                            {z.makes}
                          </span>
                          <span className="text-sm text-[#86868B] text-right tabular-nums">
                            {(z.attPct * 100).toFixed(1)}%
                          </span>
                          <span className="text-sm text-[#6E6E73] text-right tabular-nums">
                            {z.ePtsPerAttempt.toFixed(3)}
                          </span>
                        </div>
                      );
                    })}
                  </GlassCard>
                </motion.div>
              </div>
            </div>
          ) : (
            <div className="text-center py-20">
              <Flame size={48} className="text-[#86868B]/30 mx-auto mb-4" />
              <p className="text-[#86868B] text-sm">No shot data available for {playerName}</p>
              <Link
                href="/zones"
                className="inline-flex items-center gap-1.5 mt-4 text-sm text-[#FF6B35] hover:text-[#FF6B35]/80 transition-colors"
              >
                <ArrowLeft size={14} />
                Back to Hot Zones
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* ── Shot DNA ──────────────────────────────────────────────────────── */}
      {playerData && (
        <section className="px-4 sm:px-6 lg:px-8 mb-16">
          <div className="mx-auto max-w-6xl">
            <SectionHeader
              eyebrow="Fingerprint"
              title="Shot DNA"
              className="mb-6"
            />
            <ShotDNACard playerName={playerName} season={selectedSeason ?? undefined} />
          </div>
        </section>
      )}

      {/* ── Zone Trend Chart ──────────────────────────────────────────────── */}
      {playerData && (
        <section className="px-4 sm:px-6 lg:px-8 mb-16">
          <div className="mx-auto max-w-6xl">
            <SectionHeader
              eyebrow="Evolution"
              title="Zone Distribution Over Career"
              className="mb-6"
            />
            <GlassCard className="p-5">
              <ZoneTrendChart playerName={playerName} height={320} />
            </GlassCard>
          </div>
        </section>
      )}

      {/* ── Similar Shooters ───────────────────────────────────────────────── */}
      {similarPlayers.length > 0 && (
        <section className="px-4 sm:px-6 lg:px-8 mb-16">
          <div className="mx-auto max-w-6xl">
            <SectionHeader
              eyebrow="Similarity"
              title="Similar Shooting Profiles"
              className="mb-6"
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
              {similarPlayers.map((sp, i) => (
                <motion.div
                  key={sp.player}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06, type: 'spring', stiffness: 200, damping: 20 }}
                >
                  <Link href={`/zones/${encodeURIComponent(sp.player)}`}>
                    <GlassCard hoverable className="p-4 bg-white border border-black/[0.06]">
                      <div className="flex items-center gap-2 mb-1">
                        <PlayerAvatar name={sp.player} size="sm" />
                        <h4 className="text-sm font-bold text-[#1D1D1F] truncate">
                          {sp.player}
                        </h4>
                      </div>
                      <Badge variant="accent" className="text-[8px] mb-2">
                        {sp.signature}
                      </Badge>
                      <div className="flex items-center gap-2 mb-1.5">
                        <div className="flex-1 h-1.5 rounded-full bg-[#F5F5F7] overflow-hidden">
                          <motion.div
                            className="h-full rounded-full bg-[#FF6B35]"
                            initial={{ width: 0 }}
                            animate={{ width: `${sp.similarity * 100}%` }}
                            transition={{ delay: i * 0.06 + 0.3, duration: 0.5 }}
                          />
                        </div>
                        <span className="text-[10px] font-bold text-[#FF6B35] tabular-nums">
                          {(sp.similarity * 100).toFixed(0)}%
                        </span>
                      </div>
                      <p className="text-[10px] text-[#86868B]">
                        {sp.totalShots} shots &middot; Best: {sp.topZone.replace(' (Non-RA)', '')} ({(sp.topZoneFgPct * 100).toFixed(0)}%)
                      </p>
                    </GlassCard>
                  </Link>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
