# INSTANCE 2: Hot Zones Heatmap V2 + Shot Profile Cards

## Mission

Build the most visually stunning basketball shot visualization on the internet. Full hexbin density heatmaps with zone-level FG% color coding, interactive zone exploration, player shot profile cards, and a new dedicated Zones page. This is the visual centerpiece of the platform — it should make people screenshot and share it.

## Time Budget: 6 hours autonomous

## File Ownership (NO other instance touches these)

### NEW files this instance creates:
```
src/components/court/HotZoneChart.tsx       — Primary hexbin heatmap component
src/components/court/ZoneOverlay.tsx         — Zone polygon overlay with FG% labels
src/components/court/ZoneTooltip.tsx         — Rich tooltip on zone hover
src/components/court/MiniCourt.tsx           — Thumbnail court for cards (120x113)
src/components/court/CourtLegend.tsx         — Color scale legend component
src/components/cards/ShotProfileCard.tsx     — Compact player shot profile card
src/components/cards/ZoneComparisonCard.tsx  — Side-by-side zone comparison
src/components/cards/ShotSignatureCard.tsx   — Player's "signature zones" card
src/app/zones/page.tsx                      — NEW: Dedicated Hot Zones explorer page
src/app/zones/[player]/page.tsx             — NEW: Player-specific zone deep dive
src/app/api/zones/player/[name]/route.ts    — Zone aggregation API
src/app/api/zones/league/route.ts           — League baseline API
src/app/api/zones/compare/route.ts          — Two-player zone comparison API
src/app/api/zones/leaders/route.ts          — Zone-specific leaderboards
src/app/api/zones/heatmap/[name]/route.ts   — Raw shot coords for heatmap
src/lib/zone-engine.ts                      — Zone geometry, math, color mapping
src/lib/shot-constants.ts                   — Court dimensions, zone definitions
```

### Files this instance MUST NOT touch:
```
src/app/shot-lab/*                  — Leave existing Shot Lab untouched
src/app/matchup/*                   — Instance 3 owns
src/app/film/*                      — Instance 4 owns
src/lib/db.ts                       — Instance 1 may modify; use getDb() import only
src/components/layout/AppShell.tsx   — Instance 1 may modify
video-ml/*                          — Instance 4 owns
```

---

## Architecture

### Visual Design Philosophy

Think: **NBA 2K meets Apple — premium, cinematic, data-dense but clean**

- Court as canvas: the basketball court IS the visualization, not a decoration
- Color = information: every color encodes FG% relative to league average
- Depth through layering: court → zone fills → hexbin density → labels → tooltips
- Micro-animations: zones breathe, hexbins pulse on hover, transitions flow
- Dark cinema aesthetic: deep blacks, neon data glows, glass overlays

### Color Scale for Shooting Efficiency

```
FG% relative to league average for that zone:
  -15% or worse  → #1e3a5f (deep cold blue)
  -10%           → #2563eb (cold blue)
  -5%            → #60a5fa (cool blue)
  League avg     → #fbbf24 (neutral gold)
  +5%            → #f97316 (warm orange)
  +10%           → #ef4444 (hot red)
  +15% or better → #dc2626 (fire red) with glow
```

The gradient should be continuous, not stepped. Use d3-scale chromatic interpolation.

### Zone Geometry (NBA Court Coordinates)

```
Zone definitions (NBA coords: x=-250 to 250, y=-47.5 to 422.5):

Restricted Area:    circle at (0,0) radius 40
In The Paint:       rectangle -80 to 80 x, -47.5 to 142.5 y (minus restricted)
Left Corner 3:      x < -220, y < 92.5
Right Corner 3:     x > 220, y < 92.5
Above the Break 3:  distance from basket > 237.5, not in corners
Mid-Range:          everything else between paint and 3pt line
Backcourt:          y > 422.5 (rare)
```

---

## Phase 1: Zone Engine + Constants (Target: 45 min)

### 1a. Create `src/lib/shot-constants.ts`

