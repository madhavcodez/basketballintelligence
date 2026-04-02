import {
  COURT,
  SVG,
  NBA,
  ZONES,
  ZONE_LIST,
  EFFICIENCY_STOPS,
  SIGNATURES,
  type ZoneName,
} from './shot-constants';

// ── Zone Classification ─────────────────────────────────────────────────────

export function classifyZone(x: number, y: number): ZoneName {
  const dist = Math.sqrt(x * x + y * y);

  if (dist <= COURT.RESTRICTED_RADIUS) return 'Restricted Area';

  if (
    x >= COURT.PAINT_LEFT &&
    x <= COURT.PAINT_RIGHT &&
    y >= NBA.Y_MIN &&
    y <= COURT.PAINT_TOP
  ) {
    return 'In The Paint (Non-RA)';
  }

  if (y > NBA.Y_MAX) return 'Backcourt';

  if (dist >= COURT.THREE_PT_RADIUS) {
    if (y <= COURT.CORNER_THREE_Y && x < -COURT.CORNER_THREE_X) return 'Left Corner 3';
    if (y <= COURT.CORNER_THREE_Y && x > COURT.CORNER_THREE_X) return 'Right Corner 3';
    return 'Above the Break 3';
  }

  return 'Mid-Range';
}

// ── Coordinate Mapping ──────────────────────────────────────────────────────

export function nbaToSvg(nx: number, ny: number): { x: number; y: number } {
  const x = SVG.BASKET_X + (nx / (NBA.X_MAX - NBA.X_MIN)) * SVG.WIDTH;
  const y = SVG.BASKET_Y + (ny / (NBA.Y_MAX - NBA.Y_MIN)) * SVG.HEIGHT;
  return { x, y };
}

export function svgToNba(sx: number, sy: number): { x: number; y: number } {
  const x = ((sx - SVG.BASKET_X) / SVG.WIDTH) * (NBA.X_MAX - NBA.X_MIN);
  const y = ((sy - SVG.BASKET_Y) / SVG.HEIGHT) * (NBA.Y_MAX - NBA.Y_MIN);
  return { x, y };
}

// ── Color Scales ────────────────────────────────────────────────────────────

// Linear interpolation between two hex colors
function lerpColor(a: string, b: string, t: number): string {
  const ah = parseInt(a.slice(1), 16);
  const bh = parseInt(b.slice(1), 16);
  const ar = (ah >> 16) & 0xff, ag = (ah >> 8) & 0xff, ab = ah & 0xff;
  const br = (bh >> 16) & 0xff, bg = (bh >> 8) & 0xff, bb = bh & 0xff;
  const rr = Math.round(ar + (br - ar) * t);
  const rg = Math.round(ag + (bg - ag) * t);
  const rb = Math.round(ab + (bb - ab) * t);
  return `#${((rr << 16) | (rg << 8) | rb).toString(16).padStart(6, '0')}`;
}

// Continuous color based on FG% difference from league average
export function efficiencyColor(fgPct: number, leagueAvg: number): string {
  const diff = (fgPct - leagueAvg) * 100; // convert to percentage points
  const clamped = Math.max(-15, Math.min(15, diff));

  const stops: Array<{ val: number; color: string }> = [
    { val: -15, color: EFFICIENCY_STOPS.deepCold },
    { val: -10, color: EFFICIENCY_STOPS.cold },
    { val: -5, color: EFFICIENCY_STOPS.cool },
    { val: 0, color: EFFICIENCY_STOPS.neutral },
    { val: 5, color: EFFICIENCY_STOPS.warm },
    { val: 10, color: EFFICIENCY_STOPS.hot },
    { val: 15, color: EFFICIENCY_STOPS.fire },
  ];

  for (let i = 0; i < stops.length - 1; i++) {
    if (clamped <= stops[i + 1].val) {
      const t = (clamped - stops[i].val) / (stops[i + 1].val - stops[i].val);
      return lerpColor(stops[i].color, stops[i + 1].color, t);
    }
  }

  return EFFICIENCY_STOPS.fire;
}

// Frequency color (blue scale based on shot density)
export function frequencyColor(attPct: number): string {
  const t = Math.min(1, attPct / 0.35); // 35% of attempts = max intensity
  return lerpColor('#1a1a2e', '#4DA6FF', t);
}

// ── Zone Aggregation ────────────────────────────────────────────────────────

