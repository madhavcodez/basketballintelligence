# Instance 2: Feature Engineering & Frontend

**Duration:** 6 hours | **Owner:** All files under `src/`, TypeScript/TSX files

## DO NOT TOUCH
- `scripts/` directory (owned by Instance 1)
- `video-ml/` directory (owned by Instance 3)
- `data/basketball.db` directly (owned by Instance 1)
- `scripts/integration-test.sh` (owned by Instance 3)

---

## Mission

Build 4 new features across the frontend + API + database query layers, then write E2E smoke tests for all surfaces. The app should feel significantly smarter and more interactive by morning.

## Key Existing Files to Understand First

Read these before coding:
- `src/lib/db.ts` — V1 query functions (~700 lines)
- `src/lib/playoffs-db.ts` — V2 queries with SeasonType support (~626 lines)
- `src/lib/season-context.tsx` — SeasonTypeProvider, URL param + localStorage
- `src/app/api/agentic/chat/route.ts` — Current Ask the Data NL->SQL
- `src/app/(pages)/ask/page.tsx` — Ask the Data UI
- `src/app/(pages)/player/[name]/page.tsx` — Player profile page
- `src/app/(pages)/compare/page.tsx` — Compare page
- `src/components/layout/AppShell.tsx` — Root layout with navigation

---

## Feature 1: Smarter "Ask the Data" (0:30 - 1:30)

### Current State
- 8 intents: top scorers, compare players, best shooters, team stats, player stats, standings, leaders, draft
- Intent detection via keyword matching in route.ts
- Each intent maps to a parameterized SQL query

### Target: 20+ Intents

Add these new intents with safe parameterized queries:

**Awards queries:**
- "who won MVP in [year]" -> `SELECT * FROM awards WHERE award LIKE '%MVP%' AND season LIKE ?`
- "how many All-Star selections does [player] have" -> query all_star_selections table
- "All-NBA first team [year]" -> query all_nba_teams table
- "DPOY winners" -> query awards table filtered by award type

**Draft queries:**
- "draft picks from [college]" -> `SELECT * FROM draft WHERE College LIKE ? ORDER BY Year DESC`
- "first overall picks" -> `SELECT * FROM draft WHERE Pk = 1 ORDER BY Year DESC`
- "draft combine measurements for [player]" -> query draft_combine table

**Lineup queries:**
- "best lineup for [team]" -> `SELECT * FROM lineups WHERE TEAM_ABBREVIATION = ? ORDER BY PLUS_MINUS DESC LIMIT 5`
- "highest +/- lineup" -> `SELECT * FROM lineups ORDER BY PLUS_MINUS DESC LIMIT 10`

**Tracking stats:**
- "fastest players" -> `SELECT * FROM tracking WHERE measure_type = 'SpeedDistance' ORDER BY ... DESC`
- "best catch and shoot" -> `SELECT * FROM tracking WHERE measure_type = 'CatchShoot' ORDER BY ... DESC`

**Team comparisons:**
- "compare [team1] vs [team2]" -> query team_stats_advanced for both
- "best defensive teams" -> `SELECT * FROM team_stats_advanced ORDER BY DEF_RATING ASC LIMIT 10`
- "team four factors for [team]" -> query team_four_factors table

**Historical/records:**
- "career leaders in [stat]" -> query career_leaders table with stat filter
- "most improved player [year]" -> query awards for MIP
- "player contracts for [team]" -> query contracts table

### Implementation
1. In `src/app/api/agentic/chat/route.ts`:
   - Add new intent patterns to the detection logic
   - Add corresponding SQL template functions
   - Each query must be parameterized (no string concatenation)
2. In `src/lib/db.ts`:
   - Add query functions for new tables (with `tableExists()` checks for graceful fallback)
   - Example: `getAwardsByType(type, season?)`, `getDraftPicksByCollege(college)`, `getTrackingLeaders(measureType, stat)`
3. In `src/app/(pages)/ask/page.tsx`:
   - Update the intent suggestion chips to show new categories
   - Add "Awards", "Draft", "Lineups", "Tracking", "Teams" category buttons

### Safety
- ALL queries use parameterized templates
- Table existence checks before querying new tables (Instance 1 may not have ingested yet)
- LIMIT clauses on all queries (max 50 results)
- Sanitize player/team name inputs

---

## Feature 2: Player Similarity Engine (1:30 - 2:30)

