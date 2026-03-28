# Parallel Fix Plan — 3 CLI Instances

## Root Causes Identified

### 1. Shot Coordinates Misaligned (CRITICAL)
The database stores shot coordinates in **feet** (x: -25 to 25, y: 0 to 94), but all chart components expect **tenths of feet** (x: -250 to 250, y: -47.5 to 422.5).

**Evidence:**
- DB column `LOC_X` range: -25 to 25 (feet from basket center)
- DB column `LOC_Y` range: 0.05 to 93.65 (feet from baseline)
- `ShotChart.tsx` nbaToSvg expects `NBA_X_MIN=-250, NBA_X_MAX=250`
- Result: all shots cluster within 1/10th of the chart near the basket

**Fix:** Multiply coordinates by 10 in `db.ts` `getPlayerShots()` and ALL zone API queries:
```sql
-- Current:
SELECT LOC_X as x, LOC_Y as y ...
-- Fixed:
SELECT CAST(LOC_X AS REAL) * 10 as x, (CAST(LOC_Y AS REAL) - 5.25) * 10 as y ...
```
This converts feet→tenths-of-feet and shifts origin from baseline to basket (where 0,0 = basket center).

**Files to change:** `src/lib/db.ts` + every API route in `src/app/api/zones/`, `src/app/api/shots/`, `src/app/api/shot-lab/`, `src/app/api/v2/players/[name]/shots/`

### 2. Player Headshots Missing (HIGH)
The `person_id` column exists in the `players` table but is NOT returned by most API endpoints. Without `personId`, `PlayerAvatar` falls back to initials instead of NBA CDN headshots.

**Evidence:**
- DB has: `person_id` for every player (LeBron=2544, Curry=201939)
- `/api/v2/explore` returns top scorers WITHOUT personId
- `/api/players/search` DOES return personId (it works there)
- Most pages use `<PlayerAvatar name={...} />` without `playerId`

**Fix:**
1. JOIN `players` table in all API endpoints to include `person_id`
2. Pass `playerId={data.personId}` in every `<PlayerAvatar>` on every page

**Files to change:** All API route files that return player data + all page files that render PlayerAvatar

### 3. Video Playback Broken (MEDIUM)
The film system has `ClipPlayer` but no actual video source files exist. The `film.db` has clip metadata but `src` paths point to nonexistent files.

**Evidence:** "The element has no supported sources" error
**Fix:** Create proper empty/demo states with clear messaging instead of broken video players

---

## Instance Assignment

### INSTANCE 1: Shot Coordinate Fix (Branch: `fix-shot-coords`)
**Priority: CRITICAL — this is the most visible bug**

1. Edit `src/lib/db.ts`:
   - In `getPlayerShots()`: change `SELECT LOC_X as x, LOC_Y as y` to `SELECT CAST(LOC_X AS REAL) * 10 as x, (CAST(LOC_Y AS REAL) - 5.25) * 10 as y`
   - Apply same fix to ALL other functions that return shot x/y

2. Fix ALL zone API routes (each does its own SQL query):
   - `src/app/api/zones/compare/route.ts`
   - `src/app/api/zones/heatmap/[name]/route.ts`
   - `src/app/api/zones/league/route.ts`
   - `src/app/api/zones/player/[name]/route.ts`
   - `src/app/api/zones/similar/route.ts`
   - `src/app/api/zones/trend/[name]/route.ts`

3. Fix shot-lab API routes:
   - `src/app/api/shot-lab/compare/route.ts`
   - `src/app/api/shot-lab/zones/route.ts`
   - `src/app/api/shots/route.ts`
   - `src/app/api/quiz/shot-chart/route.ts`

4. Verify `ShotChart.tsx` nbaToSvg constants match:
   - NBA_X_MIN=-250, NBA_X_MAX=250 (matches converted data)
   - NBA_Y_MIN=-47.5, NBA_Y_MAX=422.5 (matches converted data)

5. Verify `zone-engine.ts` classifyZone boundaries work with converted data:
   - Restricted Area: dist <= 40 (4ft * 10)
   - 3PT: dist >= 237.5 (23.75ft * 10)
   - Corner 3: x <= -220 && y <= 92.5
   - Paint: |x| <= 80 && y <= 190

