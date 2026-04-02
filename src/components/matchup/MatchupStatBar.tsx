'use client';

import { motion } from 'framer-motion';
import clsx from 'clsx';

// ── Types ────────────────────────────────────────────────────────────────────

interface MatchupStatBarProps {
  readonly label: string;
  readonly p1Value: number;
  readonly p2Value: number;
  readonly format?: 'number' | 'percentage';
  readonly delay?: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatValue(value: number, format: 'number' | 'percentage'): string {
  if (format === 'percentage') {
    return `${(value * 100).toFixed(1)}%`;
  }
  return value.toFixed(1);
}

function computeBarWidths(
  p1Value: number,
  p2Value: number,
): { readonly p1Width: number; readonly p2Width: number } {
  const total = Math.abs(p1Value) + Math.abs(p2Value);

  if (total === 0) {
    return { p1Width: 50, p2Width: 50 };
  }

  const p1Width = (Math.abs(p1Value) / total) * 100;
  const p2Width = (Math.abs(p2Value) / total) * 100;

  return { p1Width, p2Width };
}

// ── Spring Config ────────────────────────────────────────────────────────────

const SPRING_SNAPPY = { type: 'spring' as const, stiffness: 300, damping: 20 };

// ── Component ────────────────────────────────────────────────────────────────

export default function MatchupStatBar({
  label,
  p1Value,
  p2Value,
  format = 'number',
  delay = 0,
}: MatchupStatBarProps) {
  const { p1Width, p2Width } = computeBarWidths(p1Value, p2Value);
  const p1IsWinner = p1Value > p2Value;
  const p2IsWinner = p2Value > p1Value;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        ...SPRING_SNAPPY,
        delay,
      }}
      className="space-y-1.5"
    >
      {/* Label */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, delay: delay + 0.05 }}
        className="text-[10px] sm:text-xs uppercase tracking-wider text-[#86868B] font-semibold text-center"
      >
        {label}
      </motion.p>

      {/* Bar + Values */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* P1 winning indicator */}
        <motion.span
          initial={{ opacity: 0, x: 4 }}
          animate={{ opacity: p1IsWinner ? 1 : 0, x: 0 }}
          transition={{ ...SPRING_SNAPPY, delay: delay + 0.3 }}
          className="text-[8px] text-[#FF6B35]"
          aria-hidden="true"
        >
          &#9654;
        </motion.span>

        {/* P1 value */}
        <span
          className={clsx(
            'text-xs sm:text-sm font-bold font-mono min-w-[48px] text-right tabular-nums',
            p1IsWinner ? 'text-[#FF6B35]' : 'text-[#6E6E73]',
          )}
        >
          {formatValue(p1Value, format)}
        </span>

        {/* Bar container */}
        <div className="flex-1 flex items-center gap-0.5 h-4 sm:h-5">
          {/* P1 bar (grows right-to-left from center) */}
          <div className="flex-1 flex justify-end h-full">
            <motion.div
              className="h-full rounded-l-full"
              style={{
                background: p1IsWinner
                  ? 'linear-gradient(90deg, rgba(255,107,53,0.15), #FF6B35)'
                  : 'rgba(0,0,0,0.06)',
              }}
              initial={{ width: 0 }}
              animate={{ width: `${p1Width}%` }}
              transition={{
                ...SPRING_SNAPPY,
                delay: delay + 0.1,
              }}
            />
          </div>

          {/* P2 bar (grows left-to-right from center) */}
          <div className="flex-1 flex justify-start h-full">
            <motion.div
              className="h-full rounded-r-full"
              style={{
                background: p2IsWinner
                  ? 'linear-gradient(270deg, rgba(77,166,255,0.15), #0071E3)'
                  : 'rgba(0,0,0,0.06)',
              }}
              initial={{ width: 0 }}
              animate={{ width: `${p2Width}%` }}
              transition={{
                ...SPRING_SNAPPY,
                delay: delay + 0.1,
              }}
            />
          </div>
        </div>

        {/* P2 value */}
        <span
          className={clsx(
            'text-xs sm:text-sm font-bold font-mono min-w-[48px] text-left tabular-nums',
            p2IsWinner ? 'text-[#0071E3]' : 'text-[#6E6E73]',
          )}
        >
          {formatValue(p2Value, format)}
        </span>

        {/* P2 winning indicator */}
        <motion.span
          initial={{ opacity: 0, x: -4 }}
          animate={{ opacity: p2IsWinner ? 1 : 0, x: 0 }}
          transition={{ ...SPRING_SNAPPY, delay: delay + 0.3 }}
          className="text-[8px] text-[#0071E3]"
          aria-hidden="true"
        >
          &#9664;
        </motion.span>
      </div>
    </motion.div>
  );
}
