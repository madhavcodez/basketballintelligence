'use client';

import { useState } from 'react';
import Image from 'next/image';
import clsx from 'clsx';
import { playerHeadshotUrl } from '@/lib/nba-assets';

type AvatarSize = 'sm' | 'md' | 'lg' | 'xl';

interface PlayerAvatarProps {
  readonly name: string;
  readonly playerId?: number | string | null;
  readonly size?: AvatarSize;
  readonly teamColor?: string;
  readonly className?: string;
}

const sizeMap: Record<AvatarSize, { container: string; text: string; px: number }> = {
  sm: { container: 'h-8 w-8', text: 'text-xs font-semibold', px: 32 },
  md: { container: 'h-10 w-10', text: 'text-sm font-semibold', px: 40 },
  lg: { container: 'h-14 w-14', text: 'text-lg font-bold', px: 56 },
  xl: { container: 'h-20 w-20', text: 'text-2xl font-extrabold', px: 80 },
};

// Deterministic gradient palette based on name hash
const gradients = [
  ['#FF6B35', '#FF9F1C'],
  ['#0071E3', '#6366F1'],
  ['#34D399', '#06B6D4'],
  ['#A78BFA', '#EC4899'],
  ['#F87171', '#FB923C'],
  ['#FBBF24', '#F59E0B'],
  ['#6366F1', '#8B5CF6'],
  ['#14B8A6', '#34D399'],
] as const;

function hashName(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    const char = name.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return Math.abs(hash);
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

export default function PlayerAvatar({
  name,
  playerId,
  size = 'md',
  teamColor,
  className,
}: PlayerAvatarProps) {
  const [imgError, setImgError] = useState(false);
  const styles = sizeMap[size];
  const hash = hashName(name);
  const gradientPair = gradients[hash % gradients.length];

  const bgGradient = teamColor
    ? `linear-gradient(135deg, ${teamColor}, ${teamColor}99)`
    : `linear-gradient(135deg, ${gradientPair[0]}, ${gradientPair[1]})`;

  const hasHeadshot = playerId && !imgError;

  return (
    <div
      className={clsx(
        'inline-flex items-center justify-center rounded-full shrink-0 overflow-hidden',
        'border border-black/[0.08]',
        'select-none',
        hasHeadshot ? 'bg-[#F5F5F7]' : '',
        styles.container,
        className,
      )}
      style={hasHeadshot ? undefined : { background: bgGradient }}
      aria-label={name}
    >
      {hasHeadshot ? (
        <Image
          src={playerHeadshotUrl(playerId)}
          alt={name}
          width={styles.px}
          height={styles.px}
          className="object-cover w-full h-full"
          onError={() => setImgError(true)}
          unoptimized
        />
      ) : (
        <span className={clsx(styles.text, 'text-white/90 leading-none')}>
          {getInitials(name)}
        </span>
      )}
    </div>
  );
}
