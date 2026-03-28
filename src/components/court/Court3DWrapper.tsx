'use client';

import { type ReactNode, useState, useCallback } from 'react';
import { motion, useMotionValue, useTransform, useSpring } from 'framer-motion';
import clsx from 'clsx';
import { colors } from '@/lib/design-tokens';

// ── Props ─────────────────────────────────────────────────────────────────────

interface Court3DWrapperProps {
  readonly children: ReactNode;
  readonly enabled?: boolean;
  readonly className?: string;
  readonly glowColor?: string;
  readonly showHoop?: boolean;
  readonly showFloor?: boolean;
  readonly interactive?: boolean;
}

// ── Component ─────────────────────────────────────────────────────────────────
// Wraps any court visualization in a 3D perspective container with:
// - CSS perspective transform for depth
// - Glowing rim effect around the basket
// - Subtle parallax on mouse movement
// - Floor reflection gradient
// - Animated hoop glow

export default function Court3DWrapper({
  children,
  enabled = true,
  className,
  glowColor = colors.accentOrange,
  showHoop = true,
  showFloor = true,
  interactive = true,
}: Court3DWrapperProps) {
  const [isHovered, setIsHovered] = useState(false);

  // Mouse tracking for parallax
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const rotateX = useSpring(useTransform(mouseY, [-0.5, 0.5], [3, -3]), {
    stiffness: 150,
    damping: 20,
  });
  const rotateY = useSpring(useTransform(mouseX, [-0.5, 0.5], [-3, 3]), {
    stiffness: 150,
    damping: 20,
  });

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!interactive || !enabled) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      mouseX.set(x);
      mouseY.set(y);
    },
    [interactive, enabled, mouseX, mouseY],
  );

  const handleMouseLeave = useCallback(() => {
    mouseX.set(0);
    mouseY.set(0);
    setIsHovered(false);
  }, [mouseX, mouseY]);

  if (!enabled) {
    return <div className={className}>{children}</div>;
  }

  return (
    <div
      className={clsx('relative', className)}
      style={{ perspective: '1200px', perspectiveOrigin: '50% 30%' }}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={handleMouseLeave}
    >
      {/* Floor shadow — light mode */}
      {showFloor && (
        <div
          className="absolute -bottom-8 left-[5%] right-[5%] h-16 rounded-[50%] blur-2xl pointer-events-none transition-opacity duration-500"
          style={{
            background: 'radial-gradient(ellipse, rgba(0,0,0,0.08), transparent 70%)',
            opacity: isHovered ? 0.5 : 0.3,
          }}
        />
      )}

      {/* 3D Court container */}
      <motion.div
        style={{
          rotateX: interactive ? rotateX : 8,
          rotateY: interactive ? rotateY : 0,
          transformStyle: 'preserve-3d',
        }}
        initial={{ rotateX: 12, scale: 0.95, opacity: 0 }}
        animate={{ rotateX: 8, scale: 1, opacity: 1 }}
        transition={{
          duration: 1.2,
          ease: [0.16, 1, 0.3, 1],
        }}
        className="relative"
      >
        {/* Subtle ambient shadow behind court — light mode */}
        <div
          className="absolute inset-0 -z-10 blur-3xl pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse 80% 60% at 50% 15%, rgba(0,0,0,0.04), transparent)',
            transform: 'translateZ(-20px)',
          }}
        />

        {/* The actual court/heatmap content */}
        <div className="relative" style={{ transform: 'translateZ(0)' }}>
          {children}
        </div>

        {/* Hoop glow effect — static for light mode */}
        {showHoop && (
          <div
            className="absolute pointer-events-none"
            style={{
              top: '8%',
              left: '50%',
              transform: 'translateX(-50%) translateZ(10px)',
              width: 40,
              height: 40,
            }}
          >
            <div
              className="absolute inset-0 rounded-full"
              style={{
                background: `radial-gradient(circle, ${glowColor}30 0%, transparent 70%)`,
                filter: 'blur(6px)',
                opacity: 0.4,
              }}
            />
          </div>
        )}

        {/* Top edge highlight — light mode */}
        <div
          className="absolute top-0 left-[10%] right-[10%] h-[1px] pointer-events-none"
          style={{
            background: 'linear-gradient(90deg, transparent, rgba(0,0,0,0.06), transparent)',
            transform: 'translateZ(2px)',
          }}
        />
      </motion.div>

      {/* Inline shadow underneath — light mode */}
      <div
        className="absolute -bottom-4 left-[10%] right-[10%] h-8 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 80% 100%, rgba(0,0,0,0.1) 0%, transparent 70%)',
          filter: 'blur(8px)',
        }}
      />
    </div>
  );
}
