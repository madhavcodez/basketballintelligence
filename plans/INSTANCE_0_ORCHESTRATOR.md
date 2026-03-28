# INSTANCE 0: Orchestrator / Monitor / Integrator

## Role

You are the overseer of 4 autonomous build agents working simultaneously on the Basketball Intelligence platform. You have three jobs across the night:

1. **MONITOR** (ongoing) — Health-check each instance's output, catch conflicts, unblock stuck agents
2. **INTEGRATE** (hour 4-5) — Merge all 4 feature branches into a unified codebase, resolve conflicts
3. **POLISH** (hour 5-6) — Final UI pass to make everything feel like one cohesive Apple-quality product

## The 4 Instances You Oversee

| ID | Feature | Key Files | Status Indicator |
|----|---------|-----------|------------------|
| 1 | Playoff Toggle | `src/lib/playoffs-db.ts`, `src/lib/season-context.tsx`, `src/app/api/v2/**` | Toggle visible on pages |
| 2 | Hot Zones V2 | `src/app/zones/**`, `src/components/court/HotZoneChart.tsx`, `src/lib/zone-engine.ts` | `/zones` page renders |
| 3 | Head-to-Head + Timeline | `src/app/matchup/**`, `src/app/player/[name]/timeline/**`, `src/lib/matchup-engine.ts` | `/matchup` page renders |
| 4 | Video ML + Film Browser | `video-ml/**`, `src/app/film/**`, `src/lib/film-db.ts` | `/film` page renders |

---

## PHASE 1: MONITOR (Hours 0-4, check every 30-45 min)

### Health Check Protocol

Run this check cycle periodically:

#### Step 1: Build check
```bash
cd /c/Users/madha/OneDrive/Desktop/basketballintelligence
npm run build 2>&1 | tail -40
```
If build fails:
- Read the error
- Identify which instance's files caused it
- Fix it yourself if it's a simple import/type issue
- If it's a deeper architectural problem, note it for the integration phase

#### Step 2: File conflict scan
```bash
# Check no instance overwrote another's files
git status
git diff --name-only
```
Cross-reference changed files against the ownership map in OVERNIGHT_COORDINATOR.md. If an instance touched a file it shouldn't have, revert that specific change.

#### Step 3: Check each feature surface exists
```bash
# Instance 1: Season context exists
ls src/lib/season-context.tsx src/lib/playoffs-db.ts 2>/dev/null

# Instance 2: Zones page exists
ls src/app/zones/page.tsx src/components/court/HotZoneChart.tsx src/lib/zone-engine.ts 2>/dev/null

# Instance 3: Matchup + timeline exist
ls src/app/matchup/page.tsx src/lib/matchup-engine.ts src/lib/timeline-engine.ts 2>/dev/null

# Instance 4: Film page + pipeline exist
ls src/app/film/page.tsx src/lib/film-db.ts video-ml/config.py 2>/dev/null
```

#### Step 4: Quick API smoke test
If dev server is running (or start it):
```bash
# Existing routes still work
curl -s http://localhost:3000/api/players/search?q=LeBron | head -c 200

# Instance 2 routes
curl -s http://localhost:3000/api/zones/player/Stephen%20Curry 2>/dev/null | head -c 200

# Instance 3 routes
curl -s http://localhost:3000/api/matchup?p1=LeBron+James\&p2=Stephen+Curry 2>/dev/null | head -c 200

# Instance 4 routes
curl -s http://localhost:3000/api/film/clips 2>/dev/null | head -c 200
```

#### Step 5: Data scraper check
```bash
ls ~/basketball_data/ 2>/dev/null | head -20
ls ~/Downloads/sportsdata/ 2>/dev/null | wc -l
```
If new playoff CSVs appeared and Instance 1 hasn't ingested them, note it.

### What to fix immediately:
- Build failures (any instance)
- Import errors (wrong paths, missing exports)
- Type errors (mismatched interfaces between instances)
- File ownership violations

