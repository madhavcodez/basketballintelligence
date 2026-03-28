# Overnight Build Coordinator

## 4 Instances, Running Simultaneously

| Instance | Plan File | Feature | Owner |
|----------|-----------|---------|-------|
| 1 | `INSTANCE_1_PLAYOFF_FRAMEWORK.md` | Global Season-Type Toggle | Playoff toggle, v2 APIs, context provider |
| 2 | `INSTANCE_2_HOT_ZONES_V2.md` | Hot Zones Heatmap V2 | Zone viz, heatmap, shot profiles |
| 3 | `INSTANCE_3_HEAD_TO_HEAD.md` | Matchups + Timeline | Head-to-head page, career timeline |
| 4 | `INSTANCE_4_VIDEO_ML.md` | Video Intelligence | Python pipeline, Film Browser UI |

## File Conflict Prevention

### CRITICAL RULE: Each instance ONLY touches its own files.

**Instance 1 creates:**
- `src/lib/playoffs-db.ts`, `src/lib/season-context.tsx`
- `src/components/ui/SeasonTypeToggle.tsx`, `SeasonTypeBadge.tsx`
- `src/app/api/v2/**`
- `src/scripts/ingest-playoffs.ts`
- MAY modify: `src/lib/db.ts` (append only), `src/components/layout/AppShell.tsx`

**Instance 2 creates:**
- `src/app/zones/**`
- `src/components/court/HotZoneChart.tsx`, `ZoneOverlay.tsx`, `ZoneTooltip.tsx`, `MiniCourt.tsx`, `CourtLegend.tsx`
- `src/components/cards/ShotProfileCard.tsx`, `ZoneComparisonCard.tsx`, `ShotSignatureCard.tsx`
- `src/app/api/zones/**`
- `src/lib/zone-engine.ts`, `src/lib/shot-constants.ts`

**Instance 3 creates:**
- `src/app/matchup/**`
- `src/app/player/[name]/timeline/**`
- `src/components/matchup/**`
- `src/components/timeline/**`
- `src/app/api/matchup/**`, `src/app/api/timeline/**`
- `src/lib/matchup-engine.ts`, `src/lib/timeline-engine.ts`

**Instance 4 creates:**
- `video-ml/**` (entire directory)
- `src/app/film/**`
- `src/components/film/**`
- `src/app/api/film/**`
- `src/lib/film-db.ts`

### Shared resources (read-only access for all):
- `src/lib/db.ts` — Import `getDb()` only
- `src/lib/design-tokens.ts` — Import tokens only
- `src/components/ui/*` — Import existing components
- `data/basketball.db` — Read-only queries

## Data Scraping Integration

Scraped data arriving in `~/basketball_data/` or `~/Downloads/sportsdata/`.

- Instance 1 should check periodically for playoff CSV files
- Instances 2, 3, 4 use existing data (shots, game logs, etc.) — no waiting needed
- If new data appears, Instance 1 runs ingestion; others benefit automatically

## Build Verification

All instances should run `npm run build` after completing each phase.
If build fails, fix it before proceeding.

## Integration Points (Post-Overnight)

After all 4 instances complete:
1. Add Film and Matchup tabs to AppShell navigation
2. Wire season-type toggle into zones, matchup, and film pages
3. Cross-link between features (player page → timeline, shot chart → zones, etc.)
4. Unified search across all features
