# INSTANCE 1 — Fix Shot Coordinate Mapping

cd ~/OneDrive/Desktop/basketballintelligence

You are fixing the CRITICAL shot coordinate misalignment bug. All shot data on every chart (Shot Lab, Hot Zones, player pages) is wrong because coordinates are at 1/10th scale.

## THE PROBLEM

The database stores shot coordinates in FEET:
- `LOC_X`: -25 to 25 (feet from basket center, left/right)
- `LOC_Y`: 0.05 to 93.65 (feet from BASELINE, 0 = baseline, basket at 5.25 ft)

But ALL chart components (ShotChart.tsx, HotZoneChart.tsx, zone-engine.ts) expect the standard NBA API format in TENTHS OF FEET:
- `x`: -250 to 250 (tenths of feet from basket center)
- `y`: -47.5 to 422.5 (tenths of feet, 0 = basket center, not baseline)

Result: every shot clusters in a tiny dot near the basket instead of spreading across the court.

## THE FIX

In every SQL query that returns `LOC_X as x, LOC_Y as y`, apply this transformation:

```sql
-- BEFORE (broken):
SELECT LOC_X as x, LOC_Y as y, SHOT_MADE_FLAG as made ...

-- AFTER (fixed):
SELECT CAST(LOC_X AS REAL) * 10 as x,
       (CAST(LOC_Y AS REAL) - 5.25) * 10 as y,
       SHOT_MADE_FLAG as made ...
```

Why:
- `* 10` converts feet to tenths-of-feet (matching chart expectations)
- `- 5.25` shifts the origin from baseline to basket center (basket is 5.25 ft from baseline)

## FILES TO EDIT (in this order)

### 1. `src/lib/db.ts` (lines 94-120)
The `getPlayerShots()` function has TWO branches (with season filter and without). Fix BOTH:

```
Line 100: SELECT LOC_X as x, LOC_Y as y
Line 112: SELECT LOC_X as x, LOC_Y as y
```

Change both to:
```sql
SELECT CAST(LOC_X AS REAL) * 10 as x, (CAST(LOC_Y AS REAL) - 5.25) * 10 as y
```

Also check for any other functions in db.ts that return LOC_X/LOC_Y and apply the same fix.

### 2. `src/lib/playoffs-db.ts` (line 239)
Find: `LOC_X as x, LOC_Y as y`
Apply same transformation.

### 3. `src/app/api/zones/player/[name]/route.ts` (line 19)
```
SELECT LOC_X as x, LOC_Y as y, SHOT_MADE_FLAG as made, SHOT_DISTANCE as distance
```
Change to:
```
SELECT CAST(LOC_X AS REAL) * 10 as x, (CAST(LOC_Y AS REAL) - 5.25) * 10 as y, SHOT_MADE_FLAG as made, SHOT_DISTANCE as distance
```

### 4. `src/app/api/zones/compare/route.ts` (lines 15 AND 28)
TWO queries to fix. Same transformation.

### 5. `src/app/api/zones/heatmap/[name]/route.ts` (line 34)
Same transformation. Note this one builds SQL dynamically with `shotParts` array — make sure the replacement string is correct.

### 6. `src/app/api/zones/league/route.ts` (line 23)
Same transformation.

### 7. `src/app/api/zones/similar/route.ts` (lines 32 AND 64)
TWO queries to fix. Same transformation.

### 8. `src/app/api/zones/trend/[name]/route.ts` (line 40)
Same transformation.

### 9. `src/app/api/shot-lab/compare/route.ts`
Find any `LOC_X as x, LOC_Y as y` and apply same transformation.

### 10. `src/app/api/shot-lab/zones/route.ts`
Same.

### 11. `src/app/api/shots/route.ts`
Same.

### 12. `src/app/api/quiz/shot-chart/route.ts`
Same.

## VERIFICATION AFTER ALL EDITS

1. Run `npx next build` — must compile clean
2. Start dev server: `npx next dev -p 3001` (use port 3001 to avoid conflicts)
3. Test the coordinate transformation:
```bash
curl -s "http://localhost:3001/api/players/Stephen%20Curry/shots?season=2025&limit=10" | python3 -c "
import json, sys
data = json.load(sys.stdin)
shots = data.get('shots', [])
for s in shots[:5]:
    print(f'x={s[\"x\"]:.1f}, y={s[\"y\"]:.1f}, zone={s.get(\"zoneBasic\",\"?\")}, dist={s.get(\"distance\",\"?\")}')
xs = [s['x'] for s in shots]
ys = [s['y'] for s in shots]
print(f'X range: {min(xs):.0f} to {max(xs):.0f} (should be -250 to 250)')
print(f'Y range: {min(ys):.0f} to {max(ys):.0f} (should be -47 to 420)')
"
```

Expected output after fix:
- X range: roughly -250 to 250
- Y range: roughly -50 to 400
- 3-point shots should have x/y values that map to the arc area

4. Open http://localhost:3001/shot-lab in browser, search "Stephen Curry", select 2025
   - You should see shots SPREAD across the entire court
   - 3-pointers along the arc
   - Paint shots near the basket
   - Mid-range in between

5. Open http://localhost:3001/zones/LeBron%20James
   - Hot zone hexbins should cover the full court
   - Zones should align with the 3-point arc and paint lines

## DO NOT TOUCH
- Court geometry files (BasketballCourt.tsx, MiniCourt.tsx) — already fixed
- nbaToSvg functions — they correctly expect -250..250 range
- classifyZone functions — they correctly use tenths-of-feet boundaries
- Any page files (src/app/*/page.tsx) — Instance 2 handles those
- Film/video files — Instance 3 handles those

## AFTER COMPLETION
Commit on main:
```bash
git add -A && git commit -m "fix: convert shot coordinates from feet to tenths-of-feet for correct chart alignment"
```