### What to note for integration phase:
- Missing cross-links (pages that should link to each other but don't)
- Inconsistent styling (one instance used different spacing/colors)
- Navigation entries not yet added
- Shared types that should be unified

---

## PHASE 2: INTEGRATE (Hours 4-5)

This is the critical merge phase. All 4 instances have been building in parallel. Now make them one product.

### Step 1: Navigation Update

Modify `src/components/layout/AppShell.tsx` to add ALL new pages to the nav:

```typescript
const TABS: readonly TabDef[] = [
  { id: 'explore', label: 'Explore', icon: Compass, href: '/' },
  { id: 'players', label: 'Players', icon: Users, href: '/player/LeBron James' },
  { id: 'compare', label: 'Compare', icon: GitCompareArrows, href: '/compare' },
  { id: 'zones', label: 'Zones', icon: Flame, href: '/zones' },           // NEW — Instance 2
  { id: 'shots', label: 'Shots', icon: Target, href: '/shot-lab' },
  { id: 'matchup', label: 'H2H', icon: Swords, href: '/matchup' },        // NEW — Instance 3
  { id: 'teams', label: 'Teams', icon: Shield, href: '/team/LAL' },
  { id: 'lineups', label: 'Lineups', icon: LayoutGrid, href: '/lineup' },
  { id: 'play', label: 'Play', icon: Gamepad2, href: '/play' },
  { id: 'film', label: 'Film', icon: Film, href: '/film' },               // NEW — Instance 4
  { id: 'ask', label: 'Agent', icon: Bot, href: '/ask' },
];
```

Note: 11 tabs is a lot for mobile. Consider:
- Desktop: show all 11 in the bottom bar (they already scroll horizontally)
- Mobile: show top 7, put rest in a "More" overflow menu
- OR: group into categories (Explore, Analyze, Watch, Play)

Import new icons from lucide-react: `Flame`, `Swords`, `Film`

### Step 2: Season Type Toggle Integration

If Instance 1 created the SeasonTypeProvider and toggle:
1. Verify it wraps the entire app in layout.tsx or AppShell
2. Verify all pages that should respect it actually do
3. Add season type awareness to Instance 2's zones page (if not already)
4. Add season type awareness to Instance 3's matchup page (if not already)
5. Instance 4's film page doesn't need season type

### Step 3: Cross-Linking

Wire the features together so the platform feels like ONE product:

**Player Lab → Timeline:**
Add a "View Career Timeline →" link on the player page. Read `src/app/player/[name]/page.tsx` and add a Link component near the bottom.

**Player Lab → Hot Zones:**
Add a "View Hot Zones →" link near the shot chart section.

**Player Lab → Matchups:**
Add a "See Rivalries →" link that goes to `/matchup` with the player pre-selected.

**Shot Lab → Hot Zones:**
Cross-link between the existing Shot Lab and the new Zones page.

**Compare → Matchup:**
The compare page shows stat comparison. Add "See their actual games →" link to matchup page.

**Home Page → New Features:**
Update the Explore page's quick links grid to include Zones, Matchup, and Film.

**Matchup → Timeline:**
From matchup page, link to each player's timeline.

### Step 4: Shared Type Unification

Check if multiple instances defined the same types differently. Common candidates:
- Player search result type
- Season type enum
- Shot zone types
- Game stats type

Create `src/lib/shared-types.ts` if needed to hold types used across features.

### Step 5: Verify All Routes

Run a full route check:
```bash
# Start dev server
npm run dev &

# Test every major page
for path in "/" "/explore" "/player/LeBron%20James" "/compare" "/shot-lab" "/zones" "/matchup" "/matchup/lebron-james-vs-stephen-curry" "/player/LeBron%20James/timeline" "/team/LAL" "/stories" "/play" "/lineup" "/film" "/ask"; do
  status=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3000${path}")
  echo "${path} → ${status}"
done
```

Every route should return 200. Fix any 404s or 500s.

### Step 6: Full Build

```bash
npm run build
```

Must pass with zero errors. Fix any issues.

---

## PHASE 3: POLISH (Hours 5-6)

This is where you turn 4 separately-built features into one cohesive premium product.

### The Apple Standard

What makes apple.com feel like apple.com:
1. **Consistency** — Every element follows the same spacing, typography, and animation rules
2. **Breathing room** — Generous whitespace, content doesn't feel crammed
3. **Hierarchy** — Clear visual hierarchy: one hero element, supporting elements subordinate
4. **Motion** — Smooth, purposeful animations that feel like physics, not effects
5. **Typography** — Large, confident headings. Subtle, readable body text
6. **Color restraint** — Mostly monochrome with strategic accent color usage
7. **Details** — Subtle gradients, glass effects, shadows that feel real

### Consistency Audit

Read each new page and check against this checklist:

#### Spacing
- [ ] Page padding: consistent across all pages (use existing pages as reference)
- [ ] Card padding: all GlassCards use the same internal padding
- [ ] Section spacing: consistent gap between sections (typically 48-64px)
- [ ] Element spacing: consistent gaps between elements within sections

#### Typography
- [ ] Page titles: same font size + weight across all new pages
- [ ] Section headers: same treatment (use SectionHeader component)
- [ ] Body text: same size and color (chromeMedium for secondary, chromeLight for primary)
- [ ] Stat numbers: same font (mono for numbers, body for labels)
- [ ] No orphaned text styles (custom font sizes that don't match design tokens)

#### Colors
- [ ] Accent colors used consistently:
  - Orange (#FF6B35) for primary actions and active states
  - Blue (#4DA6FF) for informational/links
  - Green (#34D399) for positive/success
  - Red (#F87171) for negative/loss
  - Gold (#FBBF24) for awards/premium
  - Violet (#A78BFA) for advanced/special
- [ ] Glass backgrounds: all use `bg-glass-bg backdrop-blur-xl border border-glass-border`
- [ ] No hardcoded colors outside design tokens

#### Animation
- [ ] Page enter: all pages use the same fade-in-up animation
- [ ] Cards: consistent hover behavior (y: -2, spring 300/20)
- [ ] Stagger: consistent stagger timing for lists (0.06s per item)
- [ ] Transitions: consistent duration (fast: 150ms, normal: 250ms)
- [ ] No jarring or too-fast animations
- [ ] No animation on elements that don't need it

#### Components
- [ ] All cards use GlassCard (not custom div with similar styling)
- [ ] All stat displays use MetricChip where appropriate
- [ ] All section titles use SectionHeader
- [ ] All search inputs follow the same pattern
- [ ] All loading states use SkeletonLoader
- [ ] All empty states use EmptyState component

### Specific Polish Items

#### Hot Zones Page (Instance 2)
- Verify hexbin colors match the design token palette
- Ensure zone labels have proper text shadow for readability on colored fills
- Check that the court SVG scales properly on mobile
- Verify the color legend is clear and well-positioned

#### Matchup Page (Instance 3)
- Verify the hero section has proper visual weight (large, dramatic)
- Check stat bar animations are smooth and staggered
- Ensure the game log table is scannable (alternating subtle row tints)
- Verify player names are properly capitalized

#### Timeline (Instance 3)
- Verify scroll-triggered animations don't fire too early/late
- Check that major events (awards, trades) visually stand out from season nodes
- Ensure the timeline line has a proper gradient
- Verify mobile layout works (single-column)

#### Film Browser (Instance 4)
- Verify clip cards have proper thumbnail aspect ratios
- Check that the upload zone has clear visual feedback
- Ensure the video player controls match the glass morphism design
- Verify empty state when no clips exist

### Global Polish

#### Loading Experience
- Every page should show a skeleton immediately (no blank white flash)
- Skeleton should match the layout of the actual content
- Transition from skeleton to content should be smooth (fade, not pop)

#### Error States
- Network errors: "Unable to load data. Check your connection."
- Empty data: Contextual message per feature
- 404: "This page doesn't exist" with link back to explore

#### Mobile Responsiveness
Test every new page at these breakpoints:
- 375px (iPhone SE)
- 390px (iPhone 14)
- 768px (iPad)
- 1024px (iPad landscape)
- 1440px (Desktop)

Common mobile issues to fix:
- Text overflow on small screens
- Cards too wide (should be full-width on mobile)
- Charts/courts too small to be useful
- Touch targets too small (<44px)
- Bottom nav overlapping content

#### Performance
- No unnecessary re-renders (check for missing useMemo/useCallback)
- Large data fetches should have proper loading states
- Images/thumbnails should have explicit width/height (no CLS)
- Heavy components (d3, recharts) should be lazy loaded

### Final Verification

After all polish is done:

```bash
# Clean build
rm -rf .next
npm run build

# Verify no warnings
npm run lint

# Start production server and test
npm start
```

Visit every page. Every transition should feel smooth. Every element should feel intentional. No placeholder text. No broken images. No console errors.

---

## Decision Authority

As the orchestrator, you have authority to:

1. **Fix build errors** from any instance (you own the build)
2. **Modify AppShell.tsx** to add navigation entries
3. **Add cross-links** between features (modify any page to add Link components)
4. **Adjust styling** on any component to match the design system
5. **Create shared utilities** (`src/lib/shared-types.ts`) if instances duplicated types
6. **Revert changes** if an instance broke something it shouldn't have touched

You do NOT have authority to:
1. Delete or rewrite major features (that's the owning instance's job)
2. Change the database schema
3. Change API response formats
4. Remove functionality to fix a bug (fix the bug instead)

---

## Emergency Protocols

### Build completely broken
1. `git stash` to save current state
2. Identify which file(s) cause the error
3. Fix the minimal change needed
4. `git stash pop` to restore

### Two instances modified the same file
1. `git diff` the file
2. Determine which instance's changes are correct
3. Manually merge, keeping both sets of changes
4. Add a comment marking the merge point

### Instance produced garbage output
1. Read the plan file for that instance
2. Assess what was implemented vs what was planned
3. Implement the critical missing pieces yourself
4. Focus on making the page render with real data, skip edge cases

### Data not loading
1. Check `data/basketball.db` exists and is readable
2. Check for SQLite lock issues (only one writer at a time)
3. Verify the query returns data: `sqlite3 data/basketball.db "SELECT COUNT(*) FROM players"`
4. Check for film.db creation issues (Instance 4)

---

## Success Criteria

When you're done, the platform should:
1. Build with zero errors
2. Have 13+ pages all accessible from navigation
3. Feel like ONE product, not 4 bolted-together features
4. Match the Apple/Netflix premium dark aesthetic throughout
5. Work on mobile
6. Have smooth transitions between every page
7. Cross-link between features (player → timeline, compare → matchup, etc.)
8. Handle empty/loading/error states gracefully
9. Have no console errors in the browser
10. Be demo-ready — you could show this to someone and they'd be impressed
