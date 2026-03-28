# Orchestrator — Merge, Fix, Polish

## Mission
Merge Instance A (ui-overhaul-a) and Instance B (ui-overhaul-b) branches into main. Resolve conflicts. Fix build errors. Polish the result. Run on a 30-minute cycle for 3 hours.

## Process (repeat every 30 minutes)

### Step 1: Check Branch Status
```bash
cd ~/OneDrive/Desktop/basketballintelligence
git fetch --all 2>/dev/null
echo "=== Branch Status ==="
git log --oneline ui-overhaul-a -3 2>/dev/null || echo "Branch A: not yet created"
git log --oneline ui-overhaul-b -3 2>/dev/null || echo "Branch B: not yet created"
git log --oneline main -3
```

### Step 2: Merge Instance A First (design system must land first)
```bash
git checkout main
git merge ui-overhaul-a --no-edit
# Resolve conflicts favoring Instance A for: globals.css, design-tokens.ts, tailwind.config.ts, layout.tsx, AppShell.tsx, GlassCard.tsx
```

### Step 3: Merge Instance B
```bash
git merge ui-overhaul-b --no-edit
# Conflicts expected — Instance B pages may reference old Tailwind classes
# Resolution priority:
# 1. Instance A's design system/component changes win
# 2. Instance B's page logic/layout wins
# 3. Replace any remaining dark-mode classes Instance B missed
```

### Step 4: Build & Fix
```bash
npx next build
# Fix ALL TypeScript errors
# Fix ALL import errors (if GlassCard renamed, update imports)
# Fix ALL missing component props
```

### Step 5: Visual Consistency Audit
Grep for dark mode remnants across ALL files:
```bash
# These should return 0 results (except navbar for backdrop-blur):
grep -rl "bg-dark-" src/app/ src/components/
grep -rl "text-chrome-" src/app/ src/components/
grep -rl "bg-glass-" src/app/ src/components/
grep -rl "border-glass-" src/app/ src/components/
grep -rl "rgba(255,255,255" src/app/ src/components/
```
Fix any remaining instances using the replacement map from Instance B's plan.

### Step 6: E2E Test
```bash
npx next dev -p 3000 &
sleep 8
# Test all 20 pages
for page in "/" "/explore" "/compare" "/shot-lab" "/play" "/lineup" "/ask" "/matchup" "/film" "/film/upload" "/zones" "/stories" "/player/LeBron%20James" "/player/Stephen%20Curry" "/team/LAL" "/team/GSW" "/zones/LeBron%20James" "/matchup/lebron-james-vs-kevin-durant" "/player/LeBron%20James/timeline"; do
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 15 "http://localhost:3000${page}")
  echo "$code $page"
done
# Kill dev server
npx kill-port 3000
```

### Step 7: Polish Pass
- Consistent spacing: all pages use same padding/margin scale
- Syne font: verify ALL page titles use font-display
- JetBrains Mono: verify ALL stat displays use font-mono
- No infinite animations: grep for `repeat.*Infinity`, `animate-ping`, `animate-pulse`
- Player headshots: verify PlayerAvatar passes playerId where available
- Team logos: verify TeamLogo used in team references
- No console.log statements in production code

### Step 8: Commit
```bash
git add -A
git commit -m "chore: orchestrator merge + polish pass $(date +%H:%M)"
```

### Step 9: Schedule Next Run
Wait 30 minutes, then repeat from Step 1.

---

## Cron Schedule
Run at: T+60min, T+90min, T+120min, T+150min, T+180min

```bash
cat > /tmp/orchestrator-run.sh << 'SCRIPT'
#!/bin/bash
LOG=/tmp/orchestrator-log.txt
echo "=== Orchestrator Run $(date) ===" >> $LOG

cd ~/OneDrive/Desktop/basketballintelligence

# Check if branches exist
A_EXISTS=$(git branch --list ui-overhaul-a | wc -l)
B_EXISTS=$(git branch --list ui-overhaul-b | wc -l)

if [ "$A_EXISTS" -eq 0 ] && [ "$B_EXISTS" -eq 0 ]; then
  echo "Neither branch exists yet. Skipping." >> $LOG
  exit 0
fi

git checkout main >> $LOG 2>&1

if [ "$A_EXISTS" -gt 0 ]; then
  echo "Merging ui-overhaul-a..." >> $LOG
  git merge ui-overhaul-a --no-edit >> $LOG 2>&1
fi

if [ "$B_EXISTS" -gt 0 ]; then
  echo "Merging ui-overhaul-b..." >> $LOG
  git merge ui-overhaul-b --no-edit >> $LOG 2>&1
fi

echo "Building..." >> $LOG
npx next build >> $LOG 2>&1
BUILD_EXIT=$?

if [ $BUILD_EXIT -ne 0 ]; then
  echo "BUILD FAILED — needs manual intervention" >> $LOG
else
  echo "BUILD PASSED" >> $LOG
  git add -A >> $LOG 2>&1
  git commit -m "chore: orchestrator auto-merge $(date +%H:%M)" >> $LOG 2>&1
fi

echo "=== Run Complete ===" >> $LOG
SCRIPT
chmod +x /tmp/orchestrator-run.sh
```

---

## Conflict Resolution Rules
1. `globals.css` — always Instance A
2. `design-tokens.ts` — always Instance A
3. `tailwind.config.ts` — always Instance A
4. `GlassCard.tsx` — always Instance A
5. `AppShell.tsx` — always Instance A
6. Page files (shot-lab, zones, etc.) — always Instance B
7. Shared components (court, matchup, film) — always Instance B
8. If both touched the same line: use the LIGHT MODE version
