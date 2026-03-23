'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import { colors, animation } from '@/lib/design-tokens';

// ── Types ─────────────────────────────────────────────────────────

export interface BarDatum {
  label: string;
  value: number;
  color?: string;
}

export interface BarChartProps {
  /** Data to display */
  data: BarDatum[];
  /** Horizontal bars (default) or vertical */
  horizontal?: boolean;
  /** Override maximum value for scale */
  maxValue?: number;
  /** Show numeric value labels */
  showValues?: boolean;
  /** Enable entrance animation */
  animate?: boolean;
  /** Additional CSS class names */
  className?: string;
}

// ── Constants ─────────────────────────────────────────────────────

const BAR_HEIGHT = 28;
const BAR_GAP = 10;
const LABEL_WIDTH = 100;
const VALUE_WIDTH = 50;

// ── Component ─────────────────────────────────────────────────────

export default function BarChart({
  data,
  horizontal = true,
  maxValue: maxValueOverride,
  showValues = true,
  animate = true,
  className,
}: BarChartProps) {
  const max = useMemo(
    () => maxValueOverride ?? Math.max(1, ...data.map((d) => d.value)),
    [data, maxValueOverride],
  );

  if (data.length === 0) {
    return (
      <div
        className={clsx('flex items-center justify-center py-8 text-sm', className)}
        style={{ color: colors.chromeDim }}
      >
        No data available
      </div>
    );
  }

  if (!horizontal) {
    return <VerticalBarChart data={data} max={max} showValues={showValues} animate={animate} className={className} />;
  }

  const totalHeight = data.length * (BAR_HEIGHT + BAR_GAP) - BAR_GAP;

  return (
    <div className={clsx('w-full', className)}>
      <svg
        viewBox={`0 0 500 ${totalHeight}`}
        preserveAspectRatio="xMidYMid meet"
        className="w-full h-auto"
        role="img"
        aria-label="Bar chart"
      >
        <defs>
          <linearGradient id="bar-grad-default" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={colors.accentOrange} />
            <stop offset="100%" stopColor={colors.accentGold} />
          </linearGradient>
        </defs>

        {data.map((d, i) => {
          const y = i * (BAR_HEIGHT + BAR_GAP);
          const barMaxWidth = 500 - LABEL_WIDTH - VALUE_WIDTH;
          const barWidth = (d.value / max) * barMaxWidth;
          const fillColor = d.color ?? 'url(#bar-grad-default)';

          return (
            <g key={d.label} aria-label={`${d.label}: ${d.value}`}>
              {/* Label */}
              <text
                x={LABEL_WIDTH - 8}
                y={y + BAR_HEIGHT / 2}
                textAnchor="end"
                dominantBaseline="central"
                fill={colors.chromeMedium}
                fontSize={11}
              >
                {d.label}
              </text>

              {/* Background track */}
              <rect
                x={LABEL_WIDTH}
                y={y}
                width={barMaxWidth}
                height={BAR_HEIGHT}
                rx={6}
                fill={colors.glassBg}
              />

              {/* Animated bar */}
              <motion.rect
                x={LABEL_WIDTH}
                y={y}
                height={BAR_HEIGHT}
                rx={6}
                fill={fillColor}
                fillOpacity={0.85}
                initial={animate ? { width: 0 } : { width: barWidth }}
                animate={{ width: barWidth }}
                transition={{
                  ...animation.spring.gentle,
                  delay: i * 0.06,
                }}
              />

              {/* Glass overlay */}
              <motion.rect
                x={LABEL_WIDTH}
                y={y}
                height={BAR_HEIGHT / 2}
                rx={6}
                fill="rgba(255,255,255,0.08)"
                initial={animate ? { width: 0 } : { width: barWidth }}
                animate={{ width: barWidth }}
                transition={{
                  ...animation.spring.gentle,
                  delay: i * 0.06,
                }}
              />

              {/* Value label */}
              {showValues && (
                <motion.text
                  x={LABEL_WIDTH + barWidth + 8}
                  y={y + BAR_HEIGHT / 2}
                  textAnchor="start"
                  dominantBaseline="central"
                  fill={colors.chromeLight}
                  fontSize={11}
                  fontWeight={600}
                  initial={animate ? { opacity: 0 } : { opacity: 1 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.06 + 0.3 }}
                >
                  {d.value.toLocaleString()}
                </motion.text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ── Vertical variant ──────────────────────────────────────────────

function VerticalBarChart({
  data,
  max,
  showValues,
  animate,
  className,
}: {
  data: BarDatum[];
  max: number;
  showValues: boolean;
  animate: boolean;
  className?: string;
}) {
  const barWidth = 36;
  const gap = 12;
  const chartHeight = 200;
  const labelHeight = 30;
  const valueHeight = 20;
  const totalWidth = data.length * (barWidth + gap) - gap;

  return (
    <div className={clsx('w-full overflow-x-auto', className)}>
      <svg
        viewBox={`0 0 ${totalWidth} ${chartHeight + labelHeight + valueHeight}`}
        preserveAspectRatio="xMidYMid meet"
        className="w-full h-auto"
        role="img"
        aria-label="Bar chart"
      >
        <defs>
          <linearGradient id="bar-grad-v-default" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor={colors.accentOrange} />
            <stop offset="100%" stopColor={colors.accentGold} />
          </linearGradient>
        </defs>

        {data.map((d, i) => {
          const x = i * (barWidth + gap);
          const barH = (d.value / max) * chartHeight;
          const barY = valueHeight + chartHeight - barH;
          const fillColor = d.color ?? 'url(#bar-grad-v-default)';

          return (
            <g key={d.label} aria-label={`${d.label}: ${d.value}`}>
              {/* Background track */}
              <rect
                x={x}
                y={valueHeight}
                width={barWidth}
                height={chartHeight}
                rx={6}
                fill={colors.glassBg}
              />

              {/* Bar */}
              <motion.rect
                x={x}
                y={barY}
                width={barWidth}
                rx={6}
                fill={fillColor}
                fillOpacity={0.85}
                initial={animate ? { height: 0, y: valueHeight + chartHeight } : { height: barH, y: barY }}
                animate={{ height: barH, y: barY }}
                transition={{
                  ...animation.spring.gentle,
                  delay: i * 0.06,
                }}
              />

              {/* Glass highlight */}
              <motion.rect
                x={x}
                y={barY}
                width={barWidth / 2}
                rx={6}
                fill="rgba(255,255,255,0.08)"
                initial={animate ? { height: 0, y: valueHeight + chartHeight } : { height: barH, y: barY }}
                animate={{ height: barH, y: barY }}
                transition={{
                  ...animation.spring.gentle,
                  delay: i * 0.06,
                }}
              />

              {/* Value */}
              {showValues && (
                <motion.text
                  x={x + barWidth / 2}
                  y={barY - 6}
                  textAnchor="middle"
                  fill={colors.chromeLight}
                  fontSize={10}
                  fontWeight={600}
                  initial={animate ? { opacity: 0 } : { opacity: 1 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.06 + 0.3 }}
                >
                  {d.value.toLocaleString()}
                </motion.text>
              )}

              {/* Label */}
              <text
                x={x + barWidth / 2}
                y={valueHeight + chartHeight + 16}
                textAnchor="middle"
                fill={colors.chromeMedium}
                fontSize={9}
              >
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
