'use client';

import { useCallback } from 'react';
import { motion } from 'framer-motion';
import { Play, Clock } from 'lucide-react';
import clsx from 'clsx';
import TagBadge from './TagBadge';
import PlayerAvatar from '@/components/ui/PlayerAvatar';

// ── Play type visual identity ────────────────────────────────────────────────

const PLAY_TYPE_STYLE: Record<string, { color: string; gradient: string; icon: string }> = {
  isolation:       { color: '#FF6B35', gradient: 'from-[#FF6B35]/30 to-[#FF6B35]/5', icon: 'ISO' },
  'pick-and-roll': { color: '#0071E3', gradient: 'from-[#0071E3]/30 to-[#0071E3]/5', icon: 'PNR' },
  'spot-up':       { color: '#22C55E', gradient: 'from-[#22C55E]/30 to-[#22C55E]/5', icon: 'SPOT' },
  transition:      { color: '#A78BFA', gradient: 'from-[#A78BFA]/30 to-[#A78BFA]/5', icon: 'TRANS' },
  'post-up':       { color: '#F59E0B', gradient: 'from-[#F59E0B]/30 to-[#F59E0B]/5', icon: 'POST' },
  'off-screen':    { color: '#EF4444', gradient: 'from-[#EF4444]/30 to-[#EF4444]/5', icon: 'OFF' },
  handoff:         { color: '#06B6D4', gradient: 'from-[#06B6D4]/30 to-[#06B6D4]/5', icon: 'HND' },
  cut:             { color: '#34D399', gradient: 'from-[#34D399]/30 to-[#34D399]/5', icon: 'CUT' },
};

function getStyle(playType: string | null) {
  if (!playType) return { color: '#86868B', gradient: 'from-[#86868B]/20 to-[#86868B]/5', icon: '---' };
  return PLAY_TYPE_STYLE[playType.toLowerCase()] ?? { color: '#86868B', gradient: 'from-[#86868B]/20 to-[#86868B]/5', icon: playType.slice(0, 3).toUpperCase() };
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
  sm: { card: 'w-[200px]', thumb: 'h-[112px]', icon: 28, text: 'text-xs', badge: 'text-[9px] px-1.5 py-0.5' },
  md: { card: 'w-[280px]', thumb: 'h-[158px]', icon: 36, text: 'text-sm', badge: 'text-[10px] px-2 py-0.5' },
  lg: { card: 'w-[380px]', thumb: 'h-[214px]', icon: 44, text: 'text-base', badge: 'text-[11px] px-2.5 py-1' },
};

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return mins > 0 ? `${mins}:${secs.toString().padStart(2, '0')}` : `0:${secs.toString().padStart(2, '0')}`;
}

function resolveTagCategory(category: string): 'action' | 'player' | 'team' | 'context' | 'quality' | 'custom' {
  const valid = ['action', 'player', 'team', 'context', 'quality', 'custom'] as const;
  const lower = category.toLowerCase();
  for (const c of valid) { if (lower === c) return c; }
  return 'custom';
}

