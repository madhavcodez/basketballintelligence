# Basketball Intelligence

5.7 million shots. 45 years of box scores. 55 tables. One local SQLite database.

A full-stack NBA analytics platform that lets you explore basketball history through shot heatmaps, player comparisons, AI-powered natural language queries, and computer vision film analysis — all running locally.

---

## The Data

| Dataset | Records | Range |
|---|---:|---|
| Shot records (with court coordinates) | 5,700,000+ | 1997–2025 |
| Player game logs | 452,000+ | 1980–2025 |
| Per-game season stats | 24,600+ | 1980–2025 |
| Advanced season stats | 24,400+ | 1980–2025 |
| Playoff shot records | 380,000+ | 1997–2025 |
| Player biographies | 5,407 | 1947–2025 |
| Lineup combinations | 24,000+ | 2008–2025 |

Single SQLite file. Read-only WAL mode. No cloud database, no API rate limits, no external dependencies for core features.

---

## Features

**Shot Lab** — Hexbin heatmaps over a full court. Compare two shooters side-by-side. "What-if" panel strips out a zone and recalculates efficiency.

**Hot Zones** — 14-zone court overlay showing efficiency vs. league average. Track zone shifts season by season.

**Player Lab** — Career arcs with peak detection, milestone mapping, and k-nearest-neighbor similarity search across all 5,407 players.

**Film Room** — Upload game footage. YOLO detects players, ball, and hoop. Pipeline segments scenes, classifies actions, aligns to play-by-play, and writes structured clips to SQLite. Browse 427 pre-analyzed clips with court diagrams.

**Ask the Data** — Natural language → SQL via Gemini. Ask "who had the most 30-point games in the 2020 playoffs?" — get an answer with the query that produced it.

**Compare** — Side-by-side radar charts across 8 stat dimensions with per-game deltas and similarity scoring.

**Matchups** — Head-to-head rivalry breakdowns, game logs, and edge analysis between any two players.

**Lineup Lab** — 5-man combination analyzer across 24K+ lineup records.

**Team DNA** — Franchise profiles with rosters, standings, lineup chemistry, and usage distribution.

**Stories** — Scrollytelling narratives driven by real data — rise of the three, pace-and-space era impact, peak comparisons.

**Play** — Trivia pulled from real statistical records. Guess players from anonymized shot charts and career arcs.

**Explore** — Directory of every player in the database with era/team/position filters and real headshots.

---

## Tech Stack

| Layer | Stack |
|---|---|
| Frontend | Next.js 16, React 19, TypeScript 5, Tailwind CSS 4 |
| Visualization | D3 v7 (hexbins, radar charts, SVG courts), Recharts, Framer Motion |
| Database | SQLite via better-sqlite3 — 55 tables, ~1.7 GB |
| AI | Google Gemini (natural language → SQL) |
| Video ML | Python — YOLOv11, OpenCV, EasyOCR, sentence-transformers |
| Testing | Vitest + Testing Library (67 tests), pytest (80+ tests) |

---

## Architecture

```
Browser → Next.js App Router → API Routes (52+) → SQLite
                                                → Gemini API

Game footage → ffprobe → scene detect → YOLO → classify → tag → embed → film.db
```

All database access goes through engine modules in `src/lib/` — route handlers stay thin. Engines handle similarity search, zone aggregation, career arc detection, matchup resolution, and timeline construction.

---

## Getting Started

```bash
git clone https://github.com/madhavcodez/basketballintelligence.git
cd basketballintelligence
npm install

cp .env.example .env.local
# Add GEMINI_API_KEY for the /ask feature (optional)

npm run dev
```

Expects `data/basketball.db` — build from CSVs with `scripts/ingest.py` or drop in a pre-built copy.

### Video ML Pipeline (optional)

```bash
cd video-ml
pip install -r requirements.txt
python -m scripts.process_game --input game.mp4
```

Every heavy dependency has a fallback — runs without YOLO, ffmpeg, or sentence-transformers installed by falling back to mock/deterministic alternatives.

### Docker

```bash
docker build -t basketball-intelligence .
docker run -p 3000:3000 -v $(pwd)/data:/app/data basketball-intelligence
```

---

## Project Structure

```
src/
├── app/
│   ├── (pages)/         # 12 feature pages
│   └── api/             # 52+ route handlers
├── components/
│   ├── charts/          # RadarChart, ShotChart, HotZoneChart, TrendLine
│   ├── court/           # SVG court rendering, hexbin overlays, zone maps
│   ├── film/            # Clip player, timeline, upload, analysis modal
│   ├── matchup/         # Head-to-head display components
│   ├── timeline/        # Career arc visualization
│   ├── cards/           # Stat cards, insight summaries
│   └── ui/              # Shared primitives
├── lib/
│   ├── db.ts            # SQLite query layer
│   ├── *-engine.ts      # Feature engines (similarity, zones, matchups, timeline)
│   └── film-db.ts       # Video clip database layer
video-ml/                # Python YOLO pipeline (9 processing stages)
scripts/                 # Data ingestion and validation
tests/                   # Regression and schema tests
```

---

## API

Every endpoint returns a typed `ApiResponse<T>` envelope. Selected routes:

| Route | Purpose |
|---|---|
| `GET /api/players/search?q=` | Player typeahead |
| `GET /api/players/[name]/shots` | Shot records with court coordinates |
| `GET /api/players/[name]/similar` | k-nearest neighbors |
| `GET /api/shot-lab/zones` | Zone efficiency grid |
| `POST /api/shot-lab/whatif` | Zone removal simulation |
| `GET /api/matchup/games?a=&b=` | Head-to-head game log |
| `POST /api/agentic/chat` | Natural language → SQL |
| `POST /api/film/upload` | Video upload |
| `GET /api/film/clips` | Clip search by tag |

---

Data sourced from Basketball Reference, NBA Stats, and public play-by-play feeds.
