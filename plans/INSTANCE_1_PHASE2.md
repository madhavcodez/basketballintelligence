# INSTANCE 1 — PHASE 2: UI Components + Page Integration + Polish

## What You Already Built (Phase 1 DONE)
- `src/lib/playoffs-db.ts` (618 lines) — All playoff-aware query functions
- `src/lib/season-context.tsx` (64 lines) — React context provider
- 14 v2 API routes under `src/app/api/v2/`

## What's Still Missing (BUILD ALL OF THIS)

### Priority 1: SeasonTypeToggle Component (CRITICAL — the whole feature's UX depends on this)

Create `src/components/ui/SeasonTypeToggle.tsx`:

- Horizontal pill with 3 segments: "Regular" | "Playoffs" | "Combined"
- Active segment has sliding backdrop using Framer Motion `layoutId` animation
- Inactive segments are dim chrome text (`text-chrome-dim`)
- Active segment glows with accent color:
  - Regular = accentBlue (#4DA6FF)
  - Playoffs = accentOrange (#FF6B35)
  - Combined = accentViolet (#A78BFA)
- Glass background: `bg-glass-bg backdrop-blur-xl border border-glass-border rounded-full`
- Spring animation on switch: `{ type: 'spring', stiffness: 350, damping: 30 }`
- Small pulsing "LIVE" dot next to Playoffs when `playoffAvailable` is true
- Disabled/greyed state with tooltip when playoff data not yet loaded
- `compact` prop for smaller inline version (<640px)

```typescript
interface SeasonTypeToggleProps {
  readonly value: SeasonType;
  readonly onChange: (type: SeasonType) => void;
  readonly playoffAvailable?: boolean;
  readonly compact?: boolean;
}
```

Must use design tokens from `@/lib/design-tokens`. Must use `'use client'`. Must use Framer Motion for the sliding indicator. Match the existing GlassCard/MetricChip patterns.

### Priority 2: SeasonTypeBadge Component

Create `src/components/ui/SeasonTypeBadge.tsx`:

- Small inline badge showing current mode
- Use Lucide icons: Trophy for playoffs, BarChart3 for regular, Layers for combined
- Glass pill styling matching MetricChip pattern
- Color-coded: blue for regular, orange for playoffs, violet for combined
- Animated presence (fade in/out on change)

### Priority 3: AppShell Integration

Modify `src/components/layout/AppShell.tsx`:
- Import and wrap children with `<SeasonTypeProvider>` from `@/lib/season-context`
- Add `SeasonTypeToggle` in a fixed position at top-right of the content area
- The toggle should be: `fixed top-4 right-4 z-30` with backdrop blur
- On mobile (<640px), use the compact variant
- Toggle should NOT overlap with page content — add `pt-16` to main content area when toggle is visible

### Priority 4: Upgrade Existing Pages to Use Season Type

For EACH of these pages, add season type awareness:

**`src/app/page.tsx` (Explore/Home)**:
- Import `useSeasonType()` hook
- Replace API calls with v2 versions: `/api/v2/explore?seasonType=${seasonType}`
- Add loading shimmer during season-type switch
- Show SeasonTypeBadge in the hero section

**`src/app/player/[name]/page.tsx` (Player Lab)**:
- Switch to v2 API for stats + shots
- Show "Playoff Averages" card alongside career averages when in playoffs mode
- Shot chart respects season type filter

**`src/app/compare/page.tsx`**:
- Comparison bars reflect season type
- Add "2024 Playoffs" option in season selector

**`src/app/play/page.tsx` (Quiz)**:
- Add "Playoff Edition" quiz variant when in playoffs mode
- Different player pool

**`src/app/lineup/page.tsx`**:
- Filter lineups by season type via v2 API

### Priority 5: Transition Animation System

When season type changes globally:
1. Current data fades out: `{ opacity: 0, y: -8 }` over 200ms
2. Loading shimmer appears for 100ms
3. New data fades in: `{ opacity: 1, y: 0 }` with spring(120, 14)

Create a reusable wrapper component or hook: `useSeasonTransition()` that returns `{ isTransitioning, transitionProps }`.

### Priority 6: Persist + URL Sync

- Save season type to localStorage, restore on mount
- Support `?seasonType=playoffs` URL query param
- When URL param present, it overrides localStorage
- Update URL when toggle changes (use `useSearchParams`)

### Priority 7: Ingest Script

Create `src/scripts/ingest-playoffs.ts`:
- Check `~/basketball_data/` for playoff CSV files
- Create `player_stats_playoffs_pergame` and `player_stats_playoffs_advanced` tables if missing
- Parse CSVs and INSERT into tables
- Add indexes matching existing patterns
- Run with: `npx tsx src/scripts/ingest-playoffs.ts`

### Polish Checklist
- [ ] Toggle animates smoothly between all 3 states
- [ ] Disabled state looks correct when no playoff data
- [ ] Mobile compact variant works at 375px
- [ ] Season type persists across navigation
- [ ] No layout shift when toggle appears
- [ ] All v2 APIs return correct data for each season type
- [ ] Existing pages refresh data when toggle switches
- [ ] Zero `any` types, all props `readonly`
- [ ] No console.log in production
- [ ] Full `npm run build` passes

## IMPORTANT CONSTRAINTS
- Use existing UI components: GlassCard, MetricChip, SectionHeader, SkeletonLoader, SearchBar
- Use design tokens from `@/lib/design-tokens` — never hardcode colors
- Use Framer Motion `motionPresets` from design-tokens where possible
- Match existing code patterns: readonly props, 'use client', clsx for class merging
- Do NOT touch files owned by other instances (zones/*, matchup/*, film/*, court/HotZone*, etc.)
