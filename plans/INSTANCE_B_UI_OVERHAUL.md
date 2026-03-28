# Instance B — Features & Interactions UI Overhaul

## Mission
Convert all feature pages and shared visualization components from dark glass morphism to Apple-style premium light mode. You own shot lab, zones, matchup, film, play, stories, lineup, ask, and all shared chart/court/matchup components.

## Branch
Work on `ui-overhaul-b`. Create it immediately: `git checkout -b ui-overhaul-b`

## CRITICAL: Files You Must NOT Touch
Instance A owns these files and is modifying them simultaneously:
- `src/app/globals.css`
- `src/lib/design-tokens.ts`
- `tailwind.config.ts`
- `src/app/layout.tsx`
- `src/components/layout/AppShell.tsx`
- `src/components/ui/GlassCard.tsx`
- `src/components/ui/PlayerAvatar.tsx`
- `src/components/ui/TeamLogo.tsx` (new)
- `src/components/ui/SectionHeader.tsx`
- `src/components/ui/MetricChip.tsx`
- `src/components/ui/Badge.tsx`
- `src/components/ui/SearchBar.tsx`
- `src/components/ui/SkeletonLoader.tsx`
- `src/components/ui/PlayoffFlair.tsx`
- `src/components/ui/SeasonTypeToggle.tsx`
- `src/components/ui/PlayoffBracket.tsx`
- `src/lib/nba-assets.ts` (new)
- `src/lib/db.ts`
- `next.config.ts`
- `src/app/page.tsx`
- `src/app/player/[name]/page.tsx`
- `src/app/player/[name]/timeline/page.tsx`
- `src/app/team/[abbr]/page.tsx`
- `src/app/explore/page.tsx`
- `src/app/compare/page.tsx`

If you need to import from these files, use the expected NEW interfaces (documented below).

---

## Design Specs (Instance A is implementing these — code to match)

