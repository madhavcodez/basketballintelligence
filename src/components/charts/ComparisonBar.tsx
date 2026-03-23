'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import { colors, animation } from '@/lib/design-tokens';

// ── Types ─────────────────────────────────────────────────────────

export interface ComparisonBarProps {
  /** Stat label (centre) */
  label: string;
  /** Value for player 1 (left bar) */
  value1: number;
  /** Value for player 2 (right bar) */
  value2: number;
  /** Player 1 name */
  name1: string;
  /** Player 2 name */
  name2: string;
  /** Maximum value for the scale (auto-detected if omitted) */
  max?: number;
  /** Additional CSS class names */
  className?: string;
}

// ── Constants ─────────────────────────────────────────────────────

const BAR_H = 24;
const CENTER_W = 80; // px reserved for centre label (in viewBox units)

// ── Component ─────────────────────────────────────────────────────

export default function ComparisonBar({
  label,
  value1,
  value2,
  name1,
  name2,
  max: maxOverride,
  className,
}: ComparisonBarProps) {
  const max = useMemo(
    () => maxOverride ?? Math.max(value1, value2, 1),
    [value1, value2, maxOverride],
  );

  const VB_W = 500;
  const halfW = (VB_W - CENTER_W) / 2;

  const bar1W = (value1 / max) * halfW;
  const bar2W = (value2 / max) * halfW;

  // Left bar grows from centre to the left
  const bar1X = halfW - bar1W;
  // Right bar starts at centre-right edge
  const bar2X = halfW + CENTER_W;

  return (
    <div className={clsx('w-full', className)}>
      <svg
        viewBox={`0 0 ${VB_W} ${BAR_H + 24}`}
        preserveAspectRatio="xMidYMid meet"
        className="w-full h-auto"
        role="img"
        aria-label={`${name1} vs ${name2}: ${label}`}
      >
        <defs>
          <linearGradient id="comp-bar-left" x1="1" y1="0" x2="0" y2="0">
            <stop offset="0%" stopColor={colors.accentOrange} />
            <stop offset="100%" stopColor={colors.accentGold} stopOpacity={0.6} />
          </linearGradient>
          <linearGradient id="comp-bar-right" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={colors.accentBlue} />
            <stop offset="100%" stopColor={colors.accentViolet} stopOpacity={0.6} />
          </linearGradient>
        </defs>

        {/* ── Left track ────────────────────────────────── */}
        <rect
          x={0}
          y={0}
          width={halfW}
          height={BAR_H}
          rx={6}
          fill={colors.glassBg}
        />

        {/* Left bar (player 1) */}
        <motion.rect
          y={0}
          height={BAR_H}
          rx={6}
          fill="url(#comp-bar-left)"
          fillOpacity={0.85}
          initial={{ x: halfW, width: 0 }}
          animate={{ x: bar1X, width: bar1W }}
          transition={animation.spring.gentle}
        />

        {/* Glass highlight */}
        <motion.rect
          y={0}
          height={BAR_H / 2}
          rx={6}
          fill="rgba(255,255,255,0.08)"
          initial={{ x: halfW, width: 0 }}
          animate={{ x: bar1X, width: bar1W }}
          transition={animation.spring.gentle}
        />

        {/* ── Right track ───────────────────────────────── */}
        <rect
          x={halfW + CENTER_W}
          y={0}
          width={halfW}
          height={BAR_H}
          rx={6}
          fill={colors.glassBg}
        />

        {/* Right bar (player 2) */}
        <motion.rect
          x={bar2X}
          y={0}
          height={BAR_H}
          rx={6}
          fill="url(#comp-bar-right)"
          fillOpacity={0.85}
          initial={{ width: 0 }}
          animate={{ width: bar2W }}
          transition={animation.spring.gentle}
        />

        {/* Glass highlight */}
        <motion.rect
          x={bar2X}
          y={0}
          height={BAR_H / 2}
          rx={6}
          fill="rgba(255,255,255,0.08)"
          initial={{ width: 0 }}
          animate={{ width: bar2W }}
          transition={animation.spring.gentle}
        />

        {/* ── Centre label ──────────────────────────────── */}
        <text
          x={VB_W / 2}
          y={BAR_H / 2}
          textAnchor="middle"
          dominantBaseline="central"
          fill={colors.chromeMedium}
          fontSize={10}
          fontWeight={600}
        >
          {label}
        </text>

        {/* ── Player 1 name + value (left) ──────────────── */}
        <motion.text
          x={bar1X - 6}
          y={BAR_H / 2}
          textAnchor="end"
          dominantBaseline="central"
          fill={colors.chromeLight}
          fontSize={10}
          fontWeight={700}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          {value1.toLocaleString(undefined, { maximumFractionDigits: 1 })}
        </motion.text>

        <text
          x={0}
          y={BAR_H + 16}
          textAnchor="start"
          fill={colors.accentOrange}
          fontSize={9}
          fontWeight={500}
        >
          {name1}
        </text>

        {/* ── Player 2 name + value (right) ─────────────── */}
        <motion.text
          x={bar2X + bar2W + 6}
          y={BAR_H / 2}
          textAnchor="start"
          dominantBaseline="central"
          fill={colors.chromeLight}
          fontSize={10}
          fontWeight={700}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          {value2.toLocaleString(undefined, { maximumFractionDigits: 1 })}
        </motion.text>

        <text
          x={VB_W}
          y={BAR_H + 16}
          textAnchor="end"
          fill={colors.accentBlue}
          fontSize={9}
          fontWeight={500}
        >
          {name2}
        </text>
      </svg>
    </div>
  );
}
