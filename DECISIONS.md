# DECISIONS — Basketball Intelligence Playground

> Maintained by: Program Manager
> Last updated: 2026-03-23T08:37
> Format: Decision → Who → Why → Date

---

## DEC-001: Tech Stack — Next.js 16 + TypeScript + Tailwind + SQLite

**Decision:** Use Next.js 16, TypeScript, Tailwind CSS, and SQLite as the full stack.

**Who:** CTO (executed by CEO before CTO hired)

**Why:**
- Next.js provides App Router for clean route structure across 9 product surfaces
- TypeScript enforces type safety across a data-heavy app
- Tailwind enables rapid UI iteration
- SQLite is sufficient for local MVP with 1.47GB; zero setup overhead vs Postgres
- Avoids external service dependencies for overnight build

**Alternatives considered:** Postgres (rejected — requires external process), plain React (rejected — no SSR/routing)

**Date:** 2026-03-23

---

## DEC-002: UI Reference — Apple.com + Novi PM Page + Paperclip UI Design System

**Decision:** UI aesthetic references are Apple.com (premium minimalism), the Novi PM page at usenovi.com/novi-pm (layout/hierarchy), and Paperclip's own UI design system (shadcn/ui component patterns).

**Who:** Board (corrected twice after SoundScore was incorrectly used as reference)

**Why:**
- Board explicitly rejected SoundScore as UI reference (it was a prior project)
- Apple.com = premium minimalism, clean whitespace, high contrast
- Novi PM page = specific layout/hierarchy patterns the board liked
- Paperclip UI design system = component-level patterns (shadcn/ui)
- "Think beautiful" — board wants polished, not just functional

**Alternatives considered:** SoundScore (rejected — board explicitly said no)

**Date:** 2026-03-23

---

## DEC-003: Dark Glass-Morphism Design System

**Decision:** Use dark background with glass-morphism card styles (backdrop blur, semi-transparent panels, glowing accents).

**Who:** CTO (inherited from initial build)

**Why:**
- Complements basketball's visual identity (night games, arena lighting)
- Visually distinctive and premium-feeling
- Consistent with SoundScore's successful pattern (style, not UI reference)

**Date:** 2026-03-23

---

## DEC-004: Data Strategy — CSV-to-SQLite Ingestion Pipeline

**Decision:** Ingest all sports CSVs from `~/Downloads/sportsdata/` into a single SQLite database via a Python ingestion script.

**Who:** CTO

**Why:**
- 253+ CSV files across 28 data categories already available locally
- Single SQLite file is portable, zero-config, fast for read-heavy queries
- Python ingestion (`scripts/ingest.py`) handles dedup, header normalization, season extraction
- More data is being scraped continuously — pipeline must be re-runnable

**Alternatives considered:** Individual file parsing per route (rejected — too slow), Postgres (rejected — DEC-001 rationale)

**Date:** 2026-03-23

---

## DEC-005: 3-Wave Build Plan

**Decision:** Ship in 3 waves prioritizing by user value.

| Wave | Surfaces | Priority |
|------|---------|----------|
| Wave 1 (Core) | Explore, Player Lab, Compare Studio, Shot Lab | Highest |
| Wave 2 (Depth) | Team DNA, Story Studio, Play Mode | High |
| Wave 3 (Advanced) | Lineup Sandbox, Ask the Data | Medium |

**Who:** Board (BAS-1 directive), implemented by CEO

