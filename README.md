# Basketball Intelligence

A full-stack NBA analytics platform with interactive visualizations, AI-powered analysis, and a computer vision video pipeline. Built with Next.js 16, React 19, TypeScript, SQLite, and Python ML.

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev
# Open http://localhost:3000
```

**Prerequisites:** Node.js 18+, Python 3.11+ (for video pipeline)

---

## Architecture Overview

```
basketballintelligence/
|
|-- src/                          # Next.js frontend + API
|   |-- app/                      # App Router pages + API routes
|   |   |-- api/                  # 52+ REST endpoints (v1 + v2)
|   |   |   |-- v2/              # Versioned API with playoff/season support
|   |   |   |-- film/            # Video clip CRUD + streaming
|   |   |   |-- zones/           # Shot zone aggregation + heatmaps
|   |   |   |-- agentic/chat/    # NL->SQL "Ask the Data" engine
|   |   |-- (page routes)        # 10 product surfaces (see below)
|   |-- lib/                      # Core business logic
|   |   |-- db.ts                # SQLite query layer (better-sqlite3)
|   |   |-- playoffs-db.ts      # V2 queries with SeasonType support
|   |   |-- similarity-engine.ts # Player similarity (Z-score + cosine)
|   |   |-- insights-engine.ts   # Contextual insight generation
|   |   |-- zone-engine.ts      # Shot zone classification + efficiency
|   |   |-- season-context.tsx   # Global regular/playoff toggle (React Context)
|   |   |-- nba-assets.ts       # Team IDs, logos, colors
|   |-- components/               # Reusable UI components
|       |-- layout/              # AppShell, navigation
|       |-- ui/                  # GlassCard, Badge, MetricChip, SeasonTypeToggle
|       |-- charts/              # RadarChart, TrendLine, BarChart
|       |-- court/               # BasketballCourt, ShotChart, HotZones
|       |-- cards/               # ShotDNA, InsightCard, SimilarPlayersCard
|       |-- film/                # ClipCard, ClipPlayer, TagBadge
|
|-- video-ml/                     # Python ML pipeline
|   |-- pipeline/                 # 8-stage video processing
|   |   |-- ingest.py            # Video metadata extraction (ffprobe/OpenCV)
|   |   |-- segment.py          # Scene detection (frame differencing)
|   |   |-- detect.py           # YOLO11n object detection (players/ball/hoop)
|   |   |-- classify.py         # Play type + action classification
|   |   |-- align.py            # Clip-to-play-by-play alignment
|   |   |-- tag.py              # Auto-tagging engine
|   |   |-- embed.py            # Semantic embeddings (sentence-transformers)
|   |   |-- export.py           # Write to film.db + JSON export
|   |   |-- link.py             # Cross-DB linking (film.db -> basketball.db)
|   |-- utils/                    # Supporting utilities
|   |   |-- scoreboard_ocr.py   # Score/clock extraction (EasyOCR)
|   |   |-- court_detect.py     # Court line detection
|   |   |-- frame_extract.py    # Key frame extraction
|   |-- models/schemas.py        # Pydantic data models
|   |-- config.py                # Pipeline configuration
|   |-- tests/                    # 147 pytest tests (80%+ coverage)
|
|-- scripts/                      # Data pipeline + DevOps
|   |-- ingest-basketball-data.py # CSV -> SQLite ingestion (55 tables)
|   |-- validate.py              # Data validation framework
|   |-- regression_snapshot.py   # Before/after data drift detection
|   |-- run_pipeline.py          # Orchestrator: ingest -> index -> validate
|   |-- add_indexes.py           # Database index optimization
|   |-- verify_db.py             # Schema + integrity audit
|   |-- integration-test.sh      # Curl-based E2E test suite
|
|-- data/
|   |-- basketball.db            # 1.5 GB, 55 tables, 5M+ shot records
|   |-- film.db                  # Video clips, tags, annotations
|   |-- clips/                   # Extracted video segments
|   |-- thumbnails/              # Clip preview images
```

---

## Product Surfaces (10 Pages)

| Surface | Route | Description |
|---------|-------|-------------|
| **Home** | `/` | Top scorers, standings, all-time leaders, featured rivalry |
| **Player Lab** | `/explore` | Searchable player directory with season stats |
| **Compare Studio** | `/compare` | Head-to-head radar charts, percentile bars, career arcs |
| **Shot Lab** | `/shot-lab` | Interactive hexbin heatmaps, zone breakdowns, what-if scenarios |
| **Hot Zones** | `/zones` | Per-player shooting heatmaps with league-average comparison |
| **Team DNA** | `/team/[abbr]` | Team profiles, rosters, game logs, advanced metrics |
| **Film Room** | `/film` | Video clip analysis with AI tagging, search, and filtering |
| **Ask the Data** | `/ask` | Natural language -> SQL queries (20+ supported intents) |
| **Play Mode** | `/play` | Basketball IQ quiz with archetype matching |
| **Lineup Sandbox** | `/lineup` | 5-man lineup builder with trait grades |

Additional: `/stories` (AI narratives), `/matchup` (head-to-head game history), `/player/[name]/timeline` (game-by-game)

---

## Tech Stack

### Frontend
- **Next.js 16.2** (App Router, SSR, API routes)
- **React 19** with Suspense
- **TypeScript** (strict mode)
- **Tailwind CSS v4** with custom design tokens
- **Framer Motion** for animations
- **D3.js + Recharts** for data visualization
- **Lucide React** for icons

### Backend
- **better-sqlite3** for synchronous SQLite queries (Node.js)
- **52+ API endpoints** organized by domain (v1 + v2)
- **Parameterized queries** throughout (SQL injection safe)
- **SeasonType system** (regular/playoffs/combined) across all endpoints

### Data Pipeline
- **Python 3.11+** with pandas, Pydantic
- **55 SQLite tables** ingested from 500+ CSV files
- **Sources:** NBA API, Basketball Reference
- **Validation framework** with row counts, null checks, range checks
- **Regression snapshots** for data drift detection

### Video ML Pipeline
- **YOLO11n** for real-time object detection (players, ball, hoop)
- **EasyOCR** for scoreboard reading (score, clock, quarter)
- **sentence-transformers** (`all-MiniLM-L6-v2`) for clip similarity search
- **OpenCV** for scene detection and frame extraction
- **8-stage pipeline:** ingest -> segment -> detect -> classify -> align -> tag -> embed -> export

### Design System
- Dark glass-morphism (semi-transparent cards, backdrop blur)
- Custom fonts: Inter (body), Syne (display), JetBrains Mono (mono)
- Design tokens: `bg-base`, `text-primary/secondary`, `accent-blue/orange/gold/red`
- Light/dark mode toggle
- Regular/Playoff season toggle (keyboard shortcuts: 1/2/3)

---

## Database Schema

**55 tables** covering the full NBA data landscape:

### Core Player Stats
| Table | Rows | Coverage |
|-------|------|----------|
| `players` | 5,106 | All-time player bios |
| `player_stats_pergame` | 12,846 | Per-game averages (1997-2023) |
| `player_stats_advanced` | 12,846 | Advanced metrics (TS%, USG%, off/def rating) |
| `shots` | 4,260,380 | Shot chart data with x/y coordinates (1997-2025) |
| `player_game_logs` | 424,478 | Game-by-game box scores (2007-2025) |

### Playoff Stats
| Table | Rows | Coverage |
|-------|------|----------|
| `player_stats_playoffs_pergame` | 5,435 | Playoff per-game stats |
| `player_stats_playoffs_advanced` | 5,435 | Playoff advanced metrics |
| `player_game_logs_playoffs` | 31,185 | Playoff game logs |
| `playoff_defense/misc/scoring/usage` | 5,435 each | Categorical playoff splits |

### Team Stats
| Table | Rows | Coverage |
|-------|------|----------|
| `team_traditional/advanced/defense/scoring/four_factors` | ~800 each | Regular + playoff, 6 stat categories |
| `team_opponent_regular/playoff` | ~800 each | Opponent stats |
| `standings` | 775 | Conference standings (1999-2025) |

### Enrichment Data
| Table | Rows | Coverage |
|-------|------|----------|
| `awards` | 362 | MVP, DPOY, ROY, etc. |
| `draft` | 8,374 | Draft history (1966-2025) |
| `contracts_salaries` | 9,456 | Player contracts |
| `injury_history` | 27,105 | Transaction/injury log |
| `nba_comprehensive_stats` | 24,630 | Unified stat profiles |

### Film Database (film.db)
| Table | Description |
|-------|-------------|
| `videos` | Video metadata (title, resolution, FPS, teams) |
| `clips` | Detected segments with play type, action, player |
| `tags` | Tag definitions (action, player, team, context, quality) |
| `clip_tags` | Many-to-many clip-tag associations |
| `annotations` | User annotations on clips |

---

## Key Features

### Player Similarity Engine
Uses Z-score normalization and cosine similarity across 8 dimensions (TS%, USG%, off/def rating, eFG%, AST%, TRB%, PIE) to find statistically similar players. Example: LeBron James -> Giannis (98%), Luka (98%), Tatum (97%).

### Ask the Data (NL -> SQL)
20+ supported natural language intents with safe parameterized queries:
- "who won MVP in 2024" (awards intent)
- "compare LeBron and Curry" (comparison intent)
- "top scorers this season" (leaders intent)
- "draft picks from Duke" (draft intent)

### Contextual Insights
Auto-generated stat callouts on player/team pages:
- Trend alerts (scoring surges/dips between seasons)
- Milestone proximity (approaching career point milestones)
- Award streaks (All-Star/All-NBA selections)
- Team performance highlights (elite win rates, defensive ratings)

### Playoff Mode
Global toggle that switches every surface between regular season and playoff data. 27 seasons of playoff data available. Keyboard shortcuts: `1` = Regular, `2` = Playoffs, `3` = Combined.

### Video Analysis Pipeline
Upload basketball video -> AI segments into clips -> YOLO detects players/ball -> classifies play types -> auto-tags -> generates embeddings for similarity search. Browse, filter, and analyze clips in the Film Room.

---

## Development

### Running the App
```bash
npm install
npm run dev          # Start dev server at localhost:3000
npm run build        # Production build
npm run lint         # ESLint check
```

### Running the Data Pipeline
```bash
# Full pipeline: ingest + index + validate
python scripts/run_pipeline.py

