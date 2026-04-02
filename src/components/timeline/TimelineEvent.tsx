'use client';

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import {
  Star,
  Trophy,
  Repeat,
  TrendingUp,
  Flag,
  Crown,
  Sparkles,
  Circle,
  ChevronDown,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import GlassCard from '@/components/ui/GlassCard';
import { animation } from '@/lib/design-tokens';
import type { TimelineEvent, TimelineEventType } from '@/lib/timeline-engine';

// ── Types ──────────────────────────────────────────────────────────────────

interface TimelineEventCardProps {
  readonly event: TimelineEvent;
  readonly side: 'left' | 'right';
  readonly isHighlighted: boolean;
  readonly onClick?: () => void;
}

// ── Constants ──────────────────────────────────────────────────────────────

const EVENT_TYPE_COLORS: Readonly<Record<TimelineEventType, string>> = {
  draft: '#34D399',
  rookie_season: '#34D399',
  award: '#FBBF24',
  trade: '#FF6B35',
  career_high: '#A78BFA',
  milestone: '#4DA6FF',
  peak_season: '#FBBF24',
  season: 'rgba(0,0,0,0.24)',
};

const ICON_MAP: Readonly<Record<string, LucideIcon>> = {
  star: Star,
  trophy: Trophy,
  repeat: Repeat,
  'trending-up': TrendingUp,
  flag: Flag,
  crown: Crown,
  sparkles: Sparkles,
  circle: Circle,
};

function EventIcon({ iconName, ...props }: { readonly iconName: string } & React.ComponentProps<LucideIcon>) {
  const Icon = ICON_MAP[iconName] ?? Circle;
  return <Icon {...props} />;
}

// ── Component ──────────────────────────────────────────────────────────────

export default function TimelineEventCard(props: TimelineEventCardProps) {
  const { event, isHighlighted, onClick } = props;
  const [isExpanded, setIsExpanded] = useState(false);
  const accentColor = EVENT_TYPE_COLORS[event.type];
  const isMajor = event.significance === 'major';
  const isNotable = event.significance === 'notable';
  const isMinor = event.significance === 'minor';

  const handleClick = useCallback(() => {
    if (isMinor) {
      setIsExpanded((prev) => !prev);
    }
    onClick?.();
  }, [isMinor, onClick]);

  const isAward = event.type === 'award';
  const isTrade = event.type === 'trade';

  // Major events: full card with glow
  if (isMajor) {
    return (
      <motion.div
        className={clsx(
          'relative w-full',
          !isHighlighted && 'opacity-30 grayscale pointer-events-none',
          'transition-all duration-300',
        )}
        whileInView={{ opacity: isHighlighted ? 1 : 0.3 }}
        viewport={{ once: true }}
      >
        <GlassCard
          className="p-5"
          tintColor={accentColor}
          hoverable
          onClick={handleClick}
        >
          {/* Glow effect */}
          <div
            className="pointer-events-none absolute -inset-px rounded-[20px]"
            style={{
              boxShadow: isAward
                ? `0 0 40px ${accentColor}35, 0 0 80px ${accentColor}15`
                : `0 0 30px ${accentColor}25, 0 0 60px ${accentColor}10`,
            }}
          />

          {/* Left accent border */}
          <div
            className="absolute left-0 top-4 bottom-4 w-[3px] rounded-full"
            style={{ backgroundColor: accentColor }}
          />

          <div className="flex items-start gap-4">
            {/* Icon container */}
            <div
              className={clsx(
                'flex shrink-0 items-center justify-center rounded-2xl p-3',
                isAward && 'ring-1 ring-[#F59E0B]/20',
              )}
              style={{
                backgroundColor: `${accentColor}15`,
                boxShadow: isAward ? `0 0 20px ${accentColor}20` : undefined,
              }}
            >
              <EventIcon
                iconName={event.icon}
                size={24}
                style={{ color: accentColor }}
              />
            </div>

            <div className="min-w-0 flex-1">
              {/* Meta line */}
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#86868B]">
                {event.season} &bull; {event.team}
              </p>

              {/* Title */}
              <h3
                className={clsx(
                  'mt-1 font-display tracking-tight',
                  isAward
                    ? 'text-lg font-extrabold'
                    : 'text-lg font-bold',
                )}
                style={{ color: isAward ? accentColor : undefined }}
              >
                <span className={isAward ? '' : 'text-[#1D1D1F]'}>
                  {event.title}
                </span>
              </h3>

              {/* Description */}
              <p className="mt-1.5 text-sm leading-relaxed text-[#86868B]">
                {event.description}
              </p>

              {/* Stats row */}
              {event.stats && (
                <div className="mt-4 flex flex-wrap gap-4">
                  <StatPill label="PPG" value={event.stats.ppg} accent={accentColor} />
                  <StatPill label="RPG" value={event.stats.rpg} />
                  <StatPill label="APG" value={event.stats.apg} />
                </div>
              )}
            </div>
          </div>
        </GlassCard>
      </motion.div>
    );
  }

  // Notable events: medium card with left border accent
  if (isNotable) {
    return (
      <motion.div
        className={clsx(
          'relative w-full',
          !isHighlighted && 'opacity-30 grayscale pointer-events-none',
          'transition-all duration-300',
        )}
        whileInView={{ opacity: isHighlighted ? 1 : 0.3 }}
        viewport={{ once: true }}
      >
        <GlassCard
          className="p-4"
          tintColor={accentColor}
          hoverable
          onClick={handleClick}
        >
          {/* Left accent border */}
          <div
            className="absolute left-0 top-3 bottom-3 w-[2px] rounded-full"
            style={{ backgroundColor: accentColor }}
          />

          <div className="flex items-start gap-3">
            <div
              className="flex shrink-0 items-center justify-center rounded-xl p-2"
              style={{ backgroundColor: `${accentColor}12` }}
            >
              <EventIcon
                iconName={event.icon}
                size={18}
                style={{ color: accentColor }}
              />
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[#86868B]">
                {event.season} &bull; {event.team}
              </p>

              <h4 className="mt-0.5 text-base font-semibold tracking-tight text-[#1D1D1F]">
                {event.title}
              </h4>

              <p className="mt-1 text-sm leading-relaxed text-[#86868B]">
                {event.description}
              </p>

              {event.stats && (
                <div className="mt-3 flex flex-wrap gap-3">
                  <StatPill label="PPG" value={event.stats.ppg} accent={isTrade ? accentColor : undefined} />
                  <StatPill label="RPG" value={event.stats.rpg} />
                  <StatPill label="APG" value={event.stats.apg} />
                </div>
              )}
            </div>
          </div>
        </GlassCard>
      </motion.div>
    );
  }

  // Minor events: compact expandable row
  return (
    <motion.div
      className={clsx(
        'w-full',
        !isHighlighted && 'opacity-30 grayscale pointer-events-none',
        'transition-all duration-300',
      )}
      whileInView={{ opacity: isHighlighted ? 1 : 0.3 }}
      viewport={{ once: true }}
    >
      <button
        type="button"
        className={clsx(
          'flex w-full items-center gap-3 rounded-2xl border p-2.5',
          'bg-white border-black/[0.06] ',
          'transition-all duration-200 hover:border-black/[0.12]',
          'text-left cursor-pointer',
        )}
        onClick={handleClick}
      >
        <EventIcon iconName={event.icon} size={14} style={{ color: accentColor }} className="shrink-0" />
        <span className="text-sm font-medium text-[#1D1D1F]">
          {event.season}
        </span>
        <span className="text-[#86868B]">&bull;</span>
        <span className="text-sm text-[#6E6E73]">
          {event.team === 'TOT' ? 'Multiple' : event.team}
        </span>
        {event.stats && (
          <>
            <span className="text-[#86868B]">&bull;</span>
            <span className="text-sm font-mono text-[#86868B]">
              {event.stats.ppg}/{event.stats.rpg}/{event.stats.apg}
            </span>
          </>
        )}
        <motion.span
          className="ml-auto text-[#86868B]"
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={animation.spring.snappy}
        >
          <ChevronDown size={14} />
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {isExpanded && event.stats && (
          <motion.div
            key="minor-detail"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={animation.spring.gentle}
            className="overflow-hidden"
          >
            <div className="mt-2 rounded-2xl border border-black/[0.06] bg-white p-4 ">
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                <StatCell label="PPG" value={event.stats.ppg} />
                <StatCell label="RPG" value={event.stats.rpg} />
                <StatCell label="APG" value={event.stats.apg} />
                <StatCell label="SPG" value={event.stats.spg} />
                <StatCell label="BPG" value={event.stats.bpg} />
                <StatCell label="GP" value={event.stats.games} />
                <StatCell label="FG%" value={event.stats.fgPct} pct />
                <StatCell label="3P%" value={event.stats.fg3Pct} pct />
                <StatCell label="FT%" value={event.stats.ftPct} pct />
                <StatCell label="MIN" value={event.stats.minutes} />
              </div>

              {(event.stats.per !== undefined ||
                event.stats.ws !== undefined ||
                event.stats.bpm !== undefined ||
                event.stats.vorp !== undefined) && (
                <div className="mt-3 border-t border-black/[0.06] pt-3">
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[#86868B]">
                    Advanced
                  </p>
                  <div className="grid grid-cols-4 gap-3">
                    {event.stats.per !== undefined && (
                      <StatCell label="PER" value={event.stats.per} />
                    )}
                    {event.stats.ws !== undefined && (
                      <StatCell label="WS" value={event.stats.ws} />
                    )}
                    {event.stats.bpm !== undefined && (
                      <StatCell label="BPM" value={event.stats.bpm} />
                    )}
                    {event.stats.vorp !== undefined && (
                      <StatCell label="VORP" value={event.stats.vorp} />
                    )}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Stat Helpers ───────────────────────────────────────────────────────────

interface StatPillProps {
  readonly label: string;
  readonly value: number;
  readonly accent?: string;
}

function StatPill({ label, value, accent }: StatPillProps) {
  return (
    <div className="flex items-center gap-1.5">
      <span
        className="text-sm font-bold font-mono leading-none"
        style={{ color: accent ?? '#1D1D1F' }}
      >
        {value}
      </span>
      <span className="text-[10px] font-semibold uppercase tracking-wider text-[#86868B]">
        {label}
      </span>
    </div>
  );
}

interface StatCellProps {
  readonly label: string;
  readonly value: number;
  readonly pct?: boolean;
}

function StatCell({ label, value, pct = false }: StatCellProps) {
  const displayValue = pct ? `${(value * 100).toFixed(1)}%` : value;

  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-sm font-bold text-[#1D1D1F] font-mono">
        {displayValue}
      </span>
      <span className="text-[9px] font-semibold uppercase tracking-wider text-[#86868B]">
        {label}
      </span>
    </div>
  );
}