### Create `src/lib/similarity-engine.ts`

```typescript
interface SimilarityProfile {
  playerId: string;
  playerName: string;
  season: string;
  features: Record<string, number>; // normalized stat values
}

interface SimilarityResult {
  player: string;
  season: string;
  similarity: number; // 0-1, higher = more similar
  sharedTraits: string[];
}

// Core function
export function findSimilarPlayers(
  targetPlayer: string,
  targetSeason: string,
  limit: number = 10,
  seasonType: SeasonType = 'regular'
): SimilarityResult[]
```

### Algorithm
1. Gather stats for target player: PER, TS%, USG%, BPM, VORP, 3PAr, AST%, TRB%, STL%, BLK%
2. If tracking data available, add: speed, catch_shoot_fg_pct, drive_freq, pullup_freq
3. Normalize all stats to Z-scores across the league for that season
4. Compute cosine similarity between target and all other players
5. Return top N most similar

### Integration Points
- Enhance `/api/v2/players/[name]/similar/route.ts` (may already exist as stub)
- Add similarity section to `/player/[name]` page
- Show: "Players most similar to [name] in [season]" with stat radar overlay

### UI Component
Create `src/components/cards/SimilarPlayersCard.tsx`:
- Glass card with list of similar players
- Each row: player name, similarity %, shared traits badges
- Click to navigate to that player's profile

---

## Feature 3: Contextual Insights (2:30 - 3:30)

### Create `src/lib/insights-engine.ts`

```typescript
interface Insight {
  type: 'trend' | 'milestone' | 'comparison' | 'didYouKnow';
  title: string;
  body: string;
  stat?: string;
  value?: number;
  context?: string;
}

// Generate insights for a player
export function getPlayerInsights(playerName: string, season?: string): Insight[]

// Generate insights for a team
export function getTeamInsights(teamAbbr: string, season?: string): Insight[]

// Generate insights for the explore/home page
export function getExploreInsights(): Insight[]

// Generate insights for a comparison
export function getCompareInsights(player1: string, player2: string): Insight[]
```

### Insight Types

**Trend Alerts:**
- Compare last 10 games to season average: "LeBron's 3P% has risen 5.2% over his last 10 games"
- Streak detection from game logs: "Stephen Curry has scored 30+ in 5 consecutive games"

**Milestone Proximity:**
- Career leaders comparison: "47 points away from 40,000 career points"
- Season milestones: "On pace for 2,000+ points this season"

**"Did You Know" Cards:**
- Historical comparisons: "Only 4 players in NBA history averaged 27+ PPG at age 40+"
- Anomaly detection: "Jokic's AST% is higher than 90% of point guards this season"

**Rivalry/Comparison Highlights:**
- On the Compare page: "In 15 head-to-head games this season, LeBron outscored KD 12 times"
- Historical context: "This is the 5th time these teams meet in the playoffs"

### API Endpoints
- Add `insights` field to existing player/team/compare API responses
- OR create `/api/v2/insights/[context]` endpoint

### UI Component
Create `src/components/cards/InsightCard.tsx`:
- Small glass card with icon (trend arrow, star, lightbulb, trophy)
- Title + 1-2 line body
- Animate in with Framer Motion (stagger)
- Place on: Home page, Player page sidebar, Compare page, Team page

### Integration
- Home page (`/`): Show 3-4 league-wide insights
- Player page (`/player/[name]`): Show 2-3 player-specific insights
- Compare page (`/compare`): Show 2-3 rivalry insights
- Team page (`/team/[abbr]`): Show 2-3 team insights

---

## Feature 4: Playoff Mode Toggle (3:30 - 4:30)

### Current State (already partially built!)
- `src/lib/season-context.tsx` has `SeasonTypeProvider` with types: `'regular' | 'playoffs' | 'combined'`
- `src/lib/playoffs-db.ts` has V2 query functions that accept `SeasonType`
- Keyboard shortcuts 1/2/3 already switch modes
- V2 API endpoints accept `?seasonType=` param