# Ingest only new tables
python scripts/run_pipeline.py --new-only

# Verify database integrity
python scripts/verify_db.py

# Take regression snapshot
python scripts/regression_snapshot.py snapshot
```

### Running the Video Pipeline
```bash
cd video-ml
pip install -r requirements.txt

# Process a game video
python -m scripts.process_game \
  --input ../data/lakers_vs_warriors_jan_15_2025.mp4 \
  --home-team LAL --away-team GSW \
  --game-date 2025-01-15 --season 2024-25

# Run tests
python -m pytest tests/ -v --cov
```

### Running Tests
```bash
# Video ML tests (147 tests, 80%+ coverage)
cd video-ml && python -m pytest tests/ -v

# Integration tests (52+ API endpoints)
bash scripts/integration-test.sh

# Data validation
python scripts/validate.py
```

### Project Structure Conventions
- **Immutability:** Always create new objects, never mutate
- **Small files:** 200-400 lines typical, 800 max
- **API safety:** All queries parameterized, LIMIT clauses everywhere
- **Graceful degradation:** `tableExists()` checks before querying optional tables
- **SeasonType:** All V2 endpoints accept `?seasonType=regular|playoffs|combined`

---

## Data Sources

| Source | What We Get |
|--------|-------------|
| **NBA API** | Shot charts, player/team game logs, lineups, tracking stats, standings |
| **Basketball Reference** | Per-game/advanced/per-100/per-36/totals stats, shooting splits, draft history, awards |
| **Derived** | Shot zone aggregates, player career timelines, playoff-vs-regular comparisons |

Raw CSVs stored in `~/Downloads/basketball_data/` (500+ files, 2 GB).

---

## Future Plans

### Phase 1: Convert to Scouting Tool
- Build scouting report generator (AI-powered player evaluations)
- Add prospect comparison (draft prospects vs. historical players at same age)
- Create "what if" trade analyzer using contract + stat data
- Build coaching playbook mode (tag clips as plays, create sequences)
- Export scouting reports as PDFs

### Phase 2: Expanded Stats & Features
- **Clutch stats:** Performance in close games (last 5 min, score within 5)
- **Hustle stats:** Deflections, loose balls, charges drawn, screen assists
- **Synergy-style play type breakdowns:** Isolation, P&R ball handler/roll man, spot-up, post-up efficiency
- **Win probability model:** Game state -> win probability using historical data
- **Player impact metrics:** Build custom RAPM/EPM-style impact metrics
- **Shot difficulty model:** Classify shot difficulty using defender distance + shot clock + shot type
- **Lineup chemistry scores:** Beyond +/-, model synergy between specific player archetypes
- **Draft model:** Predict NBA success from college stats + combine measurements

### Phase 3: More Data
- **Remaining team data:** Four factors for all seasons (currently 1997-2023), team game logs for playoffs
- **Play-by-play data:** ~750 remaining games to scrape from NBA API
- **Award voting data:** Full voting breakdowns (MVP shares, DPOY votes)
- **Real-time data feeds:** Live game integration via NBA API
- **International leagues:** EuroLeague, G League, FIBA stats
- **Historical expansion:** Pre-1996 shot chart data, ABA stats
- **Salary cap data:** Full cap table, luxury tax, exceptions
- **Injury reports:** Real-time injury status, return timelines
- **Social/media data:** Player sentiment, media mentions, social engagement

### Phase 4: Infrastructure
- Deploy to cloud (Vercel + managed SQLite or Turso)
- Add user authentication and saved preferences
- Real-time game updates via WebSocket
- Mobile-responsive redesign
- Collaborative annotations on film clips
- API rate limiting and caching layer

---

## Contributing

1. Clone the repo
2. `npm install` and `npm run dev`
3. Read `DECISIONS.md` for architectural context
4. Read `DATA_MANIFEST.md` for database schema details
5. Check `plans/` for existing implementation plans

### Branch Strategy
- `main` — stable, deployable
- Feature branches — `feat/feature-name`
- Bug fixes — `fix/description`