export default function ClipCard({
  clip, tags = [], size = 'md', showPlayer = true, showTags = true, onClick, className,
}: ClipCardProps) {
  const config = sizeConfig[size];
  const isInteractive = !!onClick;
  const style = getStyle(clip.play_type);

  const handleClick = useCallback(() => { onClick?.(); }, [onClick]);

  // Build film metadata string like "Q3 · 4:32"
  const metaParts: string[] = [];
  if (clip.quarter !== null) metaParts.push(`Q${clip.quarter}`);
  if (clip.game_clock) metaParts.push(clip.game_clock);
  const metaLine = metaParts.join(' \u00B7 ');

  return (
    <motion.div
      className={clsx(
        'group relative flex flex-col overflow-hidden',
        'rounded-[20px]',
        config.card,
        isInteractive && 'cursor-pointer',
        className,
      )}
      style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.06), 0 16px 48px rgba(0,0,0,0.10)' }}
      onClick={isInteractive ? handleClick : undefined}
      whileHover={{ y: -6, transition: { type: 'spring', stiffness: 300, damping: 20 } }}
      role={isInteractive ? 'button' : undefined}
      tabIndex={isInteractive ? 0 : undefined}
    >
      {/* ── Cinematic thumbnail area ────────────────────────────────── */}
      <div className={clsx('relative overflow-hidden', config.thumb)}>
        {clip.thumbnail_path ? (
          <motion.img
            src={clip.thumbnail_path}
            alt={clip.title ?? 'Clip'}
            className="h-full w-full object-cover"
            whileHover={{ scale: 1.06 }}
            transition={{ type: 'spring', stiffness: 200, damping: 20 }}
          />
        ) : (
          /* Film-poster style placeholder */
          <div className="relative h-full w-full bg-[#0C0C0E] overflow-hidden">
            {/* Radial gradient wash in play-type color */}
            <div
              className="absolute inset-0 opacity-60"
              style={{
                background: `radial-gradient(ellipse at 30% 50%, ${style.color}18 0%, transparent 70%)`,
              }}
            />
            {/* Subtle film grain texture */}
            <div
              className="absolute inset-0 opacity-[0.06] mix-blend-overlay"
              style={{
                backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\'/%3E%3C/svg%3E")',
              }}
            />
            {/* Large faded play-type abbreviation */}
            <div className="absolute inset-0 flex items-center justify-center">
              <span
                className="text-[42px] sm:text-[56px] font-extrabold font-display tracking-tight select-none"
                style={{ color: `${style.color}15` }}
              >
                {style.icon}
              </span>
            </div>
            {/* Bottom metadata overlay */}
            {metaLine && (
              <div className="absolute bottom-3 left-3 flex items-center gap-1.5">
                <span className="text-[10px] font-mono font-medium text-white/40 tracking-wide">
                  {metaLine}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Gradient vignette */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/10" />

        {/* Play button — appears on hover */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <motion.div
            className={clsx(
              'flex items-center justify-center rounded-full',
              'bg-white/15 backdrop-blur-md border border-white/20',
              size === 'sm' ? 'h-9 w-9' : size === 'md' ? 'h-12 w-12' : 'h-14 w-14',
              'opacity-0 group-hover:opacity-100 transition-opacity duration-200',
            )}
          >
            <Play
              size={config.icon * 0.4}
              className="text-white ml-0.5"
              fill="currentColor"
            />
          </motion.div>
        </div>

        {/* Play-type pill — top-left */}
        {clip.play_type && (
          <div
            className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider backdrop-blur-md"
            style={{ background: `${style.color}30`, color: style.color, borderWidth: 1, borderColor: `${style.color}40` }}
          >
            {clip.play_type}
          </div>
        )}

        {/* Duration — bottom-right */}
        <div
          className={clsx(
            'absolute bottom-2 right-2 flex items-center gap-1',
            'rounded-full bg-black/60 backdrop-blur-sm',
            config.badge, 'font-mono font-medium text-white/90',
          )}
        >
          <Clock size={size === 'sm' ? 9 : 10} className="opacity-60" />
          {formatDuration(clip.duration)}
        </div>
      </div>

      {/* ── Info area ──────────────────────────────────────────────── */}
      <div className="flex flex-col gap-1 p-3 bg-white">
        {/* Title */}
        <p className={clsx(config.text, 'font-semibold text-[#1D1D1F] leading-snug truncate')}>
          {clip.title ?? clip.play_type ?? 'Untitled Clip'}
        </p>

        {/* Player + action */}
        <div className="flex items-center gap-2">
          {showPlayer && clip.primary_player && (
            <span className="flex items-center gap-1.5 text-[11px] text-[#6E6E73]">
              <PlayerAvatar name={clip.primary_player} size="sm" className="!h-4 !w-4" />
              <span className="truncate max-w-[120px]">{clip.primary_player}</span>
            </span>
          )}
          {clip.primary_action && (
            <span
              className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full"
              style={{ background: `${style.color}10`, color: style.color }}
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