### What's Missing
1. **Visual toggle** in the header/AppShell (users don't know about keyboard shortcuts)
2. **Some surfaces don't wire seasonType** through to their API calls
3. **Graceful fallback** when playoff tables don't exist yet
4. **Playoff-specific data** from Instance 1 (playoff stats, playoff game logs)

### Implementation

**A. Visual Toggle Component:**
Create `src/components/ui/SeasonTypeToggle.tsx`:
- 3-segment pill: "Regular" | "Playoffs" | "All"
- Uses `useSeasonType()` from season-context
- Glass style matching existing design tokens
- Animate active state with Framer Motion
- Place in AppShell header, right side

**B. Wire all surfaces:**
Audit each page and ensure `seasonType` from context flows to API calls:
- `/explore` (home) — filter top scorers, standings by seasonType
- `/player/[name]` — stats, shots, game logs by seasonType
- `/compare` — comparison stats by seasonType
- `/shot-lab` — shot charts by seasonType
- `/team/[abbr]` — team stats, roster, game logs by seasonType
- `/lineup` — lineups by seasonType (lineups are regular season only — show message)
- `/zones` — zone stats by seasonType
- `/matchup` — matchup history by seasonType
- `/film` — no change needed (video is video)
- `/play` — quiz by seasonType
- `/ask` — pass seasonType to queries

**C. Graceful degradation:**
For each API call, use the pattern from playoffs-db.ts:
```typescript
const table = seasonType === 'playoffs' ? 'player_stats_playoffs_pergame' : 'player_stats_pergame';
if (!tableExists(table)) {
  // Fall back to regular season data with a notice
  return { data: regularSeasonData, notice: "Playoff data not yet available" };
}
```

**D. Visual indicator:**
When in playoff mode, show a subtle badge/indicator:
- "Playoffs" badge in page headers
- Different accent color (gold instead of blue?)
- "No playoff data available for this view" message when data missing

---

## Feature 5: E2E Smoke Tests (4:30 - 5:30)

### Page Smoke Tests
Create `src/__tests__/smoke.test.ts` (or extend existing):

Test all 10 surfaces render without crashing:
```typescript
const PAGES = [
  '/', '/explore', '/compare', '/shot-lab', '/play',
  '/lineup', '/ask', '/matchup', '/film', '/zones',
  '/stories', '/player/LeBron%20James', '/team/LAL',
];

for (const page of PAGES) {
  test(`${page} returns 200`, async () => {
    const res = await fetch(`http://localhost:3000${page}`);
    expect(res.status).toBe(200);
  });
}
```

### API Smoke Tests
Test all endpoints return valid JSON:
```typescript
const API_ENDPOINTS = [
  '/api/v2/explore',
  '/api/v2/players/search?q=lebron',
  '/api/v2/players/LeBron%20James',
  '/api/v2/players/LeBron%20James/shots',
  '/api/v2/players/LeBron%20James/similar',
  '/api/v2/standings',
  '/api/v2/data-status',
  '/api/film/clips',
  '/api/film/tags',
  // ... all 52+ endpoints
];
```

### New Feature Tests
- Ask the Data: test new intents return results
- Similarity: test similar players endpoint returns array
- Insights: test insights endpoint returns insights array
- Playoff toggle: test `?seasonType=playoffs` param works

---

## Build Verification (5:30 - 6:00)

1. `npm run build` — must pass with 0 errors
2. `npm run lint` — fix any ESLint issues
3. Start dev server, manually verify:
   - `/ask` shows new intent categories
   - `/player/LeBron James` shows similar players + insights
   - Playoff toggle visible in header
   - All pages load without errors in console

---

## Key New Files

| File | Purpose |
|------|---------|
| `src/lib/similarity-engine.ts` | Player similarity computation |
| `src/lib/insights-engine.ts` | Contextual insight generation |
| `src/components/cards/SimilarPlayersCard.tsx` | Similar players UI |
| `src/components/cards/InsightCard.tsx` | Insight display card |
| `src/components/ui/SeasonTypeToggle.tsx` | Playoff mode visual toggle |
| `src/__tests__/smoke.test.ts` | E2E smoke tests |

## Key Modified Files

| File | Changes |
|------|---------|
| `src/lib/db.ts` | Add query functions for new tables |
| `src/app/api/agentic/chat/route.ts` | Expand to 20+ intents |
| `src/app/(pages)/ask/page.tsx` | New intent category UI |
| `src/app/(pages)/player/[name]/page.tsx` | Similarity + insights integration |
| `src/app/(pages)/compare/page.tsx` | Comparison insights |
| `src/app/(pages)/page.tsx` | Explore insights |
| `src/components/layout/AppShell.tsx` | Add SeasonTypeToggle |
