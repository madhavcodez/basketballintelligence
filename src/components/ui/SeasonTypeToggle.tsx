'use client';

import { motion, LayoutGroup } from 'framer-motion';
import clsx from 'clsx';
import { BarChart3, Trophy, Layers } from 'lucide-react';
import { type SeasonType } from '@/lib/season-context';

interface SeasonTypeToggleProps {
  readonly value: SeasonType;
  readonly onChange: (type: SeasonType) => void;
  readonly playoffAvailable?: boolean;
  readonly compact?: boolean;
}

interface SegmentConfig {
  readonly type: SeasonType;
  readonly label: string;
  readonly icon: typeof BarChart3;
  readonly activeColor: string;
  readonly activeBg: string;
  readonly needsPlayoff: boolean;
}

const SEGMENTS: readonly SegmentConfig[] = [
  {
    type: 'regular',
    label: 'Regular',
    icon: BarChart3,
    activeColor: 'text-accent-blue',
    activeBg: 'bg-accent-blue/10',
    needsPlayoff: false,
  },
  {
    type: 'playoffs',
    label: 'Playoffs',
    icon: Trophy,
    activeColor: 'text-accent-orange',
    activeBg: 'bg-accent-orange/10',
    needsPlayoff: true,
  },
  {
    type: 'combined',
    label: 'Combined',
    icon: Layers,
    activeColor: 'text-accent-violet',
    activeBg: 'bg-accent-violet/10',
    needsPlayoff: true,
  },
] as const;

const PILL_SPRING = { type: 'spring' as const, stiffness: 350, damping: 30 };

export default function SeasonTypeToggle({
  value,
  onChange,
  playoffAvailable = false,
  compact = false,
}: SeasonTypeToggleProps) {
  const activeSegment = SEGMENTS.find((s) => s.type === value) ?? SEGMENTS[0];

  return (
    <LayoutGroup id={compact ? 'season-toggle-compact' : 'season-toggle'}>
      <div
        className={clsx(
          'inline-flex items-center bg-white',
          'border border-black/[0.08] rounded-full shadow-sm',
          compact ? 'h-8 px-1 py-0.5 gap-0.5' : 'h-10 px-1.5 py-1 gap-0.5',
        )}
      >
        {SEGMENTS.map((segment) => {
          const isActive = value === segment.type;
          const Icon = segment.icon;
          const isUnavailable = segment.needsPlayoff && !playoffAvailable;

          return (
            <button
              key={segment.type}
              type="button"
              onClick={() => onChange(segment.type)}
              disabled={isUnavailable && !isActive}
              title={isUnavailable ? `${segment.label} (no data)` : segment.label}
              aria-pressed={isActive}
              className={clsx(
                'relative flex items-center justify-center rounded-full',
                'transition-colors duration-200 outline-none',
                compact
                  ? 'px-2 py-1'
                  : 'px-3 py-1 gap-1.5',
                isActive
                  ? activeSegment.activeColor
                  : 'text-text-tertiary hover:text-text-secondary',
                isUnavailable && !isActive && 'opacity-35',
              )}
            >
              {isActive && (
                <motion.div
                  layoutId="seasonTypeActive"
                  className={clsx(
                    'absolute inset-0 rounded-full',
                    activeSegment.activeBg,
                  )}
                  transition={PILL_SPRING}
                  style={{ originX: 0.5, originY: 0.5 }}
                />
              )}

              <span className="relative z-10 flex items-center gap-1.5">
                <Icon
                  size={compact ? 16 : 14}
                  strokeWidth={isActive ? 2.2 : 1.8}
                  className="shrink-0"
                />
                {!compact && (
                  <span className="text-xs font-semibold whitespace-nowrap">
                    {segment.label}
                  </span>
                )}
              </span>

              {/* Static indicator dot for playoffs when active and data available */}
              {isActive && segment.type === 'playoffs' && playoffAvailable && (
                <span className="absolute -top-0.5 -right-0.5 z-20 h-2 w-2 rounded-full bg-accent-green" />
              )}
            </button>
          );
        })}
      </div>
    </LayoutGroup>
  );
}
