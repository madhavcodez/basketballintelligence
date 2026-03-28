'use client';

import { motion } from 'framer-motion';
import clsx from 'clsx';
import { Flag } from 'lucide-react';
import GlassCard from '@/components/ui/GlassCard';
import { colors } from '@/lib/design-tokens';
import type { TimelineEvent } from '@/lib/timeline-engine';

// ── Types ──────────────────────────────────────────────────────────────────

interface MilestoneCardProps {
  readonly event: TimelineEvent;
  readonly side: 'left' | 'right';
}

// ── Decorative Star SVG ────────────────────────────────────────────────────

function StarSvg({ size }: { readonly size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="currentColor">
      <path d="M10 0l2.5 7.5H20l-6 4.5 2.5 7.5-6.5-5-6.5 5L6 12 0 7.5h7.5z" />
    </svg>
  );
}

// ── Component ──────────────────────────────────────────────────────────────

export default function MilestoneCard({ event, side }: MilestoneCardProps) {
  return (
    <motion.div
      className="relative w-full"
      initial={{ opacity: 0, scale: 0.9, y: 30 }}
      whileInView={{ opacity: 1, scale: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ type: 'spring', stiffness: 120, damping: 14 }}
    >
      <GlassCard className="relative overflow-visible p-6" tintColor={colors.accentBlue}>
        {/* Outer glow ring */}
        <div
          className="pointer-events-none absolute -inset-[1px] rounded-[20px]"
          style={{
            boxShadow: `0 0 40px ${colors.accentBlue}25, 0 0 80px ${colors.accentBlue}10, inset 0 0 30px ${colors.accentBlue}05`,
          }}
        />

        {/* Gradient left border (blue to violet) */}
        <div
          className="absolute left-0 top-4 bottom-4 w-[3px] rounded-full"
          style={{
            background: `linear-gradient(to bottom, ${colors.accentBlue}, ${colors.accentViolet})`,
          }}
        />

        {/* Flag icon + meta */}
        <div className="mb-4 flex items-center gap-3">
          <div
            className={clsx(
              'flex items-center justify-center rounded-2xl p-3',
              'bg-accent-blue/[0.12]',
            )}
            style={{
              boxShadow: `0 0 20px ${colors.accentBlue}20`,
            }}
          >
            <Flag size={28} className="text-accent-blue" />
          </div>

          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-accent-blue">
              Milestone
            </p>
            <p className="text-[11px] font-medium text-[#86868B]">
              {event.season} &bull; {event.team}
            </p>
          </div>
        </div>

        {/* Large title */}
        <h3 className="text-xl font-bold tracking-tight text-[#1D1D1F] font-display sm:text-2xl">
          {event.title}
        </h3>

        {/* Description */}
        <p className="mt-2 text-sm leading-relaxed text-[#6E6E73]">
          {event.description}
        </p>

      </GlassCard>
    </motion.div>
  );
}
