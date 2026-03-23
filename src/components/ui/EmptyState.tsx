'use client';

import { type ReactNode } from 'react';
import { type LucideIcon } from 'lucide-react';
import clsx from 'clsx';
import GlassCard from './GlassCard';

interface EmptyStateProps {
  readonly icon: LucideIcon;
  readonly title: string;
  readonly subtitle: string;
  readonly action?: ReactNode;
  readonly className?: string;
}

export default function EmptyState({
  icon: Icon,
  title,
  subtitle,
  action,
  className,
}: EmptyStateProps) {
  return (
    <GlassCard className={clsx('p-8 sm:p-12', className)}>
      <div className="flex flex-col items-center text-center gap-4">
        {/* Icon container */}
        <div
          className={clsx(
            'flex items-center justify-center',
            'h-16 w-16 sm:h-20 sm:w-20 rounded-full',
            'bg-glass-frosted border border-glass-border',
          )}
        >
          <Icon size={28} className="text-chrome-dim sm:h-8 sm:w-8" />
        </div>

        {/* Text */}
        <div className="flex flex-col gap-1.5">
          <h3 className="text-lg font-semibold text-chrome-light font-display">
            {title}
          </h3>
          <p className="text-sm text-chrome-dim max-w-xs leading-relaxed">
            {subtitle}
          </p>
        </div>

        {/* Action */}
        {action && <div className="mt-2">{action}</div>}
      </div>
    </GlassCard>
  );
}
