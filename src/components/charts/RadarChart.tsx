'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import { colors, animation } from '@/lib/design-tokens';

// ── Types ─────────────────────────────────────────────────────────

export interface RadarAxis {
  /** Axis label */
  axis: string;
  /** Current value */
  value: number;
  /** Maximum possible value for this axis */
  max: number;
}

export interface RadarChartProps {
  /** Primary dataset */
  data: RadarAxis[];
  /** Optional comparison dataset (same axes) */
  compareTo?: RadarAxis[];
  /** Diameter of the chart (default 300) */
  size?: number;
  /** Additional CSS class names */
  className?: string;
}

// ── Constants ─────────────────────────────────────────────────────

const RINGS = 5;
const LABEL_OFFSET = 20;

// ── Component ─────────────────────────────────────────────────────

export default function RadarChart({
  data,
  compareTo,
  size = 300,
  className,
}: RadarChartProps) {
  const n = data.length;
  const cx = size / 2;
  const cy = size / 2;
  const radius = size / 2 - LABEL_OFFSET - 10;

  // Angle for each axis (starting from top, going clockwise)
  const angles = useMemo(
    () =>
      data.map((_, i) => {
        const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
        return angle;
      }),
    [n, data],
  );

  const primaryPolygon = useMemo(
    () =>
      data
        .map((d, i) => {
          const ratio = d.value / d.max;
          const x = cx + radius * ratio * Math.cos(angles[i]);
          const y = cy + radius * ratio * Math.sin(angles[i]);
          return `${x},${y}`;
        })
        .join(' '),
    [data, angles, cx, cy, radius],
  );

  const comparePolygon = useMemo(
    () =>
      compareTo
        ? compareTo
            .map((d, i) => {
              const ratio = d.value / d.max;
              const x = cx + radius * ratio * Math.cos(angles[i]);
              const y = cy + radius * ratio * Math.sin(angles[i]);
              return `${x},${y}`;
            })
            .join(' ')
        : '',
    [compareTo, angles, cx, cy, radius],
  );

  // Ring polygons
  const rings = useMemo(() => {
    const result: string[] = [];
    for (let ring = 1; ring <= RINGS; ring++) {
      const r = (radius * ring) / RINGS;
      const pts = angles
        .map((a) => `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`)
        .join(' ');
      result.push(pts);
    }
    return result;
  }, [angles, cx, cy, radius]);

  if (data.length < 3) {
    return (
      <div
        className={clsx('flex items-center justify-center py-8 text-sm', className)}
        style={{ color: colors.chromeDim }}
      >
        Radar chart requires at least 3 axes
      </div>
    );
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      preserveAspectRatio="xMidYMid meet"
      className={clsx('select-none', className)}
      role="img"
      aria-label="Radar chart"
    >
      <defs>
        <linearGradient id="radar-primary-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={colors.accentOrange} stopOpacity={0.4} />
          <stop offset="100%" stopColor={colors.accentGold} stopOpacity={0.15} />
        </linearGradient>
        <linearGradient id="radar-compare-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={colors.accentBlue} stopOpacity={0.35} />
          <stop offset="100%" stopColor={colors.accentViolet} stopOpacity={0.1} />
        </linearGradient>
      </defs>

      {/* Concentric ring backgrounds */}
      {rings.map((pts, i) => (
        <polygon
          key={`ring-${i}`}
          points={pts}
          fill="none"
          stroke={colors.chromeFaint}
          strokeWidth={0.5}
        />
      ))}

      {/* Axis lines from centre to perimeter */}
      {angles.map((a, i) => (
        <line
          key={`axis-${i}`}
          x1={cx}
          y1={cy}
          x2={cx + radius * Math.cos(a)}
          y2={cy + radius * Math.sin(a)}
          stroke={colors.chromeFaint}
          strokeWidth={0.5}
        />
      ))}

      {/* Comparison overlay (rendered first so primary is on top) */}
      {compareTo && comparePolygon && (
        <motion.polygon
          points={comparePolygon}
          fill="url(#radar-compare-grad)"
          stroke={colors.accentBlue}
          strokeWidth={1.5}
          initial={{ opacity: 0, scale: 0.3 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ ...animation.spring.gentle, delay: 0.15 }}
          style={{ transformOrigin: `${cx}px ${cy}px` }}
        />
      )}

      {/* Primary data polygon */}
      <motion.polygon
        points={primaryPolygon}
        fill="url(#radar-primary-grad)"
        stroke={colors.accentOrange}
        strokeWidth={1.5}
        initial={{ opacity: 0, scale: 0.3 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={animation.spring.gentle}
        style={{ transformOrigin: `${cx}px ${cy}px` }}
      />

      {/* Data points */}
      {data.map((d, i) => {
        const ratio = d.value / d.max;
        const px = cx + radius * ratio * Math.cos(angles[i]);
        const py = cy + radius * ratio * Math.sin(angles[i]);
        return (
          <motion.circle
            key={`dot-${i}`}
            cx={px}
            cy={py}
            r={3}
            fill={colors.accentOrange}
            stroke={colors.darkBase}
            strokeWidth={1}
            initial={{ r: 0 }}
            animate={{ r: 3 }}
            transition={{ ...animation.spring.gentle, delay: i * 0.04 }}
          />
        );
      })}

      {/* Comparison data points */}
      {compareTo &&
        compareTo.map((d, i) => {
          const ratio = d.value / d.max;
          const px = cx + radius * ratio * Math.cos(angles[i]);
          const py = cy + radius * ratio * Math.sin(angles[i]);
          return (
            <motion.circle
              key={`cdot-${i}`}
              cx={px}
              cy={py}
              r={3}
              fill={colors.accentBlue}
              stroke={colors.darkBase}
              strokeWidth={1}
              initial={{ r: 0 }}
              animate={{ r: 3 }}
              transition={{ ...animation.spring.gentle, delay: 0.15 + i * 0.04 }}
            />
          );
        })}

      {/* Axis labels */}
      {data.map((d, i) => {
        const labelR = radius + LABEL_OFFSET;
        const lx = cx + labelR * Math.cos(angles[i]);
        const ly = cy + labelR * Math.sin(angles[i]);
        // Determine text anchor based on position
        let anchor: 'start' | 'middle' | 'end' = 'middle';
        if (Math.cos(angles[i]) > 0.1) anchor = 'start';
        else if (Math.cos(angles[i]) < -0.1) anchor = 'end';

        return (
          <text
            key={`label-${i}`}
            x={lx}
            y={ly}
            textAnchor={anchor}
            dominantBaseline="central"
            fill={colors.chromeMedium}
            fontSize={10}
            fontWeight={500}
          >
            {d.axis}
          </text>
        );
      })}
    </svg>
  );
}