```typescript
// Court dimensions in NBA coordinate system
export const COURT = {
  WIDTH: 500,       // -250 to 250
  HEIGHT: 470,      // -47.5 to 422.5
  BASKET_X: 0,
  BASKET_Y: 0,
  THREE_PT_RADIUS: 237.5,
  RESTRICTED_RADIUS: 40,
  PAINT_LEFT: -80,
  PAINT_RIGHT: 80,
  PAINT_TOP: 142.5,
  CORNER_THREE_Y: 92.5,
  CORNER_THREE_X: 220,
} as const;

// SVG viewbox mapping
export const SVG = {
  WIDTH: 500,
  HEIGHT: 470,
  BASKET_X: 250,
  BASKET_Y: 52.5,
} as const;

// Zone definitions with display names and colors
export const ZONES = {
  'Restricted Area': { label: 'Restricted', shortLabel: 'RA', baseColor: '#ef4444', pointValue: 2 },
  'In The Paint (Non-RA)': { label: 'Paint', shortLabel: 'PT', baseColor: '#f97316', pointValue: 2 },
  'Mid-Range': { label: 'Mid-Range', shortLabel: 'MR', baseColor: '#fbbf24', pointValue: 2 },
  'Left Corner 3': { label: 'Left Corner 3', shortLabel: 'LC3', baseColor: '#4da6ff', pointValue: 3 },
  'Right Corner 3': { label: 'Right Corner 3', shortLabel: 'RC3', baseColor: '#60a5fa', pointValue: 3 },
  'Above the Break 3': { label: 'Above Break 3', shortLabel: 'AB3', baseColor: '#a78bfa', pointValue: 3 },
  'Backcourt': { label: 'Backcourt', shortLabel: 'BC', baseColor: '#6b7280', pointValue: 2 },
} as const;

export type ZoneName = keyof typeof ZONES;
```

### 1b. Create `src/lib/zone-engine.ts`

```typescript
import * as d3Scale from 'd3-scale';
import { COURT, SVG, ZONES, type ZoneName } from './shot-constants';

// Zone classification from NBA coordinates
export function classifyZone(x: number, y: number): ZoneName {
  const dist = Math.sqrt(x * x + y * y);
  if (dist <= COURT.RESTRICTED_RADIUS) return 'Restricted Area';
  if (x >= COURT.PAINT_LEFT && x <= COURT.PAINT_RIGHT && y <= COURT.PAINT_TOP && y >= -47.5)
    return 'In The Paint (Non-RA)';
  if (y > 422.5) return 'Backcourt';
  if (dist >= COURT.THREE_PT_RADIUS) {
    if (y <= COURT.CORNER_THREE_Y && x < -COURT.CORNER_THREE_X) return 'Left Corner 3';
    if (y <= COURT.CORNER_THREE_Y && x > COURT.CORNER_THREE_X) return 'Right Corner 3';
    return 'Above the Break 3';
  }
  return 'Mid-Range';
}

// NBA coords to SVG coords
export function nbaToSvg(nx: number, ny: number): { x: number; y: number } {
  return {
    x: SVG.BASKET_X + (nx / COURT.WIDTH) * SVG.WIDTH,
    y: SVG.BASKET_Y + (ny / COURT.HEIGHT) * SVG.HEIGHT,
  };
}

// Efficiency color scale
export function efficiencyColor(fgPct: number, leagueAvg: number): string {
  const diff = fgPct - leagueAvg;
  // Continuous scale: -15 → deep blue, 0 → gold, +15 → fire red
  const scale = d3Scale.scaleLinear<string>()
    .domain([-15, -7.5, 0, 7.5, 15])
    .range(['#1e3a5f', '#3b82f6', '#fbbf24', '#f97316', '#dc2626'])
    .clamp(true);
  return scale(diff);
}

// Zone polygon paths for SVG overlay
export function getZonePolygonPath(zone: ZoneName): string {
  // Returns SVG path data for each zone
  // These are complex paths — see implementation below
}

// Aggregate shot data into zone stats
export interface ZoneAggregation {
  zone: ZoneName;
  attempts: number;
  makes: number;
  fgPct: number;
  attPct: number; // % of total attempts
  avgDistance: number;
  pointValue: number;
  ePtsPerAttempt: number; // fgPct * pointValue
}

export function aggregateByZone(shots: Array<{ x: number; y: number; made: number; distance?: number }>): ZoneAggregation[] {
  // Group shots by zone, calculate stats
}

// Hexbin configuration
export function createHexbinLayout(radius: number = 8) {
  // Returns d3-hexbin configured for our SVG space
}
```

