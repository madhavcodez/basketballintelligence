'use client';

import { type ReactNode, type MouseEvent, useCallback } from 'react';
import { motion } from 'framer-motion';
import clsx from 'clsx';

interface GlassCardProps {
  readonly children: ReactNode;
  readonly className?: string;
  readonly tintColor?: string;
  readonly hoverable?: boolean;
  readonly pressable?: boolean;
  readonly onClick?: (e: MouseEvent<HTMLDivElement>) => void;
}

export default function GlassCard({
  children,
  className,
  tintColor,
  hoverable = false,
  pressable = false,
  onClick,
}: GlassCardProps) {
  const isInteractive = hoverable || pressable || !!onClick;

  const handleClick = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      onClick?.(e);
    },
    [onClick],
  );

  return (
    <motion.div
      className={clsx(
        'relative overflow-hidden',
        'bg-glass-bg backdrop-blur-xl',
        'border border-glass-border',
        'rounded-[20px]',
        isInteractive && 'cursor-pointer',
        hoverable && 'transition-all duration-300 hover:border-white/[0.18] hover:shadow-[0_8px_40px_rgba(0,0,0,0.35)]',
        className,
      )}
      onClick={isInteractive ? handleClick : undefined}
      whileHover={hoverable ? { y: -2, transition: { type: 'spring', stiffness: 300, damping: 20 } } : undefined}
      whileTap={pressable ? { scale: 0.97 } : undefined}
      transition={
        pressable
          ? { type: 'spring', stiffness: 300, damping: 20 }
          : undefined
      }
      role={isInteractive ? 'button' : undefined}
      tabIndex={isInteractive ? 0 : undefined}
    >
      {/* Optional tint gradient overlay */}
      {tintColor && (
        <div
          className="pointer-events-none absolute inset-0 rounded-[20px] opacity-[0.06]"
          style={{
            background: `radial-gradient(ellipse at top left, ${tintColor}, transparent 70%)`,
          }}
        />
      )}

      {/* Content */}
      <div className="relative z-10">{children}</div>
    </motion.div>
  );
}
