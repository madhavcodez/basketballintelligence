# INSTANCE 3: Head-to-Head Matchups + Player Timeline

## Mission

Build two interconnected features: (1) a head-to-head matchup page where fans can see how two players performed in actual games against each other, and (2) a player career timeline that visualizes a player's journey through stats, awards, trades, and milestones. Both are "rabbit hole" features — once users start exploring, they don't stop.

## Time Budget: 6 hours autonomous (Matchup: 3.5h, Timeline: 2.5h)

## File Ownership (NO other instance touches these)

### NEW files this instance creates:
```
# Matchup Feature
src/app/matchup/page.tsx                    — Matchup landing page with search
src/app/matchup/[slug]/page.tsx             — Dynamic matchup page (player1-vs-player2)
src/components/matchup/MatchupHero.tsx       — Dramatic side-by-side hero section
src/components/matchup/MatchupStatBar.tsx    — Animated stat comparison bar
src/components/matchup/MatchupGameLog.tsx    — Game-by-game results table
src/components/matchup/MatchupWinBanner.tsx  — "Player X leads the series" banner
src/components/matchup/MatchupSearch.tsx     — Dual-player search component
src/components/matchup/HeadToHeadCard.tsx    — Compact matchup card for embeds
src/app/api/matchup/route.ts                — Matchup stats + shared game logs
src/app/api/matchup/games/route.ts          — Individual shared games list
src/app/api/matchup/rivals/[name]/route.ts  — Top rivals for a player
src/lib/matchup-engine.ts                   — Matchup calculation logic

# Timeline Feature
src/app/player/[name]/timeline/page.tsx     — Player career timeline page
src/components/timeline/CareerTimeline.tsx   — Main timeline visualization
src/components/timeline/TimelineEvent.tsx    — Individual event card
src/components/timeline/TimelineStat.tsx     — Stat overlay on timeline
src/components/timeline/SeasonNode.tsx       — Season marker with expandable stats
src/components/timeline/MilestoneCard.tsx    — Major milestone callout
src/app/api/timeline/[name]/route.ts        — Timeline events + career data
src/lib/timeline-engine.ts                  — Event generation + milestone detection
```

### Files this instance MUST NOT touch:
```
src/app/shot-lab/*                  — Existing, don't modify
src/app/zones/*                     — Instance 2 owns
src/app/film/*                      — Instance 4 owns
src/lib/db.ts                       — Instance 1 may modify
src/components/layout/AppShell.tsx   — Instance 1 may modify
src/components/court/*              — Instance 2 owns
video-ml/*                          — Instance 4 owns
```

---

# PART A: HEAD-TO-HEAD MATCHUPS

## Architecture

### Data Source
The `player_game_logs` table (452K rows) has:
- PLAYER_NAME, GAME_ID, GAME_DATE, TEAM_ABBREVIATION, MATCHUP (e.g. "LAL vs. BOS"), WL, PTS, REB, AST, STL, BLK, FG_PCT, etc.

To find shared games: JOIN player_game_logs on GAME_ID where both players appear. The MATCHUP column tells us who played who.

**Key insight:** Two players shared a game if they have the same GAME_ID. We don't know who guarded who (that's video ML territory), but we know their stat lines in those games.

### URL Scheme
`/matchup/lebron-james-vs-stephen-curry` — slugified names joined by "-vs-"

Parse slug: split on "-vs-", deslugify each half, find closest player name match.

---

## Phase 1: Matchup Data Layer (Target: 60 min)

### 1a. Create `src/lib/matchup-engine.ts`

