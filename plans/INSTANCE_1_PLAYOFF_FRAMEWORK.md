# INSTANCE 1: Global Season-Type Framework (Regular / Playoffs / Combined)

## Mission

Build a platform-wide season-type toggle that lets every surface switch between Regular Season, Playoffs, and Combined views. This is foundational infrastructure — it makes the entire product feel 2x deeper overnight.

## Time Budget: 6 hours autonomous

## File Ownership (NO other instance touches these)

### NEW files this instance creates:
```
src/lib/playoffs-db.ts              — All playoff-aware query functions
src/lib/season-context.tsx          — React context + provider for season type
src/components/ui/SeasonTypeToggle.tsx — The animated toggle pill component
src/components/ui/SeasonTypeBadge.tsx  — Small badge showing current mode
src/app/api/v2/players/[name]/route.ts
src/app/api/v2/players/[name]/shots/route.ts
src/app/api/v2/players/[name]/similar/route.ts
src/app/api/v2/players/search/route.ts
src/app/api/v2/compare/route.ts
src/app/api/v2/shot-lab/zones/route.ts
src/app/api/v2/shot-lab/compare/route.ts
src/app/api/v2/shot-lab/whatif/route.ts
src/app/api/v2/quiz/route.ts
src/app/api/v2/quiz/archetype/route.ts
src/app/api/v2/explore/route.ts
src/app/api/v2/lineups/route.ts
src/app/api/v2/teams/[abbr]/route.ts
src/app/api/v2/standings/route.ts
src/scripts/ingest-playoffs.ts      — Ingestion script for new playoff data
```

### Files this instance MAY MODIFY (append-only, bottom of file):
```
src/lib/db.ts                       — Add season-type-aware wrappers at bottom
src/components/layout/AppShell.tsx   — Wrap children in SeasonTypeProvider
src/app/layout.tsx                   — Add provider if needed
```

### Files this instance MUST NOT touch:
```
src/app/shot-lab/*                  — Instance 2 owns
src/app/matchup/*                   — Instance 3 owns
src/app/film/*                      — Instance 4 owns
src/components/court/*              — Instance 2 owns
src/components/matchup/*            — Instance 3 owns
src/components/timeline/*           — Instance 3 owns
src/components/film/*               — Instance 4 owns
video-ml/*                          — Instance 4 owns
```

---

## Architecture

### Season Type Enum
```typescript
type SeasonType = 'regular' | 'playoffs' | 'combined';
```

### Data Strategy
The scraper is populating `~/basketball_data/` with playoff CSVs right now. Expected files:
- `player_playoffs_pergame_*.csv` — Playoff per-game stats
- `nba_shot_chart_playoffs_*.csv` — Playoff shot charts (some already in DB)
- `player_playoffs_advanced_*.csv` — Playoff advanced stats

For existing tables that already contain some playoff data (shots table has playoff shots mixed in), the approach is:
1. Check if playoff-specific tables exist in DB
2. If not, create them and ingest from CSVs when available
3. If CSVs aren't ready yet, use graceful fallbacks (show "Playoff data loading..." state)

### Query Architecture
Every query function gets a `seasonType` parameter that determines which table(s) to query:
- `regular` → existing tables (player_stats_pergame, shots, etc.)
- `playoffs` → new playoff tables (player_stats_playoffs_pergame, etc.)
- `combined` → UNION ALL of both

---

## Phase 1: Data Layer (Target: 60 min)

### 1a. Create `src/lib/playoffs-db.ts`

This file contains ALL playoff-aware database functions. It imports `getDb` from `./db` and provides season-type-aware versions of every query.

