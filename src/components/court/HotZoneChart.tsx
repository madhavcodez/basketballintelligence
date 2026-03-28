'use client';

import { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as d3Scale from 'd3-scale';
import { hexbin as d3Hexbin } from 'd3-hexbin';
import clsx from 'clsx';
import BasketballCourt from './BasketballCourt';
import ZoneOverlay from './ZoneOverlay';
import ZoneTooltip from './ZoneTooltip';
import {
  nbaToSvg,
  classifyZone,
  efficiencyColor,
  aggregateByZone,
  getZoneLabelPosition,
  type ZoneAggregation,
  type ShotInput,
} from '@/lib/zone-engine';
import { SVG, CHART_SIZES, LEAGUE_BASELINE, type ChartSize, type ZoneName } from '@/lib/shot-constants';
import { animation } from '@/lib/design-tokens';

// ── Props ─────────────────────────────────────────────────────────────────────

interface HotZoneChartProps {
  readonly shots: readonly ShotInput[];
  readonly leagueBaseline?: Record<string, number>;
  readonly mode?: 'efficiency' | 'frequency' | 'makes';
  readonly showZoneLabels?: boolean;
  readonly showHexbin?: boolean;
  readonly showZoneFills?: boolean;
  readonly highlightZone?: ZoneName | null;
  readonly onZoneClick?: (zone: ZoneName) => void;
  readonly onZoneHover?: (zone: ZoneName | null) => void;
  readonly animated?: boolean;
  readonly className?: string;
  readonly size?: ChartSize;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const VB_W = SVG.WIDTH;   // 500
const VB_H = SVG.HEIGHT;  // 470
const HEX_RADIUS_SVG = 8; // hex radius in SVG space (viewBox is always 500x470)

// ── Types ─────────────────────────────────────────────────────────────────────

interface HexBin {
  readonly cx: number;
  readonly cy: number;
  readonly path: string;
  readonly count: number;
  readonly makes: number;
  readonly fgPct: number;
  readonly fillColor: string;
  readonly opacity: number;
  readonly radius: number;
  readonly zone: ZoneName;
  readonly distFromCenter: number;
}

interface HoveredHex {
  readonly hex: HexBin;
  readonly svgX: number;
  readonly svgY: number;
}


// ── Component ─────────────────────────────────────────────────────────────────

export default function HotZoneChart({
  shots,
  leagueBaseline,
  mode = 'efficiency',
  showZoneLabels = true,
  showHexbin = true,
  showZoneFills = true,
  highlightZone = null,
  onZoneClick,
  onZoneHover,
  animated = true,
  className,
  size = 'lg',
}: HotZoneChartProps) {
  const [hoveredZone, setHoveredZone] = useState<ZoneName | null>(null);
  const [hoveredHex, setHoveredHex] = useState<HoveredHex | null>(null);
  const [isVisible, setIsVisible] = useState(!animated);
  const containerRef = useRef<HTMLDivElement>(null);

  const baseline = useMemo(
    () => ({ ...LEAGUE_BASELINE, ...leagueBaseline }),
    [leagueBaseline],
  );

  const chartSize = CHART_SIZES[size];

  // Trigger entrance animation after mount
  useEffect(() => {
    if (animated) {
      const timer = setTimeout(() => setIsVisible(true), 50);
      return () => clearTimeout(timer);
    }
  }, [animated]);

  // ── Zone aggregation ──────────────────────────────────────────────────────

  const zoneStats = useMemo(() => aggregateByZone(shots), [shots]);

  const zoneStatsMap = useMemo(() => {
    const map = new Map<ZoneName, ZoneAggregation>();
    for (const stat of zoneStats) {
      map.set(stat.zone, stat);
    }
    return map;
  }, [zoneStats]);

  // ── Hexbin computation ────────────────────────────────────────────────────

  const hexBins = useMemo((): readonly HexBin[] => {
    if (!showHexbin || shots.length === 0) return [];

    // Convert all shots from NBA coords to SVG coords, keep original for zone classification
    const svgShots = shots.map((s) => {
      const { x, y } = nbaToSvg(s.x, s.y);
      return { x, y, made: s.made, nx: s.x, ny: s.y };
    });

    // Create hexbin layout
    const hexLayout = d3Hexbin<{ x: number; y: number; made: number; nx: number; ny: number }>()
      .x((d) => d.x)
      .y((d) => d.y)
      .radius(HEX_RADIUS_SVG)
      .extent([[0, 0], [VB_W, VB_H]]);

    const bins = hexLayout(svgShots);

    if (bins.length === 0) return [];

    // Find max count for scaling
    const maxCount = Math.max(...bins.map((b) => b.length));
    const countScale = d3Scale.scaleLinear()
      .domain([1, maxCount])
      .range([0.35, 1])
      .clamp(true);

    const radiusScale = d3Scale.scaleSqrt()
      .domain([1, maxCount])
      .range([HEX_RADIUS_SVG * 0.4, HEX_RADIUS_SVG])
      .clamp(true);

    const hexPath = hexLayout.hexagon();

    // Basket position in SVG space for center-outward stagger
    const basketSvgX = VB_W / 2;
    const basketSvgY = 52.5;

    return bins.map((bin): HexBin => {
      const count = bin.length;
      const makes = bin.reduce((sum, s) => sum + s.made, 0);
      const fgPct = count > 0 ? makes / count : 0;

      // Determine dominant zone from NBA coords of shots in this bin
      const avgNx = bin.reduce((s, d) => s + d.nx, 0) / count;
      const avgNy = bin.reduce((s, d) => s + d.ny, 0) / count;
      const zone = classifyZone(avgNx, avgNy);

      // Distance from basket center for stagger animation
      const dx = bin.x - basketSvgX;
      const dy = bin.y - basketSvgY;
      const distFromCenter = Math.sqrt(dx * dx + dy * dy);

      // Color depends on mode
      let fillColor: string;
      switch (mode) {
        case 'efficiency':
          fillColor = efficiencyColor(fgPct, 0.45);
          break;
        case 'frequency': {
          // Blue intensity scale based on shot density
          const freqIntensity = count / maxCount;
          const r = Math.round(26 + (77 - 26) * freqIntensity);
          const g = Math.round(26 + (166 - 26) * freqIntensity);
          const b = Math.round(46 + (255 - 46) * freqIntensity);
          fillColor = `rgb(${r},${g},${b})`;
          break;
        }
        case 'makes':
          fillColor = makes > 0
            ? efficiencyColor(fgPct, 0.45)
            : 'rgba(0,0,0,0.05)';
          break;
        default:
          fillColor = efficiencyColor(fgPct, 0.45);
      }

      return {
        cx: bin.x,
        cy: bin.y,
        path: hexPath,
        count,
        makes,
        fgPct,
        fillColor,
        opacity: countScale(count),
        radius: radiusScale(count),
        zone,
        distFromCenter,
      };
    });
  }, [shots, showHexbin, mode]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleZoneHover = useCallback(
    (zone: ZoneName | null) => {
      setHoveredZone(zone);
      onZoneHover?.(zone);
    },
    [onZoneHover],
  );

  const handleZoneClick = useCallback(
    (zone: ZoneName) => {
      onZoneClick?.(zone);
    },
    [onZoneClick],
  );

  const handleHexPointerEnter = useCallback(
    (hex: HexBin) => {
      setHoveredHex({
        hex,
        svgX: hex.cx,
        svgY: hex.cy,
      });
    },
    [],
  );

  const handleHexPointerLeave = useCallback(() => {
    setHoveredHex(null);
  }, []);

  // ── Active zone for highlighting (prop or hovered) ────────────────────────

  const activeZone = highlightZone ?? hoveredZone;

  // ── Tooltip position (SVG -> percentage) ──────────────────────────────────

  const tooltipPosition = useMemo(() => {
    if (hoveredZone !== null) {
      const stat = zoneStatsMap.get(hoveredZone);
      if (stat == null) return null;

      // Use zone label position as a reference, convert from SVG coords to %
      const pos = getZoneLabelPosition(hoveredZone);
      return {
        x: (pos.x / VB_W) * 100,
        y: (pos.y / VB_H) * 100,
      };
    }

    if (hoveredHex !== null) {
      return {
        x: (hoveredHex.svgX / VB_W) * 100,
        y: (hoveredHex.svgY / VB_H) * 100,
      };
    }

    return null;
  }, [hoveredZone, hoveredHex, zoneStatsMap]);

  // ── Tooltip data ──────────────────────────────────────────────────────────

  const tooltipData = useMemo(() => {
    if (hoveredZone !== null) {
      const stat = zoneStatsMap.get(hoveredZone);
      if (stat == null) return null;
      return {
        zone: hoveredZone,
        stats: stat,
        leagueAvg: baseline[hoveredZone] ?? 0.45,
      };
    }
    return null;
  }, [hoveredZone, zoneStatsMap, baseline]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      ref={containerRef}
      className={clsx('relative', className)}
      style={{
        width: '100%',
        maxWidth: chartSize.width,
        aspectRatio: `${SVG.WIDTH} / ${SVG.HEIGHT}`,
      }}
    >
      {/* Layer 1: Basketball court background */}
      <BasketballCourt
        className="absolute inset-0 w-full h-full"
      />

      {/* Layer 2-4: SVG overlay for zones + hexbins + hover highlight */}
      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        preserveAspectRatio="xMidYMid meet"
        className="absolute inset-0 w-full h-full"
      >
        {/* SVG filters for glow effects */}
        <defs>
          <filter id="hex-glow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          <filter id="hex-hover-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3.5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Layer 2: Zone polygon fills */}
        {showZoneFills && (
          <ZoneOverlay
            zoneStats={zoneStats}
            leagueBaseline={baseline}
            highlightZone={activeZone}
            showLabels={showZoneLabels}
            onZoneClick={handleZoneClick}
            onZoneHover={handleZoneHover}
          />
        )}

        {/* Layer 3: Hexbin density overlay */}
        {showHexbin && hexBins.length > 0 && (
          <g aria-label="Hexbin density overlay">
            {hexBins.map((hex, index) => {
              const scale = hex.radius / HEX_RADIUS_SVG;
              const targetScale = isVisible ? scale : 0;
              // Center-outward stagger: closer to basket = earlier animation
              const maxDist = 400;
              const staggerDelay = animated ? (hex.distFromCenter / maxDist) * 0.6 : 0;
              // Zone dimming: if a zone is highlighted and this hex isn't in it, dim
              const isDimmed = activeZone !== null && hex.zone !== activeZone;
              const isHexHovered = hoveredHex?.hex === hex;
              const hoverScale = isHexHovered ? 1.3 : 1;

              return (
                <g
                  key={`hex-${index}`}
                  transform={`translate(${hex.cx},${hex.cy})`}
                  style={{
                    opacity: isVisible ? (isDimmed ? hex.opacity * 0.2 : hex.opacity) : 0,
                    transition: `opacity ${animation.duration.normal}ms ${animation.easing.decelerate} ${staggerDelay}s`,
                  }}
                  onPointerEnter={() => handleHexPointerEnter(hex)}
                  onPointerLeave={handleHexPointerLeave}
                >
                  <path
                    d={hex.path}
                    fill={hex.fillColor}
                    stroke={isHexHovered ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.15)'}
                    strokeWidth={isHexHovered ? 1 : 0.5}
                    cursor="crosshair"
                    filter={hex.fgPct > 0.5 || isHexHovered ? 'url(#hex-glow)' : undefined}
                    transform={`scale(${targetScale * hoverScale})`}
                    style={{
                      transformOrigin: '0 0',
                      transition: `transform ${isHexHovered ? 150 : animation.duration.slow}ms ${animation.easing.spring} ${isHexHovered ? 0 : staggerDelay}s, filter 200ms ease, stroke 150ms ease`,
                    }}
                  />
                </g>
              );
            })}
          </g>
        )}
      </svg>

      {/* Layer 5: HTML tooltips (outside SVG) */}
      <AnimatePresence>
        {tooltipData !== null && tooltipPosition !== null && (
          <motion.div
            key={tooltipData.zone}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{
              type: 'spring',
              stiffness: 300,
              damping: 25,
              duration: 0.15,
            }}
          >
            <ZoneTooltip
              zone={tooltipData.zone}
              stats={tooltipData.stats}
              leagueAvg={tooltipData.leagueAvg}
              position={tooltipPosition}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hexbin mini tooltip */}
      <AnimatePresence>
        {hoveredHex !== null && tooltipData === null && (
          <motion.div
            key={`hex-${hoveredHex.svgX}-${hoveredHex.svgY}`}
            className="absolute pointer-events-none"
            style={{
              left: `${(hoveredHex.svgX / VB_W) * 100}%`,
              top: `${(hoveredHex.svgY / VB_H) * 100}%`,
              transform: 'translate(-50%, -100%) translateY(-12px)',
              zIndex: 50,
            }}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.12 }}
          >
            <div
              style={{
                background: '#FFFFFF',
                border: '1px solid rgba(0,0,0,0.12)',
                boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                borderRadius: 8,
                padding: '6px 10px',
                fontSize: 11,
                whiteSpace: 'nowrap',
              }}
            >
              <span className="font-mono" style={{ color: '#1D1D1F', fontWeight: 600 }}>
                {(hoveredHex.hex.fgPct * 100).toFixed(1)}%
              </span>
              <span className="font-mono" style={{ color: '#86868B', marginLeft: 6 }}>
                {hoveredHex.hex.makes}/{hoveredHex.hex.count}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
