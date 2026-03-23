'use client';

import { useMemo, useState, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import * as d3Shape from 'd3-shape';
import * as d3Scale from 'd3-scale';
import clsx from 'clsx';
import { colors, animation } from '@/lib/design-tokens';

// ── Types ─────────────────────────────────────────────────────────

export interface TrendDatum {
  /** Season or x-axis label (e.g. "2023-24") */
  season: string;
  /** Numeric value */
  value: number;
}

export interface TrendLineProps {
  /** Data points */
  data: TrendDatum[];
  /** Chart height in px (default 120) */
  height?: number;
  /** Chart width in px – if omitted, uses 100% of parent */
  width?: number;
  /** Line / dot colour */
  color?: string;
  /** Show dots at data points */
  showDots?: boolean;
  /** Show filled area under the line */
  showArea?: boolean;
  /** Additional CSS class names */
  className?: string;
}

// ── Constants ─────────────────────────────────────────────────────

const PADDING_X = 24;
const PADDING_Y = 16;
const DOT_RADIUS = 3.5;

// ── Component ─────────────────────────────────────────────────────

export default function TrendLine({
  data,
  height = 120,
  width: widthProp,
  color = colors.accentOrange,
  showDots = true,
  showArea = false,
  className,
}: TrendLineProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  // Effective width: use prop or a sensible default for the viewBox
  const vbWidth = widthProp ?? 400;
  const innerW = vbWidth - PADDING_X * 2;
  const innerH = height - PADDING_Y * 2;

  // Scales
  const xScale = useMemo(
    () =>
      d3Scale
        .scalePoint<string>()
        .domain(data.map((d) => d.season))
        .range([PADDING_X, PADDING_X + innerW]),
    [data, innerW],
  );

  const yExtent = useMemo(() => {
    const vals = data.map((d) => d.value);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const padding = (max - min) * 0.15 || 1;
    return [min - padding, max + padding] as [number, number];
  }, [data]);

  const yScale = useMemo(
    () =>
      d3Scale
        .scaleLinear()
        .domain(yExtent)
        .range([PADDING_Y + innerH, PADDING_Y]),
    [yExtent, innerH],
  );

  // Line generator
  const linePath = useMemo(() => {
    const gen = d3Shape
      .line<TrendDatum>()
      .x((d) => xScale(d.season) ?? 0)
      .y((d) => yScale(d.value))
      .curve(d3Shape.curveMonotoneX);
    return gen(data) ?? '';
  }, [data, xScale, yScale]);

  // Area generator
  const areaPath = useMemo(() => {
    if (!showArea) return '';
    const gen = d3Shape
      .area<TrendDatum>()
      .x((d) => xScale(d.season) ?? 0)
      .y0(PADDING_Y + innerH)
      .y1((d) => yScale(d.value))
      .curve(d3Shape.curveMonotoneX);
    return gen(data) ?? '';
  }, [data, xScale, yScale, showArea, innerH]);

  // Mapped points for dots / tooltip
  const points = useMemo(
    () =>
      data.map((d) => ({
        ...d,
        px: xScale(d.season) ?? 0,
        py: yScale(d.value),
      })),
    [data, xScale, yScale],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (!svgRef.current || data.length === 0) return;
      const rect = svgRef.current.getBoundingClientRect();
      const svgX = ((e.clientX - rect.left) / rect.width) * vbWidth;
      // Find nearest point
      let closest = 0;
      let minDist = Infinity;
      for (let i = 0; i < points.length; i++) {
        const dist = Math.abs(points[i].px - svgX);
        if (dist < minDist) {
          minDist = dist;
          closest = i;
        }
      }
      setHoveredIdx(closest);
    },
    [data, points, vbWidth],
  );

  const handlePointerLeave = useCallback(() => {
    setHoveredIdx(null);
  }, []);

  if (data.length === 0) {
    return (
      <div
        className={clsx('flex items-center justify-center py-4 text-sm', className)}
        style={{ color: colors.chromeDim, height }}
      >
        No trend data
      </div>
    );
  }

  const gradientId = `trend-area-${color.replace('#', '')}`;
  const hovered = hoveredIdx !== null ? points[hoveredIdx] : null;

  return (
    <div className={clsx('relative', className)} style={{ width: widthProp ?? '100%' }}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${vbWidth} ${height}`}
        preserveAspectRatio="xMidYMid meet"
        className="w-full h-auto"
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        role="img"
        aria-label="Trend line chart"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.35} />
            <stop offset="100%" stopColor={color} stopOpacity={0.02} />
          </linearGradient>
        </defs>

        {/* Area fill */}
        {showArea && areaPath && (
          <motion.path
            d={areaPath}
            fill={`url(#${gradientId})`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: animation.duration.slow / 1000 }}
          />
        )}

        {/* Line */}
        <motion.path
          d={linePath}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />

        {/* Dots */}
        {showDots &&
          points.map((p, i) => (
            <motion.circle
              key={i}
              cx={p.px}
              cy={p.py}
              r={hoveredIdx === i ? DOT_RADIUS * 1.6 : DOT_RADIUS}
              fill={color}
              stroke={colors.darkBase}
              strokeWidth={1.5}
              initial={{ r: 0 }}
              animate={{ r: hoveredIdx === i ? DOT_RADIUS * 1.6 : DOT_RADIUS }}
              transition={{ ...animation.spring.gentle, delay: i * 0.04 }}
            />
          ))}

        {/* Hover crosshair */}
        {hovered && (
          <line
            x1={hovered.px}
            y1={PADDING_Y}
            x2={hovered.px}
            y2={PADDING_Y + innerH}
            stroke={colors.chromeFaint}
            strokeWidth={1}
            strokeDasharray="3 3"
          />
        )}

        {/* Season labels along x-axis */}
        {points.map((p, i) => (
          <text
            key={`lbl-${i}`}
            x={p.px}
            y={height - 2}
            textAnchor="middle"
            fill={colors.chromeDim}
            fontSize={8}
          >
            {p.season}
          </text>
        ))}
      </svg>

      {/* Tooltip */}
      {hovered && (
        <div
          className="pointer-events-none absolute z-20 rounded-md px-2 py-1 text-xs font-semibold"
          style={{
            left: `${(hovered.px / vbWidth) * 100}%`,
            top: `${(hovered.py / height) * 100}%`,
            transform: 'translate(-50%, -130%)',
            background: colors.darkElevated,
            border: `1px solid ${colors.glassBorder}`,
            color: colors.chromeLight,
          }}
        >
          {hovered.value.toLocaleString()}
        </div>
      )}
    </div>
  );
}