```typescript
import { getDb } from './db';

export interface MatchupGame {
  readonly gameId: string;
  readonly gameDate: string;
  readonly p1Team: string;
  readonly p2Team: string;
  readonly p1Won: boolean;
  readonly p1Stats: GameStats;
  readonly p2Stats: GameStats;
}

export interface GameStats {
  readonly pts: number;
  readonly reb: number;
  readonly ast: number;
  readonly stl: number;
  readonly blk: number;
  readonly fgPct: number;
  readonly fg3Pct: number;
  readonly ftPct: number;
  readonly min: number;
  readonly plusMinus: number;
}

export interface MatchupSummary {
  readonly player1: string;
  readonly player2: string;
  readonly totalGames: number;
  readonly p1Wins: number;
  readonly p2Wins: number;
  readonly p1Averages: GameStats;
  readonly p2Averages: GameStats;
  readonly bestP1Game: MatchupGame;
  readonly bestP2Game: MatchupGame;
  readonly lastMeeting: MatchupGame;
  readonly headToHeadRecord: string; // "LeBron leads 42-31"
}

// Core matchup query
export function getSharedGames(player1: string, player2: string): MatchupGame[] {
  const db = getDb();
  // SQL: Find all GAME_IDs where both players appear
  // JOIN player_game_logs p1 ON GAME_ID = p1.GAME_ID AND p1.PLAYER_NAME = ?
  // JOIN player_game_logs p2 ON GAME_ID = p2.GAME_ID AND p2.PLAYER_NAME = ?
  // ORDER BY GAME_DATE DESC
  const rows = db.prepare(`
    SELECT
      p1.GAME_ID as gameId,
      p1.GAME_DATE as gameDate,
      p1.TEAM_ABBREVIATION as p1Team,
      p2.TEAM_ABBREVIATION as p2Team,
      p1.WL as p1WL,
      p1.PTS as p1Pts, p1.REB as p1Reb, p1.AST as p1Ast,
      p1.STL as p1Stl, p1.BLK as p1Blk,
      p1.FG_PCT as p1FgPct, p1.FG3_PCT as p1Fg3Pct, p1.FT_PCT as p1FtPct,
      p1.MIN as p1Min, p1.PLUS_MINUS as p1PlusMinus,
      p2.PTS as p2Pts, p2.REB as p2Reb, p2.AST as p2Ast,
      p2.STL as p2Stl, p2.BLK as p2Blk,
      p2.FG_PCT as p2FgPct, p2.FG3_PCT as p2Fg3Pct, p2.FT_PCT as p2FtPct,
      p2.MIN as p2Min, p2.PLUS_MINUS as p2PlusMinus,
      p2.WL as p2WL
    FROM player_game_logs p1
    JOIN player_game_logs p2 ON p1.GAME_ID = p2.GAME_ID
    WHERE p1.PLAYER_NAME = ? AND p2.PLAYER_NAME = ?
    ORDER BY p1.GAME_DATE DESC
  `).all(player1, player2);
  return rows.map(r => transformRow(r));
}

// Compute matchup summary from shared games
export function getMatchupSummary(player1: string, player2: string): MatchupSummary { ... }

// Find top rivals (players who share the most games)
export function getTopRivals(playerName: string, limit: number = 10): Array<{
  rival: string;
  sharedGames: number;
  wins: number;
  losses: number;
}> {
  const db = getDb();
  // GROUP BY the other player, COUNT shared games, ORDER BY count DESC
  return db.prepare(`
    SELECT p2.PLAYER_NAME as rival, COUNT(*) as sharedGames,
           SUM(CASE WHEN p1.WL = 'W' THEN 1 ELSE 0 END) as wins,
           SUM(CASE WHEN p1.WL = 'L' THEN 1 ELSE 0 END) as losses
    FROM player_game_logs p1
    JOIN player_game_logs p2 ON p1.GAME_ID = p2.GAME_ID
    WHERE p1.PLAYER_NAME = ? AND p2.PLAYER_NAME != ?
      AND p1.TEAM_ABBREVIATION != p2.TEAM_ABBREVIATION
    GROUP BY p2.PLAYER_NAME
    ORDER BY sharedGames DESC
    LIMIT ?
  `).all(playerName, playerName, limit);
}

// Slug helpers
export function toMatchupSlug(p1: string, p2: string): string {
  return `${slugify(p1)}-vs-${slugify(p2)}`;
}

export function fromMatchupSlug(slug: string): { player1: string; player2: string } | null {
  const parts = slug.split('-vs-');
  if (parts.length !== 2) return null;
  return { player1: deslugify(parts[0]), player2: deslugify(parts[1]) };
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

function deslugify(slug: string): string {
  return slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}
```

### Phase 1 Gate
- [ ] `getSharedGames('LeBron James', 'Stephen Curry')` returns games
- [ ] Win/loss record calculates correctly
- [ ] Averages compute correctly
- [ ] `getTopRivals('LeBron James')` returns meaningful results
- [ ] Slug encode/decode round-trips correctly

---

## Phase 2: Matchup API + Page (Target: 90 min)

### 2a. API Routes

**`src/app/api/matchup/route.ts`**
```
GET /api/matchup?p1=LeBron+James&p2=Stephen+Curry
Response: MatchupSummary
```