### Phase 1 Gate
- [ ] Zone classifier correctly classifies 100% of test coordinates
- [ ] Color scale produces correct hex values across the range
- [ ] NBA-to-SVG coordinate conversion is accurate
- [ ] All types export correctly, zero TS errors

---

## Phase 2: Core Visualization Components (Target: 90 min)

### 2a. HotZoneChart.tsx — The Star Component

This is the primary visualization. A full basketball court with hexbin density heatmap overlay.

```typescript
interface HotZoneChartProps {
  readonly shots: Array<{
    x: number;
    y: number;
    made: number;
    distance?: number;
  }>;
  readonly leagueBaseline?: Record<string, { fgPct: number }>;
  readonly mode: 'efficiency' | 'frequency' | 'makes';
  readonly showZoneLabels?: boolean;
  readonly showHexbin?: boolean;
  readonly showZoneFills?: boolean;
  readonly highlightZone?: ZoneName | null;
  readonly onZoneClick?: (zone: ZoneName) => void;
  readonly onZoneHover?: (zone: ZoneName | null) => void;
  readonly animated?: boolean;
  readonly className?: string;
  readonly size?: 'sm' | 'md' | 'lg' | 'xl';
}
```

**Rendering layers (bottom to top):**
1. Basketball court SVG (use existing BasketballCourt as base)
2. Zone polygon fills with efficiency colors (semi-transparent)
3. Hexbin density overlay (circles sized by shot count, colored by FG%)
4. Zone border lines (subtle white/10%)
5. Zone FG% labels (white text with shadow)
6. Hover highlight layer (zone brightens + tooltip trigger)

**Size variants:**
- `sm`: 240x226 — for cards and thumbnails
- `md`: 360x339 — for side-by-side comparisons
- `lg`: 500x470 — standard full view
- `xl`: 700x658 — hero/detail view

**Hexbin specifics:**
- Use d3-hexbin with radius 8 (for lg size, scale for others)
- Each hexbin colored by aggregate FG% of shots within it
- Opacity scaled by shot count (more shots = more opaque, min 0.3)
- Size scaled by shot count (more shots = larger hex)
- Hover: hex enlarges 1.3x, shows tooltip with exact stats

**Animation:**
- On mount: hexbins scale in from 0 with stagger (0.002s per hex, from center outward)
- Zone transitions: color morphs smoothly (300ms ease)
- Hover: 150ms scale + brightness transition

### 2b. ZoneOverlay.tsx

Standalone zone polygon overlay that can be layered on any court.

```typescript
interface ZoneOverlayProps {
  readonly zoneStats: ZoneAggregation[];
  readonly leagueBaseline: Record<string, number>;
  readonly highlightZone?: ZoneName | null;
  readonly showLabels?: boolean;
  readonly onZoneClick?: (zone: ZoneName) => void;
  readonly onZoneHover?: (zone: ZoneName | null) => void;
}
```

Each zone polygon:
- Fill: efficiency color at 40% opacity
- Stroke: white at 8% opacity
- Hover: fill opacity → 60%, stroke → 20%
- Active/highlighted: glow effect (drop shadow matching zone color)
- Label: "XX.X%" in center of zone, white text with subtle shadow

### 2c. ZoneTooltip.tsx

Rich tooltip that appears on zone hover.

```typescript
interface ZoneTooltipProps {
  readonly zone: ZoneName;
  readonly stats: ZoneAggregation;
  readonly leagueAvg: number;
  readonly position: { x: number; y: number };
}
```

**Tooltip content:**
```
┌───────────────────────────┐
│  Mid-Range                │
│  ─────────────────────── │
│  FG%:  42.3%  (+1.2%)    │  ← green if above avg
│  Attempts: 312 (28.4%)   │
│  Makes: 132              │
│  Avg Distance: 16.2 ft   │
│  ePts/Att: 0.846         │
└───────────────────────────┘
```

Glass card styling, appears with scale-in animation, follows cursor loosely.

### 2d. CourtLegend.tsx

Horizontal gradient legend showing the color scale.

```
Cold ──────────────── Hot
-15%  -10%  -5%  Avg  +5%  +10%  +15%
[gradient bar from blue to gold to red]
```

### 2e. MiniCourt.tsx

Tiny court (120x113) for inline use in cards and tables.

- Simplified court lines (just 3pt arc + paint outline)
- Zone fills only (no hexbin at this size)
- No interactivity — display only
- Shows top 2 zones with labels

