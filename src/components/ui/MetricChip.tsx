'use client';

import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import clsx from 'clsx';

type TrendDirection = 'up' | 'down' | 'neutral';
type ChipSize = 'sm' | 'md' | 'lg';

interface MetricChipProps {
  readonly label: string;
  readonly value: string | number;
  readonly highlight?: boolean;
  readonly trend?: TrendDirection;
  readonly size?: ChipSize;
}

const sizeStyles: Record<ChipSize, { wrapper: string; value: string; label: string; icon: number }> = {
  sm: {
    wrapper: 'px-2.5 py-1.5 gap-0.5',
    value: 'text-sm font-semibold',
    label: 'text-[9px] tracking-wider',
    icon: 10,
  },
  md: {
    wrapper: 'px-3 py-2 gap-1',
    value: 'text-lg font-bold',
    label: 'text-[10px] tracking-wider',
    icon: 12,
  },
  lg: {
    wrapper: 'px-4 py-3 gap-1',
    value: 'text-2xl font-extrabold',
    label: 'text-xs tracking-wider',
    icon: 14,
  },
};

const trendConfig: Record<TrendDirection, { icon: typeof TrendingUp; color: string }> = {
  up: { icon: TrendingUp, color: 'text-accent-green' },
  down: { icon: TrendingDown, color: 'text-accent-red' },
  neutral: { icon: Minus, color: 'text-chrome-dim' },
};

export default function MetricChip({
  label,
  value,
  highlight = false,
  trend,
  size = 'md',
}: MetricChipProps) {
  const styles = sizeStyles[size];

  return (
    <div
      className={clsx(
        'inline-flex flex-col items-center rounded-2xl',
        styles.wrapper,
        highlight
          ? 'bg-accent-orange/[0.08] border border-accent-orange/20'
          : 'bg-glass-bg border border-glass-border',
      )}
    >
      <div className="flex items-center gap-1">
        <span
          className={clsx(
            styles.value,
            'font-display leading-none',
            highlight ? 'text-accent-orange' : 'text-chrome-light',
          )}
        >
          {value}
        </span>
        {trend && <TrendIcon trend={trend} size={styles.icon} />}
      </div>
      <span
        className={clsx(
          styles.label,
          'uppercase font-medium leading-none',
          highlight ? 'text-accent-orange/70' : 'text-chrome-dim',
        )}
      >
        {label}
      </span>
    </div>
  );
}

function TrendIcon({ trend, size }: { readonly trend: TrendDirection; readonly size: number }) {
  const config = trendConfig[trend];
  const Icon = config.icon;
  return <Icon size={size} className={config.color} />;
}
