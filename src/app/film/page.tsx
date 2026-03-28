'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Film,
  Upload,
  Filter,
  Tag,
  Play,
  User,
  Grid,
  ArrowRight,
  ChevronRight,
  X,
  Sparkles,
  Brain,
  Eye,
  Shield,
  Target,
  Crosshair,
  Activity,
  CheckCircle,
  AlertCircle,
  Clock,
  Cpu,
} from 'lucide-react';
import Link from 'next/link';
import clsx from 'clsx';
import GlassCard from '@/components/ui/GlassCard';
import Badge from '@/components/ui/Badge';
import SkeletonLoader from '@/components/ui/SkeletonLoader';
import EmptyState from '@/components/ui/EmptyState';
import ClipCard from '@/components/film/ClipCard';
import TagBadge from '@/components/film/TagBadge';
import FilmSearch from '@/components/film/FilmSearch';

// ── Types ────────────────────────────────────────────────────────────────────

interface ClipData {
  readonly id: number;
  readonly title: string | null;
  readonly start_time: number;
  readonly end_time: number;
  readonly duration: number;
  readonly thumbnail_path: string | null;
  readonly play_type: string | null;
  readonly primary_action: string | null;
  readonly primary_player: string | null;
  readonly quarter: number | null;
  readonly game_clock: string | null;
  readonly confidence: number;
}

interface ClipTag {
  readonly name: string;
  readonly category: string;
}

interface TagInfo {
  readonly name: string;
  readonly category: string;
  readonly count: number;
}

interface PlayTypeCount {
  readonly play_type: string;
  readonly count: number;
}

interface PlayerCount {
  readonly player: string;
  readonly count: number;
}

// ── Animation variants ───────────────────────────────────────────────────────

const stagger = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.1 },
  },
};

const fadeSlideUp = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring' as const, stiffness: 120, damping: 14 },
  },
};

// ── Play type color mapping ─────────────────────────────────────────────────

const PLAY_TYPE_COLORS: Record<string, string> = {
  isolation: 'from-[#FF6B35]/10 to-[#FF6B35]/5',
  'pick-and-roll': 'from-[#0071E3]/10 to-[#0071E3]/5',
  'spot-up': 'from-[#22C55E]/10 to-[#22C55E]/5',
  transition: 'from-accent-violet/10 to-accent-violet/5',
  'post-up': 'from-accent-gold/10 to-accent-gold/5',
  'off-screen': 'from-[#EF4444]/10 to-[#EF4444]/5',
  handoff: 'from-[#0071E3]/10 to-[#0071E3]/5',
  cut: 'from-[#22C55E]/10 to-[#22C55E]/5',
};

function getPlayTypeGradient(playType: string): string {
  const lower = playType.toLowerCase();
  return PLAY_TYPE_COLORS[lower] ?? 'from-black/5 to-black/[0.02]';
}

// ── Component ────────────────────────────────────────────────────────────────

