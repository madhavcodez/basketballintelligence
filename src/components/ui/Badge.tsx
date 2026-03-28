import { type ReactNode } from 'react';
import clsx from 'clsx';

type BadgeVariant = 'default' | 'accent' | 'success' | 'warning';

interface BadgeProps {
  readonly children: ReactNode;
  readonly variant?: BadgeVariant;
  readonly className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: 'bg-bg-secondary border-black/[0.06] text-text-secondary',
  accent: 'bg-accent-orange/[0.08] border-accent-orange/20 text-accent-orange',
  success: 'bg-accent-green/[0.08] border-accent-green/20 text-accent-green',
  warning: 'bg-accent-gold/[0.08] border-accent-gold/20 text-accent-gold',
};

export default function Badge({
  children,
  variant = 'default',
  className,
}: BadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center',
        'rounded-full border px-2.5 py-0.5',
        'text-[11px] font-semibold leading-none tracking-wide',
        variantStyles[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
