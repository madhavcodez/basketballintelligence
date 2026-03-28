'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import {
  ArrowLeft,
  Trophy,
  Repeat,
  Flag,
  TrendingUp,
  Calendar,
  Loader2,
  AlertCircle,
  Swords,
  ChevronDown,
  Star,
  Crown,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import clsx from 'clsx';
import GlassCard from '@/components/ui/GlassCard';
import MetricChip from '@/components/ui/MetricChip';
import SectionHeader from '@/components/ui/SectionHeader';
import SkeletonLoader from '@/components/ui/SkeletonLoader';
import Badge from '@/components/ui/Badge';
import PlayerAvatar from '@/components/ui/PlayerAvatar';
import CareerTimeline from '@/components/timeline/CareerTimeline';
import { motionPresets, animation, colors } from '@/lib/design-tokens';
import type {
  CareerTimeline as CareerTimelineType,
  TimelineEvent,
  TimelineEventType,
} from '@/lib/timeline-engine';

// ── Types ──────────────────────────────────────────────────────────────────

interface FilterOption {
  readonly label: string;
  readonly type: TimelineEventType | null;
  readonly icon: typeof Trophy;
}

interface AwardEntry {
  readonly name: string;
  readonly count: number;
  readonly isPrestigious: boolean;
}

interface KeyMoment {
  readonly season: string;
  readonly type: TimelineEventType;
  readonly title: string;
  readonly icon: typeof Trophy;
}

// ── Constants ──────────────────────────────────────────────────────────────

const FILTER_OPTIONS: readonly FilterOption[] = [
  { label: 'All', type: null, icon: Calendar },
  { label: 'Awards', type: 'award', icon: Trophy },
  { label: 'Trades', type: 'trade', icon: Repeat },
  { label: 'Milestones', type: 'milestone', icon: Flag },
  { label: 'Career Highs', type: 'career_high', icon: TrendingUp },
  { label: 'Seasons', type: 'season', icon: Calendar },
];

const PRESTIGIOUS_AWARDS = new Set([
  'MVP',
  'Finals MVP',
  'DPOY',
  'Rookie of the Year',
  'NBA Champion',
  '6th Man of the Year',
  'Most Improved Player',
]);

const EVENT_ICON_MAP: Readonly<Record<string, typeof Trophy>> = {
  star: Star,
  trophy: Trophy,
  repeat: Repeat,
  'trending-up': TrendingUp,
  flag: Flag,
  crown: Crown,
  sparkles: Sparkles,
  circle: Calendar,
};

// ── Helpers ────────────────────────────────────────────────────────────────

