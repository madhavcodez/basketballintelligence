'use client';

import { useRef, useMemo } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import clsx from 'clsx';
import { colors } from '@/lib/design-tokens';
import type {
  CareerTimeline as CareerTimelineData,
  TimelineEvent,
  TimelineEventType,
} from '@/lib/timeline-engine';
import TimelineEventCard from '@/components/timeline/TimelineEvent';
import SeasonNode from '@/components/timeline/SeasonNode';
import MilestoneCard from '@/components/timeline/MilestoneCard';

// ── Types ──────────────────────────────────────────────────────────────────

interface CareerTimelineProps {
  readonly timeline: CareerTimelineData;
  readonly highlightType?: TimelineEventType;
  readonly onEventClick?: (event: TimelineEvent) => void;
}

interface YearGroup {
  readonly year: number;
  readonly events: readonly TimelineEvent[];
}

// ── Event Type Colors ──────────────────────────────────────────────────────

const EVENT_COLORS: Readonly<Record<TimelineEventType, string>> = {
  draft: '#34D399',
  rookie_season: '#34D399',
  award: '#FBBF24',
  trade: '#FF6B35',
  career_high: '#A78BFA',
  milestone: '#4DA6FF',
  peak_season: '#FBBF24',
  season: 'rgba(0,0,0,0.24)',
};

// ── Helpers ────────────────────────────────────────────────────────────────

function groupEventsByYear(
  events: readonly TimelineEvent[],
): readonly YearGroup[] {
  const groups: YearGroup[] = [];
  let currentYear = -1;
  let currentEvents: TimelineEvent[] = [];

  for (const event of events) {
    if (event.year !== currentYear) {
      if (currentEvents.length > 0) {
        groups.push({ year: currentYear, events: currentEvents });
      }
      currentYear = event.year;
      currentEvents = [event];
    } else {
      currentEvents = [...currentEvents, event];
    }
  }

  if (currentEvents.length > 0) {
    groups.push({ year: currentYear, events: currentEvents });
  }

  return groups;
}

function getDotSize(event: TimelineEvent): number {
  if (event.significance === 'major') return 14;
  if (event.significance === 'notable') return 10;
  return 8;
}

function getDotGlow(event: TimelineEvent, color: string): string | undefined {
  if (event.significance === 'major') {
    return `0 0 12px ${color}60, 0 0 24px ${color}30`;
  }
  if (event.significance === 'notable') {
    return `0 0 8px ${color}40`;
  }
  return undefined;
}

// ── PPG Data ───────────────────────────────────────────────────────────────

interface PpgPoint {
  readonly year: number;
  readonly ppg: number;
}

function collectPpgData(events: readonly TimelineEvent[]): readonly PpgPoint[] {
  return events
    .filter((e) => e.type === 'season' && e.stats !== undefined)
    .map((e) => ({ year: e.year, ppg: e.stats!.ppg }));
}

// ── Component ──────────────────────────────────────────────────────────────

export default function CareerTimeline({
  timeline,
  highlightType,
  onEventClick,
}: CareerTimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start center', 'end center'],
  });

  const lineHeight = useTransform(scrollYProgress, [0, 1], ['0%', '100%']);

  const yearGroups = useMemo(
    () => groupEventsByYear(timeline.events),
    [timeline.events],
  );

  const ppgData = useMemo(
    () => collectPpgData(timeline.events),
    [timeline.events],
  );

  const peakPpg = useMemo(
    () => ppgData.reduce((max, p) => Math.max(max, p.ppg), 0),
    [ppgData],
  );

  // Precompute cumulative start indices for each year group
  const groupStartIndices = useMemo(() => {
    const indices: number[] = [];
    let acc = 0;
    for (const group of yearGroups) {
      indices.push(acc);
      acc += group.events.length;
    }
    return indices;
  }, [yearGroups]);

  return (
    <div ref={containerRef} className="relative mx-auto w-full max-w-4xl">
      {/* PPG trend line overlay (desktop only) */}
      {ppgData.length > 2 && (
        <PpgTrendOverlay
          ppgData={ppgData}
          peakPpg={peakPpg}
          totalYearGroups={yearGroups.length}
        />
      )}

      {/* Background faint timeline line */}
      <div className="absolute left-6 top-0 bottom-0 w-[2px] md:left-1/2 md:-translate-x-[1px]">
        <div className="h-full w-full rounded-full bg-black/[0.06]" />
      </div>

      {/* Progressive draw line */}
      <div className="absolute left-6 top-0 bottom-0 w-[2px] md:left-1/2 md:-translate-x-[1px] overflow-hidden">
        <motion.div
          className="w-full origin-top rounded-full"
          style={{
            height: lineHeight,
            background: `linear-gradient(to bottom, ${colors.accentOrange}, ${colors.accentViolet})`,
          }}
        />
        {/* Glow on the drawn line */}
        <motion.div
          className="absolute top-0 left-0 w-full origin-top rounded-full blur-sm opacity-50"
          style={{
            height: lineHeight,
            background: `linear-gradient(to bottom, ${colors.accentOrange}, ${colors.accentViolet})`,
          }}
        />
      </div>

      {/* Year groups */}
      <div className="relative space-y-2">
        {yearGroups.map((group, gi) => (
            <YearGroupSection
              key={group.year}
              group={group}
              highlightType={highlightType}
              onEventClick={onEventClick}
              startIndex={groupStartIndices[gi]}
            />
        ))}
      </div>
    </div>
  );
}