export interface ZoneAggregation {
  readonly zone: ZoneName;
  readonly attempts: number;
  readonly makes: number;
  readonly fgPct: number;
  readonly attPct: number;
  readonly avgDistance: number;
  readonly pointValue: number;
  readonly ePtsPerAttempt: number;
}

export interface ShotInput {
  readonly x: number;
  readonly y: number;
  readonly made: number;
  readonly distance?: number;
}

export function aggregateByZone(shots: readonly ShotInput[]): ZoneAggregation[] {
  const accum = new Map<ZoneName, { attempts: number; makes: number; totalDist: number }>();

  for (const zone of ZONE_LIST) {
    accum.set(zone, { attempts: 0, makes: 0, totalDist: 0 });
  }

  for (const s of shots) {
    const zone = classifyZone(s.x, s.y);
    const entry = accum.get(zone)!;
    entry.attempts += 1;
    entry.makes += s.made;
    entry.totalDist += s.distance ?? 0;
  }

  const totalAttempts = shots.length || 1;

  return ZONE_LIST
    .map((zone): ZoneAggregation => {
      const entry = accum.get(zone)!;
      const fgPct = entry.attempts > 0 ? entry.makes / entry.attempts : 0;
      const pointValue = ZONES[zone].pointValue;
      return {
        zone,
        attempts: entry.attempts,
        makes: entry.makes,
        fgPct,
        attPct: entry.attempts / totalAttempts,
        avgDistance: entry.attempts > 0 ? entry.totalDist / entry.attempts : 0,
        pointValue,
        ePtsPerAttempt: fgPct * pointValue,
      };
    })
    .filter((z) => z.attempts > 0);
}

// ── Shot Signature Classification ───────────────────────────────────────────

export function classifyShotSignature(zones: readonly ZoneAggregation[], totalAttempts: number): string {
  const byZone = new Map(zones.map((z) => [z.zone, z]));

  const restricted = byZone.get('Restricted Area');
  const paint = byZone.get('In The Paint (Non-RA)');
  const midRange = byZone.get('Mid-Range');
  const lc3 = byZone.get('Left Corner 3');
  const rc3 = byZone.get('Right Corner 3');
  const ab3 = byZone.get('Above the Break 3');

  const paintPct = ((restricted?.attPct ?? 0) + (paint?.attPct ?? 0));
  const paintFg = paintPct > 0
    ? ((restricted?.makes ?? 0) + (paint?.makes ?? 0)) / ((restricted?.attempts ?? 0) + (paint?.attempts ?? 0))
    : 0;

  const threePct = ((lc3?.attPct ?? 0) + (rc3?.attPct ?? 0) + (ab3?.attPct ?? 0));
  const threeAttempts = (lc3?.attempts ?? 0) + (rc3?.attempts ?? 0) + (ab3?.attempts ?? 0);
  const threeMakes = (lc3?.makes ?? 0) + (rc3?.makes ?? 0) + (ab3?.makes ?? 0);
  const threeFg = threeAttempts > 0 ? threeMakes / threeAttempts : 0;

  const cornerPct = ((lc3?.attPct ?? 0) + (rc3?.attPct ?? 0));
  const cornerAttempts = (lc3?.attempts ?? 0) + (rc3?.attempts ?? 0);
  const cornerMakes = (lc3?.makes ?? 0) + (rc3?.makes ?? 0);
  const cornerFg = cornerAttempts > 0 ? cornerMakes / cornerAttempts : 0;

  const midPct = midRange?.attPct ?? 0;
  const midFg = midRange?.fgPct ?? 0;

  const restrictedPct = restricted?.attPct ?? 0;

  // Priority order
  if (paintPct >= SIGNATURES.PAINT_DOMINATOR.minPaintPct && paintFg >= SIGNATURES.PAINT_DOMINATOR.minPaintFg) {
    return SIGNATURES.PAINT_DOMINATOR.label;
  }
  if (threePct >= SIGNATURES.PERIMETER_SNIPER.minThreePct && threeFg >= SIGNATURES.PERIMETER_SNIPER.minThreeFg) {
    return SIGNATURES.PERIMETER_SNIPER.label;
  }
  if (midPct >= SIGNATURES.MID_RANGE_MAESTRO.minMidPct && midFg >= SIGNATURES.MID_RANGE_MAESTRO.minMidFg) {
    return SIGNATURES.MID_RANGE_MAESTRO.label;
  }
  if (cornerPct >= SIGNATURES.CORNER_SPECIALIST.minCornerPct && cornerFg >= SIGNATURES.CORNER_SPECIALIST.minCornerFg) {
    return SIGNATURES.CORNER_SPECIALIST.label;
  }
  if (
    restrictedPct >= SIGNATURES.THREE_LEVEL.minEachPct &&
    midPct >= SIGNATURES.THREE_LEVEL.minEachPct &&
    threePct >= SIGNATURES.THREE_LEVEL.minEachPct
  ) {
    return SIGNATURES.THREE_LEVEL.label;
  }
  if (totalAttempts >= SIGNATURES.VOLUME_SCORER.minAttempts) {
    return SIGNATURES.VOLUME_SCORER.label;
  }

  const maxZonePct = Math.max(...zones.map((z) => z.attPct));
  if (maxZonePct <= SIGNATURES.BALANCED.maxZonePct) {
    return SIGNATURES.BALANCED.label;
  }

  return 'Versatile Scorer';
}