**`src/app/api/matchup/games/route.ts`**
```
GET /api/matchup/games?p1=LeBron+James&p2=Stephen+Curry&limit=20&offset=0
Response: { games: MatchupGame[], total: number }
```

**`src/app/api/matchup/rivals/[name]/route.ts`**
```
GET /api/matchup/rivals/LeBron+James?limit=10
Response: { player: string, rivals: Array<{ rival, sharedGames, wins, losses }> }
```

### 2b. Matchup Landing Page (`src/app/matchup/page.tsx`)

**Design: Dark cinematic split-screen aesthetic**

```
┌────────────────────────────────────────────────────────┐
│                                                        │
│              HEAD TO HEAD                              │
│     See who really owns the rivalry                    │
│                                                        │
│  ┌──────────────────┐  ⚡  ┌──────────────────┐       │
│  │  [Player Search] │  VS  │  [Player Search] │       │
│  └──────────────────┘      └──────────────────┘       │
│                                                        │
│            [Compare →]                                 │
│                                                        │
├────────────────────────────────────────────────────────┤
│                                                        │
│  Popular Matchups                                      │
│                                                        │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐        │
│  │LeBron      │ │Curry       │ │KD          │        │
│  │  vs        │ │  vs        │ │  vs        │        │
│  │Curry       │ │LeBron      │ │LeBron      │        │
│  │42-31       │ │31-42       │ │28-35       │        │
│  └────────────┘ └────────────┘ └────────────┘        │
│                                                        │
└────────────────────────────────────────────────────────┘
```

**Popular matchups:** Hardcoded list of iconic rivalries:
- LeBron vs Curry, LeBron vs KD, Curry vs KD
- Bird vs Magic, Jordan vs Drexler, Kobe vs Duncan
- Jokic vs Embiid, Luka vs Tatum, Giannis vs Embiid

Each card links to `/matchup/[slug]`.

### 2c. Dynamic Matchup Page (`src/app/matchup/[slug]/page.tsx`)

**This is the showpiece page. Full cinematic matchup breakdown.**

**Section 1: Hero Banner**
```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│   ┌──────────┐           ⚡            ┌──────────┐         │
│   │          │                         │          │         │
│   │  [P1     │    42 - 31              │  [P2     │         │
│   │  Avatar] │   LeBron leads          │  Avatar] │         │
│   │          │                         │          │         │
│   └──────────┘                         └──────────┘         │
│                                                             │
│   LeBron James              Stephen Curry                   │
│   LAL • F • 6'9"           GSW • G • 6'2"                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

Dark gradient from left (player 1 team color) to right (player 2 team color).
Center: big win-loss record. "LeBron leads" or "Series tied" text.

**Section 2: Stat Comparison Bars**
```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  Points Per Game                                        │
│  28.4 ▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░▓▓▓▓▓▓▓▓▓▓▓ 26.1       │
│                                                         │
│  Rebounds                                               │
│  8.2  ▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░▓▓▓▓▓▓ 5.3          │
│                                                         │
│  Assists                                                │
│  7.1  ▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░▓▓▓▓▓▓▓▓ 6.8           │
│                                                         │
│  FG%                                                    │
│  51.2 ▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░▓▓▓▓▓▓▓▓▓ 47.8           │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

Stats compared: PTS, REB, AST, STL, BLK, FG%, 3P%, FT%, +/-
Bar extends from center, longer bar = higher stat. Winner highlighted in accent color.
Bars animate in with stagger (0.08s per bar).

**Section 3: Game Log**
```
┌───────────────────────────────────────────────────────────┐
│  All Meetings (73 games)                                  │
│  ─────────────────────────────────────────────────────── │
│                                                           │
│  Mar 15, 2024 • LAL 118 - GSW 112                        │
│  LeBron: 32pts/8reb/7ast  |  Curry: 28pts/4reb/9ast     │
│                                                           │
│  Jan 27, 2024 • GSW 121 - LAL 115                        │
│  LeBron: 25pts/11reb/5ast |  Curry: 31pts/6reb/8ast     │
│                                                           │
│  ... (expandable, load more)                              │
│                                                           │
└───────────────────────────────────────────────────────────┘
```

Each game row:
- Date, teams, final score
- Both players' stat lines
- Winner's row has subtle accent glow
- Click to expand: full box score + team game log