// ── PPG Trend Overlay ──────────────────────────────────────────────────────

interface PpgTrendOverlayProps {
  readonly ppgData: readonly PpgPoint[];
  readonly peakPpg: number;
  readonly totalYearGroups: number;
}

function PpgTrendOverlay({
  ppgData,
  peakPpg,
  totalYearGroups,
}: PpgTrendOverlayProps) {
  if (ppgData.length < 2 || peakPpg === 0) return null;

  const svgWidth = 60;
  const padding = 8;
  const usableWidth = svgWidth - padding * 2;

  // Map each data point to SVG coordinates
  const points = ppgData.map((p, i) => {
    const x = padding + (p.ppg / peakPpg) * usableWidth;
    const y = (i / Math.max(ppgData.length - 1, 1)) * 100;
    return { x, y, ppg: p.ppg, isPeak: p.ppg === peakPpg };
  });

  // Use absolute pixel Y for SVG — we need a viewBox approach
  const svgHeight = totalYearGroups * 120;
  const svgPoints = points.map((p) => {
    const yPx = (p.y / 100) * svgHeight;
    return { x: p.x, y: yPx, isPeak: p.isPeak };
  });

  const polylineSvg = svgPoints.map((p) => `${p.x},${p.y}`).join(' ');

  return (
    <div className="pointer-events-none absolute -left-16 top-0 bottom-0 hidden lg:block" style={{ width: svgWidth }}>
      <svg
        width={svgWidth}
        height="100%"
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full"
      >
        <polyline
          points={polylineSvg}
          fill="none"
          stroke={colors.accentOrange}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.15"
        />
        {svgPoints
          .filter((p) => p.isPeak)
          .map((p, i) => (
            <circle
              key={i}
              cx={p.x}
              cy={p.y}
              r="3"
              fill={colors.accentOrange}
              opacity="0.35"
            />
          ))}
      </svg>
    </div>
  );
}

// ── Year Group Section ─────────────────────────────────────────────────────

interface YearGroupSectionProps {
  readonly group: YearGroup;
  readonly highlightType?: TimelineEventType;
  readonly onEventClick?: (event: TimelineEvent) => void;
  readonly startIndex: number;
}

function YearGroupSection({
  group,
  highlightType,
  onEventClick,
  startIndex,
}: YearGroupSectionProps) {
  return (
    <div className="relative">
      {/* Year badge on the timeline line */}
      <div className="sticky top-20 z-10 mb-4">
        <div className="relative flex items-center">
          <div className="absolute left-6 -translate-x-1/2 md:left-1/2">
            <motion.div
              className={clsx(
                'flex items-center justify-center',
                'rounded-full border border-black/[0.06] bg-white px-3 py-1',
                'text-xs font-bold tracking-wider text-[#6E6E73] font-display',
                'shadow-lg shadow-black/10',
              )}
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ type: 'spring', stiffness: 200, damping: 20 }}
            >
              {group.year}
            </motion.div>
          </div>
        </div>
      </div>

      {/* Events within this year */}
      <div className="space-y-4 pt-10">
        {group.events.map((event, idx) => {
          const globalIdx = startIndex + idx;
          const side: 'left' | 'right' = globalIdx % 2 === 0 ? 'left' : 'right';
          const isHighlighted = highlightType
            ? event.type === highlightType
            : true;

          return (
            <TimelineRow
              key={`${event.season}-${event.type}-${event.title}-${idx}`}
              event={event}
              side={side}
              isHighlighted={isHighlighted}
              onEventClick={onEventClick}
            />
          );
        })}
      </div>
    </div>
  );
}

