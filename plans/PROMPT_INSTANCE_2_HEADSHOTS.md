# INSTANCE 2 — Fix Player Headshots (personId Pipeline)

cd ~/OneDrive/Desktop/basketballintelligence

You are fixing the missing player headshot images. The PlayerAvatar component works perfectly — it uses `https://cdn.nba.com/headshots/nba/latest/1040x760/{playerId}.png` — but most API endpoints don't return `personId`, so avatars fall back to initials instead of real photos.

## THE PROBLEM

The `players` table in `data/basketball.db` has a `person_id` column with valid NBA person IDs for every player:
- LeBron James → 2544
- Stephen Curry → 201939
- Joel Embiid → 203954

But most API endpoints query stats tables (player_stats_pergame, career_leaders, etc.) WITHOUT joining the players table, so `personId` is never returned. The PlayerAvatar component on pages receives `name` but not `playerId`, showing initials instead of headshots.

The ONLY endpoint that currently returns personId is `searchPlayers()` in db.ts (line 39: `p.person_id as personId`).

## PART A: Fix API Endpoints

### 1. `src/lib/playoffs-db.ts` — getTopScorersV2 (line ~500)

Current query (line 500-508):
```sql
SELECT Player as name, Tm as team, Pos as position,
       G as games, PTS as points, TRB as rebounds, AST as assists,
       FGPct as fgPct, "3PPct" as fg3Pct
FROM "${table}"
WHERE Season = ? AND CAST(G as INTEGER) >= 20
ORDER BY CAST(PTS as FLOAT) DESC
```

Fix — add LEFT JOIN to players table:
```sql
SELECT s.Player as name, s.Tm as team, s.Pos as position,
       s.G as games, s.PTS as points, s.TRB as rebounds, s.AST as assists,
       s.FGPct as fgPct, s."3PPct" as fg3Pct,
       p.person_id as personId
FROM "${table}" s
LEFT JOIN players p ON p.Player = s.Player
WHERE s.Season = ? AND CAST(s.G as INTEGER) >= 20
ORDER BY CAST(s.PTS as FLOAT) DESC
```

### 2. `src/lib/db.ts` — getCareerLeaders (line ~399)

Current query:
```sql
SELECT CAST(Rank as REAL) as rank, Player as name, HOF as hof, Active as active,
       Value as value
FROM career_leaders
WHERE stat = ? AND league = ?
```

Fix:
```sql
SELECT CAST(cl.Rank as REAL) as rank, cl.Player as name, cl.HOF as hof, cl.Active as active,
       cl.Value as value, p.person_id as personId
FROM career_leaders cl
LEFT JOIN players p ON p.Player = cl.Player
WHERE cl.stat = ? AND cl.league = ?
```

### 3. `src/lib/db.ts` — getPlayer (line ~47)

Read this function. It may already return person_id. If NOT, add it:
```sql
p.person_id as personId
```

### 4. `src/lib/db.ts` — getPlayerStats, getPlayerAdvancedStats, etc.

Search for ALL functions that return player data. Each one needs `person_id as personId` added. The player's own profile endpoint definitely needs it.

### 5. `src/app/api/v2/players/[name]/route.ts`

Read this file. It likely calls `getPlayer()`. Make sure the response includes `personId`.

### 6. `src/app/api/v2/compare/route.ts` and `src/app/api/compare/route.ts`

These return two players' data for comparison. Both need personId included.

### 7. `src/app/api/matchup/route.ts`

If this returns player names for matchup listings, add personId via JOIN.

### 8. `src/app/api/lineups/route.ts` and `src/app/api/v2/lineups/route.ts`

Player names in lineup responses need personId.

### 9. `src/app/api/explore/route.ts`

Legacy explore endpoint — same fix as v2 explore.

### 10. `src/app/api/zones/player/[name]/route.ts`

If this returns player info alongside zone data, add personId.