function formatPlayerName(slug: string): string {
  return slug
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function formatNumber(n: number): string {
  return n.toLocaleString('en-US');
}

function buildAwardEntries(events: readonly TimelineEvent[]): readonly AwardEntry[] {
  const awardEvents = events.filter((e) => e.type === 'award');
  const awardCounts = new Map<string, number>();

  for (const e of awardEvents) {
    const count = awardCounts.get(e.title) ?? 0;
    awardCounts.set(e.title, count + 1);
  }

  const entries: AwardEntry[] = [];

  for (const [name, count] of awardCounts) {
    entries.push({
      name,
      count,
      isPrestigious: PRESTIGIOUS_AWARDS.has(name),
    });
  }

  // Sort: prestigious first, then by count descending
  return [...entries].sort((a, b) => {
    if (a.isPrestigious !== b.isPrestigious) {
      return a.isPrestigious ? -1 : 1;
    }
    return b.count - a.count;
  });
}

function buildKeyMoments(events: readonly TimelineEvent[]): readonly KeyMoment[] {
  return events
    .filter((e) => e.significance === 'major')
    .map((e) => ({
      season: e.season,
      type: e.type,
      title: e.title,
      icon: EVENT_ICON_MAP[e.icon] ?? Calendar,
    }));
}

function scrollToEvent(season: string, type: string): void {
  const el = document.getElementById(`event-${season}-${type}`);
  el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// ── Component ──────────────────────────────────────────────────────────────

export default function TimelinePage() {
  const params = useParams<{ name: string }>();
  const rawName = typeof params.name === 'string' ? params.name : '';
  const playerName = formatPlayerName(decodeURIComponent(rawName));

  const [timeline, setTimeline] = useState<CareerTimelineType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<TimelineEventType | undefined>(undefined);
  const [jumpToOpen, setJumpToOpen] = useState(false);

  useEffect(() => {
    if (!rawName) return;

    let cancelled = false;

    async function fetchTimeline() {
      setIsLoading(true);
      setError(null);

      try {
        const res = await fetch(`/api/timeline/${encodeURIComponent(playerName)}`);

        if (!res.ok) {
          const data = await res.json().catch(() => ({ error: 'Unknown error' }));
          throw new Error(data.error ?? `HTTP ${res.status}`);
        }

        const data: CareerTimelineType = await res.json();

        if (!cancelled) {
          setTimeline(data);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'Failed to load timeline',
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    fetchTimeline();

    return () => {
      cancelled = true;
    };
  }, [rawName]); // playerName is derived from rawName — no need to list it

  const handleFilterClick = useCallback((type: TimelineEventType | null) => {
    setActiveFilter(type ?? undefined);
  }, []);

  const handleJumpToToggle = useCallback(() => {
    setJumpToOpen((prev) => !prev);
  }, []);

  const handleJumpToClick = useCallback((season: string, type: string) => {
    scrollToEvent(season, type);
    setJumpToOpen(false);
  }, []);

  // Derive display data
  const playerInfo = timeline?.playerInfo;
  const careerStats = timeline?.careerStats;

  const computedStartYear = timeline
    ? timeline.events.reduce((min, e) => Math.min(min, e.year), Infinity)
    : 0;
  const computedEndYear = timeline
    ? timeline.events.reduce((max, e) => Math.max(max, e.year), -Infinity) + 1
    : 0;
  const startYear = playerInfo?.fromYear ?? (Number.isFinite(computedStartYear) ? computedStartYear : 0);
  const endYear = playerInfo?.toYear ?? (Number.isFinite(computedEndYear) ? computedEndYear : 0);
  const playerIsActive = playerInfo?.active === 1;

  const summaryParts = useMemo(() => {
    if (!careerStats) return '';
    const parts: string[] = [];
    parts.push(`${careerStats.yearsActive} Seasons`);
    parts.push(`${careerStats.teams.length} Team${careerStats.teams.length !== 1 ? 's' : ''}`);
    if (careerStats.awardsCount > 0) {
      parts.push(`${careerStats.awardsCount} Award${careerStats.awardsCount !== 1 ? 's' : ''}`);
    }
    return parts.join(' \u2022 ');
  }, [careerStats]);

  const awardEntries = useMemo(
    () => (timeline ? buildAwardEntries(timeline.events) : []),
    [timeline],
  );

  const keyMoments = useMemo(
    () => (timeline ? buildKeyMoments(timeline.events) : []),
    [timeline],
  );

  // ── Loading State ──────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F5F5F7] px-4 pb-24 pt-8">
        <div className="mx-auto max-w-4xl">
          <SkeletonLoader width={100} height={32} rounded="full" />

          <div className="mt-8 space-y-4">
            <SkeletonLoader width={300} height={40} rounded="lg" />
            <SkeletonLoader width={250} height={20} rounded="md" />
            <SkeletonLoader width={200} height={16} rounded="md" />
          </div>

          <div className="mt-8 flex gap-2">
            {Array.from({ length: 6 }, (_, i) => (
              <SkeletonLoader key={i} width={90} height={36} rounded="full" />
            ))}
          </div>

          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <SkeletonLoader key={i} height={80} rounded="xl" />
            ))}
          </div>

          <div className="relative mt-12">
            <div className="absolute left-6 top-0 bottom-0 w-[2px] md:left-1/2 md:-translate-x-[1px]">
              <div className="h-full w-full animate-pulse rounded-full bg-glass-bg" />
            </div>

            <div className="space-y-6 pl-14 md:pl-0">
              {Array.from({ length: 8 }, (_, i) => (
                <div
                  key={i}
                  className="md:w-[calc(50%-28px)]"
                  style={{ marginLeft: i % 2 === 0 ? 0 : 'auto' }}
                >
                  <SkeletonLoader height={i % 3 === 0 ? 140 : 60} rounded="xl" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Error State ────────────────────────────────────────────────────────

  if (error || !timeline) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#F5F5F7] px-4">
        <motion.div
          {...motionPresets.fadeInUp}
          className="flex flex-col items-center gap-4 text-center"
        >
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent-red/10">
            <AlertCircle size={32} className="text-accent-red" />
          </div>
          <h2 className="text-xl font-bold text-[#1D1D1F] font-display">
            Player Not Found
          </h2>
          <p className="max-w-sm text-sm text-[#86868B]">
            {error ?? `Could not find timeline data for "${playerName}".`}
          </p>
          <Link
            href="/"
            className="mt-4 rounded-full bg-glass-bg border border-black/[0.06] px-5 py-2.5 text-sm font-medium text-[#1D1D1F] transition-colors hover:bg-white/10"
          >
            Back to Home
          </Link>
        </motion.div>
      </div>
    );
  }

  // ── Main Render ────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#F5F5F7] pb-32">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        {/* Background gradient */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: `radial-gradient(ellipse at 50% 0%, ${colors.accentOrange}08 0%, transparent 60%)`,
          }}
        />

        <div className="relative mx-auto max-w-4xl px-4 pt-8">
          {/* Back button */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={animation.spring.snappy}
          >
            <Link
              href={`/player/${rawName}`}
              className={clsx(
                'inline-flex items-center gap-2 rounded-full',
                'bg-glass-bg border border-black/[0.06] px-4 py-2',
                'text-sm font-medium text-[#6E6E73]',
                'transition-all duration-200 hover:bg-white/10 hover:text-[#1D1D1F]',
                'backdrop-blur-xl',
              )}
            >
              <ArrowLeft size={16} />
              Back to Player
            </Link>
          </motion.div>

          {/* Hero header */}
          <motion.div
            className="mt-8"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...animation.spring.gentle, delay: 0.1 }}
          >
            <div className="flex items-center gap-3">
              <PlayerAvatar name={timeline.player} playerId={timeline.playerInfo?.personId} size="xl" />
              <h1 className="text-3xl font-extrabold tracking-tight text-[#1D1D1F] font-display sm:text-4xl md:text-5xl">
                {timeline.player}
              </h1>
              {playerInfo?.hof === 1 && (
                <Badge variant="warning">HOF</Badge>
              )}
              {playerIsActive && (
                <Badge variant="success">Active</Badge>
              )}
            </div>

            <p className="mt-3 text-lg font-medium text-[#6E6E73] sm:text-xl">
              The Journey: {startYear} &mdash; {playerIsActive ? 'Present' : endYear}
            </p>

            <p className="mt-1.5 text-sm text-[#86868B]">
              {summaryParts}
            </p>

            {playerInfo && (
              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-[#86868B]">
                {playerInfo.position && (
                  <span>{playerInfo.position}</span>
                )}
                {playerInfo.height && (
                  <>
                    <span className="text-chrome-faint">&bull;</span>
                    <span>{playerInfo.height}</span>
                  </>
                )}
                {playerInfo.college && (
                  <>
                    <span className="text-chrome-faint">&bull;</span>
                    <span>{playerInfo.college}</span>
                  </>
                )}
                <span className="text-chrome-faint">&bull;</span>
                <Link
                  href="/matchup"
                  className="inline-flex items-center gap-1 text-[#86868B] hover:text-accent-orange transition-colors"
                >
                  <Swords size={12} /> Head-to-Head
                </Link>
              </div>
            )}
          </motion.div>

          {/* Awards Gallery */}
          {awardEntries.length > 0 && (
            <motion.div
              className="mt-8"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...animation.spring.gentle, delay: 0.15 }}
            >
              <AwardsGallery awards={awardEntries} />
            </motion.div>
          )}

          {/* Filter bar */}
          <motion.div
            className="mt-8 flex gap-2 overflow-x-auto pb-2 scrollbar-none"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...animation.spring.gentle, delay: 0.2 }}
          >
            {FILTER_OPTIONS.map((filter) => {
              const isFilterActive = activeFilter === filter.type ||
                (filter.type === null && activeFilter === undefined);
              const Icon = filter.icon;

              return (
                <button
                  key={filter.label}
                  type="button"
                  className={clsx(
                    'flex shrink-0 items-center gap-1.5 rounded-full border px-4 py-2',
                    'text-sm font-medium transition-all duration-200',
                    'cursor-pointer whitespace-nowrap',
                    isFilterActive
                      ? 'bg-accent-orange/[0.15] border-accent-orange/30 text-accent-orange'
                      : 'bg-glass-bg border-black/[0.06] text-[#86868B] hover:text-[#6E6E73] hover:bg-white/[0.08]',
                  )}
                  onClick={() => handleFilterClick(filter.type)}
                >
                  <Icon size={14} />
                  {filter.label}
                </button>
              );
            })}
          </motion.div>

          {/* Career Overview stat cards */}
          {careerStats && (
            <motion.div
              className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...animation.spring.gentle, delay: 0.3 }}
            >
              <GlassCard className="p-4 text-center">
                <p className="text-2xl font-bold text-[#1D1D1F] font-display">
                  {formatNumber(careerStats.totalPoints)}
                </p>
                <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-[#86868B]">
                  Total Points
                </p>
              </GlassCard>

              <GlassCard className="p-4 text-center">
                <p className="text-2xl font-bold text-[#1D1D1F] font-display">
                  {formatNumber(careerStats.totalGames)}
                </p>
                <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-[#86868B]">
                  Games Played
                </p>
              </GlassCard>

              <GlassCard className="p-4 text-center">
                <p className="text-2xl font-bold text-[#1D1D1F] font-display">
                  {careerStats.teams.length}
                </p>
                <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-[#86868B]">
                  Teams
                </p>
              </GlassCard>

              <GlassCard className="p-4 text-center">
                <p className="text-2xl font-bold text-accent-gold font-display">
                  {careerStats.awardsCount}
                </p>
                <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-[#86868B]">
                  Awards
                </p>
              </GlassCard>
            </motion.div>
          )}
        </div>
      </div>

      {/* Timeline Section with Jump-to Navigation */}
      <div className="mx-auto max-w-4xl px-4 pt-12">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          <SectionHeader
            title="Career Timeline"
            eyebrow="The Journey"
          />
        </motion.div>

        {/* Mobile Jump-to button */}
        {keyMoments.length > 0 && (
          <div className="relative mt-4 lg:hidden">
            <button
              type="button"
              className={clsx(
                'flex w-full items-center justify-between rounded-2xl border px-4 py-3',
                'bg-glass-bg border-black/[0.06] backdrop-blur-xl',
                'text-sm font-medium text-[#6E6E73]',
                'cursor-pointer transition-all duration-200 hover:bg-white/[0.08]',
              )}
              onClick={handleJumpToToggle}
            >
              <span>Jump to...</span>
              <motion.span
                animate={{ rotate: jumpToOpen ? 180 : 0 }}
                transition={animation.spring.snappy}
              >
                <ChevronDown size={16} />
              </motion.span>
            </button>

            <AnimatePresence>
              {jumpToOpen && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={animation.spring.gentle}
                  className="overflow-hidden"
                >
                  <div className="mt-2 rounded-2xl border border-black/[0.06] bg-white p-3 backdrop-blur-xl">
                    <div className="max-h-64 space-y-1 overflow-y-auto scrollbar-none">
                      {keyMoments.map((moment, idx) => {
                        const Icon = moment.icon;
                        return (
                          <button
                            key={`${moment.season}-${moment.type}-${idx}`}
                            type="button"
                            className={clsx(
                              'flex w-full items-center gap-2.5 rounded-xl px-3 py-2',
                              'text-left text-sm text-[#6E6E73]',
                              'cursor-pointer transition-colors hover:bg-white/[0.06] hover:text-[#1D1D1F]',
                            )}
                            onClick={() => handleJumpToClick(moment.season, moment.type)}
                          >
                            <Icon size={14} className="shrink-0 text-[#86868B]" />
                            <span className="truncate">{moment.title}</span>
                            <span className="ml-auto shrink-0 text-[11px] text-[#86868B]">
                              {moment.season}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Desktop layout: timeline + sidebar */}
        <div className="mt-8 flex gap-8">
          {/* Main timeline */}
          <div className="min-w-0 flex-1">
            <CareerTimeline
              timeline={timeline}
              highlightType={activeFilter}
              onEventClick={() => {}}
            />
          </div>

          {/* Desktop Jump-to sidebar */}
          {keyMoments.length > 0 && (
            <div className="hidden w-52 shrink-0 lg:block">
              <div className="sticky top-24">
                <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-[#86868B]">
                  Key Moments
                </p>
                <div className="space-y-1">
                  {keyMoments.map((moment, idx) => {
                    const Icon = moment.icon;
                    return (
                      <button
                        key={`sidebar-${moment.season}-${moment.type}-${idx}`}
                        type="button"
                        className={clsx(
                          'flex w-full items-center gap-2 rounded-xl px-3 py-2',
                          'text-left text-[13px] text-[#86868B]',
                          'cursor-pointer transition-all duration-200',
                          'hover:bg-white/[0.06] hover:text-[#1D1D1F]',
                        )}
                        onClick={() => scrollToEvent(moment.season, moment.type)}
                      >
                        <Icon size={12} className="shrink-0" />
                        <span className="truncate leading-tight">{moment.title}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Explore Matchups CTA */}
      <motion.div
        className="mx-auto mt-20 max-w-4xl px-4"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={animation.spring.gentle}
      >
        <GlassCard className="p-6 sm:p-8" hoverable>
          <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-accent-orange/[0.12]">
              <Swords size={28} className="text-accent-orange" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-[#1D1D1F] font-display">
                Explore Matchups
              </h3>
              <p className="mt-1 text-sm text-[#86868B]">
                See how {timeline.player} stacks up against other legends in head-to-head comparisons.
              </p>
            </div>
            <Link
              href="/matchup"
              className={clsx(
                'inline-flex items-center gap-2 rounded-full',
                'bg-accent-orange/[0.15] border border-accent-orange/30 px-5 py-2.5',
                'text-sm font-semibold text-accent-orange',
                'transition-all duration-200 hover:bg-accent-orange/[0.25]',
                'whitespace-nowrap',
              )}
            >
              Go to Matchups
              <ArrowRight size={16} />
            </Link>
          </div>
        </GlassCard>
      </motion.div>
    </div>
  );
}

// ── Awards Gallery ────────────────────────────────────────────────────────

interface AwardsGalleryProps {
  readonly awards: readonly AwardEntry[];
}

function AwardsGallery({ awards }: AwardsGalleryProps) {
  return (
    <div className="relative">
      <div
        className={clsx(
          'flex gap-3 overflow-x-auto pb-2 scrollbar-none',
          'snap-x snap-mandatory',
        )}
      >
        {awards.map((award) => (
          <motion.div
            key={award.name}
            className="snap-start"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={animation.spring.gentle}
          >
            <div
              className={clsx(
                'flex shrink-0 items-center gap-2 rounded-full border px-4 py-2',
                'whitespace-nowrap',
                award.isPrestigious
                  ? 'bg-accent-gold/[0.10] border-accent-gold/30'
                  : 'bg-glass-bg border-black/[0.06]',
              )}
            >
              <Trophy
                size={14}
                className={award.isPrestigious ? 'text-accent-gold' : 'text-[#86868B]'}
              />
              <span
                className={clsx(
                  'text-sm font-semibold',
                  award.isPrestigious ? 'text-accent-gold' : 'text-[#6E6E73]',
                )}
              >
                {award.count > 1 ? `${award.count}x ` : ''}
                {award.name}
              </span>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Fade edges for scroll indication */}
      <div className="pointer-events-none absolute right-0 top-0 bottom-2 w-12 bg-gradient-to-l from-dark-base to-transparent" />
    </div>
  );
}
