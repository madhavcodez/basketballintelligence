# Instance 2 Prompt — Paste This Into a New Claude Code Session

```
/effort max

You are Instance 2 (Feature Engineer) of a 4-instance overnight build for the Basketball Intelligence app at C:\Users\madha\OneDrive\Desktop\basketballintelligence.

## Your Mission
Build 4 new features (Smarter Ask the Data, Player Similarity Engine, Contextual Insights, Playoff Mode Toggle) and write E2E smoke tests for all surfaces.

## Read the Plan First
Read `plans/INSTANCE_2_FEATURES_FRONTEND.md` for your complete task breakdown.

## File Ownership (CRITICAL)
You OWN: src/ (all TypeScript/TSX files), src/lib/, src/components/, src/app/
DO NOT TOUCH: scripts/ (Instance 1), video-ml/ (Instance 3), data/basketball.db directly (Instance 1 is ingesting), scripts/integration-test.sh (Instance 3)

## Execution Order
1. Read the plan file thoroughly
2. Read key existing files first:
   - src/lib/db.ts (V1 queries)
   - src/lib/playoffs-db.ts (V2 queries with SeasonType)
   - src/lib/season-context.tsx (SeasonTypeProvider)
   - src/app/api/agentic/chat/route.ts (Ask the Data backend)
   - src/app/(pages)/ask/page.tsx (Ask the Data UI)
   - src/components/layout/AppShell.tsx (root layout)
3. Feature 1: Smarter Ask the Data — expand from 8 to 20+ intents
4. Feature 2: Player Similarity Engine — new similarity-engine.ts + API + UI
5. Feature 3: Contextual Insights — new insights-engine.ts + InsightCard + page integration
6. Feature 4: Playoff Mode Toggle — visual toggle in AppShell + wire all surfaces
7. E2E smoke tests for all pages and API endpoints
8. npm run build — must pass with 0 errors
9. npm run lint — fix any issues

## Key Reminders
- Instance 1 is simultaneously ingesting 18 new tables. Use tableExists() checks when querying new tables (all_nba_teams, contracts, draft_combine, etc.) — if the table doesn't exist yet, gracefully degrade.
- All NL->SQL queries MUST be parameterized. No string concatenation for user input.
- Match existing UI design: dark glass-morphism, Tailwind tokens (bg-base, text-primary, accent-blue), Framer Motion animations.
- The SeasonTypeProvider already exists with keyboard shortcuts 1/2/3 — add a VISUAL toggle component.
- playoffs-db.ts already has V2 query functions. Leverage them.
- Keep files small (<800 lines). Extract utilities.
- Run npm run build frequently to catch TypeScript errors early.

## Verification
When complete:
- npm run build (0 errors)
- npm run dev → visit /ask (shows new intent categories), /player/LeBron%20James (shows similar players + insights), toggle playoff mode in header
- All 10 surfaces load without console errors
```
