'use client';

import { type ReactNode, type MouseEvent, useCallback, useRef } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
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
  const cardRef = useRef<HTMLDivElement>(null);

  // 3D tilt on hover
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const rotateX = useSpring(useTransform(mouseY, [-0.5, 0.5], [4, -4]), { stiffness: 300, damping: 20 });
  const rotateY = useSpring(useTransform(mouseX, [-0.5, 0.5], [-4, 4]), { stiffness: 300, damping: 20 });

  const handleMouseMove = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      if (!hoverable || !cardRef.current) return;
      const rect = cardRef.current.getBoundingClientRect();
      mouseX.set((e.clientX - rect.left) / rect.width - 0.5);
      mouseY.set((e.clientY - rect.top) / rect.height - 0.5);
    },
    [hoverable, mouseX, mouseY],
  );

  const handleMouseLeave = useCallback(() => {
    mouseX.set(0);
    mouseY.set(0);
  }, [mouseX, mouseY]);

  const handleClick = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      onClick?.(e);
    },
    [onClick],
  );

  return (
    <motion.div
      ref={cardRef}
      className={clsx(
        'relative overflow-hidden',
        'bg-white rounded-2xl',
        'border border-black/[0.06]',
        'shadow-[0_2px_8px_rgba(0,0,0,0.04),0_12px_40px_rgba(0,0,0,0.08)]',
        isInteractive && 'cursor-pointer',
        hoverable && 'transition-shadow duration-300 hover:shadow-[0_4px_16px_rgba(0,0,0,0.06),0_20px_60px_rgba(0,0,0,0.12)]',
        className,
      )}
      style={hoverable ? { perspective: 1200, rotateX, rotateY, transformStyle: 'preserve-3d' } : undefined}
      onMouseMove={hoverable ? handleMouseMove : undefined}
      onMouseLeave={hoverable ? handleMouseLeave : undefined}
      onClick={isInteractive ? handleClick : undefined}
      whileTap={pressable ? { scale: 0.97 } : undefined}
      transition={
        pressable
          ? { type: 'spring', stiffness: 300, damping: 20 }
          : undefined
      }
      role={isInteractive ? 'button' : undefined}
      tabIndex={isInteractive ? 0 : undefined}
    >
      {/* Left border tint accent */}
      {tintColor && (
        <div
          className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-2xl"
          style={{ background: tintColor }}
        />
      )}

      {/* Content */}
      <div className="relative z-10">{children}</div>
    </motion.div>
  );
}