```typescript
import { getDb } from './db';

export type SeasonType = 'regular' | 'playoffs' | 'combined';

// Table name resolver
function statsTable(type: SeasonType): string {
  switch (type) {
    case 'regular': return 'player_stats_pergame';
    case 'playoffs': return 'player_stats_playoffs_pergame';
    case 'combined': return 'player_stats_pergame'; // handled with UNION
  }
}

function advancedTable(type: SeasonType): string {
  switch (type) {
    case 'regular': return 'player_stats_advanced';
    case 'playoffs': return 'player_stats_playoffs_advanced';
    case 'combined': return 'player_stats_advanced';
  }
}

function shotsFilter(type: SeasonType): string {
  // The shots table has a season column like "2023-24"
  // Playoff shots may be tagged differently or in a separate table
  switch (type) {
    case 'regular': return "AND season NOT LIKE '%playoffs%'";
    case 'playoffs': return "AND season LIKE '%playoffs%'";
    case 'combined': return '';
  }
}

// ── Player functions ──
export function getPlayerStatsV2(name: string, seasonType: SeasonType) { ... }
export function getPlayerAdvancedV2(name: string, seasonType: SeasonType) { ... }
export function getPlayerShotsV2(name: string, seasonType: SeasonType, season?: string, limit?: number) { ... }
export function getShotZoneStatsV2(name: string, seasonType: SeasonType, season?: string) { ... }
export function findSimilarPlayersV2(name: string, seasonType: SeasonType, season?: string) { ... }

// ── Compare functions ──
export function comparePlayersV2(p1: string, p2: string, seasonType: SeasonType, season?: string) { ... }

// ── Team functions ──
export function getTeamRosterV2(abbr: string, seasonType: SeasonType, season?: string) { ... }

// ── Explore functions ──
export function getTopScorersV2(seasonType: SeasonType, season?: string, limit?: number) { ... }

// ── Check data availability ──
export function getPlayoffDataStatus(): {
  hasPlayoffStats: boolean;
  hasPlayoffAdvanced: boolean;
  hasPlayoffShots: boolean;
  playoffSeasons: string[];
} { ... }
```

**Key implementation details:**
- For `combined` mode, use `UNION ALL` with a `source` column ('regular'/'playoffs')
- Always check if playoff tables exist before querying (graceful degradation)
- Use `try/catch` around playoff table queries — if table doesn't exist yet, return empty with a flag

### 1b. Create DB tables for playoff data

Create `src/scripts/ingest-playoffs.ts` that:
1. Checks `~/basketball_data/` for playoff CSV files
2. Creates tables if they don't exist:
   ```sql
   CREATE TABLE IF NOT EXISTS player_stats_playoffs_pergame (
     -- Same schema as player_stats_pergame
     Season INT, Player TEXT, Age REAL, Tm TEXT, Pos TEXT,
     G REAL, GS REAL, MP REAL, FG REAL, FGA REAL, FGPct REAL,
     "3P" REAL, "3PA" REAL, "3PPct" REAL, "2P" REAL, "2PA" REAL, "2PPct" REAL,
     eFGPct REAL, FT REAL, FTA REAL, FTPct REAL,
     ORB REAL, DRB REAL, TRB REAL, AST REAL, STL REAL, BLK REAL,
     TOV REAL, PF REAL, PTS REAL, Awards TEXT
   );

   CREATE TABLE IF NOT EXISTS player_stats_playoffs_advanced (
     -- Same schema as player_stats_advanced
     Season INT, Player TEXT, Age REAL, Tm TEXT, Pos TEXT,
     G REAL, MP REAL, PER REAL, TSPct REAL, "3PAr" REAL, FTr REAL,
     ORBPct REAL, DRBPct REAL, TRBPct REAL, ASTPct REAL, STLPct REAL,
     BLKPct REAL, TOVPct REAL, USGPct REAL,
     OWS REAL, DWS REAL, WS REAL, WS48 REAL,
     OBPM REAL, DBPM REAL, BPM REAL, VORP REAL
   );
   ```
3. Reads CSVs with proper header mapping (same patterns as existing `scripts/ingest.py`)
4. Adds indexes matching existing patterns

### 1c. Data availability check endpoint

`src/app/api/v2/data-status/route.ts`:
```typescript
// GET /api/v2/data-status
// Returns: { regular: true, playoffs: boolean, playoffSeasons: string[] }
```

### Phase 1 Gate
- [ ] `playoffs-db.ts` compiles with zero TS errors
- [ ] `getPlayoffDataStatus()` returns correct availability
- [ ] Regular season queries still work unchanged
- [ ] If playoff tables don't exist, functions return `{ data: [], playoffAvailable: false }`

---

## Phase 2: API Layer (Target: 75 min)

Create v2 API routes that accept `?seasonType=regular|playoffs|combined` query param.

### Route pattern
Every v2 route follows this pattern:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { type SeasonType } from '@/lib/playoffs-db';