**Section 4: Best Games**
```
┌────────────────────────────────────────┐
│  Best Performances                     │
│                                        │
│  LeBron's Best: 46pts/8reb/6ast       │
│  Nov 13, 2019 • LAL 120, GSW 94      │
│                                        │
│  Curry's Best: 47pts/7reb/11ast       │
│  Feb 12, 2023 • GSW 132, LAL 105     │
└────────────────────────────────────────┘
```

**Section 5: Top Rivals sidebar**
Show each player's other top rivals as clickable cards.

### Phase 2 Gate
- [ ] Landing page renders with search and popular matchups
- [ ] Slug routing works (both directions)
- [ ] Matchup page shows correct win-loss record
- [ ] Stat bars animate and show correct averages
- [ ] Game log shows real games in chronological order
- [ ] Best games identified correctly
- [ ] Rivals list loads
- [ ] Build passes

---

# PART B: PLAYER CAREER TIMELINE

## Architecture

### Data Sources
- `player_stats_pergame` — Season-by-season stats
- `player_stats_advanced` — Advanced metrics per season
- `awards` — MVP, DPOY, etc.
- `draft` — Draft info
- `players` — Bio, active status, career range

### Event Types
```typescript
type TimelineEventType =
  | 'draft'           // Drafted by team
  | 'rookie_season'   // First season
  | 'award'           // MVP, DPOY, ROY, etc.
  | 'all_star'        // All-Star selection (when data available)
  | 'trade'           // Detected from team change between seasons
  | 'career_high'     // Season career high in a stat
  | 'milestone'       // 10K points, 5K assists, etc.
  | 'peak_season'     // Best WS/48 or BPM season
  | 'decline'         // Significant stat drop (>20%)
  | 'retirement'      // Last season
  | 'season'          // Regular season node (always present)
  ;
```

### Trade Detection
Compare team in season N to team in season N+1. If different → trade event.
If player has "TOT" team (traded mid-season) → multiple teams that season.

### Milestone Detection
From career cumulative stats:
- Points: 1K, 5K, 10K, 15K, 20K, 25K, 30K, 35K, 40K
- Assists: 1K, 3K, 5K, 7K, 10K
- Rebounds: 1K, 3K, 5K, 7K, 10K, 12K, 15K
- Games: 500, 750, 1000, 1250, 1500

---

## Phase 3: Timeline Data Layer (Target: 60 min)

### 3a. Create `src/lib/timeline-engine.ts`

```typescript
import { getDb } from './db';

export interface TimelineEvent {
  readonly season: string;      // "2003-04"
  readonly year: number;        // 2003
  readonly type: TimelineEventType;
  readonly title: string;       // "Drafted #1 by Cleveland"
  readonly description: string; // "Selected first overall..."
  readonly team: string;        // "CLE"
  readonly stats?: SeasonStats; // Attached stats if season type
  readonly significance: 'major' | 'notable' | 'minor';
  readonly icon: string;        // Lucide icon name
}

export interface SeasonStats {
  readonly season: string;
  readonly team: string;
  readonly games: number;
  readonly ppg: number;
  readonly rpg: number;
  readonly apg: number;
  readonly fgPct: number;
  readonly fg3Pct: number;
  readonly per: number;
  readonly ws: number;
  readonly bpm: number;
}

export interface CareerTimeline {
  readonly player: string;
  readonly events: TimelineEvent[];
  readonly careerStats: {
    totalPoints: number;
    totalGames: number;
    peakSeason: string;
    teams: string[];
    yearsActive: number;
  };
}

export function buildTimeline(playerName: string): CareerTimeline {
  const db = getDb();
  const events: TimelineEvent[] = [];

  // 1. Get all season stats
  const seasons = getPlayerSeasons(db, playerName);

  // 2. Get draft info
  const draft = getDraftInfo(db, playerName);
  if (draft) events.push(createDraftEvent(draft));

  // 3. Get awards
  const awards = getAwards(db, playerName);
  awards.forEach(a => events.push(createAwardEvent(a)));

  // 4. Detect trades (team changes between consecutive seasons)
  detectTrades(seasons).forEach(t => events.push(t));

  // 5. Detect career highs per stat
  detectCareerHighs(seasons).forEach(ch => events.push(ch));

  // 6. Detect milestones (cumulative thresholds)
  detectMilestones(seasons).forEach(m => events.push(m));

  // 7. Identify peak season (highest WS/48 or BPM)
  const peak = identifyPeak(seasons);
  if (peak) events.push(peak);

  // 8. Add season nodes for every season
  seasons.forEach(s => events.push(createSeasonNode(s)));

  // 9. Sort by year
  events.sort((a, b) => a.year - b.year);

  return { player: playerName, events, careerStats: computeCareerStats(seasons) };
}
```

