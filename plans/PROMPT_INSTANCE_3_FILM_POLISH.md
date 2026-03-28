# INSTANCE 3 — Fix Film/Video + Final Polish + E2E

cd ~/OneDrive/Desktop/basketballintelligence

You handle three things: fix the broken video playback, do a final visual polish pass, and run comprehensive E2E testing to verify everything works after Instance 1 and Instance 2 finish.

## PART A: Fix Film/Video Playback (Do First)

### Problem
The film system has `ClipPlayer.tsx` that renders a `<video>` element, but:
- No actual video source files exist in the project
- Clips in `data/film.db` have `video_path` and `thumbnail_path` pointing to nonexistent files
- Result: "The element has no supported sources" runtime error

### Files to Fix

#### 1. `src/components/film/ClipPlayer.tsx`
Read the full file. The component accepts `src` and `poster` props.

Fix: Add a proper guard when `src` is null, empty, or the file doesn't exist. Instead of rendering a broken `<video>` element, show a cinematic empty state:

```tsx
// At the top of the render, before the video element:
if (!src) {
  return (
    <div className={clsx('relative flex flex-col items-center justify-center', className)}
         style={{ aspectRatio: '16/9' }}>
      <div className="flex flex-col items-center justify-center h-full w-full rounded-2xl bg-gradient-to-br from-[#1D1D1F] via-[#2A2A2E] to-[#1D1D1F]">
        <div className="h-16 w-16 rounded-full bg-white/10 flex items-center justify-center mb-4">
          <Film size={28} className="text-white/40" />
        </div>
        <p className="text-sm font-medium text-white/60">Video source unavailable</p>
        <p className="text-xs text-white/30 mt-1">Upload a video to get started</p>
      </div>
    </div>
  );
}
```

Also add an `onError` handler to the `<video>` element that catches source load failures gracefully instead of throwing a runtime error.

#### 2. `src/app/film/[id]/page.tsx`
Read this file. Find where ClipPlayer is rendered. Add a guard:
- If the clip has no `video_path` or the path is empty, don't render ClipPlayer at all — show a placeholder instead
- Make sure the page doesn't crash when video metadata is incomplete

