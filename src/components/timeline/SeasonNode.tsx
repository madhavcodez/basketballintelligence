'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import { Circle, ChevronDown } from 'lucide-react';
import { animation } from '@/lib/design-tokens';
import type { TimelineEvent } from '@/lib/timeline-engine';

// ── Types ──────────────────────────────────────────────────────────────────

interface SeasonNodeProps {
  readonly event: TimelineEvent;
  readonly side: 'left' | 'right';
  readonly isHighlighted: boolean;
}

// ── Component ──────────────────────────────────────────────────────────────

export default function SeasonNode({
  event,
  side,
  isHighlighted,
}: SeasonNodeProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const stats = event.stats;
  const teamLabel = event.team === 'TOT' ? 'Multiple' : event.team;

  const handleToggle = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  return (
    <motion.div
      className={clsx(
        'w-full',
        !isHighlighted && 'opacity-30 grayscale pointer-events-none',
        'transition-all duration-300',
      )}
      initial={{ opacity: 0, x: side === 'left' ? -20 : 20 }}
      whileInView={{ opacity: isHighlighted ? 1 : 0.3, x: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={animation.spring.snappy}
    >
      {/* Compact single line */}
      <button
        type="button"
        className={clsx(
          'flex w-full items-center gap-2.5 rounded-2xl border p-2.5',
          'bg-white border-black/[0.06]',
          'transition-all duration-200 hover:border-black/[0.12] hover:bg-black/[0.02]',
          'text-left cursor-pointer group',
        )}
        onClick={handleToggle}
      >
        <Circle size={12} className="shrink-0 text-[#86868B]" />

        <span className="text-sm font-medium text-[#1D1D1F] whitespace-nowrap">
          {event.season}
        </span>

        <span className="text-[#86868B]">&bull;</span>

        <span className="text-sm text-[#6E6E73] whitespace-nowrap">
          {teamLabel}
        </span>

        {stats && (
          <>
            <span className="text-[#86868B]">&bull;</span>
            <span className="text-sm font-mono text-[#86868B] whitespace-nowrap">
              {stats.ppg}/{stats.rpg}/{stats.apg}
            </span>
          </>
        )}

        <motion.span
          className="ml-auto shrink-0"
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={animation.spring.snappy}
        >
          <ChevronDown
            size={14}
            className="text-[#86868B] group-hover:text-[#6E6E73] transition-colors"
          />
        </motion.span>
      </button>

      {/* Expanded stats grid */}
      <AnimatePresence initial={false}>
        {isExpanded && stats && (
          <motion.div
            key="season-detail"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={animation.spring.gentle}
            className="overflow-hidden"
          >
            <div className="mt-2 rounded-2xl border border-black/[0.06] bg-white p-4 ">
              {/* Core stats — 2 cols on mobile, full grid on desktop */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                <ExpandedStatCell label="PTS" value={stats.ppg} />
                <ExpandedStatCell label="REB" value={stats.rpg} />
                <ExpandedStatCell label="AST" value={stats.apg} />
                <ExpandedStatCell label="STL" value={stats.spg} />
                <ExpandedStatCell label="BLK" value={stats.bpg} />
              </div>

              {/* Shooting splits */}
              <div className="mt-3 grid grid-cols-2 gap-3 border-t border-black/[0.06] pt-3 sm:grid-cols-4">
                <ExpandedStatCell label="FG%" value={stats.fgPct} pct />
                <ExpandedStatCell label="3P%" value={stats.fg3Pct} pct />
                <ExpandedStatCell label="FT%" value={stats.ftPct} pct />
                <ExpandedStatCell label="MIN" value={stats.minutes} />
              </div>

              {/* Games row */}
              <div className="mt-3 border-t border-black/[0.06] pt-3">
                <div className="flex items-center gap-4">
                  <span className="text-xs text-[#86868B]">
                    {stats.games} games played
                  </span>
                  <span className="text-xs text-[#86868B]">
                    {stats.team === 'TOT' ? 'Multiple teams' : stats.team}
                  </span>
                </div>
              </div>

              {/* Advanced stats */}
              {(stats.per !== undefined ||
                stats.ws !== undefined ||
                stats.bpm !== undefined ||
                stats.vorp !== undefined) && (
                <div className="mt-3 border-t border-black/[0.06] pt-3">
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[#0071E3]">
                    Advanced Metrics
                  </p>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {stats.per !== undefined && (
                      <ExpandedStatCell label="PER" value={stats.per} />
                    )}
                    {stats.ws !== undefined && (
                      <ExpandedStatCell label="WS" value={stats.ws} />
                    )}
                    {stats.bpm !== undefined && (
                      <ExpandedStatCell label="BPM" value={stats.bpm} />
                    )}
                    {stats.vorp !== undefined && (
                      <ExpandedStatCell label="VORP" value={stats.vorp} />
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

// ── Stat Cell ──────────────────────────────────────────────────────────────

interface ExpandedStatCellProps {
  readonly label: string;
  readonly value: number;
  readonly pct?: boolean;
}

function ExpandedStatCell({ label, value, pct = false }: ExpandedStatCellProps) {
  const displayValue = pct
    ? `${(value * 100).toFixed(1)}%`
    : value;

  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-base font-bold text-[#1D1D1F] font-mono leading-none">
        {displayValue}
      </span>
      <span className="text-[9px] font-semibold uppercase tracking-wider text-[#86868B] leading-none">
        {label}
      </span>
    </div>
  );
}