function parseSeasonType(req: NextRequest): SeasonType {
  const raw = req.nextUrl.searchParams.get('seasonType');
  if (raw === 'playoffs' || raw === 'combined') return raw;
  return 'regular'; // safe default
}
```

### Routes to create:

**`src/app/api/v2/players/[name]/route.ts`**
- Same as existing but calls `getPlayerStatsV2` and `getPlayerAdvancedV2`
- Response includes `seasonType` field and `playoffAvailable` flag

**`src/app/api/v2/players/[name]/shots/route.ts`**
- Accepts `seasonType` and `season`
- Uses `getPlayerShotsV2`

**`src/app/api/v2/compare/route.ts`**
- Accepts `p1`, `p2`, `seasonType`, `season`
- Returns both players' stats + shot zones filtered by season type

**`src/app/api/v2/shot-lab/zones/route.ts`**
- Zone profiles filtered by season type
- League baseline recalculated per season type

**`src/app/api/v2/shot-lab/whatif/route.ts`**
- What-if modeling with playoff shot distribution

**`src/app/api/v2/explore/route.ts`**
- Top scorers and standings filtered by season type
- Playoff standings = conference/round progression

**`src/app/api/v2/quiz/route.ts`** and **`archetype/route.ts`**
- Quiz questions from playoff data ("Guess the playoff performer")

**`src/app/api/v2/teams/[abbr]/route.ts`**
- Team roster + stats filtered by season type

**`src/app/api/v2/lineups/route.ts`**
- Lineup data with season type filter

### Phase 2 Gate
- [ ] Every v2 route returns valid JSON
- [ ] `?seasonType=regular` returns same data as existing v1 routes
- [ ] `?seasonType=playoffs` returns empty with `playoffAvailable: false` if no data yet
- [ ] `?seasonType=combined` merges correctly
- [ ] Build passes: `npm run build`

---

## Phase 3: UI Components (Target: 90 min)

### 3a. SeasonTypeToggle component

`src/components/ui/SeasonTypeToggle.tsx`

A premium, animated pill toggle with 3 states. Think Apple's segmented control but with glass morphism.

**Design spec:**
- Horizontal pill with 3 segments: "Regular" | "Playoffs" | "Combined"
- Active segment has sliding backdrop (Framer Motion layoutId animation)
- Inactive segments are dim chrome text
- Active segment glows with accent color:
  - Regular = accentBlue (#4DA6FF)
  - Playoffs = accentOrange (#FF6B35)
  - Combined = accentViolet (#A78BFA)
- Glass background with backdrop blur
- Smooth spring animation on switch (stiffness: 350, damping: 30)
- Small "LIVE" dot next to Playoffs when playoff data is available
- Disabled/greyed state with tooltip when playoff data not yet loaded

```typescript
interface SeasonTypeToggleProps {
  readonly value: SeasonType;
  readonly onChange: (type: SeasonType) => void;
  readonly playoffAvailable?: boolean;
  readonly compact?: boolean; // smaller version for inline use
}
```

**Visual reference:**
```
┌─────────────────────────────────────────┐
│  ┌──────────┐                           │
│  │ Regular  │  Playoffs   Combined      │  ← sliding pill bg
│  └──────────┘                           │
└─────────────────────────────────────────┘
```

When Playoffs selected with glow:
```
┌─────────────────────────────────────────┐
│              ┌───────────┐              │
│   Regular    │ Playoffs ●│  Combined    │  ← orange glow, "●" = live dot
│              └───────────┘              │
└─────────────────────────────────────────┘
```

### 3b. SeasonTypeBadge component

`src/components/ui/SeasonTypeBadge.tsx`

Small inline badge that shows current mode. Used in cards and headers.

```
[🏀 Playoffs] or [📊 Regular] or [⚡ Combined]
```
(Use Lucide icons, not emojis: Trophy for playoffs, BarChart3 for regular, Layers for combined)

### 3c. React Context

`src/lib/season-context.tsx`

```typescript
'use client';

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';

export type SeasonType = 'regular' | 'playoffs' | 'combined';

interface SeasonTypeState {
  readonly seasonType: SeasonType;
  readonly setSeasonType: (type: SeasonType) => void;
  readonly playoffAvailable: boolean;
}

