'use client';

import { useCallback } from 'react';
import clsx from 'clsx';

type TagCategory = 'action' | 'player' | 'team' | 'context' | 'quality' | 'custom';
type TagSize = 'sm' | 'md';

interface TagBadgeProps {
  readonly name: string;
  readonly category: TagCategory;
  readonly size?: TagSize;
  readonly onClick?: (name: string, category: TagCategory) => void;
  readonly className?: string;
}

const categoryColors: Record<TagCategory, { bg: string; border: string; text: string }> = {
  action: {
    bg: 'bg-[#FF6B35]/[0.10]',
    border: 'border-[#FF6B35]/25',
    text: 'text-[#FF6B35]',
  },
  player: {
    bg: 'bg-[#0071E3]/[0.10]',
    border: 'border-[#0071E3]/25',
    text: 'text-[#0071E3]',
  },
  team: {
    bg: 'bg-[#22C55E]/[0.10]',
    border: 'border-[#22C55E]/25',
    text: 'text-[#22C55E]',
  },
  context: {
    bg: 'bg-violet-500/[0.10]',
    border: 'border-violet-500/25',
    text: 'text-violet-500',
  },
  quality: {
    bg: 'bg-[#F59E0B]/[0.10]',
    border: 'border-[#F59E0B]/25',
    text: 'text-[#F59E0B]',
  },
  custom: {
    bg: 'bg-white',
    border: 'border-black/[0.06]',
    text: 'text-[#6E6E73]',
  },
};

const sizeStyles: Record<TagSize, string> = {
  sm: 'px-2 py-0.5 text-[10px] gap-1',
  md: 'px-2.5 py-1 text-[11px] gap-1.5',
};

export default function TagBadge({
  name,
  category,
  size = 'sm',
  onClick,
  className,
}: TagBadgeProps) {
  const colors = categoryColors[category];
  const isInteractive = !!onClick;

  const handleClick = useCallback(() => {
    onClick?.(name, category);
  }, [onClick, name, category]);

  return (
    <button
      type="button"
      disabled={!isInteractive}
      onClick={isInteractive ? handleClick : undefined}
      className={clsx(
        'inline-flex items-center rounded-full border',
        'font-semibold leading-none tracking-wide',
        'transition-all duration-150',
        colors.bg,
        colors.border,
        colors.text,
        sizeStyles[size],
        isInteractive && 'cursor-pointer hover:brightness-125 active:scale-95',
        !isInteractive && 'cursor-default',
        className,
      )}
    >
      {/* Category color dot */}
      <span
        className={clsx(
          'inline-block rounded-full shrink-0',
          size === 'sm' ? 'h-1.5 w-1.5' : 'h-2 w-2',
          colors.text,
          'opacity-80',
        )}
        style={{ backgroundColor: 'currentColor' }}
      />
      {name}
    </button>
  );
}