export default function FilmLibraryPage() {
  const [clips, setClips] = useState<readonly ClipData[]>([]);
  const [tags, setTags] = useState<readonly TagInfo[]>([]);
  const [totalClips, setTotalClips] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activePlayType, setActivePlayType] = useState<string | null>(null);
  const [activePlayer, setActivePlayer] = useState<string | null>(null);
  const [filteredClips, setFilteredClips] = useState<readonly ClipData[]>([]);
  const [playTypeCounts, setPlayTypeCounts] = useState<readonly PlayTypeCount[]>([]);
  const [playerCounts, setPlayerCounts] = useState<readonly PlayerCount[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  const scrollRowRef = useRef<HTMLDivElement>(null);

  // ── Fetch initial data ──────────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      fetch('/api/film/clips?limit=20').then((r) => r.json()).catch(() => ({ clips: [], total: 0 })),
      fetch('/api/film/tags').then((r) => r.json()).catch(() => ({ tags: [], categories: [] })),
    ]).then(([clipsData, tagsData]) => {
      if (cancelled) return;

      const fetchedClips = clipsData.clips ?? [];
      setClips(fetchedClips);
      setFilteredClips(fetchedClips);
      setTotalClips(clipsData.total ?? 0);
      setTags(tagsData.tags ?? []);

      // Derive play type counts from clips
      const ptMap = new Map<string, number>();
      const plMap = new Map<string, number>();
      for (const clip of fetchedClips) {
        if (clip.play_type) {
          ptMap.set(clip.play_type, (ptMap.get(clip.play_type) ?? 0) + 1);
        }
        if (clip.primary_player) {
          plMap.set(clip.primary_player, (plMap.get(clip.primary_player) ?? 0) + 1);
        }
      }

      const ptCounts = Array.from(ptMap.entries())
        .map(([play_type, count]) => ({ play_type, count }))
        .sort((a, b) => b.count - a.count);
      const plCounts = Array.from(plMap.entries())
        .map(([player, count]) => ({ player, count }))
        .sort((a, b) => b.count - a.count);

      setPlayTypeCounts(ptCounts);
      setPlayerCounts(plCounts);
      setLoading(false);
    });

    return () => { cancelled = true; };
  }, []);

  // ── Search + filter logic ───────────────────────────────────────────────────

  useEffect(() => {
    let result = [...clips];

    if (searchQuery.trim().length >= 2) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (c) =>
          (c.title?.toLowerCase().includes(q)) ||
          (c.play_type?.toLowerCase().includes(q)) ||
          (c.primary_player?.toLowerCase().includes(q)) ||
          (c.primary_action?.toLowerCase().includes(q)),
      );
    }

    if (activePlayType) {
      result = result.filter((c) => c.play_type === activePlayType);
    }

    if (activePlayer) {
      result = result.filter((c) => c.primary_player === activePlayer);
    }

    setFilteredClips(result);
  }, [clips, searchQuery, activePlayType, activePlayer]);

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
  }, []);

  const handlePlayTypeFilter = useCallback((pt: string) => {
    setActivePlayType((prev) => (prev === pt ? null : pt));
  }, []);

  const handlePlayerFilter = useCallback((player: string) => {
    setActivePlayer((prev) => (prev === player ? null : player));
  }, []);

  const clearFilters = useCallback(() => {
    setActivePlayType(null);
    setActivePlayer(null);
    setSearchQuery('');
  }, []);

  const hasActiveFilters = activePlayType !== null || activePlayer !== null || searchQuery.length >= 2;

  // ── Loading skeleton ────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 pb-24">
        <div className="pt-10 sm:pt-14 pb-6 space-y-3">
          <SkeletonLoader height={48} width={300} rounded="lg" />
          <SkeletonLoader height={20} width={400} rounded="full" />
        </div>
        <SkeletonLoader height={48} rounded="xl" className="w-full mb-6" />
        <div className="flex gap-3 mb-8">
          <SkeletonLoader height={40} width={120} rounded="lg" />
          <SkeletonLoader height={40} width={100} rounded="lg" />
          <SkeletonLoader height={40} width={100} rounded="lg" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <SkeletonLoader key={i} className="h-[240px] rounded-[20px]" />
          ))}
        </div>
      </div>
    );
  }

  // ── Empty library state ─────────────────────────────────────────────────────

  if (totalClips === 0 && !loading) {
    return (
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 pb-24">
        {/* Hero */}
        <motion.div
          className="pt-10 sm:pt-14 pb-8 text-center"
          initial="hidden"
          animate="visible"
          variants={stagger}
        >
          <motion.div variants={fadeSlideUp} className="flex items-center justify-center gap-3 mb-4">
            <Film size={32} className="text-[#FF6B35]" />
            <h1 className="font-display font-extrabold text-4xl sm:text-5xl lg:text-6xl tracking-[0.08em] text-[#1D1D1F] uppercase">
              Film Room
            </h1>
          </motion.div>
          <motion.p variants={fadeSlideUp} className="text-sm sm:text-base text-[#6E6E73] max-w-lg mx-auto">
            Basketball Intelligence from Video
          </motion.p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 120, damping: 14 }}
        >
          <EmptyState
            icon={Film}
            title="No Film Yet"
            subtitle="Upload your first game footage to start building your basketball intelligence library."
            action={
              <Link
                href="/film/upload"
                className={clsx(
                  'inline-flex items-center gap-2 px-6 py-3 rounded-full',
                  'bg-[#FF6B35] text-white text-sm font-bold tracking-wide',
                  'shadow-[0_0_20px_rgba(255,107,53,0.25)]',
                  'hover:shadow-[0_0_30px_rgba(255,107,53,0.35)]',
                  'transition-all duration-200',
                )}
              >
                <Upload size={16} />
                Upload Film
              </Link>
            }
          />
        </motion.div>
      </div>
    );
  }

  // ── Main content ────────────────────────────────────────────────────────────

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 pb-24">
      <motion.div initial="hidden" animate="visible" variants={stagger}>
        {/* ── Hero Section ──────────────────────────────────────────────── */}
        <motion.div className="pt-10 sm:pt-14 pb-6" variants={fadeSlideUp}>
          <div className="flex items-center gap-3 mb-2">
            <Film size={28} className="text-[#FF6B35]" />
            <h1 className="font-display font-extrabold text-3xl sm:text-4xl lg:text-5xl tracking-[0.08em] text-[#1D1D1F] uppercase">
              Film Room
            </h1>
          </div>
          <p className="text-sm sm:text-base text-[#6E6E73]">
            Basketball Intelligence from Video
          </p>
        </motion.div>

        {/* ── Search Bar ────────────────────────────────────────────────── */}
        <motion.div variants={fadeSlideUp} className="mb-5">
          <FilmSearch
            value={searchQuery}
            onChange={handleSearchChange}
          />
        </motion.div>

        {/* ── Action Row: Upload + Filters ──────────────────────────────── */}
        <motion.div variants={fadeSlideUp} className="flex items-center gap-3 mb-6 flex-wrap">
          <Link
            href="/film/upload"
            className={clsx(
              'flex items-center gap-2 px-5 py-2.5 rounded-xl',
              'bg-[#FF6B35] text-white text-sm font-bold tracking-wide',
              'shadow-[0_0_20px_rgba(255,107,53,0.20)]',
              'hover:shadow-[0_0_30px_rgba(255,107,53,0.30)]',
              'transition-all duration-200',
            )}
          >
            <Upload size={15} />
            Upload
          </Link>

          <button
            type="button"
            onClick={() => setShowFilters((p) => !p)}
            className={clsx(
              'flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all',
              showFilters
                ? 'bg-[#0071E3]/10 border border-[#0071E3]/30 text-[#0071E3]'
                : 'bg-white border border-black/[0.06] text-[#86868B] hover:text-[#1D1D1F] hover:bg-[#F5F5F7]',
            )}
          >
            <Filter size={14} />
            Filters
          </button>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-[#86868B] hover:text-[#EF4444] transition-colors"
            >
              <X size={12} />
              Clear
            </button>
          )}

          {/* Stats pills */}
          <div className="flex items-center gap-2 ml-auto">
            <Badge variant="default">
              <Play size={10} className="mr-1" />
              {totalClips} clips
            </Badge>
            <Badge variant="default">
              <Tag size={10} className="mr-1" />
              {tags.length} tags
            </Badge>
          </div>
        </motion.div>

        {/* ── Filter Dropdowns ──────────────────────────────────────────── */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              className="mb-6 space-y-3"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            >
              {/* Play type filter chips */}
              {playTypeCounts.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] uppercase tracking-wider text-[#86868B] font-semibold shrink-0">
                    Play Type
                  </span>
                  {playTypeCounts.map(({ play_type, count }) => (
                    <button
                      key={play_type}
                      type="button"
                      onClick={() => handlePlayTypeFilter(play_type)}
                      className={clsx(
                        'px-3 py-1 rounded-full text-xs font-semibold transition-all',
                        activePlayType === play_type
                          ? 'bg-[#FF6B35]/10 text-[#FF6B35] border border-[#FF6B35]/30'
                          : 'bg-white border border-black/[0.06] text-[#86868B] hover:text-[#1D1D1F]',
                      )}
                    >
                      {play_type}
                      <span className="ml-1 text-[#86868B]/50">{count}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Player filter chips */}
              {playerCounts.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] uppercase tracking-wider text-[#86868B] font-semibold shrink-0">
                    Player
                  </span>
                  {playerCounts.slice(0, 10).map(({ player, count }) => (
                    <button
                      key={player}
                      type="button"
                      onClick={() => handlePlayerFilter(player)}
                      className={clsx(
                        'px-3 py-1 rounded-full text-xs font-semibold transition-all',
                        activePlayer === player
                          ? 'bg-[#0071E3]/10 text-[#0071E3] border border-[#0071E3]/30'
                          : 'bg-white border border-black/[0.06] text-[#86868B] hover:text-[#1D1D1F]',
                      )}
                    >
                      {player}
                      <span className="ml-1 text-[#86868B]/50">{count}</span>
                    </button>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Recent Clips — Horizontal Scroll ──────────────────────────── */}
        {!hasActiveFilters && (
          <motion.section variants={fadeSlideUp} className="mb-10">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-[#1D1D1F] tracking-wide">
                Recent Clips
              </h2>
              <span className="text-xs text-[#86868B]">
                {clips.length} of {totalClips}
              </span>
            </div>

            <div
              ref={scrollRowRef}
              className={clsx(
                'flex gap-4 overflow-x-auto pb-4',
                'scrollbar-thin scrollbar-track-transparent scrollbar-thumb-[#86868B]/20',
                'snap-x snap-mandatory',
              )}
            >
              {clips.slice(0, 12).map((clip) => (
                <div key={clip.id} className="snap-start shrink-0">
                  <Link href={`/film/${clip.id}`}>
                    <ClipCard
                      clip={clip}
                      size="md"
                      onClick={undefined}
                    />
                  </Link>
                </div>
              ))}
            </div>
          </motion.section>
        )}

        {/* ── Filtered Results Grid ─────────────────────────────────────── */}
        {hasActiveFilters && (
          <motion.section
            variants={fadeSlideUp}
            className="mb-10"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-[#1D1D1F] tracking-wide">
                {filteredClips.length} Result{filteredClips.length !== 1 ? 's' : ''}
              </h2>
              {activePlayType && (
                <Badge variant="accent">{activePlayType}</Badge>
              )}
              {activePlayer && (
                <Badge variant="accent">
                  <User size={10} className="mr-1" />
                  {activePlayer}
                </Badge>
              )}
            </div>

            {filteredClips.length === 0 ? (
              <div className="text-center py-16">
                <Film size={32} className="mx-auto mb-3 text-[#86868B]/30" />
                <p className="text-sm text-[#86868B]">No clips match your filters.</p>
              </div>
            ) : (
              <motion.div
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
                variants={stagger}
                initial="hidden"
                animate="visible"
              >
                {filteredClips.map((clip) => (
                  <motion.div key={clip.id} variants={fadeSlideUp}>
                    <Link href={`/film/${clip.id}`}>
                      <ClipCard clip={clip} size="md" className="w-full" />
                    </Link>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </motion.section>
        )}

        {/* ── By Play Type ──────────────────────────────────────────────── */}
        {!hasActiveFilters && playTypeCounts.length > 0 && (
          <motion.section variants={fadeSlideUp} className="mb-10">
            <h2 className="text-lg font-bold text-[#1D1D1F] tracking-wide mb-4">
              By Play Type
            </h2>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {playTypeCounts.map(({ play_type, count }, idx) => (
                <motion.div
                  key={play_type}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.04 }}
                >
                  <GlassCard
                    hoverable
                    pressable
                    className="p-4 h-full"
                    onClick={() => handlePlayTypeFilter(play_type)}
                  >
                    <div className={clsx(
                      'absolute inset-0 rounded-[20px] bg-gradient-to-br opacity-40',
                      getPlayTypeGradient(play_type),
                    )} />
                    <div className="relative z-10">
                      <div className="flex items-center gap-2 mb-2">
                        <Grid size={14} className="text-[#86868B]" />
                        <span className="text-xs font-bold uppercase tracking-wider text-[#6E6E73]">
                          {play_type}
                        </span>
                      </div>
                      <div className="text-2xl font-extrabold text-[#1D1D1F]">
                        {count}
                      </div>
                      <div className="text-[10px] text-[#86868B] mt-0.5">
                        clip{count !== 1 ? 's' : ''}
                      </div>
                    </div>
                  </GlassCard>
                </motion.div>
              ))}
            </div>
          </motion.section>
        )}

        {/* ── By Player ─────────────────────────────────────────────────── */}
        {!hasActiveFilters && playerCounts.length > 0 && (
          <motion.section variants={fadeSlideUp} className="mb-10">
            <h2 className="text-lg font-bold text-[#1D1D1F] tracking-wide mb-4">
              By Player
            </h2>

            <div className="space-y-2">
              {playerCounts.slice(0, 8).map(({ player, count }, idx) => (
                <motion.div
                  key={player}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.04 }}
                >
                  <GlassCard
                    hoverable
                    className="px-4 py-3"
                    onClick={() => handlePlayerFilter(player)}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold text-[#86868B]/50 w-5 text-right shrink-0">
                        {idx + 1}
                      </span>
                      <div
                        className={clsx(
                          'flex items-center justify-center shrink-0',
                          'h-9 w-9 rounded-full',
                          'bg-[#0071E3]/[0.08] border border-[#0071E3]/20',
                        )}
                      >
                        <User size={16} className="text-[#0071E3]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-[#1D1D1F] truncate">
                          {player}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-base font-bold text-[#FF6B35]">
                          {count}
                        </div>
                        <div className="text-[10px] text-[#86868B]">clips</div>
                      </div>
                      <ChevronRight size={14} className="text-[#86868B]/30 shrink-0" />
                    </div>
                  </GlassCard>
                </motion.div>
              ))}
            </div>
          </motion.section>
        )}

        {/* ── Tags Cloud ────────────────────────────────────────────────── */}
        {!hasActiveFilters && tags.length > 0 && (
          <motion.section variants={fadeSlideUp} className="mb-10">
            <h2 className="text-lg font-bold text-[#1D1D1F] tracking-wide mb-4">
              Tags
            </h2>

            <GlassCard className="p-5">
              <div className="flex flex-wrap gap-2">
                {tags.slice(0, 24).map((tag) => (
                  <TagBadge
                    key={`${tag.category}-${tag.name}`}
                    name={tag.name}
                    category={tag.category as 'action' | 'player' | 'team' | 'context' | 'quality' | 'custom'}
                    size="md"
                  />
                ))}
              </div>
            </GlassCard>
          </motion.section>
        )}
        {/* ── How It Works ─────────────────────────────────────────── */}
        {!hasActiveFilters && (
          <motion.section variants={fadeSlideUp} className="mb-10">
            <h2 className="text-lg font-bold text-[#1D1D1F] tracking-wide mb-4">
              How It Works
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                {
                  icon: Upload,
                  title: 'Upload',
                  description: 'Drop any basketball clip — game film, highlights, or practice footage.',
                  color: 'text-[#FF6B35]',
                  bg: 'bg-[#FF6B35]/[0.06]',
                  border: 'border-[#FF6B35]/15',
                },
                {
                  icon: Brain,
                  title: 'AI Analyzes',
                  description: 'Our pipeline detects plays, tags actions, identifies players, and classifies events.',
                  color: 'text-[#0071E3]',
                  bg: 'bg-[#0071E3]/[0.06]',
                  border: 'border-[#0071E3]/15',
                },
                {
                  icon: Eye,
                  title: 'Browse Insights',
                  description: 'Search, filter, and explore clips by player, play type, action, or tag.',
                  color: 'text-[#22C55E]',
                  bg: 'bg-[#22C55E]/[0.06]',
                  border: 'border-[#22C55E]/15',
                },
              ].map((step, idx) => (
                <GlassCard key={step.title} className="p-5 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className={clsx('flex items-center justify-center h-12 w-12 rounded-2xl', step.bg, 'border', step.border)}>
                      <step.icon size={22} className={step.color} />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-[#86868B]">STEP {idx + 1}</span>
                    </div>
                    <h3 className="text-base font-bold text-[#1D1D1F]">{step.title}</h3>
                    <p className="text-sm text-[#6E6E73] leading-relaxed">{step.description}</p>
                  </div>
                </GlassCard>
              ))}
            </div>
          </motion.section>
        )}

        {/* ── Coming Soon ────────────────────────────────────────────── */}
        {!hasActiveFilters && (
          <motion.section variants={fadeSlideUp} className="mb-10">
            <h2 className="text-lg font-bold text-[#1D1D1F] tracking-wide mb-4">
              Coming Soon
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                {
                  icon: Activity,
                  title: 'Play-by-Play Alignment',
                  description: 'Automatically sync video clips to live play-by-play data for frame-accurate context.',
                  color: 'text-[#FF6B35]',
                },
                {
                  icon: Crosshair,
                  title: 'Player Tracking',
                  description: 'Track player movement patterns, spacing, and off-ball activity across possessions.',
                  color: 'text-[#0071E3]',
                },
                {
                  icon: Target,
                  title: 'Shot Classification',
                  description: 'Classify shot types with deep learning — catch-and-shoot, pull-up, floater, and more.',
                  color: 'text-[#22C55E]',
                },
                {
                  icon: Shield,
                  title: 'Defensive Breakdowns',
                  description: 'Analyze defensive schemes, switches, closeouts, and help-side rotations automatically.',
                  color: 'text-accent-violet',
                },
              ].map((feature) => (
                <GlassCard key={feature.title} className="p-4">
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <feature.icon size={20} className={feature.color} />
                      <Badge variant="default">Coming Soon</Badge>
                    </div>
                    <h3 className="text-sm font-bold text-[#1D1D1F]">{feature.title}</h3>
                    <p className="text-xs text-[#86868B] leading-relaxed">{feature.description}</p>
                  </div>
                </GlassCard>
              ))}
            </div>
          </motion.section>
        )}

        {/* ── Pipeline Status Dashboard ──────────────────────────────── */}
        {!hasActiveFilters && (
          <motion.section variants={fadeSlideUp} className="mb-10">
            <h2 className="text-lg font-bold text-[#1D1D1F] tracking-wide mb-4">
              Pipeline Status
            </h2>
            <GlassCard className="p-5">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'Python Pipeline', icon: Cpu, status: 'active', detail: 'Ready' },
                  { label: 'ML Models', icon: Sparkles, status: 'pending', detail: 'Mock mode' },
                  { label: 'Clips in Queue', icon: Clock, status: 'active', detail: '0 pending' },
                  { label: 'Last Processed', icon: CheckCircle, status: 'active', detail: totalClips > 0 ? `${totalClips} clips` : 'No clips yet' },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-3 p-3 rounded-xl bg-[#F5F5F7] border border-black/[0.06]">
                    <div className={clsx(
                      'flex items-center justify-center h-9 w-9 rounded-lg shrink-0',
                      item.status === 'active' ? 'bg-[#22C55E]/[0.08] border border-[#22C55E]/20' : 'bg-accent-gold/[0.08] border border-accent-gold/20',
                    )}>
                      <item.icon size={16} className={item.status === 'active' ? 'text-[#22C55E]' : 'text-accent-gold'} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs text-[#86868B]">{item.label}</div>
                      <div className="text-sm font-medium text-[#1D1D1F] truncate">{item.detail}</div>
                    </div>
                  </div>
                ))}
              </div>
            </GlassCard>
          </motion.section>
        )}
      </motion.div>
    </div>
  );
}
