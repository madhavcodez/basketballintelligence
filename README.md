# Basketball Intelligence Playground

NBA data exploration and analysis platform with 5.7M+ shot records, advanced player comparisons, AI-powered natural language queries, and film room video analysis.

## Prerequisites

- Node.js 20+
- SQLite database file (`data/basketball.db`, ~1.5GB)

## Setup

1. Clone and install:
   ```bash
   git clone https://github.com/madhavcodez/basketballintelleginece.git
   cd basketballintelleginece
   npm install
   ```

2. Configure environment:
   ```bash
   cp .env.example .env.local
   # Edit .env.local and add your GEMINI_API_KEY
   ```

3. Place the database file at `data/basketball.db`

4. Run:
   ```bash
   npm run dev
   ```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |

## Architecture

- **Framework**: Next.js 16 + TypeScript + Tailwind CSS 4
- **Database**: SQLite (better-sqlite3), read-only, ~1.5GB
- **AI**: Gemini API for natural language data queries
- **Charts**: D3.js for shot charts and visualizations

## Pages

| Page | Route | Description |
|------|-------|-------------|
| Home | `/` | Homepage with featured players and search |
| Directory | `/explore` | Browse all players with filters |
| Player Lab | `/player/[name]` | Deep player analysis with timeline |
| Compare | `/compare` | Side-by-side player comparison |
| Shot Lab | `/shot-lab` | Shot chart analysis with hexbin heatmaps |
| Hot Zones | `/zones` | Per-player shooting heatmaps vs. league average |
| Team DNA | `/team/[abbr]` | Team statistics and roster |
| Matchup | `/matchup` | Head-to-head game history |
| Stories | `/stories` | Data-driven narratives |
| Play Mode | `/play` | Basketball trivia quiz |
| Lineups | `/lineup` | 5-man lineup analysis |
| Ask | `/ask` | AI-powered natural language data queries |
| Film Room | `/film` | Video clip analysis with AI tagging |

## Data

55 SQLite tables covering NBA statistics from 1980–2025:
- 5.7M shot records with court coordinates
- 452K player game logs
- 24K+ season statistics (per-game and advanced)
- 5,407 player biographies
- Lineup, tracking, draft, and award data

See `DATA_MANIFEST.md` for complete schema documentation.

## Docker

```bash
docker build -t basketball-intelligence .
docker run -p 3000:3000 -v $(pwd)/data:/app/data basketball-intelligence
```