### Phase 2 Gate
- [ ] HotZoneChart renders with sample shot data
- [ ] All 7 zones render with correct polygon paths
- [ ] Color scale matches league average comparison
- [ ] Hexbin density is visually correct (more shots near basket)
- [ ] Hover/click interactions work
- [ ] All 4 size variants render correctly
- [ ] Animations play smoothly (60fps)
- [ ] Zero TS errors, build passes

---

## Phase 3: API Routes (Target: 60 min)

### 3a. `src/app/api/zones/player/[name]/route.ts`

```
GET /api/zones/player/{name}?season=2023-24
Response: {
  player: string,
  season: string,
  totalShots: number,
  zones: ZoneAggregation[],
  topZone: { zone: string, fgPct: number },
  coldestZone: { zone: string, fgPct: number },
  shotSignature: string  // "Paint Dominator" | "Perimeter Sniper" | "Mid-Range Maestro" | etc.
}
```

**Shot Signature logic:**
Based on where >40% of attempts come from + FG% thresholds:
- "Paint Dominator": >40% attempts at rim, >55% FG%
- "Perimeter Sniper": >50% attempts from 3, >37% 3FG%
- "Mid-Range Maestro": >30% mid-range, >42% mid-range FG%
- "Corner Specialist": >20% from corners, >38% corner FG%
- "Three-Level Scorer": >15% from each of restricted/mid/3pt
- "Volume Scorer": >1500 attempts, positive ePts
- "Balanced Attack": no zone >35% of attempts

### 3b. `src/app/api/zones/league/route.ts`

```
GET /api/zones/league?season=2023-24
Response: {
  season: string,
  zones: Array<{ zone: string, fgPct: number, attPct: number, avgDistance: number }>,
  leagueAvgFgPct: number
}
```

### 3c. `src/app/api/zones/compare/route.ts`

```
GET /api/zones/compare?p1=Stephen+Curry&p2=LeBron+James&season=2023-24
Response: {
  player1: { name: string, zones: ZoneAggregation[], signature: string },
  player2: { name: string, zones: ZoneAggregation[], signature: string },
  league: { zones: ZoneAggregation[] },
  comparison: Array<{
    zone: string,
    player1FgPct: number,
    player2FgPct: number,
    leagueFgPct: number,
    winner: 'p1' | 'p2' | 'tie'
  }>
}
```

### 3d. `src/app/api/zones/leaders/route.ts`

```
GET /api/zones/leaders?zone=Above+the+Break+3&season=2023-24&limit=10
Response: {
  zone: string,
  season: string,
  leaders: Array<{
    player: string,
    fgPct: number,
    attempts: number,
    makes: number,
    rank: number
  }>
}
```

### 3e. `src/app/api/zones/heatmap/[name]/route.ts`

```
GET /api/zones/heatmap/{name}?season=2023-24&limit=5000
Response: {
  player: string,
  season: string,
  shots: Array<{ x: number, y: number, made: number, zone: string }>,
  totalShots: number
}
```

### Phase 3 Gate
- [ ] All 5 API routes return valid JSON
- [ ] Zone stats match hand-calculated values for known players
- [ ] Shot signature classification is correct
- [ ] Performance: response <200ms for any player
- [ ] Build passes

---

## Phase 4: Pages (Target: 90 min)

### 4a. Zones Explorer Page (`src/app/zones/page.tsx`)

**Full-width cinematic landing page for zone analysis.**

Layout (top to bottom):

**Hero Section:**
```
┌──────────────────────────────────────────────────────────┐
│                                                          │
│   🔥 HOT ZONES                                          │
│   See where every player scores — and where they don't  │
│                                                          │
│   [Search player...                              🔍]    │
│                                                          │
│   Season: [2024-25 ▾]                                   │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

**Featured Player Section (default: current scoring leader):**
```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│   ┌─────────────────┐    Player Name                       │
│   │                 │    "Perimeter Sniper"                 │
│   │  [HOT ZONE      │    ─────────────────                 │
│   │   HEATMAP]      │    [Zone Stat] [Zone Stat] [Zone]    │
│   │                 │    [Zone Stat] [Zone Stat] [Zone]    │
│   │                 │                                       │
│   └─────────────────┘    [View Full Profile →]             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Zone Leaderboards Section:**
```
┌──────────────────────────────────────────────────┐
│  Zone Leaders                                    │
│                                                  │
│  [Restricted]  [Paint]  [Mid]  [Corner]  [3PT]  │  ← tab pills
│                                                  │
│  1. Player A  — 72.3% (412 att)                 │
│  2. Player B  — 68.1% (389 att)                 │
│  3. Player C  — 65.7% (501 att)                 │
│  ...                                             │
│                                                  │
│  Each row has a mini court showing their zones   │
└──────────────────────────────────────────────────┘
```