### Phase 3 Gate
- [ ] `buildTimeline('LeBron James')` returns comprehensive timeline
- [ ] Draft event present with correct year/pick
- [ ] Trades detected between seasons (e.g., CLE → MIA → CLE → LAL)
- [ ] Awards mapped correctly
- [ ] Career milestones calculated from cumulative sums
- [ ] Peak season identified

---

## Phase 4: Timeline Components + Page (Target: 75 min)

### 4a. CareerTimeline.tsx — Main visualization

**Design: Vertical timeline inspired by Apple's product pages**

```typescript
interface CareerTimelineProps {
  readonly timeline: CareerTimeline;
  readonly highlightType?: TimelineEventType;
  readonly onEventClick?: (event: TimelineEvent) => void;
}
```

**Layout:**
```
     ┌──────────────────────────────┐
     │  2003 Draft                  │
     │  #1 Pick • Cleveland         │  ← Major event: large card
     ├──────────────────────────────┤
     │                              │
  ●──┤  2003-04 Rookie Season      │  ← Season node: compact
     │  20.9 PPG / 5.5 RPG / 5.9 APG
     │                              │
  ●──┤  2004-05                    │
     │  27.2 PPG / 7.4 RPG / 7.2 APG  ← Career high: PPG highlighted
     │                              │
  ★──┤  2008-09: First MVP         │  ← Award: gold accent, large
     │  28.4 PPG / 7.6 RPG / 7.2 APG
     │                              │
  🔄──┤  2010: Trade to Miami      │  ← Trade: orange accent
     │  "The Decision"              │
     │                              │
  🏆──┤  2011-12: MVP + Champion   │  ← Multiple events stacked
     │  27.1 PPG / 7.9 RPG / 6.2 APG
     │                              │
     ...continued...
```

- Vertical line (2px, gradient from top accent to bottom dim)
- Events alternate left/right of the line
- Major events (awards, trades, milestones) are larger cards with glow
- Season nodes are compact chips
- Scroll-triggered animations: events fade in as you scroll down
- Year markers on the timeline line itself

**Event card variants by significance:**

Major (awards, trade, milestone):
- Full GlassCard with tint color
- Large text, icon, description
- Stats row if applicable

Notable (career high, peak):
- Medium card, slightly elevated
- Highlighted stat

Minor (regular season):
- Compact row: season • team • key stats
- Expandable on click to show full stats

### 4b. TimelineEvent.tsx

Individual event card with type-based styling.