## PART B: Fix Page Components to Pass playerId

After the APIs return `personId`, every page must pass it to `<PlayerAvatar>`.

### Pattern to apply everywhere:
```tsx
// BEFORE (shows initials only):
<PlayerAvatar name={player.name} size="sm" />

// AFTER (shows NBA headshot):
<PlayerAvatar name={player.name} playerId={player.personId} size="sm" />
```

### Files to update:

1. **`src/app/page.tsx`** (home page)
   - Top Scorers carousel: find `<PlayerAvatar name={player.name}` — add `playerId={player.personId}`
   - All-Time Leaders: find `<PlayerAvatar name={leader.name}` — add `playerId={leader.personId}`
   - Search results: already has `playerId={r.personId}` ✓

2. **`src/app/explore/page.tsx`**
   - Same pattern for any player lists

3. **`src/app/compare/page.tsx`**
   - Hero section: `<PlayerAvatar name={data.player1.name}` → add `playerId={data.player1.personId}`
   - Same for player2
   - Search dropdowns: add `playerId={r.personId}`

4. **`src/app/lineup/page.tsx`**
   - PlayerSlot component: add `playerId={player.personId}`
   - RosterPickerModal: add `playerId`
   - LineupRow: add `playerId`

5. **`src/app/matchup/page.tsx`**
   - Popular matchups: add `playerId` if available

6. **`src/app/matchup/[slug]/page.tsx`**
   - Player headings in hero
   - Rival sections

7. **`src/app/zones/page.tsx`**
   - Featured player, leaderboards, search results

8. **`src/app/zones/[player]/page.tsx`**
   - Hero heading, similar players

9. **`src/app/player/[name]/page.tsx`**
   - Profile hero section

10. **`src/app/player/[name]/timeline/page.tsx`**
    - Hero section

11. **`src/app/stories/page.tsx`**
    - Scoring leaders, FG% leaders

12. **`src/app/play/page.tsx`**
    - Quiz player cards

13. **`src/app/shot-lab/page.tsx`**
    - Search results

14. **`src/app/film/page.tsx`** and **`src/app/film/[id]/page.tsx`**
    - Player references in clip cards and detail views

### IMPORTANT: Interface/Type Updates

When you add `personId` to API responses, you may need to update the TypeScript interfaces on each page. For example:

```tsx
// Add to the interface:
interface TopScorer {
  readonly name: string;
  readonly team: string;
  // ... existing fields
  readonly personId?: number | string | null;  // ADD THIS
}
```

## VERIFICATION

1. `npx next build` — must compile clean
2. Start dev server on port 3002: `npx next dev -p 3002`
3. Test API returns personId:
```bash
curl -s "http://localhost:3002/api/v2/explore" | python3 -c "
import json, sys
data = json.load(sys.stdin)
for s in data['topScorers']['data'][:5]:
    print(f'{s[\"name\"]} -> personId={s.get(\"personId\", \"MISSING\")}')"
```
Expected: every player should show a numeric personId, NOT "MISSING"

4. Open http://localhost:3002 in browser
   - Top Scorers should show REAL HEADSHOT PHOTOS, not initials
   - All-Time Leaders should show headshots
   - Search any player — headshot should appear

5. Check /compare, /matchup, /zones — all should show real player photos

## DO NOT TOUCH
- `src/lib/db.ts` functions that handle shot coordinates (LOC_X, LOC_Y) — Instance 1 owns those
- `src/components/ui/PlayerAvatar.tsx` — already works perfectly
- `src/components/ui/TeamLogo.tsx` — already works
- `src/lib/nba-assets.ts` — already correct
- `next.config.ts` — already has cdn.nba.com configured
- Film/video files — Instance 3 handles those
- Court geometry files — already fixed

## AFTER COMPLETION
Commit on main:
```bash
git add -A && git commit -m "fix: add personId to all API endpoints and pass playerId to PlayerAvatar across all pages"
```
