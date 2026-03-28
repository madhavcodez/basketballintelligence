'use client';

import { useCallback } from 'react';
import { motion } from 'framer-motion';
import { Play, Film, Clock } from 'lucide-react';
import clsx from 'clsx';
import TagBadge from './TagBadge';
import PlayerAvatar from '@/components/ui/PlayerAvatar';

// ── Play type accent color mapping ──────────────────────────────────────────

const PLAY_TYPE_ACCENT: Record<string, string> = {
  isolation: 'bg-[#FF6B35]',
  'pick-and-roll': 'bg-[#0071E3]',
  'spot-up': 'bg-[#22C55E]',
  transition: 'bg-[#8B5CF6]',
  'post-up': 'bg-[#F59E0B]',
  'off-screen': 'bg-[#EF4444]',
  handoff: 'bg-[#0071E3]',
  cut: 'bg-[#22C55E]',
};

function getPlayTypeAccent(playType: string | null): string | null {
  if (!playType) return null;
  return PLAY_TYPE_ACCENT[playType.toLowerCase()] ?? 'bg-[#86868B]';
}

type ClipSize = 'sm' | 'md' | 'lg';

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

interface ClipCardProps {
  readonly clip: ClipData;
  readonly tags?: ReadonlyArray<ClipTag>;
  readonly size?: ClipSize;
  readonly showPlayer?: boolean;
  readonly showTags?: boolean;
  readonly onClick?: () => void;
  readonly className?: string;
}

const sizeConfig: Record<ClipSize, { card: string; thumb: string; icon: number; text: string; badge: string }> = {
  sm: {
    card: 'w-[200px]',
    thumb: 'h-[112px]',
    icon: 28,
    text: 'text-xs',
    badge: 'text-[9px] px-1.5 py-0.5',
  },
  md: {
    card: 'w-[280px]',
    thumb: 'h-[158px]',
    icon: 36,
    text: 'text-sm',
    badge: 'text-[10px] px-2 py-0.5',
  },
  lg: {
    card: 'w-[380px]',
    thumb: 'h-[214px]',
    icon: 44,
    text: 'text-base',
    badge: 'text-[11px] px-2.5 py-1',
  },
};

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  if (mins > 0) {
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
  return `0:${secs.toString().padStart(2, '0')}`;
}

function resolveTagCategory(category: string): 'action' | 'player' | 'team' | 'context' | 'quality' | 'custom' {
  const valid = ['action', 'player', 'team', 'context', 'quality', 'custom'] as const;
  const lower = category.toLowerCase();
  for (const c of valid) {
    if (lower === c) return c;
  }
  return 'custom';
}