// ── Timeline Row ───────────────────────────────────────────────────────────

interface TimelineRowProps {
  readonly event: TimelineEvent;
  readonly side: 'left' | 'right';
  readonly isHighlighted: boolean;
  readonly onEventClick?: (event: TimelineEvent) => void;
}

function TimelineRow({
  event,
  side,
  isHighlighted,
  onEventClick,
}: TimelineRowProps) {
  const handleClick = onEventClick
    ? () => onEventClick(event)
    : undefined;

  const dotColor = EVENT_COLORS[event.type];
  const dotSize = getDotSize(event);
  const dotGlow = getDotGlow(event, dotColor);
  const isMajor = event.significance === 'major';

  // Animation config based on significance
  const motionInitial = isMajor
    ? { opacity: 0, scale: 0.85, y: 40 }
    : { opacity: 0, x: side === 'left' ? -20 : 20 };

  const motionInView = isMajor
    ? { opacity: isHighlighted ? 1 : 0.3, scale: 1, y: 0 }
    : { opacity: isHighlighted ? 1 : 0.3, x: 0 };

  const motionTransition = isMajor
    ? { type: 'spring' as const, stiffness: 120, damping: 14 }
    : { type: 'spring' as const, stiffness: 300, damping: 20 };

  return (
    <motion.div
      id={`event-${event.season}-${event.type}`}
      className={clsx(
        'relative flex items-start gap-6',
        'pl-14 md:pl-0',
        'md:flex-row',
        !isHighlighted && 'pointer-events-none',
      )}
      initial={motionInitial}
      whileInView={motionInView}
      viewport={{ once: true, margin: '-60px' }}
      transition={motionTransition}
      style={{
        filter: !isHighlighted ? 'grayscale(1)' : undefined,
        transition: 'filter 300ms, opacity 300ms',
      }}
    >
      {/* Desktop left content */}
      <div
        className={clsx(
          'hidden md:block md:w-[calc(50%-28px)]',
          side === 'right' && 'md:invisible',
        )}
      >
        {side === 'left' && (
          <EventContent
            event={event}
            side="left"
            isHighlighted={isHighlighted}
            onClick={handleClick}
          />
        )}
      </div>

      {/* Timeline dot */}
      <div className="absolute left-6 -translate-x-1/2 md:relative md:left-auto md:translate-x-0 md:flex md:shrink-0 md:items-start md:justify-center md:w-[56px] z-[5]">
        <motion.div
          className="rounded-full"
          style={{
            width: dotSize,
            height: dotSize,
            backgroundColor: dotColor,
            boxShadow: dotGlow,
          }}
          initial={{ scale: 0 }}
          whileInView={{ scale: 1 }}
          viewport={{ once: true }}
          transition={{ type: 'spring', stiffness: 400, damping: 15, delay: 0.1 }}
        />
      </div>

      {/* Desktop right content */}
      <div
        className={clsx(
          'hidden md:block md:w-[calc(50%-28px)]',
          side === 'left' && 'md:invisible',
        )}
      >
        {side === 'right' && (
          <EventContent
            event={event}
            side="right"
            isHighlighted={isHighlighted}
            onClick={handleClick}
          />
        )}
      </div>

      {/* Mobile content (always visible) */}
      <div className="flex-1 md:hidden">
        <EventContent
          event={event}
          side="left"
          isHighlighted={isHighlighted}
          onClick={handleClick}
        />
      </div>
    </motion.div>
  );
}

// ── Event Content Router ───────────────────────────────────────────────────

interface EventContentProps {
  readonly event: TimelineEvent;
  readonly side: 'left' | 'right';
  readonly isHighlighted: boolean;
  readonly onClick?: () => void;
}

function EventContent({
  event,
  side,
  isHighlighted,
  onClick,
}: EventContentProps) {
  if (event.type === 'milestone' && event.significance !== 'minor') {
    return <MilestoneCard event={event} side={side} />;
  }

  if (event.type === 'season' && event.significance === 'minor') {
    return <SeasonNode event={event} side={side} isHighlighted={isHighlighted} />;
  }

  return (
    <TimelineEventCard
      event={event}
      side={side}
      isHighlighted={isHighlighted}
      onClick={onClick}
    />
  );
}