**Why:**
- Ensures highest-value surfaces ship first
- Player Lab + Compare Studio + Shot Lab = highest visual/data impact
- Ask the Data is labeled beta — lower priority than structured surfaces
- Graceful degradation if data incomplete (degrade, don't block)

**Date:** 2026-03-23

---

## DEC-006: Team Org Structure

**Decision:** 6-agent team with clear reporting lines.

```
CEO (claude-opus-4-6)
├── CTO (claude-opus-4-6)
│   ├── Frontend Engineer (claude-sonnet-4-6)
│   └── Backend Engineer (claude-sonnet-4-6)
├── Data Manager (claude-sonnet-4-6)
└── Program Manager (claude-sonnet-4-6)
```

**Who:** CEO + Board

**Why:**
- Board directive (BAS-3): build like a high-functioning startup team
- Engineers build, Data Manager updates truth, PM keeps everyone aligned
- CTO orchestrates engineering; CEO handles strategy/hiring/escalation
- Opus for reasoning-heavy roles (CEO, CTO), Sonnet for execution ICs

**Date:** 2026-03-23

---

## DEC-007: Ask the Data is Beta/Constrained (Not Freeform Chat)

**Decision:** Ask the Data must have a supported intent list, controlled input flow, and constrained query parsing — NOT unconstrained freeform chat.

**Who:** Board (BAS-1 directive)

**Why:**
- Unconstrained NL → SQL is unreliable at scale
- 8 supported intents give users structure without false promises
- Core product value is in structured surfaces (Player Lab, Shot Lab, Compare Studio)
- "Ask the Data is beta" — sets appropriate expectations

**Date:** 2026-03-23

---

## DEC-008: Lineup Sandbox Builds Even Without Complete Data

**Decision:** Build Lineup Sandbox regardless of whether lineup data is complete; use modeled/hypothetical values when needed and label clearly.

**Who:** Board (BAS-1 directive)

**Why:**
- "Do not block the rest of the build" — board mandate
- 24,000 real 5-man lineups exist (2013-2025)
- For gaps: compute simplified lineup trait grades from player features
- Explicitly label as "modeled" or "hypothetical" in UI

**Date:** 2026-03-23

---

## DEC-009: Build Fix — global-error.tsx for Next.js 16.2.1

**Decision:** Replace `unstable_retry` with `reset` prop in `global-error.tsx` to resolve Next.js 16.2.1 prerender build failure.

**Who:** CTO

**Why:**
- `next build` was failing due to framework-level prerender issue with `_global-error`
- Fix: use standard `reset` prop instead of deprecated `unstable_retry`
- Also added `not-found.tsx` with branded 404 and `staticGenerationRetryCount` config
- Dev mode (`npm run dev`) was unaffected; only `next build` was broken

**Date:** 2026-03-23

---

## DEC-010: Continuous Data Ingestion Model

**Decision:** Treat data as continuously growing; pipeline must be re-runnable as new CSVs arrive.

**Who:** Board

**Why:**
- Board: "more is being extracted as time goes on and will continue to be"
- Data from `~/Downloads/sportsdata/` is live and growing
- Data Manager monitors for new CSVs each heartbeat
- Backend must handle schema additions without breaking existing queries

**Date:** 2026-03-23

---

## DEC-011: Documentation-First Execution Culture

**Decision:** All agents maintain documentation proactively: decision logs, build status, API contracts, and context sync through Paperclip issues.

**Who:** Board + CEO (BAS-3 directive)

**Why:**
- Board explicitly requested: "strong documentation, shared context, long-term product understanding, clear execution ownership, decision tracking"
- PM maintains BUILD_STATUS.md + DECISIONS.md every heartbeat
- "The system should behave like a high-functioning startup team"

**Date:** 2026-03-23

---

## DEC-012: Hire QA Engineer + UI Polish Engineer for Final Build Phase

**Decision:** CEO requested board approval to hire two new agents — QA Engineer and UI Polish Engineer — to handle final-phase testing and visual polish.

**Who:** CEO (requested), Board (pending approval)

**Why:**
- Build has reached functional state across all 9 surfaces; remaining work is quality-focused
- QA Engineer (claude-sonnet-4-6 with Chrome): end-to-end testing, bug reporting across all surfaces
- UI Polish Engineer (claude-sonnet-4-6): visual polish, animations, responsive design, design system enforcement
- Separating test/polish roles from build roles maintains clean ownership
- QA Engineer owns BAS-13 (E2E testing) on hire; UI Polish Engineer owns BAS-14 polish execution

**Alternatives considered:** Reuse existing engineers for testing (rejected — conflicts with active build work)

**Date:** 2026-03-23

---

## DEC-013: Novi PM Page as Primary UI Layout Reference (Single Page Only)

**Decision:** The Novi PM page (usenovi.com/novi-pm) — specifically that single page only — is the layout/hierarchy reference alongside Apple.com.

**Who:** Board (explicit clarification in BAS-1 comments)

**Why:**
- Board clarified the UI reference is the "AI sales agent thing" / "agentry thing" built recently
- Only the Novi PM page has the right layout and hierarchy — not other pages on the site
- Previous SoundScore reference was rejected (see DEC-002)

**Date:** 2026-03-23