#### 3. `src/app/film/page.tsx`
Read this file. When clip cards are rendered:
- If clips have no thumbnails or video sources, the cards should still look good with cinematic placeholder styling (Instance A already added this — verify it's working)
- Make sure clicking a clip card that has no video doesn't navigate to a broken page

#### 4. `src/app/film/upload/page.tsx`
Read this file. The upload page should show clear instructions about supported video formats and not have any broken video preview states.

### About the film.db
Check what data exists:
```bash
node -e "
const Database = require('better-sqlite3');
const db = new Database('./data/film.db');
const tables = db.prepare(\"SELECT name FROM sqlite_master WHERE type='table'\").all();
console.log('Film DB tables:', tables.map(t=>t.name));
const clips = db.prepare('SELECT * FROM clips LIMIT 3').all();
console.log('Sample clips:', JSON.stringify(clips, null, 2));
db.close();
"
```
This will tell you what the data looks like and what paths it references.

## PART B: Visual Polish Pass (Do After Instance 1 + 2 finish)

Wait about 30-45 minutes for the other instances to finish their work, then do this pass.

### 1. Dark Mode Remnant Audit
```bash
grep -rn "bg-dark-\|text-chrome-dim\|text-chrome-light\|bg-dark-elevated\|border-glass-border\|bg-glass-frosted" src/app/ src/components/ | grep -v globals.css | grep -v node_modules
```
If any results found, replace:
- `text-chrome-light` → `text-[#1D1D1F]`
- `text-chrome-dim` → `text-[#86868B]`
- `bg-dark-elevated` → `bg-white`
- `bg-glass-frosted` → `bg-white/80`
- `border-glass-border` → `border-black/[0.06]`

### 2. Font Consistency Check
```bash
# Titles should use Syne (font-display):
grep -rn "font-display" src/app/ | head -20

# Stats/numbers should use JetBrains Mono (font-mono):
grep -rn "font-mono" src/app/ | head -20
```
Check that page titles (`<h1>`, `<h2>`) use `font-display` and stat numbers use `font-mono`.

### 3. Console.log Audit
```bash
grep -rn "console\.log" src/app/ src/components/ src/lib/
```
Remove any found (except in error handlers where `console.error` is appropriate).

### 4. Animation Check
```bash
grep -rn "repeat.*Infinity\|animation.*infinite" src/app/ src/components/ | grep -v "animate-pulse\|animate-spin\|shimmer"
```
Flag any infinite animations that aren't loading indicators.

## PART C: Comprehensive E2E Test (Do Last)

### 1. Build Check
```bash
npx next build
```
Must compile with 0 errors.

### 2. Start Dev Server
```bash
npx kill-port 3000 2>/dev/null
npx next dev -p 3000 &
sleep 12
```

### 3. Page Test (all 19 pages)
```bash
echo "=== PAGE TEST ==="
PASS=0; FAIL=0
for page in "/" "/explore" "/compare" "/shot-lab" "/play" "/lineup" "/ask" "/matchup" "/film" "/film/upload" "/zones" "/stories" "/player/LeBron%20James" "/player/Stephen%20Curry" "/team/LAL" "/team/GSW" "/zones/LeBron%20James" "/matchup/lebron-james-vs-kevin-durant" "/player/LeBron%20James/timeline"; do
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 20 "http://localhost:3000${page}")
  if [ "$code" = "200" ]; then PASS=$((PASS+1)); echo "  PASS $page"; else FAIL=$((FAIL+1)); echo "  FAIL($code) $page"; fi
done
echo "Result: $PASS passed, $FAIL failed"
```

### 4. API Test (key endpoints)
```bash
echo "=== API TEST ==="
for api in "/api/v2/explore" "/api/players/search?q=lebron&limit=3" "/api/v2/players/LeBron%20James" "/api/v2/teams/LAL" "/api/zones/player/LeBron%20James" "/api/timeline/LeBron%20James" "/api/film/clips"; do
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 20 "http://localhost:3000${api}")
  echo "  $code $api"
done
```

### 5. Shot Coordinate Verification (confirms Instance 1's work)
```bash
curl -s "http://localhost:3000/api/players/Stephen%20Curry/shots?season=2025&limit=20" | python3 -c "
import json, sys
data = json.load(sys.stdin)
shots = data.get('shots', [])
xs = [s['x'] for s in shots]
ys = [s['y'] for s in shots]
print(f'X range: {min(xs):.0f} to {max(xs):.0f} (expect -250..250)')
print(f'Y range: {min(ys):.0f} to {max(ys):.0f} (expect -50..400)')
threes = [s for s in shots if abs(s['x']) > 200 or s['y'] > 200]
print(f'Shots beyond paint: {len(threes)}/{len(shots)} (should be >50%% for Curry)')
"
```

### 6. Headshot Verification (confirms Instance 2's work)
```bash
curl -s "http://localhost:3000/api/v2/explore" | python3 -c "
import json, sys
data = json.load(sys.stdin)
scorers = data['topScorers']['data']
missing = [s['name'] for s in scorers if not s.get('personId')]
if missing: print(f'MISSING personId: {missing}')
else: print(f'All {len(scorers)} scorers have personId')
"
```

### 7. Visual Spot Check (manual)
Open these pages in browser and visually verify:
- http://localhost:3000 — headshots in top scorers, team logos in standings
- http://localhost:3000/shot-lab — search Curry, verify shots spread across court
- http://localhost:3000/zones/LeBron%20James — hexbins cover full court
- http://localhost:3000/matchup/lebron-james-vs-kevin-durant — player photos
- http://localhost:3000/film — no video errors, cinematic placeholders

## DO NOT TOUCH
- Shot coordinate SQL queries — Instance 1 owns those
- Player personId API JOINs — Instance 2 owns those
- Court geometry (BasketballCourt.tsx, zone-engine.ts) — already fixed
- `next.config.ts` — already has cdn.nba.com configured

## AFTER COMPLETION
Commit on main:
```bash
git add -A && git commit -m "fix: handle missing video sources gracefully + final visual polish pass"
```
