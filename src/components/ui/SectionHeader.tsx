import { type ReactNode } from 'react';
import clsx from 'clsx';

interface SectionHeaderProps {
  readonly title: string;
  readonly eyebrow?: string;
  readonly action?: ReactNode;
  readonly className?: string;
}

export default function SectionHeader({
  title,
  eyebrow,
  action,
  className,
}: SectionHeaderProps) {
  return (
    <div className={clsx('flex items-end justify-between gap-4', className)}>
      <div className="flex flex-col gap-1">
        {eyebrow && (
          <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-text-tertiary">
            {eyebrow}
          </span>
        )}
        <h2 className="text-lg sm:text-xl font-bold tracking-tight text-text-primary font-display">
          {title}
        </h2>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
