# Production Quality Plan — Basketball Intelligence Playground

> **Created**: 2026-03-30
> **Status**: PAUSED (budget constraint) — resume when ready
> **Partial work committed**: Vitest infrastructure, api-error utility, .env.example

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Current State Assessment](#current-state-assessment)
3. [Phase 1: Test Infrastructure + Error Handling](#phase-1-test-infrastructure--error-handling)
4. [Phase 2: Code Quality + Config Centralization](#phase-2-code-quality--config-centralization)
5. [Phase 3: API Hardening + Database Optimization](#phase-3-api-hardening--database-optimization)
6. [Phase 4: Tests + Accessibility](#phase-4-tests--accessibility)
7. [Phase 5: Production Readiness](#phase-5-production-readiness)
8. [Phase 6: Final Testing + Documentation](#phase-6-final-testing--documentation)
9. [Deferred Work](#deferred-work)
10. [File-by-File Issue Registry](#file-by-file-issue-registry)
11. [Verification Checklist](#verification-checklist)

---

## Executive Summary

The app is **functionally complete** — 10 pages, 29 routes, clean build (0 errors, 0 warnings), 1.5GB SQLite database with 13 tables of real NBA data. But it lacks the infrastructure for production:

- **Zero tests** (no test files, no test framework before this commit)
- **18 API routes silently swallow errors** — catch blocks return `{ error: 'Database error' }` with no logging
- **No .env.example** — `GEMINI_API_KEY` required but undocumented
- **Hardcoded everything** — DB path, model name, edition date, API limits
- **No deployment config** — no Dockerfile, no sitemap, no robots.txt
- **No video tagging** — `VIDEO_AVAILABLE` column dropped during ingestion
- **Player ID mismatch** — players table uses rowid, NBA API tables use official IDs

### What's Already Done (This Commit)
- Vitest installed and configured (`vitest.config.ts`)
- `src/lib/api-error.ts` — shared error handler utility created
- `.env.example` — documents all required/optional env vars
- `test` and `test:watch` scripts added to `package.json`

---

## Current State Assessment

### Build
- `npm run build` → PASSING, 10 pages, 29 routes, 0 errors, 0 warnings
- `npm run lint` → ESLint 9 config (flat config), generally clean

### Architecture
```
src/
├── app/
│   ├── api/                    # 18 API route handlers
│   │   ├── agentic/chat/      # Gemini AI "Ask the Data" feature
│   │   ├── compare/           # Player comparison
│   │   ├── explore/           # Homepage data
│   │   ├── lineups/           # 5-man lineup data
│   │   ├── players/           # Player search, detail, shots, similar
│   │   ├── quiz/              # Quiz game (guess, shot-chart, archetype)
│   │   ├── shot-lab/          # Shot zones, compare, what-if
│   │   ├── shots/             # Raw shot data
│   │   ├── standings/         # Season standings
│   │   └── teams/             # Team stats
│   ├── ask/                   # "Ask the Data" page
│   ├── compare/               # Compare Studio page
│   ├── explore/               # Explore Directory page
│   ├── lineup/                # Lineup Sandbox page
│   ├── play/                  # Play Mode (quiz) page
│   ├── player/[name]/         # Player Lab page
│   ├── shot-lab/              # Shot Lab page
│   ├── stories/               # Story Studio page
│   ├── team/[abbr]/           # Team DNA page
│   ├── layout.tsx             # Root layout with metadata
│   ├── page.tsx               # Homepage (Explore)
│   ├── global-error.tsx       # Error boundary
│   └── not-found.tsx          # 404 page
├── components/
│   ├── court/                 # BasketballCourt.tsx, ShotChart.tsx
│   └── ui/                    # GlassCard, Badge, EmptyState, etc.
└── lib/
    ├── db.ts                  # 906-line database module (30+ exports)
    └── design-tokens.ts       # UI design system tokens
```

### Database (SQLite, ~1.5GB, read-only)
| Table | Rows | Coverage |
|-------|------|----------|
| shots | 5,715,079 | 1996-97 to 2024-25 |
| player_game_logs | 452,108 | 2007-08+ |
| player_stats_pergame | 24,662 | 1980-2025 |
| player_stats_advanced | 24,661 | 1980-2025 |
| lineups | 24,000 | 2013-2025 |
| players | 5,407 | biographical |
| team_game_logs | ~15,000 | regular season only |
| team_stats_advanced | ~800 | most seasons |
| standings | 775 | multiple seasons |
| career_leaders | ~600 | all-time |
| awards | 351 | major awards |
| draft | 6,591 | historical |
| tracking | 14,125 | 2020-21+ |

---

## Phase 1: Test Infrastructure + Error Handling

**Status**: PARTIALLY DONE
**Estimated time**: 1 hour
**Priority**: P0 — Critical

### 1A: Test Infrastructure (DONE)
- [x] Install vitest, @testing-library/react, @testing-library/jest-dom, jsdom
- [x] Create `vitest.config.ts` with @/* path alias
- [x] Add `test` and `test:watch` scripts to package.json
- [x] Create `.env.example`

### 1A: First Tests (TODO)
- [ ] Create `src/lib/__tests__/db.test.ts`:
  - Test `searchPlayers('LeBron')` returns results
  - Test `clampLimit()` edge cases: negative → 1, zero → 1, over 100 → 100
  - Test `clampOffset()` edge cases: negative → 0
  - Test `getExploreData()` returns object with keys: featured, topScorers, seasons, edition, standings, allTimeScorers
  - Guard: skip all tests if `data/basketball.db` doesn't exist

### 1B: Fix Silent Error Swallowing (PARTIALLY DONE)
- [x] Create `src/lib/api-error.ts` — shared error handler
- [ ] Update ALL 18 API route catch blocks to use `handleApiError`:

| # | Route File | Current Catch Line | Status |
|---|-----------|-------------------|--------|
| 1 | `src/app/api/explore/route.ts` | ~13 | TODO |
| 2 | `src/app/api/players/[name]/route.ts` | ~18 | TODO |
| 3 | `src/app/api/players/[name]/shots/route.ts` | ~23 | TODO |
| 4 | `src/app/api/players/[name]/similar/route.ts` | ~14 | TODO |
| 5 | `src/app/api/players/search/route.ts` | ~12 | TODO |
| 6 | `src/app/api/compare/route.ts` | ~14 | TODO |
| 7 | `src/app/api/teams/route.ts` | ~8 | TODO |
| 8 | `src/app/api/teams/[abbr]/route.ts` | ~18 | TODO |
| 9 | `src/app/api/shots/route.ts` | ~15 | TODO |
| 10 | `src/app/api/standings/route.ts` | ~10 | TODO |
| 11 | `src/app/api/lineups/route.ts` | ~11 | TODO |
| 12 | `src/app/api/quiz/route.ts` | ~66 | TODO |
| 13 | `src/app/api/quiz/shot-chart/route.ts` | ~27 | TODO |
| 14 | `src/app/api/quiz/archetype/route.ts` | ~34 | TODO |
| 15 | `src/app/api/shot-lab/zones/route.ts` | ~27 | TODO |
| 16 | `src/app/api/shot-lab/compare/route.ts` | ~29 | TODO |
| 17 | `src/app/api/shot-lab/whatif/route.ts` | ~64 | TODO |
| 18 | `src/app/api/agentic/chat/route.ts` | ~257 (console.error) | TODO |

**Pattern for each route**:
```typescript
// BEFORE:
} catch {
  return NextResponse.json({ error: 'Database error' }, { status: 500 });
}

// AFTER:
import { handleApiError } from '@/lib/api-error';
// ...
} catch (e) {
  return handleApiError(e, 'explore');
}
```

---

## Phase 2: Code Quality + Config Centralization

**Status**: TODO
**Estimated time**: 1 hour
**Priority**: P1

### 2A: Bug Fixes

**Redundant loading check** — `src/app/shot-lab/page.tsx:~684-689`
```typescript
// BEFORE (line ~689):
{!loading && !error && playerName && shots.length === 0 && !loading && (
// AFTER:
{!loading && !error && playerName && shots.length === 0 && (
```

**Unsafe type assertion** — `src/app/api/teams/[abbr]/route.ts:15`
```typescript
// BEFORE:
const teamName = (stats[0] as Record<string, unknown>)?.teamName as string | undefined;
// AFTER:
const first = stats[0] as Record<string, unknown> | undefined;
const teamName = typeof first?.teamName === 'string' ? first.teamName : undefined;
```

**Hardcoded edition date** — `src/lib/db.ts:~332`
```typescript
// BEFORE:
edition: 'March 2026',
lastUpdated: '2026-03-23'
// AFTER — compute from database:
const latestSeason = db.prepare('SELECT MAX(Season) as s FROM player_stats_pergame').get();
edition: `Season ${latestSeason?.s || 'Unknown'}`,
lastUpdated: new Date().toISOString().split('T')[0]
```

**Hardcoded model name** — `src/app/api/agentic/chat/route.ts:~154`
```typescript
// BEFORE:
model: 'gemini-2.5-flash',
// AFTER:
model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
```

**Potentially unused function** — `src/lib/db.ts:~452`
- `getRandomPlayerForQuiz()` — verify with: `grep -rn "getRandomPlayerForQuiz" src/`
- If only used internally in db.ts, remove the export or inline it

### 2B: Centralized Config

Create `src/lib/config.ts`:
```typescript
import path from 'path';

export const config = {
  db: {
    path: process.env.DB_PATH || path.join(process.cwd(), 'data', 'basketball.db'),
  },
  gemini: {
    model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
    maxMessageLength: 500,
    maxOutputTokens: 1024,
    temperature: 0.3,
  },
  api: {
    defaultLimit: 25,
    maxLimit: 100,
    shotLimit: 5000,
    maxShotLimit: 10000,
  },
} as const;
```

Then update:
- `src/lib/db.ts:8` — use `config.db.path` instead of hardcoded path
- `src/app/api/agentic/chat/route.ts` — use `config.gemini.*`

---

## Phase 3: API Hardening + Database Optimization

**Status**: TODO
**Estimated time**: 1 hour
**Priority**: P1

### 3A: Cache Headers

Create `src/lib/api-response.ts`:
```typescript
import { NextResponse } from 'next/server';

export function jsonWithCache(data: unknown, maxAge = 300): NextResponse {
  const response = NextResponse.json(data);
  response.headers.set(
    'Cache-Control',
    `public, s-maxage=${maxAge}, stale-while-revalidate=600`
  );
  return response;
}
```

Apply to all GET routes:
| Route | Cache Duration | Reason |
|-------|---------------|--------|
| `/api/explore` | 300s (5min) | Semi-static homepage data |
| `/api/players/search` | 60s | Search results change rarely |
| `/api/players/[name]` | 120s (2min) | Player data is static per season |
| `/api/players/[name]/shots` | 120s | Shot data doesn't change |
| `/api/players/[name]/similar` | 120s | Computed comparison |
| `/api/compare` | 120s | Player comparison |
| `/api/teams` | 300s | Team list is static |
| `/api/teams/[abbr]` | 120s | Team stats |
| `/api/shots` | 120s | Raw shots |
| `/api/standings` | 300s | Historical standings |
| `/api/lineups` | 120s | Lineup data |
| `/api/shot-lab/*` | 120s | Shot analysis |
| `/api/quiz/*` | 0 | Random each time — no cache |
| `/api/agentic/chat` | 0 | AI responses — no cache |

### 3B: Missing Database Indexes

Add to `scripts/add_indexes.py`:
```python
# Missing indexes for common query patterns
"CREATE INDEX IF NOT EXISTS idx_player_game_logs_player ON player_game_logs(PLAYER_NAME)",
"CREATE INDEX IF NOT EXISTS idx_player_game_logs_season ON player_game_logs(SEASON_ID)",
"CREATE INDEX IF NOT EXISTS idx_draft_player ON draft(Player)",
"CREATE INDEX IF NOT EXISTS idx_awards_player ON awards(Player)",
"CREATE INDEX IF NOT EXISTS idx_standings_season ON standings(Season)",
"CREATE INDEX IF NOT EXISTS idx_tracking_player ON tracking(PLAYER_NAME)",
```

Then run: `python scripts/add_indexes.py`

### 3C: Dynamic DB Schema for Agentic Chat

Replace hardcoded `DB_SCHEMA` at `src/app/api/agentic/chat/route.ts:7-32` with:

```typescript
// In src/lib/db.ts — new export:
export function getSchemaDescription(): string {
  const db = getDb();
  const tables = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
  ).all() as { name: string }[];

  return tables.map(({ name }) => {
    const cols = db.prepare(`PRAGMA table_info(${name})`).all() as {
      name: string; type: string;
    }[];
    const count = (db.prepare(`SELECT COUNT(*) as c FROM ${name}`).get() as { c: number }).c;
    const colList = cols.map(c => `${c.name} ${c.type}`).join(', ');
    return `${name} (${count} rows): ${colList}`;
  }).join('\n');
}
```

---

## Phase 4: Tests + Accessibility

**Status**: TODO
**Estimated time**: 1 hour
**Priority**: P2

### 4A: API Integration Tests

Create `src/app/api/__tests__/routes.test.ts`:
```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import { existsSync } from 'fs';
import path from 'path';

const DB_EXISTS = existsSync(path.join(process.cwd(), 'data', 'basketball.db'));

describe.skipIf(!DB_EXISTS)('API Route Handlers', () => {
  // Import and test each route's GET handler directly
  // Test expected response shapes, 404 cases, validation
});
```

Test cases:
- `GET /api/explore` → has { featured, topScorers, seasons, edition }
- `GET /api/players/[name]` → valid name returns data; invalid returns 404
- `GET /api/quiz?mode=guess` → returns player object with expected fields
- `GET /api/teams/[abbr]` → valid abbr returns stats array
- `POST /api/agentic/chat` → missing message returns 400

### 4B: Accessibility Fixes

**Shot chart SVGs** — `src/components/court/BasketballCourt.tsx`:
```tsx
<svg role="img" aria-label="Basketball half-court diagram" ...>
  <title>Basketball half-court diagram</title>
  ...
</svg>
```

**Shot chart with data** — `src/components/court/ShotChart.tsx`:
```tsx
<svg role="img" aria-label={`Shot chart showing ${shots.length} shots`} ...>
  <title>{`Shot chart: ${shots.length} shots, ${makePercentage}% made`}</title>
  ...
</svg>
```

**Global error page** — `src/app/global-error.tsx`:
- Add error digest display: `{error.digest && <p className="text-xs text-zinc-500">Error ID: {error.digest}</p>}`

---

## Phase 5: Production Readiness

**Status**: TODO
**Estimated time**: 1 hour
**Priority**: P2

### 5A: SEO

Create `src/app/sitemap.ts`:
```typescript
import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: '/', lastModified: new Date(), changeFrequency: 'weekly', priority: 1 },
    { url: '/explore', lastModified: new Date(), changeFrequency: 'weekly', priority: 0.9 },
    { url: '/compare', lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
    { url: '/shot-lab', lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
    { url: '/stories', lastModified: new Date(), changeFrequency: 'weekly', priority: 0.7 },
    { url: '/play', lastModified: new Date(), changeFrequency: 'weekly', priority: 0.7 },
    { url: '/lineup', lastModified: new Date(), changeFrequency: 'weekly', priority: 0.7 },
    { url: '/ask', lastModified: new Date(), changeFrequency: 'weekly', priority: 0.6 },
  ];
}
```

Create `src/app/robots.ts`:
```typescript
import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: '*', allow: '/' }, sitemap: '/sitemap.xml' };
}
```

### 5B: next.config.ts Production Hardening
```typescript
const nextConfig: NextConfig = {
  serverExternalPackages: ['better-sqlite3'],
  experimental: { staticGenerationRetryCount: 0 },
  productionBrowserSourceMaps: false,
};
```

### 5C: Dockerfile
```dockerfile
FROM node:20-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci --production=false

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM base AS runner
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
# Mount database volume at /app/data/basketball.db
EXPOSE 3000
CMD ["node", "server.js"]
```

### 5D: Loading States
Create `loading.tsx` files for heavy pages:
- `src/app/loading.tsx` (global fallback)
- `src/app/explore/loading.tsx`
- `src/app/player/[name]/loading.tsx`
- `src/app/shot-lab/loading.tsx`

---

## Phase 6: Final Testing + Documentation

**Status**: TODO
**Estimated time**: 1 hour
**Priority**: P3

### 6A: Component + Edge Case Tests
- `src/components/__tests__/ui.test.tsx` — GlassCard, Badge, EmptyState, SearchBar, SkeletonLoader
- `src/lib/__tests__/api-error.test.ts` — error handler status codes, dev vs prod behavior
- Expand `db.test.ts` — empty search, nonexistent player, quiz structures

### 6B: Documentation
- Update `README.md` — prerequisites, setup, dev commands, test commands, architecture
- Update `BUILD_STATUS.md` — reflect completed production hardening work

---

## Deferred Work

These items are important but were scoped out due to budget/risk:

### Video Tagging (HIGH VALUE, HIGH EFFORT)
- **Issue**: `scripts/ingest.py:226` drops `VIDEO_AVAILABLE` column from source CSVs
- **Fix**: Add `VIDEO_AVAILABLE` to `keep_cols`, re-run ingestion
- **Enhancement**: Create `videos` and `video_tags` tables, build API endpoints
- **Risk**: Requires re-ingesting 1.5GB database

### Player ID Crosswalk (HIGH VALUE, MEDIUM EFFORT)
- **Issue**: `players` table uses rowid-based IDs; `player_game_logs`, `shots`, `tracking`, `lineups` use NBA API IDs
- **Impact**: 1,690 player_game_logs and 983 tracking records can't be joined by ID
- **Fix**: Add `nba_player_id` column to `players` table, build fuzzy name-matching crosswalk
- **Estimated**: 2-3 hours

### Season Format Normalization (MEDIUM VALUE, HIGH RISK)
- **Issue**: `player_stats_pergame` uses INTEGER (2024), `shots`/`standings`/`lineups` use TEXT ("2023-24")
- **Impact**: Cross-table joins require type conversion
- **Risk**: Touches too many tables and queries; high regression potential

### Rate Limiting (MEDIUM VALUE, MEDIUM EFFORT)
- Add rate limiting middleware to all API routes
- Consider `next-rate-limit` or Upstash `@upstash/ratelimit`

### E2E Testing (HIGH VALUE, HIGH EFFORT)
- Install Playwright
- Write E2E tests for all 10 page surfaces
- Estimated: 4+ hours

### Data Gaps
- Lineups before 2013-14 season (6 years missing)
- Team stats advanced: missing 2020-21 and 2023-24 seasons
- Team game logs: regular season only (no playoffs)
- Tracking data: only 2020-21 onward (5 seasons)
- 547 shots with NULL LOC_X/LOC_Y coordinates
- 46 player stats with NULL PTS values

---

## File-by-File Issue Registry

### `src/lib/db.ts` (906 lines)
| Line | Issue | Severity | Phase |
|------|-------|----------|-------|
| 8 | Hardcoded `data/basketball.db` path | P1 | 2 |
| ~196-198 | `(db.prepare(...).get() as { s: string })?.s` — unsafe cast | P3 | 2 |
| ~283-294 | Featured players query uses implicit join | P3 | 3 |
| ~332 | `edition: 'March 2026'` hardcoded | P1 | 2 |
| ~333 | `lastUpdated: '2026-03-23'` hardcoded | P1 | 2 |
| ~348 | `CAST(${col} as FLOAT)` — safe via whitelist but risky pattern | P3 | — |
| ~452 | `getRandomPlayerForQuiz()` — possibly unused export | P3 | 2 |
| ~478 | `CAST(${stat} as FLOAT)` — safe via TS union type | P3 | — |
| ~488 | `ABS()` function call — verify SQLite compat | P3 | — |

### `src/app/api/agentic/chat/route.ts`
| Line | Issue | Severity | Phase |
|------|-------|----------|-------|
| 7-32 | `DB_SCHEMA` hardcoded, says "various" for tracking columns | P1 | 3 |
| ~94 | Forbidden SQL keywords list incomplete (missing PRAGMA, INDEXES) | P2 | 3 |
| ~110 | `process.env.GEMINI_API_KEY` — no .env.example | P0 | 1 (DONE) |
| ~154 | `model: 'gemini-2.5-flash'` hardcoded | P1 | 2 |
| ~174-182 | JSON parse error catches but doesn't log Gemini response | P2 | 1 |
| ~225 | No LIMIT clause on queries without explicit limit | P2 | 3 |
| ~257 | `console.error('[Agentic API Error]', message)` | P1 | 1 |

### `src/app/shot-lab/page.tsx`
| Line | Issue | Severity | Phase |
|------|-------|----------|-------|
| ~684-689 | `!loading` checked twice in condition | P3 | 2 |

### `src/app/api/teams/[abbr]/route.ts`
| Line | Issue | Severity | Phase |
|------|-------|----------|-------|
| 15 | Unsafe double type assertion `as Record<...> ... as string` | P2 | 2 |

### `src/app/play/page.tsx`
| Line | Issue | Severity | Phase |
|------|-------|----------|-------|
| ~75-76 | `JSON.parse(raw)` — actually has try/catch (false positive) | — | — |

### `src/components/court/ShotChart.tsx`
| Line | Issue | Severity | Phase |
|------|-------|----------|-------|
| ~227-296 | SVG lacks `role="img"`, `aria-label`, `<title>` | P2 | 4 |

### `src/components/court/BasketballCourt.tsx`
| Line | Issue | Severity | Phase |
|------|-------|----------|-------|
| root SVG | No `role="img"` or `aria-label` | P2 | 4 |

### `src/app/global-error.tsx`
| Line | Issue | Severity | Phase |
|------|-------|----------|-------|
| ~1-21 | Error object available but not displayed (no digest) | P2 | 4 |

### `next.config.ts`
| Line | Issue | Severity | Phase |
|------|-------|----------|-------|
| — | Missing `productionBrowserSourceMaps: false` | P2 | 5 |

### `scripts/add_indexes.py`
| Line | Issue | Severity | Phase |
|------|-------|----------|-------|
| 11-22 | Missing 6 indexes for common query patterns | P1 | 3 |

### `scripts/ingest.py`
| Line | Issue | Severity | Phase |
|------|-------|----------|-------|
| 226 | `VIDEO_AVAILABLE` dropped from keep_cols | P1 | Deferred |
| 238-239 | Silently skips columns not in CSV | P2 | Deferred |

---

## Verification Checklist

After all phases complete, verify:

- [ ] `npm run build` → 0 errors, 0 warnings
- [ ] `npx vitest run` → all passing (target: 20+ tests)
- [ ] `grep -rn "console\.\(log\|error\|warn\)" src/` → zero hits (or only in api-error.ts dev guard)
- [ ] `.env.example` exists and documents all env vars
- [ ] `src/app/sitemap.ts` exists
- [ ] `src/app/robots.ts` exists
- [ ] `Dockerfile` exists and builds
- [ ] All API catch blocks use `handleApiError`
- [ ] No hardcoded `data/basketball.db` path outside config
- [ ] No hardcoded `gemini-2.5-flash` outside config
- [ ] Shot chart SVGs have `role="img"` and `aria-label`
- [ ] `next.config.ts` has `productionBrowserSourceMaps: false`
- [ ] `scripts/add_indexes.py` includes 6 new indexes
- [ ] README.md has setup instructions