// ── Zone SVG Polygon Paths ──────────────────────────────────────────────────
// These produce SVG paths in the 500x470 viewBox coordinate system.

const BX = SVG.BASKET_X;  // 250
const BY = SVG.BASKET_Y;  // 52.5
const VB_W = SVG.WIDTH;
const VB_H = SVG.HEIGHT;
const THREE_R = COURT.THREE_PT_RADIUS; // 237.5
const RESTRICTED_R = COURT.RESTRICTED_RADIUS; // 40
const CORNER_3_X_SVG = 30;  // 3ft from sideline
const THREE_SIDE_Y = 142;   // arc-sideline intersection (~14.2 ft from baseline)
const KEY_W = 160;
const KEY_H = 190;
const KEY_LEFT = BX - KEY_W / 2;

function arcPoints(cx: number, cy: number, r: number, startAngle: number, endAngle: number, steps: number): string[] {
  const pts: string[] = [];
  for (let i = 0; i <= steps; i++) {
    const angle = startAngle + (endAngle - startAngle) * (i / steps);
    const px = cx + r * Math.cos(angle);
    const py = cy + r * Math.sin(angle);
    pts.push(`${px.toFixed(2)} ${py.toFixed(2)}`);
  }
  return pts;
}

export function getZonePolygonPath(zone: ZoneName): string {
  switch (zone) {
    case 'Restricted Area': {
      const pts = arcPoints(BX, BY, RESTRICTED_R, Math.PI, 0, 60);
      return `M ${pts[0]} L ${pts.slice(1).join(' L ')} Z`;
    }

    case 'In The Paint (Non-RA)': {
      // Paint rectangle, with restricted area cut out
      const paint = `M ${KEY_LEFT} 0 L ${KEY_LEFT} ${KEY_H} L ${KEY_LEFT + KEY_W} ${KEY_H} L ${KEY_LEFT + KEY_W} 0 Z`;
      return paint;
    }

    case 'Mid-Range': {
      // Everything between paint and 3pt line, complex compound path
      // Outer boundary: 3pt arc (inverted to fill inside)
      const threeArcStartAngle = Math.PI - Math.acos((CORNER_3_X_SVG - BX) / THREE_R);
      const threeArcEndAngle = Math.acos((CORNER_3_X_SVG - BX) / THREE_R);
      const threeArcPts = arcPoints(BX, BY, THREE_R, threeArcStartAngle, threeArcEndAngle, 80)
        .filter((pt) => {
          const y = parseFloat(pt.split(' ')[1]);
          return y <= VB_H;
        });

      // Build mid-range as the area between paint and 3pt arc
      let d = `M ${CORNER_3_X_SVG} 0`;
      d += ` L ${CORNER_3_X_SVG} ${THREE_SIDE_Y}`;
      for (const pt of threeArcPts) {
        d += ` L ${pt}`;
      }
      d += ` L ${VB_W - CORNER_3_X_SVG} ${THREE_SIDE_Y}`;
      d += ` L ${VB_W - CORNER_3_X_SVG} 0`;
      d += ' Z';
      return d;
    }

    case 'Left Corner 3':
      return `M 0 0 L 0 ${THREE_SIDE_Y} L ${CORNER_3_X_SVG} ${THREE_SIDE_Y} L ${CORNER_3_X_SVG} 0 Z`;

    case 'Right Corner 3':
      return `M ${VB_W - CORNER_3_X_SVG} 0 L ${VB_W - CORNER_3_X_SVG} ${THREE_SIDE_Y} L ${VB_W} ${THREE_SIDE_Y} L ${VB_W} 0 Z`;

    case 'Above the Break 3': {
      // Beyond the 3pt arc, not corners
      const startAngle = Math.PI - Math.acos((CORNER_3_X_SVG - BX) / THREE_R);
      const endAngle = Math.acos((CORNER_3_X_SVG - BX) / THREE_R);
      const pts = arcPoints(BX, BY, THREE_R, startAngle, endAngle, 80)
        .filter((pt) => {
          const y = parseFloat(pt.split(' ')[1]);
          return y <= VB_H;
        });

      // Outer boundary is the full court minus corners
      let d = `M ${CORNER_3_X_SVG} ${THREE_SIDE_Y}`;
      d += ` L 0 ${THREE_SIDE_Y}`;
      d += ` L 0 ${VB_H}`;
      d += ` L ${VB_W} ${VB_H}`;
      d += ` L ${VB_W} ${THREE_SIDE_Y}`;
      d += ` L ${VB_W - CORNER_3_X_SVG} ${THREE_SIDE_Y}`;
      // Trace arc backwards (inner boundary)
      for (let i = pts.length - 1; i >= 0; i--) {
        d += ` L ${pts[i]}`;
      }
      d += ' Z';
      return d;
    }

    case 'Backcourt':
      return `M 0 ${VB_H - 10} L 0 ${VB_H} L ${VB_W} ${VB_H} L ${VB_W} ${VB_H - 10} Z`;

    default:
      return '';
  }
}