**Color coding by event type:**
- Draft: accentGreen (#34D399)
- Award: accentGold (#FBBF24)
- Trade: accentOrange (#FF6B35)
- Career High: accentViolet (#A78BFA)
- Milestone: accentBlue (#4DA6FF)
- Peak: gold gradient
- Season: chromeDim (default)

### 4c. SeasonNode.tsx

Compact season display with expandable stats.

```
┌─────────────────────────────────────────┐
│  2023-24 • LAL                          │
│  25.7 PPG  7.3 RPG  8.3 APG  .540 FG%  │
│  [Expand ↓]                             │
│                                          │
│  ┌─────────────────────────────────┐    │  ← Expanded
│  │  Advanced: PER 25.1 • WS 9.8   │    │
│  │  BPM +8.2 • VORP 6.5           │    │
│  │  Awards: All-NBA First Team     │    │
│  └─────────────────────────────────┘    │
└─────────────────────────────────────────┘
```

### 4d. MilestoneCard.tsx

Special large card for major milestones.

```
┌──────────────────────────────────────┐
│  ⭐ 30,000 CAREER POINTS            │
│                                      │
│  LeBron James became the 5th player │
│  in NBA history to reach 30,000     │
│  career points during the 2017-18   │
│  season with the Cleveland Cavaliers│
│                                      │
│  Career Total: 40,474 points (1st)  │
└──────────────────────────────────────┘
```

### 4e. Timeline Page (`src/app/player/[name]/timeline/page.tsx`)

Full page layout:

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│  ← Back to Player Lab                               │
│                                                     │
│  LEBRON JAMES                                       │
│  The Journey: 2003 — Present                        │
│  21 Seasons • 4 Teams • 4× MVP • 4× Champion       │
│                                                     │
│  Filter: [All] [Awards] [Trades] [Milestones]       │
│                                                     │
│  ┌──────────────────────────────────────────┐       │
│  │        [Career Timeline Viz]              │       │
│  │        ...scrollable...                   │       │
│  │        ...events fade in...               │       │
│  └──────────────────────────────────────────┘       │
│                                                     │
│  Career Overview                                     │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐       │
│  │ Points │ │ Games  │ │ Teams  │ │ Awards │       │
│  │ 40,474 │ │ 1,492  │ │ 4      │ │ 15     │       │
│  └────────┘ └────────┘ └────────┘ └────────┘       │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### 4f. Link from Player Lab

Add a "View Timeline →" link on the Player Lab page. Since Instance 1 may be modifying player pages, add this as a clearly marked section at the bottom that won't conflict. Or better: the timeline page stands alone, linked from the URL pattern.

### Phase 4 Gate
- [ ] Timeline page renders for any player with career data
- [ ] Events display in chronological order
- [ ] Trade detection works (LeBron: CLE→MIA→CLE→LAL)
- [ ] Awards show with correct seasons
- [ ] Milestones calculated from cumulative stats
- [ ] Scroll animations work
- [ ] Filter buttons filter event types
- [ ] Mobile: single-column layout, events all on one side
- [ ] Build passes

---

## Phase 5: Polish + Navigation (Target: 45 min)

### Matchup Polish:
- Dramatic entrance animation: players slide in from sides, "VS" scales in center
- Stat bars: animate with spring physics, stagger 80ms
- Game log: infinite scroll with load-more
- Share button: copy matchup URL
- Keyboard: arrow keys to scroll through games
- Popular matchups: fetch dynamically from most common game-log pairs

### Timeline Polish:
- Smooth scroll snapping to major events
- Parallax effect on event cards
- Year indicator sticks to top during scroll
- Stat trend overlay: faint line chart behind timeline showing PPG over career
- "Jump to" dropdown: select a season to scroll to
- Print/export: "Share this timeline" → generates image

### Cross-linking:
- Matchup page links to both players' timelines
- Timeline links to any matchups from that era
- Both pages linked from existing Player Lab page

### Phase 5 Gate
- [ ] All animations smooth (60fps)
- [ ] Cross-links work between features
- [ ] Mobile responsive
- [ ] Full build passes
- [ ] No console errors

---

## Subagent Orchestration

### Agent 1: CODE WRITER
Focus areas:
- SQL JOINs for shared game logs (complex queries)
- Timeline event generation logic (many edge cases)
- Scroll-based animation (Intersection Observer + Framer Motion)
- Slug parsing (robust against weird names with Jr., III, etc.)

Watch-outs:
- Player names with special chars: "Shaquille O'Neal", "Dennis Rodman Jr."
- Some players have very few shared games (handle gracefully)
- Cumulative milestones require running totals across sorted seasons
- "TOT" team entries mean player was traded mid-season

### Agent 2: DEBUG / TEST
Instructions:
- Test matchup queries for known pairs (LeBron/Curry, Bird/Magic, Jordan/Pippen)
- Verify win-loss records against known data
- Test edge cases: same-team players (teammates), players from different eras (no shared games)
- Test timeline for players with: short careers (1 season), long careers (20+), many trades
- Run `npm run build` after each phase
- Verify API response times <500ms

### Agent 3: CODE QUALITY REVIEW
Instructions:
- SQL queries must be parameterized
- Check that matchup slugs handle all edge cases
- Verify event deduplication (no duplicate milestones)
- Check component memoization for large game logs
- Verify glass morphism styling uses design tokens
- Check accessibility on interactive elements

---

## Data Integration

### Game log data already exists
`player_game_logs` has 452K rows from 2007-2025. No waiting needed.

### If new data appears:
Check `~/basketball_data/` for:
- `player_playoffs_gamelogs_*.csv` — Playoff game logs
- `all_nba_teams_history.csv` — For timeline awards enrichment
- `all_defense_teams_history.csv` — For timeline awards enrichment

If found, incorporate into timeline events.

---

## Success Criteria

After 6 hours:
1. Matchup landing page with search and popular rivalries
2. Dynamic matchup page with hero, stat bars, game log, best games
3. Timeline page with scrollable career visualization
4. Multiple event types rendered with unique styling
5. Trade detection, milestone detection, career highs all working
6. Both features mobile responsive
7. Smooth premium animations throughout
8. Zero build errors
9. Cross-linking between features
10. Every matchup and timeline tells a story just by looking at it