**Compare Section:**
```
┌──────────────────────────────────────────────────────────┐
│  Zone Showdown                                           │
│                                                          │
│  [Player 1 Search]        vs        [Player 2 Search]   │
│                                                          │
│  ┌──────────────┐                 ┌──────────────┐      │
│  │ [Heatmap P1] │                 │ [Heatmap P2] │      │
│  └──────────────┘                 └──────────────┘      │
│                                                          │
│  Zone-by-zone comparison bars below                     │
└──────────────────────────────────────────────────────────┘
```

### 4b. Player Zone Page (`src/app/zones/[player]/page.tsx`)

Deep dive into one player's shooting zones.

**Layout:**
- Large hero heatmap (xl size, 700px wide)
- Mode toggle: Efficiency | Frequency | Makes
- Season selector (all available seasons)
- Zone breakdown table (sorted by attempts)
- Shot signature card
- Similar shooters (players with similar zone distribution)
- Zone trend: how their zone distribution changed over career

### UI Details for Both Pages:

**Search component:**
- Debounced 250ms
- Dropdown with player results (reuse existing pattern)
- Show mini court preview in search results

**Season selector:**
- Glass pill dropdown
- Shows available seasons
- Default to latest

**Loading states:**
- Court skeleton: gray zones pulsing
- Hexbins: shimmer effect
- Stats: SkeletonLoader from existing components

**Empty state:**
- When no shots found: "No shot data available for this season"
- Muted court with dashed zone lines

### Phase 4 Gate
- [ ] Zones explorer page renders with featured player
- [ ] Search finds players and loads their heatmap
- [ ] Zone leaderboards load for each zone tab
- [ ] Compare section shows two heatmaps side by side
- [ ] Player zone page shows full deep dive
- [ ] All loading/empty states work
- [ ] Mobile responsive (stack side-by-side on small screens)
- [ ] Build passes

---

## Phase 5: Shot Profile Cards + Polish (Target: 60 min)

### 5a. ShotProfileCard.tsx

Compact card showing a player's shooting fingerprint. Reusable across the platform.

```typescript
interface ShotProfileCardProps {
  readonly playerName: string;
  readonly season?: string;
  readonly size?: 'sm' | 'md';
  readonly showSignature?: boolean;
  readonly hoverable?: boolean;
  readonly onClick?: () => void;
}
```

**Card layout (md size, ~320x200):**
```
┌──────────────────────────────────┐
│  ┌─────────┐  Stephen Curry     │
│  │ [Mini   ]│  2023-24           │
│  │ [Court  ]│                    │
│  │ [Heatmap]│  "Perimeter Sniper"│
│  └─────────┘                    │
│                                  │
│  3PT: 40.8%  MR: 43.2%  RA: 67% │
│  ▓▓▓▓▓▓▓░░  ▓▓▓▓▓▓░░░  ▓▓▓▓▓▓▓│
└──────────────────────────────────┘
```

- Glass card with tint color matching their hottest zone
- Mini court (120x113) with zone fills
- Top 3 zones with FG% bars (color-coded)
- Shot signature badge

### 5b. ZoneComparisonCard.tsx

Side-by-side mini heatmaps for two players.

### 5c. ShotSignatureCard.tsx

Larger card showing the player's "signature" with narrative text.

```
┌──────────────────────────────────────┐
│  🎯 Shot Signature                   │
│                                      │
│  "PERIMETER SNIPER"                  │
│                                      │
│  Stephen Curry takes 62% of his      │
│  shots from beyond the arc and       │
│  converts at 40.8% — the highest     │
│  volume-adjusted 3PT rate in the     │
│  league this season.                 │
│                                      │
│  Hottest Zone: Right Corner 3 (48.2%)│
│  Coldest Zone: Mid-Range (38.1%)     │
│  Volume: 1,847 attempts              │
└──────────────────────────────────────┘
```