### Color Replacement Map
| Old (Dark Mode) | New (Light Mode) | Notes |
|-----------------|------------------|-------|
| bg-dark-base, bg-[#0a0a12] | bg-[#FAFAFA] | Page backgrounds |
| bg-dark-surface, bg-dark-elevated | bg-white | Card/section backgrounds |
| bg-glass-bg, bg-white/[0.06] | bg-white | Card backgrounds |
| border-glass-border, border-white/[0.12] | border-black/[0.06] | Borders |
| text-chrome-light, text-white | text-[#1D1D1F] | Primary text |
| text-chrome-medium, text-white/70 | text-[#6E6E73] | Secondary text |
| text-chrome-dim, text-white/40 | text-[#86868B] | Tertiary text |
| text-accent-orange | text-[#FF6B35] | Orange accent |
| text-accent-blue | text-[#0071E3] | Blue/links |
| text-accent-green | text-[#22C55E] | Positive/success |
| text-accent-red | text-[#EF4444] | Negative/error |
| text-accent-gold | text-[#F59E0B] | Awards/HOF |
| shadow-[0_8px_40px_rgba(0,0,0,0.35)] | shadow-[0_2px_8px_rgba(0,0,0,0.04),0_12px_40px_rgba(0,0,0,0.08)] | Card shadow |
| backdrop-blur-xl | (remove entirely) | No blur on cards |
| rgba(255,255,255,0.06) | (use bg-white) | Card backgrounds |
| rgba(255,255,255,0.12) | rgba(0,0,0,0.06) | Borders |

### Typography Classes
| Use | Class |
|-----|-------|
| Page titles | `font-display font-extrabold text-4xl md:text-5xl text-[#1D1D1F]` |
| Section titles | `font-display font-bold text-2xl text-[#1D1D1F]` |
| Body text | `text-[#1D1D1F]` (primary) or `text-[#6E6E73]` (secondary) |
| Stat numbers | `font-mono text-[#1D1D1F]` |
| Small labels | `text-sm text-[#86868B]` |

`font-display` = Syne (Instance A imports it), `font-mono` = JetBrains Mono

### Court Visualization Colors (Light Mode)
| Element | Old | New |
|---------|-----|-----|
| Court lines | #666 or lighter | #333333 |
| Court paint fill | transparent | #F5F5F7 at 50% opacity |
| Court background | dark | white or transparent |
| Shot made dot | green (dark bg) | #22C55E (vivid green) |
| Shot missed dot | red (dark bg) | #EF4444 (vivid red) |
| Hexbin hot | red/orange | #EF4444 opacity 0.5-1.0 |
| Hexbin warm | gold | #F59E0B opacity 0.5-1.0 |
| Hexbin cold | blue | #3B82F6 opacity 0.5-1.0 |

### Animation Rules
- KEEP all spring animations on data visualizations (shot dots, chart reveals, stat bars)
- KEEP fadeInUp, stagger animations on page load
- KEEP whileHover on interactive cards
- REMOVE all `repeat: Infinity` or `animate-ping` or `animate-pulse` animations
- REMOVE golden shimmer overlays, pulsing glows, floating particles

---

## Task List (Execute In Order)

### Phase 1: Shared Components (do first — pages depend on these)
- [ ] B1. Create branch `ui-overhaul-b`
- [ ] B2. Update `src/components/court/BasketballCourt.tsx`
  - Court lines: stroke="#333333" (darker for white bg)
  - Paint area: fill="#F5F5F7" fillOpacity="0.5"
  - Background: remove any dark fill, use transparent
  - All text labels: fill="#1D1D1F"
- [ ] B3. Update `src/components/court/ShotChart.tsx`
  - Made dots: fill="#22C55E" (vivid green)
  - Missed dots: fill="#EF4444" (vivid red)
  - Opacity: 0.85 (higher for light bg visibility)
  - KEEP all spring animations exactly as-is
  - Heatmap colors: adjust for light bg contrast
- [ ] B4. Update `src/components/court/HotZoneChart.tsx`
  - Hexbin colors: more vivid for white bg
  - Opacity range: 0.5 to 1.0 (higher minimum)
  - Labels: fill="#1D1D1F"
  - Zone labels: darker text
- [ ] B5. Update `src/components/court/Court3DWrapper.tsx`
  - Floor reflection: remove or very subtle (#F5F5F7 at 10% opacity)
  - REMOVE pulsing glow rings (make static or remove)
  - Adjust perspective colors for light bg
- [ ] B6. Update `src/components/matchup/MatchupHero.tsx`
  - Light background, dark text
  - VS badge: STATIC — remove any infinite boxShadow or scale animation
  - Numbers: add font-mono class for JetBrains Mono
  - Team colors: keep but slightly desaturate for light mode
- [ ] B7. Update `src/components/matchup/MatchupStatBar.tsx`
  - Bars on white bg: softer fill colors (pastel, not neon)
  - Remove glow/shadow effects on bars
  - Numbers: font-mono class
  - Winner indicator: subtle, not flashy
- [ ] B8. Update `src/components/matchup/MatchupSearch.tsx` (if exists)
  - White bg inputs, subtle borders
  - Light mode dropdown
- [ ] B9. Update `src/components/film/ClipCard.tsx`
  - Card: bg-white, border border-black/[0.06], subtle shadow
  - Thumbnail placeholder: bg-[#F5F5F7] with play type text large + subtle court lines SVG pattern
  - Duration badge: bg-[#1D1D1F] text-white (dark for contrast on white card)
  - Tags: outlined pills
- [ ] B10. Update `src/components/film/ClipPlayer.tsx`
  - Controls: light themed (white/gray bg)
  - Progress bar: gray track, orange fill
  - Buttons: dark icons on light bg
- [ ] B11. Update any chart components in `src/components/charts/` — light backgrounds, darker grid lines, dark text labels
- [ ] B12. Update `src/components/timeline/MilestoneCard.tsx`
  - REMOVE floating star particle animations (the 4 motion.div decorations)
  - Light mode colors
- [ ] **BUILD CHECK**: `npx next build` — fix any errors

### Phase 2: Feature Pages
- [ ] B13. Update `src/app/shot-lab/page.tsx`
  - Page title: `<h1 className="font-display font-extrabold text-4xl md:text-5xl text-[#1D1D1F]">Shot Lab</h1>`
  - White background, white cards
  - Controls: clean segmented controls (white bg + subtle borders, active = filled)
  - Zone stats: white cards with left colored border
  - Replace all dark mode classes per replacement map
- [ ] B14. Update `src/app/zones/page.tsx`
  - Light mode: white cards, dark text
  - Tables: alternating white / #F5F5F7 rows
  - Page title in Syne
- [ ] B15. Update `src/app/zones/[player]/page.tsx`
  - 3D court: adjusted for light
  - Shot Signature: white card, subtle border
  - Trend charts: light bg, subtle grid
  - Similar players: white cards
- [ ] B16. Update `src/app/matchup/page.tsx`
  - Rivalry cards: white bg, subtle shadows
  - Search: white inputs
  - Page title in Syne
- [ ] B17. Update `src/app/matchup/[slug]/page.tsx`
  - Hero: light bg, dark text
  - Stat bars: clean on white
  - REMOVE golden shimmer overlay on best performances
  - Game log: alternating rows
  - Numbers: font-mono
- [ ] B18. Update `src/app/film/page.tsx` — light mode
- [ ] B19. Update `src/app/film/[id]/page.tsx` — light mode
- [ ] B20. Update `src/app/film/upload/page.tsx`
  - Upload zone: dashed border #D1D5DB, white bg, hover → #F5F5F7
  - Clean form design
- [ ] **BUILD CHECK**: `npx next build`

### Phase 3: Remaining Pages
- [ ] B21. Update `src/app/play/page.tsx`
  - White cards, outlined answer buttons (fill on select)
  - Correct = green, Incorrect = red
  - Score: font-mono large
  - Page title in Syne
- [ ] B22. Update `src/app/stories/page.tsx`
  - Editorial: story titles in Syne
  - White cards, subtle shadows
  - Clean tables
- [ ] B23. Update `src/app/lineup/page.tsx`
  - White cards for lineup slots
  - Grades: colored TEXT not bg (A=green, B=blue, C=gold, D=orange, F=red)
  - Thin progress bars on #F5F5F7 bg
- [ ] B24. Update `src/app/ask/page.tsx`
  - User messages: bg-[#F5F5F7] (right aligned)
  - Assistant: bg-white with border (left aligned)
  - Quick actions: outlined pill buttons
  - Data tables: clean, light
- [ ] **BUILD CHECK**: `npx next build`
- [ ] B25. Commit all work: `git add -A && git commit -m "feat: convert all feature pages and viz components to light mode"`

---

## Cron Job: Self-Check Every 30 Minutes

After completing Phase 1, set up this cron job:

```bash
cat > /tmp/instance-b-check.sh << 'SCRIPT'
#!/bin/bash
cd ~/OneDrive/Desktop/basketballintelligence
git checkout ui-overhaul-b 2>/dev/null

echo "=== Instance B Self-Check $(date) ==="

# Build check
echo "--- Build ---"
npx next build 2>&1 | tail -5

# Check for dark mode remnants in files I own
echo "--- Dark Mode Remnants in My Files ---"
MY_FILES="src/app/shot-lab src/app/zones src/app/matchup src/app/film src/app/play src/app/stories src/app/lineup src/app/ask src/components/court src/components/matchup src/components/film src/components/charts src/components/timeline"
for pattern in "bg-dark-" "text-chrome-" "bg-glass-" "border-glass-" "rgba(255,255,255"; do
  count=$(grep -rl "$pattern" $MY_FILES 2>/dev/null | wc -l)
  [ "$count" -gt 0 ] && echo "  FOUND $count files still using '$pattern'" || echo "  OK: no '$pattern'"
done

# Check animation cleanup
echo "--- Infinite Animations ---"
count=$(grep -rl "repeat.*Infinity\|animate-ping\|animate-pulse" $MY_FILES 2>/dev/null | wc -l)
[ "$count" -gt 0 ] && echo "  FOUND $count files with infinite animations" || echo "  OK: no infinite animations"

# Check font classes
echo "--- Font Usage ---"
grep -rl "font-display" src/app/shot-lab src/app/zones src/app/matchup src/app/film src/app/play src/app/stories src/app/lineup src/app/ask 2>/dev/null | wc -l | xargs -I{} echo "  {} pages use font-display (Syne)"
grep -rl "font-mono" src/app/ src/components/ 2>/dev/null | wc -l | xargs -I{} echo "  {} files use font-mono (JetBrains)"

echo "=== Check Complete ==="
SCRIPT
chmod +x /tmp/instance-b-check.sh
```

Schedule it:
```bash
for i in $(seq 1 6); do
  (sleep $((i * 1800)) && /tmp/instance-b-check.sh >> /tmp/instance-b-log.txt 2>&1) &
done
echo "Scheduled 6 self-checks over 3 hours"
```

---

## Rules
1. DO NOT touch any file owned by Instance A (listed above).
2. Use the color/class replacement map exactly — no inventing new colors.
3. Every page title must use: `font-display font-extrabold text-4xl md:text-5xl text-[#1D1D1F]`
4. Every numeric display must use: `font-mono`
5. KEEP all spring animations on data. REMOVE all infinite animations.
6. Court SVG lines must be #333333 for contrast on white.
7. Shot dots must be #22C55E (made) and #EF4444 (missed).
8. Build must pass after every phase.
9. When using GlassCard, just pass the same props — Instance A is making it render white cards.
