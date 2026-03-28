'use client';

import clsx from 'clsx';
import { BarChart3, Trophy, Layers } from 'lucide-react';
import { type SeasonType } from '@/lib/season-context';

// ─── Types ──────────────────────────────────────────────────────────────────

interface SeasonTypeBadgeProps {
  readonly type: SeasonType;
  readonly size?: 'sm' | 'md';
}

// ─── Badge Config ───────────────────────────────────────────────────────────

interface BadgeConfig {
  readonly label: string;
  readonly icon: typeof BarChart3;
  readonly bg: string;
  readonly border: string;
  readonly text: string;
}

const BADGE_MAP: Record<SeasonType, BadgeConfig> = {
  regular: {
    label: 'REG SEASON',
    icon: BarChart3,
    bg: 'bg-[#4DA6FF]/10',
    border: 'border-[#4DA6FF]/20',
    text: 'text-[#4DA6FF]',
  },
  playoffs: {
    label: 'PLAYOFFS',
    icon: Trophy,
    bg: 'bg-[#FF6B35]/10',
    border: 'border-[#FF6B35]/20',
    text: 'text-[#FF6B35]',
  },
  combined: {
    label: 'COMBINED',
    icon: Layers,
    bg: 'bg-[#A78BFA]/10',
    border: 'border-[#A78BFA]/20',
    text: 'text-[#A78BFA]',
  },
} as const;

// ─── Component ──────────────────────────────────────────────────────────────

export default function SeasonTypeBadge({ type, size = 'sm' }: SeasonTypeBadgeProps) {
  const config = BADGE_MAP[type];
  const Icon = config.icon;
  const iconSize = size === 'sm' ? 12 : 14;

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded-full border',
        'text-[10px] font-semibold uppercase tracking-wider',
        size === 'sm' ? 'px-2 py-0.5' : 'px-2.5 py-1',
        config.bg,
        config.border,
        config.text,
      )}
    >
      <Icon size={iconSize} strokeWidth={2} className="shrink-0" />
      {config.label}
    </span>
  );
}