export default function ClipCard({
  clip,
  tags = [],
  size = 'md',
  showPlayer = true,
  showTags = true,
  onClick,
  className,
}: ClipCardProps) {
  const config = sizeConfig[size];
  const isInteractive = !!onClick;

  const handleClick = useCallback(() => {
    onClick?.();
  }, [onClick]);

  return (
    <motion.div
      className={clsx(
        'group relative flex flex-col overflow-hidden',
        'bg-white',
        'border border-black/[0.06]',
        'rounded-[20px]',
        config.card,
        isInteractive && 'cursor-pointer',
        className,
      )}
      style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.04), 0 12px 40px rgba(0,0,0,0.08)' }}
      onClick={isInteractive ? handleClick : undefined}
      whileHover={isInteractive ? { y: -4, transition: { type: 'spring', stiffness: 300, damping: 20 } } : undefined}
      role={isInteractive ? 'button' : undefined}
      tabIndex={isInteractive ? 0 : undefined}
    >
      {/* Thumbnail area — 16:9 */}
      <div className={clsx('relative overflow-hidden', config.thumb)}>
        {/* Play type accent strip at top */}
        {getPlayTypeAccent(clip.play_type) && (
          <div className={clsx('absolute top-0 inset-x-0 h-[3px] z-10', getPlayTypeAccent(clip.play_type))} />
        )}

        {clip.thumbnail_path ? (
          /* Actual thumbnail */
          <motion.img
            src={clip.thumbnail_path}
            alt={clip.title ?? 'Clip thumbnail'}
            className="h-full w-full object-cover"
            whileHover={{ scale: 1.05 }}
            transition={{ type: 'spring', stiffness: 200, damping: 20 }}
          />
        ) : (
          /* Cinematic placeholder */
          <motion.div
            className={clsx(
              'flex flex-col items-center justify-center gap-2',
              'h-full w-full',
              'bg-gradient-to-br from-[#2A2A2E] via-[#1D1D1F] to-[#0A0A0A]',
            )}
            whileHover={{ scale: 1.05 }}
            transition={{ type: 'spring', stiffness: 200, damping: 20 }}
          >
            {/* Subtle dot pattern overlay */}
            <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '16px 16px' }} />
            <Film size={config.icon * 0.7} className="text-white/25 relative z-[1]" />
            {clip.play_type && (
              <span className="text-[10px] font-medium uppercase tracking-widest text-white/30 relative z-[1]">
                {clip.play_type}
              </span>
            )}
          </motion.div>
        )}

        {/* Dark gradient overlay at bottom of thumbnail */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/70 to-transparent" />

        {/* Play icon — centered */}
        <div
          className={clsx(
            'absolute inset-0 flex items-center justify-center',
            'pointer-events-none',
          )}
        >
          <motion.div
            className={clsx(
              'flex items-center justify-center',
              'rounded-full bg-white/20 backdrop-blur-sm',
              size === 'sm' ? 'h-9 w-9' : size === 'md' ? 'h-11 w-11' : 'h-14 w-14',
              'opacity-80 transition-opacity duration-200',
              'group-hover:opacity-100',
            )}
            whileHover={{ scale: 1.15 }}
            transition={{ type: 'spring', stiffness: 300, damping: 15 }}
          >
            <Play
              size={config.icon * 0.45}
              className="text-white ml-0.5"
              fill="currentColor"
            />
          </motion.div>
        </div>

        {/* Duration badge — bottom-right */}
        <div
          className={clsx(
            'absolute bottom-2 right-2',
            'flex items-center gap-1',
            'rounded-full bg-[#1D1D1F] backdrop-blur-sm',
            config.badge,
            'font-mono font-medium text-white',
          )}
        >
          <Clock size={size === 'sm' ? 9 : 10} className="opacity-70" />
          {formatDuration(clip.duration)}
        </div>
      </div>

      {/* Info area */}
      <div className="flex flex-col gap-1.5 p-3">
        {/* Title / play type */}
        <p
          className={clsx(
            config.text,
            'font-semibold text-[#1D1D1F] leading-snug truncate',
          )}
        >
          {clip.title ?? clip.play_type ?? 'Untitled Clip'}
        </p>

        {/* Meta row: player, quarter, clock */}
        <div className="flex items-center gap-2 flex-wrap">
          {showPlayer && clip.primary_player && (
            <span className="flex items-center gap-1 text-[11px] text-[#6E6E73]">
              <PlayerAvatar name={clip.primary_player} size="sm" className="!h-4 !w-4" />
              {clip.primary_player}
            </span>
          )}
          {clip.quarter !== null && (
            <span className="text-[11px] text-[#86868B]">
              Q{clip.quarter}
            </span>
          )}
          {clip.game_clock && (
            <span className="text-[10px] font-mono text-[#86868B]">
              {clip.game_clock}
            </span>
          )}
          {clip.primary_action && (
            <span
              className={clsx(
                'text-[10px] font-medium uppercase tracking-wider',
                'text-accent-orange/80',
              )}
            >
              {clip.primary_action}
            </span>
          )}
        </div>

        {/* Tags */}
        {showTags && tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-0.5">
            {tags.slice(0, size === 'sm' ? 2 : 4).map((tag) => (
              <TagBadge
                key={`${tag.category}-${tag.name}`}
                name={tag.name}
                category={resolveTagCategory(tag.category)}
                size="sm"
              />
            ))}
            {tags.length > (size === 'sm' ? 2 : 4) && (
              <span className="text-[10px] text-[#86868B] self-center">
                +{tags.length - (size === 'sm' ? 2 : 4)}
              </span>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}