6. Test: Load `/shot-lab` with "Stephen Curry" 2025 season.
   - 3-pointers should scatter across the arc
   - Paint shots near basket
   - Mid-range in between

### INSTANCE 2: Player Headshots / personId (Branch: `fix-headshots`)
**Priority: HIGH — empty avatars everywhere**

1. Fix API endpoints to return `person_id`:
   - `src/app/api/v2/explore/route.ts` — JOIN players table for top scorers
   - `src/app/api/v2/players/[name]/route.ts` — include person_id
   - `src/app/api/players/[name]/route.ts` — include person_id
   - `src/app/api/compare/route.ts` — include person_id for both players
   - `src/app/api/v2/compare/route.ts`
   - `src/app/api/matchup/route.ts` — include person_id
   - `src/app/api/matchup/rivals/[name]/route.ts`
   - `src/app/api/lineups/route.ts`
   - `src/app/api/explore/route.ts`
   - `src/app/api/v2/lineups/route.ts`

   Pattern for JOIN:
   ```sql
   -- Add to queries that return player names:
   LEFT JOIN players p ON p.Player = <player_name_column>
   -- Then include: p.person_id as personId
   ```

2. Update ALL page files to pass `playerId` to `PlayerAvatar`:
   - `src/app/page.tsx` — already passes for some, check all instances
   - `src/app/explore/page.tsx`
   - `src/app/compare/page.tsx`
   - `src/app/lineup/page.tsx`
   - `src/app/matchup/page.tsx` + `[slug]/page.tsx`
   - `src/app/zones/page.tsx` + `[player]/page.tsx`
   - `src/app/player/[name]/page.tsx` + `timeline/page.tsx`
   - `src/app/stories/page.tsx`
   - `src/app/play/page.tsx`
   - `src/app/shot-lab/page.tsx`
   - `src/app/film/page.tsx` + `[id]/page.tsx`

3. Verify headshots load: check browser Network tab for `https://cdn.nba.com/headshots/nba/latest/1040x760/{personId}.png`

4. Add `cdn.nba.com` to `next.config.ts` images.remotePatterns if not already there (required for next/image):
   ```ts
   images: {
     remotePatterns: [
       { protocol: 'https', hostname: 'cdn.nba.com' },
     ],
   }
   ```

### INSTANCE 3: Video/Film Fix + Visual Polish (Branch: `fix-film-polish`)
**Priority: MEDIUM**

1. Fix video playback empty state:
   - `src/components/film/ClipPlayer.tsx` — if `src` is null/empty, show cinematic "No video source" state instead of broken player
   - `src/app/film/[id]/page.tsx` — guard against missing video src
   - `src/app/film/page.tsx` — show proper empty states for clips without video

2. Add `cdn.nba.com` to `next.config.ts` remotePatterns (coordinate with Instance 2)

3. Final visual polish pass:
   - Verify all 19 pages render correctly
   - Run E2E test (all pages 200 OK)
   - Grep for any remaining dark-mode classes
   - Check font-display (Syne) and font-mono (JetBrains Mono) usage
   - Screenshot key pages for review

---

## Conflict Prevention
- Instance 1 owns: `src/lib/db.ts`, `src/app/api/zones/`, `src/app/api/shots/`, `src/app/api/shot-lab/`, court/chart components
- Instance 2 owns: `src/app/api/v2/explore/`, `src/app/api/v2/players/`, `src/app/api/compare/`, `src/app/api/matchup/`, all page files in `src/app/`
- Instance 3 owns: `src/components/film/`, `src/app/film/`, `next.config.ts`, E2E testing

## SQL Transform Reference
```sql
-- Convert shot coordinates from feet (DB) to tenths-of-feet (NBA API standard)
-- x: feet from basket center → tenths of feet from basket center
-- y: feet from baseline → tenths of feet from basket center (basket at 5.25 ft from baseline)
SELECT
  CAST(LOC_X AS REAL) * 10 as x,
  (CAST(LOC_Y AS REAL) - 5.25) * 10 as y,
  SHOT_MADE_FLAG as made,
  SHOT_DISTANCE as distance
FROM shots
```