// ── Zone Label Positions (SVG coords) ───────────────────────────────────────

export function getZoneLabelPosition(zone: ZoneName): { x: number; y: number } {
  switch (zone) {
    case 'Restricted Area':     return { x: 250, y: 78 };
    case 'In The Paint (Non-RA)': return { x: 250, y: 140 };
    case 'Mid-Range':           return { x: 145, y: 180 };
    case 'Left Corner 3':       return { x: 15, y: 70 };
    case 'Right Corner 3':      return { x: 485, y: 70 };
    case 'Above the Break 3':   return { x: 250, y: 340 };
    case 'Backcourt':           return { x: 250, y: 462 };
    default:                    return { x: 250, y: 235 };
  }
}

// ── Narrative Generation ────────────────────────────────────────────────────

export function generateSignatureNarrative(
  playerName: string,
  signature: string,
  zones: readonly ZoneAggregation[],
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _totalAttempts: number,
): string {
  const topZone = [...zones].sort((a, b) => b.fgPct - a.fgPct)[0];
  const highVolume = [...zones].sort((a, b) => b.attempts - a.attempts)[0];

  const firstName = playerName.split(' ').pop() ?? playerName;

  switch (signature) {
    case 'Paint Dominator': {
      const paintZones = zones.filter((z) => z.zone === 'Restricted Area' || z.zone === 'In The Paint (Non-RA)');
      const paintPct = paintZones.reduce((s, z) => s + z.attPct, 0);
      return `${firstName} takes ${(paintPct * 100).toFixed(0)}% of shots in the paint and finishes at an elite rate. A true interior force who dominates the restricted area.`;
    }
    case 'Perimeter Sniper': {
      const threeZones = zones.filter((z) => z.zone.includes('3') || z.zone.includes('Corner'));
      const threePct = threeZones.reduce((s, z) => s + z.attPct, 0);
      const threeFg = threeZones.reduce((s, z) => s + z.makes, 0) / Math.max(1, threeZones.reduce((s, z) => s + z.attempts, 0));
      return `${firstName} takes ${(threePct * 100).toFixed(0)}% of shots from beyond the arc and converts at ${(threeFg * 100).toFixed(1)}% — a lethal perimeter threat.`;
    }
    case 'Mid-Range Maestro': {
      const mid = zones.find((z) => z.zone === 'Mid-Range');
      return `${firstName} has mastered the mid-range game with ${(mid?.fgPct ?? 0) * 100 | 0}% from the mid-range on ${mid?.attempts ?? 0} attempts. The forgotten art, perfected.`;
    }
    default:
      return `${firstName} fires from ${highVolume?.zone ?? 'multiple zones'} most often (${((highVolume?.attPct ?? 0) * 100).toFixed(0)}% of attempts) and is hottest from ${topZone?.zone ?? 'unknown'} at ${((topZone?.fgPct ?? 0) * 100).toFixed(1)}%.`;
  }
}