### 5d. Polish Pass

- Page transitions: fade + slide (use Framer Motion page transitions)
- Scroll-triggered animations: heatmap builds as user scrolls into view
- Responsive:
  - Desktop: side-by-side layouts, full heatmaps
  - Tablet: stacked with medium heatmaps
  - Mobile: single column, small heatmaps, swipe between zones
- Performance: lazy load shot data, use useMemo for hexbin calculations
- Accessibility: zone labels readable by screen readers, keyboard navigable

### Phase 5 Gate
- [ ] ShotProfileCard renders correctly at both sizes
- [ ] Cards show real data from API
- [ ] Signature classification produces reasonable labels
- [ ] All animations smooth (60fps, no jank)
- [ ] Mobile layout works
- [ ] Full build passes: `npm run build`
- [ ] No console errors

---

## Subagent Orchestration

### Agent 1: CODE WRITER
Role: Implement each phase's code
Tools: Write, Edit
Focus areas:
- SVG path generation for zone polygons (complex geometry)
- D3 hexbin integration with React (careful with SSR — must be client-only)
- Color scale math (continuous interpolation)
- Responsive sizing (SVG viewBox scaling)

Key watch-outs:
- `d3-hexbin` and `d3-scale` must be imported dynamically or in client components only
- SVG viewBox must match BasketballCourt exactly (500x470)
- NBA coordinates: x ranges -250 to 250, y ranges -47.5 to 422.5
- `SHOT_MADE_FLAG` is 0 or 1 in the DB, not boolean

### Agent 2: DEBUG / TEST
Role: Verify each phase's output
Tools: Bash, Read, Grep
Instructions:
- Run `npm run build` after each phase
- Verify SVG renders by checking for valid XML structure
- Test API routes with curl: `curl localhost:3000/api/zones/player/Stephen%20Curry`
- Check that hexbin calculations produce reasonable output
- Verify color values are valid hex strings
- Check for client/server boundary issues (d3 imports in server components = crash)
- If build fails, identify the exact error line and report back

### Agent 3: CODE QUALITY REVIEW
Role: Review code for quality and visual consistency
Tools: Read, Grep, Glob
Instructions:
- Verify all colors come from design-tokens.ts or the zone-engine color scale
- Check that every component uses 'use client' if it uses d3 or hooks
- Verify SVG accessibility (role, aria-label on interactive elements)
- Check that SQL queries are parameterized
- Verify Framer Motion usage is consistent with existing patterns
- Check that MiniCourt and HotZoneChart share the same coordinate system
- Ensure no hardcoded pixel values — use the size prop system
- Report: CRITICAL / HIGH / MEDIUM issues

### Orchestration Loop:
```
For each phase:
  1. CODE WRITER implements
  2. DEBUG/TEST runs build + visual checks
  3. If fail → CODE WRITER fixes → DEBUG/TEST re-checks
  4. CODE QUALITY reviews
  5. CODE WRITER addresses CRITICAL issues
  6. Mark phase complete
```

---

## Data Integration

### Shot data is already in the DB
The `shots` table has 5.7M rows — this instance doesn't need to wait for the scraper.

### Checking for new data
If new shot chart CSVs appear in `~/basketball_data/`:
- Check for `nba_shot_chart_2025_26*.csv` (current season updates)
- Don't re-ingest — that's the scraper's job. Just verify data is accessible.

### Performance Optimization
With 5.7M shots, queries must be fast:
- Always filter by PLAYER_NAME + season
- Use existing indexes: `idx_shots_player_season`, `idx_shots_season_zone`
- Limit raw shot returns to 5000 for heatmap (sufficient for visual)
- Pre-aggregate zone stats in SQL, not in JS

---

## Success Criteria

After 6 hours:
1. HotZoneChart renders beautiful hexbin heatmaps with correct efficiency colors
2. Zone polygons fill with FG% relative to league average
3. Zones explorer page is fully functional with search + leaderboards
4. Player zone deep-dive page shows comprehensive analysis
5. Shot profile cards work as reusable components
6. Zone comparison (side-by-side) works
7. All animations are smooth and premium-feeling
8. Mobile responsive
9. Zero build errors
10. This should be the most visually impressive page in the entire platform
