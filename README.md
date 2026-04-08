# Basketball Intelligence Playground

A full-stack NBA analytics platform. 5.7M shot records, 45 years of box scores, AI-powered natural language queries, computer-vision film analysis, and a design system built around the game.

Browse every player since 1980. Drop two of them on a radar. Paint a hexbin heatmap of where they shoot from. Upload a clip and have YOLO tag the action. Ask the database a question in English and get a chart back.

---

## Table of Contents

- [What's inside](#whats-inside)
- [Feature tour](#feature-tour)
- [Architecture](#architecture)
- [The data](#the-data)
- [The video-ML pipeline](#the-video-ml-pipeline)
- [Getting started](#getting-started)
- [Project layout](#project-layout)
- [API surface](#api-surface)
- [Design system](#design-system)
- [Testing](#testing)
- [Production notes](#production-notes)

---

## What's inside

| Layer | Stack |
|---|---|
| Frontend | Next.js 16 (App Router), React 19, TypeScript 5, Tailwind CSS 4 |
| Charts | D3 7 (shot charts, hexbins), Recharts, Framer Motion |
| Database | SQLite via `better-sqlite3` — read-only, ~1.7 GB, 55 tables |
| AI | Google Gemini for natural-language data queries |
| Video ML | Python pipeline — YOLOv11, OpenCV, ffmpeg, sentence-transformers |
| Testing | Vitest, Testing Library, jsdom |
| Ship | Dockerfile, production build, 67 unit + 80 integration tests |

Everything runs locally. No hosted DB, no cloud dependencies beyond the Gemini API for the natural-language feature.

---

## Feature tour

### Player Lab — `/player/[name]`
Deep profile for any player with a career timeline, peak-season highlights, per-game and advanced stat breakdowns, similarity search, and an interactive shot chart with hexbin overlay. Switch between regular season and playoffs with one click; data flips through the whole engine.

### Shot Lab — `/shot-lab`
Hexbin heatmap over a full NBA court. Filter by player, season, or zone. Compare two shooters side-by-side. "What-if" panel lets you strip out a shot zone and see how efficiency rebounds elsewhere. Uses the full 5.7M-shot dataset with court coordinates.

### Hot Zones — `/zones/[player]`
Per-zone shooting percentages rendered as a traffic-light overlay on the court — green where a player shoots above league average, red where they cough it up. Zone trend chart shows how hot zones shift year over year.

### Compare — `/compare`
Pick two players from any era. Get a radar chart across 8 stat axes, per-game deltas, similarity score, and a summary of which ranges of the court each one owns.

### Hot Zones vs League — `/zones`
Per-player shooting heatmaps compared against the current league average. Flag over/underperformance at a glance.

### Team DNA — `/team/[abbr]`
Team page with rosters, season splits, standings, and historical win patterns. Lineup chemistry, top-10 pairings, and usage distribution.

### Lineups — `/lineup`
Five-man lineup analyzer. Punch in any combination of players, get minutes played together, net rating, and efficiency splits. Pulls from the 24K+ lineup records.

### Matchup — `/matchup`
Head-to-head history between any two players or teams. Game-by-game splits, rivalry summaries, and a play-by-play feed for contested games.

### Film Room — `/film`
Upload a basketball video. The Python pipeline ingests it, extracts metadata, runs scene segmentation, detects players/ball/hoop with YOLO, classifies actions, and writes structured clip data back to SQLite. The frontend gives you an inline clip viewer, tag-based search, timeline scrubbing, and a Play Analysis modal with animated court diagrams.

### Ask — `/ask`
Type a question in plain English. Gemini converts it to a structured query against the database and returns either a table or a chart. Safe by construction — the agent can only touch an allowlist of tables and columns.

### Stories — `/stories`
Pre-built data narratives. "The rise of the 3", "Who benefited most from the pace-and-space era", "Peak LeBron vs peak Jordan" — each one is a scrollytelling piece driven by the real data.

### Play Mode — `/play`
Basketball trivia. Guess the player from anonymized shot charts, stat lines, or career arcs. Pulls live from the database so the questions never repeat.

### Explore — `/explore`
Directory of every player in the DB with filters for era, team, position, and career length. Real headshots, hover previews, and deep links into the Player Lab.

---

## Architecture

```
                       ┌──────────────────────┐
                       │   Next.js 16 (App)   │
                       │   React 19 + TS      │
                       │   Tailwind CSS 4     │
                       └──────────┬───────────┘
                                  │
                ┌─────────────────┼─────────────────┐
                │                 │                 │
       ┌────────▼────────┐ ┌──────▼──────┐  ┌───────▼────────┐
       │ Route Handlers  │ │  D3 charts  │  │ Framer Motion  │
       │ (/api/*)        │ │  (hexbin,   │  │ (transitions)  │
       │                 │ │   radar,    │  │                │
       │ ~35 endpoints   │ │   court)    │  └────────────────┘
       └────────┬────────┘ └─────────────┘
                │
    ┌───────────┼────────────┐
    │           │            │
┌───▼────┐ ┌────▼─────┐ ┌────▼──────────┐
│ SQLite │ │  Engine  │ │ Gemini Adapter│
│ 1.7 GB │ │  layer   │ │ (Ask the Data)│
│ 55 tbl │ │ (/lib)   │ │               │
└────────┘ └──────────┘ └───────────────┘
    ▲
    │
┌───┴──────────────────────────┐
│ Video-ML Pipeline (Python)   │
│ YOLO → classify → tag → DB   │
└──────────────────────────────┘
```

Request flow: page or API route calls a function in `src/lib/*-engine.ts`, which issues a read-only SQL query via `better-sqlite3`. Results come back as plain JS objects, get shaped into an `ApiResponse<T>` envelope, and render through D3 / Recharts / React.

Engines live in `src/lib/`:
- `insights-engine.ts` — player insight computations
- `similarity-engine.ts` — similarity search using advanced stat vectors
- `zone-engine.ts` — court-zone aggregation and league-average comparison
- `matchup-engine.ts` — head-to-head game matching
- `timeline-engine.ts` — career arcs and peak detection
- `film-db.ts` — film.db accessor for video clips
- `playoffs-db.ts` — season-type routing (regular vs. playoffs tables)
- `nba-assets.ts` — player headshot + team logo resolution

---

## The data

A single SQLite file (`data/basketball.db`, ~1.7 GB) with 55 tables covering the NBA and ABA from 1947–2025.

Highlights:

| Dataset | Rows | Range |
|---|---:|---|
| Shot records (with court coords) | 5.7 M | 1997–2025 |
| Player game logs | 452 K | 1980–2025 |
| Per-game season stats | 24.6 K | 1980–2025 |
| Advanced season stats | 24.4 K | 1980–2025 |
| Playoff shot records | 380 K | 1997–2025 |
| Player biographies | 5,407 | 1947–2025 |
| Lineup stats | 24 K+ | 2008–2025 |
| Tracking, draft, awards, standings | — | varies |

See `DATA_MANIFEST.md` for the complete schema — every table, column, source CSV, and known data issue is documented.

Ingestion script: `scripts/ingest.py`. Batch refresh only — the database is built from flat CSVs (`~/Downloads/sportsdata/`) and used read-only at runtime. Each engine opens the DB in read-only WAL mode so multiple routes can query in parallel without blocking.

---

## The video-ML pipeline

Separate Python package at `video-ml/`. Takes raw basketball video and produces structured clips that the frontend can search and replay.

```
Video file
   ↓
[ingest]     extract metadata via ffprobe
   ↓
[segment]    OpenCV frame differencing → clips
   ↓
[detect]     YOLOv11 → players, ball, hoop
   ↓
[classify]   rule-based action classification
   ↓
[align]      match clips to play-by-play
   ↓
[tag]        generate action/player/context tags
   ↓
[embed]      sentence-transformers for similarity search
   ↓
[export]     write clips + tags to data/film.db
```

Designed for graceful degradation — every heavy dependency has a fallback:

| Dependency | Fallback if missing |
|---|---|
| ffmpeg/ffprobe | OpenCV → mock |
| opencv-python-headless | Uniform time-based splitting |
| ultralytics (YOLO) | Mock detection results |
| sentence-transformers | Deterministic pseudo-random vectors |
| Tesseract / EasyOCR | Mock scoreboard data |

So you can `python -m scripts.demo` on a machine with nothing installed and still get realistic clip data flowing into the Film Room UI.

Schema for `data/film.db`: `videos`, `clips`, `tags`, `clip_tags`, `annotations`, `processing_jobs`.

---

## Getting started

### Prerequisites

- Node.js 20+
- Python 3.10+ (only if you want to run the video-ML pipeline)
- The SQLite database file at `data/basketball.db` (~1.7 GB) — you can build it from CSVs with `scripts/ingest.py` or drop in a pre-built copy
- A Gemini API key (only required for the `/ask` feature)

### Install

```bash
git clone https://github.com/madhavcodez/basketballintelleginece.git
cd basketballintelleginece
npm install
```

### Configure

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
GEMINI_API_KEY=your_key_here
# DB_PATH=data/basketball.db   # optional override
```

### Run

```bash
npm run dev          # http://localhost:3000
npm run build        # production build
npm run start        # serve production build
npm run lint         # eslint
npm test             # vitest
npm run test:watch   # vitest watch mode
```

### Docker

```bash
docker build -t basketball-intelligence .
docker run -p 3000:3000 -v $(pwd)/data:/app/data basketball-intelligence
```

### Video-ML (optional)

```bash
cd video-ml
pip install -r requirements.txt

python -m scripts.demo                       # generate sample clip data
python -m scripts.process_clip --input clip.mp4
python -m scripts.process_game --input game.mp4 --home-team Lakers --away-team Celtics
pytest tests/ -v
```

---

## Project layout

```
basketballintelleginece/
├── src/
│   ├── app/
│   │   ├── (pages)/              # home, explore, player, compare, shot-lab,
│   │   │                         # zones, team, matchup, film, ask, play,
│   │   │                         # stories, lineup
│   │   └── api/                  # ~35 route handlers
│   │       ├── agentic/chat      # Gemini "Ask the Data"
│   │       ├── players/[name]    # profile, shots, similar
│   │       ├── shot-lab/         # hexbin, compare, whatif, zones
│   │       ├── film/             # upload, process, clips, tags, video stream
│   │       ├── matchup/rivals    # head-to-head engine
│   │       ├── lineups           # 5-man lineup search
│   │       └── ...
│   ├── lib/                      # engines + shared utils
│   ├── components/
│   │   ├── charts/               # Radar, Bar, Trend, Comparison, Percentile
│   │   ├── court/                # BasketballCourt, ShotChart, HotZoneChart,
│   │   │                         # ZoneOverlay, Court3DWrapper
│   │   ├── film/                 # ClipCard, ClipPlayer, ClipTimeline,
│   │   │                         # PlayAnalysisModal, UploadZone
│   │   ├── cards/ layout/ ui/    # shared primitives
│   │   └── matchup/ timeline/
│   └── ...
├── video-ml/                     # Python video analysis package
├── scripts/                      # ingest.py, data tooling
├── data/                         # basketball.db + film.db (gitignored)
├── tests/                        # vitest + python tests
├── plans/                        # build plans and orchestration notes
├── DATA_MANIFEST.md              # full schema documentation
├── PRODUCTION_PLAN.md            # ship checklist
└── DECISIONS.md                  # architectural decisions
```

---

## API surface

Every feature is backed by a typed route handler that returns an `ApiResponse<T>` envelope.

```typescript
interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  meta?: { total: number; page: number; limit: number }
}
```

Selected endpoints:

| Route | Returns |
|---|---|
| `GET /api/players/search?q=` | Typeahead player search |
| `GET /api/players/[name]` | Full profile + career arc |
| `GET /api/players/[name]/shots` | Shot records with court coords |
| `GET /api/players/[name]/similar` | k-nearest similar players |
| `GET /api/compare?a=&b=` | Side-by-side stat delta |
| `GET /api/shot-lab/zones` | Zone efficiency grid |
| `POST /api/shot-lab/whatif` | Remove-a-zone recomputation |
| `GET /api/matchup/rivals/[name]` | Top rivals by games played |
| `GET /api/matchup/games?a=&b=` | Head-to-head game log |
| `GET /api/lineups` | 5-man lineup search |
| `GET /api/teams/[abbr]` | Team page payload |
| `GET /api/timeline/[name]` | Career timeline events |
| `POST /api/agentic/chat` | Gemini NL → SQL → result |
| `POST /api/film/upload` | Upload a clip |
| `POST /api/film/process` | Kick off the video-ML pipeline |
| `GET /api/film/clips` | Search clips by tag |
| `PATCH /api/film/clips/[id]` | Edit clip tags inline |
| `GET /api/film/video/[filename]` | Range-request video stream |

All DB access goes through engines in `src/lib/` — route handlers stay thin.

---

## Design system

- Tailwind CSS 4 with CSS custom properties for tokens (`src/lib/design-tokens.ts`)
- Dark-first theme with a light switcher via `theme-context.tsx`
- Court renders as real SVG with real dimensions, not an image — everything from hexbins to zone overlays is drawn on top with D3
- Framer Motion handles page transitions and chart reveals
- Typography: variable-weight sans for UI, numeric tabular figures for stat tables

No template-looking pages. Every surface has intentional hierarchy, spacing, and motion. Hover/focus/active states are designed, not defaulted.

---

## Testing

- **67 unit tests** across engines, utilities, and components (Vitest + Testing Library)
- **80+ integration tests** against a fixture slice of the real DB
- **Python tests** for the video-ML pipeline (`video-ml/tests/`)
- **Regression tests** — `tests/test_regression.py` — guard against data corruption after re-ingest

```bash
npm test              # all unit + integration
pytest video-ml/tests # python pipeline
```

---

## Production notes

The codebase has been through a production-quality pass:

- `src/lib/api-error.ts` — typed error handler with request correlation
- `src/lib/api-response.ts` — consistent envelope for every endpoint
- Engine-level caching for expensive aggregations
- Read-only DB connection, WAL mode, query timeouts
- Gemini prompt is locked to an allowlist of tables and columns — no arbitrary SQL
- Next.js 16 static route optimization where possible
- Full a11y pass on every page (semantic landmarks, focus management, ARIA on charts)
- SEO metadata per route via the App Router metadata API

See `PRODUCTION_PLAN.md` for the ship checklist and `DECISIONS.md` for architectural history.

---

## Credits

Data from Basketball Reference, NBA Stats, and public play-by-play feeds.
YOLOv11 weights via Ultralytics. Gemini API by Google.

Built as a deep dive into NBA history and a playground for data + ML + design working together.