const SeasonTypeContext = createContext<SeasonTypeState>({
  seasonType: 'regular',
  setSeasonType: () => {},
  playoffAvailable: false,
});

export function SeasonTypeProvider({ children }: { readonly children: ReactNode }) {
  const [seasonType, setSeasonType] = useState<SeasonType>('regular');
  const [playoffAvailable, setPlayoffAvailable] = useState(false);

  useEffect(() => {
    // Check playoff data availability on mount
    fetch('/api/v2/data-status')
      .then(r => r.json())
      .then(data => setPlayoffAvailable(data.playoffs ?? false))
      .catch(() => setPlayoffAvailable(false));
  }, []);

  return (
    <SeasonTypeContext.Provider value={{ seasonType, setSeasonType, playoffAvailable }}>
      {children}
    </SeasonTypeContext.Provider>
  );
}

export function useSeasonType() {
  return useContext(SeasonTypeContext);
}
```

### 3d. Integration into AppShell

Modify `src/components/layout/AppShell.tsx`:
- Wrap the `<main>` content area with `<SeasonTypeProvider>`
- Add the `SeasonTypeToggle` in a fixed position at top-right of the page area
- The toggle should be semi-transparent and blur when scrolling, sticking to the top

**Toggle placement:**
```
┌──────────────────────────────────────────┐
│                          [Reg|Play|Comb] │ ← Fixed top-right toggle
│                                          │
│   Page Content                           │
│                                          │
│                                          │
├──────────────────────────────────────────┤
│  [Nav] [Nav] [Nav] [Nav] [Nav]           │ ← Existing bottom nav
└──────────────────────────────────────────┘
```

### Phase 3 Gate
- [ ] Toggle renders and animates between 3 states
- [ ] Context provides seasonType to all child components
- [ ] Switching toggle triggers re-fetch of visible data
- [ ] Disabled state shows correctly when playoff data unavailable
- [ ] No layout shift when toggle appears
- [ ] Build passes

---

## Phase 4: Page Integration (Target: 90 min)

Update existing pages to consume the season type context. For each page:
1. Import `useSeasonType()` hook
2. Replace API fetch URLs with v2 versions including `?seasonType=${seasonType}`
3. Add loading state during season-type switch
4. Show SeasonTypeBadge in relevant headers

### Pages to update (modify carefully — append, don't rewrite):

**`src/app/page.tsx` (Explore/Home)**
- Top scorers section respects season type
- Standings section shows playoff bracket in playoffs mode
- Add subtle animation when data refreshes

**`src/app/player/[name]/page.tsx` (Player Lab)**
- Stats table shows regular/playoff/combined
- Shot chart filters by season type
- Awards section unaffected (always shows all)
- Add "Playoff Averages" card alongside career averages

**`src/app/compare/page.tsx` (Compare Studio)**
- Comparison bars reflect season type
- Season selector shows "2024 Playoffs" options when available

**`src/app/shot-lab/page.tsx`**
- INSTANCE 2 OWNS THIS PAGE — do NOT modify
- Instead: ensure v2 API routes work so Instance 2 can use them

**`src/app/play/page.tsx` (Quiz)**
- Add "Playoff Edition" quiz variant
- Different player pool when in playoffs mode

**`src/app/lineup/page.tsx`**
- Filter lineups by season type

**`src/app/stories/page.tsx`**
- Add playoff narrative templates

**`src/app/ask/page.tsx`**
- Update Gemini system prompt to include playoff tables

### Transition animation
When season type changes:
1. Current data fades out (opacity 0, y: -8, 200ms)
2. Loading shimmer appears (100ms)
3. New data fades in (opacity 1, y: 0, 300ms spring)

### Phase 4 Gate
- [ ] Switching toggle on home page refreshes top scorers
- [ ] Player Lab shows playoff stats when toggle set
- [ ] Compare works with playoff data
- [ ] Quiz serves playoff questions
- [ ] No console errors during transitions
- [ ] Build passes

---

## Phase 5: Polish & Edge Cases (Target: 45 min)

- Empty states: "Playoff data coming soon" with basketball animation
- Loading skeletons match existing `SkeletonLoader` pattern
- Persist season type in localStorage (restore on reload)
- URL sync: `?seasonType=playoffs` query param support
- Keyboard shortcut: `1/2/3` keys to switch when toggle focused
- Accessibility: ARIA labels, keyboard navigation, screen reader announcements
- Error boundaries: if playoff query fails, fall back to regular silently
- Mobile: toggle shrinks to compact mode on <640px

### Phase 5 Gate
- [ ] Full build passes: `npm run build`
- [ ] All pages render without errors in all 3 modes
- [ ] Season type persists across page navigation
- [ ] Mobile layout works
- [ ] Graceful degradation when playoff data missing

---

## UI Design Reference

### Color language:
- Regular Season = cool blue tones (accentBlue #4DA6FF)
- Playoffs = warm orange/fire tones (accentOrange #FF6B35)
- Combined = violet/purple blend (accentViolet #A78BFA)

### Animation:
- Toggle switch: spring(350, 30) — snappy
- Data refresh: spring(120, 14) — gentle fade
- Badge pulse: 2s infinite when playoffs live

### Typography for toggle:
- Labels: fontSize.sm (12px), fontWeight.semibold
- Active: chromeLight, inactive: chromeDim

---

## Subagent Orchestration

### Agent 1: CODE WRITER
Role: Implement each phase's code
Tools: Write, Edit
Instructions:
- Follow the file ownership map strictly
- Use existing design tokens from `src/lib/design-tokens.ts`
- Match existing code patterns (readonly props, Framer Motion, clsx)
- Import from `@/lib/` and `@/components/` using path aliases
- Every component must be 'use client' if it uses hooks/state
- Never use `any` type — use `unknown` and narrow

### Agent 2: DEBUG / TEST
Role: Verify each phase's output
Tools: Bash (npm run build, npm run lint), Read, Grep
Instructions:
- After Code Writer finishes a phase, run `npm run build` from project root
- Check for TypeScript errors specifically
- Verify API routes return valid JSON by running the dev server and curling endpoints
- Check for import resolution issues
- Verify no runtime errors in browser console
- If build fails, identify the exact error and report back

### Agent 3: CODE QUALITY REVIEW
Role: Review code for quality, patterns, security
Tools: Read, Grep, Glob
Instructions:
- Verify all new files match existing codebase patterns
- Check: readonly props, proper TypeScript types, no `any`
- Check: Framer Motion usage matches motionPresets patterns
- Check: Glass morphism styling uses design tokens not hardcoded values
- Check: API routes validate input and handle errors
- Check: SQL queries are parameterized (no string interpolation)
- Check: No console.log in production code
- Check: Components are properly memoized where needed
- Report issues as: CRITICAL (must fix), HIGH (should fix), MEDIUM (nice to fix)

### Orchestration Loop (repeat per phase):
```
1. ORCHESTRATOR reads phase requirements
2. CODE WRITER implements phase → creates/modifies files
3. DEBUG/TEST runs build + tests → reports pass/fail
4. If fail → CODE WRITER fixes issues → DEBUG/TEST re-verifies
5. CODE QUALITY reviews → reports issues
6. CODE WRITER addresses CRITICAL/HIGH issues
7. ORCHESTRATOR marks phase complete, moves to next
```

---

## Data Integration

### Checking for incoming data
Every 15 minutes during execution, check:
```bash
ls ~/basketball_data/player_playoffs* 2>/dev/null
ls ~/basketball_data/nba_shot_chart_playoffs* 2>/dev/null
```

If new playoff CSVs appear:
1. Run the ingestion script to load them into SQLite
2. Re-verify playoff data availability
3. Update any "data loading" states to show real data

### Ingestion script (`src/scripts/ingest-playoffs.ts`)
```typescript
// Run with: npx tsx src/scripts/ingest-playoffs.ts
// Watches ~/basketball_data/ for playoff CSV files
// Creates tables if needed, inserts data, adds indexes
```

---

## Success Criteria

After 6 hours, the instance should have:
1. A working 3-state toggle visible on every page
2. All v2 API routes functional
3. At least Home, Player Lab, Compare, and Quiz consuming season type
4. Graceful fallback when playoff data not yet loaded
5. Smooth animations on toggle switch
6. Zero build errors
7. Clean TypeScript — no `any`, proper readonly, proper error handling
